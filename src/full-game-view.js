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
  if (session?.mode === 'sanma') return sanmaTableSnapshot(session);
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

function sanmaTableSnapshot(session) {
  const state = session.state;
  const handPlayer = state.players[0];
  const akaLeft = new Map();
  for (const tile of handPlayer.akaInHand || []) akaLeft.set(tile, (akaLeft.get(tile) || 0) + 1);
  const hand = handPlayer.hand.map(tile => {
    const red = (akaLeft.get(tile) || 0) > 0;
    if (red) akaLeft.set(tile, akaLeft.get(tile) - 1);
    return { code: String(tile), tile, red, drawn: false };
  });
  if (state.lastDrawnTile != null && state.currentPlayer === 0 && ['discard', 'kita_declare'].includes(state.phase)) {
    const index = hand.map(item => item.tile).lastIndexOf(state.lastDrawnTile);
    if (index >= 0) {
      const [drawn] = hand.splice(index, 1);
      hand.push({ ...drawn, drawn: true });
    }
  }
  const seats = state.players.map((player, playerId) => {
    const wind = (playerId + 3 - state.dealer) % 3;
    return {
      wind,
      windLabel: WIND_LABELS[wind],
      position: playerId,
      playerId,
      human: playerId === 0,
      score: player.score,
      kitaCount: player.kitaCount,
      river: player.discards.map(discard => ({ tile: discard.tile, code: String(discard.tile), riichi: false, claimed: false })),
      melds: player.melds.map(meld => ({ code: `${meld.type}:${meld.tiles[0]}`, tiles: meld.tiles.map(tile => ({ code: String(tile), tile, red: false })) }))
    };
  });
  const handNumber = (state.roundNumber - 1) % 3 + 1;
  return {
    roundWind: state.roundWind,
    handNumber,
    roundLabel: `${WIND_LABELS[state.roundWind]}${handNumber}局`,
    honba: state.honba,
    riichiSticks: state.kyotaku,
    wallRemaining: Math.max(0, state.rinshanIndex - 13 - state.wallIndex),
    doraIndicators: state.doraMarkers.map(tile => ({ code: String(tile), tile })),
    currentPosition: state.currentPlayer,
    humanWind: (3 - state.dealer) % 3,
    hand,
    riichi: handPlayer.riichi,
    seats
  };
}
