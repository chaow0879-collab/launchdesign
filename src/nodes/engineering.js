// 第 6 阶段：智能电动车工程开发
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, wall, stagger, axes, THREE} from './lib.js';
// 落位求解器：沿 pts 走到 pts[i]（=接触面/落点）停住，越过的进度只换算成 ≤push 的让位（不穿透）。
// travel(k) 的输入被放 10%（k→1.1k），所以落点之后仍有进度可用，"到面即停住"由 stopAt 真正执行。
const land = (K, pts, i, opts = {}) => {
  const curve = K.curve(pts), tgt = new THREE.Vector3(...pts[i]);
  let best = 1, bd = Infinity;
  for (let k = 0; k <= 240; k++) { const p = curve.getPointAt(k / 240), d = p.distanceTo(tgt); if (d < bd) { bd = d; best = k / 240; } }
  for (let r = 0; r < 3; r++) { const st = 1 / (240 * 10 ** (r + 1)); for (let j = -5; j <= 5; j++) { const u = Math.max(0, Math.min(1, best + j * st)), d = curve.getPointAt(u).distanceTo(tgt); if (d < bd) { bd = d; best = u; } } }
  const g = K.stopAt(new THREE.Group(), pts, best, opts), go = g.userData.travel;
  g.userData.travel = k => go(Math.max(0, Math.min(1, k * 1.1)));
  return g;
};

