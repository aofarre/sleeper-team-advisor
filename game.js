const STORAGE_KEY = "roster-signal-settings-v1";
const MAX_LEAGUES = 2;
const API_ROOT = "https://api.sleeper.app/v1";
const $ = (id) => document.getElementById(id);

function isObject(value) { return value !== null && typeof value === "object"; }
function safeArray(value) { return Array.isArray(value) ? value : []; }
function formatTime(timestamp) { return timestamp ? new Date(timestamp).toLocaleString() : "Not refreshed yet"; }
function playerName(player, playerId) {
  if (!player) return playerId || "Unknown player";
  return `${player.first_name || ""} ${player.last_name || ""}`.trim() || player.full_name || playerId || "Unknown player";
}
function positionOf(player) { return player?.position || player?.fantasy_positions?.[0] || "Unknown"; }

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return isObject(stored) ? { username: stored.username || "", leagueIds: safeArray(stored.leagueIds).slice(0, MAX_LEAGUES), decisions: isObject(stored.decisions) ? stored.decisions : {} } : { username: "", leagueIds: [], decisions: {} };
  } catch (_) { return { username: "", leagueIds: [], decisions: {} }; }
}
const state = { settings: typeof localStorage === "undefined" ? { username: "", leagueIds: [], decisions: {} } : loadSettings(), nflState: null, players: {}, leagues: [], refreshAt: null, refreshVersion: 0 };

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
      <section class="subcard"><h3>Waiver / free-agent candidates</h3><p class="notice">Unrostered player-directory entries prioritized by basic roster need. Availability, waivers, and news can change; confirm in Sleeper before acting.</p><div class="candidate-list">${candidates.length ? candidates.map(({ id, player }, index) => `<div class="candidate"><span class="candidate-rank">${index + 1}</span><div><strong>${escapeText(playerName(player, id))}</strong><small>${escapeText(positionOf(player))} · ${escapeText(player.team || "FA")} · ${escapeText(player.status || "unknown status")}</small></div><span class="reason">${needs[0] ? `Fits ${escapeText(needs[0].position)} need` : "Depth option"}</span></div>`).join("") : '<p class="notice">No candidate list is available until the Sleeper player directory loads.</p>'}</div></section>
      <section class="subcard"><h3>Recent league transactions</h3><div class="transaction-list">${transactions.length ? transactions.map((item) => `<div class="player-chip"><div><strong>${escapeText(item.type)}</strong><small>${item.adds.length ? `Add: ${item.adds.map(escapeText).join(", ")}` : ""}${item.adds.length && item.drops.length ? " · " : ""}${item.drops.length ? `Drop: ${item.drops.map(escapeText).join(", ")}` : ""}</small></div><small>${escapeText(item.status)}</small></div>`).join("") : '<p class="notice">No transactions were returned for the current or prior matchup week.</p>'}</div></section>
    </div><div class="stack">
      <section class="subcard"><h3>Start / sit workspace</h3><p class="notice">Manual only: enter your own expert projections and risk notes. They remain in this browser and are not sent to Sleeper.</p>${decisionRows(groups, model.leagueId)}</section>
    </div></div>
  </article>`;
}
function render() {
  $("username-input").value = state.settings.username;
  $("league-one-input").value = state.settings.leagueIds[0] || "";
  $("league-two-input").value = state.settings.leagueIds[1] || "";
  $("empty-state").hidden = state.leagues.length > 0 || state.settings.leagueIds.length > 0;
  $("league-results").innerHTML = state.leagues.map(renderLeague).join("");
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
  state.settings = { username: "", leagueIds: [], decisions: {} };
  state.leagues = [];
  state.players = {};
  state.nflState = null;
  $("connection-message").textContent = "Local usernames, league IDs, and manual start/sit notes were removed from this browser. No Sleeper data was changed.";
  setStatus("Local data removed");
  render();
}
function bindEvents() {
  $("save-connect-button").addEventListener("click", saveAndRefresh);
  $("refresh-button").addEventListener("click", refreshData);
  $("reset-button").addEventListener("click", resetLocalData);
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
  if (state.settings.username && state.settings.leagueIds.length) refreshData();
}
if (typeof module !== "undefined") module.exports = { MAX_LEAGUES, currentWeek, findRoster, rosterGroups, rosterNeeds, rankFromRosters, freeAgents, transactionSummary };
