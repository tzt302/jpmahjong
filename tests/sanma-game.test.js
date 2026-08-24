import test from 'node:test';
import assert from 'node:assert/strict';
import { SanmaGameSession, settleSanmaRon } from '../src/sanma-game.js';
import {
  ActionKind, applyAction, calculateFu, calculatePoints, createGame, createWall, drawRinshan,
  evaluateWin, getDoraMarkers, getUraDoraMarkers, getValidActions, nextRound
} from '../vendor/sanma-core/browser.js';

test('sanma scoring keeps standard fu and limit tiers', () => {
  const common = {
    winningTile: 2,
    melds: [],
    pair: 27,
    mentsu: [{ tiles: [0, 1, 2] }, { tiles: [9, 10, 11] }, { tiles: [18, 19, 20] }, { tiles: [23, 24, 25] }],
    seatWind: 1,
    roundWind: 0
  };
  assert.equal(calculateFu({ ...common, isTsumo: true, isPinhu: true }), 20);
  assert.equal(calculateFu({ ...common, isTsumo: false, isPinhu: true }), 30);
  assert.equal(calculateFu({ ...common, isTsumo: false, isPinhu: false, isChiitoi: true }), 25);
  assert.equal(calculatePoints({ han: 5, fu: 30, isDealer: false, isTsumo: false, playerCount: 3 }).ronPayment, 8000);
  assert.equal(calculatePoints({ han: 8, fu: 30, isDealer: true, isTsumo: false, playerCount: 3 }).ronPayment, 24000);
  assert.equal(calculatePoints({ han: 13, fu: 30, isDealer: false, isTsumo: false, playerCount: 3 }).ronPayment, 32000);
});

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

test('sanma dead wall has eight fixed replacement slots and stable dora pairs', () => {
  let wall = createWall(3);
  const visible = getDoraMarkers(wall)[0];
  const ura = getUraDoraMarkers(wall)[0];
  for (let draw = 0; draw < 8; draw += 1) {
    const result = drawRinshan({ ...wall, doraCount: 1 });
    assert.ok(result, `replacement draw ${draw + 1} should exist`);
    wall = { ...result.wall, doraCount: 1 };
    assert.equal(getDoraMarkers(wall)[0], visible);
    assert.equal(getUraDoraMarkers(wall)[0], ura);
  }
  assert.equal(drawRinshan(wall), null);
});

test('riichi win counts ippatsu and ura dora while aka tiles exist in the wall', () => {
  const wall = Array(108).fill(0);
  wall[98] = 17; // first ura indicator: 9p -> 1p
  wall[99] = 0;  // visible indicator does not match the hand
  const winningHand = [9, 10, 11, 12, 13, 14, 18, 19, 20, 21, 22, 23, 27, 27];
  let state = createGame({
    playerCount: 3,
    fixedWall: wall,
    fixedHands: [winningHand, Array(13).fill(28), Array(13).fill(29)]
  });
  state = {
    ...state,
    currentPlayer: 0,
    lastDrawnTile: 27,
    turnCount: 4,
    players: state.players.map((player, index) => index === 0
      ? { ...player, riichi: true, ippatsuEligible: true }
      : player)
  };
  const result = evaluateWin(state, 0, true, 27);
  assert.ok(result.yakuList.some(yaku => yaku.name === 'ippatsu'));
  assert.equal(result.doraCount, 1, 'the concealed ura indicator adds one dora');
  assert.deepEqual(result.doraBreakdown, { visible: 0, ura: 1, aka: 0, kita: 0 });
  assert.equal(createWall(3).akaPositions.size, 2, '5p and 5s each have one red copy');
});

test('a call cancels every active ippatsu window', () => {
  let state = createGame({ playerCount: 3 });
  state = {
    ...state,
    phase: 'respond',
    lastDiscard: 31,
    lastDiscardPlayer: 0,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === 1 ? [31, 31, ...player.hand.slice(2)] : player.hand,
      ippatsuEligible: index !== 1
    }))
  };
  state = applyAction(state, { kind: ActionKind.Pon, called: 31, actor: 1 });
  assert.deepEqual(state.players.map(player => player.ippatsuEligible), [false, false, false]);
});