export const engineering2 = {
  phases: ['电池包成形', '能量通路接通', '电驱与热管理汇合'],
  shots: [
    {title: '托盘与冷板', detail: '电池托盘升入地板下方，冷板与冷却流道铺上，密封边界一圈圈闭合'},
    {title: '模组落位紧固', detail: '十二个模组依次落入，螺栓拧紧、绝缘片插入，振动与热胀被检验'},
    {title: '高压通路', detail: '母排接通、能量流起来；绝缘检测扫过，维修开关断开时能量随即停止'},
    {title: '电驱接入车轴', detail: '前后电驱装上车轴，车轮转动响应，悬架上下运动检查活动空间'},
    {title: '冷却与座舱空调', detail: '冷却液流经电池和电驱，座舱冷暖风同时工作，温度与能耗取得平衡'},
    {title: '能量与热量汇合', detail: '能量流与冷却流同时运行；模拟一处异常，保护策略切断并恢复'}
  ],
  cams: [
    [{tg: [0, .35, 1.4], r: 7.0, az: 40, el: 30}],
    [{tg: [0, .32, 1.8], r: 6.0, az: 62, el: 42}, {b: 1, tg: [-.2, .32, 2.0], r: 4.8, az: 45, el: 34}],
    [{tg: [.4, .38, 0], r: 6.0, az: 36, el: 36}, {b: 2, tg: [.8, .38, .2], r: 4.8, az: 52, el: 28}],
    [{tg: [-1.2, .42, 0], r: 5.8, az: 150, el: 16}, {b: 1, tg: [-1.2, .5, .3], r: 5.0, az: 125, el: 12}],
    [{tg: [.2, .5, 0], r: 7.4, az: 48, el: 26}],
    [{tg: [0, .6, 0], r: 8.6, az: 30, el: 20}]
  ],
  build(K, S, car) {
    const P = {}, B = S.battery;
    const xs = B.x0 - B.L / 2, xe = B.x0 + B.L / 2, hz = B.Wd / 2;
    P.seal = K.add(K.line([[xs, .27, hz], [xe, .27, hz], [xe, .27, -hz], [xs, .27, -hz], [xs, .27, hz]], COL.green, .95));
    P.conds = [['wrench', COL.white, [1.5, 1.0, 1.7]], ['shield', COL.green, [0, 1.15, 1.6]], ['thermo', COL.cyan, [-1.4, 1.0, 1.7]]].map(([ic, c, p]) => ({b: chip(K, ic, c, p, .36), l: link(K, p, [p[0] * .5, .32, 2.5], c, .05), p}));
    P.bolts = []; B.modules.forEach((m, i) => [-1, 1].forEach(s => { const b = K.add(K.glow(new THREE.CylinderGeometry(.022, .022, .05, 10), COL.amber, 2.4)); setP(b, [m.position.x + s * .14, .37, m.position.z + (m.position.z > 0 ? .26 : -.26)]); b.userData.i = i; P.bolts.push(b); }));
    P.ins = [0, 1, 2, 3, 4].map(i => { const p = K.add(K.holoBox(.012, .13, 1.2, COL.violet, .25, .8)); setP(p, [xs + .2 + (i + .5) * .378, .3, 0]); return p; });
    P.vib = chip(K, 'sound', COL.white, [-1.2, .95, 2.5], .3); P.heat = chip(K, 'thermo', COL.amber, [0, 1.0, 2.5], .3); P.safe = chip(K, 'shield', COL.green, [1.2, .95, 2.5], .3);
    // 高压：母排上的能量流、绝缘检测环、维修开关
    P.bus = [.32, -.32].map(z => K.add(K.flow([[xs + .2, .37, z], [xe - .2, .37, z], [xe + .05, .3, .2]], {color: COL.amber, n: 22, size: 6, speed: .45})));
    P.scan = K.add(K.ring(.06, COL.green, .01)); P.scan.rotation.y = Math.PI / 2;
    P.msd = K.add(new THREE.Mesh(K.rbox(.14, .08, .1, .02), new THREE.MeshStandardMaterial({color: 0xff7a2f, emissive: 0xff5a1f, emissiveIntensity: .8, transparent: true}))); setP(P.msd, [.15, .4, 0]);
    P.lock = chip(K, 'lock', COL.amber, [.15, .82, 0], .3); P.okHV = chip(K, 'check', COL.green, [.9, .85, .3], .3);
    // 电驱：轴心活动包络、目标
    P.env = [car.wheelCenters[2], car.wheelCenters[3]].map(w => { const r = K.add(K.ring(.42, COL.teal, .008)); setP(r, [w.x, w.y, w.z]); return r; });
    P.motorTarget = chip(K, 'target', COL.green, [-1.4, 1.1, .2], .36);
    // 冷暖与平衡
    P.snow = chip(K, 'snow', COL.cyan, [.3, 1.55, .5], .34); P.sun = chip(K, 'thermo', COL.amber, [-.3, 1.55, .5], .34);
    const A4 = axes(48);
    P.beam = K.add(K.glow(new THREE.BoxGeometry(1.4, .02, .02), COL.white, 1.6, .8)); setP(P.beam, A4.at([.2, 1.72, 0], 0, -.6)); P.beam.rotation.y = A4.ry - Math.PI / 2 + Math.PI / 2;
    P.beamT = chip(K, 'thermo', COL.cyan, [0, 0, 0], .3); P.beamE = chip(K, 'bolt', COL.amber, [0, 0, 0], .3);
    P.pivot = K.add(K.glow(new THREE.ConeGeometry(.06, .12, 3), COL.white, 1.6)); setP(P.pivot, [P.beam.position.x, 1.65, P.beam.position.z]);
    // 汇合与保护
    P.sweep = K.add(K.glow(new THREE.BoxGeometry(.012, 1.4, 1.7), COL.green, 2.2, .7));
    P.sweepPlane = K.add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.4), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(1.4), transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false}))); P.sweepPlane.rotation.y = Math.PI / 2;
    P.gauge = K.add(new THREE.Mesh(new THREE.TorusGeometry(.32, .03, 6, 64), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(2.4), transparent: true, toneMapped: false, depthWrite: false}))); const A5 = axes(30); setP(P.gauge, [.3, 1.95, -.6]); P.gauge.rotation.y = A5.ry;
    P.gaugeIcon = chip(K, 'bolt', COL.green, [.3, 1.95, -.6], .3);
    P.fault = K.add(K.glow(new THREE.BoxGeometry(.35, .14, .62), COL.red, 2.6, .0)); setP(P.fault, B.modules[7].position.toArray());
    P.warn = chip(K, 'warn', COL.red, [B.modules[7].position.x, .85, B.modules[7].position.z], .34);
    P.ok = chip(K, 'shield', COL.green, [B.modules[7].position.x, .85, B.modules[7].position.z], .34);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, B = S.battery;
    // 整个工序车身保持透视
    const ghost = 1 - c.p(5, 1.2, 5, 'end') * .0;
    car.set('paint', 0); car.set('ghost', ghost);
    // —— 1 托盘与冷板 ——
    S.show('battery', 1);
    // 电池包先在车旁的装配位上成形，第 3 句时整体送入地板下
    const rise = c.p(0, 0, 0, .9), dock = c.p(2, 0, 2, .7);
    B.g.position.set(0, lerp(-.5, 0, rise) + .25 * K.pulse(dock), 2.5 * (1 - dock));
    S.sub(B.tray, 1); S.sub(B.plate, c.in(0, 1)); B.plate.position.y = B.y0 + .04 + .35 * (1 - c.p(0, 1, 0, 1.6));
    S.sub(B.coolant, c.in(0, 1.2)); K.growTube(B.coolant, c.p(0, 1.2, 0, 2));
    op(P.seal, c.show(0, 1.6, 2, 0)); K.drawLine(P.seal, c.p(0, 1.6, 0, 2.2)); P.seal.position.copy(B.g.position);
    P.conds.forEach((d, i) => { const k = stagger(c.p(0, 2, 0, 'end'), i, 3), live = c.out(1, 0); op(d.b, k * live); op(d.l, k * live); K.drawLine(d.l, k); });
    // —— 2 模组落位 ——
    // 每个模组沿竖直路径下落，落位终点由 stopAt 贴住冷板（接触点之后不再下沉，vib 只做横向微振）
    P.drop = P.drop || (() => {
      const curve = K.curve([[0, 1.1, 0], [0, .5, 0], [0, 0, 0], [0, -.42, 0]]);
      const target = new THREE.Vector3(0, 0, 0);
      let best = 1, bestD = Infinity;
      for (let i = 0; i <= 96; i++) { const u = i / 96, p = curve.getPointAt(u), d = p.distanceTo(target); if (d < bestD) { bestD = d; best = u; } }
      return K.stopAt(new THREE.Group(), curve, best);      // 冷板上表面 = 落位接触点
    })();
    const dropY = k => { P.drop.userData.travel(k); return P.drop.children[0].position.y; };
    const comp = c.p(1, 1.2, 1, 2) * .05;                   // 紧固后的模组压缩量
    B.modules.forEach((m, i) => {
      const k = stagger(c.lin(1, 0, 1, 1), i, 12, .55), land = ease(k);
      m.position.y = B.y0 + .12 + dropY(land);
      S.sub(m, c.after(1, 0) ? clamp(k * 3) : 0);
      op(m.userData.top, clamp((k - .9) * 10) * .9 + c.pulse(1, 0, .01));
      const vib = c.show(1, 1, 1, 2) * .012 * Math.sin(t * 40 + i), therm = 1 + .05 * c.pulse(1, 2, 1.6);
      m.position.x = B.modules[i].position.x + vib; m.scale.set(therm, 1 - comp, therm);
    });
    S.sub(B.lid, c.show(5, 0) * .8); S.sub(B.busbars[0], c.in(2, 0)); S.sub(B.busbars[1], c.in(2, 0));
    B.busbars.forEach(b => K.growTube(b, c.p(2, 0, 2, .8)));
    S.sub(B.hvPort, c.in(2, 0));
    P.bolts.forEach((b, i) => { const k = stagger(c.p(1, 1, 1, 2), i % 12, 12, .6); op(b, c.show(1, 1, 2, 0) * clamp(k * 4)); b.position.y = .45 - .08 * k; b.position.z += B.g.position.z; b.rotation.y = k * Math.PI * 4; });   // 4 圈旋入，随 k 递增
    P.ins.forEach((p, i) => { const k = stagger(c.p(1, 1, 1, 2), i, 5); op(p, c.show(1, 1, 2, 0) * k * .9); p.position.y = .3 + .4 * (1 - k); p.position.z = B.g.position.z; });
    op(P.vib, c.show(1, 1, 2, 0)); op(P.heat, c.show(1, 2, 2, 0)); op(P.safe, c.show(1, 2.5, 2, 0));
    // —— 3 高压通路 ——
    const cut = c.p(2, 2, 2, 2.35), restore = c.p(3, 0, 3, .3);
    const flowOn = c.show(2, .6) * (1 - cut * (1 - restore));
    P.bus.forEach(f => { op(f, flowOn); f.userData.update(t, c.lin(2, 0, 2, 1)); });
    const sk = c.lin(2, 1, 2, 2); op(P.scan, c.show(2, 1, 2, 2) * K.pulse(sk)); setP(P.scan, [lerp(B.x0 - B.L / 2 + .2, B.x0 + B.L / 2 - .2, sk), .37, .32 - .64 * (sk > .5 ? 1 : 0)]);
    op(P.msd, c.show(2, 0, 4, 0)); P.msd.position.y = .4 + .2 * cut * (1 - restore); P.msd.material.emissiveIntensity = .8 * (1 - cut * (1 - restore));
    op(P.lock, c.show(2, 2, 3, 0)); op(P.okHV, c.show(2, 1.6, 2, 2) * .9);
    // —— 4 电驱接入 ——
    S.show('drive', c.show(3, 0));
    const fit = c.p(3, 0, 3, .9);
    S.rear.g.position.z = lerp(1.6, 0, fit); S.front.g.position.z = lerp(-1.6, 0, c.p(3, .3, 3, 1.2));
    S.rear.shafts.forEach(s => s.scale.y = Math.max(.01, c.p(3, .7, 3, 1.1))); S.front.shafts.forEach(s => s.scale.y = Math.max(.01, c.p(3, 1, 3, 1.3)));
    const drive = c.show(3, 1) * (t - c.T(3, 1)) * 5;
    if (c.after(3, 1)) { car.spin(Math.max(0, drive)); S.rear.rings.forEach(r => r.rotation.z = drive); S.front.rings.forEach(r => r.rotation.z = drive); }
    S.show('chassis', c.show(3, .8) * .9);
    const bounce = c.show(3, 2, 4, 0) * .06 * Math.sin(t * 4.2);
    car.wheels.slice(2).forEach(w => w.position.y += bounce); S.chassis.parts.slice(2).forEach(p => { p.spring.scale.y = 1 + bounce * 2.2; p.spring.position.y = -bounce * .6; p.knuckle.position.y += bounce; p.disc.position.y += bounce; });
    P.env.forEach(r => { op(r, c.show(3, 2, 4, 0) * .8); r.scale.setScalar(1 + .04 * Math.sin(t * 4.2)); });
    op(P.motorTarget, c.show(3, 3, 4, 0)); P.motorTarget.scale.setScalar(.36 * (1 + .25 * c.pulse(3, 3, 1.2)));
    // —— 5 冷却与座舱空调 ——
    S.show('thermal', c.show(4, 0));
    S.sub(S.thermal.pipe, c.in(4, 0)); K.growTube(S.thermal.pipe, c.p(4, 0, 4, .9)); S.thermal.reach = c.lin(4, .3, 4, 1.2);
    S.thermal.air = c.lin(4, 1, 4, 1.6); S.sub(S.thermal.hvac, c.in(4, 1)); S.sub(S.thermal.cabinAir, c.in(4, 1)); S.sub(S.thermal.cabinAir2, c.in(4, 1));
    S.show('cabin', c.show(4, 1, 5, 1) * .5);
    op(P.snow, c.show(4, 1, 5, 0)); op(P.sun, c.show(4, 1.4, 5, 0));
    const bal = c.show(4, 2, 5, 0), tilt = .35 * Math.cos(c.lin(4, 2, 4, 'end') * Math.PI * 2.2) * (1 - c.p(4, 2, 4, 'end'));
    op(P.beam, bal); op(P.pivot, bal); op(P.beamT, bal); op(P.beamE, bal);
    P.beam.rotation.z = tilt; const bp = P.beam.position, ax = axes(48).right;
    setP(P.beamT, [bp.x - ax[0] * .65, bp.y + .2 - Math.sin(tilt) * .65, bp.z - ax[2] * .65]); setP(P.beamE, [bp.x + ax[0] * .65, bp.y + .2 + Math.sin(tilt) * .65, bp.z + ax[2] * .65]);
    P.beam.rotation.set(0, axes(48).ry, tilt);
    // —— 6 汇合与保护 ——
    const all = c.show(5, 0);
    if (all > 0) { S.show('hv', all); S.show('thermal', 1); S.thermal.reach = 1; S.thermal.air = 1; P.bus.forEach(f => { op(f, all); f.userData.update(t, 1); }); }
    const sw = c.lin(5, 1, 5, 1.6); op(P.sweep, c.show(5, 1, 5, 1.7) * K.pulse(sw)); op(P.sweepPlane, c.show(5, 1, 5, 1.7) * K.pulse(sw)); P.sweep.position.set(lerp(2.5, -2.5, sw), .7, 0); P.sweepPlane.position.set(lerp(2.5, -2.5, sw), .7, 0);
    op(P.gauge, c.show(5, 1, 99)); P.gauge.geometry.setDrawRange(0, Math.floor(P.gauge.geometry.index.count * c.p(5, 1, 5, 1.6) * .86 / 6) * 6); op(P.gaugeIcon, c.show(5, 1.1));
    const fault = c.pulse(5, 2.3, 1.4);
    op(P.fault, fault * .8); op(P.warn, fault);
    if (c.between(5, 2.3, 5, 2.7)) P.bus.forEach(f => op(f, .15));
    op(P.ok, c.show(5, 2.7));
  }
};

