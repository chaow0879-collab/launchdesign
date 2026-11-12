#!/usr/bin/env node
// =====================================================================
// demo/verify.mjs —— 对 engineering-2 六个镜头做 200 点采样断言
//
//   node src/v9/demo/verify.mjs
//
// 断言：
//   A. 幂等       同一 t 调两次 stateAt，逐字节相同
//   B. 确定性     重建一次时间轴（同一份声明），200 个采样点逐字节相同
//   C. 连续       相邻采样的位移/转角/透明度增量都在阈值内（不允许瞬移）
//   D. 不穿透     所有 contact 约束在生效时段内 穿深 ≤ 0
//   E. 真接触     每个镜头至少有一条约束真的贴到面上（min |d| < 1e-3）
//   F. 无源        源码里没有时钟/随机数调用（BANNED 列表见文件后半）
// =====================================================================
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {getShot, SHOT_COUNT, unitsById} from './engineering-2.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SAMPLES = 200;
const POS_STEP_MAX = 0.12;      // 每步最大位移（200 点/镜头，约等于 ≤ 3 m/s 的可见上限）
const ROT_STEP_MAX = 4.00;      // 每步最大转角（螺栓 6 圈/1.6s，峰值约 2.4 rad/步）
const OP_STEP_MAX = 0.55;       // 每步最大透明度变化（0.25 s 淡入淡出在 200 点采样下的峰值约 0.5）

const results = [];
let PASS = 0, FAIL = 0;
const fails = [];

function ok(name) { PASS++; }
function bad(name, detail) { FAIL++; fails.push(`${name}: ${detail}`); }

function halfOf(unit) {
  return unit.size ? [unit.size[0] / 2, unit.size[1] / 2, unit.size[2] / 2] : [0, 0, 0];
}

// 独立于框架的几何检查：用状态位姿 + 单位半尺寸 + 约束定义重算穿深
function penetration(state, cons, units) {
  const n = cons.normal;
  const half = cons.half || halfOf(units.get(cons.track));
  const clearance = (cons.gap ?? 0.002)
    + Math.abs(n.x) * half[0] + Math.abs(n.y) * half[1] + Math.abs(n.z) * half[2];
  let point;
  if (cons.plane) {
    point = {x: cons.plane[0], y: cons.plane[1], z: cons.plane[2]};
  } else {
    const otherUnit = units.get(cons.other);
    const otherState = state[cons.other];
    if (!otherUnit || !otherState) return null;
    const oh = otherUnit.half || halfOf(otherUnit);
    const off = Math.abs(n.x) * oh[0] + Math.abs(n.y) * oh[1] + Math.abs(n.z) * oh[2];
    point = {
      x: otherState.pos.x + n.x * off,
      y: otherState.pos.y + n.y * off,
      z: otherState.pos.z + n.z * off
    };
  }
  const p = state[cons.track].pos;
  return (p.x - point.x) * n.x + (p.y - point.y) * n.y + (p.z - point.z) * n.z - clearance;
}

function fmt(x, d = 4) { return Number(x).toFixed(d); }

