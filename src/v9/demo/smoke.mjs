#!/usr/bin/env node
// =====================================================================
// demo/smoke.mjs —— 渲染层无头冒烟测试（不需要 WebGL/浏览器）
//
//   node src/v9/demo/smoke.mjs
//
// 用假 stage（只有 scene/camera/controls）调用 buildShotStage + applyStates，
// 覆盖全部 unit.kind 的几何构建与位姿写入，并逐单位核对
// "网格位置 == 状态世界坐标"。浏览器里跑的就是这两个函数。
// =====================================================================
import * as THREE from 'three';
import {buildShotStage, applyStates, frameCamera} from './bind-three.js';
import {getShot, SHOT_COUNT} from './engineering-2.js';

const fakeStage = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(35, 1.6, 0.05, 120),
  controls: {target: new THREE.Vector3(), update() {}}
};

let checks = 0, bad = 0;
const fails = [];

for (let i = 0; i < SHOT_COUNT; i++) {
  const shot = getShot(i);
  const rig = buildShotStage(fakeStage, shot);
  const times = [0, shot.timeline.duration * 0.25, shot.timeline.duration * 0.5, shot.timeline.duration * 0.75, shot.timeline.duration];
  for (const t of times) {
    const states = shot.timeline.stateAt(t);
    applyStates(rig, states);
    const units = new Map(shot.units.map((u) => [u.id, u]));
    for (const [id, e] of rig.entries) {
      const st = states[id];
      const u = units.get(id);
      const par = u.parent ? states[u.parent].pos : {x: 0, y: 0, z: 0};
      const ex = par.x + st.pos.x, ey = par.y + st.pos.y, ez = par.z + st.pos.z;
      const p = e.group.position;
      checks++;
      if (Math.abs(p.x - ex) > 1e-9 || Math.abs(p.y - ey) > 1e-9 || Math.abs(p.z - ez) > 1e-9) {
        bad++;
        fails.push(`${shot.id}/${id}@${t.toFixed(2)} 网格 ${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)} != 状态 ${ex.toFixed(3)},${ey.toFixed(3)},${ez.toFixed(3)}`);
      }
      if (e.mats.some((m) => !Number.isFinite(m.opacity))) {
        bad++;
        fails.push(`${shot.id}/${id}@${t.toFixed(2)} 材质 opacity 非有限值`);
      }
      if (!Number.isFinite(e.group.scale.x) || !Number.isFinite(e.group.scale.y)) {
        bad++;
        fails.push(`${shot.id}/${id}@${t.toFixed(2)} scale 非有限值`);
      }
    }
  }
  frameCamera(fakeStage, shot.camera);
  rig.dispose();
  console.log(`  ${shot.id}  ${rig.entries.size} 个网格  OK`);
}

console.log(`\n  smoke: ${checks} 次位置核对，失败 ${bad}`);
if (bad) { for (const f of fails.slice(0, 10)) console.log('   - ' + f); process.exitCode = 1; }
else console.log('  全部通过');