import {dim, hardpoint, section, docStack, robotArm, cad, airflow} from './lib.js';
const ghostCar = (car, k = 1) => { car.set('paint', 1 - k); car.set('ghost', k); };

// ———————————————————— engineering-1 搭建车身骨架与饰件结构 ————————————————————
export const engineering1 = {
  phases: ['承载结构', '截面与连接', '座舱件与紧固'],
  shots: [
    {title: '搭建承载结构', detail: '门槛、立柱、横梁一段段长出，载荷沿承载路径流动，乘员周围形成保护'},
    {title: '密封与排水', detail: '剖开门槛截面：密封线、防腐层显出，水从车门落下沿排水路径流出'},
    {title: '形成连接', detail: '焊点依次亮起、胶线沿顶边梁铺开、螺栓紧固，连接方式随位置不同'},
    {title: '座舱件就位', detail: '座椅、仪表板依次吊入座舱，外观件变成有安装条件的零件'},
    {title: '逐点紧固', detail: '拧紧工具逐个到达紧固点；工具空间、维修和防异响一并检查'},
    {title: '整车接口复核', detail: '结构与座舱合到同一辆车，相邻接口逐个亮绿'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 8, az: 35, el: 22}],
    [{tg: [-.05, .5, .5], r: 4.6, az: 200, el: 14, drift: 0}],
    [{tg: [0, .8, 0], r: 7.2, az: 50, el: 24}],
    [{tg: [.2, .7, 0], r: 6.8, az: 45, el: 32}],
    [{tg: [.2, .6, .3], r: 5.6, az: 60, el: 22}],
    [{tg: [0, .7, 0], r: 8.6, az: 30, el: 16}]
  ],
  build(K, S, car) {
    const P = {};
    P.load = [[[2.3, .5, .72], [1.85, .35, .7], [1.2, .3, .76], [-1.1, .3, .76], [-1.75, .38, .72]], [[2.3, .5, -.72], [1.85, .35, -.7], [1.2, .3, -.76], [-1.1, .3, -.76], [-1.75, .38, -.72]], [[1.0, .9, .76], [.72, 1.12, .68], [.45, 1.36, .6], [-.75, 1.33, .6], [-1.55, .9, .74]]].map(pts => K.add(K.flow(pts, {color: COL.amber, n: 18, size: 6, speed: .5})));
    P.cage = K.add(K.holoBox(1.9, .95, 1.45, COL.green, .04, .6)); setP(P.cage, [-.2, .85, 0]); P.shield = chip(K, 'shield', COL.green, [-.2, 1.75, 0], .36);
    P.secOuter = K.add(K.line([[-.05, .22, .62], [-.05, .22, .82], [-.05, .45, .86], [-.05, .45, .66], [-.05, .22, .62]], COL.white, 1));
    P.secIn = K.add(K.line([[-.05, .26, .68], [-.05, .26, .78], [-.05, .41, .8], [-.05, .41, .7], [-.05, .26, .68]], COL.violet, .9));
    P.seal = K.add(K.line([[-.05, .5, .86], [-.05, .52, .9], [-.05, .95, .88]], COL.green, 1));
    P.water = K.add(K.flow([[-.05, 1.0, .98], [-.05, .7, .97], [-.05, .5, .95], [-.05, .4, .9], [-.05, .23, .8], [-.05, .05, .78]], {color: COL.blue, n: 16, size: 7, speed: .45}));
    P.drop = chip(K, 'drop', COL.blue, [-.05, 1.0, 1.15], .22);
    P.glue = K.add(K.tube([[.45, 1.37, .6], [-.2, 1.42, .58], [-.75, 1.36, .6]], .014, COL.teal, {glow: true}));
    P.bolts = [[1.6, .45, .55], [.45, .32, .76], [-.6, .32, .76], [-1.6, .45, .55], [.88, .86, .6], [.88, .86, -.6]].map(p => { const b = K.add(K.glow(new THREE.CylinderGeometry(.02, .02, .05, 10), COL.amber, 2.4)); setP(b, p); return b; });
    P.tracks = S.cabin.seats.map((s, i) => K.add(K.line([[s.position.x, 2.2, s.position.z], [s.position.x, s.position.y + .3, s.position.z]], COL.white, .6, true)));
    P.arm = robotArm(K, [.6, 0, 1.7]);
    P.tq = [['wrench', COL.amber, [1.6, 1.4, 1.2]], ['sound', COL.white, [.4, 1.5, 1.3]], ['cross', COL.red, [.04, 1.88, 1.44]]].map(([ic, col, p]) => chip(K, ic, col, p, ic === 'cross' ? .2 : .3));
    P.rings = [[2.25, .55, .6], [.88, .9, .6], [-.05, .7, .9], [-2.2, .7, .6], [1.0, 1.0, .75]].map(p => { const r = K.add(K.ring(.09, COL.green, .008)); setP(r, p); return r; });
    P.ok = chip(K, 'check', COL.green, [0, 1.95, 0], .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    ghostCar(car, 1 - c.p(5, .5, 5, 'end') * .7);
    S.show('biw', 1);
    S.biw.beams.forEach((b, i) => K.growTube(b, stagger(c.p(0, 0, 0, 1.2), i, S.biw.beams.length, .85)));
    S.biw.joints.forEach((j, i) => S.sub(j, c.after(2, 0) ? stagger(c.p(2, 0, 2, 1), i % 30, 30, .7) * (1 + .6 * Math.sin(t * 9 + i)) : 0));
    P.load.forEach(f => { op(f, c.show(0, 1, 1, 0)); f.userData.update(t, c.lin(0, 1, 0, 2)); });
    op(P.cage, c.show(0, 2, 1, 0)); op(P.shield, c.show(0, 2.2, 1, 0));
    // 2 截面
    const cut = c.show(1, 0, 2, 0);
    if (cut > 0) { car.clip([1, 0, 0], .05); S.biw.g.visible = true; }
    op(P.secOuter, cut); op(P.secIn, c.show(1, .5, 2, 0)); op(P.seal, c.show(1, .8, 2, 0)); K.drawLine(P.seal, c.p(1, .8, 1, 1.4));
    op(P.water, c.show(1, 1.3, 2, 0)); P.water.userData.update(t, c.lin(1, 1.3, 1, 'end')); op(P.drop, c.show(1, 1.3, 2, 0));
    // 3 连接
    op(P.glue, c.show(2, 1)); K.growTube(P.glue, c.p(2, 1, 2, 1.8));
    P.bolts.forEach((b, i) => { const k = stagger(c.p(2, 1.6, 2, 'end'), i, 6); op(b, c.show(2, 1.6) * k); b.rotation.y = k * 10; });
    // 4 座舱件
    S.show('cabin', c.show(3, 0));
    S.cabin.seats.forEach((s, i) => { const k = stagger(c.p(3, 0, 3, 1.4), i, 3); s.position.y += 1.6 * (1 - k); });
    S.cabin.dash.position.y += 1.6 * (1 - c.p(3, .8, 3, 1.6)); S.cabin.wheel.position.y += 1.6 * (1 - c.p(3, 1, 3, 1.8)); S.cabin.disp.position.y += 1.6 * (1 - c.p(3, 1, 3, 1.8));
    P.tracks.forEach((l, i) => op(l, c.show(3, 0, 4, 0) * .6));
    // 5 紧固：机械臂在两颗螺栓之间走"抬起→平移→落下"两段，落到位后多圈拧入，拧紧瞬间轴向压 .08 表示贴合
    op(P.arm, c.show(4, 0, 5, .5));
    const seg = c.lin(4, 0, 4, 'end') * 6, bi = Math.min(5, Math.floor(seg)), bf = clamp(seg - bi);
    const bp0 = P.bolts[bi].position, bp1 = P.bolts[Math.min(5, bi + 1)].position;
    const from = [bp0.x, bp0.y + .05, bp0.z + .02], to = [bp1.x, bp1.y + .05, bp1.z + .02];
    const mid = [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + .16, (from[2] + to[2]) / 2];
    const up = ease(clamp(bf / .45)), dn = ease(clamp((bf - .55) / .45));
    const cur0 = [lerp(from[0], mid[0], up), lerp(from[1], mid[1], up), lerp(from[2], mid[2], up)];
    const cur1 = [lerp(mid[0], to[0], dn), lerp(mid[1], to[1], dn), lerp(mid[2], to[2], dn)];
    const cur = dn > 0 ? cur1 : cur0;                                                // 先抬到中间高点，再落到下一颗
    const press = Math.max(0, Math.sin(clamp((bf - .45) / .4) * Math.PI)) * .08;   // 拧紧瞬间的轴向压缩
    P.arm.userData.reach(c.after(4, 0) ? [cur[0], cur[1] - press, cur[2]] : [1.2, 1.2, 1.2]);
    if (c.after(4, 0)) P.bolts[bi].rotation.y = clamp((bf - .45) / .5) * Math.PI * 6;   // 6 圈拧入，随曲线递增
    P.tq.forEach((q, i) => op(q, c.show(4, i ? 1 : 0, 5, .5)));
    // 6 接口复核
    P.rings.forEach((r, i) => { op(r, c.show(5, .5) * stagger(c.p(5, .5, 5, 1.5), i, 5)); r.rotation.y = Math.PI / 2; });
    op(P.ok, c.show(5, 1.5));
  }
};

