import { createWall, shuffle, isWinningHand, analyzeDiscards } from './engine.js';

export const WINDS = ['東', '南', '西', '北'];

export function createGame(random = Math.random, playerCount = 4) {
  if (![3, 4].includes(playerCount)) throw new Error('仅支持三麻或四麻');
  const tiles = createWall(4).filter(tile => playerCount === 4 || tile === 0 || tile >= 8);
  const wall = shuffle(tiles, random);
  const hands = Array.from({ length: playerCount }, () => []);
  for (let round = 0; round < 13; round += 1) {
    for (let player = 0; player < playerCount; player += 1) hands[player].push(wall.pop());
  }
  hands.forEach(hand => hand.sort((a, b) => a - b));
  const game = { playerCount, wall, hands, rivers: Array.from({ length: playerCount }, () => []), melds: Array.from({ length: playerCount }, () => []), pendingCall: null, current: 0, drawn: null, phase: 'playing', winner: null };
  drawForCurrent(game);
  return game;
}

export function drawForCurrent(game) {
  if (!game.wall.length) {
    game.phase = 'draw';
    return null;
  }
  const tile = game.wall.pop();
  game.hands[game.current].push(tile);
  game.drawn = tile;
  return tile;
}

export function discard(game, index, { deferAdvance = false } = {}) {
  if (game.phase !== 'playing') throw new Error('牌局已经结束');
  const hand = game.hands[game.current];
  const expectedLength = 14 - game.melds[game.current].length * 3;
  if (hand.length !== expectedLength || index < 0 || index >= hand.length) throw new Error('无效的切牌');
  const [tile] = hand.splice(index, 1);
  hand.sort((a, b) => a - b);
  game.rivers[game.current].push(tile);
  if (deferAdvance) {
    game.pendingCall = { player: game.current, tile };
    game.drawn = null;
    return tile;
  }
  game.current = (game.current + 1) % game.playerCount;
  game.drawn = null;
  drawForCurrent(game);
  return tile;
}

export function getHumanCallOptions(game) {
  const pending = game.pendingCall;
  const result = { chi: [], pon: false, kan: false };
  if (!pending || pending.player === 0) return result;
  const tile = pending.tile;
  const hand = game.hands[0];
  const count = hand.filter(value => value === tile).length;
  result.pon = count >= 2;
  result.kan = count >= 3;
  if (pending.player === game.playerCount - 1 && tile < 27) {
    const suitStart = Math.floor(tile / 9) * 9;
    for (let start = tile - 2; start <= tile; start += 1) {
      const sequence = [start, start + 1, start + 2];
      if (start < suitStart || start + 2 >= suitStart + 9) continue;
      const needed = sequence.filter(value => value !== tile);
      if (needed.every(value => hand.includes(value))) result.chi.push(sequence);
    }
  }
  return result;
}

function removeTiles(hand, tiles) {
  tiles.forEach(tile => hand.splice(hand.indexOf(tile), 1));
  hand.sort((a, b) => a - b);
}

export function claimHumanCall(game, type) {
  const pending = game.pendingCall;
  const options = getHumanCallOptions(game);
  if (!pending || (type === 'chi' && !options.chi.length) || (type === 'pon' && !options.pon) || (type === 'kan' && !options.kan)) throw new Error('当前不能鸣牌');
  const tile = pending.tile;
  const tiles = type === 'chi' ? options.chi[0] : Array(type === 'kan' ? 4 : 3).fill(tile);
  const fromHand = [...tiles];
  fromHand.splice(fromHand.indexOf(tile), 1);
  removeTiles(game.hands[0], fromHand);
  game.rivers[pending.player].pop();
  game.melds[0].push({ type, tiles, from: pending.player });
  game.pendingCall = null;
  game.current = 0;
  game.drawn = null;
  if (type === 'kan') drawForCurrent(game);
  return game.melds[0].at(-1);
}

export function skipHumanCall(game) {
  if (!game.pendingCall) return;
  game.current = (game.pendingCall.player + 1) % game.playerCount;
  game.pendingCall = null;
  drawForCurrent(game);
}

export function canTsumo(game) {
  return game.phase === 'playing' && isWinningHand(game.hands[game.current]);
}

export function declareTsumo(game) {
  if (!canTsumo(game)) throw new Error('当前手牌不能自摸');
  game.phase = 'won';
  game.winner = game.current;
  return game.winner;
}

export function chooseBotDiscard(game) {
  const hand = game.hands[game.current];
  const visibleTiles = game.rivers.flat();
  const recommendation = analyzeDiscards(hand, visibleTiles, 4)[0];
  if (!recommendation) return hand.length - 1;
  const drawnIndex = hand.lastIndexOf(recommendation.discard);
  return drawnIndex >= 0 ? drawnIndex : hand.length - 1;
}
