#!/usr/bin/env node
// =====================================================================
// demo/build-demo.mjs —— 把 demo 打成可双击打开的单文件 demo.html
//
//   node src/v9/demo/build-demo.mjs
//
// 为什么要用 esbuild 命令行：某些沙箱里 Node 起子进程（stdio: pipe）会被
// 拒绝（EPERM），所以这里优先用已生成的 .bundle.js，其次才尝试调 esbuild。
// 手工打包命令（在项目根目录执行）：
//   node_modules\@esbuild\win32-x64\esbuild.exe src/v9/demo/main.js ^
//     --bundle --format=iife --target=chrome100 --minify --outfile=src/v9/demo/.bundle.js
// =====================================================================
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {execFileSync} from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BUNDLE = join(HERE, '.bundle.js');

function tryBundle() {
  const bins = [
    process.env.ESBUILD_BIN,
    join(ROOT, 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe'),
    join(ROOT, 'node_modules', '@esbuild', 'win32-arm64', 'esbuild.exe'),
    join(ROOT, 'node_modules', '@esbuild', 'darwin-arm64', 'bin', 'esbuild'),
    join(ROOT, 'node_modules', '@esbuild', 'linux-x64', 'bin', 'esbuild')
  ].filter(Boolean);
  const bin = bins.find((p) => existsSync(p));
  if (!bin) return false;
  execFileSync(bin, [
    join(HERE, 'main.js'), '--bundle', '--format=iife',
    '--target=chrome100', '--legal-comments=none', '--minify',
    `--outfile=${BUNDLE}`
  ], {stdio: 'inherit'});
  return existsSync(BUNDLE);
}

if (!existsSync(BUNDLE) || process.argv.includes('--rebuild')) {
  if (!tryBundle()) {
    console.error('找不到 esbuild 可执行文件，也打不出 .bundle.js。请手工执行：');
    console.error('  node_modules\\@esbuild\\win32-x64\\esbuild.exe src/v9/demo/main.js --bundle --format=iife --minify --outfile=src/v9/demo/.bundle.js');
    process.exit(1);
  }
}

const bundle = readFileSync(BUNDLE, 'utf8');
const html = readFileSync(join(HERE, 'index.html'), 'utf8')
  .replace(
    '<script type="module" src="./main.js"></script>',
    `<script>${bundle.replace(/<\/script/gi, '<\\/script')}</script>`
  );
const out = join(HERE, 'demo.html');
writeFileSync(out, html, 'utf8');
console.log(JSON.stringify({file: out, bytes: Buffer.byteLength(html), bundleBytes: Buffer.byteLength(bundle)}));
