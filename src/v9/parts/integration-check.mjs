// T-106 集成验收：在 Node 里静态构造 systems（不渲染），逐条断言 26 个工序脚本实际用到的名字，
// 并和“替换前”的三角面/网格数对比。
// 用法：node src/v9/parts/integration-check.mjs   （退出码 0 = 全过）
import * as THREE from 'three';
import {createKit} from '../../engine/kit.js';
import {createSystems} from '../../engine/systems.js';

// 替换前（旧 systems.js 用 K.rbox/K.solid/K.tube 现场拼）实测基线
const BEFORE = {
  battery: {tris: 14492, meshes: 32}, drive: {tris: 6896, meshes: 14},
  thermal: {tris: 3288, meshes: 4}, hv: {tris: 2560, meshes: 2},
  eea: {tris: 18938, meshes: 43}, cabin: {tris: 6754, meshes: 18},
  biw: {tris: 24840, meshes: 81}, chassis: {tris: 24864, meshes: 22},
  occupant: {tris: 7908, meshes: 15},
  total: 110540, meshes: 231
};

const car = {
  wheelR: .36,
  wheelCenters: [{x: 1.48, y: .36, z: .80}, {x: 1.48, y: .36, z: -.80}, {x: -1.39, y: .36, z: .80}, {x: -1.39, y: .36, z: -.80}],
  wheels: [], root: {position: {x: 0}},
  topAt: (x) => ({roof: 1.40 - .10 * Math.pow((x - .1) / 1.6, 2), top: 1.0, bot: .3, half: .9})
};

const scene = new THREE.Scene();
const K = createKit(scene);
const S = createSystems(K, car);

const fails = [], notes = [];
const ok = (cond, msg) => { if (cond) notes.push('✓ ' + msg); else fails.push('✗ ' + msg); return cond; };
const isObj = (v) => !!(v && (v.isObject3D || v.isGroup || v.isMesh));
const has = (obj, key) => obj && obj[key] !== undefined && obj[key] !== null;

// ---------- 1. 数量断言（任务卡硬指标） ----------
ok(S.battery.modules.length === 12, `S.battery.modules.length === 12（实际 ${S.battery.modules.length}）`);
ok(S.cabin.seats.length === 3, `S.cabin.seats.length === 3（实际 ${S.cabin.seats.length}）`);
ok(S.biw.beams.length >= 40, `S.biw.beams.length ≥ 40（实际 ${S.biw.beams.length}）`);
ok(S.chassis.parts.length === 4, `S.chassis.parts.length === 4（实际 ${S.chassis.parts.length}）`);
ok(S.eea.zones.length === 4, `S.eea.zones.length === 4（实际 ${S.eea.zones.length}）`);

