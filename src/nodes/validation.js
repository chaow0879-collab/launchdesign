// 第 7 阶段：试制与验证闭环
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, stagger, axes, dim, hardpoint, docStack, robotArm, cad, THREE} from './lib.js';
const ghostCar = (car, k = 1) => { car.set('paint', 1 - k); car.set('ghost', k); };
const A = axes(32);
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

function rollers(K, car) {
  const g = new THREE.Group(); const rs = [];
  car.wheelCenters.forEach(w => { const r = K.solid(new THREE.CylinderGeometry(.18, .18, .42, 28), 0x7d8b96, {metal: .8, rough: .3}); r.rotation.x = Math.PI / 2; r.position.set(w.x, -.0, w.z); g.add(r); rs.push(r); const rr = K.ring(.19, COL.cyan, .006); rr.position.set(w.x, 0, w.z + Math.sign(w.z) * .22); g.add(rr); });
  const pit = K.holoBox(4.0, .05, 2.2, COL.white, .05, .7); pit.position.y = -.02; g.add(pit);
  g.userData.rs = rs; return K.add(g);
}

export const validation1 = {
  phases: ['进件与定位', '举升与落位', '上电与记录'],
  shots: [
    {title: '进件检查', detail: '电池、电驱、座椅等样件推进工位，逐件扫描核对版本与状态'},
    {title: '定位与校准', detail: '车身落在工装上，定位销升起插入基准孔，激光线校准工装本身'},
    {title: '底部总成举升', detail: '举升台把电池与电驱从下方送入车身，靠近时检查干涉和工具空间'},
    {title: '座舱装配', detail: '座椅、仪表板依次落位，紧固顺序与间隙问题被记录下来'},
    {title: '接线与通电', detail: '线束接通后按安全规程上电，屏幕与车灯依次亮起，功能检查开始'},
    {title: '装配结果回查', detail: '每个问题挂在具体零件、版本和工位上，供相关专业复现与闭环'}
  ],
  cams: [
    [{tg: [-.5, .6, .8], r: 9.6, az: 40, el: 20}],
    [{tg: [0, .6, 0], r: 7.4, az: 40, el: 22}],
    [{tg: [0, .3, 0], r: 6.8, az: 30, el: 6}],
    [{tg: [.2, .7, 0], r: 6.6, az: 50, el: 34}],
    [{tg: [.5, .7, 0], r: 7.4, az: 30, el: 14}],
    [{tg: [0, .8, 0], r: 9, az: 35, el: 20}]
  ],
  build(K, S, car) {
    const P = {};
    P.carts = [['battery', COL.teal, -3.4], ['gear', COL.blue, -1.6], ['seat', COL.amber, .2]].map(([ic, col, al]) => { const p = A.at([0, 0, 0], al, 2.8); const cart = K.add(K.holoBox(1.0, .35, .7, col, .1, .9)); setP(cart, [p[0], .2, p[2]]); return {cart, b: chip(K, ic, col, [p[0], .75, p[2]], .32), ok: chip(K, 'check', COL.green, [p[0] + .35, .75, p[2]], .22), scan: (() => { const r = K.add(K.ring(.55, COL.cyan, .01)); r.rotation.x = -Math.PI / 2; setP(r, [p[0], .2, p[2]]); return r; })(), p}; });
    P.jig = K.add(new THREE.Group()); [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].forEach(([x, z]) => { const post = K.holoBox(.12, .3, .12, COL.cyan, .2, 1); post.position.set(x, .15, z); P.jig.add(post); });
    P.pins = [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].map(([x, z]) => { const p = K.add(K.glow(new THREE.CylinderGeometry(.025, .025, .14, 10), COL.amber, 2.4)); setP(p, [x, .32, z]); return p; });
    // 定位销从孔底升起插进基准孔（插到底 y=.32 由 stopAt 卡住）；车身随后落到工装面；电池/电驱从下方举升到地板接口面
    P.pinS = land(K, [[0, -.18, 0], [0, -.09, 0], [0, 0, 0], [0, .018, 0]], 2, {push: 0, axis: 'y'});
    P.bodyS = land(K, [[0, .22, 0], [0, .12, 0], [0, 0, 0], [0, -.02, 0]], 2, {push: 0, axis: 'y'});
    P.liftS = land(K, [[0, -.7, 0], [0, -.4, 0], [0, -.06, 0], [0, 0, 0], [0, .02, 0]], 3, {push: 0, axis: 'y'});
    P.gShadow = K.add(K.shadowPatch(1.7, .45)); setP(P.gShadow, [0, .012, 0]);
    P.laser = [.7, -.7].map(z => K.add(K.glow(new THREE.BoxGeometry(5, .004, .004), COL.red, 3, .9))).map((l, i) => { setP(l, [0, .35, i ? -.7 : .7]); return l; });
    P.lift = K.add(K.holoBox(2.6, .06, 1.3, COL.amber, .2, 1));
    P.liftPost = K.add(K.holoBox(.2, 1, .2, COL.amber, .1, .8));
    P.clash = chip(K, 'warn', COL.amber, [1.2, .9, .8], .26);
    P.recs = [[.08, 1.0, .37], [.88, 1.1, 0]].map(p => chip(K, 'doc', COL.white, [p[0], p[1] + .3, p[2]], .24));
    P.power = chip(K, 'bolt', COL.amber, [0, 1.7, 0], .38);
    P.tags = [[S.battery.x0, .5, .7, 'battery', COL.teal], [-1.39, .7, .6, 'gear', COL.blue], [.1, 1.0, .5, 'seat', COL.amber]].map(([x, y, z, ic, col]) => ({b: chip(K, ic, col, [x, y + .5, z], .26), h: hardpoint(K, [x, y, z], col, .04)}));
    P.doc = docStack(K, 4, COL.white, .36, .46); setP(P.doc, A.at([0, .02, 0], 3, -.6));
    P.docL = P.tags.map(tg => link(K, tg.b.position.toArray(), [P.doc.position.x, .3, P.doc.position.z], COL.white, .3, true));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    ghostCar(car, c.out(4, 1) * .85 + .15);
    // 1 进件
    P.carts.forEach((ct, i) => { const k = stagger(c.p(0, 0, 0, 1.2), i, 3); const live = c.out(2, 0); op(ct.cart, k * live); op(ct.b, k * live); ct.cart.position.x += -2 * (1 - k); ct.b.position.x += -2 * (1 - k);
      const sk = stagger(c.p(0, 1.2, 0, 'end'), i, 3); op(ct.scan, c.show(0, 1.2, 1, 0) * K.pulse(sk)); ct.scan.scale.setScalar(.6 + .6 * sk); op(ct.ok, c.show(0, 1.2, 2, 0) * (sk > .9 ? 1 : 0)); });
    // 2 工装
    S.show('biw', c.show(1, 0) * .9);
    // 定位销先插进基准孔（stopAt 卡在孔底），全部插到底后车身才落座、下沉到工装面
    op(P.jig, c.show(1, 0, 4, 0));
    let pinIn = 1;
    P.pins.forEach((p, i) => { const k = stagger(c.p(1, .5, 1, 1.4), i, 4); P.pinS.userData.travel(k); op(p, c.show(1, .5, 4, 0)); setP(p, [p.position.x, .32 + P.pinS.children[0].position.y, p.position.z]); pinIn = Math.min(pinIn, k); });
    P.bodyS.userData.travel(ease(clamp((c.p(1, .5, 1, 'end') - .45) / .45)));   // 四销全插到底后车身才落座
    car.root.position.y = (c.after(1, 0) ? 1 : 0) * P.bodyS.children[0].position.y;
    op(P.gShadow, c.show(1, 0, 4, 0) * (.95 - .55 * pinIn));
    P.laser.forEach(l => { op(l, c.show(1, 1.4, 2, .5)); l.scale.x = c.p(1, 1.4, 1, 'end'); });
    // 3 举升
    const lift = c.p(2, 0, 2, 2.2);
    S.show('battery', c.show(2, 0)); S.show('drive', c.show(2, 0)); S.show('chassis', c.show(2, 0) * .8);
    S.battery.g.position.y += (P.liftS.userData.travel(lift), P.liftS.children[0].position.y);      // 举升到地板接口面被 stopAt 卡住
    S.drive.g.position.y += (P.liftS.userData.travel(c.p(2, .4, 2, 2.4)), P.liftS.children[0].position.y);
    op(P.lift, c.show(2, 0, 3, 0)); setP(P.lift, [S.battery.x0, S.battery.g.position.y + .08, 0]);
    op(P.liftPost, c.show(2, 0, 3, 0)); P.liftPost.scale.y = Math.max(.05, S.battery.g.position.y + .45); setP(P.liftPost, [S.battery.x0, (S.battery.g.position.y - .45) / 2 + .02, 0]);
    op(P.clash, c.pulse(2, 1.4, 1.6));
    // 4 座舱
    S.show('cabin', c.show(3, 0));
    S.cabin.seats.forEach((s, i) => s.position.y += 1.3 * (1 - stagger(c.p(3, 0, 3, 1.4), i, 3)));
    S.cabin.dash.position.y += 1.3 * (1 - c.p(3, .8, 3, 1.8));
    P.recs.forEach((r, i) => op(r, c.show(3, 1.5 + i * .4, 4, 0)));
    // 5 通电
    S.show('eea', c.show(4, 0)); S.eea.reach = c.lin(4, .3, 4, 1.4); S.show('hv', c.show(4, 1));
    op(P.power, c.show(4, 1, 5, 0)); S.sub(S.eea.screen, c.after(4, 1.3) ? 1 : 0);
    if (c.after(4, 1.5)) { car.set('paint', 1); car.set('ghost', 0); core(K).bloom.strength = .5; }
    // 6 回查
    P.tags.forEach((tg, i) => { const k = c.show(5, 0) * stagger(c.p(5, 0, 5, 1), i, 3); op(tg.b, k); op(tg.h, k); });
    op(P.doc, c.show(5, 1)); P.docL.forEach((l, i) => { op(l, c.show(5, 1)); K.drawLine(l, stagger(c.p(5, 1, 5, 'end'), i, 3)); });
    if (c.after(5, 0)) { ghostCar(car, .7); S.show('battery', .9); S.show('drive', .8); S.show('cabin', .6); }
  }
};
const core = K => K.core;

