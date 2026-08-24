import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('vendor/majiang-core');
const sourceDir = resolve(root, 'lib');
const files = (await readdir(sourceDir)).filter(name => name.endsWith('.js')).sort();
const factories = [];

for (const file of files) {
  const source = await readFile(resolve(sourceDir, file), 'utf8');
  factories.push(`${JSON.stringify(`./${file}`)}: function(require, module, exports) {\n${source}\n}`);
}

const bundle = `// Generated from @kobalab/majiang-core 1.4.1 (MIT). Do not edit manually.\n` +
`const factories = {\n${factories.join(',\n')}\n};\n` +
`const cache = Object.create(null);\n` +
`function load(id) {\n  const key = id.endsWith('.js') ? id : id + '.js';\n  if (cache[key]) return cache[key].exports;\n  if (!factories[key]) throw new Error('Unknown majiang-core module: ' + id);\n  const module = { exports: {} };\n  cache[key] = module;\n  factories[key](load, module, module.exports);\n  return module.exports;\n}\n` +
`const Majiang = load('./index');\nexport default Majiang;\nexport const { rule, Shoupai, Shan, He, Board, Game, Player, Util } = Majiang;\n`;

await writeFile(resolve(root, 'browser.js'), bundle, 'utf8');
console.log(`Built browser.js from ${files.length} majiang-core modules.`);
