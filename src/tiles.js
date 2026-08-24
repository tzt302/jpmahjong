// Standard riichi tile artwork from FluffyStuff/riichi-mahjong-tiles (public domain).
const TILE_ASSETS = [
  'Man1.svg','Man2.svg','Man3.svg','Man4.svg','Man5.svg','Man6.svg','Man7.svg','Man8.svg','Man9.svg',
  'Pin1.svg','Pin2.svg','Pin3.svg','Pin4.svg','Pin5.svg','Pin6.svg','Pin7.svg','Pin8.svg','Pin9.svg',
  'Sou1.svg','Sou2.svg','Sou3.svg','Sou4.svg','Sou5.svg','Sou6.svg','Sou7.svg','Sou8.svg','Sou9.svg',
  'Ton.svg','Nan.svg','Shaa.svg','Pei.svg','Haku.svg','Hatsu.svg','Chun.svg'
];

const RED_TILE_ASSETS = {
  4: 'Man5-Dora.svg',
  13: 'Pin5-Dora.svg',
  22: 'Sou5-Dora.svg'
};

export function tileFaceMarkup(tile, red = false) {
  const file = red && RED_TILE_ASSETS[tile] ? RED_TILE_ASSETS[tile] : TILE_ASSETS[tile];
  return `<img class="tile-face-image" src="assets/tiles/regular/${file}" alt="" draggable="false">`;
}
