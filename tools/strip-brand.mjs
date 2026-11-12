#!/usr/bin/env node
// tools/strip-brand.mjs
// GLB 品牌字样清洗（只改 JSON chunk，BIN chunk 一字节不动）
//
// 用法：
//   node tools/strip-brand.mjs --in <glb> --out <glb>       # 产出一份拷贝（默认模式，不改源文件）
//   node tools/strip-brand.mjs --in <glb> --in-place        # 原地替换，先备份为 <base>.orig.glb
//   node tools/strip-brand.mjs --in <glb> --dry-run         # 只报告将改什么，不写文件
//
// 安全边界：
//   - 只对 JSON chunk 做「原文替换」，不重新序列化 → 其余字段字节完全不变（浮点不会被重排）
//   - BIN chunk 原样搬运；写入前后做 sha256 比对，必须一致
//   - asset.extras.author / license / source（CC BY 4.0 署名载体）一律不动
//
// 退出码：0 成功 / 1 断言失败
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const GLB_MAGIC = 0x46546c67;   // 'glTF'
const CHUNK_JSON = 0x4e4f534a;  // 'JSON'
const CHUNK_BIN  = 0x004e4942;  // 'BIN\0'

// ---- 替换表：每条的 from 必须在 JSON 原文里恰好出现一次 ----
const REPLACEMENTS = [
  {
    id: 'node.body',
    from: '"name":"2024 Tesla Model 3.obj.cleaner.materialmerger.gles"',
    to:   '"name":"vehicle_body"',
    why:  'nodes[1].name（车身节点名带品牌 + 车型号）',
  },
  {
    id: 'node.root',
    from: '"name":"Sketchfab_model"',
    to:   '"name":"vehicle_root"',
    why:  'nodes[0].name（平台名）',
  },
  {
    id: 'scene.name',
    from: '"name":"Sketchfab_Scene"',
    to:   '"name":"vehicle_scene"',
    why:  'scenes[0].name（平台名，卡片未列，同类残留）',
  },
  {
    id: 'asset.generator',
    from: '"generator":"Sketchfab-16.31.0"',
    to:   '"generator":"glTF-2.0-exporter"',
    why:  'asset.generator（平台名 + 版本）',
  },
  {
    id: 'asset.title',
    from: '"title":"2024 Tesla Model 3"',
    to:   '"title":"Third-party EV sedan model (CC BY 4.0)"',
    why:  'asset.extras.title（车型品牌名）',
  },
];

// ---- 允许保留的品牌字样（署名/溯源载体，删了违反 CC BY 4.0）----
const KEEP_PATTERNS = [
  { re: /RBLXSupercars \(https:\/\/sketchfab\.com\/RBLXSupercars\)/, why: 'asset.extras.author — 作者署名（CC BY 4.0 必留）' },
  { re: /https:\/\/sketchfab\.com\/3d-models\/2024-tesla-model-3-[0-9a-f]+/, why: 'asset.extras.source — 来源链接（溯源必留）' },
  { re: /CC-BY-4\.0|creativecommons\.org\/licenses\/by\/4\.0/, min: 2, why: 'asset.extras.license — 许可声明（CC BY 4.0 必留）' },
];

// ---- 期望的图元计数（改名前后必须一致）----
const COUNT_KEYS = ['nodes', 'meshes', 'materials', 'accessors', 'bufferViews', 'buffers', 'images', 'textures', 'samplers'];

function die(msg, extra) {
  console.error('✗ ' + msg);
  if (extra) console.error(extra);
  process.exit(1);
}
function ok(msg) { console.log('✓ ' + msg); }
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function pad(n, align) { return (align - (n % align)) % align; }

// ---------- 参数 ----------
const argv = process.argv.slice(2);
function arg(name) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }
const inPath = arg('--in');
const outPath = arg('--out');
const inPlace = argv.includes('--in-place');
const dryRun = argv.includes('--dry-run');
if (!inPath) die('缺少 --in <glb>');
if (!inPlace && !outPath && !dryRun) die('需要 --out <glb> 或 --in-place（或 --dry-run）');
const srcPath = path.resolve(inPath);
if (!fs.existsSync(srcPath)) die('源文件不存在：' + srcPath);

