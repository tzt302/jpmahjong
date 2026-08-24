import test from 'node:test';
import assert from 'node:assert/strict';
import { SanmaGameSession, settleSanmaRon } from '../src/sanma-game.js';
import { ActionKind, applyAction, createGame } from '../vendor/sanma-core/browser.js';

function automaticReply(decision) {
  if (decision.kind === 'draw') {
    if (decision.options.hule) return { hule: '-' };
    if (decision.options.kita) return { kita: true };
    if (decision.options.gang.length) return { gang: decision.options.gang[0] };
    const discard = decision.options.dapai.at(-1);
    return { dapai: decision.options.riichi.includes(discard) ? `${discard}*` : discard };
  }
  if (decision.kind === 'discard-response' || decision.kind === 'kan-response') {
    if (decision.options.hule) return { hule: '-' };
    return {};
  }
  if (decision.kind === 'kita-choice') return { kita: true };
  return {};
}

test('sanma session starts with the standard 108-tile set and 35,000 points', () => {
  const session = new SanmaGameSession({ speed: 0 });
  assert.equal(session.state.players.length, 3);
  assert.equal(session.state.wall.length, 108);
  assert.deepEqual(session.state.players.map(player => player.score), [35000, 35000, 35000]);
  assert.equal(session.state.wall.some(tile => tile >= 1 && tile <= 7), false);
  session.stop();
});

test('nuki draws a replacement without revealing an extra dora indicator', () => {
  let state = createGame({ playerCount: 3 });
  const wall = [...state.wall];
  wall[state.wallIndex] = 30;
  state = applyAction({ ...state, wall }, { kind: ActionKind.Pass });
  assert.equal(state.phase, 'kita_declare');
  const indicators = state.doraMarkers.length;
  state = applyAction(state, { kind: ActionKind.Pass });
  assert.equal(state.players[state.currentPlayer].kitaCount, 1);
  assert.equal(state.doraMarkers.length, indicators);
});

test('double ron charges the discarder for both winners and awards one riichi pot', () => {
  const state = createGame({ playerCount: 3 });
  const winnerOne = [9, 10, 11, 18, 19, 20, 27, 27, 27, 31, 31, 31, 32];
  const winnerTwo = [12, 13, 14, 21, 22, 23, 15, 16, 17, 33, 33, 33, 32];
  const configured = {
    ...state,
    dealer: 1,
    phase: 'respond',
    lastDiscard: 32,
    lastDiscardPlayer: 0,
    kyotaku: 1,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === 1 ? winnerOne : index === 2 ? winnerTwo : player.hand,
      score: 35000,
      discards: index === 0 ? [{ tile: 32, tsumogiri: false }] : []
    }))
  };
  const result = settleSanmaRon(configured, [1, 2]);
  assert.equal(result.details.length, 2);
  assert.equal(result.state.currentPlayer, 1, 'dealer winner keeps the dealership');
  assert.equal(result.state.kyotaku, 0);
  assert.ok(result.state.players[0].score < 35000);
  assert.ok(result.state.players[1].score > result.state.players[2].score, 'nearest winner receives the riichi pot');
  assert.equal(result.state.players.reduce((sum, player) => sum + player.score, 0), 106000);
});

test('kokushi may rob a concealed kan in sanma', () => {
  const session = new SanmaGameSession({ speed: 0 });
  const kokushiWait = [8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33];
  session.state = {
    ...session.state,
    currentPlayer: 1,
    phase: 'discard',
    players: session.state.players.map((player, index) => ({
      ...player,
      hand: index === 0 ? kokushiWait : index === 1 ? [0, 0, 0, 0, 9, 10, 11, 18, 19, 20, 27, 27, 31, 31] : player.hand,
      discards: []
    }))
  };
  session.handleAnkan({ kind: ActionKind.Ankan, tile: 0 });
  assert.equal(session.human.pending.kind, 'kan-response');
  assert.equal(session.human.pending.options.hule, true);
  session.submit({ hule: '-' });
  assert.equal(session.state.phase, 'ron_win');
  assert.equal(session.lastResult.winners[0].winner, 0);
  session.stop();
});

test('nine terminals and honors is exposed on the first draw', () => {
  const session = new SanmaGameSession({ speed: 0 });
  session.state = {
    ...session.state,
    currentPlayer: 0,
    phase: 'discard',
    players: session.state.players.map((player, index) => index === 0 ? {
      ...player,
      hand: [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33, 33],
      discards: []
    } : { ...player, melds: [] })
  };
  session.handleDiscardTurn();
  assert.equal(session.human.pending.options.daopai, true);
  session.stop();
});

test('nagashi mangan replaces noten payments at exhaustive draw', () => {
  const session = new SanmaGameSession({ speed: 0 });
  session.state = {
    ...session.state,
    phase: 'draw',
    wallIndex: session.state.wall.length - 14,
    players: session.state.players.map((player, index) => ({
      ...player,
      score: 35000,
      discards: index === 0 ? [{ tile: 0, tsumogiri: false }, { tile: 27, tsumogiri: false }] : [{ tile: 10, tsumogiri: false }]
    }))
  };
  session.advance();
  assert.equal(session.lastResult.type, 'nagashi');
  assert.equal(session.state.phase, 'tsumo_win');
  assert.ok(session.state.players[0].score > 35000);
  session.stop();
});

test('sanma human decisions can drive a complete hanchan', { timeout: 30000 }, async () => {
  let completed = null;
  const session = new SanmaGameSession({ speed: 0, onComplete: result => { completed = result; } }).start();
  for (let decisions = 0; decisions < 2000 && !completed; decisions += 1) {
    const decision = await session.waitForDecision();
    session.submit(automaticReply(decision));
  }
  assert.ok(completed, 'the sanma hanchan should reach game_over');
  assert.equal(completed.ranking.length, 3);
  assert.equal(completed.defen.length, 3);
});
