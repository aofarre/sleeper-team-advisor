const PLAYER_POOL = [
  ["Ja'Marr Chase","WR","CIN",3,2,116,1490,12,104,0,0,0,0,0,0],["Justin Jefferson","WR","MIN",3,3,108,1510,11,96,0,0,0,0,0,0],
  ["Bijan Robinson","RB","ATL",1,4,62,520,4,0,0,0,0,1450,12,0,0,0],["CeeDee Lamb","WR","DAL",1,5,112,1410,11,98,0,0,0,0,0,0],
  ["Saquon Barkley","RB","PHI",1,6,45,360,3,0,0,0,0,1580,13,0,0,0],["Amon-Ra St. Brown","WR","DET",1,7,114,1370,10,91,0,0,0,0,0,0],
  ["Jahmyr Gibbs","RB","DET",1,8,54,460,4,0,0,0,0,1280,12,0,0,0],["Puka Nacua","WR","LAR",2,10,104,1390,9,79,0,0,0,0,0,0],
  ["Christian McCaffrey","RB","SF",2,11,68,550,4,0,0,0,0,1210,11,0,0,0],["Nico Collins","WR","HOU",2,14,90,1310,9,64,0,0,0,0,0,0],
  ["Derrick Henry","RB","BAL",2,16,32,260,2,0,0,0,0,1460,14,0,0,0],["Malik Nabers","WR","NYG",2,18,104,1270,8,70,0,0,0,0,0,0],
  ["A.J. Brown","WR","PHI",2,20,87,1290,9,71,0,0,0,0,0,0],["Jonathan Taylor","RB","IND",2,21,35,270,2,0,0,0,0,1390,13,0,0,0],
  ["Josh Allen","QB","BUF",1,22,0,0,0,0,4450,34,13,620,10,0,0,0],["Lamar Jackson","QB","BAL",1,25,0,0,0,0,3850,31,8,820,7,0,0,0],
  ["Brock Bowers","TE","LV",2,27,89,1080,7,75,0,0,0,0,0,0],["Trey McBride","TE","ARI",2,30,96,1010,7,82,0,0,0,0,0,0],
  ["Drake London","WR","ATL",3,31,88,1220,8,65,0,0,0,0,0,0],["De'Von Achane","RB","MIA",3,33,70,620,5,0,0,0,0,940,8,0,0,0],
  ["Jalen Hurts","QB","PHI",2,36,0,0,0,0,3650,27,10,700,12,0,0,0],["Garrett Wilson","WR","NYJ",3,37,98,1180,8,70,0,0,0,0,0,0],
  ["Kyren Williams","RB","LAR",3,39,42,340,3,0,0,0,0,1250,12,0,0,0],["Breece Hall","RB","NYJ",3,41,62,490,3,0,0,0,0,1080,9,0,0,0],
  ["George Kittle","TE","SF",3,46,72,960,8,59,0,0,0,0,0,0],["Jalen McMillan","WR","TB",5,74,62,810,6,40,0,0,0,0,0,0],
  ["Caleb Williams","QB","CHI",4,76,0,0,0,0,3980,26,12,420,4,0,0,0],["Jordan Love","QB","GB",4,82,0,0,0,0,4100,29,11,250,2,0,0,0],
  ["David Montgomery","RB","DET",4,84,30,230,2,0,0,0,0,960,10,0,0,0],["Courtland Sutton","WR","DEN",4,86,68,910,7,50,0,0,0,0,0,0],
  ["Mark Andrews","TE","BAL",4,91,65,780,7,52,0,0,0,0,0,0],["Tyrone Tracy Jr.","RB","NYG",5,96,38,310,2,0,0,0,0,880,7,0,0,0],
  ["Baker Mayfield","QB","TB",5,104,0,0,0,0,4300,30,12,180,1,0,0,0],["Chris Godwin","WR","TB",5,107,73,890,6,55,0,0,0,0,0,0],
  ["Travis Kelce","TE","KC",5,111,70,800,6,55,0,0,0,0,0,0],["Tony Pollard","RB","TEN",5,115,42,330,2,0,0,0,0,920,7,0,0,0],
  ["Dak Prescott","QB","DAL",6,121,0,0,0,0,4200,30,11,160,1,0,0,0],["Jaylen Warren","RB","PIT",6,126,48,380,3,0,0,0,0,780,6,0,0,0],
  ["Rome Odunze","WR","CHI",6,131,61,820,5,45,0,0,0,0,0,0],["David Njoku","TE","CLE",6,136,64,750,5,51,0,0,0,0,0,0],
  ["Justin Herbert","QB","LAC",7,143,0,0,0,0,4050,28,10,220,2,0,0,0],["Ricky Pearsall","WR","SF",7,149,52,720,5,40,0,0,0,0,0,0],
  ["Brian Robinson Jr.","RB","WAS",7,153,28,220,2,0,0,0,0,900,8,0,0,0],["Jake Ferguson","TE","DAL",7,160,60,680,5,49,0,0,0,0,0,0],
  ["Brandon Aubrey","K","DAL",8,172,0,0,0,0,0,0,0,0,0,142,0],["Bills D/ST","DEF","BUF",8,178,0,0,0,0,0,0,0,0,0,0,126],
  ["Evan McPherson","K","CIN",9,190,0,0,0,0,0,0,0,0,0,128,0],["Steelers D/ST","DEF","PIT",9,196,0,0,0,0,0,0,0,0,0,0,118],
].map(([name, position, team, tier, adp, receptions = 0, receivingYards = 0, receivingTd = 0, targets = 0, passingYards = 0, passingTd = 0, interceptions = 0, rushingYards = 0, rushingTd = 0, fieldGoals = 0, defensePoints = 0], index) => ({
  id: `local-${index + 1}`, name, position, team, tier, adp, receptions, receivingYards, receivingTd, targets, passingYards, passingTd, interceptions, rushingYards, rushingTd, fieldGoals, defensePoints,
}));

