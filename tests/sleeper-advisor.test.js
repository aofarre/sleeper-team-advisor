const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_LEAGUES, currentWeek, findRoster, rosterGroups, rosterNeeds, rankFromRosters, freeAgents, transactionSummary } = require("../game.js");

const players = {
  qb: { first_name: "Quarter", last_name: "Back", position: "QB", team: "AAA" },
  rb: { first_name: "Run", last_name: "Back", position: "RB", team: "BBB" },
  wr: { first_name: "Wide", last_name: "Out", position: "WR", team: "CCC" },
  te: { first_name: "Tight", last_name: "End", position: "TE", team: "DDD" },
};

test("limits saved league connections to two", () => {
  assert.equal(MAX_LEAGUES, 2);
});
test("uses Sleeper's regular-season week only", () => {
  assert.equal(currentWeek({ season_type: "regular", week: 4 }), 4);
  assert.equal(currentWeek({ season_type: "post", week: 19 }), null);
});
test("resolves primary or co-managed user rosters and separates starters, bench, and reserve", () => {
  const roster = { roster_id: 2, owner_id: "me", players: ["qb", "rb", "wr"], starters: ["qb", "rb"], reserve: ["wr"] };
  assert.equal(findRoster([{ owner_id: "other" }, roster], "me"), roster);
  assert.equal(findRoster([{ owner_id: "primary", co_owners: ["me"] }], "me").owner_id, "primary");
  assert.deepEqual(rosterGroups(roster, players), { starters: ["qb", "rb"], bench: [], ir: ["wr"] });
});
test("reports position shortages from roster and league slots including kicker and defense", () => {
  const needs = rosterNeeds({ players: ["qb", "rb"] }, { roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "K", "DEF"] }, players);
  assert.equal(needs.find((need) => need.position === "RB").shortage, 1);
  assert.equal(needs.find((need) => need.position === "WR").shortage, 2);
  assert.equal(needs.find((need) => need.position === "K").shortage, 1);
  assert.equal(needs.find((need) => need.position === "DEF").shortage, 1);
});
test("ranks record position and returns only unrostered position candidates", () => {
  const rosters = [{ roster_id: 1, players: ["qb"], settings: { wins: 5, losses: 1 } }, { roster_id: 2, players: ["rb"], settings: { wins: 3, losses: 3 } }];
  assert.equal(rankFromRosters(rosters, rosters[1]), 2);
  const candidates = freeAgents(rosters, players, [{ position: "WR", shortage: 1, depth: 0 }]);
  assert.deepEqual(candidates.map((candidate) => candidate.id), ["wr"]);
});
test("summarizes Sleeper transaction player changes", () => {
  const summary = transactionSummary([{ type: "waiver", status: "complete", status_updated: 2, adds: { rb: 1 }, drops: { qb: 1 } }], players);
  assert.deepEqual(summary[0], { type: "waiver", status: "complete", adds: ["Run Back"], drops: ["Quarter Back"] });
});
