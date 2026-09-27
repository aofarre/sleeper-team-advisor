import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const apiRoot = "https://api.sleeper.app/v1";
const outputDirectory = join(process.cwd(), "data", "snapshots");

async function sleeperFetch(path) {
  const response = await fetch(`${apiRoot}/${path}`, {
    headers: { Accept: "application/json", "User-Agent": "Roster-Signal-Tuesday-Refresh/1.0" },
  });
  if (!response.ok) throw new Error(`Sleeper ${path}: ${response.status} ${response.statusText}`);
  return response.json();
}

const [nflState, players] = await Promise.all([sleeperFetch("state/nfl"), sleeperFetch("players/nfl")]);
const generatedAt = new Date().toISOString();
const playerContext = Object.fromEntries(
  Object.entries(players)
    .filter(([, player]) => player?.active !== false && ["QB", "RB", "WR", "TE", "K", "DEF"].includes(player?.position))
    .map(([id, player]) => [id, {
      playerName: `${player.first_name || ""} ${player.last_name || ""}`.trim() || player.full_name || id,
      position: player.position,
      team: player.team || "",
      status: player.status || "",
      updatedAt: generatedAt,
    }]),
);
const snapshot = {
  schemaVersion: 1,
  generatedAt,
  source: {
    name: "Sleeper public player directory",
    url: "https://docs.sleeper.com/",
    type: "documented-public-api",
  },
  scope: {
    description: "Public player identity and reported player status only; not league-specific availability, injury news, projections, or valuation.",
    nflState: { season: nflState.season || null, week: nflState.week || null, seasonType: nflState.season_type || null },
  },
  playerContext,
};

await mkdir(outputDirectory, { recursive: true });
const date = generatedAt.slice(0, 10);
const body = `${JSON.stringify(snapshot, null, 2)}\n`;
await Promise.all([
  writeFile(join(outputDirectory, "latest.json"), body),
  writeFile(join(outputDirectory, `sleeper-public-${date}.json`), body),
]);
console.log(`Wrote ${Object.keys(playerContext).length} public player records for ${date}.`);
