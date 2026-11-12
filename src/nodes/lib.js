// 工序脚本共用的小道具（都返回已登记、默认隐藏的对象）
import * as THREE from 'three';
import {COL, op} from '../engine/kit.js';
import {clamp, smooth, ease, lerp} from '../engine/core.js';
export {COL, op, clamp, smooth, ease, lerp, THREE};
export const V3 = (a) => new THREE.Vector3(...a);
export const mixV = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
export const setP = (o, p) => o.position.set(p[0], p[1], p[2]);

// 徽章（图标 + 底盘），可选落地光圈
export function chip(K, icon, color, pos, size = .4) { const b = K.add(K.badge(icon, color, size)); setP(b, pos); return b; }
// 两点之间的连线（按 k 画出）
export function link(K, a, b, color = COL.cyan, lift = .25, dashed = false) {
  const mid = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2];
  const l = K.curveLine([a, mid, b], color, .85, 60); if (dashed) { l.material = new THREE.LineDashedMaterial({color: new THREE.Color(color).multiplyScalar(1.5), dashSize: .05, gapSize: .05, transparent: true, opacity: .85, toneMapped: false}); l.computeLineDistances(); }
  l.userData.n = 61; return K.add(l);
}
// 地面光圈
export function floorRing(K, r, color, pos = [0, 0, 0]) { const g = K.group(K.ring(r, color, .01), K.disc(r, color, .08)); g.children.forEach(c => c.rotation.x = -Math.PI / 2); setP(g, [pos[0], .01 + (pos[1] || 0), pos[2]]); return K.add(g); }
// 透明边界墙（带图标）
export function wall(K, w, h, color, icon) {
  const g = new THREE.Group();
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {uColor: {value: new THREE.Color(color)}, uOpacity: {value: .5}, uT: {value: 0}},
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; uniform float uT; varying vec2 vU; void main(){ float gx = step(.92, fract(vU.x*14.0)); float gy = step(.9, fract(vU.y*7.0)); float edge = smoothstep(.0,.04,vU.y)*(1.0-smoothstep(.75,1.0,vU.y)); float a = (.10 + .5*max(gx,gy))*edge + smoothstep(.06,.0,vU.y)*.9; gl_FragColor = vec4(uColor*1.6, a*uOpacity); }'}));
  m.position.y = h / 2; g.add(m);
  const base = K.glow(new THREE.BoxGeometry(w, .015, .015), color, 2.6, .9); base.position.y = .01; g.add(base);
  if (icon) { const b = K.badge(icon, color, .38); b.position.set(0, h + .25, 0); g.add(b); g.userData.icon = b; }
  g.userData.plane = m; return K.add(g);
}
// 道路标线（随时间后移，表现车辆在行驶）
export function road(K, len = 16, color = COL.cyan) {
  const g = new THREE.Group(); const dashes = [];
  for (let i = 0; i < 24; i++) { const d = K.glow(new THREE.BoxGeometry(.5, .004, .05), color, 1.8, .6); d.position.set(-len / 2 + i * len / 24, .006, 0); g.add(d); dashes.push(d); }
  for (const z of [1.55, -1.55]) { const e = K.glow(new THREE.BoxGeometry(len, .004, .03), color, 1.6, .45); e.position.set(0, .006, z); g.add(e); }
  g.userData.move = (t, speed = 6) => dashes.forEach((d, i) => { d.position.x = ((-len / 2 + i * len / 24 - t * speed) % len + len * 1.5) % len - len / 2; });
  return K.add(g);
}
// 气流线：沿车身侧面轮廓上沿流过
export function airflow(K, car, n = 7, color = COL.cyan) {
  const g = new THREE.Group(); const flows = [];
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * .22, pts = [];
    for (let x = 3.6; x >= -3.8; x -= .2) { const ax = clamp(x, -2.3, 2.3), b = car.topAt(ax); const over = Math.abs(x) > 2.36 ? (Math.abs(x) - 2.36) * .25 : 0; const y = (Math.abs(z) < .6 ? b.roof : b.top * .85) + .06 + i * .0 + .05 + over * (x > 0 ? -.4 : .2); pts.push([x, Math.max(.35, y + (x > 2.3 ? -.25 * (x - 2.3) : 0)), z]); }
    const f = K.flow(pts, {color, n: 26, size: 4, speed: .22}); g.add(f); flows.push(f);
  }
  g.userData.update = (t, reach = 1) => flows.forEach((f, i) => f.userData.update(t + i * .37, reach));
  return K.add(g);
}
// 矩阵：rows×cols 的发光格
export function matrix(K, rows, cols, cell = .3, color = COL.cyan) {
  const g = new THREE.Group(); const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const m = K.holoBox(cell * .9, cell * .62, .02, color, .18, .9); m.position.set((c - (cols - 1) / 2) * cell, (rows - 1 - r) * cell * .7, 0); g.add(m); cells.push(m); m.userData.rc = [r, c];
  }
  g.userData.cells = cells; return K.add(g);
}
// 节拍内依次出现：返回第 i 个元素的进度
export const stagger = (k, i, n, ov = .5) => { const w = 1 / (1 + (n - 1) * (1 - ov)); return ease(clamp((k - i * w * (1 - ov)) / w)); };
// 某个机位方位角下的“朝向镜头”方向 d、屏幕向右方向 right、让平面正对镜头的 y 旋转 ry
export function axes(azDeg) {
  const a = azDeg * Math.PI / 180, d = [Math.cos(a), 0, Math.sin(a)], right = [Math.sin(a), 0, -Math.cos(a)];
  return {d, right, ry: Math.atan2(d[0], d[2]), at: (c, along = 0, toward = 0, up = 0) => [c[0] + right[0] * along + d[0] * toward, c[1] + up, c[2] + right[2] * along + d[2] * toward]};
}
// 尺寸线（两端短竖线）
export function dim(K, a, b, color = COL.white, tick = .12) {
  const g = new THREE.Group(); const up = [0, tick, 0];
  g.add(K.line([a, b], color, .9), K.line([[a[0], a[1] - tick / 2, a[2]], [a[0], a[1] + tick / 2, a[2]]], color, .9), K.line([[b[0], b[1] - tick / 2, b[2]], [b[0], b[1] + tick / 2, b[2]]], color, .9));
  return K.add(g);
}
// 硬点：发光小球 + 光圈
export function hardpoint(K, p, color = COL.amber, r = .045) { const g = new THREE.Group(); const s = K.glow(new THREE.SphereGeometry(r, 14, 10), color, 2.6); g.add(s); setP(g, p); return K.add(g); }
// 侧面轮廓线（来自真车采样），z 为放置的侧面位置，可整体缩放后挂到画板上
export function profileCurve(car, {z = 0, y0 = 0, scale = 1, x0 = 0, smoothN = 1} = {}) {
  const top = car.profile.filter((b, i) => i % 2 === 0).map(b => [x0 + b.x * scale, y0 + b.top * scale, z]);
  const bot = car.profile.filter((b, i) => i % 2 === 0).map(b => [x0 + b.x * scale, y0 + Math.max(b.bot, .18) * scale, z]).reverse();
  return [...top, ...bot, top[0]];
}
// 车顶面采样网格点
export function surfaceGrid(car, nx = 11, nz = 5, inset = .25) {
  const pts = []; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -2.25 + inset + i * (4.5 - 2 * inset) / (nx - 1), z = -.82 + j * 1.64 / (nz - 1); pts.push([x, car.heightAt(x, z) + .015, z, i, j]); } return pts;
}
// 文件叠（无文字的薄片）
export function docStack(K, n = 5, color = COL.cyan, w = .42, h = .56) {
  const g = new THREE.Group(); const sheets = [];
  for (let i = 0; i < n; i++) { const s = K.holo(new THREE.BoxGeometry(w, .008, h), color, .22, .9); s.position.y = i * .04; g.add(s); sheets.push(s);
    for (let k = 0; k < 3; k++) { const l = K.glow(new THREE.BoxGeometry(w * (.7 - k * .15), .002, .012), color, 1.6, .7); l.position.set(-w * .05, .006, -h * .25 + k * .12); s.add(l); } }
  g.userData.sheets = sheets; return K.add(g);
}
// 龙门（全息框架）+ 主轴
export function gantry(K, span = 3.2, h = 2.0, color = COL.cyan) {
  const g = new THREE.Group();
  const post = (x, z) => { const p = K.holoBox(.08, h, .08, color, .1, .9); p.position.set(x, h / 2, z); g.add(p); };
  post(0, span / 2); post(0, -span / 2);
  const beam = K.holoBox(.12, .12, span + .1, color, .15, .95); beam.position.set(0, h, 0); g.add(beam);
  const carriage = new THREE.Group(); const cb = K.holoBox(.22, .2, .22, color, .2, 1); carriage.add(cb);
  const spindle = K.solid(new THREE.CylinderGeometry(.035, .02, .5, 16), 0xc9d6df, {metal: .9, rough: .25}); spindle.position.y = -.35; carriage.add(spindle);
  const tip = K.glow(new THREE.SphereGeometry(.03, 12, 8), COL.amber, 3); tip.position.y = -.6; carriage.add(tip);
  carriage.position.set(0, h, 0); g.add(carriage);
  g.userData = {carriage, spindle, tip, h};
  return K.add(g);
}
// 简化机械臂：底座 + 两节 + 末端工具，reach(target) 让末端到达目标点
export function robotArm(K, base, color = 0x9fb3c2, tool = COL.amber) {
  const g = new THREE.Group(); setP(g, base);
  const mat = () => new THREE.MeshStandardMaterial({color, metalness: .7, roughness: .3, transparent: true});
  const b = new THREE.Mesh(new THREE.CylinderGeometry(.16, .2, .18, 24), mat()); b.position.y = .09; g.add(b);
  const l1 = new THREE.Mesh(new THREE.BoxGeometry(.09, 1, .09), mat()), l2 = new THREE.Mesh(new THREE.BoxGeometry(.07, 1, .07), mat());
  const j1 = new THREE.Mesh(new THREE.SphereGeometry(.07, 16, 12), mat()), j2 = j1.clone();
  const tip = K.glow(new THREE.SphereGeometry(.035, 12, 8), tool, 2.8);
  g.add(l1, l2, j1, j2, tip);
  const L1 = .95, L2 = .85;
  g.userData.reach = (target) => {
    const T = new THREE.Vector3(...target).sub(g.position); const sh = new THREE.Vector3(0, .2, 0);
    const d = T.clone().sub(sh), dist = Math.min(d.length(), L1 + L2 - .01);
    const a = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
    const dir = d.clone().normalize(), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize(); if (side.lengthSq() < .01) side.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(side, dir).normalize();
    const elbow = sh.clone().add(dir.clone().multiplyScalar(Math.cos(a) * L1)).add(up.multiplyScalar(Math.sin(a) * L1));
    const end = sh.clone().add(dir.multiplyScalar(dist));
    const place = (m, p0, p1) => { m.position.copy(p0).add(p1).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize()); m.scale.set(1, p0.distanceTo(p1), 1); };
    place(l1, sh, elbow); place(l2, elbow, end); j1.position.copy(sh); j2.position.copy(elbow); tip.position.copy(end);
  };
  g.userData.reach([base[0] + .6, base[1] + 1.2, base[2]]);
  return K.add(g);
}
// 顶部灯带（用于光影评审）
export function lightBars(K, n = 5, len = 5.6, color = COL.white) {
  const g = new THREE.Group(); const bars = [];
  for (let i = 0; i < n; i++) { const b = K.glow(new THREE.BoxGeometry(len, .03, .05), color, 2.6, .9); b.position.set(0, 2.6, (i - (n - 1) / 2) * .55); g.add(b); bars.push(b); }
  g.userData.bars = bars; return K.add(g);
}
// 一排“任务块”（无文字，用颜色区分专业）
export function taskBars(K, defs) {
  const g = new THREE.Group(); const bars = defs.map(([x, y, w, c]) => { const b = K.holo(new THREE.BoxGeometry(w, .14, .14), c, .35, 1); b.position.set(x + w / 2, y, 0); g.add(b); b.userData.w = w; b.userData.x = x; return b; });
  g.userData.bars = bars; return K.add(g);
}
// 数字模型灰模：k 为显示比例；可选局部隆起（center, radius, amount），lit 为高亮比例
export function cad(car, k, {center, radius = .5, amount = 0, lit = 0} = {}) {
  const u = car.layers.heat.mat.uniforms; car.set('heat', k); u.uMode.value = 3; u.uDeform.value = amount; u.uLoad.value = lit;
  if (center) u.uCenter.value.set(...center); u.uRadius.value = radius;
}
// 特征线：肩线、轮拱、门缝、窗框、灯具轮廓（两侧对称）
export function featureLines(K, car, color = COL.cyan) {
  const pr = car.profile.filter((b, i) => i % 2 === 0), L = {};
  const side = s => {
    const z = b => s * (b.half + .012);
    const shoulder = pr.filter(b => b.x > -2.2 && b.x < 2.15).map(b => [b.x, Math.min(b.top - .02, .93 + .04 * Math.cos(b.x * .8)), z(b)]);
    const arch = c => { const pts = []; for (let a = 0; a <= 32; a++) { const u = Math.PI * (a / 32); pts.push([c.x + Math.cos(u) * (car.wheelR + .06), c.y + Math.sin(u) * (car.wheelR + .06), s * .9]); } return pts; };
    const win = pr.filter(b => b.x > -1.4 && b.x < .98).map(b => [b.x, Math.max(1.0, b.roof - .08), s * (b.half - .1)]);
    const winB = [[-1.4, 1.0, s * .78], [.98, 1.0, s * .8]];
    const door = [1.0, -.05, -1.15].map(x => [[x, .38, s * .93], [x, .95, s * .9], [x - .12, Math.max(1.0, car.topAt(x).roof - .08), s * .78]]);
    const lampF = []; for (let a = 0; a <= 24; a++) { const u = a / 24 * Math.PI * 2; lampF.push([2.12 + Math.cos(u) * .12, .74 + Math.sin(u) * .045, s * (.62 + Math.cos(u) * .1)]); }
    const lampR = []; for (let a = 0; a <= 24; a++) { const u = a / 24 * Math.PI * 2; lampR.push([-2.2 + Math.cos(u) * .06, .9 + Math.sin(u) * .04, s * (.62 + Math.cos(u) * .14)]); }
    return {shoulder, archF: arch(car.wheelCenters[0]), archR: arch(car.wheelCenters[2]), win, winB, door, lampF, lampR};
  };
  for (const s of [1, -1]) { const d = side(s); for (const [k, v] of Object.entries(d)) { if (k === 'door') v.forEach((pts, i) => { L[`door${i}${s}`] = K.add(K.line(pts, color, .95)); }); else L[k + s] = K.add(K.line(v, color, .95)); } }
  return L;
}
// 曲率梳：沿一条截面曲线画出与曲率成比例的法向短线
export function curvComb(K, pts, color = COL.amber, scale = .25) {
  const V = pts.map(p => new THREE.Vector3(...p)), seg = [];
  for (let i = 1; i < V.length - 1; i++) {
    const a = V[i - 1], b = V[i], c = V[i + 1];
    const t1 = b.clone().sub(a), t2 = c.clone().sub(b); const k = t1.clone().normalize().sub(t2.clone().normalize()).length() / Math.max(.02, (t1.length() + t2.length()) / 2);
    const n = new THREE.Vector3(0, 0, 0).add(t1.clone().normalize()).sub(t2.clone().normalize()).normalize().negate();
    seg.push(b, b.clone().add(n.multiplyScalar(Math.min(.35, k * scale))));
  }
  const g = new THREE.BufferGeometry().setFromPoints(seg);
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: .85, toneMapped: false, depthWrite: false}));
  l.userData.n = seg.length; return K.add(l);
}
// 截面线：在 x 处横切车顶面
export function section(car, x, n = 30) { const pts = []; for (let k = 0; k <= n; k++) { const z = -.95 + k * 1.9 / n; pts.push([x, car.heightAt(x, z) + .01, z]); } return pts; }
// 控制网：网格点 + 连线
export function ctrlNet(K, car, nx = 9, nz = 5, color = COL.cyan) {
  const pts = surfaceGrid(car, nx, nz, .35); const g = new THREE.Group();
  const dots = pts.map(p => { const d = K.glow(new THREE.SphereGeometry(.028, 10, 8), color, 2.4); d.position.set(p[0], p[1] + .04, p[2]); d.userData.home = d.position.clone(); d.userData.ij = [p[3], p[4]]; g.add(d); return d; });
  const segs = []; for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const k = i * nz + j; if (j < nz - 1) segs.push([k, k + 1]); if (i < nx - 1) segs.push([k, k + nz]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(segs.length * 6), 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.3), transparent: true, opacity: .5, toneMapped: false, depthWrite: false})); g.add(lines);
  g.userData = {dots, segs, lines, refresh() { const a = geo.attributes.position; segs.forEach(([p, q], k) => { const A = dots[p].position, B = dots[q].position; a.setXYZ(2 * k, A.x, A.y, A.z); a.setXYZ(2 * k + 1, B.x, B.y, B.z); }); a.needsUpdate = true; }};
  g.userData.refresh(); return K.add(g);
}
