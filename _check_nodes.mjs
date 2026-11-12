// 临时校验：用真 three + 真 beats.json 跑我这 6 个节点的 build/update，检查异常/NaN/落点
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {createKit} from './src/engine/kit.js';
import {engineering3, engineering4, engineering5} from './src/nodes/engineering.js';
import {validation1, validation2, validation3} from './src/nodes/validation.js';

const noop = () => {};
const ctxStub = () => new Proxy({}, {get: (t, k) => (k in t ? t[k] : String(k).startsWith('create') ? () => ({addColorStop: noop}) : noop), set: () => true});
globalThis.document = {createElement: () => ({width: 128, height: 128, getContext: () => ctxStub()})};

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const G = (x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); return g; };
const mesh = () => new THREE.Mesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshStandardMaterial({transparent: true}));
const uniform = () => ({uLoad: {value: 0}, uCenter: {value: V()}, uRadius: {value: 1}, uMode: {value: 0}, uT: {value: 0}, uDeform: {value: 0}, uDeformAmp: {value: .08}, uOpacity: {value: 1}});

const heat = new THREE.ShaderMaterial({uniforms: uniform(), vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'uniform vec3 a; void main(){gl_FragColor=vec4(a,1.);}'});
const car = {
  root: G(), body: G(), wheels: [G(), G(), G(), G()], st: {},
  wheelCenters: [V(1.48, .312, .78), V(1.48, .312, -.78), V(-1.39, .312, .78), V(-1.39, .312, -.78)],
  wheelR: .312, bbox: new THREE.Box3(V(-2.36, .08, -.95), V(2.36, 1.42, .95)),
  layers: {heat: {mat: heat, group: G()}},
  ptsMat: new THREE.ShaderMaterial({uniforms: {uSize: {value: 2.2}, uOpacity: {value: 1}, uReveal: {value: 10}, uColor: {value: new THREE.Color(0xffffff)}}, vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.);}'}),
  profile: Array.from({length: 120}, (_, i) => ({x: -2.36 + i * .04, top: 1.0 + .1 * Math.sin(i), bot: .3, roof: 1.25, half: .8})),
  set(k, v) { this.st[k] = v; }, get(k) { return this.st[k]; },
  spin: noop, clip: noop, setDeformScale: noop, setDeformFollow: noop,
  heightAt: (x, z) => (Math.abs(z) < .9 ? .95 : .4), topAt: x => ({top: 1.0, roof: 1.25, half: .8})
};
const mod = i => ({userData: {top: mesh()}});
mod.userData = {top: mesh()};
const S = {
  battery: {x0: -.02, L: 2.3, Wd: 1.36, y0: .17, g: G(0, .15, 0), modules: Array.from({length: 12}, () => ({userData: {top: mesh()}, position: V()})), busbars: [mesh(), mesh()], hvPort: G(), lid: G(), tray: G(), plate: G(), coolant: mesh()},
  eea: {
    g: G(), central: G(.35, .5, 0), zones: [G(1.7, .62, .4), G(1.7, .62, -.4), G(-1.75, .66, .35), G(-1.75, .66, -.35)],
    trunk: [[1.7, .62, .4], [1.2, .48, .62], [0, .42, .66]], branches: [{t: mesh(), pts: [[0, 0, 0], [1, 1, 1]]}, {t: mesh(), pts: [[0, 0, 0], [1, 0, 1]]}],
    sig: [mesh(), mesh()], trunkSig: mesh(), fans: {}, screen: mesh(), loom: mesh(), reach: 1,
    sensors: {camF: mesh(), radarF: mesh(), lidar: mesh()}
  },
  cabin: {g: G(), seats: [G(.08, .36, .37), G(.08, .36, -.37), G(-.86, .36, 0)], dash: G(.88, .79, 0), wheel: G(), disp: G()},
  biw: {g: G(), beams: [], joints: []},
  drive: {g: G()}, rear: {g: G(0, .312, 0)}, front: {g: G(1.48, .312, 0)},
  chassis: {g: G()},
  show: noop, sub: noop, reset: noop, apply: noop
};
S.eea.fans = {camF: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial())};
S.eea.fans.camF.material.uniforms = {uT: {value: 0}};