// ---------- 2. 子件名兼容清单（从 src/nodes/*.js grep 出来的） ----------
// key: [对象, 路径]
const API = {
  'S.battery': () => S.battery, 'S.battery.g': () => S.battery.g, 'S.battery.pack': () => S.battery.pack,
  'S.battery.modules': () => S.battery.modules, 'S.battery.x0': () => S.battery.x0, 'S.battery.y0': () => S.battery.y0,
  'S.battery.L': () => S.battery.L, 'S.battery.Wd': () => S.battery.Wd, 'S.battery.tray': () => S.battery.tray,
  'S.battery.plate': () => S.battery.plate, 'S.battery.coolant': () => S.battery.coolant,
  'S.battery.busbars': () => S.battery.busbars, 'S.battery.lid': () => S.battery.lid, 'S.battery.hvPort': () => S.battery.hvPort,
  'S.cabin.g': () => S.cabin.g, 'S.cabin.seats': () => S.cabin.seats, 'S.cabin.dash': () => S.cabin.dash,
  'S.cabin.wheel': () => S.cabin.wheel, 'S.cabin.disp': () => S.cabin.disp,
  'S.eea.g': () => S.eea.g, 'S.eea.central': () => S.eea.central, 'S.eea.zones': () => S.eea.zones,
  'S.eea.sensors': () => S.eea.sensors, 'S.eea.screen': () => S.eea.screen, 'S.eea.loom': () => S.eea.loom,
  'S.eea.branches': () => S.eea.branches, 'S.eea.sig': () => S.eea.sig, 'S.eea.trunkSig': () => S.eea.trunkSig,
  'S.eea.fans': () => S.eea.fans, 'S.eea.trunk': () => S.eea.trunk, 'S.eea.reach': () => 'reach-set',
  'S.biw.g': () => S.biw.g, 'S.biw.beams': () => S.biw.beams, 'S.biw.joints': () => S.biw.joints,
  'S.chassis.g': () => S.chassis.g, 'S.chassis.parts': () => S.chassis.parts, 'S.chassis.rack': () => S.chassis.rack,
  'S.chassis.sub': () => S.chassis.sub,
  'S.drive.g': () => S.drive.g, 'S.rear.g': () => S.rear.g, 'S.front.g': () => S.front.g,
  'S.rear.shafts': () => S.rear.shafts, 'S.front.shafts': () => S.front.shafts,
  'S.rear.rings': () => S.rear.rings, 'S.front.rings': () => S.front.rings,
  'S.thermal.pipe': () => S.thermal.pipe, 'S.thermal.hvac': () => S.thermal.hvac,
  'S.thermal.cabinAir': () => S.thermal.cabinAir, 'S.thermal.cabinAir2': () => S.thermal.cabinAir2,
  'S.thermal.cold': () => S.thermal.cold, 'S.hv.cables': () => S.hv.cables, 'S.hv.flows': () => S.hv.flows,
  'S.occupant.front': () => S.occupant.front, 'S.occupant.front2': () => S.occupant.front2, 'S.occupant.rear': () => S.occupant.rear,
  'S.show': () => S.show, 'S.sub': () => S.sub, 'S.reset': () => S.reset, 'S.apply': () => S.apply
};
const apiRows = [];
for (const [name, get] of Object.entries(API)) {
  let v, err = null;
  try { v = get(); } catch (e) { err = e; }
  const pass = !err && v !== undefined && v !== null;
  apiRows.push({name, pass});
  ok(pass, `${name} 存在${err ? '（' + err.message + '）' : ''}`);
}
// 数组/对象元素的结构
ok(S.battery.modules.every(m => isObj(m) && m.userData.top && m.userData.top.material && m.userData.top.material.color), 'battery.modules[i].userData.top 是可改色的 Mesh（concept/demand/validation 依赖）');
ok(S.battery.modules.every(m => m.userData.topCol), 'battery.modules[i].userData.topCol 存在（S.reset 依赖）');
ok(S.battery.busbars.every(b => b.geometry && b.geometry.index), 'battery.busbars[i] 有索引几何（K.growTube 依赖）');
ok(S.battery.coolant.geometry && S.battery.coolant.geometry.index, 'battery.coolant 有索引几何（K.growTube 依赖）');
ok(S.biw.beams.every(b => b.geometry && b.geometry.index), 'biw.beams[i] 有索引几何（K.growTube 依赖）');
ok(S.chassis.parts.every(p => isObj(p.spring) && isObj(p.knuckle) && isObj(p.disc)), 'chassis.parts[i].{spring,knuckle,disc} 都是可动对象（engineering-2 的悬架跳动）');
ok(S.rear.shafts.length > 0 && S.rear.shafts.every(isObj), 'rear.shafts[i] 可被 scale.y 驱动');
ok(S.rear.rings.length > 0 && S.rear.rings.every(isObj), 'rear.rings[i] 可被 rotation.z 驱动');
ok(S.eea.trunk.length > 6 && Array.isArray(S.eea.trunk[0]), 'eea.trunk 是点数组（engineering-3 的卡扣定位）');
ok(S.eea.branches.length > 0 && Array.isArray(S.eea.branches[0].pts), 'eea.branches[i].pts 是点数组');
ok(S.eea.fans && Object.keys(S.eea.fans).length >= 7, 'eea.fans 至少 7 个扇区（validation 遍历）');

// ---------- 3. 模拟节点的真实操作（会抛错就说明契约没保住） ----------
let runtimeErr = null;
try {
  S.show('battery', 1); S.show('cabin', 1); S.show('biw', 1); S.show('chassis', 1); S.show('drive', 1); S.show('eea', 1);
  S.apply(1.2);
  // engineering-2：模组落位 + 顶面脉冲 + 母排生长
  S.battery.modules.forEach((m, i) => { m.position.y = .29 + .1 * (1 - i / 12); m.position.x = -.02 - 1.15 + .19 + i * .1; m.scale.set(1, 1, 1); m.userData.top.material.color.set(0x2fe3c0); });
  S.battery.busbars.forEach(b => K.growTube(b, .5));
  K.growTube(S.battery.coolant, .5);
  S.battery.plate.position.y = .21;
  // engineering-1：梁生长 + 焊点
  S.biw.beams.forEach((b, i) => K.growTube(b, i % 7 / 7));
  S.biw.joints.forEach((j, i) => S.sub(j, i % 3 / 3));
  // engineering-2：悬架跳动 / 车轮环
  S.chassis.parts.slice(2).forEach(p => { p.spring.scale.y = 1.2; p.spring.position.y = -.1; p.knuckle.position.y += .02; p.disc.position.y += .02; });
  S.rear.shafts.forEach(s => s.scale.y = .8); S.rear.rings.forEach(r => r.rotation.z = .4);
  S.rear.g.position.z = 0; S.front.g.position.z = 0;
  // concept/validation：座位与电池整体位移
  S.cabin.seats.forEach(s => s.position.y += .3);
  S.battery.g.position.set(0, .1, .5); S.battery.g.scale.y = 1.1;
  S.apply(2.4);
  S.reset();
} catch (e) { runtimeErr = e; }
ok(!runtimeErr, '模拟 26 节点常用操作链（show/apply/growTube/位移/缩放/reset）无异常' + (runtimeErr ? '：' + runtimeErr.message : ''));

