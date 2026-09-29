import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const apiRoot = "https://api.sleeper.app/v1";
const outputDirectory = join(process.cwd(), "data", "snapshots");
const sourceDefinitions = {
  directory: {
    id: "sleeper-player-directory",
    name: "Sleeper public player directory",
    path: "players/nfl?active=true",
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
  rotoWireRss: {
    id: "rotowire-nfl-rss",
    name: "RotoWire public NFL RSS",
    url: "https://www.rotowire.com/rss/news.php?sport=NFL",
    format: "rss",
    coverage: "Published player-news titles and timestamps from RotoWire's public NFL RSS feed; a linked editorial update, not a projection or waiver ranking.",
  },
};

function sourceUrl(definition) {
  return definition.url || `${apiRoot}/${definition.path}`;
}

async function sourceFetch(definition) {
  const response = await fetch(sourceUrl(definition), {
    headers: { Accept: "application/json, application/rss+xml, application/xml;q=0.9", "User-Agent": "Roster-Signal-Tuesday-Refresh/2.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return definition.format === "rss" ? response.text() : response.json();
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
    url: sourceUrl(definition),
    fetchedAt,
    status: result?.ok ? "available" : "unavailable",
    coverage: result?.ok ? definition.coverage : `${definition.coverage} Refresh failed: ${result?.error || "not requested"}`,
  };
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function tagValue(item, tag) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

export function parseRssItems(xml) {
  return [...String(xml || "").matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].map((match) => {
    const item = match[1];
    const title = tagValue(item, "title");
    const url = tagValue(item, "link");
    const publishedAt = tagValue(item, "pubDate");
    return title && url && publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? { title, url, publishedAt: new Date(publishedAt).toISOString() } : null;
  }).filter(Boolean);
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function matchEditorialItems(players, items) {
  const idsByName = new Map(Object.entries(players || {}).map(([id, player]) => [
    normalizeName(`${player.first_name || ""} ${player.last_name || ""}`),
    id,
  ]));
  return (Array.isArray(items) ? items : []).reduce((matches, item) => {
    const playerName = item.title.split(":")[0];
    const playerId = idsByName.get(normalizeName(playerName));
    if (!playerId) return matches;
    if (!matches[playerId]) matches[playerId] = [];
    matches[playerId].push({ source: "RotoWire public NFL RSS", title: item.title.slice(0, 240), url: item.url, publishedAt: item.publishedAt });
    return matches;
  }, {});
}

export function buildAutomatedSnapshot({ generatedAt, players, nflState, trendingAdds, trendingDrops, editorialItems, results }) {
  const adds = normalizeTrending(trendingAdds);
  const drops = normalizeTrending(trendingDrops);
  const editorialMatches = matchEditorialItems(players, editorialItems);
  const playerContext = Object.fromEntries(
    Object.entries(players || {})
      .filter(([, player]) => player?.active !== false && player?.team && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(player?.position))
      .map(([id, player]) => [id, {
        playerName: `${player.first_name || ""} ${player.last_name || ""}`.trim() || player.full_name || id,
        position: player.position,
        team: player.team || "",
        status: player.status || "",
        injury: player.injury_notes || player.injury_status || "",
        practiceParticipation: player.practice_participation || "",
        trendAdds: adds[id] ?? null,
        trendDrops: drops[id] ?? null,
        editorialMentions: editorialMatches[id] || [],
        updatedAt: generatedAt,
        sourceUrl: sourceUrl(sourceDefinitions.directory),
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
    return { key, ok: true, value: await sourceFetch(definition) };
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
    editorialItems: results.rotoWireRss.ok ? parseRssItems(values.rotoWireRss) : [],
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
