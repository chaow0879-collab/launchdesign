// =====================================================================
// demo/bind-three.js —— 把时间轴状态写进 three 场景（唯一 import three 的地方）
//
// engineering-2.js 只产出"单位表 + 时间轴 + 状态"，这里负责：
//   buildShotStage(stage, shot)  按 units 建网格（父级 = pack 的子件挂到父组）
//   applyStates(rig, states, t)  每帧把 stateAt(t) 的位姿/透明度/流动写进去
// 注意：这里没有任何"从零淡入"的隐含逻辑，透明度、位移全部来自 stateAt(t)。
// =====================================================================
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const ZERO = {x: 0, y: 0, z: 0};

/* ------------------------- 折线采样（预编译，避免每帧分配） ------------------------- */
function prepPath(points) {
  const pts = points.map((p) => (Array.isArray(p) ? new THREE.Vector3(p[0], p[1], p[2]) : new THREE.Vector3(p.x, p.y, p.z)));
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const l = pts[i].distanceTo(pts[i - 1]); seg.push(l); total += l; }
  return {pts, seg, total};
}
const _v = new THREE.Vector3();
function samplePrepped(prep, u) {
  const {pts, seg, total} = prep;
  if (pts.length === 0) return _v.set(0, 0, 0);
  if (pts.length === 1 || total <= 1e-9) return _v.copy(pts[0]);
  let target = Math.min(1, Math.max(0, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i] || i === seg.length - 1) {
      const k = seg[i] <= 1e-9 ? 0 : Math.min(1, target / seg[i]);
      return _v.copy(pts[i]).lerp(pts[i + 1], k);
    }
    target -= seg[i];
  }
  return _v.copy(pts[pts.length - 1]);
}

/* ------------------------------ 舞台 ------------------------------ */
export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070b12);
  scene.fog = new THREE.Fog(0x070b12, 13, 32);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 120);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.2;
  controls.maxDistance = 22;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.target.set(0, 0.55, 0);

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x0b1218, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(4, 8, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb4ff, 1.7); rim.position.set(-6, 3, -5); scene.add(rim);
  const under = new THREE.DirectionalLight(0x58e1ff, 0.45); under.position.set(0, -5, 0); scene.add(under);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshStandardMaterial({color: 0x0a1017, roughness: 0.72, metalness: 0.08})
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const grid = new THREE.GridHelper(18, 36, 0x2c6f9c, 0x123243);
  grid.material.transparent = true;
  grid.material.opacity = 0.35;
  scene.add(grid);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  return {THREE, renderer, scene, camera, controls, resize};
}

export function frameCamera(stage, spec = {}) {
  const az = THREE.MathUtils.degToRad(spec.az ?? 36);
  const el = THREE.MathUtils.degToRad(spec.el ?? 18);
  const r = spec.r ?? 6;
  const tg = new THREE.Vector3(...(spec.tg || [0, 0.55, 0]));
  stage.camera.position.set(
    tg.x + r * Math.cos(el) * Math.cos(az),
    tg.y + r * Math.sin(el),
    tg.z + r * Math.cos(el) * Math.sin(az)
  );
  stage.camera.lookAt(tg);
  stage.controls.target.copy(tg);
  stage.controls.update();
}

/* ------------------------------ 单位 → 网格 ------------------------------ */
function matFor(unit, color) {
  const a = unit.alpha ?? 1;
  if (unit.glow) {
    const m = new THREE.MeshBasicMaterial({
      color: color.clone().multiplyScalar(1.7), transparent: true, opacity: a,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    });
    m.userData.a = a; return m;
  }
  const m = new THREE.MeshStandardMaterial({
    color, metalness: 0.45, roughness: 0.42, transparent: true, opacity: a,
    emissive: color.clone().multiplyScalar(0.35), emissiveIntensity: 0.25
  });
  m.userData.a = a;
  return m;
}

