// 临时探针：打印我这 6 个节点在关键时间点的落点数值
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
const uni = () => ({uLoad: {value: 0}, uCenter: {value: V()}, uRadius: {value: 1}, uMode: {value: 0}, uT: {value: 0}, uDeform: {value: 0}, uDeformAmp: {value: .08}, uOpacity: {value: 1}});
const heat = new THREE.ShaderMaterial({uniforms: uni(), vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'uniform vec3 a; void main(){gl_FragColor=vec4(a,1.);}'});
const car = {
  root: G(), body: G(), wheels: [G(), G(), G(), G()], st: {},
  wheelCenters: [V(1.48, .312, .78), V(1.48, .312, -.78), V(-1.39, .312, .78), V(-1.39, .312, -.78)],
  wheelR: .312, bbox: new THREE.Box3(V(-2.36, .08, -.95), V(2.36, 1.42, .95)),
  layers: {heat: {mat: heat, group: G()}},
  ptsMat: new THREE.ShaderMaterial({uniforms: {uSize: {value: 2.2}, uOpacity: {value: 1}, uReveal: {value: 10}, uColor: {value: new THREE.Color()}}, vertexShader: 'void main(){gl_Position=vec4(position,1.);}', fragmentShader: 'void main(){gl_FragColor=vec4(1.);}'}),
  profile: Array.from({length: 120}, (_, i) => ({x: -2.36 + i * .04, top: 1.0 + .1 * Math.sin(i), bot: .3, roof: 1.25, half: .8})),
  set(k, v) { this.st[k] = v; }, get(k) { return this.st[k]; }, spin: noop, clip: noop,
  setDeformScale(v) { this.amp = v; }, setDeformFollow(v) { this.follow = v; },
  heightAt: (x, z) => (Math.abs(z) < .9 ? .95 : .4), topAt: () => ({top: 1.0, roof: 1.25, half: .8})
};
const S = {
  battery: {x0: -.02, L: 2.3, Wd: 1.36, y0: .17, g: G(0, .15, 0), modules: Array.from({length: 12}, () => ({userData: {top: mesh()}, position: V()})), busbars: [mesh(), mesh()], hvPort: G(), lid: G(), tray: G(), plate: G(), coolant: mesh()},
  eea: {g: G(), central: G(.35, .5, 0), zones: [G(1.7, .62, .4), G(1.7, .62, -.4), G(-1.75, .66, .35), G(-1.75, .66, -.35)],
    trunk: [[1.7, .62, .4], [1.2, .48, .62], [0, .42, .66]], branches: [{t: mesh(), pts: [[0, 0, 0], [1, 1, 1]]}, {t: mesh(), pts: [[0, 0, 0], [1, 0, 1]]}],
    sig: [mesh(), mesh()], trunkSig: mesh(), fans: {}, screen: mesh(), loom: mesh(), reach: 1, sensors: {camF: mesh(), radarF: mesh()}},
  cabin: {g: G(), seats: [G(.08, .36, .37), G(.08, .36, -.37), G(-.86, .36, 0)], dash: G(.88, .79, 0), wheel: G(), disp: G()},
  biw: {g: G(), beams: [], joints: []}, drive: {g: G()}, rear: {g: G(0, .312, 0)}, front: {g: G(1.48, .312, 0)}, chassis: {g: G()},
  show: noop, sub: noop, reset: noop, apply: noop
};
S.eea.fans = {camF: mesh()}; S.eea.fans.camF.material.uniforms = {uT: {value: 0}};

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
const K = createKit(scene); K.core = {bloom: {strength: .4}, key: {color: {set: noop}, position: V(), intensity: 1}};
const f = v => (typeof v === 'number' ? v.toFixed(3) : v);
const P3 = p => `[${f(p.x)}, ${f(p.y)}, ${f(p.z)}]`;

