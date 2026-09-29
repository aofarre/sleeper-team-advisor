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
  const candidatePlayers = {
    ...players,
    retired: { first_name: "Old", last_name: "Player", position: "WR", active: true, status: "Retired" },
    reserve: { first_name: "Reserve", last_name: "Player", position: "WR", team: "DDD", active: true, status: "Injured Reserve" },
  };
  const rosters = [{ roster_id: 1, players: ["qb"], settings: { wins: 5, losses: 1 } }, { roster_id: 2, players: ["rb"], settings: { wins: 3, losses: 3 } }];
  assert.equal(rankFromRosters(rosters, rosters[1]), 2);
  const candidates = freeAgents(rosters, candidatePlayers, [{ position: "WR", shortage: 1, depth: 0 }]);
  assert.deepEqual(candidates.map((candidate) => candidate.id).sort(), ["te", "wr"]);
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
  assert.equal(snapshot.playerContext.wr.trendAdds, null);
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
    wr3: { first_name: "Fallback", last_name: "Wide", position: "WR", team: "GGG" },
  };
  const review = buildWaiverReview({
    roster: { players: ["qb", "rb", "rb2", "wr"], starters: ["qb", "rb", "wr"] },
    rosters: [{ players: ["qb", "rb", "rb2", "wr"] }],
    league: { roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE"], settings: { playoff_week_start: 15 } },
    players: reviewPlayers,
    week: 4,
    playerContext: { wr2: { projection: 12, valuation: 20, trendAdds: 41, trendDrops: 0, injury: "", news: "Imported source note" } },
  });
  assert.equal(review.playoffWeek, 15);
  assert.equal(review.recommendations[0].add.id, "wr2");
  assert.equal(review.recommendations[0].drop.id, "rb2");
  assert.match(review.recommendations[0].add.reasons.join(" "), /imported projection 12/);
  assert.match(review.recommendations[0].add.reasons.join(" "), /Sleeper 7-day adds 41/);
  assert.match(review.recommendations[0].add.reasons.join(" "), /playoffs start Week 15/);
});
test("scores every eligible candidate before ranking, so a high-signal Braelon Allen is not lost to an alphabetical cap", () => {
  const fixturePlayers = {
    qb: { first_name: "Quarter", last_name: "Back", position: "QB", team: "AAA" },
    rb1: { first_name: "Roster", last_name: "Runner", position: "RB", team: "AAA" },
    rb2: { first_name: "Roster", last_name: "Depth", position: "RB", team: "BBB" },
    wr1: { first_name: "Roster", last_name: "Wide", position: "WR", team: "CCC" },
    wr2: { first_name: "Roster", last_name: "Wide Two", position: "WR", team: "DDD" },
    te: { first_name: "Roster", last_name: "Tight", position: "TE", team: "EEE" },
    braelon: { first_name: "Braelon", last_name: "Allen", position: "RB", team: "NYJ", active: true },
  };
  for (let index = 1; index <= 10; index += 1) fixturePlayers[`alpha${index}`] = { first_name: "Alpha", last_name: `Runner ${index}`, position: "RB", team: "AAA", active: true };
  const review = buildWaiverReview({
    roster: { players: ["qb", "rb1", "rb2", "wr1", "wr2", "te"], starters: ["qb", "rb1", "wr1", "te"] },
    rosters: [{ players: ["qb", "rb1", "rb2", "wr1", "wr2", "te"] }],
    league: { roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE"], settings: {} },
    players: fixturePlayers,
    week: 4,
    now: Date.parse("2026-09-29T18:00:00.000Z"),
    playerContext: {
      braelon: {
        trendAdds: 50,
        trendDrops: 0,
        editorialMentions: [{ source: "RotoWire public NFL RSS", title: "Braelon Allen: Takes larger role", url: "https://example.test/braelon", publishedAt: "2026-09-29T17:00:00.000Z" }],
      },
    },
  });
  assert.equal(review.adds[0].id, "braelon");
  assert.ok(review.adds.some((candidate) => candidate.id === "braelon"));
  assert.ok(review.adds[0].score > review.adds[1].score);
  assert.match(review.adds[0].reasons.join(" "), /Sleeper 7-day adds 50/);
  assert.match(review.adds[0].reasons.join(" "), /attributed player update 1h ago/);
});
test("uses cross-position roster fit so redundant TE depth does not dominate overall waiver priorities", () => {
  const fixturePlayers = {
    qb: { first_name: "Roster", last_name: "Quarterback", position: "QB", team: "AAA" },
    rb: { first_name: "Roster", last_name: "Runningback", position: "RB", team: "BBB" },
    wr: { first_name: "Roster", last_name: "Wideout", position: "WR", team: "CCC" },
    mcbride: { first_name: "Trey", last_name: "McBride", position: "TE", team: "ARI", search_rank: 22 },
    likely: { first_name: "Isaiah", last_name: "Likely", position: "TE", team: "NYG", search_rank: 105 },
    middlingTe: { first_name: "Middling", last_name: "Tight End", position: "TE", team: "DDD", active: true },
    strongRb: { first_name: "Strong", last_name: "Runner", position: "RB", team: "EEE", active: true },
    strongWr: { first_name: "Strong", last_name: "Receiver", position: "WR", team: "FFF", active: true },
    strongQb: { first_name: "Strong", last_name: "Quarterback", position: "QB", team: "GGG", active: true },
  };
  const common = {
    roster: { players: ["qb", "rb", "wr", "mcbride", "likely"], starters: ["qb", "rb", "wr", "mcbride"] },
    rosters: [{ players: ["qb", "rb", "wr", "mcbride", "likely"] }],
    league: { roster_positions: ["QB", "RB", "WR", "TE"], settings: {} },
    players: fixturePlayers,
    week: 4,
    now: Date.parse("2026-09-29T18:00:00.000Z"),
  };
  const review = buildWaiverReview({
    ...common,
    playerContext: {
      strongRb: { trendAdds: 100, trendDrops: 0, editorialMentions: [] },
      strongWr: { trendAdds: 90, trendDrops: 0, editorialMentions: [] },
      strongQb: { trendAdds: 80, trendDrops: 0, editorialMentions: [] },
      middlingTe: { trendAdds: 5, trendDrops: 0, editorialMentions: [] },
    },
  });
  const orderedIds = review.adds.map((candidate) => candidate.id);
  assert.ok(orderedIds.indexOf("strongRb") < orderedIds.indexOf("middlingTe"));
  assert.ok(orderedIds.indexOf("strongWr") < orderedIds.indexOf("middlingTe"));
  assert.ok(orderedIds.indexOf("strongQb") < orderedIds.indexOf("middlingTe"));
  assert.match(review.adds.find((candidate) => candidate.id === "middlingTe").reasons.join(" "), /replacement coverage reduces marginal value/);

  const exceptionalTeReview = buildWaiverReview({
    ...common,
    playerContext: {
      strongRb: { trendAdds: 100, trendDrops: 0, editorialMentions: [] },
      middlingTe: { trendAdds: 5, trendDrops: 0, editorialMentions: [] },
      exceptionalTe: {
        projection: 25,
        valuation: 100,
        trendAdds: 1000,
        trendDrops: 0,
        editorialMentions: [{ source: "RotoWire public NFL RSS", title: "Exceptional Tight End: Expanded role", url: "https://example.test/exceptional-te", publishedAt: "2026-09-29T17:00:00.000Z" }],
      },
    },
    players: {
      ...fixturePlayers,
      exceptionalTe: { first_name: "Exceptional", last_name: "Tight End", position: "TE", team: "HHH", active: true },
    },
  });
  assert.equal(exceptionalTeReview.adds[0].id, "exceptionalTe");
  assert.match(exceptionalTeReview.adds[0].reasons.join(" "), /overall priority/);
});
test("normalizes automated Sleeper sources and preserves partial source failures", async () => {
  const { normalizeTrending, parseRssItems, matchEditorialItems, buildAutomatedSnapshot } = await import("../scripts/refresh-sleeper-snapshot.mjs");
  assert.deepEqual(normalizeTrending([{ player_id: "wr", count: 42 }, { player_id: "", count: 2 }, { player_id: "bad", count: "unknown" }]), { wr: 42 });
  const rssItems = parseRssItems("<rss><channel><item><title>Braelon Allen: Takes larger role</title><link>https://example.test/braelon</link><pubDate>Tue, 29 Sep 2026 17:00:00 GMT</pubDate></item></channel></rss>");
  assert.deepEqual(rssItems, [{ title: "Braelon Allen: Takes larger role", url: "https://example.test/braelon", publishedAt: "2026-09-29T17:00:00.000Z" }]);
  assert.equal(matchEditorialItems({ braelon: { first_name: "Braelon", last_name: "Allen" } }, rssItems).braelon[0].title, "Braelon Allen: Takes larger role");
  const generatedAt = "2026-09-29T18:00:00.000Z";
  const snapshot = buildAutomatedSnapshot({
    generatedAt,
    players: { wr: { ...players.wr, active: true, injury_status: "Questionable", practice_participation: "Limited" } },
    nflState: { season: "2026", week: 4, season_type: "regular" },
    trendingAdds: [{ player_id: "wr", count: 42 }],
    trendingDrops: [],
    editorialItems: [],
    results: {
      directory: { ok: true },
      state: { ok: true },
      trendingAdds: { ok: true },
      trendingDrops: { ok: false, error: "503 Service Unavailable" },
      rotoWireRss: { ok: false, error: "RSS unavailable" },
    },
  });
  assert.equal(snapshot.dataQuality.coverage, "partial");
  assert.deepEqual(snapshot.dataQuality.unavailableSources, ["sleeper-trending-drops", "rotowire-nfl-rss"]);
  assert.equal(snapshot.playerContext.wr.trendAdds, 42);
  assert.equal(snapshot.playerContext.wr.injury, "Questionable");
  assert.equal(snapshot.sources.find((source) => source.id === "sleeper-trending-drops").status, "unavailable");
});
