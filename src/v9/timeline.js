// =====================================================================
// T 时间轴框架 (v9) —— 声明式、确定性、可嵌套组合、带接触约束
//
// 设计约束（对 v8 的三处硬伤的正面回应）
//   1) 确定性：stateAt(t) 只依赖 t、轨道初始状态与 beat 定义。
//      全程无 performance.now / Date.now / Math.random。拖动进度条回到
//      同一时刻，逐轨道数值逐位相同（verify.mjs 用 JSON 全等做断言）。
//   2) 位移是"给定位移"：move 可以用 by:[dx,dy,dz] 表述相对位移，求解时
//      从轨道在该 beat 起点的已解状态累加；不再每帧 reset 后从头算。
//   3) 接触约束：contact(other, face) 把对象钉在接触面之前，解析求解
//      （对 move 用二分求出首次触面进度并冻结进度），碰不到就正常走，
//      碰到了就"停住"，所有 t 上穿深恒为 0。
//
// 语汇
//   track(id, beats, opts)        一条轨道 = 若干 beat 的顺序表
//   beat                           appear/dissolve/move/path/rotate/scale/deform/flow/contact
//   sequence([...]) parallel([...]) delay(t)   片段组合，可任意嵌套
//   createTimeline(...)           -> { duration, tracks, track(id), stateAt(t), seek(t), get(id), all(), constraints }
//
// 轨道 opts
//   origin:[x,y,z]    初始位置（默认 [0,0,0]）
//   half:[hx,hy,hz]   半尺寸（接触面求解与 verify 的几何来源；自身不渲染）
//   opacity0:number   初始透明度（默认 0，与 v8 的 "默认隐藏" 一致）
//   rot0 / scale0     初始旋转 / 缩放
// =====================================================================

const TWO_PI = Math.PI * 2;
const EPS = 1e-9;

