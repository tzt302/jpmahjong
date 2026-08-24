import { Majiang, createStandardRule } from './riichi-core.js';

export function chooseCoreDiscard(player, hand = player.shoupai) {
  const legal = player.get_dapai(hand) || [];
  let best = legal.at(-1);
  let bestScore = [Infinity, Infinity];
  for (const tile of legal) {
    const next = hand.clone().dapai(tile);
    const shanten = Majiang.Util.xiangting(next);
    const waits = shanten === 0 ? Majiang.Util.tingpai(next).length : 0;
    const score = [shanten, -waits];
    if (score[0] < bestScore[0] || (score[0] === bestScore[0] && score[1] < bestScore[1])) {
      best = tile;
      bestScore = score;
    }
  }
  return best;
}

function bestImprovingCall(player, discard) {
  const direction = '_+=-'[(4 + discard.l - player._menfeng) % 4];
  const callTile = discard.p.slice(0, 2) + direction;
  const candidates = [
    ...(player.get_gang_mianzi(player.shoupai, callTile) || []),
    ...(player.get_peng_mianzi(player.shoupai, callTile) || []),
    ...(player.get_chi_mianzi(player.shoupai, callTile) || [])
  ];
  const baseline = Majiang.Util.xiangting(player.shoupai);
  let best = null;
  for (const meld of candidates) {
    const called = player.shoupai.clone().fulou(meld);
    const isKan = meld.replace(/[^0-9]/g, '').length === 4;
    const shanten = isKan
      ? Majiang.Util.xiangting(called)
      : Math.min(...(player.get_dapai(called) || []).map(tile => Majiang.Util.xiangting(called.clone().dapai(tile))));
    if (shanten < baseline && (!best || shanten < best.shanten)) best = { meld, shanten };
  }
  return best?.meld || null;
}

function relativeDiscardTile(discard, menfeng) {
  const direction = '_+=-'[(4 + discard.l - menfeng) % 4];
  return discard.p.slice(0, 2) + direction;
}

function robbedKanTile(gang, menfeng) {
  const direction = '_+=-'[(4 + gang.l - menfeng) % 4];
  return gang.m[0] + (gang.m.match(/\d(?=[^\d]*$)/)?.[0] || '5') + direction;
}

export class AutoPlayer extends Majiang.Player {
  respond(reply = {}) { this._callback?.(reply); }
  action_kaiju() { this.respond(); }
  action_qipai() { this.respond(); }
  action_zimo(zimo, gangzimo) {
    if (zimo.l !== this._menfeng) return this.respond();
    if (this.allow_hule(this.shoupai, null, gangzimo ? 'lingshang' : null)) return this.respond({ hule: '-' });
    const gang = (this.get_gang_mianzi(this.shoupai, null) || [])[0];
    if (gang && !this.shoupai.lizhi) return this.respond({ gang });
    const tile = chooseCoreDiscard(this);
    const riichi = tile && this.allow_lizhi(this.shoupai, tile);
    this.respond({ dapai: tile + (riichi ? '*' : '') });
  }
  action_dapai(dapai) {
    if (dapai.l !== this._menfeng && this.allow_hule(this.shoupai, relativeDiscardTile(dapai, this._menfeng))) return this.respond({ hule: '-' });
    if (dapai.l !== this._menfeng && !this.shoupai.lizhi) {
      const fulou = bestImprovingCall(this, dapai);
      if (fulou) return this.respond({ fulou });
    }
    this.respond();
  }
  action_fulou() { this.respond({ dapai: chooseCoreDiscard(this) }); }
  action_gang(gang) {
    if (gang.l !== this._menfeng && this.allow_hule(this.shoupai, robbedKanTile(gang, this._menfeng), 'qianggang')) return this.respond({ hule: '-' });
    this.respond();
  }
  action_hule() { this.respond(); }
  action_pingju() { this.respond(); }
  action_jieju() { this.respond(); }
}

export class InteractivePlayer extends Majiang.Player {
  constructor({ onEvent = () => {}, onDecision = () => {} } = {}) {
    super();
    this.onEvent = onEvent;
    this.onDecision = onDecision;
    this.pending = null;
    this.waiters = [];
  }

