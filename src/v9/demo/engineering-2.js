// =====================================================================
// demo/engineering-2.js —— 用 T 时间轴框架重写 engineering-2（集成电池、电驱与底盘）
//
// 纯数据 + 纯函数，不 import three：Node 里可直接被 verify.mjs 采样，
// 浏览器里由 bind-three.js 按 units 建网格、按 state 写位姿。
//
// 一套坐标：x = 车长（+x 车头），y = 高（地面 y=0），z = 车宽（+z 左侧）。
// 电池包锚点 = 托盘中心；pack.half = [1.15, .225, .68]，
// 其中 .225 是"锚点到包顶面"的距离 —— 托盘中心到顶盖外表面的高度，
// 接触地板下表面时用它算 clearance（见各 shot 的 contact 注释）。
// =====================================================================
import {
  createTimeline, track, parallel,
  appear, dissolve, move, path, rotate, scale, deform, flow, contact
} from '../timeline.js';

export const COL = {
  cyan: 0x58E1FF, blue: 0x3d8bff, teal: 0x2fe3c0, green: 0x5dff9a,
  amber: 0xffb547, orange: 0xff7a2f, red: 0xff4d5e, violet: 0xa98bff,
  white: 0xeaf6ff, steel: 0x9fb3c2, deep: 0x1b2b36
};

/* ------------------------------ 常量 ------------------------------ */
const PACK_Y = 0.541;                    // 托盘中心最终高度（顶盖外表面 .766，地板下表面 .77）
const PACK_HALF = [1.15, 0.225, 0.68];
const MOD_X = [-0.95, -0.572, -0.194, 0.184, 0.562, 0.94];
const MOD_Z = [0.32, -0.32];
const MOD_REST_Y = 0.138;                // 模组落在冷板上的局部高度
const PLATE_Y = 0.064;                   // 冷板贴合托盘后的局部高度
const BOLT_REST_Y = 0.225;               // 螺栓拧到底的局部高度
const BOLT_START_Y = 0.285;              // 螺栓进给起点（比座面高 .06）

// 冷却流道（蛇形，贴在冷板上）
const SERP = (() => {
  const p = [];
  for (let i = 0; i <= 8; i++) {
    const x = -1.02 + i * (2.04 / 8);
    p.push([x, 0.082, i % 2 ? 0.60 : -0.60]);
  }
  return p;
})();

// 高压线束（电池包 → 前逆变器 / 后电机）
const CABLE_F = [[1.04, 0.60, 0.18], [1.16, 0.585, 0.20], [1.28, 0.535, 0.18], [1.33, 0.485, 0.10]];
const CABLE_R = [[1.02, 0.575, 0.06], [0.70, 0.525, 0.20], [0.00, 0.505, 0.22], [-0.60, 0.465, 0.20], [-0.98, 0.425, 0.16]];
const INV_PATH = [[1.13, 0.465, 0.06], [1.30, 0.465, 0.00], [1.40, 0.465, -0.06]];
const MOTOR_PATH = [[-1.00, 0.425, 0.12], [-1.08, 0.425, 0.00], [-1.16, 0.425, -0.12]];
const BUS_PATH = [[-1.00, 0.20, 0.32], [0.00, 0.20, 0.32], [1.00, 0.20, 0.32]];

// 冷却回路（电池 → 后电驱 → 前散热器 → 泵 → 电池），u 沿回路
const LOOP = [
  [1.52, 0.55, 0.30], [1.30, 0.50, 0.32], [0.90, 0.44, 0.34], [0.30, 0.40, 0.38],
  [-0.40, 0.40, 0.34], [-0.95, 0.44, 0.18], [-1.14, 0.40, -0.10], [-0.90, 0.36, -0.38],
  [0.00, 0.36, -0.42], [0.70, 0.38, -0.38], [1.20, 0.44, -0.30], [1.46, 0.52, -0.28],
  [1.56, 0.55, 0.00], [1.52, 0.55, 0.30]
];
const LOOP_STAGES = [
  {from: 0.00, to: 0.42, color: COL.orange, name: '电池吸热'},
  {from: 0.42, to: 0.56, color: COL.amber, name: '后电驱'},
  {from: 0.56, to: 0.72, color: COL.blue, name: '散热器放热'},
  {from: 0.72, to: 1.00, color: COL.cyan, name: '回水'}
];
const AIR_L = [[1.05, 1.10, 0.30], [0.70, 1.16, 0.38], [0.10, 1.20, 0.40], [-0.60, 1.14, 0.35]];
const AIR_R = [[1.05, 1.10, -0.30], [0.70, 1.16, -0.38], [0.10, 1.20, -0.40], [-0.60, 1.14, -0.35]];

/* ------------------------------ 单位表 ------------------------------ */
// unit: 渲染与接触共用的几何数据。alpha = 材质基色透明度；opacity = 初始可见度。
function u() { /* 保留占位，避免误用 */ }
const staticUnit = (x) => ({opacity: 1, ...x});

