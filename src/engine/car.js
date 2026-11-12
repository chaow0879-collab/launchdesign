// 真车：载入 GLB，统一到“车头朝 +x、车长 4.72 m、轮底 y=0”的坐标；拆出四个车轮；
// 车身可在 漆面 / 透视(X光) / 油泥 / 斑马纹 / 仿真云图 / 线框 / 点云 之间按比例混合。
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clamp} from './core.js';

const CYAN = new THREE.Color(0x58d8ff);

function revealLineMat(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {uColor: {value: new THREE.Color(color)}, uOpacity: {value: 1}, uReveal: {value: 10}, uAxis: {value: 0}, uGlow: {value: 1.6}},
    vertexShader: 'uniform float uAxis; varying float vX; void main(){ vec3 p = position; vX = uAxis < .5 ? -p.x : (uAxis < 1.5 ? p.y : p.z); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; uniform float uReveal; uniform float uGlow; varying float vX; void main(){ if(vX > uReveal) discard; float edge = smoothstep(uReveal - .25, uReveal, vX); gl_FragColor = vec4(uColor * (uGlow + edge * 2.5), uOpacity); }'
  });
}

export async function loadCar(buffer) {
  const gltf = await new GLTFLoader().parseAsync(buffer, '');
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(src);
  const size = box.getSize(new THREE.Vector3());
  const rot = new THREE.Matrix4();
  if (size.z > size.x) rot.makeRotationY(Math.PI / 2);
  const parts = [];
  src.traverse(o => { if (o.isMesh) { const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld); g.applyMatrix4(rot); parts.push({name: o.material.name, mat: o.material, geo: g}); } });
  // 归一化
  const b2 = new THREE.Box3(); parts.forEach(p => { p.geo.computeBoundingBox(); b2.union(p.geo.boundingBox); });
  const s2 = b2.getSize(new THREE.Vector3()), scale = 4.72 / s2.x, c2 = b2.getCenter(new THREE.Vector3());
  const norm = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(-c2.x, -b2.min.y, -c2.z));
  parts.forEach(p => p.geo.applyMatrix4(norm));
  return {parts, flip: false};
}

