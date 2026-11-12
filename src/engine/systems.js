// 车内系统（教学示意，按真车尺寸摆放）：电池包、电驱、热管理、高压线、低压线束与控制器、传感器、座椅与座舱、白车身骨架、悬架、乘员包络。
// 所有系统默认隐藏；工序脚本用 S.show(名称, 透明度) 点亮，并可直接驱动子部件。
import * as THREE from 'three';
import {op, COL} from './kit.js';

export function createSystems(K, car) {
  const root = K.sysRoot;
  const sys = {}, groups = {};
  const W = (k) => { const g = new THREE.Group(); g.name = k; root.add(g); groups[k] = g; return g; };
  const wc = car.wheelCenters; // [FL(+z), FR(-z), RL(+z), RR(-z)]，前轮 x≈1.48，后轮 x≈-1.39
  const xF = wc[0].x, xR = wc[2].x, track = Math.abs(wc[0].z), wr = car.wheelR;
  const metal = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, metalness: o.m ?? .6, roughness: o.r ?? .35, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: true});

  // ---------- 电池包 ----------
  {
    const g = W('battery');
    const L = 2.3, Wd = 1.36, x0 = -.02, y0 = .17;
    const tray = new THREE.Mesh(K.rbox(L + .08, .1, Wd + .06, .03), metal(0x3d4c58, {m: .7, r: .45}));
    tray.position.set(x0, y0 - .02, 0); g.add(tray);
    const trayEdge = K.holoBox(L + .1, .12, Wd + .08, COL.cyan, 0, .55); trayEdge.position.copy(tray.position); g.add(trayEdge);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(L - .04, .012, Wd - .06), metal(0x6d8494, {m: .8, r: .3, e: 0x0a3550, ei: .4}));
    plate.position.set(x0, y0 + .04, 0); g.add(plate);
    const serp = []; for (let i = 0; i <= 8; i++) { const x = x0 - L / 2 + .12 + i * (L - .24) / 8; serp.push([x, y0 + .052, i % 2 ? .55 : -.55], [x + .001, y0 + .052, i % 2 ? -.55 : .55]); }
    const coolant = K.tube(serp, .014, 0x2aa9ff, {glow: true, segs: 220}); g.add(coolant);
    const modules = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const m = new THREE.Group();
      const body = new THREE.Mesh(K.rbox(.33, .12, .6, .02), metal(0x22303b, {m: .5, r: .4}));
      const top = K.glow(new THREE.BoxGeometry(.31, .006, .56), COL.teal, 1.4, .55); top.position.y = .063;
      m.add(body, top); m.position.set(x0 - L / 2 + .2 + i * .378, y0 + .12, j ? -.32 : .32); g.add(m); modules.push(m); m.userData.top = top; m.userData.topCol = top.material.color.clone();
    }
    const busbars = []; for (let j = 0; j < 2; j++) { const z = j ? -.32 : .32; const b = K.tube([[x0 - L / 2 + .2, y0 + .19, z], [x0 + L / 2 - .2, y0 + .19, z]], .012, COL.orange, {glow: true}); g.add(b); busbars.push(b); }
    const lid = K.holoBox(L, .02, Wd, COL.cyan, .05, .6); lid.position.set(x0, y0 + .22, 0); g.add(lid);
    const hvPort = new THREE.Mesh(K.rbox(.1, .08, .16, .02), metal(0xff7a2f, {m: .3, r: .4, e: 0xff5a1f, ei: .6})); hvPort.position.set(x0 + L / 2 + .03, y0 + .1, .2); g.add(hvPort);
    sys.battery = {g, tray, plate, coolant, modules, busbars, lid, hvPort, L, Wd, x0, y0};
  }
  // ---------- 电驱（前后） ----------
  const motor = (x, k) => {
    const g = new THREE.Group(); g.position.set(x, wr, 0);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.15, .15, .34, 32), metal(0x8796a3, {m: .75, r: .3})); housing.rotation.x = Math.PI / 2; g.add(housing);
    const ring1 = K.ring(.155, COL.cyan, .008); ring1.position.z = .1; g.add(ring1);
    const ring2 = K.ring(.155, COL.cyan, .008); ring2.position.z = -.1; g.add(ring2);
    const gear = new THREE.Mesh(K.rbox(.26, .26, .2, .04), metal(0x6b7a87, {m: .7, r: .35})); gear.position.set(k * .1, -.02, -.25); g.add(gear);
    const inv = new THREE.Mesh(K.rbox(.3, .1, .3, .03), metal(0x404f5c, {m: .6, r: .4, e: 0x1b5c7a, ei: .3})); inv.position.set(0, .2, .05); g.add(inv);
    const shafts = [-1, 1].map(s => { const sh = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, track - .2, 12), metal(0xa9b5bf, {m: .9, r: .25})); sh.rotation.x = Math.PI / 2; sh.position.z = s * (track / 2 + .05); g.add(sh); return sh; });
    return {g, housing, inv, gear, shafts, rings: [ring1, ring2]};
  };
  { const g = W('drive'); sys.rear = motor(xR, 1); sys.front = motor(xF, -1); sys.front.g.scale.setScalar(.85); g.add(sys.rear.g, sys.front.g); sys.drive = {g}; }
  // ---------- 热管理 ----------
  {
    const g = W('thermal');
    const rad = K.holoBox(.06, .34, 1.0, COL.blue, .25, .9); rad.position.set(2.08, .48, 0); g.add(rad);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .1, 16), metal(0x5fb7ff, {e: 0x2a7fff, ei: .5})); pump.position.set(1.85, .4, -.25); g.add(pump);
    const loopPts = [[2.05, .45, .3], [1.75, .42, .3], [1.5, .4, .15], [1.2, .26, .3], [0, .24, .45], [-1.15, .26, .3], [-1.39, .4, .1], [-1.2, .3, -.35], [0, .24, -.5], [1.2, .26, -.35], [1.85, .4, -.25], [2.05, .45, -.3]];
    const pipe = K.tube(loopPts, .017, 0x3da0ff, {segs: 200}); g.add(pipe);
    const cold = K.flow(loopPts, {color: COL.cyan, n: 46, size: 5, speed: .12}); g.add(cold);
    const hvac = K.holoBox(.32, .22, .7, COL.teal, .12, .8); hvac.position.set(1.15, .78, 0); g.add(hvac);
    const cabinAir = K.flow([[1.05, .82, .3], [.7, .95, .4], [.1, 1.0, .4], [-.6, .95, .35]], {color: COL.teal, n: 20, size: 4.5, speed: .18}); g.add(cabinAir);
    const cabinAir2 = K.flow([[1.05, .82, -.3], [.7, .95, -.4], [.1, 1.0, -.4], [-.6, .95, -.35]], {color: COL.teal, n: 20, size: 4.5, speed: .18}); g.add(cabinAir2);
    sys.thermal = {g, rad, pump, pipe, cold, hvac, cabinAir, cabinAir2, loopPts};
  }
  // ---------- 高压线 ----------
  {
    const g = W('hv');
    const a = K.tube([[1.18, .27, .2], [1.32, .4, .22], [1.42, .58, .12]], .022, COL.orange, {glow: true});
    const b = K.tube([[-1.17, .27, -.2], [-1.3, .42, -.22], [-1.39, .58, -.1]], .022, COL.orange, {glow: true});
    const fa = K.flow([[1.18, .27, .2], [1.32, .4, .22], [1.42, .58, .12]], {color: COL.amber, n: 10, size: 6, speed: .7});
    const fb = K.flow([[-1.17, .27, -.2], [-1.3, .42, -.22], [-1.39, .58, -.1]], {color: COL.amber, n: 10, size: 6, speed: .7});
    g.add(a, b, fa, fb); sys.hv = {g, cables: [a, b], flows: [fa, fb]};
  }
  // ---------- 电子电气：中央计算 + 区域控制器 + 线束 + 传感器 ----------
  {
    const g = W('eea');
    const ecu = (p, s = 1, c = COL.cyan) => { const n = new THREE.Group(); n.position.set(...p); const b = new THREE.Mesh(K.rbox(.16 * s, .06 * s, .12 * s, .015), metal(0x24313c, {m: .4, r: .5})); const led = K.glow(new THREE.BoxGeometry(.13 * s, .008, .09 * s), c, 2.4, .9); led.position.y = .034 * s; n.add(b, led); n.userData.led = led; g.add(n); return n; };
    const central = ecu([.35, .5, 0], 1.6, COL.violet);
    const zones = [ecu([1.7, .62, .4]), ecu([1.7, .62, -.4]), ecu([-1.75, .66, .35]), ecu([-1.75, .66, -.35])];
    const P = {
      camF: [.95, 1.15, 0], radarF: [2.32, .47, 0], radarFL: [2.12, .5, .72], radarFR: [2.12, .5, -.72], radarRL: [-2.18, .52, .72], radarRR: [-2.18, .52, -.72],
      camL: [.15, .98, .93], camR: [.15, .98, -.93], camB: [-2.27, .86, 0], lidar: [.72, 1.36, 0], antenna: [-.85, 1.4, 0], screen: [.72, .98, 0]
    };
    const sensors = {};
    for (const [k, p] of Object.entries(P)) { if (k === 'screen') continue; const s = new THREE.Mesh(new THREE.SphereGeometry(k === 'lidar' ? .05 : .035, 16, 12), new THREE.MeshStandardMaterial({color: 0x101820, emissive: k.startsWith('radar') ? COL.amber : COL.cyan, emissiveIntensity: 1.2, transparent: true})); s.position.set(...p); g.add(s); sensors[k] = s; }
    const screen = K.panel(.36, .16, COL.cyan, .3); screen.position.set(...P.screen); screen.rotation.y = Math.PI / 2; screen.rotation.x = 0; screen.rotation.z = 0; g.add(screen); screen.rotateX(-.35);
    // 线束：主干环 + 支路
    const trunk = [[1.7, .62, .4], [1.2, .48, .62], [0, .42, .66], [-1.2, .48, .62], [-1.75, .66, .35], [-1.75, .66, -.35], [-1.2, .48, -.62], [0, .42, -.66], [1.2, .48, -.62], [1.7, .62, -.4]];
    const loom = K.tube(trunk, .016, 0x2bc3ff, {glow: true, segs: 220}); g.add(loom);
    const br = (a, b, mid) => { const pts = mid ? [a, mid, b] : [a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + .05, (a[2] + b[2]) / 2], b]; const t = K.tube(pts, .008, 0x2bc3ff, {glow: true, segs: 40}); g.add(t); return {t, pts}; };
    const branches = [
      br([1.7, .62, .4], P.radarFL), br([1.7, .62, -.4], P.radarFR), br([1.7, .62, .4], P.radarF, [2.1, .55, .2]),
      br([.35, .5, 0], P.camF, [.8, .9, .05]), br([.35, .5, 0], P.screen, [.6, .7, 0]), br([0, .42, .66], P.camL, [.1, .7, .85]), br([0, .42, -.66], P.camR, [.1, .7, -.85]),
      br([-1.75, .66, .35], P.radarRL), br([-1.75, .66, -.35], P.radarRR), br([-1.75, .66, .35], P.camB, [-2.1, .78, .1]),
      br([.35, .5, 0], [0, .42, .66]), br([.35, .5, 0], [0, .42, -.66]), br([.35, .5, 0], P.lidar, [.6, 1.1, 0])
    ];
    const sig = branches.map(b => K.flow(b.pts, {color: COL.cyan, n: 6, size: 4.5, speed: .9}));
    sig.forEach(f => g.add(f));
    const trunkSig = K.flow(trunk, {color: COL.cyan, n: 30, size: 4, speed: .2}); g.add(trunkSig);
    // 探测扇区
    const fans = {};
    const fan = (k, r, ang, rotY, col = COL.cyan) => { const f = K.fan(r, ang, col, .14); f.rotation.x = -Math.PI / 2; f.rotation.z = rotY; f.position.set(P[k][0], P[k][1] - .02, P[k][2]); g.add(f); fans[k] = f; };
    fan('camF', 7, .9, 0); fan('radarF', 9, .35, 0, COL.amber); fan('radarFL', 3.2, 1.6, .9, COL.amber); fan('radarFR', 3.2, 1.6, -.9, COL.amber); fan('radarRL', 3.2, 1.6, 2.3, COL.amber); fan('radarRR', 3.2, 1.6, -2.3, COL.amber); fan('camB', 3.5, 1.4, Math.PI);
    sys.eea = {g, central, zones, sensors, screen, loom, branches, sig, trunkSig, fans, P, trunk};
  }
  // ---------- 座舱：座椅、方向盘、仪表板 ----------
  {
    const g = W('cabin');
    const seatMat = () => metal(0x3a4652, {m: .1, r: .7});
    const seat = (x, z, w = .5) => { const s = new THREE.Group(); s.position.set(x, .36, z); const cush = new THREE.Mesh(K.rbox(.5, .1, w, .04), seatMat()); cush.position.set(0, .05, 0); const back = new THREE.Mesh(K.rbox(.1, .62, w, .04), seatMat()); back.position.set(-.27, .36, 0); back.rotation.z = .2; const head = new THREE.Mesh(K.rbox(.08, .16, w * .5, .03), seatMat()); head.position.set(-.36, .74, 0); head.rotation.z = .2; const rail = new THREE.Mesh(new THREE.BoxGeometry(.5, .03, .04), metal(0x8a97a1)); rail.position.set(0, -.05, w * .3); const rail2 = rail.clone(); rail2.position.z = -w * .3; s.add(cush, back, head, rail, rail2); g.add(s); return s; };
    const seats = [seat(.08, .37), seat(.08, -.37), seat(-.86, 0, 1.25)];
    const dash = new THREE.Mesh(K.rbox(.32, .2, 1.36, .05), metal(0x2c3640, {m: .2, r: .6})); dash.position.set(.88, .78, 0); g.add(dash);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.17, .02, 10, 40), metal(0x1d252c, {m: .2, r: .5})); wheel.position.set(.55, .9, -.37); wheel.rotation.y = Math.PI / 2; wheel.rotation.x = 0; wheel.rotateX(.0); wheel.rotateY(0); wheel.rotation.z = 0; g.add(wheel); wheel.rotation.set(0, Math.PI / 2, 0); wheel.rotateX(-.35);
    const disp = K.panel(.24, .15, COL.cyan, .35); disp.position.set(.82, .98, 0); disp.rotation.set(0, Math.PI / 2, 0); disp.rotateX(-.3); g.add(disp);
    sys.cabin = {g, seats, dash, wheel, disp};
  }
  // ---------- 白车身骨架 ----------
  {
    const g = W('biw');
    const T = car.topAt;
    const z0 = .76, zr = .6, ys = .3;
    const xs = [1.0, .45, -.05, -.75, -1.55];
    const yA = T(xs[1]).roof - .03, yC = T(xs[3]).roof - .04;
    const beams = [];
    const beam = (pts, r = .028, c = 0x9fb3c2) => { const t = K.tube(pts, r, c, {metal: .7, segs: 40}); g.add(t); beams.push(t); return t; };
    for (const s of [1, -1]) {
      beam([[1.85, ys + .05, s * .7], [1.2, ys, s * z0], [-1.1, ys, s * z0], [-1.75, ys + .08, s * .72]], .035); // 门槛
      beam([[1.0, .9, s * .76], [.72, 1.12, s * .68], [xs[1], yA, s * zr]]); // A 柱
      beam([[xs[1], yA, s * zr], [-.2, T(-.2).roof - .02, s * (zr - .02)], [xs[3], yC, s * zr]]); // 顶边梁
      beam([[xs[2], ys, s * z0], [xs[2], .7, s * .8], [xs[2] - .02, T(xs[2]).roof - .03, s * (zr + .02)]], .032); // B 柱
      beam([[xs[3], yC, s * zr], [-1.2, 1.1, s * .66], [xs[4], .9, s * .74]]); // C 柱
      beam([[1.85, ys + .05, s * .7], [1.0, .9, s * .76]], .026); // 前门框下段
      beam([[2.25, .48, s * .42], [1.6, .42, s * .45], [1.2, ys + .02, s * .5]], .03); // 前纵梁
      beam([[-2.25, .5, s * .45], [-1.7, .45, s * .5], [-1.2, ys + .02, s * .55]], .03); // 后纵梁
    }
    for (const x of [1.2, .45, -.05, -.6, -1.2]) beam([[x, ys, z0], [x, ys - .03, 0], [x, ys, -z0]], .025);
    beam([[xs[1], yA, zr], [xs[1] + .02, yA + .03, 0], [xs[1], yA, -zr]], .022); beam([[xs[3], yC, zr], [xs[3], yC + .02, 0], [xs[3], yC, -zr]], .022); beam([[-.1, T(-.1).roof - .02, zr - .02], [-.1, T(-.1).roof, 0], [-.1, T(-.1).roof - .02, -zr + .02]], .02);
    beam([[2.28, .5, .72], [2.33, .5, 0], [2.28, .5, -.72]], .035, 0xb9c6cf); beam([[-2.28, .52, .72], [-2.32, .52, 0], [-2.28, .52, -.72]], .035, 0xb9c6cf);
    beam([[1.0, .9, .76], [1.05, .95, 0], [1.0, .9, -.76]], .03);
    // 连接点（焊点）
    const joints = [];
    beams.forEach(b => { const c = b.userData.curve; [0, 1].forEach(u => { const p = c.getPointAt(u); const j = K.glow(new THREE.SphereGeometry(.03, 10, 8), COL.amber, 2.6, .95); j.position.copy(p); g.add(j); joints.push(j); }); });
    sys.biw = {g, beams, joints};
  }
  // ---------- 悬架 ----------
  {
    const g = W('chassis');
    const parts = [];
    wc.forEach((c, i) => {
      const s = Math.sign(c.z), x = c.x;
      const helix = []; for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2 * 6; helix.push([x + Math.cos(a) * .06, .42 + k / 64 * .3, s * (track - .2) + Math.sin(a) * .06]); }
      const spring = K.tube(helix, .009, 0xffc44d, {segs: 300, metal: .5}); g.add(spring);
      const damper = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, .42, 12), metal(0xb0bec8, {m: .9, r: .2})); damper.position.set(x, .57, s * (track - .2)); g.add(damper);
      const armL = K.tube([[x - .18, .3, s * .4], [x, .28, s * (track - .1)], [x + .18, .3, s * .4]], .02, 0x8fa2b0, {segs: 30, metal: .7}); g.add(armL);
      const knuckle = new THREE.Mesh(K.rbox(.08, .2, .06, .02), metal(0x7a8894)); knuckle.position.set(x, wr, s * (track - .14)); g.add(knuckle);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(.16, .16, .025, 32), metal(0x9aa4ab, {m: .9, r: .3})); disc.rotation.x = Math.PI / 2; disc.position.set(x, wr, s * (track - .1)); g.add(disc);
      parts.push({spring, damper, armL, knuckle, disc});
    });
    const rack = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.0, 12), metal(0x9fb0bd)); rack.rotation.x = Math.PI / 2; rack.position.set(xF - .15, .38, 0); g.add(rack);
    const sub = K.tube([[xF + .2, .3, .45], [xF - .3, .28, .45], [xF - .3, .28, -.45], [xF + .2, .3, -.45]], .025, 0x7d8e9b, {segs: 40, metal: .7}); g.add(sub);
    sys.chassis = {g, parts, rack, sub};
  }
  // ---------- 乘员包络（抽象测量假人，只用于空间检查） ----------
  {
    const g = W('occupant');
    const mk = (x, z) => {
      const o = new THREE.Group(); o.position.set(x, .36, z);
      const mat = () => new THREE.MeshBasicMaterial({color: COL.teal, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending});
      const cap = (r, len, p, rz) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat()); m.position.set(...p); m.rotation.z = rz; o.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({color: new THREE.Color(COL.teal).multiplyScalar(1.6), transparent: true, opacity: .45, toneMapped: false, depthWrite: false})); e.position.copy(m.position); e.rotation.copy(m.rotation); o.add(e); return m; };
      cap(.13, .34, [-.12, .42, 0], .2); // 躯干
      const head = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 14), mat()); head.position.set(-.2, .8, 0); o.add(head);
      cap(.075, .36, [.12, .12, 0], Math.PI / 2 - .1); // 大腿
      cap(.06, .36, [.38, -.1, 0], .35); // 小腿
      const clearance = K.ring(.15, COL.green, .006); clearance.position.set(-.2, .8, 0); clearance.rotation.x = Math.PI / 2; o.add(clearance);
      o.userData.head = head; o.userData.clear = clearance; g.add(o); return o;
    };
    sys.occupant = {g, front: mk(.1, -.37), front2: mk(.1, .37), rear: mk(-.82, -.37)};
  }

  // 记录所有子件初始位姿，便于每帧复位
  const inits = [];
  root.traverse(o => inits.push([o, o.position.clone(), o.rotation.clone(), o.scale.clone()]));
  const vis = {}, subs = [], groupSet = new Set(Object.values(groups));
  for (const [k, g] of Object.entries(groups)) g.traverse(o => o.userData.sysKey = k);
  Object.keys(groups).forEach(k => { vis[k] = 0; op(groups[k], 0); });
  return Object.assign(sys, {
    groups,
    reset() { sys.battery.modules.forEach(m => m.userData.top.material.color.copy(m.userData.topCol)); for (const [o, p, r, s] of inits) { o.position.copy(p); o.rotation.copy(r); o.scale.copy(s); if (o !== root && !groupSet.has(o)) o.visible = true; } Object.keys(vis).forEach(k => vis[k] = 0); subs.length = 0; Object.values(sys.eea.fans).forEach(f => subs.push([f, 0])); },
    // 单独调某个子件的透明度（乘以所在系统的透明度）
    sub(obj, o) { subs.push([obj, o]); },
    show(k, o) { vis[k] = Math.max(vis[k], o); },
    apply(t) {
      for (const k of Object.keys(groups)) op(groups[k], vis[k]);
      for (const [obj, o] of subs) { const k = obj.userData.sysKey; const v = (vis[k] ?? 1) * o; op(obj, v); }
      // 默认的流动（随时间 t 平滑运动）
      if (vis.thermal) { sys.thermal.cold.userData.update(t, sys.thermal.reach ?? 1); sys.thermal.cabinAir.userData.update(t, sys.thermal.air ?? 0); sys.thermal.cabinAir2.userData.update(t, sys.thermal.air ?? 0); }
      if (vis.hv) sys.hv.flows.forEach(f => f.userData.update(t, sys.hv.reach ?? 1));
      if (vis.eea) { sys.eea.sig.forEach((f, i) => f.userData.update(t + i * .13, sys.eea.reach ?? 1)); sys.eea.trunkSig.userData.update(t, sys.eea.reach ?? 1); Object.values(sys.eea.fans).forEach(f => { f.material.uniforms.uT.value = t; }); }
      sys.thermal.reach = undefined; sys.thermal.air = undefined; sys.hv.reach = undefined; sys.eea.reach = undefined;
    }
  });
}
