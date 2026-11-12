#!/usr/bin/env node
// 验收脚本：不渲染，只用 three 的几何能力把每个部件建一遍，统计三角面 / 网格 / 材质档位 / 尺寸。
// 用法：node src/v9/parts/bench.mjs            （表格）
//       node src/v9/parts/bench.mjs --json     （机读）
// 退出码：0 = 全部在预算内；1 = 超预算 / 发现 NaN / 非确定性 / 结构不合格。
import * as THREE from 'three';
import {createParts, CATALOG, TOTAL_BUDGET, VERSION} from './index.js';

const JSON_OUT = process.argv.includes('--json');
const parts = createParts(THREE);
const t0 = Date.now();

// 只在无 DOM 的环境里跑；有 window 说明是在浏览器里误跑
if (typeof window !== 'undefined') {
  console.error('bench.mjs 只用于 Node 离线统计，不要在浏览器里跑');
  process.exit(2);
}
if (typeof parts.L.hasDOM === 'boolean' && parts.L.hasDOM) {
  console.error('注意：检出 DOM，贴图会被真实生成（不影响几何统计）');
}

// 显示宽度：中日韩字符按 2 列算，保证终端表格对齐
const dw = (s) => {
  let n = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    n += (c >= 0x1100 && (c <= 0x115f || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6))) ? 2 : 1;
  }
  return n;
};
const pad = (s, n, right = false) => {
  s = String(s);
  const gap = ' '.repeat(Math.max(0, n - dw(s)));
  return right ? gap + s : s + gap;
};

const rows = [];
const problems = [];
const seen = new Map();

for (const meta of CATALOG) {
  const g = parts.build(meta.key);
  const st = parts.stats(g);
  const budget = meta.budget;
  const pct = st.tris / budget * 100;
  const status = st.tris > budget ? '超预算' : (pct > 90 ? '临界' : 'OK');
  if (st.tris > budget) problems.push(`${meta.key} 三角面 ${st.tris} 超过上限 ${budget}`);
  if (st.nan) problems.push(`${meta.key} 顶点含 NaN/Infinity`);
  if (g.userData.kind !== 'part') problems.push(`${meta.key} userData.kind 不是 'part'`);
  if (!g.name) problems.push(`${meta.key} 缺少 name`);
  if (st.subparts < 3) problems.push(`${meta.key} 可控子件过少（${st.subparts}）`);
  // 尺寸是否可信（含外部线缆/软管，单位米）
  const dims = [['seat', [.3, 1.4, .4, 1.4, .4, 1.4]], ['batteryModule', [.4, .8, .08, .2, .2, .5]],
    ['batteryPack', [2.0, 3.0, .1, .45, 1.2, 1.9]], ['ecu', [.15, .25, .03, .1, .1, .2]],
    ['biw', [4.2, 5.2, .5, 2.0, 1.2, 2.0]], ['driveUnit', [.3, 1.0, .3, 1.0, .3, 1.0]],
    ['doorPanel', [.7, 1.3, .4, .95, .02, 1.0]]];
  for (const [k, mm] of dims) {
    if (k !== meta.key) continue;
    const s = st.size, a = [s.x, s.y, s.z];
    for (let i = 0; i < 3; i++) {
      if (a[i] < mm[i * 2] || a[i] > mm[i * 2 + 1]) problems.push(`${meta.key} 尺寸异常 ${['x', 'y', 'z'][i]}=${a[i]}m（期望 ${mm[i * 2]}~${mm[i * 2 + 1]}）`);
    }
  }
  rows.push({...meta, ...st, pct, status, name: g.name, kind: g.userData.kind});
  seen.set(meta.key, g);
}

// 确定性校验：同参数建两次，三角面、顶点数、位置哈希必须一致
const hashGeo = (root) => {
  let h = 2166136261;
  root.traverse(o => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const a = pos.array;
    for (let i = 0; i < a.length; i += 13) {
      h ^= Math.round(a[i] * 1e5) | 0;
      h = Math.imul(h, 16777619);
    }
  });
  return (h >>> 0).toString(16);
};
for (const meta of CATALOG) {
  const g1 = seen.get(meta.key);
  const g2 = parts.build(meta.key);
  const s1 = parts.stats(g1), s2 = parts.stats(g2);
  if (s1.tris !== s2.tris || s1.verts !== s2.verts) problems.push(`${meta.key} 非确定性：两次三角面/顶点数不同`);
  if (hashGeo(g1) !== hashGeo(g2)) problems.push(`${meta.key} 非确定性：位置哈希不同`);
  parts.dispose(g2);
}

const total = rows.reduce((a, r) => a + r.tris, 0);
const totalMeshes = rows.reduce((a, r) => a + r.meshes, 0);
const totalVerts = rows.reduce((a, r) => a + r.verts, 0);