test('kakan preserves ippatsu in the chankan window and delays kan dora until discard', () => {
  let state = createGame({ playerCount: 3 });
  const ippatsuWait = [10, 11, 12, 13, 14, 18, 19, 20, 27, 27, 31, 31, 31];
  state = {
    ...state,
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTile: 9,
    players: state.players.map((player, index) => index === 0 ? {
      ...player,
      hand: [9, ...player.hand.slice(0, 13)],
      melds: [{ type: 'pon', tiles: [9, 9, 9], calledFrom: 1 }],
      isMenzen: false
    } : index === 1 ? {
      ...player, hand: ippatsuWait, riichi: true, ippatsuEligible: true, isMenzen: true
    } : player)
  };
  const rinshanBefore = state.rinshanIndex;
  const doraBefore = state.doraMarkers.length;
  state = applyAction(state, { kind: ActionKind.Kakan, tile: 9 });
  assert.equal(state.phase, 'respond');
  assert.equal(state.rinshanIndex, rinshanBefore);
  assert.equal(state.doraMarkers.length, doraBefore);
  const robbed = evaluateWin(state, 1, false, 9);
  assert.ok(robbed.yakuList.some(yaku => yaku.name === 'chankan'));
  assert.ok(robbed.yakuList.some(yaku => yaku.name === 'ippatsu'));
  state = applyAction(state, { kind: ActionKind.Pass });
  assert.equal(state.phase, 'discard');
  assert.equal(state.rinshanIndex, rinshanBefore - 1);
  assert.equal(state.doraMarkers.length, doraBefore, 'kakan dora is not visible on the rinshan draw');
  assert.equal(state.pendingKanDora, 1);
  state = applyAction(state, { kind: ActionKind.Discard, tile: state.lastDrawnTile });
  assert.equal(state.doraMarkers.length, doraBefore + 1);
  assert.equal(state.pendingKanDora, 0);
});

test('ankan reveals its kan dora immediately', () => {
  let state = createGame({ playerCount: 3 });
  state = {
    ...state,
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTile: 9,
    players: state.players.map((player, index) => index === 0
      ? { ...player, hand: [9, 9, 9, 9, ...player.hand.slice(0, 10)] }
      : player)
  };
  const before = state.doraMarkers.length;
  state = applyAction(state, { kind: ActionKind.Ankan, tile: 9 });
  assert.equal(state.doraMarkers.length, before + 1);
  assert.equal(state.pendingKanDora, 0);
});

test('public sanma action surface enforces riichi tsumogiri and legal ankan', () => {
  let state = createGame({ playerCount: 3 });
  state = {
    ...state,
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTile: 9,
    players: state.players.map((player, index) => index === 0 ? {
      ...player,
      riichi: true,
      hand: [9, 9, 9, 9, 18, 19, 20, 21, 22, 23, 27, 27, 27, 28]
    } : player)
  };
  const actions = getValidActions(state);
  assert.deepEqual(actions.filter(action => action.kind === ActionKind.Discard).map(action => action.tile), [9]);
  assert.ok(actions.some(action => action.kind === ActionKind.Ankan && action.tile === 9));
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

test('AI ron takes priority over the human pon prompt', () => {
  const session = new SanmaGameSession({ speed: 0 });
  const winningHand = [12, 13, 14, 21, 22, 23, 15, 16, 17, 33, 33, 33, 32];
  session.state = {
    ...session.state,
    phase: 'respond',
    lastDiscard: 32,
    lastDiscardPlayer: 1,
    players: session.state.players.map((player, index) => ({
      ...player,
      hand: index === 0 ? [32, 32, ...player.hand.slice(2)] : index === 2 ? winningHand : player.hand,
      discards: index === 1 ? [{ tile: 32, tsumogiri: false }] : []
    }))
  };
  session.handleResponses();
  assert.equal(session.human.pending, null);
  assert.equal(session.state.phase, 'ron_win');
  assert.equal(session.lastResult.winners[0].winner, 2);
  session.stop();
});

test('sanma yakuman pao splits ron liability between discarder and responsible player', () => {
  const state = createGame({ playerCount: 3 });
  const daisangen = [9, 10, 11, 27, 31, 31, 31, 32, 32, 32, 33, 33, 33];
  const configured = {
    ...state,
    phase: 'respond',
    lastDiscard: 27,
    lastDiscardPlayer: 0,
    paoTarget: 2,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === 1 ? daisangen : player.hand,
      score: 35000,
      discards: index === 0 ? [{ tile: 27, tsumogiri: false }] : []
    }))
  };
  const result = settleSanmaRon(configured, [1]);
  assert.equal(result.details[0].pao, 2);
  assert.ok(result.state.players[0].score < 35000);
  assert.ok(result.state.players[2].score < 35000);
  assert.equal(result.state.players.reduce((sum, player) => sum + player.score, 0), 105000);
});

