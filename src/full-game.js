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

export function simulateFullHanchan(ruleOverrides = {}) {
  let result = null;
  const players = Array.from({ length: 4 }, () => new AutoPlayer());
  const game = new Majiang.Game(players, paipu => { result = paipu; }, createStandardRule(ruleOverrides), 'JP MAHJONG full-core simulation');
  game.do_sync();
  return { game, paipu: result };
}