const beats = JSON.parse(readFileSync('./data/beats.json', 'utf8'));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
function makeCtx(id) {
  const sents = beats[id];
  const T = (s, b = 0) => { if (s >= sents.length) return sents.at(-1).until; const st = sents[s], n = st.beats.length; if (b === 'end' || b >= n) return st.end; if (b < 0) b = Math.max(0, n + b); const i = Math.floor(b), f = b - i, bt = st.beats[i]; return lerp(bt.t0, bt.t1, f); };
  const c = {sents, T, t: 0, shot: 0, q: 0, nb: s => sents[s].beats.length,
    p(s0, b0, s1 = s0, b1 = 'end', fn = ease) { const a = T(s0, b0), b = T(s1, b1); return fn(clamp((c.t - a) / Math.max(.05, b - a))); },
    lin(s0, b0, s1 = s0, b1 = 'end') { return c.p(s0, b0, s1, b1, x => x); },
    in(s, b = 0, d = .6) { const a = T(s, b) - .15; return smooth((c.t - a) / d); },
    out(s, b = 0, d = .6) { const a = T(s, b) - .2; return 1 - smooth((c.t - a) / d); },
    show(s0, b0, s1 = 99, b1 = 0, d = .6) { return Math.min(c.in(s0, b0, d), s1 >= 99 ? 1 : c.out(s1, b1, d)); },
    pulse(s, b = 0, d = 1.2) { const a = T(s, b) - .1, x = (c.t - a) / d; return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); },
    after(s, b = 0) { return c.t >= T(s, b) - .15; },
    between(s0, b0, s1, b1) { return c.t >= T(s0, b0) - .15 && c.t < T(s1, b1) - .15; }};
  return c;
}

const scene = new THREE.Scene();
const K = createKit(scene);
K.core = {bloom: {strength: .4}, key: {color: {set: noop}, position: V(), intensity: 1}};
const nodes = {'engineering-3': engineering3, 'engineering-4': engineering4, 'engineering-5': engineering5, 'validation-1': validation1, 'validation-2': validation2, 'validation-3': validation3};

const nanCheck = (obj, path, t, id, bad) => {
  if (!obj) return;
  if (typeof obj.x === 'number' && (!Number.isFinite(obj.x) || !Number.isFinite(obj.y) || !Number.isFinite(obj.z))) bad.push(`${id} t=${t.toFixed(2)} ${path} NaN`);
  if (Array.isArray(obj)) obj.forEach((o, i) => nanCheck(o, `${path}[${i}]`, t, id, bad));
};
let fails = 0;
for (const [id, node] of Object.entries(nodes)) {
  K.clearNode();
  const ctx = makeCtx(id);
  let P;
  try { P = node.build(K, S, car); K.lock(); }
  catch (e) { console.log(`✗ ${id} build threw: ${e.message}\n${e.stack.split('\n').slice(1, 4).join('\n')}`); fails++; continue; }
  const sents = beats[id], end = sents.at(-1).until;
  const t0 = Date.now(); let bad = [];
  for (let t = 0; t <= end; t += .1) {
    ctx.t = t;
    try { node.update(ctx, P, K, S, car); } catch (e) { bad.push(`${id} t=${t.toFixed(2)} update threw: ${e.message}`); break; }
    nanCheck(Object.entries(P).filter(([k]) => k !== 'dock' && k !== 'seat' && k !== 'land' && k !== 'pinS' && k !== 'bodyS' && k !== 'liftS' && k !== 'pullS' && k !== 'seatS' && k !== 'datumSeed' && k !== 'ringSeed' && k !== 'pinLand').map(([, v]) => v), 'P', t, id, bad);
    nanCheck([car.root.position, S.battery.g.position], 'sys', t, id, bad);
  }
  const dt = Date.now() - t0;
  const uniq = [...new Set(bad)].slice(0, 4);
  if (uniq.length) { fails++; console.log(`✗ ${id}: ${uniq.join(' | ')}`); }
  else console.log(`✓ ${id}: ${Math.round(end / .1) + 1} 帧无异常 (${dt}ms)`);
}
process.exit(fails ? 1 : 0);
