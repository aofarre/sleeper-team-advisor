const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_LEAGUES, SNAPSHOT_SCHEMA_VERSION, currentWeek, findRoster, rosterGroups, rosterNeeds, rankFromRosters, freeAgents, transactionSummary, waiverSettings, rosterRuleSummary, buildWaiverReview, parseSnapshot, parseTradeAssets, analyzeTrade } = require("../game.js");

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
test("validates an attributed local player-context snapshot", () => {
  const snapshot = parseSnapshot({
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: "2026-09-29T14:00:00.000Z",
    source: { name: "Licensed context export", url: "https://example.test/context" },
    playerContext: { wr: { valuation: 25, projection: 11.5, status: "Questionable" } },
  });
  assert.equal(snapshot.source.name, "Licensed context export");
  assert.equal(snapshot.playerContext.wr.valuation, 25);
  assert.throws(() => parseSnapshot({ schemaVersion: 1, generatedAt: "invalid", source: { name: "Source" }, playerContext: {} }), /generatedAt/);
  assert.throws(() => parseSnapshot({ schemaVersion: 1, generatedAt: "2026-09-29T14:00:00.000Z", source: { name: "Source" }, playerContext: { wr: { projection: "unknown" } } }), /Projection/);
});
test("resolves trade assets by Sleeper ID or full name without inventing a valuation", () => {
  assert.deepEqual(parseTradeAssets("Wide Out\nrb", players).map((asset) => [asset.id, asset.name, asset.valuation]), [["wr", "Wide Out", null], ["rb", "Run Back", null]]);
  const analysis = analyzeTrade({
    giveText: "Wide Out",
    receiveText: "Run Back",
    prompt: "Need RB depth",
    roster: { players: ["qb", "wr"] },
    league: { roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE"] },
    players,
  });
  assert.equal(analysis.headline, "Context-limited assessment");
  assert.match(analysis.valueSummary, /No numeric verdict/);
  assert.match(analysis.needSummary, /RB/);
});
test("builds a review-only waiver add/drop list from Sleeper roster rules and attributed context", () => {
  const waiver = waiverSettings({ settings: { waiver_type: 3, waiver_budget: 100, waiver_day: 2, daily_waivers: 1 } });
  assert.deepEqual(waiver, { waiverType: "Sleeper mode 3", waiverDay: "Day 2", budget: 100, dailyWaivers: 1 });
  assert.equal(rosterRuleSummary({ roster_positions: ["QB", "RB", "RB", "WR", "FLEX"] }), "1 QB · 2 RB · 1 WR · 1 FLEX");
  const reviewPlayers = {
    ...players,
    rb: { ...players.rb, bye_week: 7 },
    rb2: { first_name: "Spare", last_name: "Back", position: "RB", team: "EEE" },
    wr2: { first_name: "Waiver", last_name: "Wide", position: "WR", team: "FFF", bye_week: 5 },
  };
  const review = buildWaiverReview({
    roster: { players: ["qb", "rb", "rb2", "wr"], starters: ["qb", "rb", "wr"] },
    rosters: [{ players: ["qb", "rb", "rb2", "wr"] }],
    league: { roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE"], settings: { playoff_week_start: 15 } },
    players: reviewPlayers,
    week: 4,
    playerContext: { wr2: { projection: 12, valuation: 20, injury: "", news: "Imported source note" } },
  });
  assert.equal(review.playoffWeek, 15);
  assert.equal(review.recommendations[0].add.id, "wr2");
  assert.equal(review.recommendations[0].drop.id, "rb2");
  assert.match(review.recommendations[0].add.reasons.join(" "), /imported projection 12/);
  assert.match(review.recommendations[0].add.reasons.join(" "), /playoffs start Week 15/);
});
