import {
  ActionKind, applyAction, calculatePoints, calculateShanten, createGame, evaluateWin,
  finalRanking, isPermanentFuriten, isWinningHand, nextRound, previewWin, remainingTiles
} from '../vendor/sanma-core/browser.js';

const HUMAN = 0;
const RON_HONBA = 300;

function actionCode(action) {
  if (action.kind === ActionKind.Discard) return `${action.tile}${action.aka ? 'r' : ''}`;
  if (action.kind === ActionKind.Riichi) return `${action.tile}${action.aka ? 'r' : ''}`;
  if ([ActionKind.Ankan, ActionKind.Kakan].includes(action.kind)) return `${action.kind}:${action.tile}`;
  if ([ActionKind.Pon, ActionKind.Daiminkan].includes(action.kind)) return `${action.kind}:${action.called}`;
  return action.kind;
}

function discardVariants(player, kind, tile) {
  const hasAka = (player.akaInHand || []).includes(tile);
  if (!hasAka) return [{ kind, tile }];
  const copies = player.hand.filter(value => value === tile).length;
  if (copies > 1) return [{ kind, tile, aka: false }, { kind, tile, aka: true }];
  return [{ kind, tile, aka: true }];
}

function discardShanten(state, player, tile) {
  const hand = [...state.players[player].hand];
  hand.splice(hand.indexOf(tile), 1);
  return calculateShanten(hand, state.players[player].melds.length);
}

function waitTiles(hand) {
  const waits = [];
  for (let tile = 0; tile < 34; tile += 1) {
    if (tile >= 1 && tile <= 7) continue;
    if (hand.filter(value => value === tile).length >= 4) continue;
    if (isWinningHand([...hand, tile])) waits.push(tile);
  }
  return waits;
}

function legalRiichiAnkan(state, player, tile) {
  if (!player.riichi || state.lastDrawnTile !== tile) return false;
  if (player.hand.filter(value => value === tile).length !== 4) return false;
  const before = [...player.hand];
  before.splice(before.lastIndexOf(tile), 1);
  const after = player.hand.filter(value => value !== tile);
  return waitTiles(before).join(',') === waitTiles(after).join(',');
}

function chooseTurnAction(state) {
  const actions = validTurnActions(state);
  const byKind = kind => actions.filter(action => action.kind === kind);
  if (byKind(ActionKind.Tsumo)[0]) return byKind(ActionKind.Tsumo)[0];
  if (byKind(ActionKind.Kita)[0]) return byKind(ActionKind.Kita)[0];
  if (byKind(ActionKind.Ankan)[0]) return byKind(ActionKind.Ankan)[0];
  if (byKind(ActionKind.Kakan)[0]) return byKind(ActionKind.Kakan)[0];
  const riichi = byKind(ActionKind.Riichi).sort((a, b) => discardShanten(state, state.currentPlayer, a.tile) - discardShanten(state, state.currentPlayer, b.tile))[0];
  if (riichi) return riichi;
  return byKind(ActionKind.Discard).sort((a, b) => discardShanten(state, state.currentPlayer, a.tile) - discardShanten(state, state.currentPlayer, b.tile))[0];
}

function validTurnActions(state) {
  // getValidActions is intentionally reached through applyAction's public
  // surface in the bundle; derive the small discard-phase set locally so the
  // session can attach stable UI codes without leaking upstream objects.
  const player = state.players[state.currentPlayer];
  const wall = {
    tiles: state.wall,
    drawIndex: state.wallIndex,
    rinshanIndex: state.rinshanIndex,
    doraCount: state.doraMarkers.length,
    akaPositions: state.akaPositions || new Set(),
    playerCount: state.playerCount
  };
  const liveRemaining = remainingTiles(wall);
  const usedReplacements = state.wall.length - 1 - state.rinshanIndex;
  const canTakeReplacement = liveRemaining > 0 && usedReplacements < 8;
  const forbidden = new Set(state.kuikae || []);
  const discardTiles = player.riichi ? [state.lastDrawnTile] : [...new Set(player.hand)];
  const actions = discardTiles
    .filter(tile => tile != null && !forbidden.has(tile))
    .flatMap(tile => discardVariants(player, ActionKind.Discard, tile));
  if (state.lastDrawnTile != null && isWinningHand(player.hand) && previewWin(state, state.currentPlayer, true, state.lastDrawnTile)) actions.push({ kind: ActionKind.Tsumo });
  if (player.isMenzen && !player.riichi && player.score >= 1000 && liveRemaining >= state.playerCount) {
    for (const tile of new Set(player.hand)) {
      if (discardShanten(state, state.currentPlayer, tile) === 0) {
        actions.push(...discardVariants(player, ActionKind.Riichi, tile));
      }
    }
  }
  if (!player.riichi && canTakeReplacement) {
    for (const tile of new Set(player.hand)) if (player.hand.filter(value => value === tile).length === 4) actions.push({ kind: ActionKind.Ankan, tile });
    for (const meld of player.melds) if (meld.type === 'pon' && player.hand.includes(meld.tiles[0])) actions.push({ kind: ActionKind.Kakan, tile: meld.tiles[0] });
  } else if (canTakeReplacement) {
    for (const tile of new Set(player.hand)) if (legalRiichiAnkan(state, player, tile)) actions.push({ kind: ActionKind.Ankan, tile });
  }
  if (canTakeReplacement && state.lastDrawnTile != null && player.hand.includes(30)
      && (!player.riichi || state.lastDrawnTile === 30)) actions.push({ kind: ActionKind.Kita });
  const terminals = new Set(player.hand.filter(tile => [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33].includes(tile)));
  if (player.discards.length === 0 && state.players.every(item => item.melds.length === 0) && terminals.size >= 9) actions.push({ kind: ActionKind.Kyushukyuhai });
  return actions;
}

