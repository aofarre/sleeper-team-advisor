const test = require("node:test");
const assert = require("node:assert/strict");
const { PLAYER_POOL, clamp, slotForPick, rosterRequirements, scoreProjection } = require("../game.js");

test("snake draft slots reverse every round", () => {
  assert.equal(slotForPick(1, 4), 1);
  assert.equal(slotForPick(4, 4), 4);
  assert.equal(slotForPick(5, 4), 4);
  assert.equal(slotForPick(8, 4), 1);
});

test("roster formats preserve positional and flex requirements", () => {
  assert.deepEqual(rosterRequirements("standard"), { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, FLEX: 1 });
  assert.equal(rosterRequirements("superflex").QB, 2);
});

test("projection reacts transparently to scoring inputs", () => {
  const receiver = PLAYER_POOL.find((player) => player.position === "WR");
  const halfPpr = scoreProjection(receiver, { passTd: 4, passInt: -1, ppr: 0.5 });
  const fullPpr = scoreProjection(receiver, { passTd: 4, passInt: -1, ppr: 1 });
  assert.equal(fullPpr - halfPpr, receiver.receptions * 0.5);
  assert.equal(clamp(30, -20, 10), 10);
});
