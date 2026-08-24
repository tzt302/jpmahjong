import Majiang from '../vendor/majiang-core/browser.js';

const SUITS = ['m', 'p', 's'];

export const STANDARD_RULES = Object.freeze({
  '配給原点': 25000,
  '赤牌': { m: 1, p: 1, s: 1 },
  'クイタンあり': true,
  '場数': 2,
  '途中流局あり': true,
  '流し満貫あり': true,
  'ノーテン罰あり': true,
  '最大同時和了数': 2,
  '連荘方式': 2,
  'トビ終了あり': true,
  'オーラス止めあり': true,
  '延長戦方式': 1,
  '一発あり': true,
  '裏ドラあり': true,
  'カンドラあり': true,
  'カン裏あり': true,
  'リーチ後暗槓許可レベル': 2,
  '役満の複合あり': true,
  'ダブル役満あり': true,
  '役満パオあり': true
});

export function tileToCore(tile, red = false) {
  if (!Number.isInteger(tile) || tile < 0 || tile > 33) throw new Error(`无效牌编号: ${tile}`);
  if (tile >= 27) return `z${tile - 26}`;
  const suit = SUITS[Math.floor(tile / 9)];
  const rank = tile % 9 + 1;
  return `${suit}${red && rank === 5 ? 0 : rank}`;
}

export function tilesToCoreString(tiles, redTiles = []) {
  const red = new Set(redTiles);
  const groups = { m: [], p: [], s: [], z: [] };
  tiles.forEach((tile, index) => {
    const code = tileToCore(tile, red.has(index));
    groups[code[0]].push(code[1]);
  });
  return ['m','p','s','z'].filter(suit => groups[suit].length).map(suit => suit + groups[suit].sort().join('')).join('');
}

export function createCoreHand(tiles, redTiles = []) {
  return Majiang.Shoupai.fromString(tilesToCoreString(tiles, redTiles));
}

export function createStandardRule(overrides = {}) {
  return Majiang.rule({ ...STANDARD_RULES, ...overrides });
}

export function coreShanten(tiles) {
  return Majiang.Util.xiangting(createCoreHand(tiles));
}

export { Majiang };