// ———————————————————— engineering-3 连接电子架构与智能功能 ————————————————————
export const engineering3 = {
  phases: ['分配职责与位置', '接通与功能', '在环测试与安全'],
  shots: [
    {title: '布置电子架构', detail: '中央计算、区域控制器、传感器各带职责图标落到车内的位置'},
    {title: '对准针脚并锁止', detail: '放大连接器：供电、接地、信号针脚按颜色对位，插头推入后锁止'},
    {title: '铺设线束', detail: '主干与支路逐段接通，信号沿线束流动；固定、屏蔽和维修条件一并检查'},
    {title: '感知与座舱反馈', detail: '前方出现目标，雷达和摄像头扇区响应；座舱屏亮起，网联服务按权限连接'},
    {title: '模拟到硬件闭环', detail: '软件先在虚拟道路上跑，再接到台架上的真实控制器形成闭环'},
    {title: '故障、安全与诊断', detail: '一条支路故障时备用路径接管；外部恶意访问被拦下；诊断追踪定位异常'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 8.4, az: 40, el: 30}],
    [{tg: [2.0, 2.0, 1.6], r: 2.4, az: 50, el: 10}],
    [{tg: [0, .6, 0], r: 7.6, az: 35, el: 40}],
    [{tg: [2.4, .7, 0], r: 9.4, az: 35, el: 22}],
    [{tg: [0, .9, 1.6], r: 9, az: 50, el: 20}],
    [{tg: [0, .7, 0], r: 8.4, az: 38, el: 30}]
  ],
  build(K, S, car) {
    const P = {}, E = S.eea;
    P.roleI = [['chip', COL.violet, E.central], ['eye', COL.cyan, E.zones[0]], ['gear', COL.blue, E.zones[2]]].map(([ic, col, n]) => ({b: chip(K, ic, col, [0, 0, 0], .28), n}));
    // 大号连接器
    const con = new THREE.Group(); K.add(con); setP(con, [2.0, 2.0, 1.6]); con.rotation.y = axes(50).ry;
    const sock = K.holoBox(.5, .34, .2, COL.cyan, .08, 1); con.add(sock);
    P.pins = []; for (let i = 0; i < 12; i++) { const col = i < 3 ? COL.red : i < 6 ? COL.white : COL.cyan; const p = K.glow(new THREE.CylinderGeometry(.014, .014, .14, 8), col, 2.2); p.rotation.x = Math.PI / 2; p.position.set(-.18 + (i % 6) * .072, i < 6 ? .06 : -.06, .02); con.add(p); P.pins.push(p); }
    P.plug = K.holoBox(.48, .3, .22, COL.amber, .12, 1); con.add(P.plug);
    P.latch = K.glow(new THREE.BoxGeometry(.2, .03, .06), COL.green, 2.4); con.add(P.latch); P.latch.position.set(0, .2, .08);
    P.con = con;
    // 插头沿 +z 推入插座：针脚插到底（z=.12 的插合面）被 stopAt 卡住，越过进度不再前进
    P.seat = land(K, [[0, 0, .62], [0, 0, .34], [0, 0, .12], [0, 0, .075]], 2, {push: 0, axis: 'z'});
    // 接通信号：只插到底才开始流（先断后通），沿插合面从针脚流进插座
    P.seatSig = K.flow([[0, .06, .02], [0, .06, .1], [0, -.06, .1], [0, -.06, .02]], {color: COL.green, n: 8, size: 7, speed: 1.6}); con.add(P.seatSig);
    P.clips = E.trunk.filter((_, i) => i % 2 === 0).map(p => { const cl = K.add(K.holoBox(.06, .04, .06, COL.white, .3, 1)); setP(cl, [p[0], p[1] + .02, p[2]]); return cl; });
    P.emc = chip(K, 'shield', COL.green, [0, 1.0, 1.0], .3);
    P.target = K.add(K.holoBox(1.8, 1.3, 1.6, COL.amber, .08, 1)); setP(P.target, [9, .65, 0]);
    P.box = K.add(K.line([[8.0, 1.4, .9], [8.0, 1.4, -.9], [8.0, -.05, -.9], [8.0, -.05, .9], [8.0, 1.4, .9]], COL.green, 1));
    P.net = [chip(K, 'wifi', COL.cyan, [-.8, 2.0, 0], .32), chip(K, 'lock', COL.green, [-.2, 2.0, 0], .28)];
    P.netL = K.add(K.flow([[-.85, 1.42, 0], [-.85, 1.8, 0], [-.8, 2.6, 0]], {color: COL.cyan, n: 8, size: 6, speed: .8}));
    // 在环测试
    P.track = K.add(K.line(Array.from({length: 65}, (_, i) => { const a = i / 64 * Math.PI * 2; return [-2.6 + Math.cos(a) * 1.0, .02, 2.4 + Math.sin(a) * .6]; }), COL.cyan, .9));
    P.dot = K.add(K.glow(new THREE.BoxGeometry(.16, .06, .08), COL.cyan, 2.6));
    P.sim = chip(K, 'screen', COL.cyan, [-2.6, 1.0, 2.4], .4);
    P.bench = K.add(K.holoBox(1.0, .5, .6, COL.white, .06, .9)); setP(P.bench, [1.6, .25, 2.6]);
    P.ecuB = K.add(new THREE.Mesh(K.rbox(.3, .1, .22, .02), new THREE.MeshStandardMaterial({color: 0x24313c, emissive: COL.violet, emissiveIntensity: .7, transparent: true}))); setP(P.ecuB, [1.6, .56, 2.6]);
    P.hilLoop = K.add(K.flow([[-1.6, .5, 2.4], [0, .7, 2.9], [1.45, .58, 2.6], [0, .4, 2.0], [-1.6, .5, 2.4]], {color: COL.green, n: 20, size: 6, speed: .4}));
    P.okHil = chip(K, 'check', COL.green, [1.6, 1.0, 2.6], .3);
    // 安全
    P.fault = K.add(K.glow(new THREE.SphereGeometry(.07, 12, 10), COL.red, 3)); setP(P.fault, E.branches[0].pts[1]);
    P.backup = K.add(K.tube([[1.7, .62, -.4], [1.95, .6, 0], [2.12, .5, .72]], .012, COL.green, {glow: true}));
    P.attack = K.add(K.flow([[-4, 2.4, 1.5], [-2.5, 1.9, .8], [-1.2, 1.55, .2]], {color: COL.red, n: 10, size: 7, speed: .6}));
    P.guard = K.add(K.ring(.35, COL.green, .014)); setP(P.guard, [-1.2, 1.55, .2]); P.guard.rotation.y = axes(38).ry;
    P.diag = chip(K, 'search', COL.amber, [1.9, 1.3, .7], .3);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, E = S.eea;
    ghostCar(car);
    S.show('eea', 1); S.show('cabin', .25);
    // 1 职责与位置
    const place = c.p(0, 1, 0, 'end');
    [E.central, ...E.zones].forEach((n, i) => { n.position.y += 1.4 * (1 - stagger(place, i, 5)); });
    Object.values(E.sensors).forEach((s, i) => S.sub(s, c.in(0, 1.4 + (i % 4) * .2)));
    P.roleI.forEach((r, i) => { const k = c.show(0, .2 + i * .3, 1, 0); op(r.b, k); const p = r.n.position; setP(r.b, [p.x, p.y + .3, p.z]); });
    S.sub(E.loom, c.after(2, 0) ? 1 : 0); S.sub(E.screen, c.after(3, 1) ? 1 : 0);
    E.branches.forEach((b, i) => S.sub(b.t, c.after(2, 0) ? 1 : 0)); E.sig.forEach(f => S.sub(f, c.after(2, .5) ? 1 : 0)); S.sub(E.trunkSig, c.after(2, .3) ? 1 : 0);
    Object.values(E.fans).forEach(f => S.sub(f, c.show(3, 0, 4, 0)));
    // 2 连接器：插头沿 +z 推入，针脚插到底（插合面 z=.12）停住；到底前电路是断的，到底后才通（先断后通）
    const cs = c.show(1, 0, 2, 0); op(P.con, cs);
    const push = c.p(1, .9, 1, 1.55), seat = P.seat.userData.travel(push);   // 15.0s 插到底，留 2 秒多给"接通"
    P.plug.position.copy(P.seat.children[0].position);
    const on = seat.contact ? 1 : 0;
    P.pins.forEach((p, i) => op(p, cs * stagger(c.p(1, 0, 1, 1), i, 12) * (.55 + .45 * on)));
    op(P.latch, c.in(1, 1.4, .25)); P.latch.position.y = .2 + .03 * (1 - on);   // 插到底的同一刻锁止片压下
    op(P.seatSig, cs * on); if (on) P.seatSig.userData.update(t, 1);
    // 3 线束
    K.growTube(E.loom, c.p(2, 0, 2, 1)); E.branches.forEach((b, i) => K.growTube(b.t, stagger(c.p(2, .5, 2, 1.6), i, E.branches.length)));
    E.reach = c.lin(2, .5, 2, 'end'); if (c.after(3, 0)) E.reach = 1;
    P.clips.forEach((cl, i) => op(cl, c.show(2, 1.4, 3, 0) * stagger(c.p(2, 1.4, 2, 'end'), i, P.clips.length)));
    op(P.emc, c.show(2, 1.6, 3, 0));
    // 4 感知与座舱
    const tg = c.show(3, 0, 4, 0); op(P.target, tg); P.target.position.x = lerp(11, 7.8, c.p(3, 0, 3, 1)); op(P.box, c.show(3, .7, 4, 0) * (.6 + .4 * Math.sin(t * 8))); P.box.position.x = P.target.position.x - 8.9;
    op(P.net[0], c.show(3, 2, 4, 0)); op(P.net[1], c.show(3, 2.4, 4, 0)); op(P.netL, c.show(3, 2, 4, 0)); P.netL.userData.update(t, 1);
    // 5 在环
    const sim = c.show(4, 0, 5, 0); op(P.track, sim); op(P.dot, sim); op(P.sim, sim);
    const a = t * 1.4; setP(P.dot, [-2.6 + Math.cos(a), .06, 2.4 + Math.sin(a) * .6]); P.dot.rotation.y = -a - Math.PI / 2;
    op(P.bench, c.show(4, 1, 5, 0)); op(P.ecuB, c.show(4, 1, 5, 0)); op(P.hilLoop, c.show(4, 1.5, 5, 0)); P.hilLoop.userData.update(t, c.lin(4, 1.5, 4, 'end')); op(P.okHil, c.show(4, 2.2, 5, 0));
    // 6 安全与诊断
    op(P.fault, c.show(5, 0, 5, 1.2) * (.6 + .4 * Math.sin(t * 10))); op(P.backup, c.show(5, .5)); K.growTube(P.backup, c.p(5, .5, 5, 1));
    if (c.after(5, 0)) E.sig.forEach((f, i) => { if (i === 0) S.sub(f, 0); });
    op(P.attack, c.show(5, 1, 5, 2.4)); P.attack.userData.update(t, 1); op(P.guard, c.show(5, 1.2, 5, 2.6)); P.guard.scale.setScalar(1 + .15 * Math.sin(t * 8));
    op(P.diag, c.show(5, 2)); 
  }
};

