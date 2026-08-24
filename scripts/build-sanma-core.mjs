import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const pnpm = process.env.PNPM_PATH || 'pnpm';
const result = spawnSync(pnpm, [
  'dlx', 'esbuild@0.25.9',
  resolve('vendor/sanma-core/entry.ts'),
  '--bundle', '--format=esm', '--platform=browser', '--target=es2020',
  `--outfile=${resolve('vendor/sanma-core/browser.js')}`,
  '--banner:js=//Mateces-mahjong-ai-sanma-MIT-ed9ed8388a1c0c205e31e3ecc47863c54257a442'
], { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.status !== 0) process.exit(result.status || 1);
