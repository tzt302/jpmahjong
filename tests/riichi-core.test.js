import test from 'node:test';
import assert from 'node:assert/strict';
import { tileToCore, tilesToCoreString, createCoreHand, createStandardRule, coreShanten, Majiang } from '../src/riichi-core.js';

test('numeric tiles convert to majiang-core notation', () => {
  assert.equal(tileToCore(0), 'm1');
  assert.equal(tileToCore(4, true), 'm0');
  assert.equal(tileToCore(17), 'p9');
  assert.equal(tileToCore(33), 'z7');
  assert.equal(tilesToCoreString([0,1,2,9,10,11,18,19,20,27,27,31,32]), 'm123p123s123z1156');
});

test('adapter creates a core hand and calculates shanten', () => {
  const tiles = [0,1,2,9,10,11,18,19,20,27,27,27,28];
  const hand = createCoreHand(tiles);
  assert.equal(hand.toString(), 'm123p123s123z1112');
  assert.equal(coreShanten(tiles), 0);
});

test('standard rule enables full hanchan scoring options', () => {
  const rule = createStandardRule();
  assert.equal(rule['場数'], 2);
  assert.deepEqual(rule['赤牌'], { m: 1, p: 1, s: 1 });
  assert.equal(rule['裏ドラあり'], true);
  assert.equal(typeof Majiang.Game, 'function');
});