function makeUnit(unit) {
  const group = new THREE.Group();
  group.name = unit.id;
  const color = new THREE.Color(unit.color ?? 0x9fb3c2);
  const entry = {unit, group, mats: [], mat: null, dots: null, marker: null, partial: null, prep: null};

  const addEdge = (geo, scaleColor = 1.6) => {
    const m = new THREE.LineBasicMaterial({
      color: color.clone().multiplyScalar(scaleColor), transparent: true, opacity: 1,
      depthWrite: false, toneMapped: false
    });
    m.userData.a = unit.alpha ?? 1;
    const ls = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 26), m);
    group.add(ls);
    entry.mats.push(m);
  };

  switch (unit.kind) {
    case 'box': {
      const size = unit.size || [0.1, 0.1, 0.1];
      const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
      const mat = matFor(unit, color);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      entry.mat = mat; entry.mats.push(mat);
      if (unit.edge) addEdge(geo, 1.8);
      break;
    }
    case 'cyl': {
      const axis = unit.axis || 'y';
      const geo = new THREE.CylinderGeometry(unit.r ?? 0.05, unit.r ?? 0.05, unit.h ?? 0.1, 28);
      const mat = matFor(unit, color);
      const mesh = new THREE.Mesh(geo, mat);
      if (axis === 'z') mesh.rotation.x = Math.PI / 2;
      else if (axis === 'x') mesh.rotation.z = Math.PI / 2;
      group.add(mesh);
      entry.mat = mat; entry.mats.push(mat);
      if (unit.edge) addEdge(geo, 1.7);
      break;
    }
    case 'hex': {
      const geo = new THREE.CylinderGeometry(unit.r ?? 0.03, unit.r ?? 0.03, unit.h ?? 0.05, 6);
      const mat = matFor(unit, color);
      group.add(new THREE.Mesh(geo, mat));
      entry.mat = mat; entry.mats.push(mat);
      break;
    }
    case 'sphere': {
      const geo = new THREE.SphereGeometry(unit.r ?? 0.05, 18, 14);
      const mat = matFor(unit, color);
      group.add(new THREE.Mesh(geo, mat));
      entry.mat = mat; entry.mats.push(mat);
      break;
    }
    case 'torus': {
      const geo = new THREE.TorusGeometry(unit.r ?? 0.3, unit.tube ?? 0.03, 10, 56, unit.arc ?? Math.PI * 2);
      const mat = matFor(unit, color);
      group.add(new THREE.Mesh(geo, mat));
      entry.mat = mat; entry.mats.push(mat);
      break;
    }
    case 'tube': {
      const pts = (unit.path || []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const geo = new THREE.TubeGeometry(curve, Math.max(24, pts.length * 10), unit.r ?? 0.02, 6, false);
      const mat = matFor(unit, color);
      group.add(new THREE.Mesh(geo, mat));
      entry.mat = mat; entry.mats.push(mat);
      entry.partial = {geo, count: geo.index.count};
      break;
    }
    case 'line': {
      const pts = (unit.path || []).map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const m = new THREE.LineBasicMaterial({
        color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 1,
        depthWrite: false, toneMapped: false
      });
      m.userData.a = unit.alpha ?? 1;
      const line = new THREE.Line(geo, m);
      group.add(line);
      entry.mat = m; entry.mats.push(m);
      entry.partial = {geo, count: pts.length, line: true};
      break;
    }
    case 'dots': {
      const n = unit.n ?? 20;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      const m = new THREE.PointsMaterial({
        size: unit.size ?? 0.02, vertexColors: true, transparent: true, opacity: 1,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false
      });
      m.userData.a = unit.alpha ?? 1;
      const pts = new THREE.Points(geo, m);
      pts.frustumCulled = false;
      group.add(pts);
      entry.mat = m; entry.mats.push(m);
      entry.dots = {pts, geo, n, stages: unit.stages || null, color: color.clone(), path: prepPath(unit.path || [])};
      break;
    }
    case 'marker': {
      const geo = new THREE.SphereGeometry(unit.size ?? 0.045, 16, 12);
      const mat = matFor({...unit, glow: true}, color);
      const mesh = new THREE.Mesh(geo, mat);
      group.add(mesh);
      entry.mat = mat; entry.mats.push(mat);
      entry.marker = {mesh, offset: unit.offset ?? 0, path: prepPath(unit.path || [])};
      break;
    }
    default:
      throw new Error(`未知单位类型 ${unit.kind}（${unit.id}）`);
  }
  return entry;
}