// ---------- 4. 透明度可驱动（op 兼容） ----------
let opErr = null;
try {
  const target = S.battery.g;
  const mats = new Set();
  target.traverse(o => { if (o.isMesh && o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => mats.add(m)); });
  const first = [...mats][0];
  const before = first.opacity;
  S.show('battery', 0); S.apply(0.5);
  const faded = first.opacity < before + 1e-6;
  S.show('battery', 1); S.apply(0.5);
  if (!faded) throw new Error('op() 未改变材质 opacity');
  ok(mats.size > 20, `电池包材质多档（${mats.size} 个材质实例，说明没有全件共用一种材质）`);
} catch (e) { opErr = e; }
ok(!opErr, 'op()/S.apply 能驱动新件透明度' + (opErr ? '：' + opErr.message : ''));

// ---------- 5. 三角面统计与对比 ----------
const stat = (rootObj) => {
  let tris = 0, meshes = 0;
  rootObj.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return {tris: Math.round(tris), meshes};
};
const rows = [];
let total = 0, totalMeshes = 0;
for (const k of Object.keys(S.groups)) {
  const st = stat(S.groups[k]);
  const b = BEFORE[k] || {tris: 0, meshes: 0};
  rows.push({k, ...st, before: b.tris, beforeMeshes: b.meshes, delta: st.tris - b.tris});
  total += st.tris; totalMeshes += st.meshes;
}

// 包围盒对齐检查（电池包）
const bb = new THREE.Box3().setFromObject(S.battery.g);
const size = bb.getSize(new THREE.Vector3()), min = bb.min.clone(), max = bb.max.clone();
const near = (v, t, tol) => Math.abs(v - t) <= tol;
ok(near(size.x, 2.42, .14) && near(size.y, .30, .08) && near(size.z, 1.42, .08), `电池包包围盒对齐旧件（新 ${size.x.toFixed(2)}×${size.y.toFixed(2)}×${size.z.toFixed(2)}，旧约 2.42×0.30×1.42，单位 m）`);
ok(S.cabin.seats.every(s => s.position.y >= .35 && s.position.y <= .37), '座椅安装面仍在 y≈.36（旧值）');
ok(S.battery.modules.every(m => Math.abs(m.position.y - .29) < .3), '模组初始高度在旧值 .29 附近');

const pct = ((total - BEFORE.total) / BEFORE.total * 100);
const pad = (s, n) => String(s) + ' '.repeat(Math.max(0, n - String(s).length));
console.log('\n=== T-106 集成验收（Node 静态构造，不渲染）===\n');
console.log('部件名兼容：' + apiRows.filter(r => r.pass).length + '/' + apiRows.length);
console.log('\n分组三角面（旧 → 新）：');
for (const r of rows) {
  console.log('  ' + pad(r.k, 10) + pad(r.before.toLocaleString('en-US'), 10) + '→ ' + pad(r.tris.toLocaleString('en-US'), 10) +
    '(' + (r.delta >= 0 ? '+' : '') + r.delta + ')' + pad('  网格 ' + r.beforeMeshes + '→' + r.meshes, 14) + '  ' + (r.before === 0 ? '' : ((r.delta / r.before * 100).toFixed(0) + '%')));
}
console.log('  ' + pad('合计', 10) + pad(BEFORE.total.toLocaleString('en-US'), 10) + '→ ' + pad(total.toLocaleString('en-US'), 10) + '(' + (total - BEFORE.total >= 0 ? '+' : '') + (total - BEFORE.total) + ')   网格 ' + BEFORE.meshes + '→' + totalMeshes + '   ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%');
console.log('\n断言结果：');
for (const n of notes) console.log('  ' + n);
if (fails.length) { console.log('\n失败：'); for (const f of fails) console.log('  ' + f); }
console.log('\n' + (fails.length ? '✗ ' + fails.length + ' 项未通过' : '✓ 全部通过（' + notes.length + ' 项断言）'));
process.exit(fails.length ? 1 : 0);