function sourcePlayer(state) {
  if (state.phase === 'kita_declare') return state.currentPlayer;
  if (state.chankan) return state.chankan.kaker;
  return state.lastDiscardPlayer;
}

function responseTile(state) {
  if (state.phase === 'kita_declare') return 30;
  if (state.chankan) return state.chankan.tile;
  return state.lastDiscard;
}

function ronWinners(state, temporaryFuriten) {
  const loser = sourcePlayer(state);
  const tile = responseTile(state);
  if (loser == null || tile == null) return [];
  const winners = [];
  for (let offset = 1; offset < state.playerCount; offset += 1) {
    const player = (loser + offset) % state.playerCount;
    const hand = state.players[player];
    if (temporaryFuriten[player] || isPermanentFuriten(hand)) continue;
    if (isWinningHand([...hand.hand, tile]) && previewWin(state, player, false, tile)) winners.push(player);
  }
  return winners;
}

function callCandidates(state, actor) {
  if (state.phase !== 'respond' || state.chankan || actor === state.lastDiscardPlayer) return [];
  const wall = {
    tiles: state.wall,
    drawIndex: state.wallIndex,
    rinshanIndex: state.rinshanIndex,
    doraCount: state.doraMarkers.length,
    akaPositions: state.akaPositions || new Set(),
    playerCount: state.playerCount
  };
  if (remainingTiles(wall) <= 0) return [];
  const tile = state.lastDiscard;
  const player = state.players[actor];
  if (player.riichi || tile == null) return [];
  const count = player.hand.filter(value => value === tile).length;
  const calls = [];
  if (count === 3) calls.push({ kind: ActionKind.Daiminkan, called: tile, actor });
  if (count >= 2) calls.push({ kind: ActionKind.Pon, called: tile, actor });
  return calls;
}

function callDistance(state, actor) {
  return (actor + state.playerCount - state.lastDiscardPlayer) % state.playerCount;
}

function bestAiCall(state) {
  const discarder = state.lastDiscardPlayer;
  for (let offset = 1; offset < state.playerCount; offset += 1) {
    const actor = (discarder + offset) % state.playerCount;
    if (actor === HUMAN) continue;
    const baseline = calculateShanten(state.players[actor].hand, state.players[actor].melds.length);
    for (const action of callCandidates(state, actor)) {
      if (action.kind === ActionKind.Daiminkan) return action;
      const hand = [...state.players[actor].hand];
      hand.splice(hand.indexOf(action.called), 1);
      hand.splice(hand.indexOf(action.called), 1);
      const after = calculateShanten(hand, state.players[actor].melds.length + 1);
      if (after < baseline) return action;
    }
  }
  return null;
}