// ---------------------------------------------------------------- 逐镜头
for (let s = 0; s < SHOT_COUNT; s++) {
  const shot = getShot(s);
  const tl = shot.timeline;
  const units = unitsById(shot);
  const dur = tl.duration;
  const ts = Array.from({length: SAMPLES + 1}, (_, i) => (i / SAMPLES) * dur);

  // A. 幂等
  let idem = 0;
  for (const t of ts) {
    const a = JSON.stringify(tl.stateAt(t));
    const b = JSON.stringify(tl.stateAt(t));
    if (a === b) idem++; else bad(`${shot.id} 幂等 t=${fmt(t, 3)}`, '两次结果不同');
  }
  if (idem === ts.length) ok(`${shot.id} 幂等 ${idem}/${ts.length}`);

  // B. 确定性：重建同一份声明
  const rebuilt = getShot(s).timeline;
  let det = 0;
  for (const t of ts) {
    if (JSON.stringify(tl.stateAt(t)) === JSON.stringify(rebuilt.stateAt(t))) det++;
    else bad(`${shot.id} 确定性 t=${fmt(t, 3)}`, '重建后结果不同');
  }
  if (det === ts.length) ok(`${shot.id} 确定性 ${det}/${ts.length}`);

  // 顺序无关：倒序遍历结果与正序一致
  let order = 0;
  const fwd = new Map(ts.map((t) => [t, JSON.stringify(tl.stateAt(t))]));
  for (let i = ts.length - 1; i >= 0; i--) {
    if (JSON.stringify(tl.stateAt(ts[i])) === fwd.get(ts[i])) order++;
    else bad(`${shot.id} 顺序无关 t=${fmt(ts[i], 3)}`, '倒序采样结果不同');
  }
  if (order === ts.length) ok(`${shot.id} 顺序无关 ${order}/${ts.length}`);

  // C. 连续
  let maxPos = 0, maxRot = 0, maxOp = 0, worstPos = '', worstRot = '';
  let steps = 0;
  for (let i = 1; i < ts.length; i++) {
    const a = tl.stateAt(ts[i - 1]), b = tl.stateAt(ts[i]);
    for (const id of tl.tracks) {
      const pa = a[id].pos, pb = b[id].pos;
      const dp = Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z);
      steps++;
      if (dp > maxPos) { maxPos = dp; worstPos = `${id}@${fmt(ts[i], 2)}`; }
      const ra = a[id].rot, rb = b[id].rot;
      const dr = Math.max(Math.abs(rb.x - ra.x), Math.abs(rb.y - ra.y), Math.abs(rb.z - ra.z));
      maxRot = Math.max(maxRot, dr);
      if (dr > ROT_STEP_MAX) bad(`${shot.id} 转角跳变 ${id} @${fmt(ts[i], 3)}`, `${fmt(dr, 3)} rad`);
      const dop = Math.abs(b[id].opacity - a[id].opacity);
      maxOp = Math.max(maxOp, dop);
      if (dop > OP_STEP_MAX) bad(`${shot.id} 透明度跳变 ${id} @${fmt(ts[i], 3)}`, fmt(dop, 3));
    }
  }
  if (maxPos <= POS_STEP_MAX) ok(`${shot.id} 位移连续 ${steps} 步（max ${fmt(maxPos, 4)} ≤ ${POS_STEP_MAX}）`);
  else bad(`${shot.id} 位移连续`, `max ${fmt(maxPos, 4)} > ${POS_STEP_MAX} @${worstPos}`);

  // D. 不穿透 / E. 真接触
  const cons = tl.constraints.filter((c) => !c.release);
  let minD = Infinity, hitCount = 0, checked = 0;
  const perCons = [];
  for (const c of cons) {
    const unit = units.get(c.track);
    if (!unit) { bad(`${shot.id} 约束对象缺失`, c.track); continue; }
    if (!c.plane && c.other && units.has(c.other)) {
      const fu = unit.parent || null, fo = units.get(c.other).parent || null;
      if (fu !== fo) bad(`${shot.id} 约束坐标系不一致`, `${c.track}(${fu}) vs ${c.other}(${fo})`);
    }
    let cMin = Infinity, cHit = null;
    for (const t of ts) {
      if (t < c.at) continue;
      const st = tl.stateAt(t);
      const d = penetration(st, c, units);
      if (d == null) { bad(`${shot.id} 约束面无法解析`, `${c.track} vs ${c.other}`); break; }
      checked++;
      if (d < cMin) cMin = d;
      if (Math.abs(d) < 1e-3 && cHit == null) cHit = t;
      if (d < -1e-6) bad(`${shot.id} 穿透 ${c.track}→${c.other} t=${fmt(t, 3)}`, `d=${fmt(d, 6)}`);
    }
    minD = Math.min(minD, cMin);
    if (cHit != null) { hitCount++; perCons.push({track: c.track, other: c.other, hitAt: cHit, minD: cMin}); }
    else perCons.push({track: c.track, other: c.other, hitAt: null, minD: cMin});
  }
  if (checked > 0 && minD >= -1e-6) ok(`${shot.id} 不穿透 ${checked} 次判定（min d ${fmt(minD, 6)}）`);
  if (hitCount > 0) ok(`${shot.id} 真接触 ${hitCount}/${cons.length} 条约束贴到面（${perCons.filter((p) => p.hitAt != null).map((p) => `${p.track}@${fmt(p.hitAt, 2)}`).join(', ')}）`);
  else if (cons.length) bad(`${shot.id} 真接触`, '没有任何约束真正贴到面');

  results.push({shot, dur, ts, maxPos, maxRot, maxOp, cons: perCons, units});
}

