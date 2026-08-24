import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, discard, canTsumo, declareTsumo, chooseBotDiscard, getHumanCallOptions, claimHumanCall, skipHumanCall } from '../src/game-core.js';

test('new game deals 14 tiles to east and 13 to the others', () => {
  const game = createGame(() => 0.5);
  assert.equal(game.hands[0].length, 14);
  assert.deepEqual(game.hands.slice(1).map(hand => hand.length), [13, 13, 13]);
  assert.equal(game.wall.length, 83);
});

test('three-player mode deals three hands and removes 2m through 8m', () => {
  const game = createGame(() => 0.37, 3);
  assert.equal(game.playerCount, 3);
  assert.deepEqual(game.hands.map(hand => hand.length), [14, 13, 13]);
  assert.equal(game.wall.length, 68);
  assert.equal([...game.wall, ...game.hands.flat()].some(tile => tile >= 1 && tile <= 7), false);
});

test('discard advances turn and draws for next player', () => {
  const game = createGame(() => 0.25);
  const before = game.wall.length;
  discard(game, 0);
  assert.equal(game.current, 1);
  assert.equal(game.rivers[0].length, 1);
  assert.equal(game.hands[0].length, 13);
  assert.equal(game.hands[1].length, 14);
  assert.equal(game.wall.length, before - 1);
});

test('discard automatically sorts the remaining hand before the next draw', () => {
  const game = createGame(() => 0.41);
  discard(game, 0);
  const remaining = game.hands[0];
  assert.deepEqual(remaining, [...remaining].sort((a, b) => a - b));
});

test('valid completed hand can declare tsumo', () => {
  const game = createGame(() => 0.75);
  game.hands[0] = [0,1,2,3,4,5,9,10,11,18,19,20,27,27];
  assert.equal(canTsumo(game), true);
  assert.equal(declareTsumo(game), 0);
  assert.equal(game.phase, 'won');
});

test('bot chooses a valid discard index', () => {
  const game = createGame(() => 0.33);
  discard(game, 0);
  const index = chooseBotDiscard(game);
  assert.ok(index >= 0 && index < 14);
});

test('human can pon an AI discard and the river tile becomes an open meld', () => {
  const game = createGame(() => 0.22);
  game.hands[0] = [5,5,9,10,11,12,13,14,18,19,20,27,28];
  game.rivers[1] = [5];
  game.pendingCall = { player: 1, tile: 5 };
  assert.equal(getHumanCallOptions(game).pon, true);
  claimHumanCall(game, 'pon');
  assert.equal(game.melds[0][0].type, 'pon');
  assert.equal(game.hands[0].length, 11);
  assert.equal(game.rivers[1].length, 0);
  assert.equal(game.current, 0);
});

test('skipping a call advances to the next player and draws', () => {
  const game = createGame(() => 0.18);
  game.pendingCall = { player: 1, tile: 3 };
  const wallBefore = game.wall.length;
  skipHumanCall(game);
  assert.equal(game.current, 2);
  assert.equal(game.wall.length, wallBefore - 1);
});
