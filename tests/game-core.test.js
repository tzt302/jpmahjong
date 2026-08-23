import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, discard, canTsumo, declareTsumo, chooseBotDiscard } from '../src/game-core.js';

test('new game deals 14 tiles to east and 13 to the others', () => {
  const game = createGame(() => 0.5);
  assert.equal(game.hands[0].length, 14);
  assert.deepEqual(game.hands.slice(1).map(hand => hand.length), [13, 13, 13]);
  assert.equal(game.wall.length, 83);
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