// ---------- 几何自检：体积 + 绕序 ----------
// 闭合件的有符号体积必须为正（法线朝外）；与解析值比较，确认倒角/圆角没有把体量算错。
function signedVolume(geo) {
  const pos = geo.attributes.position, idx = geo.index;
  const n = idx ? idx.count : pos.count;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cr = new THREE.Vector3();
  let v = 0;
  for (let i = 0; i < n; i += 3) {
    const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, ia); b.fromBufferAttribute(pos, ib); c.fromBufferAttribute(pos, ic);
    cr.crossVectors(b, c);
    v += a.dot(cr) / 6;
  }
  return v;
}
const G = parts.G;
const selfChecks = [
  {name: 'rbox 200×100×100 r6', geo: G.rbox(.2, .1, .1, .006, 2), expect: .2 * .1 * .1, tol: .03},
  {name: 'chamferBox 100³ c4', geo: G.cbox(.1, .1, .1, .004), expect: .1 * .1 * .1, tol: .02},
  {name: 'lathe 圆柱 r50 h100', geo: G.lathe([[0, -.05], [.05, -.05], [.05, .05], [0, .05]], 24), expect: Math.PI * .05 * .05 * .1, tol: .02},
  {name: 'sweep 矩形管 20×10 L200', geo: G.sweep([[0, 0, 0], [0, 0, .1], [0, 0, .2]], G.SECT.rect(.02, .01), {segments: 6}), expect: .02 * .01 * .2, tol: .03},
  {name: 'rcyl 圆柱 r10 h30（端盖）', geo: G.rcyl(.01, .03, {seg: 32}), expect: Math.PI * 1e-4 * .03, tol: .03},
  {name: 'rplateHoles 100×60 t3 孔', geo: G.rplateHoles(.1, .06, .003, [{x: 0, y: 0, r: .005}], {r: .006}), expect: (.1 * .06 - Math.PI * .005 * .005) * .003, tol: .04},
  {name: 'curvedPanel 900×600 t1.6', geo: G.curvedPanel(.9, .6, .0016, {crownX: 0, crownY: 0, segX: 6, segZ: 4}), expect: .9 * .6 * .0016, tol: .04}
];
const geoProblems = [];
for (const c of selfChecks) {
  const v = signedVolume(c.geo);
  c.volume = v;
  c.err = Math.abs(v - c.expect) / c.expect;
  if (!(v > 0)) geoProblems.push(`${c.name} 有符号体积为负（法线/绕序反了）：${v.toExponential(3)}`);
  else if (c.err > c.tol) geoProblems.push(`${c.name} 体积偏差 ${(c.err * 100).toFixed(1)}%（${v.toExponential(3)} vs ${c.expect.toExponential(3)}）`);
  problems.push(...[]);
}
if (geoProblems.length) problems.push(...geoProblems);

if (JSON_OUT) {
  console.log(JSON.stringify({version: VERSION, three: THREE.REVISION, total, totalBudget: TOTAL_BUDGET, totalMeshes, totalVerts, rows, selfChecks: selfChecks.map(c => ({name: c.name, volume: c.volume, expect: c.expect, err: c.err})), problems}, null, 2));
} else {
  const cols = [
    {k: 'label', t: '部件', w: 16},
    {k: 'key', t: 'key', w: 15},
    {k: 'tris', t: '三角面', w: 8, right: true},
    {k: 'budget', t: '上限', w: 8, right: true},
    {k: 'pct', t: '用量', w: 7, right: true, fmt: v => v.toFixed(0) + '%'},
    {k: 'meshes', t: '网格', w: 5, right: true},
    {k: 'subparts', t: '子件', w: 5, right: true},
    {k: 'size', t: '尺寸 x×y×z (m)', w: 22, fmt: v => `${v.x}×${v.y}×${v.z}`},
    {k: 'status', t: '状态', w: 7}
  ];
  const line = cols.map(c => '─'.repeat(c.w)).join('─┼─');
  console.log(`\nP 部件库 · 三角面验收  (three r${THREE.REVISION} · ${VERSION})\n`);
  console.log(cols.map(c => pad(c.t, c.w, c.right)).join(' │ '));
  console.log(line);
  for (const r of rows) {
    console.log(cols.map(c => {
      const v = c.fmt ? c.fmt(r[c.k]) : r[c.k];
      return pad(v, c.w, c.right);
    }).join(' │ '));
  }
  console.log(line);
  console.log(`${pad('合计', 16)} │ ${pad('', 15)} │ ${pad(total, 8, true)} │ ${pad(TOTAL_BUDGET, 8, true)} │ ${pad((total / TOTAL_BUDGET * 100).toFixed(0) + '%', 7, true)} │ ${pad(totalMeshes, 5, true)} │ ${pad(rows.reduce((a, r) => a + r.subparts, 0), 5, true)} │ ${pad('', 22)} │ ${pad(total <= TOTAL_BUDGET ? 'OK' : '超预算', 7)}`);

  console.log('\n材质档位分布：');
  const tierCount = new Map();
  for (const r of rows) for (const t of r.tiers) tierCount.set(t, (tierCount.get(t) || 0) + 1);
  console.log('  ' + Array.from(tierCount.entries()).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}(${n})`).join('  '));

  console.log('\n几何自检（有符号体积 / 绕序，负值=法线朝内）：');
  for (const c of selfChecks) {
    console.log(`  ${pad(c.name, 30)}体积 ${c.volume.toExponential(3)}  期望 ${c.expect.toExponential(3)}  偏差 ${(c.err * 100).toFixed(1)}%  ${c.volume > 0 ? '✓' : '✗ 反绕序'}`);
  }

  console.log(`\n顶点 ${totalVerts.toLocaleString('en-US')} · 网格 ${totalMeshes} · 构建耗时 ${Date.now() - t0} ms`);
  console.log(`预算：单件见上表，全部部件加总 ≤ ${TOTAL_BUDGET.toLocaleString('en-US')}（当前 ${total.toLocaleString('en-US')}，余 ${(TOTAL_BUDGET - total).toLocaleString('en-US')}）`);
  if (problems.length) {
    console.log('\n✗ 问题：');
    for (const p of problems) console.log('  - ' + p);
  } else {
    console.log('\n✓ 全部通过：预算、尺寸、结构、确定性（无随机数）');
  }
}

process.exit(problems.length ? 1 : 0);