export function buildShotStage(stage, shot) {
  const root = new THREE.Group();
  root.name = `shot-${shot.id}`;
  stage.scene.add(root);
  const entries = new Map();

  for (const unit of shot.units) {
    const entry = makeUnit(unit);
    entries.set(unit.id, entry);
    const parent = unit.parent ? entries.get(unit.parent) : null;
    (parent ? parent.group : root).add(entry.group);
  }

  return {
    root,
    entries,
    dispose() {
      stage.scene.remove(root);
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
    }
  };
}

/* ------------------------------ 每帧写状态 ------------------------------ */
function stageColor(stages, s) {
  if (!stages) return null;
  for (const st of stages) if (s >= st.from && s < st.to) return st.color;
  return stages[stages.length - 1].color;
}

const _c = new THREE.Color();

export function applyStates(rig, states) {
  for (const [id, e] of rig.entries) {
    const st = states[id];
    if (!st) continue;
    const unit = e.unit;
    const par = unit.parent ? states[unit.parent].pos : ZERO;
    const g = e.group;

    g.position.set(par.x + st.pos.x, par.y + st.pos.y, par.z + st.pos.z);
    g.rotation.set(st.rot.x, st.rot.y, st.rot.z);

    let sx = st.scale.x, sy = st.scale.y, sz = st.scale.z;
    if (st.deform.amp !== 0) {
      const ax = st.deform.axis === 'x' ? 0 : st.deform.axis === 'z' ? 2 : 1;
      const half = (unit.half ? unit.half[ax] : (unit.size ? unit.size[ax] / 2 : 0.05)) || 0.05;
      const k = 1 + st.deform.amp / Math.max(0.02, half * 2);
      if (ax === 0) sx *= k; else if (ax === 1) sy *= k; else sz *= k;
    }
    g.scale.set(sx, sy, sz);

    const o = st.opacity;
    for (const m of e.mats) m.opacity = m.userData.a * o;
    g.visible = o > 0.003;

    if (e.dots) {
      const d = e.dots;
      const pos = d.geo.attributes.position;
      const col = d.geo.attributes.color;
      const u = st.flow.active ? st.flow.u : 0;
      const reach = st.flow.reach;
      for (let i = 0; i < d.n; i++) {
        const s = (u + i / d.n) % 1;
        const p = samplePrepped(d.path, s);
        pos.setXYZ(i, p.x, p.y, p.z);
        const on = s <= reach ? 1 : 0;
        const sc = stageColor(d.stages, s);
        if (sc != null) _c.setHex(sc); else _c.copy(d.color);
        col.setXYZ(i, _c.r * 1.7 * on, _c.g * 1.7 * on, _c.b * 1.7 * on);
      }
      pos.needsUpdate = true;
      col.needsUpdate = true;
      d.pts.visible = o > 0.003 && reach > 0;
    }

    if (e.marker) {
      const s = (st.flow.u + e.marker.offset) % 1;
      const p = samplePrepped(e.marker.path, st.flow.active ? s : 0);
      e.marker.mesh.position.set(p.x, p.y, p.z);
    }

    if (e.partial) {
      const p = e.partial;
      const reach = st.flow.active ? st.flow.reach : 1;
      if (p.line) {
        p.geo.setDrawRange(0, Math.max(2, Math.floor(p.count * reach)));
      } else {
        p.geo.setDrawRange(0, Math.floor(p.count * reach / 6) * 6);
      }
    }
  }
}
