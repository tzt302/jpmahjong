# Sanma core

This directory vendors the browser-compatible game modules from
[`Mateces/mahjong-ai-sanma`](https://github.com/Mateces/mahjong-ai-sanma)
commit `ed9ed8388a1c0c205e31e3ecc47863c54257a442` under its MIT license.

Only the TypeScript rule/game modules and their small MJAI event dependency are
included. `browser.js` is the generated ESM bundle consumed by JP MAHJONG.
Upstream sanma behavior is covered locally by independent adapter and flow tests;
known gaps such as temporary furiten and multi-winner resolution are completed in
the JP MAHJONG session layer rather than represented as upstream functionality.
