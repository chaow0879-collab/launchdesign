// 合并后门禁：帧级跑通 6 个节点 + 原文/机位与 11:44 构建比对 + 禁止项扫描
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createKit} from './src/engine/kit.js';
import {engineering1, engineering3, engineering4, engineering5} from './src/nodes/engineering.js';
import {validation1, validation2, validation3} from './src/nodes/validation.js';

const noop = () => {};
const ctxStub = () => new Proxy({}, {get: (t, k) => (k in t ? t[k] : String(k).startsWith('create') ? () => ({addColorStop: noop}) : noop), set: () => true});
globalThis.document = {createElement: () => ({width: 128, height: 128, getContext: () => ctxStub()})};
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const G = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshStandardMaterial({transparent: true}));
const uni = () => ({uLoad: {value: 0}, uCenter: {value: V()}, uRadius: {value: 1}, uMode: {value: 0}, uT: {value: 0}, uDeform: {value: 0}, uDeformAmp: {value: .08}, uOpacity: {value: 1}});
const heat = new THREE.ShaderMaterial({uniforms: uni(), vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'uniform vec3 a; void main(){gl_FragColor=vec4(a,1.);}'});
const car = {root: G(), body: G(), wheels: [G(), G(), G(), G()], st: {},
  wheelCenters: [V(1.48, .312, .78), V(1.48, .312, -.78), V(-1.39, .312, .78), V(-1.39, .312, -.78)], wheelR: .312,
  bbox: new THREE.Box3(V(-2.36, .08, -.95), V(2.36, 1.42, .95)), layers: {heat: {mat: heat, group: G()}},
  ptsMat: new THREE.ShaderMaterial({uniforms: {uSize: {value: 2.2}, uOpacity: {value: 1}, uReveal: {value: 10}, uColor: {value: new THREE.Color()}}, vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.);}'}),
  edgeMat: new THREE.ShaderMaterial({uniforms: {uReveal: {value: 10}, uOpacity: {value: 1}, uAxis: {value: 0}, uColor: {value: new THREE.Color()}}, vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.);}'}),
  profile: Array.from({length: 120}, (_, i) => ({x: -2.36 + i * .04, top: 1 + .1 * Math.sin(i), bot: .3, roof: 1.25, half: .8})),
  set(k, v) { this.st[k] = v; }, get(k) { return this.st[k]; }, spin: noop, clip: noop, setDeformScale: noop, setDeformFollow: noop,
  heightAt: (x, z) => (Math.abs(z) < .9 ? .95 : .4), topAt: () => ({top: 1, roof: 1.25, half: .8})};
const S = {
  battery: {x0: -.02, L: 2.3, Wd: 1.36, y0: .17, g: G(0, .15, 0), modules: Array.from({length: 12}, (_, i) => ({userData: {top: mesh()}, position: V(i % 6 * .3 - .8, .29, i < 6 ? .3 : -.3)})), busbars: [mesh(), mesh()], hvPort: mesh(), lid: mesh(), tray: mesh(), plate: mesh(), coolant: mesh()},
  eea: {g: G(), central: G(.35, .5, 0), zones: [G(1.7, .62, .4), G(1.7, .62, -.4), G(-1.75, .66, .35), G(-1.75, .66, -.35)],
    trunk: [[1.7, .62, .4], [1.2, .48, .62], [0, .42, .66]], branches: [{t: mesh(), pts: [[0, 0, 0], [1, 1, 1]]}, {t: mesh(), pts: [[0, 0, 0], [1, 0, 1]]}],
    sig: [mesh(), mesh()], trunkSig: mesh(), fans: {}, screen: mesh(), loom: mesh(), reach: 1, sensors: {camF: mesh(), radarF: mesh(), lidar: mesh()}},
  cabin: {g: G(), seats: [G(.08, .36, .37), G(.08, .36, -.37), G(-.86, .36, 0)], dash: G(.88, .79, 0), wheel: G(), disp: G()},
  biw: {g: G(), beams: [mesh(), mesh()], joints: [mesh(), mesh()]}, drive: {g: G()},
  rear: {g: G(0, .312, 0), shafts: [mesh(), mesh()], rings: [mesh(), mesh()]},
  front: {g: G(1.48, .312, 0), shafts: [mesh(), mesh()], rings: [mesh(), mesh()]},
  chassis: {g: G(), parts: Array.from({length: 4}, () => ({spring: mesh(), knuckle: mesh(), disc: mesh()}))},
  thermal: {pipe: mesh(), hvac: mesh(), cabinAir: mesh(), cabinAir2: mesh(), reach: 1, air: 0},
  show: noop, sub: noop, reset: noop, apply: noop};
S.eea.fans = {camF: mesh()}; S.eea.fans.camF.material.uniforms = {uT: {value: 0}};