// ———————————————————— engineering-4 数字合车、仿真与并行迭代 ————————————————————
export const engineering4 = {
  phases: ['数字合车', '仿真分析', '间隙复核与回改'],
  shots: [
    {title: '专业模型归入整车', detail: '车身、电池、电驱、电子、座舱从四周归位到同一坐标的数字整车'},
    {title: '离散网格与约束', detail: '车身被划成计算网格，车轮处加上约束，材料与边界条件确定'},
    {title: '载荷与响应', detail: '载荷压上车头，色图从蓝到红显示受力，薄弱处被放大变形'},
    {title: '气动、热流与振型', detail: '气流掠过车身；温度场从前到后渐变；车身按振型起伏，颜色只表示方法'},
    {title: '运动间隙', detail: '车轮转向和上下跳动扫过空间，干涉处变红，修正后转绿'},
    {title: '加强与复算', detail: '加一根加强梁后重新计算，红区消退；仿真结果再与试验对照'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 9.4, az: 35, el: 24}],
    [{tg: [.5, .7, 0], r: 6.8, az: 40, el: 22}],
    [{tg: [1.0, .7, 0], r: 6.6, az: 35, el: 18}],
    [{tg: [0, .7, 0], r: 8.6, az: 75, el: 12}, {b: 2, tg: [0, .7, 0], r: 8, az: 40, el: 20}],
    [{tg: [1.3, .5, .4], r: 4.6, az: 40, el: 24}],
    [{tg: [.6, .7, 0], r: 7.4, az: 35, el: 20}]
  ],
  build(K, S, car) {
    const P = {};
    P.axes = [[1, 0, 0, COL.red], [0, 1, 0, COL.green], [0, 0, 1, COL.blue]].map(([x, y, z, col]) => K.add(K.tube([[0, .02, 0], [x, .02 + y, z]], .012, col, {glow: true})));
    P.fix = car.wheelCenters.map(w => { const m = K.add(K.glow(new THREE.ConeGeometry(.08, .14, 3), COL.green, 2.2)); setP(m, [w.x, .07, w.z]); return m; });
    P.force = K.add(K.glow(new THREE.ConeGeometry(.1, .3, 16), COL.red, 2.4)); P.force.rotation.z = Math.PI / 2;
    P.forceL = K.add(K.tube([[3.4, .55, 0], [2.7, .55, 0]], .02, COL.red, {glow: true}));
    P.air = airflow(K, car, 7, COL.cyan);
    P.clash = K.add(K.glow(new THREE.SphereGeometry(.1, 14, 10), COL.red, 2.4, .6)); setP(P.clash, [1.62, .62, .7]);
    P.env = K.add(new THREE.Mesh(new THREE.RingGeometry(.25, .42, 40, 1, -.6, 1.2), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.cyan).multiplyScalar(1.6), transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending}))); P.env.rotation.x = -Math.PI / 2; setP(P.env, [car.wheelCenters[0].x, .03, car.wheelCenters[0].z]);
    P.rib = K.add(K.tube([[2.2, .5, .5], [1.6, .48, .62], [1.1, .34, .74]], .03, COL.green, {glow: true}));
    P.cmp = [['chip', COL.cyan, [2.2, 1.9, -.4]], ['search', COL.amber, [3.3, 1.9, -.4]]].map(([ic, col, p]) => chip(K, ic, col, p, .36));
    P.cmpL = link(K, [2.2, 1.9, -.4], [3.3, 1.9, -.4], COL.white, .2);
    // 数字合车：五个专业组各沿自身装配方向进入同一坐标系，终点=接口面，越过进度只换算成往外的让位
    P.dock = (() => {
      const mk = (dx, dy, dz, push, axis) => land(K, [[dx, dy, dz], [dx * .55, dy * .55, dz * .55], [dx * .16, dy * .16, dz * .16], [0, 0, 0], [-dx * .05, -dy * .05, -dz * .05]], 3, {push, axis});
      return {battery: mk(0, -1.2, 0, 0, 'y'), biw: mk(0, 1.4, 0, 0, 'y'), drive: mk(2, 0, 0, 0, 'x'), eea: mk(0, 0, 2, 0, 'z'), cabin: mk(0, 0, -2, 0, 'z')};
    })();
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, u = car.layers.heat.mat.uniforms;
    // 1 归位：五组各沿自身装配方向合入同一坐标系，到接口面被 stopAt 卡住（不穿透、不穿模）
    const fly = c.p(0, 0, 0, 1.4), dock = k => { P.dock[k].userData.travel(fly); return P.dock[k].children[0].position; };
    ghostCar(car, c.out(1, 0) * .8 + .2);
    S.show('biw', c.show(0, 0, 1, .5)); S.show('battery', c.show(0, 0, 1, .5)); S.show('drive', c.show(0, 0, 1, .5)); S.show('eea', c.show(0, 0, 1, .5) * .7); S.show('cabin', c.show(0, 0, 1, .5) * .6);
    S.battery.g.position.y += dock('battery').y; S.biw.g.position.y += dock('biw').y; S.drive.g.position.x += dock('drive').x; S.eea.g.position.z += dock('eea').z; S.cabin.g.position.z += dock('cabin').z;
    P.axes.forEach(a => { op(a, c.show(0, 1.2, 1, .5)); K.growTube(a, c.p(0, 1.2, 0, 1.8)); });
    // 2 网格
    if (c.after(1, 0)) { car.set('paint', 0); car.set('ghost', 0); car.set('heat', 1); u.uMode.value = 0; u.uLoad.value = .0; car.set('edges', c.show(1, 0, 3, 0) * .9); car.set('points', c.show(1, .5, 2, 0)); }
    car.ptsMat.uniforms.uSize.value = 2.2 + 3.8 * c.show(1, .5, 2, 0);   // 网格点由 2.2 放大到 6，随点云一起收，其余镜头仍是 2.2
    P.fix.forEach(m => op(m, c.show(1, 1, 3, 0)));
    // 3 载荷：载荷压到车头，漆面/油泥跟着同一个 uDeform 真鼓起来（setDeformFollow），后半段再切到受力色图
    const ld = c.p(2, 0, 2, 1.2);
    op(P.force, c.show(2, 0, 3, 0)); op(P.forceL, c.show(2, 0, 3, 0)); setP(P.force, [lerp(3.2, 2.55, ld), .55, 0]);
    if (c.after(2, 0) && !c.after(3, 0)) {
      const skin = c.p(2, 1.55, 2, 1.75) < 1 ? 1 : 0;                 // 前段看漆面鼓包（约 3.5s），后段看云图，避免两层共面闪烁
      u.uLoad.value = ld; u.uCenter.value.set(2.2, .55, 0); u.uRadius.value = 1.4; u.uDeform.value = 3 * c.p(2, .35, 2, 'end');
      car.setDeformScale(.12); car.setDeformFollow(true); car.set('paint', skin); car.set('heat', 1 - skin);
    } else { car.setDeformFollow(false); car.setDeformScale(.08); }
    // 4 气动 热流 振型
    if (c.after(3, 0)) {
      const m = c.lin(3, 0, 3, 'end'); u.uDeform.value = 0;
      if (m < .4) { u.uMode.value = 1; u.uLoad.value = .3; } else if (m < .7) { u.uMode.value = 1; u.uLoad.value = 1; } else { u.uMode.value = 2; u.uLoad.value = 1; u.uDeform.value = 1.5 * Math.sin(t * 6); }
    }
    op(P.air, c.show(3, 0, 3, 1.6)); P.air.userData.update(t, 1);
    // 5 间隙
    if (c.after(4, 0)) { u.uLoad.value = 0; u.uMode.value = 3; car.set('edges', .3); }
    const st = c.show(4, 0, 5, 0); op(P.env, st); car.wheels[0].rotation.y = car.wheels[1].rotation.y = .5 * Math.sin((t - c.T(4, 0)) * 2.2) * st;
    const fixd = c.p(4, 1, 4, 'end');
    op(P.clash, c.show(4, .4, 5, 0) * (.6 + .4 * Math.sin(t * 8))); P.clash.material.color.set(new THREE.Color(fixd > .8 ? COL.green : COL.red).multiplyScalar(2.4));
    // 6 加强复算
    op(P.rib, c.show(5, 0)); K.growTube(P.rib, c.p(5, 0, 5, .8));
    if (c.after(5, 0)) { u.uMode.value = 0; u.uCenter.value.set(2.2, .55, 0); u.uRadius.value = 1.4; u.uLoad.value = lerp(1, .35, c.p(5, .8, 5, 1.6)); }
    P.cmp.forEach((m, i) => op(m, c.show(5, 1.6 + i * .3))); op(P.cmpL, c.show(5, 1.8)); K.drawLine(P.cmpL, c.p(5, 1.8, 5, 'end'));
  }
};

