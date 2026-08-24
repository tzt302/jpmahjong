import { Majiang, createStandardRule } from './riichi-core.js';

export class AutoPlayer extends Majiang.Player {
  respond(reply = {}) { this._callback?.(reply); }
  action_kaiju() { this.respond(); }
  action_qipai() { this.respond(); }
  action_zimo(zimo, gangzimo) {
    if (zimo.l !== this._menfeng) return this.respond();
    if (this.allow_hule(this.shoupai, null, gangzimo ? 'lingshang' : null)) return this.respond({ hule: '-' });
    const legal = this.get_dapai(this.shoupai);
    const tile = legal.at(-1);
    const riichi = tile && this.allow_lizhi(this.shoupai, tile);
    this.respond({ dapai: tile + (riichi ? '*' : '') });
  }
  action_dapai(dapai) {
    if (dapai.l !== this._menfeng && this.allow_hule(this.shoupai, dapai.p)) return this.respond({ hule: '-' });
    this.respond();
  }
  action_fulou() { this.respond({ dapai: this.get_dapai(this.shoupai).at(-1) }); }
  action_gang(gang) {
    if (gang.l !== this._menfeng && this.allow_hule(this.shoupai, gang.m.slice(-2))) return this.respond({ hule: '-' });
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
    const direction = '_+=-'[(4 + data.l - this._menfeng) % 4];
    const callTile = data.p.slice(0, 2) + direction;
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
    const direction = '_+=-'[(4 + data.l - this._menfeng) % 4];
    const robbedTile = data.m[0] + (data.m.match(/\d(?=[^\d]*$)/)?.[0] || '5') + direction;
    if (data.l !== this._menfeng && this.allow_hule(this.shoupai, robbedTile, 'qianggang')) {
      this.request('kan-response', { hule: true, fulou: [] }, data);
    }
    else this.respond();
  }
  action_hule(data) { this.emit('hule', data); this.respond(); }
  action_pingju(data) { this.emit('pingju', data); this.respond(); }
  action_jieju(data) { this.emit('jieju', data); this.respond(); }
}

export class FullGameSession {
  constructor({ rule = {}, onEvent, onDecision, onComplete } = {}) {
    this.human = new InteractivePlayer({ onEvent, onDecision });
    this.players = [this.human, new AutoPlayer(), new AutoPlayer(), new AutoPlayer()];
    this.game = new Majiang.Game(this.players, paipu => { this.paipu = paipu; onComplete?.(paipu); }, createStandardRule(rule), 'JP MAHJONG');
    this.game.speed = 0;
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