const beats = JSON.parse(readFileSync('./data/beats.json', 'utf8'));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
function makeCtx(id) {
  const sents = beats[id];
  const T = (s, b = 0) => { if (s >= sents.length) return sents.at(-1).until; const st = sents[s], n = st.beats.length; if (b === 'end' || b >= n) return st.end; if (b < 0) b = Math.max(0, n + b); const i = Math.floor(b), f = b - i, bt = st.beats[i]; return lerp(bt.t0, bt.t1, f); };
  const c = {sents, T, t: 0, shot: 0, q: 0,
    p(s0, b0, s1 = s0, b1 = 'end', fn = ease) { const a = T(s0, b0), b = T(s1, b1); return fn(clamp((c.t - a) / Math.max(.05, b - a))); },
    lin(s0, b0, s1 = s0, b1 = 'end') { return c.p(s0, b0, s1, b1, x => x); },
    in(s, b = 0, d = .6) { return smooth((c.t - (T(s, b) - .15)) / d); },
    out(s, b = 0, d = .6) { return 1 - smooth((c.t - (T(s, b) - .2)) / d); },
    show(s0, b0, s1 = 99, b1 = 0, d = .6) { return Math.min(c.in(s0, b0, d), s1 >= 99 ? 1 : c.out(s1, b1, d)); },
    pulse(s, b = 0, d = 1.2) { const a = T(s, b) - .1, x = (c.t - a) / d; return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); },
    after(s, b = 0) { return c.t >= T(s, b) - .15; },
    between(s0, b0, s1, b1) { return c.t >= T(s0, b0) - .15 && c.t < T(s1, b1) - .15; }};
  return c;
}
const K = createKit(new THREE.Scene()); K.core = {bloom: {strength: .4}, key: {color: {set: noop}, position: V(), intensity: 1}};
const nodes = {'engineering-3': engineering3, 'engineering-4': engineering4, 'engineering-5': engineering5, 'validation-1': validation1, 'validation-2': validation2, 'validation-3': validation3};
let bad = 0;
console.log('DBG car keys:', Object.keys(car).join(','), '| bbox?', !!car.bbox, '| wc?', Array.isArray(car.wheelCenters));
for (const [id, node] of Object.entries(nodes)) {
  K.clearNode(); const c = makeCtx(id); let P;
  try { P = node.build(K, S, car); K.lock(); } catch (e) { console.log(`x ${id} build: ${e.message}`); bad++; continue; }
  let err = null;
  for (let t = 0; t <= beats[id].at(-1).until; t += .1) {
    c.t = t;
    try { node.update(c, P, K, S, car); } catch (e) { err = `t=${t.toFixed(2)} ${e.message}`; break; }
    const chk = [P.pkg, P.plug, P.pin, P.newPart, P.part, P.pkg && P.pkg.scale];
    for (const o of chk) if (o && o.position && !Number.isFinite(o.position.x + o.position.y + o.position.z)) { err = `t=${t.toFixed(2)} NaN in prop`; break; }
    if (err) break;
  }
  console.log(err ? `x ${id}: ${err}` : `ok ${id}`); if (err) bad++;
}
// 原文与机位比对（11:44 构建 = 我动手前）
const dist = readFileSync('./dist/index.html', 'utf8').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
const num = v => String(v).replace(/^(-?)0\./, '$1.');
let tmiss = 0, ttot = 0;
for (const [id, n] of Object.entries({'engineering-1': engineering1, ...nodes})) {
  n.phases.forEach(p => { ttot++; if (!dist.includes(p)) { console.log(`MISS phase ${id}: ${p}`); tmiss++; } });
  n.shots.forEach((s, i) => { ttot += 2; if (!dist.includes(s.title)) { console.log(`MISS title ${id}[${i}]`); tmiss++; } if (!dist.includes(s.detail)) { console.log(`MISS detail ${id}[${i}]`); tmiss++; } });
  n.cams.forEach((spec, i) => (Array.isArray(spec) ? spec : [spec]).forEach(k => { ttot++; if (!dist.includes(`tg:[${k.tg.map(num).join(',')}],r:${num(k.r)},az:${num(k.az)},el:${num(k.el)}`)) { console.log(`MISS cam ${id}[${i}]`); tmiss++; } }));
}
console.log(`原文+机位核对 ${ttot} 条，未命中 ${tmiss} 条`);
// 禁止项
for (const f of ['./src/nodes/engineering.js', './src/nodes/validation.js']) {
  const src = readFileSync(f, 'utf8');
  const hit = ['Math.random', 'Date.now', 'performance.now'].filter(k => src.includes(k));
  console.log(`${f} 禁止项: ${hit.length ? hit.join(',') : '无'}`);
  if (hit.length) bad++;
}
process.exit(bad || tmiss ? 1 : 0);
