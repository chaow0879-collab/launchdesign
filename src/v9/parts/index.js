// P 部件库入口：createParts(THREE, opts) 返回所有程序化部件的工厂。
// 设计约束（见 README）：
//   - 每个部件函数返回 THREE.Group，带 name / userData.kind，可控子件挂成 group 的直接属性，并登记进 userData.subparts。
//   - 不调用现有 engine/kit.js；这里自带最小注册器（reg / expose），只用 THREE 本身。
//   - 全部确定性生成（无随机数），Node 端可离线建几何（bench.mjs）。
import {createGeo} from './geo.js';
import {createLabels} from './labels.js';
import {createMaterials} from './materials.js';
import {createFasteners} from './fasteners.js';
import {buildSeat} from './seat.js';
import {buildBatteryModule, buildBatteryPack} from './battery.js';
import {buildDriveUnit} from './drive.js';
import {buildEcu} from './ecu.js';
import {buildBiw} from './body.js';
import {buildDoorPanel} from './panel.js';
import {buildEndMill, buildRobotArm, buildToggleClamp, buildGauge} from './tooling.js';
import {buildSuspensionCorner, buildBrakeCorner} from './chassis.js';

export const VERSION = 'v9-parts-1.0.0';

// 部件清单：key / 名称 / 三角面上限 / 用途节点（工序脚本用 key 取部件，用子件名驱动动画）
export const CATALOG = [
  {key: 'seat', label: '座椅总成', budget: 8000, nodes: 'concept-2 / validation-1'},
  {key: 'batteryModule', label: '电池模组', budget: 3000, nodes: 'engineering-2 / validation-3'},
  {key: 'batteryPack', label: '电池包总成', budget: 20000, nodes: 'engineering-2 / validation-1'},
  {key: 'driveUnit', label: '电驱总成', budget: 9000, nodes: 'engineering-2 / validation-2'},
  {key: 'ecu', label: '区域控制器', budget: 4000, nodes: 'engineering-3 / validation-3'},
  {key: 'biw', label: '白车身骨架', budget: 30000, nodes: 'engineering-1 / launch-1'},
  {key: 'suspension', label: '悬架角总成', budget: 12000, nodes: 'engineering-2 / validation-2'},
  {key: 'brake', label: '制动角总成', budget: 9000, nodes: 'validation-2 / engineering-4'},
  {key: 'doorPanel', label: '车门板件', budget: 9000, nodes: 'cas-2 / classa-2'},
  {key: 'endMill', label: '立铣刀', budget: 2500, nodes: 'clay-1 / launch-1'},
  {key: 'robotArm', label: '六轴机械臂', budget: 9000, nodes: 'launch-1 / clay-1'},
  {key: 'toggleClamp', label: '快速夹钳', budget: 4000, nodes: 'launch-1'},
  {key: 'gauge', label: '百分表检具', budget: 3000, nodes: 'launch-1 / validation-2'}
];

export const TOTAL_BUDGET = 120000;

export function createParts(THREE, opts = {}) {
  const G = createGeo(THREE);
  const L = createLabels(THREE);
  const M = createMaterials(THREE, L);
  const F = createFasteners(THREE, G);
  const MM = .001;

  const dims = {
    length: 4.72, width: 1.96, height: 1.45,
    xF: opts.car?.wheelCenters?.[0]?.x ?? 1.48,
    xR: opts.car?.wheelCenters?.[2]?.x ?? -1.39,
    track: Math.abs(opts.car?.wheelCenters?.[0]?.z ?? .79),
    wheelR: opts.car?.wheelR ?? .36,
    seatTop: .32, battery: {L: 2.30, W: 1.36, H: .14}, ecu: {w: .18, h: .12, d: .04}
  };

  // ---------- 最小注册器 ----------
  function reg(key, label, node) {
    const g = new THREE.Group();
    g.name = key;
    g.userData.kind = 'part';
    g.userData.key = key;
    g.userData.label = label;
    g.userData.node = node;
    return g;
  }

  function countTris(root) {
    let n = 0;
    root.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const geo = o.geometry;
      n += geo.index ? geo.index.count / 3 : (geo.attributes.position?.count ?? 0) / 3;
    });
    return Math.round(n);
  }

  function stats(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const tiers = new Set();
    let meshes = 0, verts = 0, nan = 0;
    root.traverse(o => {
      if (!o.isMesh) return;
      meshes++;
      const geo = o.geometry;
      const pos = geo?.attributes?.position;
      if (pos) {
        verts += pos.count;
        const a = pos.array;
        for (let i = 0; i < a.length; i += 7) if (!Number.isFinite(a[i])) { nan++; break; }
      }
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (m?.userData?.tier) tiers.add(m.userData.tier);
    });
    return {
      tris: countTris(root), meshes, verts, nan, tiers: Array.from(tiers),
      size: {x: +size.x.toFixed(3), y: +size.y.toFixed(3), z: +size.z.toFixed(3)},
      subparts: Object.keys(root.userData.subparts || {}).length
    };
  }

  // 把可控子件挂到 group 上，同时登记（动画按名字取）
  function expose(group, sub, budget) {
    group.userData.budget = budget;
    group.userData.subparts = {};
    for (const [k, v] of Object.entries(sub)) {
      if (!v) continue;
      group[k] = v;
      group.userData.subparts[k] = v;
      if (v.isObject3D && (!v.name || v.name === 'part')) v.name = k;
    }
    group.userData.tris = countTris(group);
    group.userData.overBudget = group.userData.tris > budget;
    return group;
  }

  const ctx = {
    THREE, G, L, M, F, MM, dims,
    car: opts.car || null,
    palette: () => M.palette(),
    reg, expose, countTris, stats
  };

  const builders = {
    seat: buildSeat,
    batteryModule: buildBatteryModule,
    batteryPack: buildBatteryPack,
    driveUnit: buildDriveUnit,
    ecu: buildEcu,
    biw: buildBiw,
    suspension: buildSuspensionCorner,
    brake: buildBrakeCorner,
    doorPanel: buildDoorPanel,
    endMill: buildEndMill,
    robotArm: buildRobotArm,
    toggleClamp: buildToggleClamp,
    gauge: buildGauge
  };

  const api = {
    VERSION, THREE, G, L, M, F, ctx, catalog: CATALOG, totalBudget: TOTAL_BUDGET, builders,
    // 建一个部件：parts.build('batteryPack', {serial: 'X'})
    build(key, o = {}) {
      const b = builders[key];
      if (!b) throw new Error('未知部件: ' + key + '（可用: ' + Object.keys(builders).join(', ') + '）');
      const g = b(ctx, o);
      const meta = CATALOG.find(c => c.key === key);
      if (meta) { g.userData.budget = meta.budget; g.userData.overBudget = g.userData.tris > meta.budget; }
      return g;
    },
    // 全部建一遍（验收/预览用）
    buildAll(o = {}) {
      const out = {};
      for (const k of Object.keys(builders)) out[k] = api.build(k, o);
      return out;
    },
    stats,
    // 释放：几何 + 材质 + 贴图
    dispose(root) {
      const tex = new Set();
      root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const k of ['map', 'roughnessMap', 'bumpMap', 'normalMap', 'emissiveMap', 'alphaMap']) if (m[k]) tex.add(m[k]);
          m.dispose();
        }
      });
      for (const t of tex) t.dispose();
    }
  };
  return api;
}