function structure(withCabin = false) {
  const arch = (id, x, z) => staticUnit({
    id, kind: 'torus', r: 0.34, tube: 0.028, arc: Math.PI,
    pos: [x, 0.32, z], color: 0x7d8e9b, alpha: 0.55
  });
  const list = [
    staticUnit({id: 'ground', kind: 'box', size: [9, 0.02, 7], pos: [0, -0.01, 0], color: 0x0a1017, alpha: 1}),
    staticUnit({id: 'floorSlab', kind: 'box', size: [2.4, 0.06, 1.5], pos: [0, 0.80, 0], color: 0x3f7fa0, alpha: 0.16, edge: true}),
    staticUnit({id: 'railL', kind: 'box', size: [2.7, 0.08, 0.08], pos: [0, 0.87, 0.56], color: COL.steel, alpha: 0.6}),
    staticUnit({id: 'railR', kind: 'box', size: [2.7, 0.08, 0.08], pos: [0, 0.87, -0.56], color: COL.steel, alpha: 0.6}),
    staticUnit({id: 'crossA', kind: 'box', size: [0.10, 0.05, 1.5], pos: [-0.70, 0.845, 0], color: 0x51656f, alpha: 0.5}),
    staticUnit({id: 'crossB', kind: 'box', size: [0.10, 0.05, 1.5], pos: [0.00, 0.845, 0], color: 0x51656f, alpha: 0.5}),
    staticUnit({id: 'crossC', kind: 'box', size: [0.10, 0.05, 1.5], pos: [0.70, 0.845, 0], color: 0x51656f, alpha: 0.5}),
    arch('archFL', 1.02, 0.62), arch('archFR', 1.02, -0.62),
    arch('archRL', -1.00, 0.62), arch('archRR', -1.00, -0.62)
  ];
  if (withCabin) {
    list.push(staticUnit({id: 'cabinFloor', kind: 'box', size: [2.2, 0.02, 1.3], pos: [0, 1.02, 0], color: 0x2a3a46, alpha: 0.22}));
  }
  return list;
}

function packUnits({withModules = true, withBolts = true, withLid = true} = {}) {
  const list = [
    staticUnit({id: 'pack', kind: 'box', size: [2.3, 0.10, 1.36], half: PACK_HALF, pos: [3.6, 0.02, 0], color: 0x3d4c58, edge: true}),
    staticUnit({id: 'coldPlate', kind: 'box', size: [2.24, 0.02, 1.30], pos: [0, PLATE_Y, 0], parent: 'pack', color: 0x6d8494, alpha: 0.9, opacity: 0}),
    staticUnit({id: 'coolSerp', kind: 'tube', r: 0.014, path: SERP, pos: [0, 0, 0], parent: 'pack', color: 0x2aa9ff, glow: true, opacity: 0}),
    staticUnit({id: 'seal', kind: 'line', path: [[-1.15, 0.05, 0.68], [1.15, 0.05, 0.68], [1.15, 0.05, -0.68], [-1.15, 0.05, -0.68], [-1.15, 0.05, 0.68]], pos: [0, 0, 0], parent: 'pack', color: COL.green, opacity: 0}),
    staticUnit({id: 'msd', kind: 'box', size: [0.14, 0.08, 0.12], pos: [1.02, 0.21, 0], parent: 'pack', color: COL.orange, edge: true, alpha: 0.95, opacity: 0}),
    staticUnit({id: 'busA', kind: 'tube', r: 0.012, path: BUS_PATH, pos: [0, 0, 0], parent: 'pack', color: COL.orange, glow: true, opacity: 0}),
    staticUnit({id: 'busB', kind: 'tube', r: 0.012, path: BUS_PATH.map(([x, y, z]) => [x, y, -z]), pos: [0, 0, 0], parent: 'pack', color: COL.orange, glow: true, opacity: 0}),
    staticUnit({id: 'hvPort', kind: 'box', size: [0.10, 0.08, 0.16], pos: [1.12, 0.16, 0.18], parent: 'pack', color: COL.orange, edge: true, alpha: 0.9, opacity: 0})
  ];
  if (withModules) {
    for (let i = 0; i < 12; i++) {
      list.push(staticUnit({
        id: `mod${i}`, kind: 'box', size: [0.33, 0.12, 0.60], pos: [MOD_X[i >> 1], MOD_REST_Y, MOD_Z[i & 1]],
        parent: 'pack', color: 0x22303b, edge: true, alpha: 0.95, opacity: 0, glowTop: COL.teal
      }));
    }
  }
  if (withBolts) {
    for (let i = 0; i < 12; i++) {
      list.push(staticUnit({
        id: `bolt${i}`, kind: 'hex', r: 0.028, h: 0.05, pos: [MOD_X[i >> 1] + 0.19, BOLT_REST_Y, MOD_Z[i & 1]],
        parent: 'pack', color: COL.amber, alpha: 0.95, opacity: 0
      }));
    }
  }
  if (withLid) {
    list.push(staticUnit({id: 'lid', kind: 'box', size: [2.30, 0.02, 1.36], pos: [0, 0.215, 0], parent: 'pack', color: 0x4a6271, alpha: 0.5, edge: true, opacity: 0}));
  }
  return list;
}

function driveUnits() {
  const list = [
    staticUnit({id: 'subframe', kind: 'box', size: [2.20, 0.06, 1.10], pos: [0, 0.30, 0], color: 0x7d8e9b, alpha: 0.5, edge: true})
  ];
  for (const [tag, x, y, s] of [['R', -1.00, 1.10, 1], ['F', 1.05, 1.20, 0.85]]) {
    // 电驱落在副车架（上表面 .33）上的最终轴心高度：.33 + gap + 半高
    const yAxle = 0.33 + 0.006 + 0.15 * s;
    list.push(staticUnit({
      id: `motor${tag}`, kind: 'cyl', axis: 'z', r: 0.15, h: 0.34, scale: s,
      pos: [x, y, 0], half: [0.15 * s, 0.15 * s, 0.17 * s],
      color: 0x8796a3, edge: true, alpha: 0.95, opacity: 0
    }));
    list.push(staticUnit({
      id: `inv${tag}`, kind: 'box', size: [0.26 * s, 0.12 * s, 0.30 * s],
      pos: [x, y + 0.21 * s, 0.04], color: 0x404f5c, edge: true, alpha: 0.95, opacity: 0
    }));
    for (const [side, z] of [['L', 0.68], ['R', -0.68]]) {
      const zs = Math.sign(z);
      list.push(staticUnit({id: `hub${tag}${side}`, kind: 'cyl', axis: 'z', r: 0.075, h: 0.14, pos: [x, yAxle, z], color: 0x9aa4ab, alpha: 0.95, opacity: 0}));
      list.push(staticUnit({
        id: `shaft${tag}${side}`, kind: 'cyl', axis: 'z', r: 0.026, h: 0.44,
        pos: [x, yAxle, z - zs * 0.38], color: 0xa9b5bf, alpha: 0.95, opacity: 0
      }));
      list.push(staticUnit({id: `wheel${tag}${side}`, kind: 'torus', r: 0.30, tube: 0.055, pos: [x, yAxle, z], color: 0x2c3640, alpha: 0.9, opacity: 0}));
    }
  }
  return list;
}