export function settleSanmaRon(state, winners) {
  const loser = sourcePlayer(state);
  const tile = responseTile(state);
  const scores = state.players.map(player => player.score);
  const details = [];
  winners.forEach((winner, index) => {
    const result = evaluateWin(state, winner, false, tile);
    const basePayment = result.scoreResult.ronPayment;
    const honbaPayment = state.honba * RON_HONBA;
    const payment = basePayment + honbaPayment;
    const hasPaoYaku = result.yakuList.some(yaku => yaku.name === 'daisangen' || yaku.name === 'daisuushii');
    const pao = state.paoTarget != null && hasPaoYaku ? state.paoTarget : null;
    if (pao != null) {
      const paoPayment = calculatePoints({
        han: 13, fu: 0, isDealer: winner === state.dealer, isTsumo: false, playerCount: 3
      }).ronPayment;
      const paoShare = Math.floor(paoPayment / 2);
      scores[loser] -= basePayment - (paoPayment - paoShare);
      scores[pao] -= paoPayment - paoShare + honbaPayment;
    } else {
      scores[loser] -= payment;
    }
    scores[winner] += payment + (index === 0 ? state.kyotaku * 1000 : 0);
    details.push({ winner, loser, pao, ...result, payment });
  });
  const dealerWinner = winners.includes(state.dealer);
  return {
    state: {
      ...state,
      players: state.players.map((player, index) => ({ ...player, score: scores[index] })),
      currentPlayer: dealerWinner ? state.dealer : winners[0],
      kyotaku: 0,
      phase: 'ron_win'
    },
    details
  };
}

function nagashiWinners(state) {
  const terminal = tile => tile >= 27 || [0, 8, 9, 17, 18, 26].includes(tile);
  return state.players.map((player, index) => ({ player, index }))
    .filter(({ player }) => player.nagashiEligible !== false
      && player.discards.length > 0
      && player.discards.every(discard => terminal(discard.tile)))
    .map(({ index }) => index);
}

function settleNagashi(before, after, winners) {
  const scores = before.players.map(player => player.score);
  for (const winner of winners) {
    let collected = 0;
    for (let payer = 0; payer < before.playerCount; payer += 1) {
      if (payer === winner) continue;
      const payment = winner === before.dealer ? 4000 : payer === before.dealer ? 4000 : 2000;
      const withHonba = payment + before.honba * 100;
      scores[payer] -= withHonba;
      collected += withHonba;
    }
    scores[winner] += collected;
  }
  return {
    ...after,
    players: after.players.map((player, index) => ({ ...player, score: scores[index] })),
    currentPlayer: winners.includes(before.dealer) ? before.dealer : winners[0],
    phase: 'tsumo_win'
  };
}

export class SanmaGameSession {
  constructor({ speed = 380, onEvent = () => {}, onDecision = () => {}, onComplete = () => {} } = {}) {
    this.mode = 'sanma';
    this.speed = speed;
    this.onEvent = onEvent;
    this.onDecision = onDecision;
    this.onComplete = onComplete;
    this.state = createGame({ playerCount: 3, endRound: 8, startDealer: Math.floor(Math.random() * 3) });
    this.temporaryFuriten = [false, false, false];
    this.human = { pending: null, _menfeng: 0 };
    this.waiters = [];
    this.timer = null;
    this.stopped = false;
    this.lastResult = null;
  }