export function buildCar(loaded, {front = 1} = {}) {
  const root = new THREE.Group(); root.name = 'car';
  const body = new THREE.Group(); root.add(body);
  const flipM = new THREE.Matrix4().makeRotationY(front > 0 ? 0 : Math.PI);
  const wheelMat = /rim|tire/i;
  const meshes = [], wheelParts = [];
  const paint = new THREE.MeshPhysicalMaterial({color: 0xcfd6dd, metalness: .35, roughness: .3, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.0});
  for (const p of loaded.parts) {
    p.geo.applyMatrix4(flipM);
    if (wheelMat.test(p.name)) { wheelParts.push(p); continue; }
    let mat = p.mat;
    if (/Geohoodsub00021/.test(p.name)) mat = paint;
    else mat = mat.clone();
    if (mat.isMeshStandardMaterial) mat.envMapIntensity = 1;
    if (mat.emissive && mat.emissiveIntensity > .08) mat.emissiveIntensity = .08;
    if (mat.transparent && mat.isMeshStandardMaterial) { mat.roughness = Math.max(mat.roughness, .28); mat.envMapIntensity = .5; }
    const m = new THREE.Mesh(p.geo, mat); m.name = p.name; m.userData.isPaint = mat === paint;
    body.add(m); meshes.push(m);
  }
  // 四个车轮：按三角形重心所在象限拆分，绕各自轮心旋转
  const wheels = [];
  const quads = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (const [sx, sz] of quads) {
    const pivot = new THREE.Group(); pivot.userData.q = [sx, sz]; root.add(pivot); wheels.push(pivot);
  }
  // 先用轮胎确定四个轮子的范围，再把落在范围内的轮毂三角形归入对应车轮，其余（底盘黑件）留在车身
  const triCentroids = g => { const pos = g.attributes.position, n = pos.count / 3, out = new Float32Array(n * 3); for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) out[t * 3 + k] = (pos.array[(3 * t) * 3 + k] + pos.array[(3 * t + 1) * 3 + k] + pos.array[(3 * t + 2) * 3 + k]) / 3; return out; };
  const nonIdx = p => { if (p.geo.index) p.geo = p.geo.toNonIndexed(); return p.geo; };
  const wheelBoxes = quads.map(() => new THREE.Box3());
  for (const p of wheelParts.filter(p => /tire/i.test(p.name))) {
    const g = nonIdx(p), cen = triCentroids(g), pos = g.attributes.position;
    for (let t = 0; t < cen.length / 3; t++) { const qi = quads.findIndex(([sx, sz]) => Math.sign(cen[t * 3] || 1) === sx && Math.sign(cen[t * 3 + 2] || 1) === sz); for (let v = 0; v < 3; v++) wheelBoxes[qi].expandByPoint(new THREE.Vector3().fromBufferAttribute(pos, 3 * t + v)); }
  }
  const grown = wheelBoxes.map(b => b.clone().expandByScalar(.03));
  const leftovers = [];
  const subset = (g, tris) => { const ng = new THREE.BufferGeometry(); for (const name of Object.keys(g.attributes)) { const a = g.attributes[name], arr = new a.array.constructor(tris.length * 3 * a.itemSize); tris.forEach((t, k) => { for (let v = 0; v < 3; v++) for (let c = 0; c < a.itemSize; c++) arr[(k * 3 + v) * a.itemSize + c] = a.array[(t * 3 + v) * a.itemSize + c]; }); ng.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize, a.normalized)); } return ng; };
  for (const p of wheelParts) {
    const g = nonIdx(p), cen = triCentroids(g), buckets = quads.map(() => []), rest = [];
    const tv = new THREE.Vector3();
    for (let t = 0; t < cen.length / 3; t++) { tv.set(cen[t * 3], cen[t * 3 + 1], cen[t * 3 + 2]); const qi = grown.findIndex(b => b.containsPoint(tv)); if (qi >= 0) buckets[qi].push(t); else rest.push(t); }
    p.split = buckets.map(tris => tris.length ? subset(g, tris) : null);
    if (rest.length) leftovers.push({name: p.name, mat: p.mat, geo: subset(g, rest)});
  }
  for (const r of leftovers) { const m = new THREE.Mesh(r.geo, r.mat.clone()); m.name = r.name + '-body'; body.add(m); meshes.push(m); }
  const wheelCenters = wheelBoxes.map(b => b.getCenter(new THREE.Vector3()));
  wheels.forEach((pivot, qi) => {
    const c = wheelCenters[qi]; pivot.position.copy(c); pivot.userData.center = c.clone();
    for (const p of wheelParts) {
      const g = p.split?.[qi]; if (!g) continue;
      g.translate(-c.x, -c.y, -c.z);
      const m = new THREE.Mesh(g, p.mat.clone()); pivot.add(m); meshes.push(m); m.userData.wheel = true;
    }
  });
  const wheelR = (wheelBoxes[0].max.y - wheelBoxes[0].min.y) / 2;
  const bb = new THREE.Box3(); meshes.forEach(m => { if (!m.userData.wheel) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); } });

  // 车身轮廓采样：侧面上沿/下沿、车顶中线、腰线半宽（用于草图、骨架、包络）
  const profile = [];
  for (let x = -2.36; x <= 2.361; x += .04) profile.push({x, top: -1, bot: 9, roof: -1, half: 0});
  meshes.filter(m => !m.userData.wheel).forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = Math.round((x + 2.36) / .04); const b = profile[k]; if (!b) continue; if (y > b.top) b.top = y; if (y < b.bot) b.bot = y; if (Math.abs(z) < .25 && y > b.roof) b.roof = y; if (y > .55 && y < .95 && Math.abs(z) > b.half && Math.abs(z) < .98) b.half = Math.abs(z); } });
  profile.forEach((b, i) => { if (b.top < 0) Object.assign(b, profile[i - 1] || {top: .5, bot: .2, roof: .5, half: .8}); });
  // 平滑：去掉后视镜、天线等尖刺
  for (const key of ['top', 'roof', 'half']) { const raw = profile.map(b => b[key]); const med = raw.map((v, i) => { const w = raw.slice(Math.max(0, i - 3), i + 4).sort((a, b) => a - b); return w[w.length >> 1]; }); profile.forEach((b, i) => { const w = med.slice(Math.max(0, i - 2), i + 3); b[key] = w.reduce((a, v) => a + v, 0) / w.length; }); }
  // 车身顶面高度场（控制网、扫描线、贴合车面的道具用）
  const HX = 61, HZ = 27, hf = new Float32Array(HX * HZ).fill(-1);
  paintMeshesPre().forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const ix = Math.round((p.getX(i) + 2.4) / .08), iz = Math.round((p.getZ(i) + 1.04) / .08); if (ix < 0 || ix >= HX || iz < 0 || iz >= HZ) continue; const k = ix * HZ + iz; if (p.getY(i) > hf[k]) hf[k] = p.getY(i); } });
  function paintMeshesPre() { return meshes.filter(m => m.userData.isPaint); }
  const heightAt = (x, z) => { const ix = Math.max(0, Math.min(HX - 1, Math.round((x + 2.4) / .08))), iz = Math.max(0, Math.min(HZ - 1, Math.round((z + 1.04) / .08))); let v = hf[ix * HZ + iz]; if (v < 0) { for (let r = 1; r < 4 && v < 0; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const a = ix + dx, b = iz + dz; if (a >= 0 && a < HX && b >= 0 && b < HZ && hf[a * HZ + b] > v) v = hf[a * HZ + b]; } } return Math.max(v, .3); };
  // ---- 附加图层 ----
  const paintMeshes = meshes.filter(m => m.userData.isPaint);
  const shellMeshes = meshes.filter(m => !m.userData.wheel);
  const layer = (name, mat, list = shellMeshes) => { const g = new THREE.Group(); g.name = name; list.forEach(m => { const c = new THREE.Mesh(m.geometry, mat); g.add(c); }); body.add(g); g.visible = false; return {group: g, mat}; };
  const ghost = layer('ghost', new THREE.MeshPhysicalMaterial({color: 0x8fc8ff, transparent: true, opacity: .07, roughness: .1, metalness: 0, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: .6}), paintMeshes);
  const clay = layer('clay', new THREE.MeshStandardMaterial({color: 0xb07a52, roughness: .62, metalness: 0, envMapIntensity: .7, transparent: true}), shellMeshes);
  const zebra = layer('zebra', new THREE.ShaderMaterial({
    transparent: true, uniforms: {uPhase: {value: 0}, uFreq: {value: 26}, uOpacity: {value: 1}, uTilt: {value: .0}},
    vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uPhase; uniform float uFreq; uniform float uOpacity; uniform float uTilt; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 v = normalize(vW - cameraPosition); vec3 r = reflect(v, normalize(vN));
        float s = sin((r.y + r.x * uTilt) * uFreq + uPhase); float band = smoothstep(-.15, .15, s);
        vec3 col = mix(vec3(0.03,0.05,0.08), vec3(0.92,0.97,1.0), band);
        gl_FragColor = vec4(col, uOpacity);
        #include <colorspace_fragment>
      }`
  }), paintMeshes);
  const heat = layer('heat', new THREE.ShaderMaterial({
    transparent: true, uniforms: {uLoad: {value: 0}, uCenter: {value: new THREE.Vector3(2.2, .5, 0)}, uRadius: {value: 1.6}, uOpacity: {value: 1}, uMode: {value: 0}, uT: {value: 0}, uDeform: {value: 0}},
    vertexShader: `uniform float uLoad; uniform vec3 uCenter; uniform float uRadius; uniform float uMode; uniform float uT; uniform float uDeform; varying float vF; varying vec3 vN; varying vec3 vW;
      void main(){ vec3 p = position; float f;
        if (uMode > 2.5) { f = exp(-pow(length(p - uCenter) / uRadius, 2.0)); }
        else if (uMode < .5) { f = exp(-pow(length(p - uCenter) / uRadius, 2.0)) * uLoad; }
        else if (uMode < 1.5) { f = clamp((p.x + 2.4) / 4.8, 0.0, 1.0); f = (1.0 - f) * .9 * uLoad + .1 * uLoad * sin(p.y * 8.0 + uT * 2.0); }
        else { f = (.5 + .5 * sin(p.x * 3.2 - uT * 3.0) * cos(p.z * 2.0)) * uLoad; }
        vF = f; vN = normal; p += (uMode > 2.5 ? vec3(0.0, 1.0, 0.0) : normal) * uDeform * f * .08; vW = (modelMatrix * vec4(p, 1.0)).xyz; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float uOpacity; uniform float uMode; uniform float uLoad; varying float vF; varying vec3 vN; varying vec3 vW;
      vec3 pal(float t){ t = clamp(t,0.0,1.0); vec3 a = vec3(0.05,0.2,0.85), b = vec3(0.1,0.8,0.9), c = vec3(0.35,0.95,0.3), d = vec3(1.0,0.85,0.1), e = vec3(1.0,0.2,0.1);
        if(t<.25) return mix(a,b,t/.25); if(t<.5) return mix(b,c,(t-.25)/.25); if(t<.75) return mix(c,d,(t-.5)/.25); return mix(d,e,(t-.75)/.25); }
      void main(){ vec3 n = normalize(vN); float l = .55 + .45 * max(dot(n, normalize(vec3(.4,1.0,.3))), 0.0);
        if (uMode > 2.5) { vec3 v = normalize(cameraPosition - vW); float fr = pow(1.0 - max(dot(n, v), 0.0), 2.0); float spec = pow(max(dot(reflect(-normalize(vec3(.3,1.0,.4)), n), v), 0.0), 24.0);
          vec3 base = vec3(.30,.34,.39) * (.35 + .65 * l) + fr * vec3(.18,.3,.42) + spec * .28; base = mix(base, vec3(.2,.85,1.0), clamp(vF * uLoad, 0.0, 1.0) * .7);
          gl_FragColor = vec4(base, uOpacity); } else gl_FragColor = vec4(pal(vF) * l, uOpacity);
        #include <colorspace_fragment>
      }`
  }), paintMeshes);
  // 线框：车身特征边，可按车长方向“画出来”
  const edgeGroup = new THREE.Group(); edgeGroup.visible = false; body.add(edgeGroup);
  const edgeMat = revealLineMat(0x6fdcff);
  shellMeshes.filter(m => m.geometry.attributes.position.count > 150).forEach(m => { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, m.userData.isPaint ? 22 : 35), edgeMat); edgeGroup.add(e); });
  // 点云：车身顶点抽样
  const ptsGeo = (() => {
    const arr = []; paintMeshes.forEach(m => { const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i += 2) arr.push(p.getX(i), p.getY(i), p.getZ(i)); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g;
  })();
  const ptsMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    uniforms: {uColor: {value: new THREE.Color(0x7cf0ff)}, uOpacity: {value: 1}, uReveal: {value: 10}, uSize: {value: 2.2}},
    vertexShader: 'uniform float uReveal; uniform float uSize; varying float vK; void main(){ vK = step(-position.x, uReveal); vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = uSize * (6.0 / -mv.z); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform float uOpacity; varying float vK; void main(){ if (vK < .5) discard; vec2 d = gl_PointCoord - .5; if (dot(d,d) > .25) discard; gl_FragColor = vec4(uColor * 1.6, uOpacity); }'
  });
  const points = new THREE.Points(ptsGeo, ptsMat); points.visible = false; body.add(points);

  // 剖切面
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 100);
  const clipList = [clipPlane];
  const allMats = new Set(); shellMeshes.forEach(m => allMats.add(m.material)); wheels.forEach(w => w.children.forEach(m => allMats.add(m.material)));
  [ghost.mat, clay.mat, zebra.mat, heat.mat].forEach(m => allMats.add(m));
  allMats.forEach(m => { m.clippingPlanes = clipList; m.clipShadows = true; m.userData.baseOpacity = m.opacity ?? 1; m.userData.baseTransparent = m.transparent; });

  // 整车克隆（独立材质，供方案对比）
  function makeClone(color = 0xcfd6dd) {
    const r = new THREE.Group();
    const add = (m, parent) => { const c = new THREE.Mesh(m.geometry, m.material.clone()); c.position.copy(m.position); c.rotation.copy(m.rotation); c.material.clippingPlanes = null; if (m.userData.isPaint) { c.material.color.set(color); c.userData.isPaint = true; } parent.add(c); return c; };
    shellMeshes.forEach(m => add(m, r));
    wheels.forEach(w => { const pv = new THREE.Group(); pv.position.copy(w.position); w.children.forEach(m => add(m, pv)); r.add(pv); });
    r.userData.paint = r.children.filter(c => c.userData.isPaint).map(c => c.material);
    return r;
  }
  const state = {};
  const api = {
    makeClone,
    root, body, wheels, meshes, profile, heightAt,
    topAt: x => { const k = Math.max(0, Math.min(profile.length - 1, Math.round((x + 2.36) / .04))); return profile[k]; }, shellMeshes, paintMeshes, bbox: bb, wheelR, wheelCenters, paint,
    length: bb.max.x - bb.min.x, width: bb.max.z - bb.min.z, height: bb.max.y - bb.min.y,
    layers: {ghost, clay, zebra, heat}, edgeMat, ptsMat, clipPlane,
    reset() {
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.visible = true; body.position.set(0, 0, 0);
      Object.assign(state, {paint: 1, ghost: 0, clay: 0, zebra: 0, heat: 0, edges: 0, points: 0, wheels: 1});
      clipPlane.constant = 100; clipPlane.normal.set(0, 0, -1);
      edgeMat.uniforms.uReveal.value = 10; edgeMat.uniforms.uAxis.value = 0; edgeMat.uniforms.uColor.value.set(0x6fdcff);
      ptsMat.uniforms.uReveal.value = 10;
      zebra.mat.uniforms.uPhase.value = 0; zebra.mat.uniforms.uTilt.value = 0;
      Object.assign(heat.mat.uniforms, {}); heat.mat.uniforms.uLoad.value = 0; heat.mat.uniforms.uMode.value = 0; heat.mat.uniforms.uDeform.value = 0; heat.mat.uniforms.uCenter.value.set(2.2, .5, 0); heat.mat.uniforms.uRadius.value = 1.6; zebra.mat.uniforms.uFreq.value = 26;
      wheels.forEach(w => { w.rotation.set(0, 0, 0); w.position.copy(w.userData.center); });
      heat.group.position.set(0, 0, 0); heat.group.rotation.set(0, 0, 0); zebra.group.position.set(0, 0, 0);
      paint.color.set(0xcfd6dd); paint.roughness = .3; paint.metalness = .35;
    },
    set(k, v) { state[k] = v; },
    get: k => state[k],
    spin(angle) { wheels.forEach(w => w.rotation.z = -angle); },
    clip(normal, constant) { clipPlane.normal.set(...normal); clipPlane.constant = constant; },
    apply(t) {
      const op = (m, o) => { m.opacity = m.userData.baseOpacity * o; m.transparent = m.userData.baseTransparent || o < .999; m.depthWrite = o > .6 && !m.userData.baseTransparent; m.visible = o > .003; };
      const shell = state.paint;
      const trim = Math.max(shell, state.ghost * .07, state.zebra * .5, state.heat * .3) * (1 - state.clay);
      shellMeshes.forEach(m => op(m.material, m.userData.isPaint ? shell : trim));
      wheels.forEach(w => w.children.forEach(m => op(m.material, Math.max(state.wheels * Math.max(shell, state.clay, state.ghost * .55, state.zebra, state.heat), 0))));
      ghost.group.visible = state.ghost > .003; ghost.mat.opacity = .06 * state.ghost;
      clay.group.visible = state.clay > .003; clay.mat.opacity = state.clay; clay.mat.depthWrite = state.clay > .6; clay.mat.transparent = state.clay < .999;
      zebra.group.visible = state.zebra > .003; zebra.mat.uniforms.uOpacity.value = state.zebra; zebra.mat.transparent = state.zebra < .999; zebra.mat.depthWrite = state.zebra > .6;
      heat.group.visible = state.heat > .003; heat.mat.uniforms.uOpacity.value = state.heat; heat.mat.transparent = state.heat < .999; heat.mat.depthWrite = state.heat > .6; heat.mat.uniforms.uT.value = t;
      const eo = Math.max(state.edges, state.ghost * .5, heat.mat.uniforms.uMode.value > 2.5 ? state.heat * .45 : 0);
      edgeGroup.visible = eo > .003; edgeMat.uniforms.uOpacity.value = eo * .55;
      points.visible = state.points > .003; ptsMat.uniforms.uOpacity.value = state.points;
    }
  };
  api.reset();
  return api;
}