// ---------- 解析 GLB ----------
const raw = fs.readFileSync(srcPath);
if (raw.length < 20) die('文件太短，不是 GLB');
const magic = raw.readUInt32LE(0);
const version = raw.readUInt32LE(4);
const declared = raw.readUInt32LE(8);
if (magic !== GLB_MAGIC) die(`magic 不是 glTF（${magic.toString(16)}）`);
if (version !== 2) die(`version 不是 2（${version}）`);
if (declared !== raw.length) die(`头里 length=${declared} 与文件大小 ${raw.length} 不一致`);

const chunks = [];
for (let off = 12; off < raw.length;) {
  if (off + 8 > raw.length) die('chunk 头越界 @' + off);
  const len = raw.readUInt32LE(off);
  const type = raw.readUInt32LE(off + 4);
  const start = off + 8;
  if (start + len > raw.length) die('chunk 数据越界 @' + off);
  chunks.push({ type, len, start, data: raw.subarray(start, start + len) });
  off = start + len;
}
if (chunks.length !== 2) die(`期望 2 个 chunk，实际 ${chunks.length}`);
if (chunks[0].type !== CHUNK_JSON) die('第一个 chunk 不是 JSON');
if (chunks[1].type !== CHUNK_BIN) die('第二个 chunk 不是 BIN');
if (chunks[0].len % 4 !== 0) die('JSON chunk 长度未 4 字节对齐');
if (chunks[1].len % 4 !== 0) die('BIN chunk 长度未 4 字节对齐');

const origJsonBytes = Buffer.from(chunks[0].data);   // copy
const origBinBytes = Buffer.from(chunks[1].data);
const origJsonText = origJsonBytes.toString('utf8');
const origGltf = JSON.parse(origJsonText);
const origBinSha = sha256(origBinBytes);
const srcSha = sha256(raw);

console.log('源文件      : ' + srcPath);
console.log('文件大小    : ' + raw.length + ' bytes');
console.log('JSON chunk  : ' + chunks[0].len + ' bytes');
console.log('BIN  chunk  : ' + chunks[1].len + ' bytes');
console.log('源 sha256   : ' + srcSha);
console.log('BIN sha256  : ' + origBinSha);
console.log('图元计数    : ' + COUNT_KEYS.map(k => `${k}=${(origGltf[k] || []).length}`).join(' '));
console.log('');

// ---------- 预检：替换点的出现次数 ----------
console.log('— 预检 —');
for (const r of REPLACEMENTS) {
  const n = origJsonText.split(r.from).length - 1;
  if (n !== 1) die(`替换目标「${r.id}」期望出现 1 次，实际 ${n} 次：${r.from}`);
  ok(`${r.id} 命中 1 次 — ${r.why}`);
}
for (const k of KEEP_PATTERNS) {
  const m = origJsonText.match(new RegExp(k.re.source, 'g'));
  const need = k.min || 1;
  if (!m || m.length < need) die(`应保留的署名线索「${k.why}」找到 ${m ? m.length : 0} 次（至少 ${need}）`);
  ok(`保留 ${k.why}（命中 ${m.length} 处）`);
}
console.log('');

// ---------- 应用替换（纯字符串，不重序列化）----------
let newJsonText = origJsonText;
for (const r of REPLACEMENTS) {
  newJsonText = newJsonText.replace(r.from, r.to);
}

// 断言：改完之后，除白名单外不应再有品牌字样
const stripped = newJsonText;
const leftovers = [];
for (const token of ['Tesla', 'tesla', 'TESLA', 'Sketchfab', 'RBLX', 'Model 3']) {
  let count = stripped.split(token).length - 1;
  if (count === 0) continue;
  // 该 token 是否全部落在白名单片段内
  let inside = 0;
  for (const k of KEEP_PATTERNS) {
    for (const m of stripped.matchAll(new RegExp(k.re.source, 'g'))) {
      inside += m[0].split(token).length - 1;
    }
  }
  if (count > inside) leftovers.push(`${token} ×${count - inside}（白名单外）`);
}
if (leftovers.length) die('仍有白名单外的品牌字样：' + leftovers.join(', '));
ok('白名单外的品牌字样已清零');
console.log('');