function thermalUnits() {
  return [
    staticUnit({id: 'radiator', kind: 'box', size: [0.07, 0.50, 0.90], pos: [1.55, 0.55, 0], color: COL.blue, alpha: 0.28, edge: true, opacity: 0}),
    staticUnit({id: 'pump', kind: 'cyl', axis: 'y', r: 0.05, h: 0.10, pos: [1.40, 0.36, 0.40], color: 0x5fb7ff, alpha: 0.95, opacity: 0}),
    staticUnit({id: 'loop', kind: 'tube', r: 0.017, path: LOOP, pos: [0, 0, 0], color: 0x3da0ff, alpha: 0.9, opacity: 0}),
    staticUnit({id: 'coolant', kind: 'dots', path: LOOP, n: 46, size: 0.020, stages: LOOP_STAGES, pos: [0, 0, 0], opacity: 0}),
    staticUnit({id: 'markerA', kind: 'marker', path: LOOP, offset: 0.00, size: 0.045, pos: [0, 0, 0], color: COL.orange, opacity: 0}),
    staticUnit({id: 'markerB', kind: 'marker', path: LOOP, offset: 0.35, size: 0.045, pos: [0, 0, 0], color: COL.amber, opacity: 0}),
    staticUnit({id: 'markerC', kind: 'marker', path: LOOP, offset: 0.68, size: 0.045, pos: [0, 0, 0], color: COL.cyan, opacity: 0}),
    staticUnit({id: 'hvac', kind: 'box', size: [0.32, 0.22, 0.70], pos: [1.15, 1.10, 0], color: COL.teal, alpha: 0.30, edge: true, opacity: 0}),
    staticUnit({id: 'airL', kind: 'dots', path: AIR_L, n: 20, size: 0.016, pos: [0, 0, 0], color: COL.teal, opacity: 0}),
    staticUnit({id: 'airR', kind: 'dots', path: AIR_R, n: 20, size: 0.016, pos: [0, 0, 0], color: COL.teal, opacity: 0}),
    staticUnit({id: 'balance', kind: 'box', size: [1.30, 0.02, 0.02], pos: [0.30, 1.42, 0.02], color: COL.white, alpha: 0.8, opacity: 0}),
    staticUnit({id: 'balanceCold', kind: 'sphere', r: 0.05, pos: [0.95, 1.42, 0.02], color: COL.cyan, opacity: 0}),
    staticUnit({id: 'balanceHot', kind: 'sphere', r: 0.05, pos: [-0.35, 1.42, 0.02], color: COL.amber, opacity: 0})
  ];
}

function principleUnits() {
  return [
    staticUnit({id: 'inverter', kind: 'box', size: [0.30, 0.14, 0.34], pos: [1.25, 0.465, 0], color: 0x404f5c, edge: true, alpha: 0.95, opacity: 0}),
    staticUnit({id: 'motorR', kind: 'cyl', axis: 'z', r: 0.15, h: 0.34, pos: [-1.00, 0.425, 0], color: 0x8796a3, edge: true, alpha: 0.95, opacity: 0}),
    staticUnit({id: 'cableF', kind: 'tube', r: 0.011, path: CABLE_F, pos: [0, 0, 0], color: COL.orange, glow: true, opacity: 0}),
    staticUnit({id: 'cableR', kind: 'tube', r: 0.011, path: CABLE_R, pos: [0, 0, 0], color: COL.orange, glow: true, opacity: 0}),
    staticUnit({id: 'cur0', kind: 'dots', path: BUS_PATH, n: 22, size: 0.018, pos: [0, 0, 0], color: COL.amber, opacity: 0, parent: 'pack'}),
    staticUnit({id: 'cur1', kind: 'dots', path: CABLE_F, n: 14, size: 0.018, pos: [0, 0, 0], color: COL.amber, opacity: 0}),
    staticUnit({id: 'cur2', kind: 'dots', path: INV_PATH, n: 10, size: 0.018, pos: [0, 0, 0], color: COL.amber, opacity: 0}),
    staticUnit({id: 'cur3', kind: 'dots', path: CABLE_R, n: 26, size: 0.018, pos: [0, 0, 0], color: COL.amber, opacity: 0}),
    staticUnit({id: 'cur4', kind: 'dots', path: MOTOR_PATH, n: 10, size: 0.018, pos: [0, 0, 0], color: COL.amber, opacity: 0}),
    staticUnit({id: 'scan', kind: 'box', size: [0.012, 0.16, 1.30], pos: [-1.20, 0.62, 0], color: COL.green, alpha: 0.85, opacity: 0}),
    staticUnit({id: 'faultGlow', kind: 'sphere', r: 0.09, pos: [MOD_X[1], PACK_Y + 0.20, MOD_Z[1]], color: COL.red, opacity: 0}),
    staticUnit({id: 'okRing', kind: 'torus', r: 0.16, tube: 0.012, pos: [0.0, PACK_Y + 0.34, 0], color: COL.green, opacity: 0}),
    staticUnit({id: 'warn', kind: 'sphere', r: 0.05, pos: [MOD_X[1], PACK_Y + 0.34, MOD_Z[1]], color: COL.red, opacity: 0})
  ];
}

