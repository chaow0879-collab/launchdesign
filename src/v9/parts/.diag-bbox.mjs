import * as THREE from 'three';
import {createKit} from '../../engine/kit.js';
import {createSystems} from '../../engine/systems.js';
const car = {
  wheelR: .36,
  wheelCenters: [{x: 1.48, y: .36, z: .8}, {x: 1.48, y: .36, z: -.8}, {x: -1.39, y: .36, z: .8}, {x: -1.39, y: .36, z: -.8}],
  wheels: [], root: {position: {x: 0}}, topAt: (x) => ({roof: 1.4 - .1 * Math.pow((x - .1) / 1.6, 2)})
};
const K = createKit(new THREE.Scene());
const S = createSystems(K, car);
S.battery.g.updateMatrixWorld(true);
const list = [];
S.battery.g.traverse(o => {
  if (!o.isMesh || !o.geometry) return;
  o.geometry.computeBoundingBox();
  const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
  list.push({n: o.name || o.type, x0: b.min.x, x1: b.max.x, y0: b.min.y, y1: b.max.y, z0: b.min.z, z1: b.max.z});
});
for (const axis of ['x', 'y', 'z']) {
  const hi = [...list].sort((a, b) => b[axis + '1'] - a[axis + '1']).slice(0, 4).map(v => `${v.n}=${v[axis + '1'].toFixed(3)}`);
  const lo = [...list].sort((a, b) => a[axis + '0'] - b[axis + '0']).slice(0, 4).map(v => `${v.n}=${v[axis + '0'].toFixed(3)}`);
  console.log(axis, 'max:', hi.join(' '), '| min:', lo.join(' '));
}
console.log('modules y', S.battery.modules.map(m => m.position.y.toFixed(2)).slice(0, 3));