// engineering-3 插头
{
  const ctx = makeCtx('engineering-3'), P = engineering3.build(K, S, car); K.lock();
  const plugZ = t => { ctx.t = t; engineering3.update(ctx, P, K, S, car); return [P.plug.position.z, P.seat.userData.stopU, P.seatSig.visible]; };
  console.log('eng-3 插头 z / stopU / 信号可见:');
  for (const t of [9.5, 12.8, 14.4, 15.4, 16.5, 16.9, 20, 25]) console.log(`  t=${f(t)} z=${f(plugZ(t)[0])} stopU=${f(plugZ(t)[1])} sig=${plugZ(t)[2]}`);
}
// engineering-4 五组合车
{
  K.clearNode(); const ctx = makeCtx('engineering-4'), P = engineering4.build(K, S, car); K.lock();
  const off = t => { ctx.t = t; S.reset(); S.battery.g.position.set(0, .15, 0); S.biw.g.position.set(0, 0, 0); S.drive.g.position.set(0, 0, 0); S.eea.g.position.set(0, 0, 0); S.cabin.g.position.set(0, 0, 0);
    engineering4.update(ctx, P, K, S, car);
    return {bat: S.battery.g.position.y - .15, biw: S.biw.g.position.y, drv: S.drive.g.position.x, eea: S.eea.g.position.z, cab: S.cabin.g.position.z, follow: car.follow, amp: car.amp, paint: car.get('paint'), heat: car.get('heat')}; };
  console.log('\neng-4 合车偏移(y/x/z，到位应为 0) / deformFollow / amp / paint / heat:');
  for (const t of [0, 1.5, 4, 6, 8.5, 10, 18, 19.5, 21, 25, 30]) { const d = off(t); console.log(`  t=${f(t)} bat=${f(d.bat)} biw=${f(d.biw)} drv=${f(d.drv)} eea=${f(d.eea)} cab=${f(d.cab)} follow=${f(d.follow)} amp=${f(d.amp)} paint=${f(d.paint)} heat=${f(d.heat)}`); }
}
// engineering-5 数据包/图钉落台
{
  K.clearNode(); const ctx = makeCtx('engineering-5'), P = engineering5.build(K, S, car); K.lock();
  console.log('\neng-5 数据包位置 / scale.y / 图钉 y / 落台 stopU:');
  for (const t of [0, 30, 44, 46, 46.6, 47.5, 48.4, 50, 51.8]) { ctx.t = t; engineering5.update(ctx, P, K, S, car); console.log(`  t=${f(t)} pkg=${P3(P.pkg.position)} sy=${f(P.pkg.scale.y)} pinY=${f(P.pin.position.y)} stopU=${f(P.land.userData.stopU)}`); }
}
// validation-1 定位销 / 车身
{
  K.clearNode(); const ctx = makeCtx('validation-1'), P = validation1.build(K, S, car); K.lock();
  console.log('\nval-1 定位销 y / 车身下沉 car.root.y / stopU:');
  for (const t of [0, 8.4, 10, 12, 14.5, 16.1, 16.5, 20, 25]) { ctx.t = t; car.root.position.set(0, 0, 0); validation1.update(ctx, P, K, S, car); console.log(`  t=${f(t)} pin0=${f(P.pins[0].position.y)} pin3=${f(P.pins[3].position.y)} carY=${f(car.root.position.y)} batY=${f(S.battery.g.position.y)} stopU=${f(P.pinS.userData.stopU)}`); }
}
// validation-2 台架同步与雨滴
{
  K.clearNode(); const ctx = makeCtx('validation-2'), P = validation2.build(K, S, car); K.lock();
  console.log('\nval-2 滚筒角/轮角（线速度应一致: ω滚×.18 == ω轮×wheelR）:');
  for (const t of [18.2, 20, 23, 26]) { ctx.t = t; validation2.update(ctx, P, K, S, car); const w = car.wheels[0].rotation.z, r = P.rol.userData.rs[0].rotation.y; console.log(`  t=${f(t)} ω轮=${f(-w)} ω滚=${f(-r)} 轮面速度=${f(-w * car.wheelR)} 滚面速度=${f(-r * .18)}`); }
  const surf = (x, z) => (x > car.bbox.min.x && x < car.bbox.max.x && Math.abs(z) < car.bbox.max.z) ? car.heightAt(x, z) + .06 : .06;
  let below = 0, total = 0, minGap = 9;
  for (const t of [40.8, 41, 41.5, 42, 42.5, 43]) { ctx.t = t; validation2.update(ctx, P, K, S, car); P.drops.forEach(d => { total++; const g = d.position.y - surf(d.position.x, d.position.z); minGap = Math.min(minGap, g); if (g < -.001) below++; }); }
  console.log(`  雨滴采样 ${total} 次：低于车表 ${below} 次，最小间隙 ${f(minGap)}m（车表=.95 / 车外=0）`);
}
// validation-3 拔出 / 装入 / 指针
{
  K.clearNode(); const ctx = makeCtx('validation-3'), P = validation3.build(K, S, car); K.lock();
  console.log('\nval-3 故障件 y / 新件 y / 指针角 / stopU:');
  for (const t of [16.6, 18.5, 20.4, 23.7, 24.4, 26.6, 28.6, 31.8, 32.4, 34.4, 36.4, 39.5]) { ctx.t = t; validation3.update(ctx, P, K, S, car); console.log(`  t=${f(t)} partY=${f(P.part.position.y)} newY=${f(P.newPart.position.y)} newSy=${f(P.newPart.scale.y)} needleZ=${f(P.needle.rotation.z)} pullStop=${f(P.pullS.userData.stopU)} seatStop=${f(P.seatS.userData.stopU)}`); }
  console.log(`  zp=${P3(P._z)}`);
}
