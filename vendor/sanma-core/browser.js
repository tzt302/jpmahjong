//Mateces-mahjong-ai-sanma-MIT-ed9ed8388a1c0c205e31e3ecc47863c54257a442

// vendor/sanma-core/src/game/types.ts
var Suit = {
  Man: 0,
  Pin: 1,
  Sou: 2,
  Honor: 3
};
var ActionKind = {
  Discard: "discard",
  Chi: "chi",
  Pon: "pon",
  Ankan: "ankan",
  Kakan: "kakan",
  Daiminkan: "daiminkan",
  Riichi: "riichi",
  Tsumo: "tsumo",
  Ron: "ron",
  Pass: "pass",
  Kyushukyuhai: "kyushukyuhai",
  /** 3-player only: declare 抜き北 (kita). The drawn North tile is set
   *  aside, +1 han at win, and the player draws a replacement from the
   *  dead wall. */
  Kita: "kita"
};

// vendor/sanma-core/src/game/constants.ts
var MAN_START = 0;
var MAN_END = 8;
var PIN_START = 9;
var PIN_END = 17;
var SOU_START = 18;
var SOU_END = 26;
var HONOR_START = 27;
var HONOR_END = 33;
var WIND_START = 27;
var WIND_END = 30;
var DRAGON_START = 31;
var DRAGON_END = 33;
var ALL_TILES = [];
for (let i = 0; i < 34; i++) ALL_TILES.push(i);
var TERMINALS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
var TILE_COUNT_PER_TYPE = 4;
var STARTING_SCORE_YONMA = 25e3;
var STARTING_SCORE_SANMA = 35e3;
var HONBA_RON = 300;
var HONBA_TSUMO = 100;
var KYOTAKU_VALUE = 1e3;

// vendor/sanma-core/src/game/wall.ts
var AKA_TILES = [4, 13, 22];
function createWall(playerCount = 4) {
  const tiles = [];
  const positionsByTile = /* @__PURE__ */ new Map();
  for (let t = 0; t < 34; t++) {
    if (playerCount === 3 && t >= 1 && t <= 7) continue;
    const positions = [];
    for (let c = 0; c < TILE_COUNT_PER_TYPE; c++) {
      positions.push(tiles.length);
      tiles.push(t);
    }
    positionsByTile.set(t, positions);
  }
  shuffle(tiles);
  const akaPositions = /* @__PURE__ */ new Set();
  for (const akaTile of AKA_TILES) {
    if (playerCount === 3 && akaTile === 4) continue;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === akaTile) {
        akaPositions.add(i);
        break;
      }
    }
  }
  const drawIndex = 13 * playerCount;
  return { tiles, drawIndex, rinshanIndex: tiles.length - 1, doraCount: 1, akaPositions, playerCount };
}
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
function dealHaipai(wall, playerCount = 4) {
  const hands = Array.from({ length: playerCount }, () => []);
  const akaInHand = Array.from({ length: playerCount }, () => []);
  for (let round = 0; round < 13; round++) {
    for (let p = 0; p < playerCount; p++) {
      const pos = round * playerCount + p;
      hands[p].push(wall.tiles[pos]);
      if (wall.akaPositions.has(pos)) akaInHand[p].push(wall.tiles[pos]);
    }
  }
  for (const h of hands) h.sort((a, b) => a - b);
  return { hands, akaInHand };
}
function usedRinshans(wall) {
  return wall.tiles.length - 1 - wall.rinshanIndex;
}
function rinshanCapacity(wall) {
  return wall.playerCount === 3 ? 8 : 4;
}
function deadWallSize(wall) {
  return rinshanCapacity(wall) + 10;
}
function drawTile(wall) {
  const normalDrawEnd = wall.tiles.length - deadWallSize(wall) - usedRinshans(wall);
  if (wall.drawIndex >= normalDrawEnd) return null;
  const pos = wall.drawIndex;
  return {
    tile: wall.tiles[pos],
    aka: wall.akaPositions.has(pos),
    wall: { ...wall, drawIndex: pos + 1 }
  };
}
function drawRinshan(wall) {
  if (usedRinshans(wall) >= rinshanCapacity(wall) || wall.rinshanIndex <= wall.drawIndex) return null;
  const pos = wall.rinshanIndex;
  return {
    tile: wall.tiles[pos],
    aka: wall.akaPositions.has(pos),
    wall: { ...wall, rinshanIndex: pos - 1, doraCount: wall.doraCount + 1 }
  };
}
function getDoraMarkers(wall) {
  const markers = [];
  const first = wall.tiles.length - rinshanCapacity(wall) - 1;
  for (let i = 0; i < wall.doraCount; i++) {
    markers.push(wall.tiles[first - i * 2]);
  }
  return markers;
}
function getUraDoraMarkers(wall) {
  const markers = [];
  const first = wall.tiles.length - rinshanCapacity(wall) - 2;
  for (let i = 0; i < wall.doraCount; i++) markers.push(wall.tiles[first - i * 2]);
  return markers;
}
function remainingTiles(wall) {
  const normalDrawEnd = wall.tiles.length - deadWallSize(wall) - usedRinshans(wall);
  return normalDrawEnd - wall.drawIndex;
}

// vendor/sanma-core/src/game/tile-utils.ts
function tileSuit(t) {
  if (t <= MAN_END) return 0;
  if (t <= PIN_END) return 1;
  if (t <= SOU_END) return 2;
  return 3;
}
function tileRank(t) {
  if (t <= MAN_END) return t - MAN_START + 1;
  if (t <= PIN_END) return t - PIN_START + 1;
  if (t <= SOU_END) return t - SOU_START + 1;
  return t - HONOR_START + 1;
}
function isMan(t) {
  return t >= MAN_START && t <= MAN_END;
}
function isPin(t) {
  return t >= PIN_START && t <= PIN_END;
}
function isHonor(t) {
  return t >= HONOR_START && t <= HONOR_END;
}
function isWind(t) {
  return t >= WIND_START && t <= WIND_END;
}
function isDragon(t) {
  return t >= DRAGON_START && t <= DRAGON_END;
}
function isTerminal(t) {
  return TERMINALS.includes(t);
}
function isTerminalOrHonor(t) {
  return isHonor(t) || isTerminal(t);
}
function doraFromIndicator(indicator, isSanma = false) {
  if (isHonor(indicator)) {
    if (indicator < 31) return indicator === 30 ? 27 : indicator + 1;
    return indicator === 33 ? 31 : indicator + 1;
  }
  if (isSanma && indicator === MAN_START) return MAN_START + 8;
  const suitStart = isMan(indicator) ? MAN_START : isPin(indicator) ? PIN_START : SOU_START;
  const rank = tileRank(indicator);
  return rank === 9 ? suitStart : suitStart + rank;
}
function countTiles(tiles) {
  const counts = new Array(34).fill(0);
  for (const t of tiles) counts[t]++;
  return counts;
}

// vendor/sanma-core/src/game/shanten.ts
function calculateShanten(tiles, meldCount = 0) {
  const counts = countTiles(tiles);
  return shantenFromCounts(counts, meldCount);
}
var decomposeCache = null;
function shantenFromCounts(counts, meldCount = 0) {
  decomposeCache = /* @__PURE__ */ new Map();
  const components = [shantenRegular(counts, meldCount)];
  if (meldCount === 0) {
    components.push(shantenSevenPairs(counts), shantenKokushi(counts));
  }
  const result = Math.min(...components);
  decomposeCache = null;
  return result;
}
function shantenRegular(counts, meldCount = 0) {
  const targetMentsu = 4 - meldCount;
  const baseShanten = 2 * targetMentsu;
  let minShanten = baseShanten;
  const c = [...counts];
  for (let t = 0; t < 34; t++) {
    if (c[t] >= 2) {
      c[t] -= 2;
      const { mentsu: mentsu2, taatsu: taatsu2 } = decompose(c, 0);
      const s2 = baseShanten - 2 * mentsu2 - 1 - Math.min(taatsu2, targetMentsu - mentsu2);
      if (s2 < minShanten) minShanten = s2;
      c[t] += 2;
    }
  }
  const { mentsu, taatsu } = decompose(c, 0);
  const s = baseShanten - 2 * mentsu - Math.min(taatsu, targetMentsu - mentsu);
  if (s < minShanten) minShanten = s;
  return minShanten;
}
function decompose(counts, startPos) {
  let pos = startPos;
  while (pos < 34 && counts[pos] === 0) pos++;
  if (pos === 34) return { mentsu: 0, taatsu: 0 };
  const parts = [];
  for (let i = pos; i < 34; i++) parts.push(String(counts[i]));
  const cacheKey = parts.join("") + ":" + pos;
  if (decomposeCache) {
    const cached = decomposeCache.get(cacheKey);
    if (cached) return cached;
  }
  let bestMentsu = 0;
  let bestTaatsu = 0;
  let bestScore = 0;
  counts[pos]--;
  const skipResult = decompose(counts, pos);
  counts[pos]++;
  bestScore = skipResult.mentsu * 2 + skipResult.taatsu;
  bestMentsu = skipResult.mentsu;
  bestTaatsu = skipResult.taatsu;
  if (counts[pos] >= 3) {
    counts[pos] -= 3;
    const r = decompose(counts, pos);
    counts[pos] += 3;
    const s = (r.mentsu + 1) * 2 + r.taatsu;
    if (s > bestScore) {
      bestMentsu = r.mentsu + 1;
      bestTaatsu = r.taatsu;
      bestScore = s;
    }
  }
  if (pos <= SOU_END && pos % 9 <= 6 && counts[pos + 1] > 0 && counts[pos + 2] > 0) {
    counts[pos]--;
    counts[pos + 1]--;
    counts[pos + 2]--;
    const r = decompose(counts, pos);
    counts[pos]++;
    counts[pos + 1]++;
    counts[pos + 2]++;
    const s = (r.mentsu + 1) * 2 + r.taatsu;
    if (s > bestScore) {
      bestMentsu = r.mentsu + 1;
      bestTaatsu = r.taatsu;
      bestScore = s;
    }
  }
  if (counts[pos] >= 2) {
    counts[pos] -= 2;
    const r = decompose(counts, pos);
    counts[pos] += 2;
    const s = r.mentsu * 2 + (r.taatsu + 1);
    if (s > bestScore) {
      bestMentsu = r.mentsu;
      bestTaatsu = r.taatsu + 1;
      bestScore = s;
    }
  }
  if (pos <= SOU_END && pos % 9 <= 7 && counts[pos + 1] > 0) {
    counts[pos]--;
    counts[pos + 1]--;
    const r = decompose(counts, pos);
    counts[pos]++;
    counts[pos + 1]++;
    const s = r.mentsu * 2 + (r.taatsu + 1);
    if (s > bestScore) {
      bestMentsu = r.mentsu;
      bestTaatsu = r.taatsu + 1;
      bestScore = s;
    }
  }
  if (pos <= SOU_END && pos % 9 <= 6 && counts[pos + 2] > 0) {
    counts[pos]--;
    counts[pos + 2]--;
    const r = decompose(counts, pos);
    counts[pos]++;
    counts[pos + 2]++;
    const s = r.mentsu * 2 + (r.taatsu + 1);
    if (s > bestScore) {
      bestMentsu = r.mentsu;
      bestTaatsu = r.taatsu + 1;
      bestScore = s;
    }
  }
  const result = { mentsu: bestMentsu, taatsu: bestTaatsu };
  if (decomposeCache) decomposeCache.set(cacheKey, result);
  return result;
}
function shantenSevenPairs(counts) {
  let pairs = 0;
  let kinds = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] >= 1) kinds++;
    if (counts[i] >= 2) pairs++;
  }
  if (kinds < 7) return 6 - pairs + (7 - kinds);
  return 6 - pairs;
}
var KOKUSHI_TILES = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function shantenKokushi(counts) {
  let unique = 0;
  let hasPair = 0;
  for (const t of KOKUSHI_TILES) {
    if (counts[t] >= 1) unique++;
    if (counts[t] >= 2) hasPair = 1;
  }
  return 13 - unique - hasPair;
}

