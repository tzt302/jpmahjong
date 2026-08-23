import { createWall, shuffle, isWinningHand, analyzeDiscards } from './engine.js';

export const WINDS = ['東', '南', '西', '北'];

export function createGame(random = Math.random) {
  const wall = shuffle(createWall(4), random);
  const hands = [[], [], [], []];
  for (let round = 0; round < 13; round += 1) {
    for (let player = 0; player < 4; player += 1) hands[player].push(wall.pop());
  }
  hands.forEach(hand => hand.sort((a, b) => a - b));
  const game = { wall, hands, rivers: [[], [], [], []], current: 0, drawn: null, phase: 'playing', winner: null };
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

export function discard(game, index) {
  if (game.phase !== 'playing') throw new Error('牌局已经结束');
  const hand = game.hands[game.current];
  if (hand.length !== 14 || index < 0 || index >= hand.length) throw new Error('无效的切牌');
  const [tile] = hand.splice(index, 1);
  game.rivers[game.current].push(tile);
  game.current = (game.current + 1) % 4;
  game.drawn = null;
  drawForCurrent(game);
  return tile;
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