const DEFAULT_SETTINGS = { ppr: 1, passTd: 4, passInt: -1, needWeight: 16, scarcityWeight: 12, adpWeight: 8, riskWeight: 8 };
const $ = (id) => document.getElementById(id);
let pollTimer;
const state = {
  mode: "mock", teams: 12, userSlot: 1, rosterFormat: "superflex", picks: [], settings: { ...DEFAULT_SETTINGS },
  overrides: {}, showDrafted: false, sleeper: null, playerDirectory: {}, connectionError: "",
};

function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); }
function slotForPick(pickNo, teams = state.teams) {
  const round = Math.ceil(pickNo / teams);
  const positionInRound = (pickNo - 1) % teams + 1;
  return round % 2 ? positionInRound : teams - positionInRound + 1;
}
function isFlex(position) { return ["RB", "WR", "TE"].includes(position); }
function rosterRequirements(format) {
  return format === "superflex" ? { QB: 2, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1 } : { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1 };
}
function scoreProjection(player, settings = state.settings) {
  const offense = (player.passingYards / 25) + (player.passingTd * settings.passTd) + (player.interceptions * settings.passInt)
    + (player.rushingYards / 10) + (player.rushingTd * 6) + (player.receivingYards / 10) + (player.receivingTd * 6) + (player.receptions * settings.ppr);
  return Math.round((offense + player.fieldGoals + player.defensePoints) * 10) / 10;
}
function draftedIds() { return new Set(state.picks.map((pick) => pick.playerId)); }
function rosterPlayers() { return state.picks.filter((pick) => pick.slot === state.userSlot && pick.playerId).map((pick) => getPlayer(pick.playerId)).filter(Boolean); }
function positionNeed(position, roster = rosterPlayers()) {
  const requirements = rosterRequirements(state.rosterFormat);
  const atPosition = roster.filter((player) => player.position === position).length;
  if (atPosition < requirements[position]) return 1;
  const flexFilled = roster.filter((player) => isFlex(player.position)).length - requirements.RB - requirements.WR - requirements.TE;
  if (isFlex(position) && flexFilled < requirements.FLEX) return 0.55;
  return 0.08;
}
function playerPositionRank(player, available) {
  const atPosition = available.filter((candidate) => candidate.position === player.position).sort((a, b) => scoreProjection(b) - scoreProjection(a));
  return atPosition.findIndex((candidate) => candidate.id === player.id) + 1;
}
function currentPickNumber() {
  const total = state.sleeper?.settings?.rounds ? state.sleeper.settings.rounds * state.teams : state.teams * 15;
  for (let pickNo = 1; pickNo <= total; pickNo += 1) if (!state.picks.some((pick) => pick.pickNo === pickNo)) return pickNo;
  return total + 1;
}
function getPlayer(id) { return PLAYER_POOL.find((player) => player.id === id); }
function rankPlayers() {
  const taken = draftedIds();
  const available = PLAYER_POOL.filter((player) => !taken.has(player.id));
  const pickNo = currentPickNumber();
  return available.map((player) => {
    const base = scoreProjection(player);
    const need = positionNeed(player.position) * state.settings.needWeight;
    const scarcity = (1 - ((playerPositionRank(player, available) - 1) / Math.max(1, available.filter((p) => p.position === player.position).length - 1))) * state.settings.scarcityWeight;
    const adp = clamp((pickNo + 8 - player.adp) / 30, -1, 1) * state.settings.adpWeight;
    const override = state.overrides[player.id]?.adjustment || 0;
    const risk = override * (state.settings.riskWeight / 8);
    const score = Math.round((base + need + scarcity + adp + risk) * 10) / 10;
    const reason = [`${base.toFixed(1)} proj.`, need > 1 ? `+${need.toFixed(1)} need` : "", scarcity > 1 ? `+${scarcity.toFixed(1)} scarcity` : "", adp ? `${adp >= 0 ? "+" : ""}${adp.toFixed(1)} ADP` : "", override ? `${risk >= 0 ? "+" : ""}${risk.toFixed(1)} override` : ""].filter(Boolean).join(" | ");
    return { ...player, score, reason };
  }).sort((a, b) => b.score - a.score);
}
function pickForPlayer(playerId, pickNo = currentPickNumber()) {
  if (draftedIds().has(playerId)) return false;
  state.picks.push({ pickNo, slot: slotForPick(pickNo), playerId });
  return true;
}
function setStatus(message, error = false) {
  $("connection-status").textContent = message;
  $("connection-status").classList.toggle("error", error);
}
function text(element, value) { element.textContent = value; return element; }
function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}
function renderRoster() {
  const roster = rosterPlayers();
  $("roster-count").textContent = `${roster.length} player${roster.length === 1 ? "" : "s"}`;
  const list = $("roster-list"); list.replaceChildren();
  const requirements = rosterRequirements(state.rosterFormat);
  Object.entries(requirements).forEach(([position, needed]) => {
    const names = position === "FLEX" ? roster.filter((p) => isFlex(p.position)).slice(-needed) : roster.filter((p) => p.position === position);
    const row = element("div", "roster-row");
    row.append(element("strong", "", `${position} ${names.length}/${needed}`), element("small", "", names.map((p) => p.name).join(", ") || "Open"));
    list.append(row);
  });
}
function renderRiskControls() {
  const select = $("risk-player"); const oldValue = select.value; select.replaceChildren();
  PLAYER_POOL.forEach((player) => select.append(new Option(`${player.name} (${player.position})`, player.id)));
  select.value = oldValue || PLAYER_POOL[0].id;
  const list = $("risk-list"); list.replaceChildren();
  Object.entries(state.overrides).forEach(([id, override]) => {
    const player = getPlayer(id); if (!player) return;
    const row = element("div", "risk-row");
    const content = element("div"); content.append(element("strong", "", player.name), element("small", "", `${override.adjustment > 0 ? "+" : ""}${override.adjustment}: ${override.note || "No note"}`));
    const remove = element("button", "", "Remove"); remove.type = "button"; remove.dataset.removeOverride = id;
    row.append(content, remove); list.append(row);
  });
}
function renderRecommendation(ranked) {
  const pickNo = currentPickNumber(); const slot = slotForPick(pickNo);
  $("pick-label").textContent = `Pick ${Math.ceil(pickNo / state.teams)}.${String((pickNo - 1) % state.teams + 1).padStart(2, "0")}`;
  $("clock-label").textContent = slot === state.userSlot ? "YOU ARE ON THE CLOCK" : `PICK ${pickNo} · TEAM ${slot} ON CLOCK`;
  const box = $("recommendation"); box.replaceChildren();
  const best = ranked[0];
  if (!best) { box.append(element("p", "", "The available player pool is empty. Start a fresh mock to continue.")); $("alternatives").replaceChildren(); return; }
  const copy = element("div"); copy.append(element("h3", "", best.name), element("p", "", `${best.position} · ${best.team} · Tier ${best.tier} · ADP ${best.adp}`), element("p", "", best.reason));
  const side = element("div", "model-score", best.score.toFixed(1)); side.append(element("small", "", "MODEL SCORE"));
  if (slot === state.userSlot) { const button = element("button", "button", "Draft this player"); button.type = "button"; button.dataset.draft = best.id; side.append(button); }
  box.append(copy, side);
  const alternatives = $("alternatives"); alternatives.replaceChildren();
  ranked.slice(1, 4).forEach((player) => {
    const item = element("div", "alternative"); item.append(element("strong", "", `${player.name} · ${player.position}`), element("span", "", `${player.score.toFixed(1)} model · Tier ${player.tier}`), element("span", "", player.reason));
    alternatives.append(item);
  });
}
function renderBoard() {
  const board = $("draft-board"); board.replaceChildren();
  const maxPicks = Math.max(currentPickNumber(), state.picks.length ? Math.max(...state.picks.map((pick) => pick.pickNo)) + 1 : state.teams);
  for (let pickNo = 1; pickNo <= Math.min(maxPicks + state.teams - 1, state.teams * 15); pickNo += 1) {
    const slot = slotForPick(pickNo); const picked = state.picks.find((pick) => pick.pickNo === pickNo);
    const card = element("div", `pick${pickNo === currentPickNumber() ? " current" : ""}${slot === state.userSlot ? " you" : ""}`);
    card.append(element("span", "pick-number", `${Math.ceil(pickNo / state.teams)}.${String((pickNo - 1) % state.teams + 1).padStart(2, "0")} · Team ${slot}`));
    if (picked) {
      const player = getPlayer(picked.playerId);
      card.append(element("strong", "pick-name", player?.name || picked.name || "External pick"), element("span", "pick-meta", player ? `${player.position} · ${player.team}` : picked.position || "Sleeper"));
    } else card.append(element("span", "pick-meta", pickNo === currentPickNumber() ? "On the clock" : "Open"));
    board.append(card);
  }
}
function renderPlayers(ranked) {
  const filter = $("position-filter").value; const search = $("player-search").value.trim().toLowerCase(); const taken = draftedIds();
  const visible = (state.showDrafted ? PLAYER_POOL.map((p) => ({ ...p, score: null, reason: "Drafted" })) : ranked)
    .filter((player) => (state.showDrafted ? taken.has(player.id) : true))
    .filter((player) => filter === "ALL" || player.position === filter)
    .filter((player) => `${player.name} ${player.team}`.toLowerCase().includes(search));
  const body = $("player-list"); body.replaceChildren();
  visible.forEach((player, index) => {
    const row = document.createElement("tr");
    row.append(element("td", "", state.showDrafted ? "—" : String(index + 1)));
    const playerCell = element("td"); playerCell.append(element("strong", "", player.name), element("small", "", `${player.position} · ${player.team}`)); row.append(playerCell);
    row.append(element("td", "", `Tier ${player.tier}`), element("td", "", String(player.adp)), element("td", "", player.score?.toFixed(1) ?? "—"), element("td", "reason", player.reason));
    const action = element("td");
    if (!state.showDrafted) { const button = element("button", "draft-button", slotForPick(currentPickNumber()) === state.userSlot ? "Draft" : "Mark drafted"); button.type = "button"; button.dataset.draft = player.id; action.append(button); } else action.append(element("span", "drafted", "Drafted"));
    row.append(action); body.append(row);
  });
}
function render() {
  const ranked = rankPlayers();
  renderRoster(); renderRiskControls(); renderRecommendation(ranked); renderBoard(); renderPlayers(ranked);
  $("draft-state").textContent = state.mode === "sleeper" ? `Sleeper: ${state.sleeper?.status || "connected"}` : "Mock mode";
}
function startMock() {
  state.mode = "mock"; state.teams = clamp(Number($("team-count").value) || 12, 2, 20); state.userSlot = clamp(Number($("user-slot").value) || 1, 1, state.teams);
  state.rosterFormat = $("roster-format").value; state.picks = []; state.sleeper = null; state.connectionError = "";
  stopPolling(); $("refresh-button").disabled = true; $("connection-message").textContent = "Fresh offline mock started. Use any player row to record manual picks."; setStatus("Mock draft ready"); render();
}
function getSleeperPlayerName(pick) {
  const fromDirectory = state.playerDirectory[pick.player_id];
  return fromDirectory ? `${fromDirectory.first_name || ""} ${fromDirectory.last_name || ""}`.trim() : `${pick.metadata?.first_name || ""} ${pick.metadata?.last_name || ""}`.trim() || pick.player_id;
}
function updateSleeperPicks(picks) {
  state.picks = picks.map((pick) => {
    const name = getSleeperPlayerName(pick);
    const local = PLAYER_POOL.find((player) => player.name.toLowerCase() === name.toLowerCase());
    return { pickNo: pick.pick_no, slot: pick.draft_slot || slotForPick(pick.pick_no), playerId: local?.id || `sleeper-${pick.player_id}`, name, position: pick.metadata?.position || state.playerDirectory[pick.player_id]?.position };
  }).filter((pick) => pick.pickNo);
}
async function sleeperFetch(path) {
  const response = await fetch(`https://api.sleeper.app/v1/${path}`);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText || "Sleeper request failed"}`);
  return response.json();
}
async function resolveSleeper(id) {
  try { return { draft: await sleeperFetch(`draft/${encodeURIComponent(id)}`), source: "draft" }; }
  catch (draftError) {
    try {
      const league = await sleeperFetch(`league/${encodeURIComponent(id)}`);
      if (!league.draft_id) throw new Error("This league has no current draft ID.");
      return { draft: await sleeperFetch(`draft/${encodeURIComponent(league.draft_id)}`), source: "league" };
    } catch (leagueError) { throw new Error(`Could not find a public Sleeper draft or league for that ID. ${leagueError.message}`); }
  }
}
async function loadPlayerDirectory() {
  const cacheKey = "draft-room-sleeper-players"; const cached = localStorage.getItem(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.savedAt < 7 * 24 * 60 * 60 * 1000) { state.playerDirectory = parsed.players; return; }
    } catch (_) { localStorage.removeItem(cacheKey); }
  }
  const players = await sleeperFetch("players/nfl");
  state.playerDirectory = players;
  try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), players })); } catch (_) { /* The directory remains usable for this session if storage is full. */ }
}
async function refreshSleeper() {
  if (!state.sleeper) return;
  try {
    const [draft, picks] = await Promise.all([sleeperFetch(`draft/${state.sleeper.draft_id}`), sleeperFetch(`draft/${state.sleeper.draft_id}/picks`)]);
    state.sleeper = draft; state.teams = Number(draft.settings?.teams) || state.teams; updateSleeperPicks(picks);
    $("connection-message").textContent = `Read-only Sleeper draft refreshed at ${new Date().toLocaleTimeString()}. ${picks.length} picks loaded.`;
    setStatus(`Sleeper connected · ${picks.length} picks`); render();
  } catch (error) {
    state.connectionError = error.message; $("connection-message").textContent = `Sleeper refresh failed: ${error.message}. Your last board remains available.`;
    setStatus("Sleeper refresh failed", true);
  }
}
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = undefined; } }
function configurePolling() {
  stopPolling(); const delay = Number($("poll-interval").value);
  if (state.sleeper && delay) pollTimer = setInterval(refreshSleeper, delay);
}
async function connectSleeper() {
  const id = $("sleeper-id").value.trim();
  if (!id) { $("connection-message").textContent = "Enter a public Sleeper league or draft ID before connecting."; setStatus("Sleeper ID required", true); return; }
  $("connect-button").disabled = true; $("connection-message").textContent = "Connecting to public Sleeper draft and picks…";
  try {
    const { draft } = await resolveSleeper(id);
    state.mode = "sleeper"; state.sleeper = draft; state.teams = Number(draft.settings?.teams) || 12; state.picks = [];
    $("refresh-button").disabled = false; await refreshSleeper(); configurePolling();
    $("connection-message").textContent += " Loading the public player directory once (then cached for seven days)…";
    loadPlayerDirectory().then(() => refreshSleeper()).catch((error) => { $("connection-message").textContent += ` Player directory unavailable: ${error.message}. Pick metadata remains in use.`; });
  } catch (error) {
    $("connection-message").textContent = error.message; setStatus("Sleeper connection failed", true);
  } finally { $("connect-button").disabled = false; }
}
function bindEvents() {
  ["ppr-input","pass-td-input","pass-int-input","need-weight-input","scarcity-weight-input","adp-weight-input","risk-weight-input"].forEach((id) => $(id).addEventListener("input", () => {
    state.settings = { ppr: Number($("ppr-input").value), passTd: Number($("pass-td-input").value), passInt: Number($("pass-int-input").value), needWeight: Number($("need-weight-input").value), scarcityWeight: Number($("scarcity-weight-input").value), adpWeight: Number($("adp-weight-input").value), riskWeight: Number($("risk-weight-input").value) }; render();
  }));
  $("connect-button").addEventListener("click", connectSleeper); $("refresh-button").addEventListener("click", refreshSleeper); $("poll-interval").addEventListener("change", configurePolling); $("start-mock-button").addEventListener("click", startMock);
  $("save-risk-button").addEventListener("click", () => { const id = $("risk-player").value; state.overrides[id] = { adjustment: clamp(Number($("risk-adjustment").value) || 0, -20, 10), note: $("risk-note").value.trim() }; $("risk-note").value = ""; render(); });
  $("risk-list").addEventListener("click", (event) => { const id = event.target.dataset.removeOverride; if (id) { delete state.overrides[id]; render(); } });
  $("recommendation").addEventListener("click", (event) => { const id = event.target.dataset.draft; if (id && pickForPlayer(id)) render(); });
  $("player-list").addEventListener("click", (event) => { const id = event.target.dataset.draft; if (id && pickForPlayer(id)) render(); });
  $("position-filter").addEventListener("change", render); $("player-search").addEventListener("input", render);
  $("show-all-button").addEventListener("click", () => { state.showDrafted = !state.showDrafted; $("show-all-button").textContent = state.showDrafted ? "Show available" : "Show drafted"; render(); });
}
if (typeof document !== "undefined") { bindEvents(); render(); }
if (typeof module !== "undefined") module.exports = { PLAYER_POOL, DEFAULT_SETTINGS, clamp, slotForPick, rosterRequirements, scoreProjection };
