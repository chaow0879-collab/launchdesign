import * as THREE from 'three';

// 复刻 kit.js:157 的判定，确认修法对 three 0.180 的 Curve 成立
const curve = new THREE.CatmullRomCurve3([
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, 2, 0),
]);

console.log('Curve 是否存在 isCurve 标记 :', 'isCurve' in curve, '=', curve.isCurve);
console.log('getPointAt 是否可调用        :', typeof curve.getPointAt === 'function');
console.log('旧判定 (path.isCurve)        :', !!(curve && curve.isCurve), '→ 会误走 K.curve() 分支');
console.log('新判定 (typeof getPointAt)   :', typeof curve.getPointAt === 'function', '→ 直接当曲线用');

// 点数组仍要正确
const pts = [[0, 0, 0], [0, 1, 0]];
console.log('点数组走新判定               :', typeof (pts && pts.getPointAt) === 'function' ? '误判为曲线' : '正确落到 K.curve()');
