const STORAGE_KEY = "roster-signal-settings-v1";
const MAX_LEAGUES = 2;
const API_ROOT = "https://api.sleeper.app/v1";
const SNAPSHOT_SCHEMA_VERSION = 1;
const DEPLOYED_SNAPSHOT_URL = "data/snapshots/latest.json";
const $ = (id) => document.getElementById(id);

function isObject(value) { return value !== null && typeof value === "object"; }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function formatTime(timestamp) { return timestamp ? new Date(timestamp).toLocaleString() : "Not refreshed yet"; }
function defaultSettings() {
  return {
    username: "",
    leagueIds: [],
    decisions: {},
    sourceConfig: { name: "", url: "", tradeEndpoint: "" },
    manualSnapshot: null,
  };
}
function playerName(player, playerId) {
  if (!player) return playerId || "Unknown player";
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || player.full_name || playerId || "Unknown player";
}
function positionOf(player) { return player?.position || player?.fantasy_positions?.[0] || "Unknown"; }

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!isObject(stored)) return defaultSettings();
    return {
      ...defaultSettings(),
      username: stored.username || "",
      leagueIds: safeArray(stored.leagueIds).slice(0, MAX_LEAGUES),
      decisions: isObject(stored.decisions) ? stored.decisions : {},
      sourceConfig: { ...defaultSettings().sourceConfig, ...(isObject(stored.sourceConfig) ? stored.sourceConfig : {}) },
      manualSnapshot: isObject(stored.manualSnapshot) ? stored.manualSnapshot : null,
    };
  } catch (_) { return defaultSettings(); }
}
const state = { settings: typeof localStorage === "undefined" ? defaultSettings() : loadSettings(), nflState: null, players: {}, leagues: [], refreshAt: null, refreshVersion: 0, deployedSnapshot: null };

function saveSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
}
function setStatus(message, error = false) {
  const status = $("app-status");
  status.textContent = message;
  status.classList.toggle("error", error);
}
async function sleeperFetch(path) {
  const response = await fetch(`${API_ROOT}/${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText || "Sleeper API request failed"}`);
  return response.json();
}
function currentWeek(nflState) {
  if (!nflState || nflState.season_type !== "regular") return null;
  return Number(nflState.week) || null;
}
function findRoster(rosters, userId) {
  return safeArray(rosters).find((roster) => roster.owner_id === userId || safeArray(roster.co_owners).includes(userId)) || null;
}
function rosterGroups(roster, players) {
  const ids = new Set(safeArray(roster?.players));
  const starters = safeArray(roster?.starters).filter((id) => ids.has(id));
  const reserve = new Set(safeArray(roster?.reserve));
  const bench = [...ids].filter((id) => !starters.includes(id) && !reserve.has(id));
  return { starters, bench, ir: [...reserve] };
}
function countPositions(playerIds, players) {
  return safeArray(playerIds).reduce((counts, playerId) => {
    const position = positionOf(players[playerId]);
    if (["QB", "RB", "WR", "TE", "K", "DEF"].includes(position)) counts[position] = (counts[position] || 0) + 1;
    return counts;
  }, {});
}
function rosterNeeds(roster, league, players) {
  const counts = countPositions(roster?.players, players);
  const starters = safeArray(league?.roster_positions);
  const targets = { QB: starters.filter((slot) => slot === "QB").length || 1, RB: starters.filter((slot) => slot === "RB").length || 2, WR: starters.filter((slot) => slot === "WR").length || 2, TE: starters.filter((slot) => slot === "TE").length || 1 };
  ["K", "DEF"].forEach((position) => {
    const slots = starters.filter((slot) => slot === position).length;
    if (slots) targets[position] = slots;
  });
  return Object.entries(targets).map(([position, target]) => ({ position, shortage: Math.max(0, target - (counts[position] || 0)), depth: counts[position] || 0 }))
    .filter((need) => need.shortage > 0 || need.depth <= (need.position === "QB" ? 1 : 2))
    .sort((a, b) => b.shortage - a.shortage || a.depth - b.depth);
}
function rankFromRosters(rosters, targetRoster) {
  const sorted = safeArray(rosters).slice().sort((a, b) => (b.settings?.wins || 0) - (a.settings?.wins || 0) || (a.settings?.losses || 0) - (b.settings?.losses || 0));
  const index = sorted.findIndex((roster) => roster.roster_id === targetRoster?.roster_id);
  return index === -1 ? null : index + 1;
}
function record(roster) {
  const settings = roster?.settings || {};
  if (settings.wins === undefined && settings.losses === undefined) return "Unavailable";
  return `${settings.wins || 0}-${settings.losses || 0}${settings.ties ? `-${settings.ties}` : ""}`;
}
function findMatchup(matchups, rosterId) {
  return safeArray(matchups).find((matchup) => matchup.roster_id === rosterId) || null;
}
function matchupOpponent(matchups, ownMatchup) {
  if (!ownMatchup?.matchup_id) return null;
  return safeArray(matchups).find((matchup) => matchup.matchup_id === ownMatchup.matchup_id && matchup.roster_id !== ownMatchup.roster_id) || null;
}
function freeAgents(rosters, players, needs) {
  const rostered = new Set(safeArray(rosters).flatMap((roster) => safeArray(roster.players)));
  const neededPositions = needs.filter((need) => need.shortage > 0).map((need) => need.position);
  const fallbacks = ["RB", "WR", "TE", "QB"];
  const preferred = neededPositions.length ? neededPositions : fallbacks;
  return Object.entries(players).map(([id, player]) => ({ id, player })).filter(({ id, player }) =>
    !rostered.has(id) && player?.active !== false && preferred.includes(positionOf(player)) && playerName(player, id) !== "Unknown player"
  ).sort((a, b) => {
    const aNeed = preferred.indexOf(positionOf(a.player));
    const bNeed = preferred.indexOf(positionOf(b.player));
    return aNeed - bNeed || playerName(a.player, a.id).localeCompare(playerName(b.player, b.id));
  }).slice(0, 8);
}
function transactionSummary(transactions, players) {
  return safeArray(transactions).slice().sort((a, b) => (b.status_updated || 0) - (a.status_updated || 0)).slice(0, 8).map((transaction) => {
    const adds = Object.keys(transaction.adds || {}).map((id) => playerName(players[id], id));
    const drops = Object.keys(transaction.drops || {}).map((id) => playerName(players[id], id));
    return { type: transaction.type || "transaction", adds, drops, status: transaction.status || "unknown" };
  });
}
function escapeText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[char]);
}
function parseSnapshot(snapshot) {
  if (!isObject(snapshot)) throw new Error("Snapshot must be a JSON object.");
  if (snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) throw new Error(`Snapshot schemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}.`);
  if (!snapshot.generatedAt || Number.isNaN(Date.parse(snapshot.generatedAt))) throw new Error("Snapshot needs an ISO generatedAt timestamp.");
  if (!isObject(snapshot.source) || !String(snapshot.source.name || "").trim()) throw new Error("Snapshot source.name is required for attribution.");
  if (!isObject(snapshot.playerContext)) throw new Error("Snapshot playerContext must map Sleeper player IDs to context.");
  const playerContext = {};
  for (const [playerId, context] of Object.entries(snapshot.playerContext)) {
    if (!playerId.trim() || !isObject(context)) throw new Error("Each player context needs a Sleeper player ID and object value.");
    if (context.valuation !== undefined && !Number.isFinite(Number(context.valuation))) throw new Error(`Valuation for ${playerId} must be numeric.`);
    if (context.projection !== undefined && !Number.isFinite(Number(context.projection))) throw new Error(`Projection for ${playerId} must be numeric.`);
    playerContext[playerId] = {
      playerName: String(context.playerName || "").slice(0, 120),
      position: String(context.position || "").slice(0, 20),
      team: String(context.team || "").slice(0, 20),
      status: String(context.status || "").slice(0, 120),
      projection: context.projection === undefined || context.projection === "" ? null : Number(context.projection),
      valuation: context.valuation === undefined || context.valuation === "" ? null : Number(context.valuation),
      injury: String(context.injury || "").slice(0, 500),
      news: String(context.news || "").slice(0, 1000),
      updatedAt: context.updatedAt && !Number.isNaN(Date.parse(context.updatedAt)) ? context.updatedAt : snapshot.generatedAt,
      sourceUrl: String(context.sourceUrl || snapshot.source.url || "").slice(0, 500),
    };
  }
  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    generatedAt: new Date(snapshot.generatedAt).toISOString(),
    source: { name: String(snapshot.source.name).slice(0, 120), url: String(snapshot.source.url || "").slice(0, 500), type: String(snapshot.source.type || "manual").slice(0, 40) },
    playerContext,
  };
}
function activeSnapshot() {
  return state.settings.manualSnapshot || state.deployedSnapshot;
}
function contextFor(playerId) {
  return activeSnapshot()?.playerContext?.[playerId] || null;
}
function contextNote(playerId) {
  const context = contextFor(playerId);
  if (!context) return "";
  const details = [context.status, context.injury, context.projection !== null ? `Proj ${context.projection}` : ""].filter(Boolean);
  return details.join(" · ");
}
function snapshotStatusText(snapshot) {
  if (!snapshot) return "No context imported";
  return `${snapshot.source.name} · ${formatTime(snapshot.generatedAt)}`;
}
function normalizedName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function findPlayerByAsset(asset, players) {
  const query = String(asset || "").trim();
  if (!query) return null;
  if (players[query]) return { id: query, player: players[query] };
  const normalized = normalizedName(query);
  const found = Object.entries(players).find(([id, player]) => normalizedName(playerName(player, id)) === normalized);
  return found ? { id: found[0], player: found[1] } : null;
}
function parseTradeAssets(value, players) {
  return String(value || "").split(/\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 12).map((label) => {
    const found = findPlayerByAsset(label, players);
    const context = found ? contextFor(found.id) : null;
    return {
      label,
      id: found?.id || null,
      name: found ? playerName(found.player, found.id) : label,
      position: found ? positionOf(found.player) : null,
      valuation: context?.valuation ?? null,
      status: contextNote(found?.id),
    };
  });
}
function numericValue(assets) {
  return assets.length && assets.every((asset) => Number.isFinite(asset.valuation)) ? assets.reduce((total, asset) => total + asset.valuation, 0) : null;
}
function tradePositionEffect(give, receive, needs) {
  const needed = new Set(needs.map((need) => need.position));
  const gains = receive.filter((asset) => needed.has(asset.position)).map((asset) => asset.position);
  const losses = give.filter((asset) => needed.has(asset.position)).map((asset) => asset.position);
  if (gains.length && losses.length) return `It exchanges need-area depth: gain ${gains.join(", ")} while sending ${losses.join(", ")}.`;
  if (gains.length) return `It adds current need-area depth at ${gains.join(", ")}.`;
  if (losses.length) return `It removes current need-area depth at ${losses.join(", ")}.`;
  return "Neither side directly changes the roster-count needs currently detected.";
}
function analyzeTrade({ giveText, receiveText, prompt, roster, league, players }) {
  const give = parseTradeAssets(giveText, players);
  const receive = parseTradeAssets(receiveText, players);
  if (!give.length || !receive.length) throw new Error("Enter at least one asset on each side.");
  const needs = rosterNeeds(roster, league, players);
  const giveValue = numericValue(give);
  const receiveValue = numericValue(receive);
  const known = [...give, ...receive].filter((asset) => asset.id);
  const unknown = [...give, ...receive].filter((asset) => !asset.id);
  const needSummary = needs.length
    ? `Current roster flags: ${needs.map((need) => `${need.position} (${need.shortage ? `${need.shortage} starter short` : `${need.depth} depth`})`).join(", ")}.`
    : "No basic positional shortage is currently detected.";
  const valueSummary = giveValue === null || receiveValue === null
    ? "No numeric verdict: every listed asset needs an attributed numeric valuation before totals can be compared."
    : `Attributed valuation totals: give ${giveValue.toFixed(1)}, receive ${receiveValue.toFixed(1)} (${(receiveValue - giveValue).toFixed(1)} net).`;
  return {
    headline: giveValue !== null && receiveValue !== null ? (receiveValue > giveValue ? "Numerically favorable by imported values" : receiveValue < giveValue ? "Numerically unfavorable by imported values" : "Numerically even by imported values") : "Context-limited assessment",
    valueSummary,
    positionSummary: tradePositionEffect(give, receive, needs),
    needSummary,
    give, receive, known, unknown,
    prompt: String(prompt || "").trim(),
    source: activeSnapshot()?.source || null,
  };
}
function playerRows(ids) {
  if (!ids.length) return '<p class="notice">None reported by Sleeper.</p>';
  return ids.map((id) => {
    const player = state.players[id];
    return `<div class="player-chip"><strong>${escapeText(playerName(player, id))}</strong><small>${escapeText(positionOf(player))} · ${escapeText(player?.team || "FA")}</small></div>`;
  }).join("");
}
function decisionRows(groups, leagueId) {
  const ids = groups.starters;
  if (!ids.length) return '<p class="notice">No Sleeper starters are available for this roster.</p>';
  return `<div class="table-wrap"><table class="decision-table"><thead><tr><th>Starter</th><th>Manual projection</th><th>Manual risk / expert note</th></tr></thead><tbody>${ids.map((id) => {
    const key = `${leagueId}:${id}`;
    const decision = state.settings.decisions[key] || {};
    return `<tr><td><strong>${escapeText(playerName(state.players[id], id))}</strong><small>${escapeText(positionOf(state.players[id]))} · ${escapeText(state.players[id]?.team || "FA")}</small></td><td><input data-decision="${escapeText(key)}" data-field="projection" inputmode="decimal" aria-label="Manual projection for ${escapeText(playerName(state.players[id], id))}" value="${escapeText(decision.projection || "")}" placeholder="Enter yours" /></td><td><textarea data-decision="${escapeText(key)}" data-field="note" aria-label="Manual risk note for ${escapeText(playerName(state.players[id], id))}" placeholder="Your injury, matchup, or risk context">${escapeText(decision.note || "")}</textarea></td></tr>`;
  }).join("")}</tbody></table></div>`;
}
function renderLeague(model) {
  const { league, users, rosters, roster, matchups, transactions, error, week } = model;
  const name = league?.name || `League ${model.leagueId}`;
  if (error) return `<article class="card league-card"><div class="league-top"><div><p class="eyebrow">SLEEPER LEAGUE</p><h2>${escapeText(name)}</h2><p class="data-source">League ID ${escapeText(model.leagueId)} · last attempt ${escapeText(formatTime(model.refreshedAt))}</p></div><span class="tag error">Needs attention</span></div><p class="notice">Could not load this league: ${escapeText(error)}. Check that the ID is public and that the username belongs to this league, then refresh. Other saved leagues remain available.</p></article>`;
  if (!roster) return `<article class="card league-card"><div class="league-top"><div><p class="eyebrow">SLEEPER LEAGUE</p><h2>${escapeText(name)}</h2><p class="data-source">League ID ${escapeText(model.leagueId)} · refreshed ${escapeText(formatTime(model.refreshedAt))}</p></div><span class="tag error">Roster not found</span></div><p class="notice">The saved username does not own a roster in this league. Confirm the Sleeper username or select a league where that account participates.</p></article>`;
  const groups = rosterGroups(roster, state.players);
  const needs = rosterNeeds(roster, league, state.players);
  const candidates = freeAgents(rosters, state.players, needs);
  const ownMatchup = findMatchup(matchups, roster.roster_id);
  const opponent = matchupOpponent(matchups, ownMatchup);
  const opponentUser = users.find((user) => user.user_id === rosters.find((item) => item.roster_id === opponent?.roster_id)?.owner_id);
  const me = users.find((user) => user.user_id === roster.owner_id);
  const rank = rankFromRosters(rosters, roster);
  const tradeText = needs.length ? `Prioritize ${needs.slice(0, 2).map((need) => need.position).join(" and ")} depth. Review bench surplus before proposing a trade; this is a roster-count summary, not a valuation model.` : "No immediate starter-count shortage is detected. Consider trades around bench depth, upcoming schedule, and your own expert inputs.";
  const matchupSupported = ownMatchup && opponent && Number.isFinite(Number(ownMatchup.points)) && Number.isFinite(Number(opponent.points));
  return `<article class="card league-card">
    <div class="league-top"><div><p class="eyebrow">SLEEPER LEAGUE · ${escapeText(league.season || "CURRENT SEASON")}</p><div class="league-title"><h2>${escapeText(name)}</h2><span class="tag">${escapeText(league.status || "active")}</span></div><p class="data-source">League, users, rosters, players, matchup week ${escapeText(week || "unavailable")}, and transactions · refreshed ${escapeText(formatTime(model.refreshedAt))}</p></div><span class="tag">Manager: ${escapeText(me?.display_name || state.settings.username)}</span></div>
    <div class="league-grid"><div class="stack">
      <section class="subcard"><h3>Season snapshot</h3><div class="stat-grid"><div class="stat"><span>Record</span><strong>${escapeText(record(roster))}</strong></div><div class="stat"><span>Rank</span><strong>${rank ? `#${rank}` : "Unavailable"}</strong></div><div class="stat"><span>Roster</span><strong>${safeArray(roster.players).length} players</strong></div></div></section>
      <section class="subcard"><h3>Roster needs</h3><div class="needs">${needs.length ? needs.map((need) => `<span class="need">${escapeText(need.position)}: ${need.shortage ? `${need.shortage} starter short` : `${need.depth} depth`}</span>`).join("") : '<span class="need">No basic positional shortage</span>'}</div><p class="notice">Needs compare reported roster counts with league starting slots. Flex, bye weeks, injuries, and scoring settings require your judgment.</p></section>
      <section class="subcard"><h3>Trade &amp; roster summary</h3><p class="trade-summary">${escapeText(tradeText)}</p></section>
    </div><div class="stack">
      <section class="subcard"><h3>Current matchup</h3>${matchupSupported ? `<div class="matchup"><div class="matchup-team"><strong>${escapeText(me?.display_name || "You")}</strong><span>Roster ${roster.roster_id}</span><div class="score">${escapeText(ownMatchup.points)}</div></div><div class="versus">VS<br>WEEK ${escapeText(week)}</div><div class="matchup-team"><strong>${escapeText(opponentUser?.display_name || `Roster ${opponent.roster_id}`)}</strong><span>Opponent</span><div class="score">${escapeText(opponent.points)}</div></div></div><p class="notice">Scores are Sleeper matchup points. Projection is unavailable because this API response does not provide a trusted projection.</p>` : '<p class="notice">No supported current matchup score is available from Sleeper for this roster and week. The advisor does not estimate or invent a matchup projection.</p>'}</section>
      <section class="subcard"><h3>Your roster</h3><div class="roster-groups"><div class="roster-group"><h3>Starters</h3>${playerRows(groups.starters)}</div><div class="roster-group"><h3>Bench</h3>${playerRows(groups.bench)}</div><div class="roster-group"><h3>IR / reserve</h3>${playerRows(groups.ir)}</div></div></section>
    </div></div>
    <div class="league-grid"><div class="stack">
      <section class="subcard"><h3>Waiver / free-agent candidates</h3><p class="notice">Unrostered player-directory entries prioritized by basic roster need. Availability is calculated from this league’s Sleeper rosters; confirm waivers before acting.${activeSnapshot() ? ` Added context is attributed to ${escapeText(activeSnapshot().source.name)} at ${escapeText(formatTime(activeSnapshot().generatedAt))}.` : " No injury, news, or projection context is loaded."}</p><div class="candidate-list">${candidates.length ? candidates.map(({ id, player }, index) => `<div class="candidate"><span class="candidate-rank">${index + 1}</span><div><strong>${escapeText(playerName(player, id))}</strong><small>${escapeText([positionOf(player), player.team || "FA", player.status || "unknown status", contextNote(id)].filter(Boolean).join(" · "))}</small></div><span class="reason">${needs[0] ? `Fits ${escapeText(needs[0].position)} need` : "Depth option"}</span></div>`).join("") : '<p class="notice">No candidate list is available until the Sleeper player directory loads.</p>'}</div></section>
      <section class="subcard"><h3>Recent league transactions</h3><div class="transaction-list">${transactions.length ? transactions.map((item) => `<div class="player-chip"><div><strong>${escapeText(item.type)}</strong><small>${item.adds.length ? `Add: ${item.adds.map(escapeText).join(", ")}` : ""}${item.adds.length && item.drops.length ? " · " : ""}${item.drops.length ? `Drop: ${item.drops.map(escapeText).join(", ")}` : ""}</small></div><small>${escapeText(item.status)}</small></div>`).join("") : '<p class="notice">No transactions were returned for the current or prior matchup week.</p>'}</div></section>
    </div><div class="stack">
      <section class="subcard"><h3>Start / sit workspace</h3><p class="notice">Manual only: enter your own expert projections and risk notes. They remain in this browser and are not sent to Sleeper.</p>${decisionRows(groups, model.leagueId)}</section>
    </div></div>
  </article>`;
}
function renderTradeLeagueOptions() {
  const select = $("trade-league-select");
  const selected = select.value;
  const options = state.leagues.filter((model) => model.roster && !model.error).map((model) =>
    `<option value="${escapeText(model.leagueId)}">${escapeText(model.league.name || `League ${model.leagueId}`)}</option>`
  );
  select.disabled = !options.length;
  select.innerHTML = options.length ? options.join("") : "<option>Load a league to analyze</option>";
  if (options.some((option) => option.includes(`value="${escapeText(selected)}"`))) select.value = selected;
}
function renderSnapshotStatus() {
  const snapshot = activeSnapshot();
  $("snapshot-status").textContent = snapshotStatusText(snapshot);
  $("snapshot-source-name-input").value = state.settings.sourceConfig.name;
  $("snapshot-source-url-input").value = state.settings.sourceConfig.url;
  $("trade-endpoint-input").value = state.settings.sourceConfig.tradeEndpoint;
  $("analyze-trade-with-endpoint-button").disabled = !state.settings.sourceConfig.tradeEndpoint;
  if (!snapshot) {
    $("snapshot-message").textContent = "Source configuration, endpoint URL, and imported context are local to this browser. No provider credential can be entered or stored here.";
    return;
  }
  const scope = Object.keys(snapshot.playerContext).length;
  $("snapshot-message").textContent = `${state.settings.manualSnapshot ? "Imported" : "Deployed"} snapshot: ${snapshot.source.name}, generated ${formatTime(snapshot.generatedAt)}, with ${scope} player context record${scope === 1 ? "" : "s"}.${snapshot.source.url ? ` Attribution: ${snapshot.source.url}` : ""}`;
}
function renderTradeAnalysis(analysis, remoteText = "") {
  const result = $("trade-analysis-result");
  const assetList = (assets) => assets.map((asset) => `<li><strong>${escapeText(asset.name)}</strong>${asset.position ? ` (${escapeText(asset.position)})` : ""}${asset.valuation !== null ? ` · value ${escapeText(asset.valuation)}` : " · no imported value"}${asset.status ? ` · ${escapeText(asset.status)}` : ""}</li>`).join("");
  result.innerHTML = `<p><strong>${escapeText(analysis.headline)}</strong> — ${escapeText(analysis.valueSummary)}</p>
    <p>${escapeText(analysis.positionSummary)} ${escapeText(analysis.needSummary)}</p>
    <p><strong>You give:</strong></p><ul class="context-list">${assetList(analysis.give)}</ul>
    <p><strong>You receive:</strong></p><ul class="context-list">${assetList(analysis.receive)}</ul>
    ${analysis.unknown.length ? `<p class="notice">Unmatched assets: ${escapeText(analysis.unknown.map((asset) => asset.label).join(", "))}. They were not connected to a Sleeper player or imported valuation.</p>` : ""}
    ${analysis.source ? `<p class="notice">Context source: ${escapeText(analysis.source.name)} · ${escapeText(formatTime(activeSnapshot().generatedAt))}. ${analysis.source.url ? `Attribution: ${escapeText(analysis.source.url)}` : ""}</p>` : "<p class=\"notice\">No imported valuation/news source was used.</p>"}
    ${analysis.prompt ? `<p class="notice">Question considered: ${escapeText(analysis.prompt)}</p>` : ""}${remoteText}`;
}
function render() {
  $("username-input").value = state.settings.username;
  $("league-one-input").value = state.settings.leagueIds[0] || "";
  $("league-two-input").value = state.settings.leagueIds[1] || "";
  $("empty-state").hidden = state.leagues.length > 0 || state.settings.leagueIds.length > 0;
  $("league-results").innerHTML = state.leagues.map(renderLeague).join("");
  renderSnapshotStatus();
  renderTradeLeagueOptions();
}
async function loadLeague(leagueId, userId) {
  const refreshedAt = Date.now();
  try {
    const league = await sleeperFetch(`league/${encodeURIComponent(leagueId)}`);
    const week = currentWeek(state.nflState);
    const [users, rosters, matchups, currentTransactions, priorTransactions] = await Promise.all([
      sleeperFetch(`league/${encodeURIComponent(leagueId)}/users`),
      sleeperFetch(`league/${encodeURIComponent(leagueId)}/rosters`),
      week ? sleeperFetch(`league/${encodeURIComponent(leagueId)}/matchups/${week}`) : Promise.resolve([]),
      week ? sleeperFetch(`league/${encodeURIComponent(leagueId)}/transactions/${week}`) : Promise.resolve([]),
      week && week > 1 ? sleeperFetch(`league/${encodeURIComponent(leagueId)}/transactions/${week - 1}`) : Promise.resolve([]),
    ]);
    return { leagueId, league, users, rosters, roster: findRoster(rosters, userId), matchups, transactions: transactionSummary([...currentTransactions, ...priorTransactions], state.players), week, refreshedAt };
  } catch (error) { return { leagueId, error: error.message, refreshedAt }; }
}
async function refreshData() {
  const leagueIds = state.settings.leagueIds;
  if (!state.settings.username || !leagueIds.length) {
    setStatus("Add a username and at least one league ID", true);
    $("connection-message").textContent = "Enter your Sleeper username and one or two public league IDs, then select Save & refresh.";
    return;
  }
  $("refresh-button").disabled = true;
  $("save-connect-button").disabled = true;
  const refreshVersion = ++state.refreshVersion;
  setStatus("Refreshing public Sleeper data…");
  $("connection-message").textContent = "Loading public league, roster, player directory, matchup, and transaction data. Saved local inputs remain available if a request fails.";
  try {
    const user = await sleeperFetch(`user/${encodeURIComponent(state.settings.username)}`);
    const [nflState, players] = await Promise.all([sleeperFetch("state/nfl"), sleeperFetch("players/nfl")]);
    if (refreshVersion !== state.refreshVersion) return;
    state.nflState = nflState;
    state.players = players;
    const leagues = await Promise.all(leagueIds.map((leagueId) => loadLeague(leagueId, user.user_id)));
    if (refreshVersion !== state.refreshVersion) return;
    state.leagues = leagues;
    state.refreshAt = Date.now();
    const failures = state.leagues.filter((item) => item.error).length;
    $("connection-message").textContent = `Sleeper data refreshed ${formatTime(state.refreshAt)} from documented public endpoints. ${failures ? `${failures} league${failures === 1 ? "" : "s"} needs attention.` : "All saved leagues loaded."}`;
    setStatus(failures ? "Refresh completed with recoverable errors" : `Updated ${formatTime(state.refreshAt)}`, Boolean(failures));
  } catch (error) {
    if (refreshVersion !== state.refreshVersion) return;
    $("connection-message").textContent = `Unable to refresh: ${error.message}. Check your username, connection, and Sleeper API availability. Your saved identifiers and manual notes were not removed.`;
    setStatus("Sleeper refresh failed", true);
  } finally {
    if (refreshVersion === state.refreshVersion) {
      $("refresh-button").disabled = false;
      $("save-connect-button").disabled = false;
      render();
    }
  }
}
function saveAndRefresh() {
  const username = $("username-input").value.trim();
  const leagueIds = [$("league-one-input").value.trim(), $("league-two-input").value.trim()].filter(Boolean).filter((id, index, values) => values.indexOf(id) === index).slice(0, MAX_LEAGUES);
  state.settings.username = username;
  state.settings.leagueIds = leagueIds;
  saveSettings();
  refreshData();
}
function resetLocalData() {
  state.refreshVersion += 1;
  localStorage.removeItem(STORAGE_KEY);
  state.settings = defaultSettings();
  state.leagues = [];
  state.players = {};
  state.nflState = null;
  $("connection-message").textContent = "Local usernames, league IDs, and manual start/sit notes were removed from this browser. No Sleeper data was changed.";
  setStatus("Local data removed");
  render();
}
function importSnapshotText(text, origin = "manual") {
  let parsed;
  try {
    parsed = parseSnapshot(JSON.parse(text));
  } catch (error) {
    $("snapshot-message").textContent = `Snapshot not imported: ${error.message}`;
    setStatus("Snapshot needs correction", true);
    return false;
  }
  if (origin === "manual") {
    const config = state.settings.sourceConfig;
    if (config.name) parsed.source.name = config.name;
    if (config.url) parsed.source.url = config.url;
    parsed.source.type = "manual-or-licensed-import";
    state.settings.manualSnapshot = parsed;
    saveSettings();
  } else {
    state.deployedSnapshot = parsed;
  }
  $("snapshot-message").textContent = `${origin === "manual" ? "Imported" : "Loaded"} ${Object.keys(parsed.playerContext).length} attributed player context records from ${parsed.source.name}, generated ${formatTime(parsed.generatedAt)}.`;
  setStatus(`${origin === "manual" ? "Local" : "Tuesday"} snapshot ready`);
  render();
  return true;
}
async function loadDeployedSnapshot() {
  $("load-baseline-button").disabled = true;
  $("snapshot-message").textContent = "Loading the deployed Tuesday baseline…";
  try {
    const response = await fetch(DEPLOYED_SNAPSHOT_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText || "snapshot unavailable"}`);
    importSnapshotText(JSON.stringify(await response.json()), "deployed");
  } catch (error) {
    $("snapshot-message").textContent = `The deployed Tuesday baseline is not available: ${error.message}. You can still import an attributed manual snapshot.`;
    setStatus("Baseline unavailable", true);
  } finally {
    $("load-baseline-button").disabled = false;
  }
}
function saveSourceConfig() {
  const endpoint = $("trade-endpoint-input").value.trim();
  if (endpoint) {
    try {
      const url = new URL(endpoint, window.location.href);
      if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Endpoint must use HTTPS.");
    } catch (error) {
      $("snapshot-message").textContent = `Secure endpoint not saved: ${error.message}`;
      setStatus("Endpoint needs correction", true);
      return;
    }
  }
  state.settings.sourceConfig = {
    name: $("snapshot-source-name-input").value.trim(),
    url: $("snapshot-source-url-input").value.trim(),
    tradeEndpoint: endpoint,
  };
  saveSettings();
  $("snapshot-message").textContent = "Source attribution and optional endpoint URL were saved only in this browser. API keys are never accepted by this static app.";
  setStatus("Local source config saved");
  render();
}
function selectedTradeModel() {
  const leagueId = $("trade-league-select").value;
  return state.leagues.find((model) => model.leagueId === leagueId && model.roster && !model.error) || null;
}
function buildTradeAnalysis() {
  const model = selectedTradeModel();
  if (!model) throw new Error("Load a Sleeper league and select it before analyzing.");
  return analyzeTrade({
    giveText: $("trade-give-input").value,
    receiveText: $("trade-receive-input").value,
    prompt: $("trade-prompt-input").value,
    roster: model.roster,
    league: model.league,
    players: state.players,
  });
}
function analyzeTradeLocally() {
  try {
    renderTradeAnalysis(buildTradeAnalysis());
    setStatus("Trade assessed locally");
  } catch (error) {
    $("trade-analysis-result").innerHTML = `<p class="notice">${escapeText(error.message)}</p>`;
    setStatus("Trade needs more information", true);
  }
}
async function analyzeTradeWithEndpoint() {
  let analysis;
  try {
    analysis = buildTradeAnalysis();
  } catch (error) {
    $("trade-analysis-result").innerHTML = `<p class="notice">${escapeText(error.message)}</p>`;
    setStatus("Trade needs more information", true);
    return;
  }
  const endpoint = state.settings.sourceConfig.tradeEndpoint;
  if (!endpoint) return;
  $("analyze-trade-with-endpoint-button").disabled = true;
  renderTradeAnalysis(analysis, "<p class=\"notice\">Requesting the configured secure endpoint…</p>");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis, league: { id: selectedTradeModel().leagueId, name: selectedTradeModel().league.name }, requestedAt: new Date().toISOString() }),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText || "endpoint request failed"}`);
    const result = await response.json();
    if (!isObject(result) || typeof result.analysis !== "string") throw new Error("Endpoint response needs an analysis string.");
    renderTradeAnalysis(analysis, `<p><strong>Secure endpoint response</strong></p><p>${escapeText(result.analysis)}</p><p class="notice">The response is supplemental to the local deterministic assessment. Verify its cited sources independently.</p>`);
    setStatus("Trade endpoint response received");
  } catch (error) {
    renderTradeAnalysis(analysis, `<p class="notice">Configured endpoint unavailable: ${escapeText(error.message)}. The local deterministic assessment remains above.</p>`);
    setStatus("Trade endpoint unavailable", true);
  } finally {
    $("analyze-trade-with-endpoint-button").disabled = false;
  }
}
function bindEvents() {
  $("save-connect-button").addEventListener("click", saveAndRefresh);
  $("refresh-button").addEventListener("click", refreshData);
  $("reset-button").addEventListener("click", resetLocalData);
  $("save-source-config-button").addEventListener("click", saveSourceConfig);
  $("load-baseline-button").addEventListener("click", loadDeployedSnapshot);
  $("import-snapshot-button").addEventListener("click", () => importSnapshotText($("snapshot-json-input").value));
  $("clear-snapshot-button").addEventListener("click", () => {
    state.settings.manualSnapshot = null;
    saveSettings();
    $("snapshot-json-input").value = "";
    $("snapshot-message").textContent = "Imported manual or licensed-provider context was removed from this browser. The deployed baseline can still be loaded.";
    setStatus("Imported context removed");
    render();
  });
  $("snapshot-file-input").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      $("snapshot-json-input").value = String(reader.result || "");
      importSnapshotText($("snapshot-json-input").value);
    };
    reader.onerror = () => {
      $("snapshot-message").textContent = "Could not read the selected snapshot file.";
      setStatus("Snapshot file unreadable", true);
    };
    reader.readAsText(file);
  });
  $("analyze-trade-button").addEventListener("click", analyzeTradeLocally);
  $("analyze-trade-with-endpoint-button").addEventListener("click", analyzeTradeWithEndpoint);
  $("league-results").addEventListener("input", (event) => {
    const target = event.target;
    if (!target.dataset.decision) return;
    const previous = state.settings.decisions[target.dataset.decision] || {};
    state.settings.decisions[target.dataset.decision] = { ...previous, [target.dataset.field]: target.value };
    saveSettings();
  });
}
if (typeof document !== "undefined") {
  bindEvents();
  render();
  loadDeployedSnapshot();
  if (state.settings.username && state.settings.leagueIds.length) refreshData();
}
if (typeof module !== "undefined") module.exports = {
  MAX_LEAGUES,
  SNAPSHOT_SCHEMA_VERSION,
  currentWeek,
  findRoster,
  rosterGroups,
  rosterNeeds,
  rankFromRosters,
  freeAgents,
  transactionSummary,
  parseSnapshot,
  parseTradeAssets,
  analyzeTrade,
};
