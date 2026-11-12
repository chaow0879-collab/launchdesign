// 道具工具箱：全息线框、图标徽章、能量/信号流、可“生长”的管线。所有道具默认透明度 0，由工序脚本按时间点亮。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {clamp, smooth} from './core.js';

export const COL = {cyan: 0x52d6ff, blue: 0x3d8bff, teal: 0x2fe3c0, green: 0x5dff9a, amber: 0xffb547, orange: 0xff7a2f, red: 0xff4d5e, violet: 0xa98bff, white: 0xeaf6ff, pink: 0xff6fb5, gold: 0xffd36b};
const tmpV = new THREE.Vector3();

// ---- 透明度：记录每个材质的基础透明度，再整体乘一个系数 ----
export function op(obj, o) {
  o = clamp(o);
  obj.visible = o > .003;
  if (!obj.visible) return;
  obj.traverse(n => {
    const mats = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    for (const m of mats) {
      if (m.userData.b === undefined) m.userData.b = m.uniforms?.uOpacity ? m.uniforms.uOpacity.value : m.opacity;
      if (m.uniforms?.uOpacity) m.uniforms.uOpacity.value = m.userData.b * o;
      else { m.opacity = m.userData.b * o; m.transparent = true; }
    }
  });
}

// ---- 图标：画在画布上，作为始终面向镜头的徽章 ----
const ICON = {
  user(g) { g.beginPath(); g.arc(64, 46, 16, 0, 7); g.stroke(); g.beginPath(); g.arc(64, 104, 32, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); },
  home(g) { g.beginPath(); g.moveTo(30, 62); g.lineTo(64, 32); g.lineTo(98, 62); g.moveTo(40, 56); g.lineTo(40, 96); g.lineTo(88, 96); g.lineTo(88, 56); g.moveTo(58, 96); g.lineTo(58, 76); g.lineTo(70, 76); g.lineTo(70, 96); g.stroke(); },
  city(g) { g.beginPath(); g.rect(30, 50, 26, 46); g.rect(62, 34, 34, 62); g.moveTo(38, 62); g.lineTo(48, 62); g.moveTo(38, 74); g.lineTo(48, 74); g.moveTo(70, 48); g.lineTo(88, 48); g.moveTo(70, 62); g.lineTo(88, 62); g.moveTo(70, 76); g.lineTo(88, 76); g.stroke(); },
  route(g) { g.beginPath(); g.moveTo(40, 100); g.lineTo(56, 30); g.moveTo(88, 100); g.lineTo(72, 30); g.stroke(); g.setLineDash([8, 10]); g.beginPath(); g.moveTo(64, 98); g.lineTo(64, 32); g.stroke(); g.setLineDash([]); },
  seat(g) { g.beginPath(); g.moveTo(46, 30); g.quadraticCurveTo(40, 60, 50, 80); g.lineTo(86, 80); g.quadraticCurveTo(92, 92, 86, 98); g.lineTo(50, 98); g.moveTo(56, 98); g.lineTo(56, 104); g.moveTo(80, 98); g.lineTo(80, 104); g.stroke(); },
  plug(g) { g.beginPath(); g.moveTo(52, 28); g.lineTo(52, 46); g.moveTo(76, 28); g.lineTo(76, 46); g.rect(40, 46, 48, 26); g.moveTo(64, 72); g.lineTo(64, 84); g.quadraticCurveTo(64, 104, 84, 104); g.stroke(); },
  chip(g) { g.beginPath(); g.rect(40, 40, 48, 48); g.rect(54, 54, 20, 20); for (let i = 0; i < 3; i++) { const p = 50 + i * 14; g.moveTo(p, 40); g.lineTo(p, 28); g.moveTo(p, 88); g.lineTo(p, 100); g.moveTo(40, p); g.lineTo(28, p); g.moveTo(88, p); g.lineTo(100, p); } g.stroke(); },
  coin(g) { g.beginPath(); g.arc(64, 64, 34, 0, 7); g.moveTo(52, 50); g.lineTo(64, 64); g.lineTo(76, 50); g.moveTo(64, 64); g.lineTo(64, 86); g.moveTo(52, 68); g.lineTo(76, 68); g.moveTo(52, 78); g.lineTo(76, 78); g.stroke(); },
  law(g) { g.beginPath(); g.moveTo(64, 28); g.lineTo(64, 100); g.moveTo(44, 100); g.lineTo(84, 100); g.moveTo(34, 42); g.lineTo(94, 42); g.moveTo(40, 42); g.lineTo(28, 70); g.lineTo(52, 70); g.closePath(); g.moveTo(88, 42); g.lineTo(76, 70); g.lineTo(100, 70); g.closePath(); g.stroke(); },
  clock(g) { g.beginPath(); g.arc(64, 64, 36, 0, 7); g.moveTo(64, 64); g.lineTo(64, 40); g.moveTo(64, 64); g.lineTo(82, 74); g.stroke(); },
  battery(g) { g.beginPath(); g.rect(32, 44, 58, 40); g.rect(90, 56, 8, 16); g.stroke(); g.fillStyle = '#fff'; g.fillRect(40, 52, 12, 24); g.fillRect(56, 52, 12, 24); g.fillRect(72, 52, 10, 24); },
  wind(g) { g.beginPath(); g.moveTo(26, 52); g.lineTo(80, 52); g.arc(80, 42, 10, Math.PI / 2, -Math.PI * .9, true); g.moveTo(26, 70); g.lineTo(92, 70); g.moveTo(26, 88); g.lineTo(72, 88); g.arc(72, 98, 10, -Math.PI / 2, Math.PI * .9); g.stroke(); },
  weight(g) { g.beginPath(); g.arc(64, 38, 10, 0, 7); g.moveTo(44, 52); g.lineTo(84, 52); g.lineTo(98, 100); g.lineTo(30, 100); g.closePath(); g.stroke(); },
  bolt(g) { g.beginPath(); g.moveTo(72, 24); g.lineTo(42, 70); g.lineTo(64, 70); g.lineTo(56, 104); g.lineTo(88, 56); g.lineTo(66, 56); g.closePath(); g.stroke(); },
  check(g) { g.lineWidth = 11; g.beginPath(); g.moveTo(36, 66); g.lineTo(56, 86); g.lineTo(94, 44); g.stroke(); },
  cross(g) { g.lineWidth = 11; g.beginPath(); g.moveTo(42, 42); g.lineTo(86, 86); g.moveTo(86, 42); g.lineTo(42, 86); g.stroke(); },
  warn(g) { g.beginPath(); g.moveTo(64, 28); g.lineTo(102, 96); g.lineTo(26, 96); g.closePath(); g.moveTo(64, 52); g.lineTo(64, 74); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 85, 4.5, 0, 7); g.fill(); },
  gear(g) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.moveTo(64 + Math.cos(a) * 26, 64 + Math.sin(a) * 26); g.lineTo(64 + Math.cos(a) * 38, 64 + Math.sin(a) * 38); } g.stroke(); g.beginPath(); g.arc(64, 64, 26, 0, 7); g.stroke(); g.beginPath(); g.arc(64, 64, 10, 0, 7); g.stroke(); },
  doc(g) { g.beginPath(); g.moveTo(40, 26); g.lineTo(76, 26); g.lineTo(90, 40); g.lineTo(90, 102); g.lineTo(40, 102); g.closePath(); g.moveTo(50, 52); g.lineTo(80, 52); g.moveTo(50, 66); g.lineTo(80, 66); g.moveTo(50, 80); g.lineTo(70, 80); g.stroke(); },
  lock(g) { g.beginPath(); g.rect(38, 58, 52, 40); g.moveTo(48, 58); g.lineTo(48, 46); g.arc(64, 46, 16, Math.PI, 0); g.lineTo(80, 58); g.moveTo(64, 72); g.lineTo(64, 84); g.stroke(); },
  wifi(g) { g.beginPath(); g.arc(64, 92, 52, -Math.PI * .78, -Math.PI * .22); g.stroke(); g.beginPath(); g.arc(64, 92, 34, -Math.PI * .76, -Math.PI * .24); g.stroke(); g.beginPath(); g.arc(64, 92, 16, -Math.PI * .74, -Math.PI * .26); g.stroke(); },
  eye(g) { g.beginPath(); g.moveTo(24, 64); g.quadraticCurveTo(64, 24, 104, 64); g.quadraticCurveTo(64, 104, 24, 64); g.stroke(); g.beginPath(); g.arc(64, 64, 13, 0, 7); g.stroke(); },
  wrench(g) { g.beginPath(); g.moveTo(40, 96); g.lineTo(74, 62); g.arc(84, 46, 18, Math.PI * .75, Math.PI * 2.1); g.lineTo(88, 52); g.lineTo(80, 48); g.lineTo(84, 38); g.stroke(); },
  drop(g) { g.beginPath(); g.moveTo(64, 26); g.quadraticCurveTo(96, 66, 90, 80); g.arc(64, 78, 26, 0, Math.PI); g.quadraticCurveTo(32, 66, 64, 26); g.stroke(); },
  target(g) { g.beginPath(); g.arc(64, 64, 36, 0, 7); g.stroke(); g.beginPath(); g.arc(64, 64, 20, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 6, 0, 7); g.fill(); },
  link(g) { g.beginPath(); g.ellipse(50, 70, 18, 12, -Math.PI / 4, 0, 7); g.stroke(); g.beginPath(); g.ellipse(78, 58, 18, 12, -Math.PI / 4, 0, 7); g.stroke(); },
  loop(g) { g.beginPath(); g.arc(64, 64, 32, -Math.PI * .1, Math.PI * 1.35); g.stroke(); g.beginPath(); g.moveTo(92, 44); g.lineTo(96, 62); g.lineTo(80, 58); g.stroke(); },
  thermo(g) { g.beginPath(); g.moveTo(56, 74); g.lineTo(56, 34); g.arc(64, 34, 8, Math.PI, 0); g.lineTo(72, 74); g.arc(64, 86, 15, -Math.PI * .3, Math.PI * 1.3); g.stroke(); },
  radar(g) { g.beginPath(); g.moveTo(30, 98); g.lineTo(64, 40); g.lineTo(98, 98); g.stroke(); g.beginPath(); g.arc(64, 40, 30, Math.PI * .33, Math.PI * .67); g.stroke(); g.beginPath(); g.arc(64, 40, 50, Math.PI * .35, Math.PI * .65); g.stroke(); },
  screen(g) { g.beginPath(); g.rect(28, 36, 72, 46); g.moveTo(50, 98); g.lineTo(78, 98); g.moveTo(64, 82); g.lineTo(64, 98); g.stroke(); },
  box(g) { g.beginPath(); g.moveTo(64, 26); g.lineTo(98, 44); g.lineTo(98, 84); g.lineTo(64, 102); g.lineTo(30, 84); g.lineTo(30, 44); g.closePath(); g.moveTo(30, 44); g.lineTo(64, 62); g.lineTo(98, 44); g.moveTo(64, 62); g.lineTo(64, 102); g.stroke(); },
  book(g) { g.beginPath(); g.moveTo(64, 40); g.quadraticCurveTo(46, 30, 26, 34); g.lineTo(26, 92); g.quadraticCurveTo(46, 88, 64, 98); g.quadraticCurveTo(82, 88, 102, 92); g.lineTo(102, 34); g.quadraticCurveTo(82, 30, 64, 40); g.lineTo(64, 98); g.stroke(); },
  search(g) { g.beginPath(); g.arc(56, 56, 24, 0, 7); g.moveTo(74, 74); g.lineTo(98, 98); g.stroke(); },
  ruler(g) { g.beginPath(); g.moveTo(24, 64); g.lineTo(104, 64); g.moveTo(24, 50); g.lineTo(24, 78); g.moveTo(104, 50); g.lineTo(104, 78); g.moveTo(34, 56); g.lineTo(24, 64); g.lineTo(34, 72); g.moveTo(94, 56); g.lineTo(104, 64); g.lineTo(94, 72); g.stroke(); },
  flag(g) { g.beginPath(); g.moveTo(40, 104); g.lineTo(40, 26); g.lineTo(92, 40); g.lineTo(40, 58); g.stroke(); },
  shield(g) { g.beginPath(); g.moveTo(64, 24); g.lineTo(96, 36); g.quadraticCurveTo(96, 84, 64, 104); g.quadraticCurveTo(32, 84, 32, 36); g.closePath(); g.stroke(); },
  stamp(g) { g.beginPath(); g.arc(64, 64, 36, 0, 7); g.stroke(); g.lineWidth = 9; g.beginPath(); g.moveTo(46, 64); g.lineTo(60, 78); g.lineTo(84, 50); g.stroke(); },
  people(g) { g.beginPath(); g.arc(46, 50, 11, 0, 7); g.arc(82, 50, 11, 0, 7); g.stroke(); g.beginPath(); g.arc(46, 98, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(82, 98, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); },
  palette(g) { g.beginPath(); g.arc(64, 64, 36, 0, 7); g.stroke(); g.fillStyle = '#fff'; [[50, 50], [70, 44], [84, 60], [50, 76]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }); },
  sound(g) { g.beginPath(); g.moveTo(30, 54); g.lineTo(44, 54); g.lineTo(62, 38); g.lineTo(62, 90); g.lineTo(44, 74); g.lineTo(30, 74); g.closePath(); g.stroke(); g.beginPath(); g.arc(66, 64, 18, -0.8, .8); g.stroke(); g.beginPath(); g.arc(66, 64, 32, -0.8, .8); g.stroke(); },
  snow(g) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; g.moveTo(64 + Math.cos(a) * 36, 64 + Math.sin(a) * 36); g.lineTo(64 - Math.cos(a) * 36, 64 - Math.sin(a) * 36); } g.stroke(); },
  crash(g) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? 18 : 38; const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
};
const iconCache = new Map();
function iconTexture(name, ring = true) {
  const key = name + ring;
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  if (ring) { g.fillStyle = 'rgba(6,14,24,0.82)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.lineWidth = 4; g.strokeStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.stroke(); g.translate(64, 64); g.scale(.72, .72); g.translate(-64, -64); }
  g.strokeStyle = '#fff'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  (ICON[name] || ICON.target)(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; iconCache.set(key, t); return t;
}

export function createKit(scene) {
  const nodeRoot = new THREE.Group(); nodeRoot.name = 'node-props'; scene.add(nodeRoot);
  const sysRoot = new THREE.Group(); sysRoot.name = 'systems'; scene.add(sysRoot);
  const tracked = [];
  const K = {
    THREE, COL, op, nodeRoot, sysRoot,
    // 登记一个道具：记录初始位姿，每帧复位，默认隐藏
    add(obj, parent = nodeRoot) { parent.add(obj); obj.userData.init = null; tracked.push(obj); op(obj, 0); return obj; },
    // 搭建完成后记录各道具的初始位姿
    lock() { for (const o of tracked) if (!o.userData.init) o.userData.init = {p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone()}; },
    resetProps() { for (const o of tracked) { const i = o.userData.init; if (!i) continue; o.position.copy(i.p); o.rotation.copy(i.r); o.scale.copy(i.s); op(o, 0); } },
    clearNode() {
      for (let i = tracked.length - 1; i >= 0; i--) { const o = tracked[i]; if (isUnder(o, nodeRoot)) { tracked.splice(i, 1); } }
      nodeRoot.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map && !iconCacheHas(m.map)) m.map.dispose(); m.dispose(); }); });
      nodeRoot.clear();
    },
    group(...kids) { const g = new THREE.Group(); kids.forEach(k => g.add(k)); return g; },
    at(o, x, y, z) { o.position.set(x, y, z); return o; },
    // 全息体：半透明面 + 发光边
    holo(geo, color = COL.cyan, fill = .07, edge = .9) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color, transparent: true, opacity: fill, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending}));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.6), transparent: true, opacity: edge, toneMapped: false, depthWrite: false}));
      g.add(m, e); g.userData.fill = m; g.userData.edge = e; return g;
    },
    holoBox(w, h, d, color, fill, edge) { return K.holo(new THREE.BoxGeometry(w, h, d), color, fill, edge); },
    // 实体件：有质感的金属/塑料，带一点自发光便于在暗场辨认
    solid(geo, color = 0x8ea3b4, {metal = .55, rough = .38, emissive = 0x000000, ei = 0} = {}) {
      return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color, metalness: metal, roughness: rough, emissive, emissiveIntensity: ei, transparent: true}));
    },
    rbox(w, h, d, r = .03) { return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)); },
    glow(geo, color, intensity = 2.4, opacity = 1) { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: new THREE.Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending})); return m; },
    badge(icon, color = COL.cyan, size = .42, ring = true) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({map: iconTexture(icon, ring), color: new THREE.Color(color).multiplyScalar(1.25), transparent: true, depthWrite: false, toneMapped: false}));
      s.scale.set(size, size, 1); s.renderOrder = 10; return s;
    },
    // 线（可按比例画出）
    line(pts, color = COL.cyan, opacity = .9, dashed = false) {
      const g = new THREE.BufferGeometry().setFromPoints(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)));
      const m = dashed ? new THREE.LineDashedMaterial({color: new THREE.Color(color).multiplyScalar(1.5), dashSize: .06, gapSize: .05, transparent: true, opacity, toneMapped: false, depthWrite: false})
        : new THREE.LineBasicMaterial({color: new THREE.Color(color).multiplyScalar(1.5), transparent: true, opacity, toneMapped: false, depthWrite: false});
      const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); l.userData.n = pts.length; return l;
    },
    curve(pts, closed = false) { return new THREE.CatmullRomCurve3(pts.map(p => p.isVector3 ? p : new THREE.Vector3(...p)), closed, 'centripetal'); },
    curveLine(pts, color, opacity, segs = 120, closed = false) { const c = K.curve(pts, closed); const l = K.line(c.getPoints(segs), color, opacity); l.userData.curve = c; return l; },
    drawLine(l, k) { l.geometry.setDrawRange(0, Math.max(0, Math.floor((l.userData.n ?? l.geometry.attributes.position.count) * clamp(k)))); },
    tube(pts, r = .02, color = COL.cyan, {glow = false, segs = 80, metal = .3} = {}) {
      const c = K.curve(pts); const geo = new THREE.TubeGeometry(c, segs, r, 8, false);
      const m = glow ? K.glow(geo, color, 2.4, .95) : K.solid(geo, color, {metal, rough: .4, emissive: color, ei: .25});
      m.userData.curve = c; m.userData.segs = segs; return m;
    },
    growTube(m, k) { const n = m.geometry.index.count; m.geometry.setDrawRange(0, Math.floor(n * clamp(k) / 6) * 6); },
    // 沿路径流动的光点：t 为工序时间（决定位置），reach 为流到多远
    flow(pts, {color = COL.cyan, n = 18, size = 5, speed = .25, curve} = {}) {
      const c = curve || K.curve(pts);
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('aK', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
      const mat = new THREE.ShaderMaterial({transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: {uColor: {value: new THREE.Color(color)}, uOpacity: {value: 1}, uSize: {value: size}},
        vertexShader: 'attribute float aK; uniform float uSize; varying float vK; void main(){ vK = aK; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = uSize * aK * (8.0 / -mv.z); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vK; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d,d); if (r > .25 || vK <= 0.0) discard; gl_FragColor = vec4(uColor * 2.2, uOpacity * (1.0 - r * 3.2)); }'});
      const pts3 = new THREE.Points(geo, mat); pts3.frustumCulled = false;
      pts3.userData.update = (t, reach = 1, sp = speed) => {
        const pos = geo.attributes.position, ak = geo.attributes.aK;
        for (let i = 0; i < n; i++) {
          let f = ((t * sp + i / n) % 1 + 1) % 1; const on = f <= reach;
          c.getPointAt(Math.min(f, .9999), tmpV); pos.setXYZ(i, tmpV.x, tmpV.y, tmpV.z); ak.setX(i, on ? .55 + .45 * Math.sin(i * 1.7) ** 2 : 0);
        }
        pos.needsUpdate = true; ak.needsUpdate = true;
      };
      return pts3;
    },
    ring(r = .3, color = COL.cyan, t = .012) { return K.glow(new THREE.TorusGeometry(r, t, 8, 64), color, 2.4, .95); },
    disc(r, color, opacity = .25) { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false})); return m; },
    // 扇形探测区
    fan(radius, angle, color = COL.cyan, opacity = .16) {
      const geo = new THREE.CircleGeometry(radius, 32, -angle / 2, angle);
      const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: {uColor: {value: new THREE.Color(color)}, uOpacity: {value: opacity}, uR: {value: radius}, uT: {value: 0}},
        vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; uniform float uR; uniform float uT; varying vec2 vP; void main(){ float d = length(vP)/uR; float w = .5 + .5*sin(d*28.0 - uT*6.0); gl_FragColor = vec4(uColor*1.8, uOpacity*(1.0-d)*(.45+.55*w)); }'}));
      return m;
    },
    // 光板：半透明发光平面，可当作屏幕/测试面
    panel(w, h, color = COL.cyan, opacity = .18) { return K.holo(new THREE.PlaneGeometry(w, h), color, opacity, .9); },
    pulse(x) { x = clamp(x); return Math.sin(x * Math.PI); },
    smooth
  };
  return K;
}
function isUnder(o, root) { let p = o; while (p) { if (p === root) return true; p = p.parent; } return false; }
function iconCacheHas(tex) { for (const t of iconCache.values()) if (t === tex) return true; return false; }
