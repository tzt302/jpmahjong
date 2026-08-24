import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFullHanchan } from '../src/full-game.js';

test('full rules engine can complete a four-player hanchan', () => {
  const { paipu } = simulateFullHanchan({ 'トビ終了あり': false, '延長戦方式': 0 });
  assert.ok(paipu.log.length >= 8, 'east and south rounds should be recorded');
  assert.equal(paipu.defen.length, 4);
  assert.equal(paipu.rank.length, 4);
  assert.equal(paipu.point.length, 4);
  assert.ok(paipu.log.every(round => round.some(event => event.qipai)));
});
