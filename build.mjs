// 构建 v8 单文件 HTML：沿用 v7.1 的业务数据、配音与车模，动画层为新写的一套。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
const root = path.dirname(fileURLToPath(import.meta.url));
// 素材目录：默认仍是原环境路径；本机用环境变量 LC_ASSETS 指向整理好的素材包
const R = process.env.LC_ASSETS || '/home/claude/longchuang-anim/unpacked';
const story = JSON.parse(fs.readFileSync(path.join(root, 'data/story.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(R, 'audio-manifest.json'), 'utf8'));
const nodes = story.chapters.flatMap(c => c.steps), audio = {};
for (const n of nodes) {
  const c = manifest[n.id];
  if (!c) throw new Error('Missing audio ' + n.id);
  if (c.segments.length !== 6) throw new Error('Six timed sentences required ' + n.id);
  if (c.segments.map(s => s.captionText).join('') !== n.narration) throw new Error('Narration differs ' + n.id);
  audio[n.id] = {duration: c.duration, segments: c.segments, base64: fs.readFileSync(path.join(R, 'assets/audio', n.id + '.mp3')).toString('base64')};
}
const preview = process.argv.includes('--preview'), web = process.argv.includes('--web');
const site = process.argv.includes('--site');
// 打包：优先直接调用 esbuild 可执行文件（有的环境里 Node 起子进程会被安全策略拦住），失败再退回 JS API
async function bundleApp() {
  const outDir = path.join(root, 'out');
  fs.mkdirSync(outDir, {recursive: true});
  const bins = [
    process.env.ESBUILD_BIN,
    path.join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe'),
    path.join(root, 'node_modules/@esbuild/win32-arm64/esbuild.exe'),
    path.join(root, 'node_modules/@esbuild/darwin-arm64/bin/esbuild'),
    path.join(root, 'node_modules/@esbuild/linux-x64/bin/esbuild'),
    path.join(root, 'node_modules/esbuild/bin/esbuild'),
  ].filter(Boolean);
  const bin = bins.find(p => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (bin) {
    const tmp = path.join(outDir, '.bundle.js');
    const args = [path.join(root, 'src/app.js'), '--bundle', '--format=iife',
      '--target=chrome100,edge100', '--legal-comments=inline', `--outfile=${tmp}`];
    if (!preview) args.push('--minify');
    execFileSync(bin, args, {stdio: 'inherit', cwd: root});
    const text = fs.readFileSync(tmp, 'utf8');
    fs.rmSync(tmp, {force: true});
    return {text};
  }
  const r = await build({entryPoints: [path.join(root, 'src/app.js')], bundle: true, format: 'iife', target: ['chrome100', 'edge100'], minify: !preview, legalComments: 'inline', write: false, loader: {'.json': 'json'}});
  return {text: r.outputFiles[0].text};
}
const result = await bundleApp();
const cssFiles = ['style-v4.css', 'v4-additions.css', 'v5-additions.css', 'v7-additions.css', 'v8.css'];
const css = cssFiles.map(f => fs.readFileSync(path.join(root, 'src/css', f), 'utf8')).join('\n');
const license = fs.readFileSync(path.join(root, 'node_modules/three/LICENSE'), 'utf8');
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
  .replace('/*__STYLE__*/', () => css)
  .replace('/*__DATA__*/', () => JSON.stringify(story).replace(/</g, '\\u003c'))
  .replace('/*__MODEL__*/', () => fs.readFileSync(path.join(R, 'assets/tesla-model-3.glb')).toString('base64'))
  .replace('/*__AUDIO__*/', () => JSON.stringify(audio))
  .replace('/*__APP__*/', () => result.text.replace(/<\/script/gi, '<\\/script')) + '\n<!-- Three.js license\n' + license + '\n-->';
if (site) {
  // 网站发布版：完整 HTML 外壳 + 独立素材文件（车模用二进制，配音按需加载，便于缓存与首屏）
  const dir = path.join(root, 'out', 'site');
  fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
  const siteAudio = {__web: true};
  for (const n of nodes) {
    siteAudio[n.id] = {duration: audio[n.id].duration, segments: audio[n.id].segments, url: 'audio/' + n.id + '.mp3'};
    fs.copyFileSync(path.join(R, 'assets/audio', n.id + '.mp3'), path.join(dir, 'audio', n.id + '.mp3'));
  }
  fs.copyFileSync(path.join(R, 'assets/tesla-model-3.glb'), path.join(dir, 'model.glb'));
  const siteHtml = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
    .replace('/*__STYLE__*/', () => css)
    .replace('/*__DATA__*/', () => JSON.stringify(story).replace(/</g, '\\u003c'))
    .replace('<script id="model-data" type="application/octet-stream">/*__MODEL__*/</script>',
             '<script id="model-data" type="application/octet-stream" data-src="model.glb"></script>')
    .replace('/*__AUDIO__*/', () => JSON.stringify(siteAudio))
    .replace('/*__APP__*/', () => result.text.replace(/<\/script/gi, '<\\/script'))
    + '\n<!-- Three.js license\n' + license + '\n-->';
  fs.writeFileSync(path.join(dir, 'index.html'), siteHtml);
  const dup = file => console.log('  ' + path.relative(root, file));
  dup(path.join(dir, 'index.html'));
  console.log(JSON.stringify({dir, htmlBytes: Buffer.byteLength(siteHtml), audio: nodes.length}));
  process.exit(0);
}
if (web) {
  // 网页发布版：车模与配音作为同目录文件，页面只放内容（外壳由发布方补上）
  const dir = path.join(root, 'out', 'web'); fs.mkdirSync(path.join(dir, 'audio'), {recursive: true});
  const webAudio = {__web: true};
  for (const n of nodes) { webAudio[n.id] = {duration: audio[n.id].duration, segments: audio[n.id].segments, url: 'audio/' + n.id + '.mp3'}; fs.copyFileSync(path.join(R, 'assets/audio', n.id + '.mp3'), path.join(dir, 'audio', n.id + '.mp3')); }
  fs.writeFileSync(path.join(dir, 'model.txt'), fs.readFileSync(path.join(R, 'assets/tesla-model-3.glb')).toString('base64'));
  let w = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8')
    .replace('/*__STYLE__*/', () => css).replace('/*__DATA__*/', () => JSON.stringify(story).replace(/</g, '\\u003c'))
    .replace('<script id="model-data" type="application/octet-stream">/*__MODEL__*/</script>', '<script id="model-data" type="application/octet-stream" data-src="model.txt"></script>')
    .replace('/*__AUDIO__*/', () => JSON.stringify(webAudio)).replace('/*__APP__*/', () => result.text.replace(/<\/script/gi, '<\\/script'));
  w = w.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>/i, '').replace(/<head>/i, '').replace(/<\/head>/i, '').replace(/<body([^>]*)>/i, '').replace(/<\/body>/i, '')
    .replace(/<meta charset="utf-8">/i, '').replace(/<meta name="viewport"[^>]*>/i, '');
  fs.writeFileSync(path.join(dir, 'index.html'), w + '\n<!-- Three.js license\n' + license + '\n-->');
  console.log(JSON.stringify({dir, bytes: Buffer.byteLength(w)}));
  process.exit(0);
}
const out = path.join(root, 'out', preview ? 'preview.html' : '龙创汽车设计_交互动画_v8.html');
fs.writeFileSync(out, html);
console.log(JSON.stringify({file: out, bytes: Buffer.byteLength(html), nodes: nodes.length}));