/* ------------------------------ 数值 ------------------------------ */
export const clamp01 = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x);
export const clamp = (x, a, b) => (x <= a ? a : x >= b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const mod = (a, n) => ((a % n) + n) % n;
const fin = (x) => (Number.isFinite(x) ? x : 0);

/* ---------------------------- 缓动库 ---------------------------- */
export const linear = (x) => clamp01(x);
export const smoothstep = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export const easeInCubic = (x) => { x = clamp01(x); return x * x * x; };
export const easeOutCubic = (x) => { x = clamp01(x); return 1 - Math.pow(1 - x, 3); };
export const easeInOutCubic = (x) => { x = clamp01(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeInOutSine = (x) => { x = clamp01(x); return -(Math.cos(Math.PI * x) - 1) / 2; };
export const expoOut = (x) => { x = clamp01(x); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
export const backOut = (x) => { x = clamp01(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
// 轻量 elastic：只用于无接触的收尾（超调量 ~10%），不参与接触求解
export const elastic = (x) => {
  x = clamp01(x);
  if (x === 0 || x === 1) return x;
  const c = TWO_PI / 3;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * c) + 1;
};

export const EASES = Object.freeze({
  linear, smoothstep, easeInCubic, easeOutCubic, easeInOutCubic,
  easeInOutSine, expoOut, backOut, elastic
});

// beat 的 ease 可以写函数，也可以写名字；未知名字回落到 easeInOutCubic
export function easeOf(e) {
  if (typeof e === 'function') return e;
  if (typeof e === 'string' && EASES[e]) return EASES[e];
  return easeInOutCubic;
}

/* ---------------------------- 向量 ---------------------------- */
const V = (x = 0, y = 0, z = 0) => ({x, y, z});
const toV = (v, d = [0, 0, 0]) => {
  if (Array.isArray(v)) return V(fin(+v[0] ?? d[0]), fin(+v[1] ?? d[1]), fin(+v[2] ?? d[2]));
  if (v && typeof v === 'object') return V(fin(+v.x || 0), fin(+v.y || 0), fin(+v.z || 0));
  return V(d[0], d[1], d[2]);
};
const vAdd = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
const vSub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
const vMul = (a, k) => V(a.x * k, a.y * k, a.z * k);
const vDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const vMix = (a, b, k) => V(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k));
const vLen = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

/* ------------------------- 折线路径 ------------------------- */
export function polylineLength(points) {
  const p = points.map((q) => toV(q));
  let s = 0;
  for (let i = 1; i < p.length; i++) s += vLen(vSub(p[i], p[i - 1]));
  return s;
}

// 按弧长比例取点（u∈[0,1]），用于 path 位移与 flow 光点
export function samplePath(points, u) {
  const p = points.map((q) => toV(q));
  if (p.length === 0) return V();
  if (p.length === 1) return p[0];
  const seg = [];
  let total = 0;
  for (let i = 1; i < p.length; i++) { const l = vLen(vSub(p[i], p[i - 1])); seg.push(l); total += l; }
  if (total <= EPS) return p[0];
  let target = clamp01(u) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] <= EPS ? 0 : clamp01(target / seg[i]);
      return vMix(p[i], p[i + 1], k);
    }
    target -= seg[i];
  }
  return p[p.length - 1];
}

/* ============================ beat ============================ */
const FACE_NORMAL = {
  top: V(0, 1, 0), bottom: V(0, -1, 0),
  right: V(1, 0, 0), left: V(-1, 0, 0), '+x': V(1, 0, 0), '-x': V(-1, 0, 0),
  front: V(0, 0, 1), back: V(0, 0, -1), '+z': V(0, 0, 1), '-z': V(0, 0, -1),
  '+y': V(0, 1, 0), '-y': V(0, -1, 0)
};

function beat(kind, channel, o) {
  const b = {...o, kind, channel};
  b.at = o.at;
  b.dur = Math.max(0, +o.dur || 0);
  b.ease = o.ease ?? 'easeInOutCubic';
  return Object.freeze(b);
}

// 进出场（透明度）。d = dur 秒。from 不写则从当前值起。
export const appear = (o = {}) => beat('appear', 'opacity', {to: 1, dur: o.dur ?? .6, ...o});
export const dissolve = (o = {}) => beat('dissolve', 'opacity', {to: 0, dur: o.dur ?? .6, ...o});

// 位移：to 绝对目标位姿（数组 or {x,y,z}），by 相对位移；二者只写一个。
export const move = (o = {}) => beat('move', 'pos', {dur: o.dur ?? .8, ...o});

// 沿折线路径位移：points=[[x,y,z],...]，按弧长匀速（再叠 ease）
export const path = (o = {}) => beat('path', 'pos', {dur: o.dur ?? 1, ...o});

// 旋转：axis ∈ 'x'|'y'|'z'，turns=圈数（可小数），或 to=目标角（弧度）
export const rotate = (o = {}) => beat('rotate', 'rot', {dur: o.dur ?? 1, axis: o.axis ?? 'y', ...o});

// 缩放：to=标量或三元组；by=相对倍数
export const scale = (o = {}) => beat('scale', 'scale', {dur: o.dur ?? .6, ...o});

// 变形：amp=沿 axis 的变形幅度（给曲面/热胀用），axis ∈ 'x'|'y'|'z'
export const deform = (o = {}) => beat('deform', 'deform', {dur: o.dur ?? .6, axis: o.axis ?? 'y', ...o});

// 流动：沿 path 的能量/信号。speed=单位/秒；fill=填充（reach 0→1）所用秒数
export const flow = (o = {}) => beat('flow', 'flow', {dur: o.dur ?? 1, ...o});

// 接触：碰到 other 的 face 就停。可给 plane（自身坐标系里的接触面原点）替代表面推导。
//   contact('floor', {face:'bottom', gap:.004, at:3})
//   contact('pack',  {face:'top', plane:[0,.05,0]})   // other 是父级/刚体基座时显式给面
//   contact('floor', {face:'bottom', release:true, at:6})  // 解除该约束
export function contact(other, o = {}) {
  const spec = {...o};
  spec.other = other ?? null;
  spec.face = o.face ?? 'top';
  spec.gap = o.gap ?? .002;
  spec.release = !!o.release;
  return beat('contact', 'constraint', {...spec, dur: o.dur ?? 0});
}

/* ========================== 片段（fragment） ========================== */
const FRAG = '__timelineFragment';

function makeFragment(items, duration) {
  return Object.freeze({
    [FRAG]: true,
    items: items.map((it) => ({trackId: it.trackId, opts: {...it.opts}, beats: it.beats.slice()})),
    duration
  });
}

// 一条轨道 = 一个片段。未写 at 的 beat 紧接上一个 beat 结束。
export function track(id, beats = [], opts = {}) {
  if (typeof id !== 'string' || !id) throw new TypeError('track(id, beats, opts): id 必须是非空字符串');
  const list = [];
  let cursor = 0;
  for (const raw of beats) {
    if (!raw || !raw.kind) throw new TypeError(`track "${id}": beat 必须是 appear/move/... 的返回值`);
    const at = raw.at == null ? cursor : +raw.at;
    const b = {...raw, at, dur: Math.max(0, +raw.dur || 0)};
    list.push(b);
    cursor = Math.max(cursor, at + b.dur);
  }
  const duration = list.reduce((m, b) => Math.max(m, b.at + b.dur), 0);
  return makeFragment([{trackId: id, opts, beats: list}], duration);
}

function collect(input, out) {
  if (input == null || input === false) return out;
  if (Array.isArray(input)) { for (const x of input) collect(x, out); return out; }
  if (input[FRAG]) { out.push(input); return out; }
  throw new TypeError('组合只接受 track()/sequence()/parallel()/delay() 的返回值');
}

// 顺序组合：片段首尾相接，偏移累加（可嵌套）
export function sequence(...items) {
  const frags = collect(items, []);
  let off = 0;
  const merged = [];
  for (const f of frags) {
    for (const it of f.items) {
      merged.push({
        trackId: it.trackId, opts: it.opts,
        beats: it.beats.map((b) => ({...b, at: b.at + off}))
      });
    }
    off += f.duration;
  }
  return makeFragment(merged, off);
}

// 并行组合：全部从 0 开始，时长取最长
export function parallel(...items) {
  const frags = collect(items, []);
  let dur = 0;
  const merged = [];
  for (const f of frags) {
    dur = Math.max(dur, f.duration);
    for (const it of f.items) merged.push(it);
  }
  return makeFragment(merged, dur);
}

// 空档：只占时长，不产生任何动作
export function delay(t = 1) { return makeFragment([], Math.max(0, +t || 0)); }

/* ========================== 轨道预处理 ========================== */
const CHANNELS = ['opacity', 'pos', 'rot', 'scale', 'deform', 'flow'];

function makeTrack(id, beats, opts) {
  // 稳定排序：同一时刻按书写顺序
  const sorted = beats
    .map((b, i) => ({b, i}))
    .sort((A, B) => (A.b.at - B.b.at) || (A.i - B.i))
    .map((x) => x.b);

  const byChannel = {opacity: [], pos: [], rot: [], scale: [], deform: [], flow: []};
  const constraints = [];
  for (const b of sorted) {
    if (b.channel === 'constraint') constraints.push(b);
    else if (byChannel[b.channel]) byChannel[b.channel].push(b);
    else throw new TypeError(`track "${id}": 未知的 beat 类型 ${b.kind}`);
  }
  const duration = sorted.reduce((m, b) => Math.max(m, b.at + b.dur), 0);
  return {
    id,
    opts: {...opts},
    beats: sorted,
    byChannel,
    constraints,
    duration,
    initial: {
      opacity: opts.opacity0 ?? 0,
      pos: toV(opts.origin, [0, 0, 0]),
      rot: toV(opts.rot0, [0, 0, 0]),
      scale: toV(opts.scale0, [1, 1, 1]),
      deform: {amp: 0, axis: opts.deformAxis ?? 'y'},
      flow: {u: 0, dist: 0, reach: 0, len: 0, active: false}
    }
  };
}

/* ======================= 接触约束求解 ======================= */
function normalOf(b) {
  if (b.normal) {
    const n = toV(b.normal, [0, 1, 0]);
    const l = vLen(n);
    return l > EPS ? vMul(n, 1 / l) : V(0, 1, 0);
  }
  return FACE_NORMAL[b.face] ? {...FACE_NORMAL[b.face]} : V(0, 1, 0);
}

// 约束 = 一个半空间 {point, normal, clearance}：
//   d(p) = dot(p - point, normal) - clearance ; d < 0 即已穿入。
function buildConstraint(b, T, ref) {
  const n = normalOf(b);
  const half = toV(T.opts.half, [0, 0, 0]);
  const gap = b.gap ?? .002;
  const clearance = gap + Math.abs(n.x) * half.x + Math.abs(n.y) * half.y + Math.abs(n.z) * half.z;
  let point;
  if (b.plane) {
    point = toV(b.plane);                       // 约束面写在自身坐标系
  } else if (b.other) {
    const o = ref ? ref(b.other) : null;
    if (!o) return null;                        // 参考轨道不可解析（相位一），跳过
    const oh = o.half ? toV(o.half) : V(0, 0, 0);
    const off = Math.abs(n.x) * oh.x + Math.abs(n.y) * oh.y + Math.abs(n.z) * oh.z;
    point = vAdd(o.pos, vMul(n, off));          // other 自身半尺寸定出接触面
  } else {
    point = V(0, 0, 0);
  }
  return {other: b.other ?? null, face: b.face, normal: n, point, clearance, gap, at: b.at};
}

const cDist = (c, p) => vDot(vSub(p, c.point), c.normal) - c.clearance;

function activeConstraints(T, t, ref) {
  if (!T.constraints.length) return [];
  const live = new Map();
  for (const b of T.constraints) {
    if (t < b.at) continue;
    const key = `${b.other ?? 'plane'}|${b.face}|${b.plane ? 'p' : 'o'}`;
    if (b.release) live.delete(key);
    else live.set(key, b);
  }
  const out = [];
  for (const b of live.values()) {
    const c = buildConstraint(b, T, ref);
    if (c) out.push(c);
  }
  return out;
}

// 硬保证：任何 beat 之后若落到面内，沿法向推回面外（穿深 = 0）
function projectOut(pos, cons) {
  if (!cons.length) return pos;
  let p = pos;
  for (const c of cons) {
    const d = cDist(c, p);
    if (d < 0) p = vSub(p, vMul(c.normal, d));
  }
  return p;
}

// 第一次触面的原始进度（在 ease 之后的位置上求根），没有触面则返回 1
function stopProgress(cur, target, ease, cons) {
  let s = 1;
  for (const c of cons) {
    const dB = cDist(c, target);
    if (!(dB < -1e-12)) continue;               // 目标没穿面 -> 本约束不介入
    let lo = 0, hi = 1;
    for (let i = 0; i < 48; i++) {
      const m = (lo + hi) / 2;
      const p = vMix(cur, target, ease(m));
      if (cDist(c, p) > 0) lo = m; else hi = m;
    }
    if (hi < s) s = hi;
  }
  return s;
}

/* ======================= 逐通道求解 ======================= */
function walk(T, t, channel, initial, apply) {
  let cur = initial;
  for (const b of T.byChannel[channel]) {
    const end = b.at + b.dur;
    if (t >= end) { cur = apply(b, cur, 1); continue; }
    if (t >= b.at) return apply(b, cur, (t - b.at) / Math.max(b.dur, EPS));
    break;
  }
  return cur;
}

function solvePos(T, t, ref) {
  let cur = T.initial.pos;
  let hit = null;
  for (const b of T.byChannel.pos) {
    const end = b.at + b.dur;
    // 关键：约束只在"它自己生效之后"的时段内起作用，所以按 beat 的时刻取约束集，
    // 后续才出现的 contact 不会回过头来改写已完成的位移。
    if (t >= end) {
      const cons = activeConstraints(T, end, ref);
      const e = easeOf(b.ease);
      const s = b.kind === 'move' ? stopProgress(cur, posEnd(b, cur), e, cons) : 1;
      if (s < 1) hit = {other: firstHit(cons), at: b.at + s * b.dur};
      cur = projectOut(posAt(b, cur, Math.min(1, s), e), cons);
      continue;
    }
    if (t >= b.at) {
      const cons = activeConstraints(T, t, ref);
      const u = (t - b.at) / Math.max(b.dur, EPS);
      const e = easeOf(b.ease);
      const target = posTarget(b, cur);
      const s = b.kind === 'move' ? stopProgress(cur, target, e, cons) : 1;
      const uu = Math.min(u, s);
      const pos = projectOut(posAt(b, cur, uu, e), cons);
      if (s < 1 && u >= s) hit = {other: firstHit(cons), at: b.at + s * b.dur};
      return {pos, hit, cons};
    }
    break;
  }
  const cons = activeConstraints(T, t, ref);
  return {pos: projectOut(cur, cons), hit, cons};
}

function firstHit(cons) {
  for (const c of cons) return c.other;
  return null;
}

function posTarget(b, cur) {
  if (b.kind === 'path') return samplePath(b.points || [], 1);
  if (b.to != null) return toV(b.to);
  if (b.by != null) return vAdd(cur, toV(b.by));
  return cur;
}

function posAt(b, cur, u, e) {
  const k = e(u);
  if (b.kind === 'path') return samplePath(b.points || [], k);
  return vMix(cur, posTarget(b, cur), k);
}

function posEnd(b, cur) {
  if (b.kind === 'path') return samplePath(b.points || [], 1);
  return posTarget(b, cur);
}

function solveScalar(T, t, channel) {
  return fin(walk(T, t, channel, T.initial[channel], (b, cur, u) => {
    const e = easeOf(b.ease)(u);
    const from = b.from != null ? +b.from : cur;
    const to = b.to != null ? +b.to : cur;
    return lerp(from, to, e);
  }));
}

function solveVec(T, t, channel) {
  return walk(T, t, channel, {...T.initial[channel]}, (b, cur, u) => {
    const e = easeOf(b.ease)(u);
    if (channel === 'rot') {
      const axis = b.axis === 'x' || b.axis === 'z' ? b.axis : 'y';
      const from = b.from != null ? +b.from : cur[axis];
      const to = b.to != null ? +b.to : (b.turns != null ? from + (+b.turns) * TWO_PI : from);
      return {...cur, [axis]: lerp(from, to, e)};
    }
    // scale
    const out = {...cur};
    const to = b.to;
    const by = b.by;
    for (const k of ['x', 'y', 'z']) {
      const f = b.from != null ? (Array.isArray(b.from) ? toV(b.from)[k] : +b.from) : cur[k];
      let tv = f;
      if (to != null) tv = Array.isArray(to) ? toV(to)[k] : +to;
      else if (by != null) tv = f * (Array.isArray(by) ? toV(by)[k] : +by);
      out[k] = lerp(f, tv, e);
    }
    return out;
  });
}

function solveDeform(T, t) {
  return walk(T, t, 'deform', {...T.initial.deform}, (b, cur, u) => {
    const e = easeOf(b.ease)(u);
    const from = b.from != null ? +b.from : cur.amp;
    const to = b.amp != null ? +b.amp : cur.amp;
    return {amp: fin(lerp(from, to, e)), axis: b.axis ?? cur.axis};
  });
}

function solveFlow(T, t) {
  const beats = T.byChannel.flow;
  let active = null;
  for (const b of beats) if (t >= b.at) active = b;
  if (!active) return {u: 0, dist: 0, reach: 0, len: 0, active: false};
  const pts = active.path || [];
  const len = polylineLength(pts);
  const speed = +active.speed || 0;
  const elapsed = Math.max(0, t - active.at);
  const dist = elapsed * speed;
  const u = len > EPS ? mod(dist / len, 1) : 0;
  const fill = active.fill != null ? +active.fill : (active.dur || 1);
  const reach = fill > EPS ? clamp01(elapsed / fill) : 1;
  return {u: fin(u), dist: fin(dist), reach: fin(reach), len: fin(len), active: reach > 0};
}

/* ========================== 时间轴 ========================== */
export function createTimeline(...input) {
  const frags = collect(input, []);
  const merged = new Map();
  for (const f of frags) {
    for (const it of f.items) {
      if (!merged.has(it.trackId)) merged.set(it.trackId, {opts: {}, beats: []});
      const m = merged.get(it.trackId);
      Object.assign(m.opts, it.opts);
      for (const b of it.beats) m.beats.push(b);
    }
  }

  const tracks = [];
  const byId = new Map();
  for (const [id, m] of merged) {
    const T = makeTrack(id, m.beats, m.opts);
    tracks.push(T);
    byId.set(id, T);
  }
  const duration = Math.max(
    frags.reduce((m, f) => Math.max(m, f.duration), 0),
    tracks.reduce((m, T) => Math.max(m, T.duration), 0)
  );

  function stateAt(time) {
    const t = clamp(fin(+time), 0, duration);

    // 相位一：先解出各轨道的"无约束位姿"，供约束面推导使用
    const rawPos = new Map();
    for (const T of tracks) rawPos.set(T.id, solvePos(T, t, null).pos);
    const ref = (id) => {
      const T2 = byId.get(id);
      if (!T2) return null;
      return {pos: rawPos.get(id), half: T2.opts.half};
    };

    // 相位二：带约束求解（接触面取自相位一，避免循环依赖）
    const out = {};
    for (const T of tracks) {
      const solved = solvePos(T, t, ref);
      const opacity = clamp01(solveScalar(T, t, 'opacity'));
      const cons = solved.cons;
      let clear = Infinity;
      for (const c of cons) clear = Math.min(clear, cDist(c, solved.pos));
      out[T.id] = {
        id: T.id,
        opacity: fin(opacity),
        visible: opacity > .003,
        pos: solved.pos,
        rot: solveVec(T, t, 'rot'),
        scale: solveVec(T, t, 'scale'),
        deform: solveDeform(T, t),
        flow: solveFlow(T, t),
        contact: {
          hit: !!solved.hit,
          other: solved.hit ? solved.hit.other : null,
          at: solved.hit ? solved.hit.at : null,
          count: cons.length,
          depth: 0,                                  // 解完之后恒为 0：不穿透
          clearance: fin(clear === Infinity ? 0 : clear)
        }
      };
    }
    return out;
  }

  let cursor = 0;
  const api = {
    duration,
    tracks: tracks.map((T) => T.id),
    constraints: tracks.flatMap((T) => T.constraints.map((b) => ({
      track: T.id, other: b.other ?? null, face: b.face ?? null,
      normal: normalOf(b), gap: b.gap ?? .002,
      half: T.opts.half ?? [0, 0, 0], plane: b.plane ?? null,
      at: b.at, release: !!b.release
    }))),
    track(id) {
      const T = byId.get(id);
      if (!T) return null;
      return {
        id: T.id,
        duration: T.duration,
        half: T.opts.half ?? [0, 0, 0],
        origin: T.opts.origin ?? [0, 0, 0],
        beats: T.beats.map((b) => ({kind: b.kind, at: b.at, dur: b.dur, ease: b.ease})),
        at: (time) => stateAt(time)[id]
      };
    },
    stateAt,
    seek(time) { cursor = clamp(fin(+time), 0, duration); return api; },
    get(id) { return stateAt(cursor)[id]; },
    all() { return stateAt(cursor); },
    get cursor() { return cursor; }
  };
  return api;
}
