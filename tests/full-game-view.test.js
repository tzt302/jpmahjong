import test from 'node:test';
import assert from 'node:assert/strict';
import { Majiang } from '../src/riichi-core.js';
import { coreTileToNumber, concealedTiles, meldTiles, riverTiles, relativeSeat } from '../src/full-game-view.js';

test('core tile notation maps to the existing 0-33 tile assets', () => {
  assert.equal(coreTileToNumber('m1'), 0);
  assert.equal(coreTileToNumber('p0'), 13);
  assert.equal(coreTileToNumber('s9'), 26);
  assert.equal(coreTileToNumber('z7'), 33);
});

test('concealed hand keeps red five and moves the drawn tile to the visual gap', () => {
  const hand = Majiang.Shoupai.fromString('m055p123s789z12344');
  const tiles = concealedTiles(hand);
  assert.equal(tiles.length, 14);
  assert.equal(tiles.filter(tile => tile.red).length, 1);
  assert.equal(tiles.at(-1).code, 'z4');
  assert.equal(tiles.at(-1).drawn, true);
});

test('meld and river adapters preserve red, riichi, and claimed state', () => {
  assert.deepEqual(meldTiles('m405-').map(tile => tile.code), ['m4', 'm0', 'm5']);
  const river = { _pai: ['m1', 'p0_*', 'z1-'] };
  assert.equal(riverTiles(river)[1].riichi, true);
  assert.equal(riverTiles(river)[2].claimed, true);
});

test('human remains at the bottom while winds rotate around the table', () => {
  assert.equal(relativeSeat(2, 2), 0);
  assert.equal(relativeSeat(3, 2), 1);
  assert.equal(relativeSeat(0, 2), 2);
  assert.equal(relativeSeat(1, 2), 3);
});