  get model() { return this.state; }
  start() { this.emit('qipai'); this.schedule(); return this; }
  stop() { this.stopped = true; clearTimeout(this.timer); this.human.pending = null; }
  emit(type, payload = {}) { this.onEvent({ type, payload, model: this.state }); }
  request(kind, options, handler) {
    this.human.pending = { kind, options, payload: options };
    this.pendingHandler = handler;
    this.onDecision(this.human.pending);
    this.waiters.splice(0).forEach(resolve => resolve(this.human.pending));
  }
  waitForDecision() {
    if (this.human.pending) return Promise.resolve(this.human.pending);
    return new Promise(resolve => this.waiters.push(resolve));
  }
  submit(reply = {}) {
    if (!this.human.pending) throw new Error('当前没有等待中的玩家操作');
    const handler = this.pendingHandler;
    this.human.pending = null;
    this.pendingHandler = null;
    handler(reply);
    this.schedule(0);
  }
  schedule(delay = this.speed) {
    if (this.stopped || this.human.pending) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.advance(), delay);
  }

  advance() {
    if (this.stopped || this.human.pending) return;
    const phase = this.state.phase;
    if (phase === 'draw') {
      const actor = this.state.currentPlayer;
      const before = this.state;
      this.state = applyAction(this.state, { kind: ActionKind.Pass });
      if (this.state.phase === 'ryukyoku') {
        const winners = nagashiWinners(before);
        if (winners.length) {
          this.state = settleNagashi(before, this.state, winners);
          this.lastResult = { type: 'nagashi', winners: winners.map(winner => ({ winner, han: 5, fu: 0, yaku: [{ name: '流し満貫' }] })) };
        }
      }
      this.temporaryFuriten[actor] = this.state.players[actor].riichi ? this.temporaryFuriten[actor] : false;
      this.emit('zimo', { l: actor, p: this.state.lastDrawnTile });
      return this.schedule();
    }
    if (phase === 'discard') return this.handleDiscardTurn();
    if (phase === 'respond') return this.handleResponses();
    if (phase === 'kita_declare') return this.handleKita();
    if (['tsumo_win', 'ron_win', 'ryukyoku'].includes(phase)) return this.handleRoundEnd();
    if (phase === 'game_over') return this.handleGameOver();
    this.schedule();
  }

  handleDiscardTurn() {
    const actor = this.state.currentPlayer;
    const actions = validTurnActions(this.state);
    if (actor !== HUMAN) {
      const action = chooseTurnAction(this.state);
      return this.applyTurnAction(action);
    }
    const discards = actions.filter(action => action.kind === ActionKind.Discard);
    const riichi = actions.filter(action => action.kind === ActionKind.Riichi);
    const gang = actions.filter(action => [ActionKind.Ankan, ActionKind.Kakan].includes(action.kind));
    this.request('draw', {
      dapai: discards.map(actionCode),
      riichi: riichi.map(actionCode),
      gang: gang.map(actionCode),
      hule: actions.some(action => action.kind === ActionKind.Tsumo),
      kita: actions.some(action => action.kind === ActionKind.Kita),
      daopai: actions.some(action => action.kind === ActionKind.Kyushukyuhai)
    }, reply => {
      let action;
      if (reply.hule) action = actions.find(item => item.kind === ActionKind.Tsumo);
      else if (reply.kita) action = actions.find(item => item.kind === ActionKind.Kita);
      else if (reply.gang) action = actions.find(item => actionCode(item) === reply.gang);
      else if (reply.daopai) action = actions.find(item => item.kind === ActionKind.Kyushukyuhai);
      else if (reply.dapai) {
        const isRiichi = String(reply.dapai).endsWith('*');
        const code = String(reply.dapai).replace(/\*$/, '');
        action = actions.find(item => item.kind === (isRiichi ? ActionKind.Riichi : ActionKind.Discard) && actionCode(item) === code);
      }
      if (!action) throw new Error('非法三麻操作');
      this.applyTurnAction(action);
    });
  }

  applyTurnAction(action) {
    if (action.kind === ActionKind.Ankan) return this.handleAnkan(action);
    const actor = this.state.currentPlayer;
    this.state = applyAction(this.state, action);
    if (action.kind === ActionKind.Kita) this.kitaConfirmed = true;
    const eventType = action.kind === ActionKind.Discard || action.kind === ActionKind.Riichi ? 'dapai'
      : action.kind === ActionKind.Tsumo ? 'hule'
      : action.kind === ActionKind.Kita ? 'kita' : 'gang';
    this.emit(eventType, { l: actor, p: action.tile, action });
    this.schedule();
  }

  handleAnkan(action) {
    const original = this.state;
    const actor = original.currentPlayer;
    const responseState = { ...original, phase: 'respond', chankan: { tile: action.tile, kaker: actor } };
    const winners = [];
    for (let offset = 1; offset < original.playerCount; offset += 1) {
      const player = (actor + offset) % original.playerCount;
      const hand = original.players[player];
      if (this.temporaryFuriten[player] || isPermanentFuriten(hand)) continue;
      if (!isWinningHand([...hand.hand, action.tile])) continue;
      const result = evaluateWin(responseState, player, false, action.tile);
      if (result.yakuList?.some(yaku => yaku.name === 'kokushi')) winners.push(player);
    }
    const completeKan = () => {
      this.state = applyAction(original, action);
      this.emit('gang', { l: actor, p: action.tile, action });
    };
    if (!winners.length) {
      completeKan();
      return this.schedule();
    }
    if (winners.includes(HUMAN)) {
      this.state = responseState;
      return this.request('kan-response', { hule: true, fulou: [] }, reply => {
        if (reply.hule) return this.finishRon(winners);
        this.temporaryFuriten[HUMAN] = true;
        const aiWinners = winners.filter(player => player !== HUMAN);
        if (aiWinners.length) return this.finishRon(aiWinners);
        this.state = original;
        completeKan();
      });
    }
    this.state = responseState;
    this.finishRon(winners);
  }

  handleResponses() {
    const winners = ronWinners(this.state, this.temporaryFuriten);
    const humanCalls = callCandidates(this.state, HUMAN);
    const humanCanRon = winners.includes(HUMAN);
    const aiWinners = winners.filter(player => player !== HUMAN);
    const preferredAiCall = aiWinners.length ? null : bestAiCall(this.state);
    const humanHasCallPriority = humanCalls.length
      && (!preferredAiCall || callDistance(this.state, HUMAN) < callDistance(this.state, preferredAiCall.actor));
    // Ron has absolute priority over pon/daiminkan. Never let a human call
    // steal a discard that an AI opponent has already won on.
    if (!humanCanRon && aiWinners.length) return this.finishRon(aiWinners);
    if (humanCanRon || humanHasCallPriority) {
      this.request('discard-response', {
        hule: humanCanRon,
        fulou: humanHasCallPriority ? humanCalls.map(actionCode) : []
      }, reply => {
        if (reply.hule && humanCanRon) return this.finishRon(winners);
        if (humanCanRon) this.temporaryFuriten[HUMAN] = true;
        if (aiWinners.length) return this.finishRon(aiWinners);
        if (reply.fulou) {
          const action = humanCalls.find(item => actionCode(item) === reply.fulou);
          if (!action) throw new Error('非法三麻鸣牌');
          this.state = applyAction(this.state, action);
          this.emit('fulou', { l: HUMAN, m: reply.fulou });
          return;
        }
        const aiCall = preferredAiCall || bestAiCall(this.state);
        const completedKakan = Boolean(this.state.chankan) && !aiCall;
        this.state = applyAction(this.state, aiCall || { kind: ActionKind.Pass });
        this.emit(completedKakan ? 'zimo' : aiCall ? 'fulou' : 'pass', completedKakan
          ? { l: this.state.currentPlayer, p: this.state.lastDrawnTile }
          : aiCall || {});
      });
      return;
    }
    if (winners.length) return this.finishRon(winners);
    const aiCall = preferredAiCall || bestAiCall(this.state);
    const completedKakan = Boolean(this.state.chankan) && !aiCall;
    this.state = applyAction(this.state, aiCall || { kind: ActionKind.Pass });
    this.emit(completedKakan ? 'zimo' : aiCall ? 'fulou' : 'pass', completedKakan
      ? { l: this.state.currentPlayer, p: this.state.lastDrawnTile }
      : aiCall || {});
    this.schedule();
  }

  handleKita() {
    const declarer = this.state.currentPlayer;
    const winners = ronWinners(this.state, this.temporaryFuriten);
    const humanCanRon = declarer !== HUMAN && winners.includes(HUMAN);
    if (declarer === HUMAN && !this.kitaConfirmed) {
      return this.request('kita-choice', { kita: true, keep: true }, reply => {
        if (reply.kita) {
          this.kitaConfirmed = true;
          this.emit('kita', { l: HUMAN });
        }
        else this.state = { ...this.state, phase: 'discard' };
      });
    }
    if (humanCanRon) {
      return this.request('kan-response', { hule: true, fulou: [] }, reply => {
        if (reply.hule) return this.finishRon(winners);
        this.temporaryFuriten[HUMAN] = true;
        const aiWinners = winners.filter(player => player !== HUMAN);
        if (aiWinners.length) return this.finishRon(aiWinners);
        this.state = applyAction(this.state, { kind: ActionKind.Pass });
        this.kitaConfirmed = false;
      });
    }
    if (winners.length) return this.finishRon(winners);
    this.state = applyAction(this.state, { kind: ActionKind.Pass });
    this.kitaConfirmed = false;
    this.emit('kita', { l: declarer });
    this.schedule();
  }

  finishRon(winners) {
    const settled = settleSanmaRon(this.state, winners);
    this.state = settled.state;
    this.lastResult = { type: 'ron', winners: settled.details };
    this.emit('hule', this.lastResult);
    this.schedule(0);
  }

  handleRoundEnd() {
    if (!this.lastResult && this.state.phase === 'tsumo_win') {
      const winner = this.state.currentPlayer;
      this.lastResult = { type: 'tsumo', winners: [{ winner, ...evaluateWin(this.state, winner, true, this.state.lastDrawnTile) }] };
    }
    if (!this.lastResult && this.state.phase === 'ryukyoku') {
      this.lastResult = { type: 'ryukyoku', reason: this.state.ryukyokuReason || 'exhaustive' };
    }
    const drawNames = {
      exhaustive: '荒牌流局', kyushukyuhai: '九種九牌', suukaikan: '四開槓',
      suufonrenda: '四風連打', sanwahou: '三家和'
    };
    this.request('round-result', this.lastResult.type === 'ryukyoku'
      ? { pingju: { name: drawNames[this.lastResult.reason] || '流局' } }
      : { sanmaResult: this.lastResult }, () => {
      this.state = nextRound(this.state);
      this.temporaryFuriten = [false, false, false];
      this.lastResult = null;
      this.emit('qipai');
    });
  }

  handleGameOver() {
    const ranking = finalRanking(this.state);
    this.request('match-result', { ranking }, () => {
      this.stopped = true;
      this.onComplete({ ranking, defen: this.state.players.map(player => player.score) });
    });
  }
}