// ———————————————————— validation-2 并行验证续航、安全与智能功能 ————————————————————
export const validation2 = {
  phases: ['试验条件与测点', '台架与场景测试', '多项验证与证据'],
  shots: [
    {title: '建立试验条件', detail: '样车开上滚轮台架，配置被核对，安全边界在地面画出'},
    {title: '布置测点与采集', detail: '测点贴在电池、电驱和车身关键位置，线缆汇到采集设备'},
    {title: '滚轮台架运行', detail: '车轮与滚轮同步转动，能量流和电池温度随工况变化'},
    {title: '场景测试', detail: '前方目标出现，驾驶辅助扇区响应、制动；座舱和网联功能同时检查'},
    {title: '耐久碰撞环境防水', detail: '振动、碰撞、冷热、淋雨四类验证依次进行，数据与仿真预测对照'},
    {title: '形成认证证据', detail: '按适用法规整理可追溯证据，形成报告；动画不代表该车实际成绩'}
  ],
  cams: [
    [{tg: [0, .5, 0], r: 9.2, az: 35, el: 20}],
    [{tg: [0, .6, 0], r: 7.2, az: 45, el: 26}],
    [{tg: [.2, .4, 0], r: 6.4, az: 60, el: 10}],
    [{tg: [3, .6, 0], r: 10, az: 30, el: 18}],
    [{tg: [0, .7, 0], r: 8.6, az: 40, el: 16}],
    [{tg: [0, .9, 0], r: 9.6, az: 30, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    P.rol = rollers(K, car);
    P.safe = K.add(K.line(Array.from({length: 65}, (_, i) => { const a = i / 64 * Math.PI * 2; return [Math.cos(a) * 3.6, .02, Math.sin(a) * 2.2]; }), COL.amber, .9, true));
    P.cfg = chip(K, 'doc', COL.white, [0, 1.9, 0], .34);
    P.pts = [[S.battery.x0 + .5, .28, .7], [-1.39, .45, .5], [1.48, .45, .5], [2.2, .7, .5], [0, 1.2, .8], [-1.8, .9, .7]].map(p => hardpoint(K, p, COL.green, .04));
    P.daq = K.add(K.holoBox(.6, .4, .4, COL.white, .1, 1)); setP(P.daq, A.at([0, .2, 0], 0, 2.3));
    P.cables = P.pts.map(h => link(K, h.position.toArray(), [P.daq.position.x, .4, P.daq.position.z], COL.green, .2));
    // 采样波形 + 校准/量程徽章：让"测量范围、校准状态与采样方法"有对象可落（确定性正弦，无 random）
    P.wave = K.add(K.line(Array.from({length: 33}, (_, i) => [-.3 + i * .01875, .1 * Math.sin(i * .62) + .05 * Math.sin(i * 1.7 + 1.1), 0]), COL.green, .9)); setP(P.wave, [P.daq.position.x, .64, P.daq.position.z]);
    P.cal = chip(K, 'ruler', COL.white, [P.daq.position.x - .42, .52, P.daq.position.z], .26); P.calOk = chip(K, 'check', COL.green, [P.daq.position.x + .42, .52, P.daq.position.z], .22);
    P.energy = K.add(K.flow([[S.battery.x0, .3, .2], [-.8, .35, .2], [-1.39, .4, 0]], {color: COL.amber, n: 14, size: 6, speed: 1.2}));
    P.tgt = K.add(K.holoBox(1.6, 1.2, 1.5, COL.amber, .1, 1));
    P.box = K.add(K.line([[0, 1.3, .85], [0, 1.3, -.85], [0, -.05, -.85], [0, -.05, .85], [0, 1.3, .85]], COL.green, 1));
    P.brake = chip(K, 'warn', COL.red, [2.6, 1.6, 0], .3); P.ok = chip(K, 'check', COL.green, [2.6, 1.6, 0], .3);
    P.shake = chip(K, 'sound', COL.white, [0, 2.0, 0], .36); P.crash = chip(K, 'crash', COL.red, [2.5, 1.2, 0], .4);
    P.barrier = K.add(K.holoBox(.4, 1.0, 2.2, COL.red, .15, 1)); setP(P.barrier, [2.75, .5, 0]);
    P.snow = chip(K, 'snow', COL.cyan, [-.6, 2.0, 0], .34); P.sun = chip(K, 'thermo', COL.amber, [.6, 2.0, 0], .34);
    // 雨滴：种子用确定性哈希（无 random，任意 t 采样同一滴在同一位置），x∈±2.3 / z∈±1
    P.rain = K.add(new THREE.Group()); P.drops = []; const hs = i => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < 70; i++) { const d = K.glow(new THREE.BoxGeometry(.008, .12, .008), COL.blue, 2.2, .8); d.userData.seed = [hs(i) * 4.6 - 2.3, hs(i + 7), hs(i + 13) * 2 - 1]; P.rain.add(d); P.drops.push(d); }
    P.cmp = [['chip', COL.cyan, A.at([0, 2.1, 0], 2.4, -.6)], ['search', COL.green, A.at([0, 2.1, 0], 3.4, -.6)]].map(([ic, col, p]) => chip(K, ic, col, p, .34));
    P.doc = docStack(K, 5, COL.white, .4, .52); setP(P.doc, A.at([0, .02, 0], -3.0, -.6));
    // 报告从上方落到台面：落点=台面（stopAt 卡住，越界不再下沉），纸页随后摊开、法规与印章落定
    P.docSeed = land(K, [[0, .6, 0], [0, .3, 0], [0, 0, 0], [0, -.04, 0]], 2, {push: 0, axis: 'y'});
    P.law = chip(K, 'law', COL.violet, A.at([0, 1.2, 0], -3.0, -.6), .4); P.stamp = chip(K, 'stamp', COL.green, A.at([0, 1.2, 0], -2.0, -.6), .36);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // 1 条件
    op(P.rol, c.show(0, 0, 3, 0)); car.root.position.y = .0;
    op(P.safe, c.show(0, 1, 3, 0)); K.drawLine(P.safe, c.p(0, 1, 0, 2)); op(P.cfg, c.show(0, .6, 1, 0));
    car.root.position.x = lerp(-3, 0, c.p(0, 0, 0, .8)); car.spin(-car.root.position.x / car.wheelR);
    // 2 测点
    const m = c.show(1, 0, 3, 0);
    if (m > 0) { car.set('paint', .25); car.set('ghost', .8); S.show('battery', m); S.show('drive', m * .8); }
    P.pts.forEach((h, i) => op(h, m * stagger(c.p(1, 0, 1, 1), i, 6)));
    op(P.daq, c.show(1, .8, 3, 0)); P.cables.forEach((l, i) => { op(l, c.show(1, 1, 3, 0)); K.drawLine(l, stagger(c.p(1, 1, 1, 'end'), i, 6)); });
    op(P.wave, c.show(1, 1.2, 3, 0)); op(P.cal, c.show(1, 1.3, 3, 0)); op(P.calOk, c.show(1, 1.5, 3, 0));
    // 3 台架
    // 滚筒与轮胎线速度一致：ω滚筒 = ω轮 × R轮 / R滚筒（R滚筒=.18，见 rollers()）
    const run = c.show(2, 0, 3, 0), ang = (t - c.T(2, 0)) * 9, rAng = ang * car.wheelR / .18;
    if (run > 0) { car.spin(ang); P.rol.userData.rs.forEach(r => r.rotation.y = -rAng); S.battery.modules.forEach((mm, i) => mm.userData.top.material.color.set(new THREE.Color().lerpColors(new THREE.Color(COL.teal), new THREE.Color(COL.orange), c.p(2, 1, 2, 'end') * (.4 + .6 * ((i * 7) % 5) / 5)).multiplyScalar(1.4))); }
    op(P.energy, run); P.energy.userData.update(t, 1);
    // 4 场景
    const sc = c.show(3, 0, 4, 0);
    if (sc > 0) { car.spin(t * 6); S.show('eea', sc); Object.values(S.eea.fans).forEach(f => S.sub(f, 1)); }
    op(P.tgt, sc); setP(P.tgt, [lerp(10, 5.2, c.p(3, 0, 3, 1.2)), .6, 0]); op(P.box, c.show(3, .5, 4, 0)); P.box.position.x = P.tgt.position.x - .85;
    op(P.brake, c.show(3, .8, 3, 1.6)); op(P.ok, c.show(3, 1.6, 4, 0)); S.sub(S.eea.screen, 1);
    // 5 四类验证
    const v = c.lin(4, 0, 4, 'end'), q = Math.floor(v * 4), on = c.show(4, 0, 5, 0);
    op(P.shake, on * (q === 0 ? 1 : 0)); if (on && q === 0) { car.root.position.y = .03 * Math.sin(t * 28); }
    op(P.crash, on * (q === 1 ? 1 : 0)); op(P.barrier, on * (q === 1 ? 1 : 0)); if (on && q === 1) { const u = car.layers.heat.mat.uniforms; car.set('heat', .8); u.uMode.value = 0; u.uLoad.value = 1; u.uCenter.value.set(2.3, .5, 0); u.uRadius.value = .9; u.uDeform.value = 2; car.set('paint', .2); }
    op(P.snow, on * (q === 2 ? 1 : 0)); op(P.sun, on * (q === 2 ? 1 : 0)); if (on && q === 2) core(K).key.color.set(Math.sin(t * 2) > 0 ? 0x9fd4ff : 0xffb070);
    // 雨滴：车体投影内把下落的下限钳到车表高度（car.heightAt 面 + 半滴长 .06），车外落到地面 —— 雨滴停在车表，不穿车身
    const surf = (x, z) => (x > car.bbox.min.x && x < car.bbox.max.x && Math.abs(z) < car.bbox.max.z) ? car.heightAt(x, z) + .06 : .06;
    op(P.rain, on * (q === 3 ? 1 : 0)); P.drops.forEach(d => { const [x, ph, z] = d.userData.seed; d.position.set(x, Math.max(2.4 - ((t * 1.6 + ph) % 1) * 2.34, surf(x, z)), z); });
    P.cmp.forEach((m2, i) => op(m2, c.show(4, 1.5 + i * .3, 5, 1)));
    // 6 证据
    op(P.doc, c.show(5, 0)); P.docSeed.userData.travel(c.p(5, 0, 5, .9)); P.doc.position.y = .02 + P.docSeed.children[0].position.y; P.doc.userData.sheets.forEach((s, i) => s.position.y = i * .04 * stagger(c.p(5, 0, 5, 1), i, 5) + .02);
    op(P.law, c.show(5, .5)); op(P.stamp, c.show(5, 1.2)); P.stamp.scale.setScalar(.36 * (1 + .4 * c.pulse(5, 1.2, .8)));
  }
};

// ———————————————————— validation-3 定位根因、修改并回归 ————————————————————
export const validation3 = {
  phases: ['记录与诊断', '验证假设并修复', '复测与关闭'],
  shots: [
    {title: '定位问题区域', detail: '问题点被标在车上，现象、工况和位置一起记录下来'},
    {title: '诊断信号链路', detail: '沿信号链路逐段排查，区分部件、接口还是软件标定的问题'},
    {title: '拆开检查', detail: '可疑部件取出展开，逐一验证原因假设，排除只看表面的判断'},
    {title: '修复并评估影响', detail: '改进件装回；对其他系统、法规和版本配置的影响逐项连线确认'},
    {title: '复测与回归', detail: '在可比较的条件下复测，绿色检查扫过各系统，没有新问题'},
    {title: '闭环归档', detail: '问题单关联证据与变更，满足关闭条件后闭环，经验沉淀下来'}
  ],
  cams: [
    [{tg: [.8, .7, 0], r: 7.4, az: 40, el: 18}],
    [{tg: [.5, .7, 0], r: 7.4, az: 40, el: 32}],
    [{tg: [1.7, 1.2, .5], r: 4.4, az: 45, el: 22}],
    [{tg: [.8, .9, 0], r: 7.4, az: 35, el: 22}],
    [{tg: [0, .7, 0], r: 8.6, az: 40, el: 18}],
    [{tg: [0, .9, 0], r: 9, az: 30, el: 18}]
  ],
  build(K, S, car) {
    const P = {}, z0 = S.eea.zones[0];
    P.mark = K.add(K.ring(.2, COL.red, .012)); P.mark.rotation.x = -Math.PI / 2;
    P.rec = [['eye', COL.white], ['gear', COL.cyan], ['flag', COL.amber]].map(([ic, col], i) => chip(K, ic, col, [1.2 + i * .45, 1.55, .6], .26));
    P.cats = [['box', COL.white], ['link', COL.cyan], ['chip', COL.violet]].map(([ic, col], i) => chip(K, ic, col, A.at([0, 2.0, 0], (i - 1) * 1.0, -.6), .34));
    P.trace = K.add(K.tube([[.35, .5, 0], [1.0, .55, .2], [1.7, .62, .4], [2.12, .5, .72]], .02, COL.amber, {glow: true}));
    P.part = K.add(new THREE.Group()); const shell = K.holoBox(.3, .12, .24, COL.amber, .15, 1); const lid = K.holoBox(.3, .02, .24, COL.amber, .2, 1); const board = K.holoBox(.24, .01, .18, COL.green, .3, 1); P.part.add(shell, lid, board); P.part.userData = {...P.part.userData, lid, board};
    P.hyp = [['cross', COL.red], ['cross', COL.red], ['check', COL.green]].map(([ic, col], i) => chip(K, ic, col, [1.4 + i * .4, 1.75, .5], .24));
    P.newPart = K.add(K.holoBox(.18, .07, .14, COL.green, .3, 1));
    P.imp = [['gear', COL.blue], ['law', COL.violet], ['link', COL.cyan]].map(([ic, col], i) => { const p = A.at([0, 2.0, 0], (i - 1) * 1.3, -.8); return {b: chip(K, ic, col, p, .32), l: link(K, [1.7, .7, .4], p, col, .2)}; });
    P.sweep = K.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(1.4), transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false}))); P.sweep.rotation.y = Math.PI / 2;
    P.oks = [[2.0, 1.3, .6], [0, 1.6, .6], [-1.6, 1.3, .6]].map(p => chip(K, 'check', COL.green, p, .26));
    P.loop = chip(K, 'loop', COL.green, [0, 2.0, 0], .46); P.book = chip(K, 'book', COL.amber, A.at([0, 1.2, 0], 2.8, -.6), .4);
    P.doc = docStack(K, 4, COL.white, .34, .44); setP(P.doc, A.at([0, .02, 0], -2.8, -.6));
    P._z = z0.position.clone();
    // 故障件沿装配反方向（+y）拔出，拔到位由 stopAt 卡住；新件沿同一轴线装入，到装配面停住
    const zp = P._z;
    P.pullS = land(K, [[zp.x, zp.y, zp.z], [zp.x, zp.y + .32, zp.z], [zp.x, zp.y + .62, zp.z], [zp.x, zp.y + .78, zp.z]], 2, {push: 0, axis: 'y'});
    P.seatS = land(K, [[zp.x, zp.y + .6, zp.z], [zp.x, zp.y + .3, zp.z], [zp.x, zp.y + .04, zp.z], [zp.x, zp.y, zp.z], [zp.x, zp.y - .04, zp.z]], 3, {push: 0, axis: 'y'});
    // 复测表：表盘（带合格区刻线）+ 指针，指针从红区 -70° 扫回合格区 0°
    P.dial = K.add(K.group(K.ring(.24, COL.white, .007), K.line([[0, .05, 0], [0, .2, 0]], COL.green, .9))); setP(P.dial, [1.55, 1.85, .6]); P.dial.rotation.y = A.ry;
    P.needle = K.add(K.glow(new THREE.BoxGeometry(.016, .26, .016), COL.amber, 2.6)); P.needle.geometry.translate(0, .13, 0); setP(P.needle, [1.55, 1.85, .6]); P.needle.rotation.y = A.ry;
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, zp = P._z;
    ghostCar(car, .85 * (1 - c.p(5, 0, 5, 1) * .7));
    S.show('eea', 1); S.eea.reach = 1; S.show('battery', .5); S.show('drive', .5);
    // 标记环从上方落到问题件顶面：落点=件顶 +.06（落定后不再下沉，只做呼吸脉冲），"在哪儿"因此落在具体位置上
    const mk = c.p(0, 0, 0, 1.1);
    op(P.mark, c.show(0, 0, 3, 0) * (.6 + .4 * Math.sin(t * 7))); setP(P.mark, [zp.x, zp.y + .06 + .6 * (1 - mk), zp.z]); P.mark.scale.setScalar(1 + .3 * c.pulse(0, 0, 1.2));
    P.rec.forEach((r, i) => op(r, c.show(0, .5 + i * .4, 1, 1)));
    // 2 诊断
    op(P.trace, c.show(1, 0, 2, 0)); K.growTube(P.trace, c.p(1, 0, 1, 1.2));
    P.cats.forEach((ct, i) => op(ct, c.show(1, 1, 2, 0) * stagger(c.p(1, 1, 1, 'end'), i, 3)));
    // 3 拆开
    const out = c.p(2, 0, 2, .8), open = c.p(2, .8, 2, 1.4);
    S.sub(S.eea.zones[0], 1 - c.show(2, 0, 3, .5));
    // 沿装配反方向把故障件拔出：拔到位被 stopAt 卡住（之后不再往外跑），再打开壳体看内部
    P.pullS.userData.travel(out); op(P.part, c.show(2, 0, 3, .5)); setP(P.part, P.pullS.children[0].position.toArray());
    P.part.userData.lid.position.y = .06 + .25 * open; P.part.userData.board.position.y = .02 + .12 * open;
    P.hyp.forEach((h, i) => op(h, c.show(2, 1 + i * .3, 3, 0)));
    // 4 修复：新件沿同一轴线装入，落到装配面被 stopAt 停住，到位后轴向压缩 .06 表示压紧
    const fix = c.p(3, 0, 3, 1), sap = P.seatS.userData.travel(fix);
    op(P.newPart, c.show(3, 0, 4, 1)); setP(P.newPart, P.seatS.children[0].position.toArray()); P.newPart.scale.set(1, 1 - .06 * sap.over, 1);
    P.imp.forEach((m, i) => { const k = stagger(c.p(3, 1, 3, 'end'), i, 3) * c.out(4, .5); op(m.b, k); op(m.l, k); K.drawLine(m.l, k); });
    // 5 复测：指针从红区 -70° 扫回合合格区 0°（回到绿区=数值合格），绿色检查扫过各系统
    const sw = c.lin(4, 0, 4, 1.4), vn = c.p(4, .4, 4, 1.6);
    op(P.dial, c.show(4, .3, 5, .5)); op(P.needle, c.show(4, .3, 5, .5));
    P.needle.rotation.set(0, A.ry, lerp(-1.22, 0, vn)); P.needle.material.color.set(new THREE.Color(vn > .82 ? COL.green : COL.red).multiplyScalar(2.6));
    op(P.sweep, c.show(4, 0, 4, 1.6) * K.pulse(sw)); setP(P.sweep, [lerp(2.6, -2.6, sw), .8, 0]);
    P.oks.forEach((o, i) => op(o, c.show(4, .4 + i * .35, 5, .5)));
    if (c.between(4, 0, 5, 0)) car.spin(t * 4);
    // 6 闭环
    op(P.doc, c.show(5, 0)); op(P.loop, c.show(5, .6)); P.loop.material.rotation = -c.p(5, .6, 5, 1.6) * Math.PI * 2; op(P.book, c.show(5, 1.6));
  }
};