test('sanma yakuman pao charges the responsible player for the full tsumo', () => {
  const winningHand = [9, 10, 11, 27, 27, 31, 31, 31, 32, 32, 32, 33, 33, 33];
  let state = createGame({ playerCount: 3, startDealer: 1 });
  state = {
    ...state,
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTile: 27,
    paoTarget: 2,
    turnCount: 4,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === 0 ? winningHand : player.hand,
      score: 35000
    }))
  };
  const result = applyAction(state, { kind: ActionKind.Tsumo });
  assert.equal(result.phase, 'tsumo_win');
  assert.equal(result.players[1].score, 35000, 'non-responsible dealer pays nothing');
  assert.ok(result.players[2].score < 35000, 'pao player covers both normal shares');
  assert.equal(result.players.reduce((sum, player) => sum + player.score, 0), 105000);
});

test('south-three supports agari-yame and west extension below the return score', () => {
  const base = createGame({ playerCount: 3, endRound: 8 });
  const dealerWin = {
    ...base,
    phase: 'tsumo_win',
    dealer: 0,
    currentPlayer: 0,
    roundWind: 1,
    roundNumber: 6,
    players: base.players.map((player, index) => ({ ...player, score: [41000, 33000, 31000][index] }))
  };
  assert.equal(nextRound(dealerWin).phase, 'game_over');

  const childWin = {
    ...dealerWin,
    currentPlayer: 1,
    players: base.players.map((player, index) => ({ ...player, score: [39000, 36000, 30000][index] }))
  };
  const extension = nextRound(childWin);
  assert.equal(extension.phase, 'draw');
  assert.equal(extension.roundNumber, 7);
  assert.equal(extension.roundWind, 2);
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

test('abortive nine-terminals draw does not apply exhaustive-draw noten payments', () => {
  const state = createGame({ playerCount: 3 });
  const before = state.players.map(player => player.score);
  const result = applyAction({ ...state, phase: 'discard' }, { kind: ActionKind.Kyushukyuhai });
  assert.equal(result.phase, 'ryukyoku');
  assert.equal(result.ryukyokuReason, 'kyushukyuhai');
  assert.deepEqual(result.players.map(player => player.score), before);
  const continued = nextRound(result);
  assert.equal(continued.dealer, state.dealer);
  assert.equal(continued.roundNumber, state.roundNumber);
  assert.equal(continued.honba, state.honba + 1);
});

test('riichi player may ankan only when the drawn tile preserves the wait', () => {
  const session = new SanmaGameSession({ speed: 0 });
  session.state = {
    ...session.state,
    currentPlayer: 0,
    phase: 'discard',
    lastDrawnTile: 9,
    players: session.state.players.map((player, index) => index === 0 ? {
      ...player,
      riichi: true,
      hand: [9, 9, 9, 9, 18, 19, 20, 21, 22, 23, 27, 27, 27, 28]
    } : player)
  };
  session.handleDiscardTurn();
  assert.ok(session.human.pending.options.gang.includes('ankan:9'));
  session.stop();
});

test('kita is blocked immediately after pon and riichi may extract only a drawn North', () => {
  const session = new SanmaGameSession({ speed: 0 });
  const northHand = [9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27, 31, 31, 30];
  session.state = {
    ...session.state,
    currentPlayer: 0,
    phase: 'discard',
    lastDrawnTile: null,
    players: session.state.players.map((player, index) => index === 0
      ? { ...player, hand: northHand, melds: [{ type: 'pon', tiles: [32, 32, 32], calledFrom: 1 }], isMenzen: false }
      : player)
  };
  session.handleDiscardTurn();
  assert.equal(session.human.pending.options.kita, false);
  session.human.pending = null;

  session.state = {
    ...session.state,
    phase: 'discard',
    lastDrawnTile: 9,
    players: session.state.players.map((player, index) => index === 0
      ? { ...player, hand: northHand, melds: [], isMenzen: true, riichi: true }
      : player)
  };
  session.handleDiscardTurn();
  assert.equal(session.human.pending.options.kita, false);
  session.stop();
});

test('nagashi mangan replaces noten payments at exhaustive draw', () => {
  const session = new SanmaGameSession({ speed: 0 });
  const winnerIsDealer = session.state.dealer === 0;
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
  assert.equal(session.lastResult.winners[0].han, 5);
  assert.equal(session.state.phase, 'tsumo_win');
  assert.equal(session.state.players[0].score, 35000 + (winnerIsDealer ? 8000 : 6000));
  session.stop();
});

test('a called terminal is removed from the river and disqualifies nagashi mangan', () => {
  let state = createGame({ playerCount: 3 });
  state = {
    ...state,
    phase: 'respond',
    lastDiscard: 0,
    lastDiscardPlayer: 0,
    players: state.players.map((player, index) => ({
      ...player,
      hand: index === 1 ? [0, 0, 0, ...player.hand.slice(3)] : player.hand,
      discards: index === 0 ? [{ tile: 0, tsumogiri: false }] : [],
      nagashiEligible: true
    }))
  };
  state = applyAction(state, { kind: ActionKind.Daiminkan, called: 0, actor: 1 });
  assert.equal(state.players[0].discards.length, 0);
  assert.equal(state.players[0].nagashiEligible, false);
});

test('regular and red five are separate discard choices and preserve red metadata', () => {
  const base = createGame({ playerCount: 3 });
  const hand = [9, 10, 11, 12, 13, 13, 14, 18, 19, 20, 27, 27, 28, 29];
  const state = {
    ...base,
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTile: 29,
    lastDrawnAka: false,
    players: base.players.map((player, index) => index === 0 ? {
      ...player,
      hand,
      akaInHand: [13],
      akaInMelds: [],
      akaCount: 1
    } : player)
  };
  const choices = getValidActions(state).filter(action => action.kind === ActionKind.Discard && action.tile === 13);
  assert.deepEqual(choices.map(action => Boolean(action.aka)), [false, true]);

  const regular = applyAction(state, choices.find(action => !action.aka));
  assert.equal(regular.players[0].akaCount, 1);
  assert.equal(regular.players[0].discards.at(-1).aka, false);

  const red = applyAction(state, choices.find(action => action.aka));
  assert.equal(red.players[0].akaCount, 0);
  assert.equal(red.players[0].discards.at(-1).aka, true);
});

test('last live-wall draw cannot declare riichi, kita, kan, pon or daiminkan', () => {
  const base = createGame({ playerCount: 3 });
  const finalDrawIndex = base.wall.length - 18;
  const tenpaiHand = [9, 10, 11, 18, 19, 20, 21, 22, 23, 27, 27, 31, 31, 30];
  const finalTurn = {
    ...base,
    phase: 'discard',
    currentPlayer: 0,
    wallIndex: finalDrawIndex,
    lastDrawnTile: 30,
    players: base.players.map((player, index) => index === 0
      ? { ...player, hand: tenpaiHand, isMenzen: true, score: 35000 }
      : player)
  };
  const actions = getValidActions(finalTurn);
  assert.equal(actions.some(action => action.kind === ActionKind.Riichi), false);
  assert.equal(actions.some(action => action.kind === ActionKind.Kita), false);

  const kanTurn = {
    ...finalTurn,
    lastDrawnTile: 9,
    players: finalTurn.players.map((player, index) => index === 0
      ? { ...player, hand: [9, 9, 9, 9, 18, 19, 20, 21, 22, 23, 27, 27, 31, 31] }
      : player)
  };
  assert.equal(getValidActions(kanTurn).some(action => action.kind === ActionKind.Ankan), false);

  const response = {
    ...base,
    phase: 'respond',
    wallIndex: finalDrawIndex,
    lastDiscard: 31,
    lastDiscardPlayer: 1,
    players: base.players.map((player, index) => index === 0
      ? { ...player, hand: [31, 31, ...player.hand.slice(2)] }
      : index === 2 ? { ...player, hand: [31, 31, 31, ...player.hand.slice(3)] } : player)
  };
  const responses = getValidActions(response);
  assert.equal(responses.some(action => action.kind === ActionKind.Pon), false);
  assert.equal(responses.some(action => action.kind === ActionKind.Daiminkan), false);
});

test('nearest sanma caller has priority when two players can call the same discard', () => {
  const session = new SanmaGameSession({ speed: 0 });
  session.state = {
    ...session.state,
    phase: 'respond',
    lastDiscard: 31,
    lastDiscardPlayer: 1,
    players: session.state.players.map((player, index) => ({
      ...player,
      hand: index === 0
        ? [31, 31, 9, 10, 12, 14, 16, 18, 20, 22, 27, 28, 29]
        : index === 2
          ? [31, 31, 31, 9, 11, 13, 15, 17, 19, 21, 23, 28, 30]
          : player.hand,
      discards: index === 1 ? [{ tile: 31, tsumogiri: false }] : []
    }))
  };
  session.handleResponses();
  assert.equal(session.human.pending, null, 'farther human may not pre-empt the nearer caller');
  assert.equal(session.state.currentPlayer, 2);
  assert.equal(session.state.players[2].melds.at(-1).type, 'daiminkan');
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