// vendor/sanma-core/src/game/hand-analysis.ts
var KOKUSHI_TILES2 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function isWinningHand(tiles) {
  if (tiles.length > 14 || tiles.length < 2 || tiles.length % 3 !== 2) return false;
  return decomposeWinningHand(tiles) !== null;
}
function decomposeWinningHand(tiles) {
  const all = decomposeAllWinningHands(tiles);
  return all.length > 0 ? all[0] : null;
}
function decomposeAllWinningHands(tiles) {
  if (tiles.length < 2 || tiles.length > 14) return [];
  const counts = countTiles(tiles);
  const expectedMentsu = Math.floor(tiles.length / 3);
  const hasPairSlot = tiles.length % 3 === 2;
  const out = [];
  if (hasPairSlot) {
    for (let pair = 0; pair < 34; pair++) {
      if (counts[pair] >= 2) {
        counts[pair] -= 2;
        const allMentsu = extractAllMentsuWithCount(counts, [], expectedMentsu);
        counts[pair] += 2;
        for (const mentsu of allMentsu) {
          out.push({ mentsu, pair, type: "regular" });
        }
      }
    }
  }
  if (tiles.length === 14) {
    if (isSevenPairs(counts)) {
      const pairTile = counts.findIndex((c, _i) => c >= 2);
      out.push({ mentsu: [], pair: pairTile, type: "seven_pairs" });
    }
    const kokushiResult = checkKokushi(counts);
    if (kokushiResult !== null) out.push(kokushiResult);
  }
  return out;
}
function extractAllMentsuWithCount(counts, acc, target) {
  if (acc.length === target) {
    return counts.every((c) => c === 0) ? [acc.slice()] : [];
  }
  let idx = -1;
  for (let i = 0; i < 34; i++) {
    if (counts[i] > 0) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return acc.length === target ? [acc.slice()] : [];
  const results = [];
  if (counts[idx] >= 3) {
    counts[idx] -= 3;
    acc.push({ tiles: [idx, idx, idx] });
    results.push(...extractAllMentsuWithCount(counts, acc, target));
    acc.pop();
    counts[idx] += 3;
  }
  if (idx <= SOU_END && idx % 9 <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0) {
    counts[idx]--;
    counts[idx + 1]--;
    counts[idx + 2]--;
    acc.push({ tiles: [idx, idx + 1, idx + 2] });
    results.push(...extractAllMentsuWithCount(counts, acc, target));
    acc.pop();
    counts[idx]++;
    counts[idx + 1]++;
    counts[idx + 2]++;
  }
  return results;
}
function isSevenPairs(counts) {
  let pairs = 0;
  for (let i = 0; i < 34; i++) {
    if (counts[i] % 2 !== 0) return false;
    pairs += counts[i] / 2;
  }
  return pairs === 7;
}
function checkKokushi(counts) {
  let hasPair = false;
  let pairTile = -1;
  for (const t of KOKUSHI_TILES2) {
    if (counts[t] === 0) return null;
    if (counts[t] === 2) {
      if (hasPair) return null;
      hasPair = true;
      pairTile = t;
    }
  }
  if (!hasPair) return null;
  return { mentsu: [], pair: pairTile, type: "kokushi" };
}

// vendor/sanma-core/src/game/yaku.ts
function meldsAsMentsu(melds) {
  return melds.map((m) => {
    if (m.type === "chi") return { tiles: m.tiles };
    const t = m.tiles[0];
    return { tiles: [t, t, t] };
  });
}
function evaluateYaku(ctx) {
  const concealedPlusWin = [...ctx.hand, ctx.winningTile];
  const decomps = decomposeAllWinningHands(concealedPlusWin);
  if (decomps.length === 0) return { yaku: [], totalHan: 0, isYakuman: false };
  let best = { yaku: [], totalHan: 0, isYakuman: false };
  for (const decomp of decomps) {
    const r = evaluateYakuForDecomp(ctx, decomp, concealedPlusWin);
    if (isBetterResult(r, best)) best = r;
  }
  return best;
}
function isBetterResult(a, b) {
  if (a.isYakuman !== b.isYakuman) return a.isYakuman;
  if (a.totalHan !== b.totalHan) return a.totalHan > b.totalHan;
  return a.yaku.length > b.yaku.length;
}
function evaluateYakuForDecomp(ctx, decomp, concealedPlusWin) {
  const yaku = [];
  const isOpen = !ctx.player.isMenzen;
  const allTiles = [...concealedPlusWin];
  for (const m of ctx.melds) {
    for (const t of m.tiles) allTiles.push(t);
  }
  const counts = countTiles(allTiles);
  const yakuman = checkYakuman(ctx, decomp, counts, allTiles);
  if (yakuman.length > 0) {
    const total = yakuman.reduce((s, y) => s + y.han, 0);
    return { yaku: yakuman, totalHan: total, isYakuman: true };
  }
  if (ctx.player.daburii === true) {
    yaku.push({ name: "daburii", han: 2, kuisagari: false });
  } else if (ctx.isRiichi) {
    yaku.push({ name: "riichi", han: 1, kuisagari: false });
  }
  if (ctx.isIppatsu) yaku.push({ name: "ippatsu", han: 1, kuisagari: false });
  if (ctx.player.isMenzen && ctx.isTsumo) yaku.push({ name: "menzen_tsumo", han: 1, kuisagari: false });
  if (ctx.isRinshan) yaku.push({ name: "rinshan", han: 1, kuisagari: false });
  if (ctx.isChankan) yaku.push({ name: "chankan", han: 1, kuisagari: false });
  if (ctx.isHaitei) yaku.push({ name: "haitei", han: 1, kuisagari: false });
  if (ctx.isHoutei) yaku.push({ name: "houtei", han: 1, kuisagari: false });
  if (checkTanyao(allTiles, isOpen)) yaku.push({ name: "tanyao", han: 1, kuisagari: false });
  addYakuhai(ctx, counts, yaku);
  if (checkPinhu(ctx, decomp)) yaku.push({ name: "pinhu", han: 1, kuisagari: false });
  if (checkIipeikou(decomp, isOpen)) yaku.push({ name: "iipeikou", han: 1, kuisagari: true });
  const allMentsu = [...decomp.mentsu, ...meldsAsMentsu(ctx.melds)];
  if (checkToitoi(decomp, ctx.melds)) yaku.push({ name: "toitoi", han: 2, kuisagari: false });
  if (decomp.type === "seven_pairs") yaku.push({ name: "chiitoitsu", han: 2, kuisagari: false });
  if (checkSanAnkou(decomp, ctx)) yaku.push({ name: "san_ankou", han: 2, kuisagari: false });
  if (checkSanshokuDoujun(allMentsu)) yaku.push({ name: "sanshoku_doujun", han: 2, kuisagari: true });
  if (checkIkkitsuukan(allMentsu)) yaku.push({ name: "ikkitsuukan", han: 2, kuisagari: true });
  if (checkChanta(decomp, allTiles, allMentsu)) yaku.push({ name: "chanta", han: 2, kuisagari: true });
  if (checkSanshokuDoukou(decomp, ctx.melds)) yaku.push({ name: "sanshoku_doukou", han: 2, kuisagari: false });
  if (checkSankantsu(ctx.melds)) yaku.push({ name: "sankantsu", han: 2, kuisagari: false });
  if (checkShousangen(decomp, counts)) yaku.push({ name: "shousangen", han: 2, kuisagari: false });
  if (checkHonroutou(allTiles)) yaku.push({ name: "honroutou", han: 2, kuisagari: false });
  if (checkHonitsu(allTiles, isOpen)) yaku.push({ name: "honitsu", han: 3, kuisagari: true });
  if (checkRyanpeikou(decomp, isOpen)) yaku.push({ name: "ryanpeikou", han: 3, kuisagari: true });
  if (checkJunchan(decomp, counts, allMentsu)) yaku.push({ name: "junchan", han: 3, kuisagari: true });
  if (checkChinitsu(allTiles, isOpen)) yaku.push({ name: "chinitsu", han: 6, kuisagari: true });
  let totalHan = 0;
  for (const y of yaku) {
    totalHan += isOpen && y.kuisagari ? y.han - 1 : y.han;
  }
  return { yaku, totalHan, isYakuman: false };
}
function checkTanyao(tiles, isOpen) {
  return tiles.every((t) => !isTerminalOrHonor(t));
}
function addYakuhai(ctx, counts, yaku) {
  const names = ["yakuhai_haku", "yakuhai_hatsu", "yakuhai_chun"];
  for (let d = DRAGON_START; d <= DRAGON_END; d++) {
    if (counts[d] >= 3) yaku.push({ name: names[d - DRAGON_START], han: 1, kuisagari: false });
  }
  const roundWindTile = WIND_START + ctx.roundWind;
  if (counts[roundWindTile] >= 3) yaku.push({ name: "yakuhai_bakaze", han: 1, kuisagari: false });
  const seatWindTile = WIND_START + ctx.seatWind;
  if (counts[seatWindTile] >= 3) {
    yaku.push({ name: "yakuhai_jikaze", han: 1, kuisagari: false });
  }
}
function checkPinhu(ctx, decomp) {
  if (!ctx.player.isMenzen) return false;
  if (decomp.type !== "regular") return false;
  if (!decomp.mentsu.every((m) => m.tiles[0] !== m.tiles[1])) return false;
  if (ctx.melds.some((m) => m.type === "ankan")) return false;
  if (isDragon(decomp.pair)) return false;
  if (decomp.pair === WIND_START + ctx.roundWind) return false;
  if (decomp.pair === WIND_START + ctx.seatWind) return false;
  for (const m of decomp.mentsu) {
    const first = m.tiles[0];
    const rank = first % 9;
    if (rank < 6 && first === ctx.winningTile) return true;
    if (rank > 0 && first + 2 === ctx.winningTile) return true;
  }
  return false;
}
function checkIipeikou(decomp, isOpen) {
  if (isOpen || decomp.type !== "regular") return false;
  if (checkRyanpeikou(decomp, isOpen)) return false;
  const keys = decomp.mentsu.map((m) => m.tiles.join(","));
  return new Set(keys).size < keys.length;
}
function checkToitoi(decomp, melds) {
  if (decomp.type !== "regular") return false;
  const handTriplets = decomp.mentsu.every((m) => m.tiles[0] === m.tiles[1]);
  if (!handTriplets) return false;
  return melds.every((m) => m.type === "pon" || m.type === "ankan" || m.type === "kakan" || m.type === "daiminkan");
}
function checkSanAnkou(decomp, ctx) {
  if (decomp.type !== "regular") return false;
  const ronOnSequence = !ctx.isTsumo && decomp.mentsu.some(
    (m) => m.tiles[0] !== m.tiles[1] && m.tiles.includes(ctx.winningTile)
  );
  let concealedTriplets = 0;
  for (const m of decomp.mentsu) {
    if (m.tiles[0] !== m.tiles[1]) continue;
    if (!ctx.isTsumo && m.tiles[0] === ctx.winningTile && !ronOnSequence) continue;
    concealedTriplets++;
  }
  const ankans = ctx.melds.filter((m) => m.type === "ankan").length;
  return concealedTriplets + ankans >= 3;
}
function checkSanshokuDoujun(allMentsu) {
  const sequences = allMentsu.filter((m) => m.tiles[0] !== m.tiles[1]);
  for (const seq of sequences) {
    const rank = seq.tiles[0] % 9;
    const hasMan = sequences.some((s) => s.tiles[0] % 9 === rank && s.tiles[0] <= 8);
    const hasPin = sequences.some((s) => s.tiles[0] % 9 === rank && s.tiles[0] >= 9 && s.tiles[0] <= 17);
    const hasSou = sequences.some((s) => s.tiles[0] % 9 === rank && s.tiles[0] >= 18 && s.tiles[0] <= 26);
    if (hasMan && hasPin && hasSou) return true;
  }
  return false;
}
function checkIkkitsuukan(allMentsu) {
  for (const base of [0, 9, 18]) {
    const ranks = /* @__PURE__ */ new Set();
    for (const m of allMentsu) {
      if (m.tiles[0] === m.tiles[1]) continue;
      if (m.tiles[0] >= base && m.tiles[0] < base + 9) {
        ranks.add(m.tiles[0] - base);
      }
    }
    if (ranks.has(0) && ranks.has(3) && ranks.has(6)) return true;
  }
  return false;
}
function checkHonitsu(tiles, isOpen) {
  const suits = new Set(tiles.map(tileSuit));
  return suits.size === 2 && suits.has(Suit.Honor);
}
function checkChinitsu(tiles, isOpen) {
  const suits = new Set(tiles.map(tileSuit));
  return suits.size === 1 && !suits.has(Suit.Honor);
}
function checkRyanpeikou(decomp, isOpen) {
  if (isOpen || decomp.type !== "regular") return false;
  const keys = decomp.mentsu.map((m) => m.tiles.join(","));
  const counts = {};
  for (const k of keys) counts[k] = (counts[k] || 0) + 1;
  const pairs = Object.values(counts).filter((c) => c >= 2).length;
  return pairs >= 2;
}
function checkChanta(decomp, allTiles, allMentsu) {
  if (decomp.type !== "regular") return false;
  if (!allTiles.some((t) => t >= 27)) return false;
  if (allMentsu.every((m) => m.tiles[0] === m.tiles[1])) return false;
  return allMentsu.every((m) => m.tiles.some((t) => isTerminalOrHonor(t))) && isTerminalOrHonor(decomp.pair);
}
function checkJunchan(decomp, counts, allMentsu) {
  if (decomp.type !== "regular") return false;
  const isPureTerminal = (t) => t <= 26 && (t % 9 === 0 || t % 9 === 8);
  return allMentsu.every((m) => m.tiles.some((t) => isPureTerminal(t))) && isPureTerminal(decomp.pair);
}
function checkHonroutou(allTiles) {
  return allTiles.every((t) => isTerminalOrHonor(t));
}
function checkShousangen(decomp, counts) {
  if (decomp.type !== "regular") return false;
  let dragonTriplets = 0;
  for (let d = DRAGON_START; d <= DRAGON_END; d++) {
    if (counts[d] >= 3) dragonTriplets++;
  }
  return dragonTriplets === 2 && isDragon(decomp.pair);
}
function checkSanshokuDoukou(decomp, melds) {
  if (decomp.type !== "regular") return false;
  const tripletBases = /* @__PURE__ */ new Set();
  for (const m of decomp.mentsu) {
    if (m.tiles[0] === m.tiles[1]) tripletBases.add(m.tiles[0]);
  }
  for (const meld of melds) {
    if (meld.type === "pon" || meld.type === "ankan" || meld.type === "kakan" || meld.type === "daiminkan") {
      tripletBases.add(meld.tiles[0]);
    }
  }
  for (let rank = 0; rank < 9; rank++) {
    if (tripletBases.has(rank) && tripletBases.has(9 + rank) && tripletBases.has(18 + rank)) {
      return true;
    }
  }
  return false;
}
function checkSankantsu(melds) {
  return melds.filter((m) => m.type === "ankan" || m.type === "kakan" || m.type === "daiminkan").length >= 3;
}
function checkYakuman(ctx, decomp, counts, allTiles) {
  const yakuman = [];
  if (ctx.isFirstTurn && ctx.isTsumo) {
    yakuman.push({ name: ctx.seatWind === 0 ? "tenhou" : "chiihou", han: 13, kuisagari: false });
  }
  if (decomp?.type === "kokushi") {
    yakuman.push({ name: "kokushi", han: 13, kuisagari: false });
  }
  if (decomp?.type === "regular") {
    const ankouFromDecomp = decomp.mentsu.filter((m) => m.tiles[0] === m.tiles[1]).length;
    const ankouFromMelds = ctx.melds.filter((m) => m.type === "ankan").length;
    const totalAnkou = ankouFromDecomp + ankouFromMelds;
    const fourAnkou = totalAnkou === 4 && (ctx.isTsumo || decomp.pair === ctx.winningTile);
    if (fourAnkou && decomp.pair === ctx.winningTile) {
      yakuman.push({ name: "suu_ankou_tanki", han: 13, kuisagari: false });
    } else if (fourAnkou) {
      yakuman.push({ name: "suu_ankou", han: 13, kuisagari: false });
    }
    if ([31, 32, 33].every((d) => counts[d] >= 3)) {
      yakuman.push({ name: "daisangen", han: 13, kuisagari: false });
    }
    if (counts[27] >= 3 && counts[28] >= 3 && counts[29] >= 3 && counts[30] >= 3) {
      yakuman.push({ name: "daisuushii", han: 13, kuisagari: false });
    }
    let windTriplets = 0;
    for (let w = WIND_START; w <= WIND_END; w++) {
      if (counts[w] >= 3) windTriplets++;
    }
    if (windTriplets === 3 && isWind(decomp.pair)) {
      yakuman.push({ name: "shousuushii", han: 13, kuisagari: false });
    }
    const suits = new Set(allTiles.map(tileSuit));
    if (ctx.player.isMenzen && suits.size === 1 && !suits.has(Suit.Honor)) {
      const chuurenKind = checkChuuren(allTiles, ctx.winningTile);
      if (chuurenKind === "junsei") {
        yakuman.push({ name: "junsei_chuuren", han: 26, kuisagari: false });
      } else if (chuurenKind === "normal") {
        yakuman.push({ name: "chuuren", han: 13, kuisagari: false });
      }
    }
  }
  const greenTiles = /* @__PURE__ */ new Set([19, 20, 21, 23, 25, 32]);
  if (allTiles.every((t) => greenTiles.has(t))) {
    yakuman.push({ name: "ryuiisou", han: 13, kuisagari: false });
  }
  const isAllHonors = allTiles.every((t) => t >= 27);
  const isDaichisei = !!ctx.koyakuMode && decomp?.type === "seven_pairs" && isAllHonors;
  if (isDaichisei) {
    yakuman.push({ name: "daichisei", han: 26, kuisagari: false });
  } else if (isAllHonors) {
    yakuman.push({ name: "tsuuiisou", han: 13, kuisagari: false });
  }
  if (allTiles.every((t) => t <= 26 && (t % 9 === 0 || t % 9 === 8))) {
    yakuman.push({ name: "chinroutou", han: 13, kuisagari: false });
  }
  const kanCount = ctx.melds.filter((m) => m.type === "ankan" || m.type === "kakan" || m.type === "daiminkan").length;
  if (kanCount === 4) yakuman.push({ name: "suu_kantsu", han: 13, kuisagari: false });
  return yakuman;
}
function checkChuuren(tiles, winningTile) {
  const counts = countTiles(tiles);
  const suit = tileSuit(tiles[0]);
  const base = suit === 0 ? 0 : suit === 1 ? 9 : 18;
  const pattern = [3, 1, 1, 1, 1, 1, 1, 1, 3];
  let extra = 0;
  for (let i = 0; i < 9; i++) {
    if (counts[base + i] < pattern[i]) return "none";
    extra += counts[base + i] - pattern[i];
  }
  if (extra !== 1) return "none";
  if (winningTile < base || winningTile >= base + 9) return "normal";
  const winRank = winningTile - base;
  return counts[winningTile] > pattern[winRank] ? "junsei" : "normal";
}

// vendor/sanma-core/src/game/scoring.ts
function calculateFu(ctx) {
  if (ctx.isChiitoi) return 25;
  if (ctx.isPinhu) return ctx.isTsumo ? 20 : 30;
  let fu = 20;
  if (ctx.isTsumo) fu += 2;
  if (!ctx.isTsumo && ctx.isMenzen !== false) fu += 10;
  if (isDragon(ctx.pair)) fu += 2;
  if (isWind(ctx.pair)) {
    if (ctx.pair === WIND_START + ctx.seatWind) fu += 2;
    if (ctx.pair === WIND_START + ctx.roundWind) fu += 2;
  }
  fu += calcWaitFu(ctx);
  const hasSequenceWithWinTile = !ctx.isTsumo && ctx.mentsu.some(
    (m) => m.tiles[0] !== m.tiles[1] && m.tiles.includes(ctx.winningTile)
  );
  for (const mentsu of ctx.mentsu) {
    const isTriplet = mentsu.tiles[0] === mentsu.tiles[1];
    const isRonKotsu = !ctx.isTsumo && isTriplet && mentsu.tiles.includes(ctx.winningTile) && !hasSequenceWithWinTile;
    fu += mentsuFu(mentsu.tiles, isRonKotsu);
  }
  for (const meld of ctx.melds) {
    if (meld.type === "pon") fu += mentsuFu(meld.tiles, true);
    if (meld.type === "ankan") fu += mentsuFu(meld.tiles, false) * 4;
    if (meld.type === "kakan") fu += mentsuFu(meld.tiles, true) * 4;
    if (meld.type === "daiminkan") fu += mentsuFu(meld.tiles, true) * 4;
  }
  const rounded = Math.ceil(fu / 10) * 10;
  return Math.max(30, rounded);
}
function calcWaitFu(ctx) {
  if (ctx.winningTile === ctx.pair) return 2;
  for (const mentsu of ctx.mentsu) {
    if (mentsu.tiles[0] === mentsu.tiles[1]) continue;
    const sorted = [...mentsu.tiles].sort((a, b) => a - b);
    const s = Math.floor(sorted[0] / 9);
    if (sorted.some((t) => Math.floor(t / 9) !== s)) continue;
    const ranks = sorted.map((t) => t - s * 9);
    if (ranks[0] === 0 && sorted[2] === ctx.winningTile) return 2;
    if (ranks[2] === 8 && sorted[0] === ctx.winningTile) return 2;
    if (sorted[1] === ctx.winningTile) return 2;
  }
  return 0;
}
function mentsuFu(tiles, isOpen) {
  const isTriplet = tiles[0] === tiles[1];
  if (!isTriplet) return 0;
  const base = isOpen ? 2 : 4;
  const isTerminalOrHonor2 = tiles.some(
    (t) => t === 0 || t === 8 || t === 9 || t === 17 || t === 18 || t === 26 || t >= 27
  );
  return isTerminalOrHonor2 ? base * 2 : base;
}
function calculatePoints(ctx) {
  const basic = basicPoints(ctx.han, ctx.fu);
  if (ctx.isDealer) {
    return {
      ronPayment: ceil100(basic * 6),
      tsumoDealer: ceil100(basic * 2),
      tsumoChild: 0,
      tsumoDealerPays: 0,
      basicPoints: basic
    };
  }
  return {
    ronPayment: ceil100(basic * 4),
    tsumoDealer: 0,
    tsumoChild: ceil100(basic * 1),
    tsumoDealerPays: ceil100(basic * 2),
    basicPoints: basic
  };
}
function basicPoints(han, fu) {
  if (han >= 13) return 8e3 * Math.floor(han / 13);
  if (han >= 11) return 6e3;
  if (han >= 8) return 4e3;
  if (han >= 6) return 3e3;
  if (han >= 5) return 2e3;
  if (han === 4 && fu >= 40) return 2e3;
  if (han === 3 && fu >= 70) return 2e3;
  return fu * Math.pow(2, 2 + han);
}
function ceil100(n) {
  return Math.ceil(n / 100) * 100;
}

// vendor/sanma-core/src/game/win-evaluation.ts
function seatWindOf(player, dealer, playerCount) {
  return (player - dealer + playerCount) % playerCount;
}
function buildYakuContext(state, winner, isTsumo, winningTile) {
  const player = state.players[winner];
  let hand = player.hand;
  if (isTsumo) {
    const idx = hand.indexOf(winningTile);
    if (idx !== -1) {
      hand = [...hand.slice(0, idx), ...hand.slice(idx + 1)];
    }
  }
  const seatWind = seatWindOf(winner, state.dealer, state.playerCount);
  return {
    hand,
    melds: player.melds,
    player,
    roundWind: state.roundWind,
    seatWind,
    isTsumo,
    isRiichi: player.riichi,
    isIppatsu: player.ippatsuEligible === true && player.riichi,
    // Rinshan kaihou: the winning tsumo was a rinshan draw (state.atRinshan
    // set true by applyAnkan/Kakan/Daiminkan, cleared on discard).
    isRinshan: isTsumo && state.atRinshan === true,
    // Chankan: ron during the kakan respond window.
    isChankan: !isTsumo && state.chankan != null,
    // Haitei: winning tsumo with no live-wall tiles left after this draw.
    // Houtei: winning ron on a dahai made with the wall already exhausted.
    // remainingTiles() respects the kan-shrinks-live-wall rule. Rinshan
    // and haitei are MUTUALLY EXCLUSIVE — a rinshan tile isn't a
    // live-wall tile, so a kan-and-tsumo-on-rinshan doesn't also award
    // haitei even when the live wall is already depleted.
    isHaitei: isTsumo && state.atRinshan !== true && remainingTiles({
      tiles: state.wall,
      drawIndex: state.wallIndex,
      rinshanIndex: state.rinshanIndex,
      doraCount: state.doraMarkers.length,
      akaPositions: state.akaPositions ?? /* @__PURE__ */ new Set(),
      playerCount: state.playerCount
    }) === 0,
    isHoutei: !isTsumo && !state.chankan && remainingTiles({
      tiles: state.wall,
      drawIndex: state.wallIndex,
      rinshanIndex: state.rinshanIndex,
      doraCount: state.doraMarkers.length,
      akaPositions: state.akaPositions ?? /* @__PURE__ */ new Set(),
      playerCount: state.playerCount
    }) === 0,
    // First turn = before any player has called/discarded a 2nd time.
    // Conservative: require turnCount <= playerCount AND all players still
    // menzen (no calls yet). This captures tenhou/chiihou and daburii.
    // Sanma: Mahjong Soul rule — any 抜き北 declaration also breaks first
    // turn (mirrors mahjong-helper's isPlayerDaburii kita check). Without
    // this, daburi could falsely fire if an opponent kita'd then a player
    // declared riichi on turn 1.
    isFirstTurn: state.turnCount <= state.playerCount && state.players.every((p) => p.melds.length === 0) && (state.playerCount !== 3 || state.players.every((p) => p.kitaCount === 0)),
    winningTile,
    koyakuMode: state.koyakuMode
  };
}
function countDora(state, winner, isTsumo, winningTile) {
  const isSanma = state.playerCount === 3;
  const player = state.players[winner];
  const allTiles = [];
  for (const t of player.hand) allTiles.push(t);
  for (const m of player.melds) {
    for (const t of m.tiles) allTiles.push(t);
  }
  if (!isTsumo) {
    allTiles.push(winningTile);
  }
  let count = 0;
  for (const indicator of state.doraMarkers) {
    const doraTile = doraFromIndicator(indicator, isSanma);
    for (const t of allTiles) {
      if (t === doraTile) count++;
    }
  }
  if (player.riichi) {
    const uraMarkers = getUraDoraMarkers({
      tiles: state.wall,
      drawIndex: state.wallIndex,
      rinshanIndex: state.rinshanIndex,
      doraCount: state.doraMarkers.length,
      akaPositions: state.akaPositions ?? /* @__PURE__ */ new Set(),
      playerCount: state.playerCount
    });
    for (const indicator of uraMarkers) {
      const doraTile = doraFromIndicator(indicator, isSanma);
      for (const t of allTiles) if (t === doraTile) count++;
    }
  }
  if (player.akaCount && player.akaCount > 0) {
    count += player.akaCount;
  }
  if (isSanma && player.kitaCount > 0) {
    count += player.kitaCount;
    for (const indicator of state.doraMarkers) {
      if (doraFromIndicator(indicator, isSanma) === 30) {
        count += player.kitaCount;
      }
    }
  }
  return count;
}
function evaluateWin(state, winner, isTsumo, winningTile) {
  const ctx = buildYakuContext(state, winner, isTsumo, winningTile);
  const player = state.players[winner];
  const isDealer = winner === state.dealer;
  const doraCount = countDora(state, winner, isTsumo, winningTile);
  const hand13 = ctx.hand;
  const concealedPlusWin = [...hand13, winningTile];
  const decomps = decomposeAllWinningHands(concealedPlusWin);
  let bestYaku = { yaku: [], totalHan: 0, isYakuman: false };
  let bestFu = 30;
  let bestBasic = -1;
  let bestScore = null;
  let bestTotalHan = 0;
  for (const decomp of decomps) {
    const yakuResult = evaluateYakuForDecomp(ctx, decomp, concealedPlusWin);
    if (yakuResult.yaku.length === 0) continue;
    const totalHan = yakuResult.isYakuman ? yakuResult.totalHan : yakuResult.totalHan + doraCount;
    const fu = computeFu(decomp, ctx, player.melds, yakuResult.yaku, winningTile, isTsumo);
    const basic = basicPoints(totalHan, fu);
    const isImprovement = bestBasic < 0 || yakuResult.isYakuman && !bestYaku.isYakuman || yakuResult.isYakuman === bestYaku.isYakuman && basic > bestBasic || yakuResult.isYakuman === bestYaku.isYakuman && basic === bestBasic && yakuResult.yaku.length > bestYaku.yaku.length;
    if (isImprovement) {
      bestYaku = yakuResult;
      bestFu = fu;
      bestBasic = basic;
      bestTotalHan = totalHan;
      bestScore = calculatePoints({
        han: totalHan,
        fu,
        isDealer,
        isTsumo,
        playerCount: state.playerCount
      });
    }
  }
  const hasYaku = bestYaku.yaku.length > 0;
  const fallbackScore = calculatePoints({
    han: 0,
    fu: 30,
    isDealer,
    isTsumo,
    playerCount: state.playerCount
  });
  return {
    winner,
    yakuList: bestYaku.yaku,
    yakuHan: bestYaku.totalHan,
    doraCount: hasYaku && !bestYaku.isYakuman ? doraCount : 0,
    totalHan: hasYaku ? bestTotalHan : 0,
    fu: hasYaku ? bestFu : 30,
    scoreResult: bestScore ?? fallbackScore,
    isYakuman: bestYaku.isYakuman,
    hasYaku
  };
}
function previewWin(state, winner, isTsumo, winningTile) {
  const ctx = buildYakuContext(state, winner, isTsumo, winningTile);
  const yakuResult = evaluateYaku(ctx);
  return yakuResult.yaku.length > 0;
}
function computeFu(decomp, ctx, melds, yakuList, winningTile, isTsumo) {
  if (decomp.type === "seven_pairs") {
    return calculateFu({
      winningTile,
      isTsumo,
      isPinhu: false,
      isMenzen: ctx.player.isMenzen,
      isChiitoi: true,
      melds,
      pair: decomp.pair,
      mentsu: [],
      seatWind: ctx.seatWind,
      roundWind: ctx.roundWind
    });
  }
  if (decomp.type === "kokushi") {
    return 30;
  }
  const isPinhu = yakuList.some((y) => y.name === "pinhu");
  return calculateFu({
    winningTile,
    isTsumo,
    isPinhu,
    isMenzen: ctx.player.isMenzen,
    isChiitoi: false,
    melds,
    pair: decomp.pair,
    mentsu: decomp.mentsu,
    seatWind: ctx.seatWind,
    roundWind: ctx.roundWind
  });
}

// vendor/sanma-core/src/game/engine.ts
function createGame(opts = {}) {
  const playerCount = opts.playerCount ?? 4;
  const requested = opts.endRound ?? 8;
  const endRound = playerCount === 3 ? requested === 4 ? 3 : requested === 8 ? 6 : requested : requested;
  const wall = opts.fixedWall ? { tiles: opts.fixedWall, drawIndex: 0, rinshanIndex: opts.fixedWall.length - 1, doraCount: 1, akaPositions: /* @__PURE__ */ new Set(), playerCount } : createWall(playerCount);
  const { hands, akaInHand } = opts.fixedHands ? { hands: opts.fixedHands, akaInHand: opts.fixedAka ?? opts.fixedHands.map(() => []) } : dealHaipai(wall, playerCount);
  const doraMarkers = getDoraMarkers(wall);
  const dealer = (opts.startDealer ?? 0) % playerCount;
  const startingScore = playerCount === 3 ? STARTING_SCORE_SANMA : STARTING_SCORE_YONMA;
  const makePlayer = (hand, idx) => ({
    hand: hand.sort((a, b) => a - b),
    melds: [],
    discards: [],
    riichi: false,
    riichiTurn: 0,
    score: startingScore,
    isMenzen: true,
    kitaCount: 0,
    akaCount: akaInHand[idx].length,
    akaInHand: akaInHand[idx].slice(),
    akaInMelds: [],
    daburii: false,
    ippatsuEligible: false,
    nagashiEligible: true
  });
  return {
    playerCount,
    endRound,
    wall: wall.tiles,
    wallIndex: wall.drawIndex,
    rinshanIndex: wall.rinshanIndex,
    akaPositions: wall.akaPositions,
    doraMarkers,
    pendingKanDora: 0,
    players: hands.map(makePlayer),
    currentPlayer: dealer,
    dealer,
    roundWind: 0,
    roundNumber: 1,
    honba: 0,
    kyotaku: 0,
    phase: "draw",
    turnCount: 0,
    lastDiscard: null,
    lastDiscardPlayer: null,
    lastDrawnTile: null,
    lastDrawnAka: false,
    ippatsu: false,
    koyakuMode: opts.koyakuMode ?? false,
    sanwahou: opts.sanwahou ?? false,
    paoTarget: null
  };
}
function getWall(state) {
  return {
    tiles: state.wall,
    drawIndex: state.wallIndex,
    rinshanIndex: state.rinshanIndex,
    doraCount: state.doraMarkers.length,
    akaPositions: state.akaPositions ?? /* @__PURE__ */ new Set(),
    playerCount: state.playerCount
  };
}
var AKA_KIND = /* @__PURE__ */ new Set([4, 13, 22]);
function discardAkaTransition(p, tile, handAfter, forceAka = false) {
  if (!AKA_KIND.has(tile) || !p.akaInHand?.includes(tile)) {
    return { player: p, akaDiscarded: false };
  }
  const remaining = handAfter.filter((t) => t === tile).length;
  if (!forceAka && remaining >= 1) {
    return { player: p, akaDiscarded: false };
  }
  const newAkaInHand = (p.akaInHand ?? []).filter((t) => t !== tile);
  return {
    player: {
      ...p,
      akaInHand: newAkaInHand,
      akaCount: newAkaInHand.length + (p.akaInMelds?.length ?? 0)
    },
    akaDiscarded: true
  };
}
function meldAkaTransition(p, consumedFromHand, handAfter) {
  let akaInHand = (p.akaInHand ?? []).slice();
  let akaInMelds = (p.akaInMelds ?? []).slice();
  for (const t of consumedFromHand) {
    if (!AKA_KIND.has(t) || !akaInHand.includes(t)) continue;
    const remaining = handAfter.filter((x) => x === t).length;
    if (remaining >= 1) continue;
    akaInHand = akaInHand.filter((x) => x !== t);
    akaInMelds.push(t);
  }
  return {
    ...p,
    akaInHand,
    akaInMelds,
    akaCount: akaInHand.length + akaInMelds.length
  };
}
function revealPendingKanDora(state) {
  const pending = state.pendingKanDora ?? 0;
  if (pending <= 0) return state;
  const wall = { ...getWall(state), doraCount: state.doraMarkers.length + pending };
  return { ...state, doraMarkers: getDoraMarkers(wall), pendingKanDora: 0 };
}
function waitsOf(hand, playerCount) {
  const waits = [];
  for (let t = 0; t < 34; t = t + 1) {
    if (playerCount === 3 && t >= 1 && t <= 7) continue;
    if (hand.filter((x) => x === t).length >= 4) continue;
    if (isWinningHand([...hand, t])) waits.push(t);
  }
  return waits;
}
function isLegalRiichiAnkan(state, tile) {
  const player = state.players[state.currentPlayer];
  if (!player.riichi || state.lastDrawnTile !== tile) return false;
  if (player.hand.filter((t) => t === tile).length !== 4) return false;
  const before = [...player.hand];
  before.splice(before.lastIndexOf(tile), 1);
  const after = player.hand.filter((t) => t !== tile);
  return waitsOf(before, state.playerCount).join(",") === waitsOf(after, state.playerCount).join(",");
}
function discardVariants(player, kind, tile) {
  const hasAka = (player.akaInHand ?? []).includes(tile);
  if (!hasAka) return [{ kind, tile }];
  const copies = player.hand.filter((t) => t === tile).length;
  if (copies > 1) return [
    { kind, tile, aka: false },
    { kind, tile, aka: true }
  ];
  return [{ kind, tile, aka: true }];
}
function getValidActions(state) {
  const actions = [];
  switch (state.phase) {
    case "draw": {
      actions.push({ kind: ActionKind.Pass });
      break;
    }
    case "discard": {
      const player = state.players[state.currentPlayer];
      const wall = getWall(state);
      const liveRemaining = remainingTiles(wall);
      const canTakeReplacement = liveRemaining > 0 && drawRinshan(wall) !== null;
      const uniqueTiles = player.riichi && state.lastDrawnTile != null ? [state.lastDrawnTile] : [...new Set(player.hand)];
      const forbidden = new Set(state.kuikae ?? []);
      for (const t of uniqueTiles) {
        if (!forbidden.has(t)) {
          actions.push(...discardVariants(player, ActionKind.Discard, t));
        }
      }
      if (isWinningHand(player.hand) && state.lastDrawnTile !== null && previewWin(state, state.currentPlayer, true, state.lastDrawnTile)) {
        actions.push({ kind: ActionKind.Tsumo });
      }
      if (player.isMenzen && !player.riichi && player.score >= 1e3 && liveRemaining >= state.playerCount) {
        for (const t of uniqueTiles) {
          const remaining = [...player.hand];
          const idx = remaining.indexOf(t);
          remaining.splice(idx, 1);
          if (calculateShanten(remaining, player.melds.length) === 0) {
            actions.push(...discardVariants(player, ActionKind.Riichi, t));
          }
        }
      }
      for (const t of uniqueTiles) {
        if (canTakeReplacement && player.hand.filter((x) => x === t).length === 4 && (!player.riichi || isLegalRiichiAnkan(state, t))) {
          actions.push({ kind: ActionKind.Ankan, tile: t });
        }
      }
      if (!player.riichi && canTakeReplacement) {
        for (const meld of player.melds) {
          if (meld.type === "pon" && player.hand.includes(meld.tiles[0])) {
            actions.push({ kind: ActionKind.Kakan, tile: meld.tiles[0] });
          }
        }
      }
      const myFirstDraw = player.discards.length === 0;
      const noCallsYet = state.players.every((p) => p.melds.length === 0);
      if (myFirstDraw && noCallsYet) {
        const terminalSet = new Set(player.hand.filter(
          (t) => [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].includes(t)
        ));
        if (terminalSet.size >= 9) {
          actions.push({ kind: ActionKind.Kyushukyuhai });
        }
      }
      if (canTakeReplacement && state.playerCount === 3 && state.lastDrawnTile != null && player.hand.includes(30) && (!player.riichi || state.lastDrawnTile === 30)) {
        actions.push({ kind: ActionKind.Kita });
      }
      break;
    }
    case "respond": {
      if (state.chankan) {
        const tile = state.chankan.tile;
        const kaker = state.chankan.kaker;
        for (let offset = 1; offset <= state.playerCount - 1; offset++) {
          const p = (kaker + offset) % state.playerCount;
          if (isWinningHand([...state.players[p].hand, tile]) && previewWin(state, p, false, tile)) {
            actions.push({ kind: ActionKind.Ron, called: tile });
            break;
          }
        }
        actions.push({ kind: ActionKind.Pass });
        break;
      }
      const discarded = state.lastDiscard;
      const discardedBy = state.lastDiscardPlayer;
      const lastOffset = state.playerCount - 1;
      let ronPlayer = null;
      let ronCount = 0;
      for (let offset = 1; offset <= lastOffset; offset++) {
        const p = (discardedBy + offset) % state.playerCount;
        if (!isWinningHand([...state.players[p].hand, discarded])) continue;
        if (!previewWin(state, p, false, discarded)) continue;
        if (isPermanentFuriten(state.players[p])) continue;
        ronCount++;
        if (ronPlayer === null) ronPlayer = p;
      }
      if (ronPlayer !== null && !(state.sanwahou && ronCount >= 3)) {
        actions.push({ kind: ActionKind.Ron, called: discarded });
      }
      if (remainingTiles(getWall(state)) > 0) {
        for (let offset = 1; offset <= lastOffset; offset++) {
          const p = (discardedBy + offset) % state.playerCount;
          if (state.players[p].riichi) continue;
          if (state.players[p].hand.filter((t) => t === discarded).length === 3) {
            actions.push({ kind: ActionKind.Daiminkan, called: discarded });
            break;
          }
        }
        for (let offset = 1; offset <= lastOffset; offset++) {
          const p = (discardedBy + offset) % state.playerCount;
          if (state.players[p].riichi) continue;
          if (state.players[p].hand.filter((t) => t === discarded).length >= 2) {
            actions.push({ kind: ActionKind.Pon, called: discarded });
            break;
          }
        }
        if (state.playerCount === 4) {
          const nextPlayer = (discardedBy + 1) % state.playerCount;
          if (!state.players[nextPlayer].riichi) {
            actions.push(...getChiActions(state.players[nextPlayer].hand, discarded, state.players[nextPlayer].akaInHand));
          }
        }
      }
      actions.push({ kind: ActionKind.Pass });
      break;
    }
    case "kita_declare": {
      const declarer = state.currentPlayer;
      for (let offset = 1; offset <= state.playerCount - 1; offset++) {
        const p = (declarer + offset) % state.playerCount;
        if (isWinningHand([...state.players[p].hand, 30]) && previewWin(state, p, false, 30)) {
          actions.push({ kind: ActionKind.Ron, called: 30 });
          break;
        }
      }
      actions.push({ kind: ActionKind.Pass });
      break;
    }
  }
  return actions;
}
function getChiActions(hand, discarded, akaInHand) {
  const actions = [];
  if (discarded >= 27) return actions;
  const suitStart = Math.floor(discarded / 9) * 9;
  const rank = discarded - suitStart;
  for (let lo = rank - 2; lo <= rank; lo++) {
    if (lo < 0 || lo + 2 >= 9) continue;
    const seq = [suitStart + lo, suitStart + lo + 1, suitStart + lo + 2];
    if (!seq.includes(discarded)) continue;
    const needed = seq.filter((t) => t !== discarded);
    const handCopy = [...hand];
    let canChi = true;
    for (const n of needed) {
      const idx = handCopy.indexOf(n);
      if (idx === -1) {
        canChi = false;
        break;
      }
      handCopy.splice(idx, 1);
    }
    if (canChi) {
      const akaSet = new Set(akaInHand ?? []);
      const hasAkaChoice = needed.some(
        (t) => AKA_KIND.has(t) && akaSet.has(t) && hand.filter((x) => x === t).length >= 2
      );
      if (hasAkaChoice) {
        actions.push({ kind: ActionKind.Chi, tiles: needed, called: discarded, useAka: false });
        actions.push({ kind: ActionKind.Chi, tiles: needed, called: discarded, useAka: true });
      } else {
        actions.push({ kind: ActionKind.Chi, tiles: needed, called: discarded });
      }
    }
  }
  return actions;
}
var KAN_TYPES = /* @__PURE__ */ new Set(["ankan", "kakan", "daiminkan"]);
function totalKanCount(players) {
  let n = 0;
  for (const p of players) for (const m of p.melds) if (KAN_TYPES.has(m.type)) n++;
  return n;
}
function isSuuKaiKan(players) {
  if (totalKanCount(players) < 4) return false;
  let kanPlayers = 0;
  for (const p of players) {
    if (p.melds.some((m) => KAN_TYPES.has(m.type))) kanPlayers++;
  }
  return kanPlayers >= 2;
}
var DRAGON_TILES = /* @__PURE__ */ new Set([31, 32, 33]);
var WIND_TILES = /* @__PURE__ */ new Set([27, 28, 29, 30]);
function checkPao(players, caller, calledTile, discardedBy) {
  const melds = players[caller]?.melds;
  if (!melds) return null;
  if (DRAGON_TILES.has(calledTile)) {
    const dragonTypes = /* @__PURE__ */ new Set();
    for (const m of melds) {
      if ((m.type === "pon" || m.type === "daiminkan" || m.type === "kakan") && DRAGON_TILES.has(m.tiles[0])) {
        dragonTypes.add(m.tiles[0]);
      }
    }
    if (dragonTypes.size === 3) return discardedBy;
  }
  if (WIND_TILES.has(calledTile)) {
    const windTypes = /* @__PURE__ */ new Set();
    for (const m of melds) {
      if ((m.type === "pon" || m.type === "daiminkan" || m.type === "kakan") && WIND_TILES.has(m.tiles[0])) {
        windTypes.add(m.tiles[0]);
      }
    }
    if (windTypes.size === 4) return discardedBy;
  }
  return null;
}
function isSuuFuuRenda(state) {
  if (state.playerCount !== 4) return false;
  if (state.turnCount > 4) return false;
  if (!state.players.every((p) => p.melds.length === 0)) return false;
  if (!state.players.every((p) => p.discards.length === 1)) return false;
  const first = state.players[0].discards[0].tile;
  if (first < 27 || first > 30) return false;
  return state.players.every((p) => p.discards[0].tile === first);
}
function isSanwahou(state) {
  if (state.playerCount !== 4) return false;
  const discarded = state.lastDiscard;
  const discardedBy = state.lastDiscardPlayer;
  if (discarded == null || discardedBy == null) return false;
  let ronCount = 0;
  for (let offset = 1; offset <= 3; offset++) {
    const p = (discardedBy + offset) % 4;
    if (isWinningHand([...state.players[p].hand, discarded]) && previewWin(state, p, false, discarded) && !isPermanentFuriten(state.players[p])) {
      ronCount++;
    }
  }
  return ronCount >= 3;
}
function applyAction(state, action) {
  switch (action.kind) {
    case ActionKind.Pass:
      return applyPass(state);
    case ActionKind.Discard:
      return applyDiscard(state, action);
    case ActionKind.Tsumo:
      return applyTsumo(state);
    case ActionKind.Ron:
      return applyRon(state, action);
    case ActionKind.Pon:
      return applyPon(state, action);
    case ActionKind.Chi:
      return applyChi(state, action);
    case ActionKind.Riichi:
      return applyRiichi(state, action);
    case ActionKind.Ankan:
      return applyAnkan(state, action);
    case ActionKind.Kakan:
      return applyKakan(state, action);
    case ActionKind.Daiminkan:
      return applyDaiminkan(state, action);
    case ActionKind.Kyushukyuhai:
      return { ...state, phase: "ryukyoku", ryukyokuReason: "kyushukyuhai" };
    case ActionKind.Kita:
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, ippatsuEligible: false })),
        phase: "kita_declare"
      };
    default:
      console.warn(`engine: applyAction \u2014 unknown action kind: ${action.kind}`);
      return state;
  }
}
function applyPass(state) {
  if (state.phase === "draw") {
    return advanceToDraw(state, state.currentPlayer);
  }
  if (state.phase === "respond") {
    if (state.chankan) {
      return completeKakanDraw(state);
    }
    if (isSuuKaiKan(state.players)) {
      return { ...state, phase: "ryukyoku", ryukyokuReason: "suukaikan" };
    }
    if (isSuuFuuRenda(state)) {
      return { ...state, phase: "ryukyoku", ryukyokuReason: "suufonrenda" };
    }
    if (state.sanwahou && isSanwahou(state)) {
      return { ...state, phase: "ryukyoku", ryukyokuReason: "sanwahou" };
    }
    const nextPlayer = (state.lastDiscardPlayer + 1) % state.playerCount;
    return advanceToDraw(state, nextPlayer);
  }
  if (state.phase === "kita_declare") {
    return resolveKita(state);
  }
  console.warn(`engine: applyPass in unexpected phase: ${state.phase}`);
  return state;
}
function resolveKita(state) {
  const player = state.currentPlayer;
  const players = state.players.map((p, i) => {
    if (i !== player) return p;
    const hand = [...p.hand];
    const idx = hand.indexOf(30);
    if (idx !== -1) hand.splice(idx, 1);
    return { ...p, hand, kitaCount: p.kitaCount + 1 };
  }).map((p) => ({ ...p, ippatsuEligible: false }));
  const wall = getWall({ ...state, players });
  const result = drawRinshan(wall);
  if (!result) return applyRyukyokuTenpaiPayments({ ...state, players, phase: "ryukyoku", ryukyokuReason: "exhaustive" });
  const playersWithDraw = players.map((p, i) => {
    if (i !== player) return p;
    return {
      ...p,
      hand: [...p.hand, result.tile].sort((a, b) => a - b),
      akaInHand: result.aka ? [...p.akaInHand ?? [], result.tile] : p.akaInHand ?? [],
      akaCount: (p.akaInHand?.length ?? 0) + (result.aka ? 1 : 0) + (p.akaInMelds?.length ?? 0)
    };
  });
  const newState = {
    ...state,
    players: playersWithDraw,
    wall: result.wall.tiles,
    wallIndex: result.wall.drawIndex,
    rinshanIndex: result.wall.rinshanIndex,
    // Nuki draws a dead-wall replacement but does not reveal kan dora.
    doraMarkers: state.doraMarkers,
    lastDrawnTile: result.tile,
    lastDrawnAka: result.aka,
    phase: result.tile === 30 ? "kita_declare" : "discard"
  };
  return newState;
}
function advanceToDraw(state, player) {
  const wall = getWall(state);
  const result = drawTile(wall);
  if (!result) return applyRyukyokuTenpaiPayments({ ...state, phase: "ryukyoku", ryukyokuReason: "exhaustive" });
  const players = state.players.map((p, i) => {
    if (i !== player) return p;
    return {
      ...p,
      hand: [...p.hand, result.tile].sort((a, b) => a - b),
      akaInHand: result.aka ? [...p.akaInHand ?? [], result.tile] : p.akaInHand ?? [],
      akaCount: (p.akaCount ?? 0) + (result.aka ? 1 : 0)
    };
  });
  const isKitaTrigger = state.playerCount === 3 && result.tile === 30;
  return {
    ...state,
    wall: result.wall.tiles,
    wallIndex: result.wall.drawIndex,
    rinshanIndex: result.wall.rinshanIndex,
    doraMarkers: getDoraMarkers(result.wall),
    players,
    currentPlayer: player,
    phase: isKitaTrigger ? "kita_declare" : "discard",
    turnCount: state.turnCount + 1,
    lastDiscard: null,
    lastDiscardPlayer: null,
    lastDrawnTile: result.tile,
    lastDrawnAka: result.aka
  };
}
function applyDiscard(state, action) {
  state = revealPendingKanDora(state);
  const tsumogiri = action.tile === state.lastDrawnTile;
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p;
    const hand = [...p.hand];
    const idx = hand.indexOf(action.tile);
    hand.splice(idx, 1);
    const withDiscard = {
      ...p,
      hand,
      discards: [...p.discards, {
        tile: action.tile,
        tsumogiri,
        riichi: p.riichi && p.riichiTurn === state.turnCount
      }],
      // The declaration discard itself keeps ippatsu alive. It expires on
      // this player's next discard if nobody called in between.
      ippatsuEligible: p.ippatsuEligible && p.riichiTurn < state.turnCount ? false : p.ippatsuEligible,
      nagashiEligible: p.nagashiEligible !== false && (action.tile >= 27 || [0, 8, 9, 17, 18, 26].includes(action.tile))
    };
    const transitioned = discardAkaTransition(withDiscard, action.tile, hand, action.aka === true);
    const discards = [...transitioned.player.discards];
    discards[discards.length - 1] = {
      ...discards[discards.length - 1],
      aka: transitioned.akaDiscarded
    };
    return { ...transitioned.player, discards };
  });
  return {
    ...state,
    players,
    lastDiscard: action.tile,
    lastDiscardPlayer: state.currentPlayer,
    phase: "respond",
    atRinshan: false,
    kuikae: void 0
  };
}
function checkTobi(state) {
  return state.players.some((p) => p.score < 0);
}
function finalRanking(state) {
  const sorted = state.players.map((p, i) => ({ player: i, score: p.score })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.player === state.dealer) return -1;
    if (b.player === state.dealer) return 1;
    return a.player - b.player;
  });
  return sorted.map((entry, i) => ({ ...entry, rank: i + 1 }));
}
function finalizeGame(state) {
  if (state.kyotaku > 0) {
    const ranking = finalRanking(state);
    const top = ranking[0].player;
    const players = state.players.map(
      (p, i) => i === top ? { ...p, score: p.score + state.kyotaku * 1e3 } : p
    );
    return { ...state, players, kyotaku: 0, phase: "game_over" };
  }
  return { ...state, phase: "game_over" };
}
function applyTsumo(state) {
  const winner = state.currentPlayer;
  const winningTile = state.lastDrawnTile;
  if (winningTile === null) {
    console.warn(`engine: applyTsumo with no winningTile (phase=${state.phase} player=${winner})`);
    return state;
  }
  const evalResult = evaluateWin(state, winner, true, winningTile);
  if (!evalResult.hasYaku) {
    console.warn(`engine: applyTsumo rejected \u2014 no yaku (player=${winner})`);
    return state;
  }
  const isDealerWin = winner === state.dealer;
  const honbaPay = HONBA_TSUMO * state.honba;
  const newScores = state.players.map((p) => p.score);
  const hasPaoYaku = evalResult.yakuList.some((y) => y.name === "daisangen" || y.name === "daisuushii");
  const pao = state.paoTarget != null && hasPaoYaku ? state.paoTarget : null;
  const paoScore = pao == null ? null : calculatePoints({
    han: 13,
    fu: 0,
    isDealer: isDealerWin,
    isTsumo: true,
    playerCount: state.playerCount
  });
  let paoCharge = 0;
  let totalCollected = 0;
  for (let i = 0; i < state.playerCount; i++) {
    if (i === winner) continue;
    let pay;
    if (isDealerWin) {
      pay = evalResult.scoreResult.tsumoDealer;
    } else {
      pay = i === state.dealer ? evalResult.scoreResult.tsumoDealerPays : evalResult.scoreResult.tsumoChild;
    }
    const basePay = pay;
    pay += honbaPay;
    if (pao != null) {
      const paoShare = isDealerWin ? paoScore.tsumoDealer : i === state.dealer ? paoScore.tsumoDealerPays : paoScore.tsumoChild;
      newScores[i] -= basePay - paoShare;
      paoCharge += paoShare + honbaPay;
      totalCollected += pay;
    } else {
      newScores[i] -= pay;
      totalCollected += pay;
    }
  }
  if (pao != null) {
    newScores[pao] -= paoCharge;
  }
  newScores[winner] += totalCollected + state.kyotaku * KYOTAKU_VALUE;
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    score: newScores[i]
  }));
  return {
    ...state,
    players: newPlayers,
    kyotaku: 0,
    phase: "tsumo_win"
  };
}
function applyRon(state, action) {
  const isChankita = state.phase === "kita_declare";
  const isChankan = state.phase === "respond" && state.chankan != null;
  const loser = isChankita ? state.currentPlayer : isChankan ? state.chankan.kaker : state.lastDiscardPlayer;
  const calledTile = action.called;
  let winner = null;
  for (let offset = 1; offset <= state.playerCount - 1; offset++) {
    const p = (loser + offset) % state.playerCount;
    if (isWinningHand([...state.players[p].hand, calledTile]) && previewWin(state, p, false, calledTile)) {
      winner = p;
      break;
    }
  }
  if (winner === null) {
    console.warn(`engine: applyRon \u2014 no valid winner (loser=${loser} called=${calledTile})`);
    return state;
  }
  const evalResult = evaluateWin(state, winner, false, calledTile);
  if (!evalResult.hasYaku) {
    console.warn(`engine: applyRon rejected \u2014 no yaku (winner=${winner} called=${calledTile})`);
    return state;
  }
  const honbaPay = HONBA_RON * state.honba;
  const hasPaoYaku = evalResult.yakuList.some((y) => y.name === "daisangen" || y.name === "daisuushii");
  const pao = state.paoTarget != null && hasPaoYaku ? state.paoTarget : null;
  const newScores = state.players.map((p) => p.score);
  if (pao != null) {
    const paoPayment = calculatePoints({
      han: 13,
      fu: 0,
      isDealer: winner === state.dealer,
      isTsumo: false,
      playerCount: state.playerCount
    }).ronPayment;
    const paoShare = Math.floor(paoPayment / 2);
    newScores[pao] -= paoPayment - paoShare + honbaPay;
    newScores[loser] -= evalResult.scoreResult.ronPayment - (paoPayment - paoShare);
  } else {
    const totalFromLoser = evalResult.scoreResult.ronPayment + honbaPay;
    newScores[loser] -= totalFromLoser;
  }
  const totalCollected = evalResult.scoreResult.ronPayment + honbaPay;
  newScores[winner] += totalCollected + state.kyotaku * KYOTAKU_VALUE;
  const newPlayers = state.players.map((p, i) => ({
    ...p,
    score: newScores[i]
  }));
  return {
    ...state,
    players: newPlayers,
    currentPlayer: winner,
    kyotaku: 0,
    phase: "ron_win"
  };
}
function applyPon(state, action) {
  const discardedBy = state.lastDiscardPlayer;
  for (let offset = 1; offset <= state.playerCount - 1; offset++) {
    const p = (discardedBy + offset) % state.playerCount;
    if (action.actor != null && p !== action.actor) continue;
    if (state.players[p].hand.filter((t) => t === action.called).length >= 2) {
      const players = state.players.map((pl, i) => {
        if (i !== p) return pl;
        const hand = [...pl.hand];
        for (let k = 0; k < 2; k++) {
          const idx = hand.indexOf(action.called);
          hand.splice(idx, 1);
        }
        const consumed = [action.called, action.called];
        const withMeld = {
          ...pl,
          hand,
          melds: [...pl.melds, {
            type: "pon",
            tiles: [action.called, action.called, action.called],
            calledFrom: discardedBy
          }],
          isMenzen: false
        };
        return meldAkaTransition(withMeld, consumed, hand);
      }).map((pl) => ({ ...pl, ippatsuEligible: false }));
      const discarderPlayers = players.map((pl, i) => {
        if (i !== discardedBy) return pl;
        const discards = [...pl.discards];
        discards.pop();
        return { ...pl, discards, nagashiEligible: false };
      });
      const paoTarget = state.paoTarget ?? checkPao(discarderPlayers, p, action.called, discardedBy);
      return {
        ...state,
        players: discarderPlayers,
        currentPlayer: p,
        phase: "discard",
        lastDiscard: null,
        lastDiscardPlayer: null,
        lastDrawnTile: null,
        lastDrawnAka: false,
        paoTarget,
        kuikae: [action.called]
      };
    }
  }
  console.warn(`engine: applyPon \u2014 no valid responder (called=${action.called})`);
  return state;
}
function chiKuikae(tiles, called) {
  const sorted = [tiles[0], tiles[1], called].sort((a, b) => a - b);
  const forbidden = [called];
  const suit = Math.floor(called / 9);
  if (called === sorted[0]) {
    const suji = sorted[2] + 1;
    if (Math.floor(suji / 9) === suit && suji % 9 < 9) forbidden.push(suji);
  } else if (called === sorted[2]) {
    const suji = sorted[0] - 1;
    if (Math.floor(suji / 9) === suit && suji % 9 >= 0 && suji >= suit * 9) forbidden.push(suji);
  }
  return forbidden;
}
function applyChi(state, action) {
  if (state.playerCount === 3) return state;
  const nextPlayer = (state.lastDiscardPlayer + 1) % state.playerCount;
  const players = state.players.map((p, i) => {
    if (i !== nextPlayer) return p;
    const hand = [...p.hand];
    for (const t of action.tiles) {
      const idx = hand.indexOf(t);
      hand.splice(idx, 1);
    }
    const withMeld = {
      ...p,
      hand,
      melds: [...p.melds, {
        type: "chi",
        tiles: [...action.tiles, action.called].sort((a, b) => a - b),
        calledFrom: state.lastDiscardPlayer
      }],
      isMenzen: false
    };
    let result = meldAkaTransition(withMeld, [...action.tiles], hand);
    if (action.useAka === true) {
      const akaTile = action.tiles.find((t) => AKA_KIND.has(t) && (result.akaInHand ?? []).includes(t));
      if (akaTile != null) {
        result = { ...result, akaInHand: (result.akaInHand ?? []).filter((x) => x !== akaTile), akaInMelds: [...result.akaInMelds ?? [], akaTile], akaCount: result.akaCount };
      }
    } else if (action.useAka === false) {
      const akaTile = action.tiles.find((t) => AKA_KIND.has(t) && (result.akaInMelds ?? []).includes(t) && !(p.akaInMelds ?? []).includes(t));
      if (akaTile != null) {
        result = { ...result, akaInHand: [...result.akaInHand ?? [], akaTile], akaInMelds: (result.akaInMelds ?? []).filter((x) => x !== akaTile), akaCount: result.akaCount };
      }
    }
    return result;
  }).map((p) => ({ ...p, ippatsuEligible: false }));
  const discardedBy = state.lastDiscardPlayer;
  const fixedPlayers = players.map((pl, i) => {
    if (i !== discardedBy) return pl;
    const discards = [...pl.discards];
    discards.pop();
    return { ...pl, discards, nagashiEligible: false };
  });
  return {
    ...state,
    players: fixedPlayers,
    currentPlayer: nextPlayer,
    phase: "discard",
    lastDiscard: null,
    lastDiscardPlayer: null,
    lastDrawnTile: null,
    lastDrawnAka: false,
    kuikae: chiKuikae(action.tiles, action.called)
  };
}
function applyRiichi(state, action) {
  const daburiiEligible = state.turnCount <= state.playerCount && state.players.every((p) => p.melds.length === 0) && (state.playerCount !== 3 || state.players.every((p) => p.kitaCount === 0));
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p;
    return {
      ...p,
      riichi: true,
      riichiTurn: state.turnCount,
      score: p.score - 1e3,
      daburii: daburiiEligible,
      ippatsuEligible: true
    };
  });
  const declarer = players[state.currentPlayer];
  if (declarer.score < 0) {
    return finalizeGame({ ...state, players, kyotaku: state.kyotaku + 1 });
  }
  const discardState = applyDiscard({ ...state, players }, action);
  return { ...discardState, kyotaku: state.kyotaku + 1 };
}
function applyAnkan(state, action) {
  state = revealPendingKanDora(state);
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p;
    const hand = [...p.hand];
    for (let k = 0; k < 4; k++) {
      const idx = hand.indexOf(action.tile);
      hand.splice(idx, 1);
    }
    const hadAkaOfTile = (p.akaInHand ?? []).includes(action.tile);
    return {
      ...p,
      hand,
      melds: [...p.melds, {
        type: "ankan",
        tiles: [action.tile, action.tile, action.tile, action.tile],
        calledFrom: i
      }],
      akaInHand: (p.akaInHand ?? []).filter((t) => t !== action.tile),
      akaInMelds: hadAkaOfTile ? [...p.akaInMelds ?? [], action.tile] : p.akaInMelds ?? []
    };
  }).map((p) => ({ ...p, ippatsuEligible: false }));
  const wall = getWall({ ...state, players });
  const result = drawRinshan(wall);
  if (!result) return { ...state, players, phase: "ryukyoku" };
  const playersWithDraw = players.map((p, i) => {
    if (i !== state.currentPlayer) return p;
    return {
      ...p,
      hand: [...p.hand, result.tile].sort((a, b) => a - b),
      akaInHand: result.aka ? [...p.akaInHand ?? [], result.tile] : p.akaInHand ?? [],
      akaCount: (p.akaInHand ?? []).length + (result.aka ? 1 : 0) + (p.akaInMelds ?? []).length
    };
  });
  return {
    ...state,
    players: playersWithDraw,
    wall: result.wall.tiles,
    wallIndex: result.wall.drawIndex,
    rinshanIndex: result.wall.rinshanIndex,
    doraMarkers: getDoraMarkers(result.wall),
    phase: "discard",
    lastDrawnTile: result.tile,
    lastDrawnAka: result.aka,
    atRinshan: true
  };
}
function applyKakan(state, action) {
  state = revealPendingKanDora(state);
  const players = state.players.map((p, i) => {
    if (i !== state.currentPlayer) return p;
    const hand = [...p.hand];
    const idx = hand.indexOf(action.tile);
    hand.splice(idx, 1);
    const melds = p.melds.map(
      (m) => m.type === "pon" && m.tiles[0] === action.tile ? { ...m, type: "kakan", tiles: [...m.tiles, action.tile] } : m
    );
    const withMeld = { ...p, hand, melds };
    return meldAkaTransition(withMeld, [action.tile], hand);
  });
  return {
    ...state,
    players,
    // Open the chankan window before touching the dead wall.
    phase: "respond",
    chankan: { tile: action.tile, kaker: state.currentPlayer },
    lastDrawnTile: null,
    lastDrawnAka: false,
    atRinshan: false
  };
}
function completeKakanDraw(state) {
  const kaker = state.chankan.kaker;
  const wall = getWall(state);
  const result = drawRinshan(wall);
  if (!result) return { ...state, chankan: null, phase: "ryukyoku" };
  const players = state.players.map((p, i) => i !== kaker ? p : {
    ...p,
    hand: [...p.hand, result.tile].sort((a, b) => a - b),
    akaInHand: result.aka ? [...p.akaInHand ?? [], result.tile] : p.akaInHand ?? [],
    akaCount: (p.akaInHand?.length ?? 0) + (result.aka ? 1 : 0) + (p.akaInMelds?.length ?? 0)
  }).map((p) => ({ ...p, ippatsuEligible: false }));
  return {
    ...state,
    players,
    currentPlayer: kaker,
    wall: result.wall.tiles,
    wallIndex: result.wall.drawIndex,
    rinshanIndex: result.wall.rinshanIndex,
    doraMarkers: state.doraMarkers,
    pendingKanDora: (state.pendingKanDora ?? 0) + 1,
    chankan: null,
    phase: "discard",
    lastDrawnTile: result.tile,
    lastDrawnAka: result.aka,
    atRinshan: true
  };
}
function applyDaiminkan(state, action) {
  const discardedBy = state.lastDiscardPlayer;
  for (let offset = 1; offset <= state.playerCount - 1; offset++) {
    const p = (discardedBy + offset) % state.playerCount;
    if (action.actor != null && p !== action.actor) continue;
    if (state.players[p].hand.filter((t) => t === action.called).length === 3) {
      const players = state.players.map((pl, i) => {
        if (i !== p) return pl;
        const hand = [...pl.hand];
        for (let k = 0; k < 3; k++) {
          const idx = hand.indexOf(action.called);
          hand.splice(idx, 1);
        }
        const consumed = [action.called, action.called, action.called];
        const withMeld = {
          ...pl,
          hand,
          melds: [...pl.melds, {
            type: "daiminkan",
            tiles: [action.called, action.called, action.called, action.called],
            calledFrom: discardedBy
          }],
          isMenzen: false
        };
        return meldAkaTransition(withMeld, consumed, hand);
      }).map((pl) => ({ ...pl, ippatsuEligible: false }));
      const fixedPlayers = players.map((pl, i) => {
        if (i !== discardedBy) return pl;
        const discards = [...pl.discards];
        discards.pop();
        return { ...pl, discards, nagashiEligible: false };
      });
      const wall = getWall({ ...state, players: fixedPlayers, currentPlayer: p });
      const result = drawRinshan(wall);
      if (!result) return { ...state, players: fixedPlayers, phase: "ryukyoku" };
      const playersWithDraw = fixedPlayers.map((pl, i) => {
        if (i !== p) return pl;
        return {
          ...pl,
          hand: [...pl.hand, result.tile].sort((a, b) => a - b),
          akaInHand: result.aka ? [...pl.akaInHand ?? [], result.tile] : pl.akaInHand ?? [],
          akaCount: (pl.akaInHand?.length ?? 0) + (result.aka ? 1 : 0) + (pl.akaInMelds?.length ?? 0)
        };
      });
      const paoTarget = state.paoTarget ?? checkPao(players, p, action.called, discardedBy);
      return {
        ...state,
        players: playersWithDraw,
        currentPlayer: p,
        wall: result.wall.tiles,
        wallIndex: result.wall.drawIndex,
        rinshanIndex: result.wall.rinshanIndex,
        doraMarkers: state.doraMarkers,
        pendingKanDora: (state.pendingKanDora ?? 0) + 1,
        phase: "discard",
        lastDiscard: null,
        lastDiscardPlayer: null,
        lastDrawnTile: result.tile,
        lastDrawnAka: result.aka,
        atRinshan: true,
        paoTarget
      };
    }
  }
  console.warn(`engine: applyDaiminkan \u2014 no valid responder (called=${action.called})`);
  return state;
}
function isPlayerTenpai(p) {
  if (p.riichi) return true;
  return calculateShanten(p.hand, p.melds.length) === 0;
}
function isPermanentFuriten(p) {
  const discardSet = /* @__PURE__ */ new Set();
  for (const d of p.discards) discardSet.add(d.tile);
  if (discardSet.size === 0) return false;
  for (let t = 0; t < 34; t = t + 1) {
    if (isWinningHand([...p.hand, t])) {
      if (discardSet.has(t)) return true;
    }
  }
  return false;
}
function applyRyukyokuTenpaiPayments(state) {
  const tenpai = state.players.map(isPlayerTenpai);
  const tenpaiCount = tenpai.filter(Boolean).length;
  const notenCount = state.playerCount - tenpaiCount;
  if (tenpaiCount === 0 || tenpaiCount === state.playerCount) return state;
  const perTenpai = 3e3 / tenpaiCount;
  const perNoten = 3e3 / notenCount;
  const players = state.players.map((p, i) => ({
    ...p,
    score: p.score + (tenpai[i] ? perTenpai : -perNoten)
  }));
  return { ...state, players };
}
function nextRound(state) {
  if (state.phase !== "tsumo_win" && state.phase !== "ron_win" && state.phase !== "ryukyoku") {
    return state;
  }
  if (checkTobi(state)) {
    return finalizeGame(state);
  }
  const targetScore = state.playerCount === 3 ? 4e4 : 3e4;
  const topScore = Math.max(...state.players.map((p) => p.score));
  const dealerIsTop = state.players[state.dealer].score === topScore;
  const inFinalOrExtension = state.roundNumber >= state.endRound;
  const isDealerWin = (state.phase === "tsumo_win" || state.phase === "ron_win") && state.currentPlayer === state.dealer;
  if (isDealerWin) {
    if (inFinalOrExtension && dealerIsTop && state.players[state.dealer].score >= targetScore) {
      return finalizeGame(state);
    }
    return newRound(state, state.dealer, state.roundNumber, state.roundWind, state.honba + 1);
  }
  if (state.phase === "ryukyoku") {
    if (state.ryukyokuReason && state.ryukyokuReason !== "exhaustive") {
      return newRound(state, state.dealer, state.roundNumber, state.roundWind, state.honba + 1);
    }
    const dealerTenpai = isPlayerTenpai(state.players[state.dealer]);
    if (dealerTenpai) {
      if (inFinalOrExtension && dealerIsTop && state.players[state.dealer].score >= targetScore) {
        return finalizeGame(state);
      }
      return newRound(state, state.dealer, state.roundNumber, state.roundWind, state.honba + 1);
    }
    const newDealer2 = (state.dealer + 1) % state.playerCount;
    const newRoundNumber2 = state.roundNumber + 1;
    const eastRounds2 = state.playerCount === 3 ? 3 : 4;
    const maxRound2 = state.endRound + state.playerCount;
    if (newRoundNumber2 > state.endRound && (topScore >= targetScore || newRoundNumber2 > maxRound2)) return finalizeGame(state);
    const newRoundWind2 = Math.floor((newRoundNumber2 - 1) / eastRounds2);
    return newRound(state, newDealer2, newRoundNumber2, newRoundWind2, state.honba + 1);
  }
  const newDealer = (state.dealer + 1) % state.playerCount;
  const newRoundNumber = state.roundNumber + 1;
  const eastRounds = state.playerCount === 3 ? 3 : 4;
  const maxRound = state.endRound + state.playerCount;
  if (newRoundNumber > state.endRound && (topScore >= targetScore || newRoundNumber > maxRound)) return finalizeGame(state);
  const newRoundWind = Math.floor((newRoundNumber - 1) / eastRounds);
  return newRound(state, newDealer, newRoundNumber, newRoundWind, 0);
}
function newRound(state, dealer, roundNumber, roundWind, honba) {
  const wall = createWall(state.playerCount);
  const { hands, akaInHand } = dealHaipai(wall, state.playerCount);
  const makePlayer = (hand, oldPlayer, idx) => ({
    ...oldPlayer,
    hand: hand.sort((a, b) => a - b),
    melds: [],
    discards: [],
    riichi: false,
    riichiTurn: 0,
    isMenzen: true,
    kitaCount: 0,
    akaCount: akaInHand[idx].length,
    akaInHand: akaInHand[idx].slice(),
    akaInMelds: [],
    daburii: false,
    ippatsuEligible: false,
    nagashiEligible: true
  });
  return {
    playerCount: state.playerCount,
    endRound: state.endRound,
    wall: wall.tiles,
    wallIndex: wall.drawIndex,
    rinshanIndex: wall.rinshanIndex,
    akaPositions: wall.akaPositions,
    doraMarkers: getDoraMarkers(wall),
    pendingKanDora: 0,
    players: hands.map((h, i) => makePlayer(h, state.players[i], i)),
    currentPlayer: dealer,
    dealer,
    roundWind,
    roundNumber,
    honba,
    kyotaku: state.kyotaku,
    phase: "draw",
    turnCount: 0,
    lastDiscard: null,
    lastDiscardPlayer: null,
    lastDrawnTile: null,
    lastDrawnAka: false,
    ippatsu: false,
    koyakuMode: state.koyakuMode,
    sanwahou: state.sanwahou,
    paoTarget: null,
    ryukyokuReason: void 0
  };
}
export {
  ActionKind,
  Suit,
  applyAction,
  applyTsumo,
  calculateFu,
  calculatePoints,
  calculateShanten,
  checkTobi,
  createGame,
  createWall,
  dealHaipai,
  decomposeWinningHand,
  drawRinshan,
  drawTile,
  evaluateWin,
  evaluateYaku,
  finalRanking,
  getDoraMarkers,
  getUraDoraMarkers,
  getValidActions,
  isPermanentFuriten,
  isWinningHand,
  nextRound,
  previewWin,
  remainingTiles
};