// ---------------------------------------------------------------- F. 无源
// 禁用的三类调用：时钟（now 类）与随机数。这里把名字拼起来，避免本文件自己
// 成为全仓 grep 的命中项。
const BANNED = ['Math' + '.random', 'Date' + '.now', 'performance' + '.now'];
const SOURCES = ['../timeline.js', './engineering-2.js'];
for (const rel of SOURCES) {
  const file = join(HERE, rel);
  const src = readFileSync(file, 'utf8');
  const hits = BANNED.filter((k) => src.includes(k));
  if (hits.length === 0) ok(`无源 ${rel}`);
  else bad(`无源 ${rel}`, hits.join(','));
}

// ---------------------------------------------------------------- 输出
console.log('\n=== 镜头时长 ===');
for (const r of results) {
  console.log(`  ${r.shot.id}  ${String(r.dur.toFixed(2)).padStart(5)} s  ${String(r.shot.units.length).padStart(3)} units  ${String(r.shot.timeline.tracks.length).padStart(3)} tracks  ${String(r.shot.timeline.constraints.length).padStart(2)} 约束  ${r.shot.title}`);
}
const total = results.reduce((m, r) => m + r.dur, 0);
console.log(`  合计 ${total.toFixed(2)} s`);

console.log('\n=== 接触判定（独立重算穿深）===');
for (const r of results) {
  const hit = r.cons.filter((c) => c.hitAt != null);
  console.log(`  ${r.shot.id}  约束 ${r.cons.length} / 贴面 ${hit.length} / 最小间隙 ${fmt(Math.min(...r.cons.map((c) => c.minD)), 5)}`);
  for (const c of r.cons.slice(0, 6)) {
    console.log(`      ${c.track.padEnd(12)} → ${String(c.other).padEnd(12)} ${c.hitAt != null ? 'hit@' + fmt(c.hitAt, 2) : '未贴面'}  minD=${fmt(c.minD, 5)}`);
  }
  if (r.cons.length > 6) console.log(`      … 其余 ${r.cons.length - 6} 条`);
}

// 动作表（markdown）
const rows = [];
rows.push('| 镜 | 时长 | 对象 | 动作 | 时间窗 | 缓动 | 接触 |');
rows.push('|---|---|---|---|---|---|---|');
for (const r of results) {
  const tl = r.shot.timeline;
  for (const id of tl.tracks) {
    const view = tl.track(id);
    if (!view || !view.beats.length) continue;
    for (const b of view.beats) {
      const c = r.shot.timeline.constraints.find((k) => k.track === id && Math.abs(k.at - b.at) < 1e-9);
      rows.push(`| ${r.shot.id} | ${r.dur.toFixed(2)} | ${id} | ${b.kind} | ${b.at.toFixed(2)}–${(b.at + b.dur).toFixed(2)} | ${easeName(b)} | ${c ? (c.other || 'plane') + ':' + c.face : ''} |`);
    }
  }
}
function easeName(b) {
  // beat 上的 ease 已被 normalise 成字符串或函数；这里只取个名字
  const e = b.ease;
  if (typeof e === 'string') return e;
  return 'custom';
}
const table = rows.join('\n');
mkdirSync(join(HERE, 'out'), {recursive: true});
writeFileSync(join(HERE, 'out', 'action-table.md'), table + '\n', 'utf8');

console.log('\n=== 断言汇总 ===');
console.log(`  通过 ${PASS} / 失败 ${FAIL}`);
if (FAIL) {
  console.log('  失败项：');
  for (const f of fails.slice(0, 20)) console.log('   - ' + f);
  process.exitCode = 1;
} else {
  console.log('  全部通过');
}
console.log(`  动作表 → ${join(HERE, 'out', 'action-table.md')}`);
