import * as THREE from 'three';
import {createKit} from '../../../src/engine/kit.js';
import {createSystems} from '../../../src/engine/systems.js';
import fs from 'node:fs';

const scene = new THREE.Scene();
const K = createKit(scene);
const car = {
  wheelR: .36,
  wheelCenters: [{x: 1.48, y: .36, z: .80}, {x: 1.48, y: .36, z: -.80}, {x: -1.39, y: .36, z: .80}, {x: -1.39, y: .36, z: -.80}],
  topAt: (x) => ({roof: 1.40 - .10 * Math.pow((x - .1) / 1.6, 2), top: 1.0, bot: .3, half: .9}),
  wheels: [], root: {position: {x: 0}}
};
const S = createSystems(K, car);
const tris = (root) => {
  let n = 0, meshes = 0;
  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const g = o.geometry;
    n += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  });
  return {tris: Math.round(n), meshes};
};
const out = {};
let total = 0, totalMesh = 0;
for (const k of Object.keys(S.groups)) {
  const r = tris(S.groups[k]);
  out[k] = r; total += r.tris; totalMesh += r.meshes;
}
const info = {groups: out, total, totalMesh, root: tris(S.groups ? K.sysRoot : K.sysRoot)};
fs.writeFileSync('src/v9/parts/.before.json', JSON.stringify(info, null, 2));
console.log(JSON.stringify(info, null, 2));
console.log('counts:', {
  batteryModules: S.battery.modules.length, seats: S.cabin.seats.length,
  beams: S.biw.beams.length, joints: S.biw.joints.length, chassisParts: S.chassis.parts.length
});
