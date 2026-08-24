export const WIND_LABELS = ['東', '南', '西', '北'];

export function coreTileToNumber(code) {
  const match = String(code || '').match(/^([mpsz])(\d)/);
  if (!match) return null;
  const [, suit, digit] = match;
  const rank = Number(digit) || 5;
  if (suit === 'z') return rank >= 1 && rank <= 7 ? 26 + rank : null;
  const offset = { m: 0, p: 9, s: 18 }[suit];
  return offset + rank - 1;
}

export function concealedTiles(shoupai) {
  if (!shoupai?._bingpai) return [];
  const tiles = [];
  for (const suit of ['m', 'p', 's', 'z']) {
    const counts = shoupai._bingpai[suit];
    const maxRank = suit === 'z' ? 7 : 9;
    for (let rank = 1; rank <= maxRank; rank += 1) {
      const redCount = rank === 5 && suit !== 'z' ? counts[0] : 0;
      const normalCount = counts[rank] - redCount;
      for (let i = 0; i < redCount; i += 1) tiles.push({ code: `${suit}0`, tile: coreTileToNumber(`${suit}0`), red: true, drawn: false });
      for (let i = 0; i < normalCount; i += 1) tiles.push({ code: `${suit}${rank}`, tile: coreTileToNumber(`${suit}${rank}`), red: false, drawn: false });
    }
  }
  const drawnCode = shoupai._zimo?.match(/^[mpsz]\d$/)?.[0];
  if (drawnCode) {
    const index = tiles.map(tile => tile.code).lastIndexOf(drawnCode);
    if (index >= 0) {
      const [drawn] = tiles.splice(index, 1);
      tiles.push({ ...drawn, drawn: true });
    }
  }
  return tiles;
}

export function meldTiles(meld = '') {
  const suit = meld[0];
  return [...meld.matchAll(/\d/g)].map(match => {
    const code = suit + match[0];
    return { code, tile: coreTileToNumber(code), red: match[0] === '0' };
  });
}

export function riverTiles(he) {
  return (he?._pai || []).map(code => ({
    code,
    tile: coreTileToNumber(code),
    riichi: code.includes('*'),
    claimed: /[+=-]$/.test(code)
  }));
}

export function relativeSeat(wind, humanWind) {
  return (wind + 4 - humanWind) % 4;
}

export function tableSnapshot(session) {
  const model = session.model;
  if (!model?.shan) return null;
  const humanWind = session.human._menfeng;
  const seats = Array.from({ length: 4 }, (_, wind) => {
    const playerId = model.player_id[wind];
    return {
      wind,
      windLabel: WIND_LABELS[wind],
      position: relativeSeat(wind, humanWind),
      playerId,
      human: playerId === 0,
      score: model.defen[playerId],
      river: riverTiles(model.he[wind]),
      melds: (model.shoupai[wind]?._fulou || []).map(code => ({ code, tiles: meldTiles(code) }))
    };
  });
  const hand = concealedTiles(model.shoupai[humanWind]);
  return {
    roundWind: model.zhuangfeng,
    handNumber: model.jushu + 1,
    roundLabel: `${WIND_LABELS[model.zhuangfeng]}${model.jushu + 1}局`,
    honba: model.changbang,
    riichiSticks: model.lizhibang,
    wallRemaining: model.shan.paishu,
    doraIndicators: model.shan.baopai.map(code => ({ code, tile: coreTileToNumber(code) })),
    currentPosition: model.lunban < 0 ? null : relativeSeat(model.lunban, humanWind),
    humanWind,
    hand,
    riichi: Boolean(model.shoupai[humanWind]?._lizhi),
    seats: seats.sort((a, b) => a.position - b.position)
  };
}