// ———————————————————— engineering-5 受控发布与软硬件版本配套 ————————————————————
export const engineering5 = {
  phases: ['汇总数据包', '图纸与物料核对', '软件配置与发布'],
  shots: [
    {title: '汇入工程数据包', detail: '模型、图纸、技术说明从各专业飞入同一个数据包，版本环把它们锁成一组'},
    {title: '基准尺寸公差', detail: '基准点、尺寸线与公差带标在整车上，用于制造、测量和装配检查'},
    {title: '物料与模型对应', detail: '物料清单逐项连到车上零件；有一项还指向旧零件，被标出后更新'},
    {title: '软件版本配套', detail: '各控制器写入对应软件与标定，版本环与硬件一一配对'},
    {title: '发布前复核', detail: '完整性、风险、问题状态逐项打勾；遗留项挂上负责人'},
    {title: '交接试制', detail: '受控工程包送到试制工位，后续变更沿追溯线持续跟踪'}
  ],
  cams: [
    [{tg: [.6, .9, 0], r: 9.6, az: 30, el: 16}],
    [{tg: [0, .7, 0], r: 8.2, az: 60, el: 16}],
    [{tg: [.4, .9, 0], r: 9.4, az: 30, el: 18}],
    [{tg: [0, .6, 0], r: 7.6, az: 40, el: 30}],
    [{tg: [.6, 1.0, 0], r: 9.4, az: 28, el: 14}],
    [{tg: [-1, .7, 0], r: 10.4, az: 35, el: 20}]
  ],
  build(K, S, car) {
    const P = {}, A = axes(30);
    P.pkg = chip(K, 'box', COL.cyan, A.at([0, 1.6, 0], 3.2, -.6), .6);
    P.srcs = [['chip', COL.cyan], ['doc', COL.white], ['book', COL.amber]].map(([ic, col], i) => { const p = A.at([0, 2.4, 0], -2.4 + i * 1.6, -1.6); return {b: chip(K, ic, col, p, .36), p}; });
    P.ver = K.add(K.ring(.5, COL.green, .014)); setP(P.ver, P.pkg.position.toArray()); P.ver.rotation.y = A.ry;
    P.datum = [[2.3, .5, 0], [-2.3, .55, 0], [0, .1, .9]].map(p => Object.assign(hardpoint(K, p, COL.amber, .06), {userData: {home: p}}));
    // 基准点从上方落到车表（落点=基准面，stopAt 卡住）；版本环扣到控制器顶面（y+.08）；数据包/图钉落到基线台面
    P.datumSeed = land(K, [[0, .3, 0], [0, .16, 0], [0, 0, 0], [0, -.02, 0]], 2, {push: 0, axis: 'y'});
    P.ringSeed = land(K, [[0, .3, 0], [0, .14, 0], [0, 0, 0], [0, -.018, 0]], 2, {push: 0, axis: 'y'});
    const bb = car.bbox; P.dims = [dim(K, [bb.min.x, .05, 1.2], [bb.max.x, .05, 1.2]), dim(K, [car.wheelCenters[2].x, .05, 1.4], [car.wheelCenters[0].x, .05, 1.4], COL.amber)];
    P.tol = K.add(new THREE.Mesh(new THREE.TubeGeometry(K.curve(car.profile.filter((b, i) => i % 3 === 0).map(b => [b.x, b.top, .95])), 80, .03, 6), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(1.4), transparent: true, opacity: .3, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending})));
    const items = [[S.battery.x0, .3, 0], [car.wheelCenters[2].x, .35, 0], [.08, .55, .37], [.35, .5, 0], [1.75, .6, .4]];
    P.bom = items.map((tgt, i) => { const p = A.at([0, 2.4 - i * .32, 0], -3.4, -.4); const tile = K.add(K.holoBox(.7, .2, .04, COL.cyan, .2, 1)); setP(tile, p); tile.rotation.y = A.ry; return {tile, l: link(K, [p[0] + .3, p[1], p[2]], tgt, COL.cyan, .1), p}; });
    P.oldL = link(K, P.bom[2].p, [3.4, .4, -1.2], COL.amber, .2, true); P.oldPart = K.add(K.holoBox(.4, .3, .3, COL.red, .1, 1)); setP(P.oldPart, [3.4, .4, -1.2]);
    P.verRings = [S.eea.central, ...S.eea.zones].map(n => { const r = K.add(K.ring(.13, COL.violet, .01)); r.rotation.x = Math.PI / 2; return {r, n}; });
    P.cal = chip(K, 'gear', COL.violet, [.35, 1.3, 0], .32);
    P.list = [0, 1, 2, 3, 4].map(i => { const p = A.at([0, 2.3 - i * .36, 0], -3.2, -.6); return {row: (() => { const r = K.add(K.holoBox(1.4, .22, .04, COL.white, .12, .9)); setP(r, p); r.rotation.y = A.ry; return r; })(), ok: chip(K, i === 3 ? 'user' : 'check', i === 3 ? COL.amber : COL.green, A.at(p, .9), .22)}; });
    P.bay = K.add(new THREE.Group()); P.bayRing = K.add(K.group(K.ring(.8, COL.amber, .012))); P.bayRing.children[0].rotation.x = -Math.PI / 2; setP(P.bayRing, [-4.2, .02, -1.6]);
    // 交接落位：数据包与图钉沿竖直路径落到基线台面（y=.34 / .12），落点由 stopAt 卡住，落定后压 .05
    P.land = land(K, [P.pkg.position.toArray(), [-4.2, 1.5, -1.6], [-4.2, .34, -1.6], [-4.2, -.6, -1.6]], 2, {push: 0, axis: 'y'});
    P.pin = K.add(K.glow(new THREE.ConeGeometry(.03, .18, 10), COL.amber, 2.8)); P.pin.rotation.x = Math.PI; setP(P.pin, [-4.2, 1.15, -1.6]);
    P.pinLand = land(K, [[-4.2, 1.15, -1.6], [-4.2, .7, -1.6], [-4.2, .12, -1.6], [-4.2, .07, -1.6]], 2, {push: 0, axis: 'y'});
    P.bayShadow = K.add(K.shadowPatch(.7, .5)); setP(P.bayShadow, [-4.2, .012, -1.6]);
    P.trace = link(K, [-4.2, .3, -1.6], [-1.2, .8, 0], COL.amber, .6, true);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // 1 数据包
    P.srcs.forEach((s, i) => { const k = stagger(c.p(0, .3, 0, 'end'), i, 3); op(s.b, c.show(0, 0, 1, 0) * (1 - k * .9)); setP(s.b, mixV(s.p, P.pkg.position.toArray(), k)); });
    op(P.pkg, c.show(0, .5)); op(P.ver, c.show(0, 1.6, 1, .5)); P.ver.scale.setScalar(1 + .2 * c.pulse(0, 1.6, 1));
    // 2 基准尺寸公差：基准点沿竖直方向落到车表，落点被 stopAt 卡在基准面；公差带沿车顶轮廓扫开
    P.datum.forEach((d, i) => { const k = stagger(c.p(1, 0, 1, .8), i, 3); P.datumSeed.userData.travel(k); const p = d.userData.home; op(d, c.show(1, 0, 2, 0) * k); setP(d, [p[0], p[1] + P.datumSeed.children[0].position.y, p[2]]); });
    P.dims.forEach((d, i) => op(d, c.show(1, .6, 2, 0)));
    op(P.tol, c.show(1, 1.2, 2, 0)); K.growTube(P.tol, c.p(1, 1.2, 1, 'end'));
    // 3 物料
    const bomK = c.show(2, 0, 3, 0);
    if (bomK > 0) { ghostCar(car, bomK * .9); S.show('battery', bomK); S.show('drive', bomK); S.show('cabin', bomK * .7); S.show('eea', bomK * .7); }
    P.bom.forEach((b, i) => { const k = stagger(c.p(2, 0, 2, 1.2), i, 5); op(b.tile, bomK * k); op(b.l, bomK * k); K.drawLine(b.l, k); });
    const stale = c.show(2, 1.2, 2, 2.2); op(P.oldL, stale); op(P.oldPart, stale);
    P.bom[2].tile.userData.edge.material.color.set(new THREE.Color(stale > .3 ? COL.red : COL.cyan).multiplyScalar(1.6));
    // 4 软件：版本环从上方扣到各控制器顶面，扣到位被 stopAt 卡住（环与硬件一一配对）
    const sw = c.show(3, 0, 4, 0);
    if (sw > 0) { ghostCar(car, sw); S.show('eea', sw); S.eea.reach = 1; }
    P.verRings.forEach((v, i) => { const k = stagger(c.p(3, .3, 3, 1.4), i, 5); op(v.r, sw * k); P.ringSeed.userData.travel(k); const p = v.n.position; setP(v.r, [p.x, p.y + .08 + P.ringSeed.children[0].position.y, p.z]); });
    op(P.cal, c.show(3, 1.4, 4, 0)); P.cal.rotation && (P.cal.material.rotation = t * 2);
    // 5 复核
    P.list.forEach((r, i) => { const k = stagger(c.p(4, 0, 4, 'end'), i, 5); op(r.row, c.show(4, 0, 5, 0) * Math.min(1, k * 3)); op(r.ok, c.show(4, 0, 5, 0) * k); });
    // 6 交接：数据包与图钉沿竖直路径落到基线台面（stopAt 卡在台面），落定瞬间轴向压缩 .05 表示压实
    const mv = c.p(5, 0, 5, 1.2), seat = P.land.userData.travel(mv);
    if (c.after(5, 0)) { setP(P.pkg, P.land.children[0].position.toArray()); P.pkg.scale.set(.6, .6 * (1 - .05 * seat.over), 1); }
    P.pinLand.userData.travel(c.p(5, .5, 5, 1.4)); setP(P.pin, P.pinLand.children[0].position.toArray());
    op(P.pin, c.show(5, .5)); op(P.bayShadow, c.show(5, .2) * (.4 + .35 * seat.over));
    op(P.bayRing, c.show(5, .4)); op(P.trace, c.show(5, 1)); K.drawLine(P.trace, c.p(5, 1, 5, 'end'));
  }
};