  respond(reply = {}) { this._callback?.(reply); }
  emit(type, payload) { this.onEvent({ type, payload, model: this.model }); }
  request(kind, options, payload) {
    this.pending = { kind, options, payload };
    this.onDecision(this.pending);
    this.waiters.splice(0).forEach(resolve => resolve(this.pending));
  }
  waitForDecision() {
    if (this.pending) return Promise.resolve(this.pending);
    return new Promise(resolve => this.waiters.push(resolve));
  }
  submit(reply = {}) {
    if (!this.pending) throw new Error('当前没有等待中的玩家操作');
    const { options } = this.pending;
    if (reply.hule && !options.hule) throw new Error('当前不能和牌');
    if (reply.daopai && !options.daopai) throw new Error('当前不能九种九牌');
    if (reply.dapai && !options.dapai.includes(reply.dapai.replace(/\*$/, ''))) throw new Error('非法切牌');
    if (reply.dapai?.endsWith('*') && !options.riichi.includes(reply.dapai.replace(/\*$/, ''))) throw new Error('当前不能立直');
    if (reply.gang && !options.gang.includes(reply.gang)) throw new Error('非法杠牌');
    if (reply.fulou && !options.fulou.includes(reply.fulou)) throw new Error('非法鸣牌');
    this.pending = null;
    this.respond(reply);
  }

  action_kaiju(data) { this.emit('kaiju', data); this.respond(); }
  action_qipai(data) { this.emit('qipai', data); this.respond(); }
  action_zimo(data, gangzimo) {
    this.emit(gangzimo ? 'gangzimo' : 'zimo', data);
    if (data.l !== this._menfeng) return this.respond();
    const dapai = this.get_dapai(this.shoupai) || [];
    const options = {
      hule: this.allow_hule(this.shoupai, null, gangzimo ? 'lingshang' : null),
      daopai: this.allow_pingju(this.shoupai),
      gang: this.get_gang_mianzi(this.shoupai, null) || [],
      dapai,
      riichi: dapai.filter(tile => this.allow_lizhi(this.shoupai, tile))
    };
    this.request('draw', options, data);
  }
  action_dapai(data) {
    this.emit('dapai', data);
    if (data.l === this._menfeng) return this.respond();
    const callTile = relativeDiscardTile(data, this._menfeng);
    const fulou = [
      ...(this.get_gang_mianzi(this.shoupai, callTile) || []),
      ...(this.get_peng_mianzi(this.shoupai, callTile) || []),
      ...(this.get_chi_mianzi(this.shoupai, callTile) || [])
    ];
    const options = { hule: this.allow_hule(this.shoupai, callTile), fulou };
    if (options.hule || fulou.length) this.request('discard-response', options, data);
    else this.respond();
  }
  action_fulou(data) {
    this.emit('fulou', data);
    if (data.l !== this._menfeng) return this.respond();
    this.request('post-call-discard', { dapai: this.get_dapai(this.shoupai) || [], riichi: [], gang: [], hule: false }, data);
  }
  action_gang(data) {
    this.emit('gang', data);
    const robbedTile = robbedKanTile(data, this._menfeng);
    if (data.l !== this._menfeng && this.allow_hule(this.shoupai, robbedTile, 'qianggang')) {
      this.request('kan-response', { hule: true, fulou: [] }, data);
    }
    else this.respond();
  }
  action_hule(data) { this.emit('hule', data); this.request('round-result', { hule: data }, data); }
  action_pingju(data) { this.emit('pingju', data); this.request('round-result', { pingju: data }, data); }
  action_jieju(data) { this.emit('jieju', data); this.request('match-result', { paipu: data }, data); }
}

export class FullGameSession {
  constructor({ rule = {}, speed = 2, onEvent, onDecision, onComplete } = {}) {
    this.human = new InteractivePlayer({ onEvent, onDecision });
    this.players = [this.human, new AutoPlayer(), new AutoPlayer(), new AutoPlayer()];
    this.game = new Majiang.Game(this.players, paipu => { this.paipu = paipu; onComplete?.(paipu); }, createStandardRule(rule), 'JP MAHJONG');
    this.game.speed = speed;
  }
  start() { this.game.kaiju(); return this; }
  submit(reply) { this.human.submit(reply); }
  waitForDecision() { return this.human.waitForDecision(); }
  stop() {
    clearTimeout(this.game._timeout_id);
    this.game._timeout_id = null;
    this.game.stop();
    this.human.pending = null;
    this.human._callback = null;
  }
  get model() { return this.human.model; }
}

export function simulateFullHanchan(ruleOverrides = {}) {
  let result = null;
  const players = Array.from({ length: 4 }, () => new AutoPlayer());
  const game = new Majiang.Game(players, paipu => { result = paipu; }, createStandardRule(ruleOverrides), 'JP MAHJONG full-core simulation');
  game.do_sync();
  return { game, paipu: result };
}