/* ------------------------------ 场景装配器 ------------------------------ */
function scene() {
  const units = [];
  const index = new Map();
  const tracks = [];
  const tracked = new Set();

  const add = (def) => {
    if (index.has(def.id)) throw new Error(`重复单位 ${def.id}`);
    const unit = Object.freeze({alpha: 1, ...def});
    index.set(unit.id, unit);
    units.push(unit);
    return unit.id;
  };
  const addAll = (list) => list.forEach(add);

  const at = (id, beats, opts = {}) => {
    const unit = index.get(id);
    if (!unit) throw new Error(`轨道先于单位定义：${id}`);
    const half = opts.half || unit.half || (unit.size ? [unit.size[0] / 2, unit.size[1] / 2, unit.size[2] / 2] : [0, 0, 0]);
    const origin = opts.origin || unit.pos;
    tracks.push(track(id, beats, {
      origin,
      half,
      opacity0: opts.opacity0 != null ? opts.opacity0 : (unit.opacity ?? 0),
      rot0: unit.rot0,
      scale0: unit.scale0
    }));
    tracked.add(id);
    return id;
  };

  const build = () => {
    for (const unit of units) {
      if (tracked.has(unit.id)) continue;
      const half = unit.half || (unit.size ? [unit.size[0] / 2, unit.size[1] / 2, unit.size[2] / 2] : [0, 0, 0]);
      tracks.push(track(unit.id, [], {
        origin: unit.pos, half, opacity0: unit.opacity ?? 0, rot0: unit.rot0, scale0: unit.scale0
      }));
      tracked.add(unit.id);
    }
    const fragment = parallel(...tracks);
    return {units, timeline: createTimeline(fragment), fragment};
  };

  return {add, addAll, at, build, units};
}