// ---------- 重建 GLB ----------
if (dryRun) {
  console.log('— dry-run：未写文件 —');
  for (const r of REPLACEMENTS) console.log(`  ${r.id}: ${r.from}\n        → ${r.to}`);
  process.exit(0);
}

const newJsonBuf0 = Buffer.from(newJsonText, 'utf8');
const padJson = pad(newJsonBuf0.length, 4);
const newJsonBuf = Buffer.concat([newJsonBuf0, Buffer.alloc(padJson, 0x20)]);  // 空格补齐
const newBinBuf = origBinBytes;                                                  // 原样搬运

const total = 12 + 8 + newJsonBuf.length + 8 + newBinBuf.length;
const head = Buffer.alloc(12);
head.writeUInt32LE(GLB_MAGIC, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(total, 8);
const chunkHead = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
const outBuf = Buffer.concat([head, chunkHead(newJsonBuf.length, CHUNK_JSON), newJsonBuf, chunkHead(newBinBuf.length, CHUNK_BIN), newBinBuf]);
if (outBuf.length !== total) die('组装长度不一致');

// ---------- 落盘 ----------
let target = outPath ? path.resolve(outPath) : srcPath;
let backup = null;
if (inPlace) {
  backup = srcPath.replace(/\.glb$/i, '') + '.orig.glb';
  if (!fs.existsSync(backup)) {
    fs.copyFileSync(srcPath, backup);
    ok('备份原始文件 → ' + backup + '（' + fs.statSync(backup).size + ' bytes，不要入库）');
  } else {
    ok('备份已存在，保持不动 → ' + backup);
  }
  target = srcPath;
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, outBuf);
ok('写出 → ' + target + '（' + outBuf.length + ' bytes）');
console.log('');

// ---------- 自检：重新解析产物 ----------
console.log('— 自检（重新解析产物）—');
const reread = fs.readFileSync(target);
if (reread.readUInt32LE(0) !== GLB_MAGIC) die('产物 magic 错');
if (reread.readUInt32LE(4) !== 2) die('产物 version 错');
if (reread.readUInt32LE(8) !== reread.length) die('产物头 length 与文件大小不一致');
ok('GLB 头 magic/version/length 正确');

const rChunks = [];
for (let off = 12; off < reread.length;) {
  const len = reread.readUInt32LE(off), type = reread.readUInt32LE(off + 4), start = off + 8;
  rChunks.push({ type, len, data: reread.subarray(start, start + len) });
  off = start + len;
}
if (rChunks.length !== 2) die('产物 chunk 数不为 2');
if (rChunks[0].type !== CHUNK_JSON || rChunks[1].type !== CHUNK_BIN) die('产物 chunk 类型错');
if (rChunks[0].len % 4 !== 0) die('产物 JSON chunk 未 4 字节对齐');
ok(`chunk 结构正确（JSON ${rChunks[0].len} · BIN ${rChunks[1].len}，均 4 字节对齐）`);

let newGltf;
try { newGltf = JSON.parse(rChunks[0].data.toString('utf8')); } catch (e) { die('产物 JSON 解析失败：' + e.message); }
ok('JSON chunk 可解析');

// 计数一致
for (const k of COUNT_KEYS) {
  const a = (origGltf[k] || []).length, b = (newGltf[k] || []).length;
  if (a !== b) die(`${k} 数量变了：${a} → ${b}`);
}
ok('图元计数一致：' + COUNT_KEYS.map(k => `${k}=${newGltf[k].length}`).join(' '));

// 字段值断言
const expect = { 'nodes[0].name': 'vehicle_root', 'nodes[1].name': 'vehicle_body', 'scenes[0].name': 'vehicle_scene', 'asset.generator': 'glTF-2.0-exporter', 'asset.extras.title': 'Third-party EV sedan model (CC BY 4.0)' };
const actual = { 'nodes[0].name': newGltf.nodes[0].name, 'nodes[1].name': newGltf.nodes[1].name, 'scenes[0].name': newGltf.scenes[0].name, 'asset.generator': newGltf.asset.generator, 'asset.extras.title': newGltf.asset.extras.title };
for (const k of Object.keys(expect)) {
  if (actual[k] !== expect[k]) die(`${k} = ${JSON.stringify(actual[k])}，期望 ${JSON.stringify(expect[k])}`);
}
ok('5 个字段改名到位');

// 署名载体必须原样
const a0 = JSON.stringify(origGltf.asset.extras), a1 = JSON.stringify(newGltf.asset.extras);
for (const k of ['author', 'license', 'source']) {
  if (origGltf.asset.extras[k] !== newGltf.asset.extras[k]) die(`asset.extras.${k} 被改动了！`);
}
ok('asset.extras.author / license / source 原样保留（CC BY 4.0 署名完整）');

// 深层语义相等：把旧对象的 5 个字段改回新值后，应完全等于新对象
const restored = JSON.parse(JSON.stringify(origGltf));
restored.nodes[0].name = expect['nodes[0].name'];
restored.nodes[1].name = expect['nodes[1].name'];
restored.scenes[0].name = expect['scenes[0].name'];
restored.asset.generator = expect['asset.generator'];
restored.asset.extras.title = expect['asset.extras.title'];
if (JSON.stringify(restored) !== JSON.stringify(newGltf)) {
  // 找出第一个不同的位置，方便定位
  const A = JSON.stringify(restored), B = JSON.stringify(newGltf);
  let i = 0; while (i < A.length && A[i] === B[i]) i++;
  die('JSON 语义不一致（除 5 个字段外还有其他改动）', `@${i}\n  期望: ...${A.slice(Math.max(0, i - 60), i + 60)}\n  实际: ...${B.slice(Math.max(0, i - 60), i + 60)}`);
}
ok('除这 5 个字段外，JSON 语义逐字节等价（未重排、未丢字段、未改浮点）');

// BIN 必须一字节不差
const newBinSha = sha256(Buffer.from(rChunks[1].data));
if (rChunks[1].len !== chunks[1].len) die(`BIN 长度变了：${chunks[1].len} → ${rChunks[1].len}`);
if (newBinSha !== origBinSha) die(`BIN sha256 不一致：\n  源 ${origBinSha}\n  产物 ${newBinSha}`);
ok('BIN chunk 逐字节一致 · sha256 ' + newBinSha);

// 6 张内嵌贴图逐一比对
let imgOk = 0;
for (let i = 0; i < newGltf.images.length; i++) {
  const bvIdx = newGltf.images[i].bufferView;
  const o = origGltf.bufferViews[bvIdx], n = newGltf.bufferViews[bvIdx];
  if (JSON.stringify(o) !== JSON.stringify(n)) die(`bufferViews[${bvIdx}] 元数据变了`);
  const os = o.byteOffset || 0, ns = n.byteOffset || 0;
  const a = Buffer.from(origBinBytes.subarray(os, os + o.byteLength));
  const b = Buffer.from(rChunks[1].data.subarray(ns, ns + n.byteLength));
  if (sha256(a) !== sha256(b)) die(`image[${i}] 字节不一致`);
  imgOk++;
}
ok(`${imgOk} 张内嵌贴图字节一致（按 bufferView 偏移逐张比对）`);

console.log('');
console.log('—— 报告 ——');
console.log(JSON.stringify({
  ok: true,
  src: srcPath,
  out: target,
  backup,
  srcBytes: raw.length,
  outBytes: outBuf.length,
  sizeDelta: outBuf.length - raw.length,
  jsonChunk: { before: chunks[0].len, after: rChunks[0].len, padding: padJson },
  binChunk: { before: chunks[1].len, after: rChunks[1].len, sha256: newBinSha, unchanged: true },
  sourceSha256: srcSha,
  outputSha256: sha256(reread),
  counts: Object.fromEntries(COUNT_KEYS.map(k => [k, newGltf[k].length])),
  renamed: Object.fromEntries(Object.keys(expect).map(k => [k, expect[k]])),
  kept: ['asset.extras.author', 'asset.extras.license', 'asset.extras.source'],
}, null, 2));
