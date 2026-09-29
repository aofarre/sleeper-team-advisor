import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const apiRoot = "https://api.sleeper.app/v1";
const outputDirectory = join(process.cwd(), "data", "snapshots");
const sourceDefinitions = {
  directory: {
    id: "sleeper-player-directory",
    name: "Sleeper public player directory",
    path: "players/nfl",
    coverage: "Player identity, position, team, bye week, reported status, injury fields, and practice participation.",
  },
  state: {
    id: "sleeper-nfl-state",
    name: "Sleeper public NFL state",
    path: "state/nfl",
    coverage: "Current NFL season, season type, and week.",
  },
  trendingAdds: {
    id: "sleeper-trending-adds",
    name: "Sleeper public trending adds",
    path: "players/nfl/trending/add?lookback_hours=168&limit=100",
    coverage: "Sleeper-wide player additions in the prior seven days; not league-specific availability or a projection.",
  },
  trendingDrops: {
    id: "sleeper-trending-drops",
    name: "Sleeper public trending drops",
    path: "players/nfl/trending/drop?lookback_hours=168&limit=100",
    coverage: "Sleeper-wide player drops in the prior seven days; not league-specific availability or a projection.",
  },
};

function sourceUrl(path) {
  return `${apiRoot}/${path}`;
}

async function sleeperFetch(path) {
  const response = await fetch(sourceUrl(path), {
    headers: { Accept: "application/json", "User-Agent": "Roster-Signal-Tuesday-Refresh/2.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export function normalizeTrending(entries) {
  return Object.fromEntries(
    (Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && entry.player_id && Number.isFinite(Number(entry.count)))
      .map((entry) => [String(entry.player_id), Number(entry.count)]),
  );
}

function sourceRecord(definition, fetchedAt, result) {
  return {
    id: definition.id,
    name: definition.name,
    url: sourceUrl(definition.path),
    fetchedAt,
    status: result.ok ? "available" : "unavailable",
    coverage: result.ok ? definition.coverage : `${definition.coverage} Refresh failed: ${result.error}`,
  };
}

export function buildAutomatedSnapshot({ generatedAt, players, nflState, trendingAdds, trendingDrops, results }) {
  const adds = normalizeTrending(trendingAdds);
  const drops = normalizeTrending(trendingDrops);
  const playerContext = Object.fromEntries(
    Object.entries(players || {})
      .filter(([, player]) => player?.active !== false && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(player?.position))
      .map(([id, player]) => [id, {
        playerName: `${player.first_name || ""} ${player.last_name || ""}`.trim() || player.full_name || id,
        position: player.position,
        team: player.team || "",
        status: player.status || "",
        injury: player.injury_notes || player.injury_status || "",
        practiceParticipation: player.practice_participation || "",
        trendAdds: adds[id] ?? null,
        trendDrops: drops[id] ?? null,
        updatedAt: generatedAt,
        sourceUrl: sourceUrl(sourceDefinitions.directory.path),
      }]),
  );
  const sources = Object.entries(sourceDefinitions).map(([key, definition]) => sourceRecord(definition, generatedAt, results[key]));
  const unavailable = sources.filter((source) => source.status === "unavailable").map((source) => source.id);
  return {
    schemaVersion: 1,
    generatedAt,
    source: {
      name: "Roster Signal automated Sleeper intelligence",
      url: "https://docs.sleeper.com/",
      type: "documented-public-api",
    },
    sources,
    dataQuality: {
      coverage: unavailable.length ? "partial" : "complete",
      unavailableSources: unavailable,
      rankingInputs: "Roster need, league-specific availability, player bye week, reported Sleeper status/injury fields, and seven-day Sleeper trending adds/drops where available.",
    },
    scope: {
      description: "Automated evidence from documented Sleeper public endpoints. It is not a projection, depth-chart, or independent news service.",
      nflState: {
        season: nflState?.season || null,
        week: nflState?.week || null,
        seasonType: nflState?.season_type || null,
      },
    },
    playerContext,
  };
}

async function loadSource(key, definition) {
  try {
    return { key, ok: true, value: await sleeperFetch(definition.path) };
  } catch (error) {
    return { key, ok: false, error: error.message };
  }
}

export async function refreshSnapshot() {
  const generatedAt = new Date().toISOString();
  const loaded = await Promise.all(Object.entries(sourceDefinitions).map(([key, definition]) => loadSource(key, definition)));
  const values = Object.fromEntries(loaded.map((result) => [result.key, result.value]));
  const results = Object.fromEntries(loaded.map((result) => [result.key, result]));
  if (!results.directory.ok) throw new Error(`Required Sleeper player directory refresh failed: ${results.directory.error}`);
  const snapshot = buildAutomatedSnapshot({
    generatedAt,
    players: values.directory,
    nflState: values.state,
    trendingAdds: values.trendingAdds,
    trendingDrops: values.trendingDrops,
    results,
  });
  await mkdir(outputDirectory, { recursive: true });
  const date = generatedAt.slice(0, 10);
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;
  await Promise.all([
    writeFile(join(outputDirectory, "latest.json"), body),
    writeFile(join(outputDirectory, `sleeper-public-${date}.json`), body),
  ]);
  const unavailable = snapshot.dataQuality.unavailableSources;
  console.log(`Wrote ${Object.keys(snapshot.playerContext).length} automated player records for ${date}; ${unavailable.length ? `partial coverage (${unavailable.join(", ")})` : "all sources available"}.`);
  return snapshot;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await refreshSnapshot();
}