/* ============================ 镜头 1 ============================ */
// 托盘与冷板：电池包从车外沿路径进入 → 抬升 → 碰到地板下表面停住；冷板贴到托盘上；流道铺开并流动。
function shot1() {
  const S = scene();
  S.addAll(structure());
  S.addAll(packUnits({withModules: false, withBolts: false, withLid: false}));
  S.add(staticUnit({id: 'cond0', kind: 'sphere', r: 0.055, pos: [1.40, 1.02, 0], color: COL.white, opacity: 0}));
  S.add(staticUnit({id: 'cond1', kind: 'sphere', r: 0.055, pos: [0.00, 1.16, 0], color: COL.green, opacity: 0}));
  S.add(staticUnit({id: 'cond2', kind: 'sphere', r: 0.055, pos: [-1.40, 1.02, 0], color: COL.cyan, opacity: 0}));

  S.at('pack', [
    appear({at: 0.30, dur: 0.70}),
    // 沿路径进入：先绕开后轮拱（z 外摆），再滑到车下
    path({at: 1.10, dur: 3.00, ease: 'easeInOutCubic', points: [
      [3.60, 0.02, 0.00], [2.90, 0.02, 0.75], [1.90, 0.02, 1.05],
      [0.90, 0.02, 0.60], [0.20, 0.02, 0.12], [0.00, 0.02, 0.00]
    ]}),
    // 抬升：目标 0.72（会过冲），实际在地板下表面停住（0.541）
    contact('floorSlab', {face: 'bottom', gap: 0.004, at: 4.10}),
    move({at: 4.10, dur: 2.20, ease: 'easeInCubic', by: [0, 0.70, 0]})
  ]);
  S.at('coldPlate', [
    appear({at: 5.90, dur: 0.40}),
    contact('pack', {face: 'top', plane: [0, 0.05, 0], gap: 0.004, at: 5.90}),
    move({at: 5.90, dur: 1.00, ease: 'easeInOutCubic', by: [0, -0.22, 0]})
  ]);
  S.at('seal', [appear({at: 5.55, dur: 0.55})]);
  S.at('coolSerp', [
    appear({at: 6.55, dur: 0.30}),
    flow({at: 6.55, dur: 1.60, fill: 1.10, speed: 0.42, path: SERP})
  ]);
  ['cond0', 'cond1', 'cond2'].forEach((id, i) => {
    S.at(id, [
      appear({at: 7.30 + i * 0.25, dur: 0.35}),
      scale({at: 7.30 + i * 0.25, dur: 0.35, from: 0.4, to: 1})
    ]);
  });
  const built = S.build();
  return {
    ...meta('e2-1', '托盘与冷板', '电池包从车外沿路径进入，抬升后碰到车身地板下表面停住；冷板贴合、密封圈闭合、冷却流道铺开。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.55, 0], r: 6.0, az: 42, el: 20},
    notes: [
      'pack: path 六点折线绕开后轮拱（v8 是从 x=3.4 直接平移到 0，穿过轮罩与地板）',
      'pack: contact(floorSlab,bottom) 把抬升钉在地板下表面 —— 目标 0.72，实际 0.541',
      'coldPlate: contact(pack,top) 贴到托盘上表面后才停',
      'coolSerp: flow 的 reach 从 0 长到 1，光点沿蛇形流道循环'
    ]
  };
}

/* ============================ 镜头 2 ============================ */
// 模组落位紧固：12 个模组依次落到冷板上（碰停），落位后螺栓 6 圈旋入到底，绝缘片插到底。
function shot2() {
  const S = scene();
  S.addAll(structure());
  S.addAll(packUnits({withModules: true, withBolts: true, withLid: true}));
  for (let i = 0; i < 5; i++) {
    S.add(staticUnit({
      id: `ins${i}`, kind: 'box', size: [0.012, 0.13, 1.28],
      pos: [MOD_X[0] + (i + 0.5) * 0.378, 0.40, 0],
      parent: 'pack', color: COL.violet, alpha: 0.35, edge: true, opacity: 0
    }));
  }
  S.add(staticUnit({id: 'vib', kind: 'sphere', r: 0.05, pos: [-0.30, 1.02, 1.10], color: COL.white, opacity: 0}));
  S.add(staticUnit({id: 'therm', kind: 'sphere', r: 0.05, pos: [0.00, 1.10, 1.10], color: COL.amber, opacity: 0}));
  S.add(staticUnit({id: 'safe', kind: 'sphere', r: 0.05, pos: [0.30, 1.02, 1.10], color: COL.green, opacity: 0}));

  S.at('pack', [appear({at: 0.00, dur: 0.60})], {origin: [0, PACK_Y, 0], opacity0: 0});
  S.at('coldPlate', [appear({at: 0.05, dur: 0.50})], {origin: [0, PLATE_Y, 0], opacity0: 0});

  for (let i = 0; i < 12; i++) {
    const x = MOD_X[i >> 1], z = MOD_Z[i & 1];
    const t0 = 0.55 + i * 0.26;
    S.at(`mod${i}`, [
      appear({at: t0, dur: 0.22}),
      // 落到冷板上就停：目标 0.10，实际 0.138（模组底面 0.078 / 冷板面 0.074）
      contact('coldPlate', {face: 'top', gap: 0.004, at: t0 + 0.02}),
      move({at: t0, dur: 0.50, ease: 'easeInCubic', by: [0, -0.30, 0]})
    ], {origin: [x, 0.40, z], opacity0: 0});

    const b0 = t0 + 0.50;
    S.at(`bolt${i}`, [
      appear({at: b0, dur: 0.20}),
      // 轴向进给 + 6 圈旋入同时进行（两条通道并行，互不覆盖）
      move({at: b0, dur: 1.25, ease: 'easeInOutCubic', by: [0, -0.10, 0]}),
      rotate({at: b0, dur: 1.25, axis: 'y', turns: 6, ease: 'easeInOutCubic'}),
      contact(`mod${i}`, {face: 'top', gap: 0.002, at: b0})
    ], {origin: [x + 0.19, BOLT_START_Y, z], opacity0: 0});
  }
  for (let i = 0; i < 5; i++) {
    const t0 = 4.30 + i * 0.18;
    S.at(`ins${i}`, [
      appear({at: t0, dur: 0.25}),
      contact('pack', {face: 'top', plane: [0, 0.05, 0], gap: 0.002, at: t0}),
      move({at: t0, dur: 0.50, ease: 'easeInOutCubic', by: [0, -0.30, 0]})
    ], {opacity0: 0});
  }
  [['vib', 6.30], ['therm', 6.60], ['safe', 6.90]].forEach(([id, t0]) => {
    S.at(id, [appear({at: t0, dur: 0.30}), scale({at: t0, dur: 0.30, from: 0.4, to: 1})]);
  });
  S.at('lid', [
    appear({at: 7.50, dur: 0.50}),
    // 顶盖压在模组上：冷板面 .074 + 间隙 .131 + 盖半厚 .01 = .215（包体上表面）
    contact('coldPlate', {face: 'top', gap: 0.131, at: 7.50}),
    move({at: 7.50, dur: 0.80, ease: 'easeOutCubic', by: [0, -0.30, 0]})
  ], {origin: [0, 0.50, 0], opacity0: 0});

  const built = S.build();
  return {
    ...meta('e2-2', '模组落位紧固', '12 个模组依次落到冷板上被接触面接住，落位后螺栓 6 圈旋入到底，绝缘片插到底，再做振动/热胀/安全复核。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.72, 0], r: 4.6, az: 58, el: 26},
    notes: [
      'mod0..11: 每 0.26 s 一个，落体 easeInCubic，contact(coldPlate,top) 停住（目标 0.10 / 实际 0.138）',
      'bolt0..11: 轴向进给与 6 圈旋转是同一条轨道的两条通道，同时进行；contact(mod_i,top) 拧到底停',
      'ins0..4: 插到底停；lid: 落到包体上表面'
    ]
  };
}

/* ============================ 镜头 3 ============================ */
// 高压通路：母排接通 → 电流按段传播（因果延迟）→ 绝缘检测扫过 → 维修开关断开，电流按传播顺序逐段停止 → 恢复。
function shot3() {
  const S = scene();
  S.addAll(structure());
  S.addAll(packUnits({withModules: true, withBolts: true, withLid: true}));
  S.addAll(principleUnits());

  S.at('pack', [appear({at: 0.00, dur: 0.45})], {origin: [0, PACK_Y, 0], opacity0: 0});
  S.at('coldPlate', [appear({at: 0.00, dur: 0.45})], {origin: [0, PLATE_Y, 0], opacity0: 0});
  for (let i = 0; i < 12; i++) S.at(`mod${i}`, [], {origin: [MOD_X[i >> 1], MOD_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  for (let i = 0; i < 12; i++) S.at(`bolt${i}`, [], {origin: [MOD_X[i >> 1] + 0.19, BOLT_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  S.at('lid', [], {origin: [0, 0.215, 0], opacity0: 0.5});

  S.at('msd', [
    appear({at: 0.30, dur: 0.40}),
    // 维修开关：5.10 抬起（断开，这是"原因"那一下），6.50 压回（恢复）
    move({at: 5.10, dur: 0.45, ease: 'easeOutCubic', by: [0, 0.13, 0]}),
    move({at: 6.50, dur: 0.55, ease: 'easeInCubic', by: [0, -0.13, 0]})
  ], {opacity0: 0});
  S.at('hvPort', [appear({at: 0.30, dur: 0.40})]);
  S.at('busA', [appear({at: 0.45, dur: 0.40}), flow({at: 0.80, dur: 5.0, fill: 0.50, speed: 1.10, path: BUS_PATH})]);
  S.at('busB', [appear({at: 0.55, dur: 0.40})]);
  S.at('cableF', [appear({at: 0.80, dur: 0.40})]);
  S.at('cableR', [appear({at: 0.90, dur: 0.45})]);
  S.at('inverter', [appear({at: 0.70, dur: 0.40})]);
  S.at('motorR', [appear({at: 0.70, dur: 0.40})]);

  // 电流按段传播：每段的 flow 起点依距离顺延，看得见"从电池往电机走"
  const live = [
    ['cur0', 0.80, 1.10, BUS_PATH],
    ['cur1', 1.05, 0.90, CABLE_F],
    ['cur2', 1.35, 0.60, INV_PATH],
    ['cur3', 1.60, 1.20, CABLE_R],
    ['cur4', 1.95, 0.70, MOTOR_PATH]
  ];
  live.forEach(([id, t0, speed, pts]) => {
    S.at(id, [
      appear({at: t0, dur: 0.30}),
      flow({at: t0, dur: 6.0, fill: 0.45, speed, path: pts}),
      dissolve({at: 5.20 + (t0 - 0.80) * 0.80, dur: 0.25}),
      appear({at: 6.90 + (t0 - 0.80) * 0.70, dur: 0.30, from: 0})
    ], {opacity0: 0});
  });

  // 绝缘检测：一扫而过
  S.at('scan', [
    appear({at: 3.30, dur: 0.30}),
    move({at: 3.40, dur: 1.80, ease: 'easeInOutSine', to: [1.20, 0.62, 0]}),
    dissolve({at: 5.10, dur: 0.40})
  ], {origin: [-1.20, 0.62, 0], opacity0: 0});

  S.at('okRing', [appear({at: 7.70, dur: 0.40}), scale({at: 7.70, dur: 0.60, from: 0.5, to: 1.25})]);
  S.at('warn', [
    appear({at: 4.95, dur: 0.30}),
    scale({at: 4.95, dur: 0.30, from: 0.4, to: 1}),
    dissolve({at: 6.40, dur: 0.40})
  ], {opacity0: 0});

  const built = S.build();
  return {
    ...meta('e2-3', '高压通路', '母排接通后电流按段传播：电池 → 母排 → 高压线 → 逆变器 → 电机，每段有传播延迟；维修开关断开时电流按同一顺序逐段停止。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.55, 0], r: 5.4, az: 34, el: 24},
    notes: [
      'cur0..4: 五段 flow 的起点依次 0.80/1.05/1.35/1.60/1.95，速度依段长不同 —— 因果可见',
      'msd: 5.10 抬起（断开），6.50 压回（恢复）',
      'cur*: dissolve 时刻 = 起点 + 传播延迟，断开沿同一路径传导',
      'scan: 绝缘检测从 -1.2 扫到 +1.2（move 到绝对目标）'
    ]
  };
}

/* ============================ 镜头 4 ============================ */
// 电驱接入车轴：前后电驱下落碰到副车架停住 → 半轴插入轮毂到底停住 → 车轮转动 → 悬架活动检查。
function shot4() {
  const S = scene();
  S.addAll(structure());
  S.addAll(packUnits({withModules: true, withBolts: false, withLid: true}));
  S.addAll(driveUnits());

  S.at('pack', [appear({at: 0.00, dur: 0.45})], {origin: [0, PACK_Y, 0], opacity0: 0});
  S.at('coldPlate', [appear({at: 0.00, dur: 0.45})], {origin: [0, PLATE_Y, 0], opacity0: 0});
  for (let i = 0; i < 12; i++) S.at(`mod${i}`, [], {origin: [MOD_X[i >> 1], MOD_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  S.at('lid', [], {origin: [0, 0.215, 0], opacity0: 0.5});

  const motors = [
    ['R', 0.20],
    ['F', 0.45]
  ];
  for (const [tag, dly] of motors) {
    S.at(`motor${tag}`, [
      appear({at: 0.20 + dly, dur: 0.45}),
      contact('subframe', {face: 'top', gap: 0.006, at: 0.55 + dly}),
      move({at: 0.55 + dly, dur: 1.50, ease: 'easeInOutCubic', by: [0, -0.72, 0]})
    ], {opacity0: 0});
    S.at(`inv${tag}`, [
      appear({at: 0.30 + dly, dur: 0.45}),
      move({at: 0.55 + dly, dur: 1.50, ease: 'easeInOutCubic', by: [0, -0.72, 0]})
    ], {opacity0: 0});
    // 半轴：从电驱侧推出，插进轮毂到底停住
    for (const [side, z] of [['L', 0.68], ['R', -0.68]]) {
      const zs = Math.sign(z);
      S.at(`hub${tag}${side}`, [appear({at: 0.90 + dly, dur: 0.35})], {opacity0: 0});
      S.at(`shaft${tag}${side}`, [
        appear({at: 2.40 + dly, dur: 0.30}),
        contact(`hub${tag}${side}`, {face: z > 0 ? '-z' : '+z', gap: 0.003, at: 2.55 + dly}),
        move({at: 2.55 + dly, dur: 1.30, ease: 'easeInOutCubic', by: [0, 0, zs * 0.12]})
      ], {opacity0: 0});
      S.at(`wheel${tag}${side}`, [
        appear({at: 1.10 + dly, dur: 0.40}),
        rotate({at: 4.40, dur: 2.20, axis: 'z', turns: zs * 2.5, ease: 'easeInOutCubic'})
      ], {opacity0: 0});
    }
  }

  const built = S.build();
  return {
    ...meta('e2-4', '电驱接入车轴', '前后电驱下落碰到副车架停住，半轴推入轮毂插到底停住，随后车轮转动、悬架上下检查活动空间。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.35, 0], r: 5.0, az: 148, el: 16},
    notes: [
      'motorR/F: 下落 0.72 的位移，contact(subframe,top) 在 0.486 / 0.4635 停住',
      'shaft*: 沿 z 推入 0.12，contact(hub,±z) 在轮毂端面停住（插入到底=停住，不是瞬移）',
      'wheel*: 2.5 圈旋转，easeInOutCubic'
    ]
  };
}

/* ============================ 镜头 5 ============================ */
// 冷却与座舱空调：冷却液沿回路流动（电池吸热 → 后电驱 → 散热器放热 → 回水），座舱冷暖风同时工作。
function shot5() {
  const S = scene();
  S.addAll(structure(true));
  S.addAll(packUnits({withModules: true, withBolts: true, withLid: true}));
  S.addAll(thermalUnits());
  S.add(staticUnit({id: 'motorR5', kind: 'cyl', axis: 'z', r: 0.15, h: 0.34, pos: [-1.00, 0.425, 0], color: 0x8796a3, edge: true, alpha: 0.95, opacity: 0}));

  S.at('pack', [appear({at: 0.00, dur: 0.45})], {origin: [0, PACK_Y, 0], opacity0: 0});
  S.at('coldPlate', [appear({at: 0.00, dur: 0.45})], {origin: [0, PLATE_Y, 0], opacity0: 0});
  for (let i = 0; i < 12; i++) S.at(`mod${i}`, [], {origin: [MOD_X[i >> 1], MOD_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  for (let i = 0; i < 12; i++) S.at(`bolt${i}`, [], {origin: [MOD_X[i >> 1] + 0.19, BOLT_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  S.at('lid', [], {origin: [0, 0.215, 0], opacity0: 0.35});
  S.at('motorR5', [appear({at: 0.30, dur: 0.40})]);

  S.at('radiator', [appear({at: 1.10, dur: 0.50})]);
  S.at('pump', [
    appear({at: 0.80, dur: 0.35}),
    rotate({at: 1.00, dur: 2.40, axis: 'z', turns: 8, ease: 'linear'})
  ], {opacity0: 0});
  // 回路：先长出来，再流动；光点按 u 分色（电池段橙 / 电驱段黄 / 散热器后蓝 / 回水青）
  S.at('loop', [
    appear({at: 0.60, dur: 0.40}),
    flow({at: 0.80, dur: 8.0, fill: 1.60, speed: 0.42, path: LOOP})
  ], {opacity0: 0});
  S.at('coolant', [
    appear({at: 2.10, dur: 0.40}),
    flow({at: 2.10, dur: 7.0, fill: 0.60, speed: 0.42, path: LOOP})
  ], {opacity0: 0});
  [['markerA', 2.20], ['markerB', 2.30], ['markerC', 2.45]].forEach(([id, t0]) => {
    S.at(id, [
      appear({at: t0, dur: 0.35}),
      flow({at: t0, dur: 7.0, fill: 0.40, speed: 0.42, path: LOOP})
    ], {opacity0: 0});
  });
  S.at('hvac', [appear({at: 3.90, dur: 0.45})]);
  [['airL', AIR_L, 4.20], ['airR', AIR_R, 4.45]].forEach(([id, pts, t0]) => {
    S.at(id, [
      appear({at: t0, dur: 0.40}),
      flow({at: t0, dur: 5.0, fill: 0.70, speed: 0.30, path: pts})
    ], {opacity0: 0});
  });
  // 冷热平衡：一根梁在两者之间摆动
  S.at('balance', [
    appear({at: 5.30, dur: 0.35}),
    rotate({at: 5.40, dur: 1.20, axis: 'z', to: 0.18, ease: 'easeInOutCubic'}),
    rotate({at: 6.60, dur: 2.00, axis: 'z', to: -0.12, ease: 'easeInOutCubic'})
  ], {opacity0: 0});
  S.at('balanceCold', [appear({at: 5.40, dur: 0.30})]);
  S.at('balanceHot', [appear({at: 5.40, dur: 0.30})]);

  const built = S.build();
  return {
    ...meta('e2-5', '冷却与座舱空调', '冷却液沿回路流动：电池段吸热（橙）→ 电驱段（黄）→ 散热器放热（蓝）→ 回水（青）；座舱冷暖风同时工作，冷热在两者之间分配。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.70, 0], r: 6.2, az: 46, el: 26},
    notes: [
      'loop/coolant/marker*: 同一条回路五条轨道，flow.speed 相同 → u 恒等，不会错位',
      'pump: 8 圈（linear）',
      'markerA/B/C: offset 0 / .35 / .68，分别代表电池出口 / 电驱 / 散热器后 —— 冷热是"流到哪儿"决定的',
      'balance: 在冷（cyan）与热（amber）之间摆动，讲能量分配'
    ]
  };
}

/* ============================ 镜头 6 ============================ */
// 能量与热量汇合：电流与冷却同时运行；一处模组异常 → 热胀变形 → 保护按传播顺序切断电流 → 冷却把温度带下去 → 恢复。
function shot6() {
  const S = scene();
  S.addAll(structure(true));
  S.addAll(packUnits({withModules: true, withBolts: true, withLid: true}));
  S.addAll(principleUnits());
  S.addAll(thermalUnits());
  S.at('pack', [appear({at: 0.00, dur: 0.45})], {origin: [0, PACK_Y, 0], opacity0: 0});
  S.at('coldPlate', [appear({at: 0.00, dur: 0.45})], {origin: [0, PLATE_Y, 0], opacity0: 0});
  for (let i = 0; i < 12; i++) S.at(`mod${i}`, [], {origin: [MOD_X[i >> 1], MOD_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  for (let i = 0; i < 12; i++) S.at(`bolt${i}`, [], {origin: [MOD_X[i >> 1] + 0.19, BOLT_REST_Y, MOD_Z[i & 1]], opacity0: 1});
  S.at('lid', [], {origin: [0, 0.215, 0], opacity0: 0.35});

  // 电流（已在运行）
  S.at('busA', [appear({at: 0.10, dur: 0.30}), flow({at: 0.20, dur: 9.0, fill: 0.30, speed: 1.10, path: BUS_PATH})]);
  S.at('cableF', [appear({at: 0.10, dur: 0.30})]);
  S.at('cableR', [appear({at: 0.15, dur: 0.30})]);
  S.at('inverter', [appear({at: 0.15, dur: 0.30})]);
  S.at('motorR', [appear({at: 0.15, dur: 0.30})]);
  const live = [
    ['cur0', 0.20, 1.10, BUS_PATH],
    ['cur1', 0.35, 0.90, CABLE_F],
    ['cur2', 0.50, 0.60, INV_PATH],
    ['cur3', 0.65, 1.20, CABLE_R],
    ['cur4', 0.85, 0.70, MOTOR_PATH]
  ];
  live.forEach(([id, t0, speed, pts]) => {
    S.at(id, [
      appear({at: t0, dur: 0.25}),
      flow({at: t0, dur: 9.5, fill: 0.30, speed, path: pts}),
      dissolve({at: 4.30 + (t0 - 0.20) * 0.90, dur: 0.30}),
      appear({at: 6.30 + (t0 - 0.20) * 0.80, dur: 0.30, from: 0})
    ], {opacity0: 0});
  });
  // 冷却（一直在跑）
  S.at('loop', [appear({at: 0.20, dur: 0.40}), flow({at: 0.30, dur: 9.5, fill: 0.60, speed: 0.42, path: LOOP})], {opacity0: 0});
  S.at('coolant', [appear({at: 0.50, dur: 0.40}), flow({at: 0.50, dur: 9.5, fill: 0.50, speed: 0.42, path: LOOP})], {opacity0: 0});
  S.at('radiator', [appear({at: 0.40, dur: 0.40})]);
  S.at('pump', [appear({at: 0.30, dur: 0.30}), rotate({at: 0.40, dur: 9.0, axis: 'z', turns: 26, ease: 'linear'})], {opacity0: 0});

  // 故障：3 号模组过热 → 热胀变形（deform 沿 y）→ 温度被冷却带走 → 变形回零
  S.at('mod3', [
    deform({at: 2.60, dur: 0.60, axis: 'y', from: 0, amp: 0.022, ease: 'easeOutCubic'}),
    deform({at: 5.40, dur: 1.40, axis: 'y', from: 0.022, amp: 0, ease: 'easeInOutCubic'})
  ], {origin: [MOD_X[1], MOD_REST_Y, MOD_Z[1]], opacity0: 1});
  S.at('faultGlow', [
    appear({at: 2.50, dur: 0.35}),
    scale({at: 2.50, dur: 0.35, from: 0.5, to: 1.15}),
    dissolve({at: 6.60, dur: 0.50})
  ], {opacity0: 0});
  S.at('warn', [
    appear({at: 2.60, dur: 0.30}),
    scale({at: 2.60, dur: 0.30, from: 0.4, to: 1}),
    dissolve({at: 6.60, dur: 0.50})
  ], {opacity0: 0});
  S.at('scan', [
    appear({at: 7.20, dur: 0.30}),
    move({at: 7.30, dur: 1.00, ease: 'easeInOutSine', to: [1.20, 0.62, 0]}),
    dissolve({at: 8.30, dur: 0.30})
  ], {origin: [-1.20, 0.62, 0], opacity0: 0});
  S.at('okRing', [appear({at: 8.20, dur: 0.40}), scale({at: 8.20, dur: 0.60, from: 0.5, to: 1.2})]);

  const built = S.build();
  return {
    ...meta('e2-6', '能量与热量汇合', '电流与冷却同时运行；一处模组过热，热胀变形可见，保护按传播顺序切断电流，冷却把温度带走后恢复。', built.timeline.duration),
    ...built,
    camera: {tg: [0, 0.62, 0], r: 6.6, az: 30, el: 22},
    notes: [
      'mod3: deform 0 → .022 → 0，热胀走变形通道而不是 scale',
      'cur*: 4.30 起按传播顺序切断，6.30 起按同一顺序恢复',
      'loop/coolant/pump: 全程运行，故障期间不停（这就是"热量由冷却带走"）',
      'scan/okRing: 恢复后复检'
    ]
  };
}

/* ------------------------------ 导出 ------------------------------ */
function meta(id, title, detail, duration) {
  return {id, title, detail, duration};
}

const BUILDERS = [shot1, shot2, shot3, shot4, shot5, shot6];
export const SHOT_META = [
  {id: 'e2-1', title: '托盘与冷板'},
  {id: 'e2-2', title: '模组落位紧固'},
  {id: 'e2-3', title: '高压通路'},
  {id: 'e2-4', title: '电驱接入车轴'},
  {id: 'e2-5', title: '冷却与座舱空调'},
  {id: 'e2-6', title: '能量与热量汇合'}
];

export function getShot(i) {
  const k = ((i % BUILDERS.length) + BUILDERS.length) % BUILDERS.length;
  return BUILDERS[k]();
}

export const SHOT_COUNT = BUILDERS.length;

export function unitsById(shot) {
  return new Map(shot.units.map((unit) => [unit.id, unit]));
}

// 世界坐标（父级锚点 + 自身局部位移）。接触求解在"同父"的局部坐标系里做，
// 这里只给渲染和空间检查用。
export function worldPos(states, unitId, units) {
  const unit = units.get(unitId);
  const self = states[unitId];
  const p = self ? self.pos : {x: 0, y: 0, z: 0};
  if (!unit || !unit.parent) return {x: p.x, y: p.y, z: p.z};
  const par = states[unit.parent];
  const q = par ? par.pos : {x: 0, y: 0, z: 0};
  return {x: q.x + p.x, y: q.y + p.y, z: q.z + p.z};
}
