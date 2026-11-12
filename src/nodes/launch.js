// 第 8 阶段：量产支持与技术交付
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, stagger, axes, dim, hardpoint, docStack, robotArm, THREE} from './lib.js';
const ghostCar = (car, k = 1) => { car.set('paint', 1 - k); car.set('ghost', k); };
const A = axes(32);

export const launch1 = {
  phases: ['工位与定位', '夹紧与测量', '四大工艺与回查'],
  shots: [
    {title: '识别工艺关注点', detail: '车身进入工位，两侧机器人、输送线和工装与零件装配要求对上'},
    {title: '定位工装', detail: '定位销与支承面对准设计基准，车身每次都落在同一位置'},
    {title: '夹紧与连接', detail: '夹具按顺序闭合，接触点亮起；检查可操作空间，避免工装把车身压变形'},
    {title: '测量尺寸间隙', detail: '测头沿关键接口测量，偏差逐层追溯到零件、工装或装配过程'},
    {title: '冲压焊装涂装总装', detail: '车身依次经过四个工艺站：成形、连接、防护涂层、总装'},
    {title: '完成现场回查', detail: '调整后复测通过，夹具松开、工装释放，变更记录归档'}
  ],
  cams: [
    [{tg: [0, .8, 0], r: 10, az: 35, el: 22}],
    [{tg: [.5, .4, .4], r: 5.6, az: 45, el: 20}],
    [{tg: [0, .7, 0], r: 7.6, az: 40, el: 30}],
    [{tg: [.6, .8, .3], r: 6.4, az: 50, el: 22}],
    [{tg: [-2, .8, 0], r: 13, az: 70, el: 20}],
    [{tg: [0, .8, 0], r: 9, az: 30, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    P.line = K.add(new THREE.Group()); for (let i = 0; i < 30; i++) { const s = K.glow(new THREE.BoxGeometry(.06, .01, 1.6), COL.blue, 1.6, .5); s.position.set(-9 + i * .6, .006, 0); P.line.add(s); }
    P.arms = [robotArm(K, [.8, 0, 1.7]), robotArm(K, [-.8, 0, -1.7])];
    P.focus = [['gear', COL.blue], ['box', COL.white], ['ruler', COL.amber]].map(([ic, col], i) => chip(K, ic, col, A.at([0, 2.0, 0], (i - 1) * 1.1, -.6), .34));
    P.pins = [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].map(([x, z]) => { const p = K.add(K.glow(new THREE.CylinderGeometry(.03, .03, .2, 10), COL.amber, 2.4)); setP(p, [x, .2, z]); return p; });
    P.pads = [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].map(([x, z]) => { const p = K.add(K.holoBox(.24, .1, .24, COL.cyan, .2, 1)); setP(p, [x, .05, z]); return p; });
    P.clamps = [[1.2, .9], [.4, .95], [-.6, .95], [-1.4, .9], [1.2, -.9], [.4, -.95], [-.6, -.95], [-1.4, -.9]].map(([x, z]) => { const g = K.add(new THREE.Group()); const jaw = K.holoBox(.12, .24, .08, COL.amber, .25, 1); g.add(jaw); setP(g, [x, .35, z]); g.userData.z = z; return g; });
    P.contact = P.clamps.map(cl => { const d = K.add(K.glow(new THREE.SphereGeometry(.03, 10, 8), COL.green, 2.6)); setP(d, [cl.position.x, .35, cl.userData.z * .86]); return d; });
    P.meas = [[2.1, .7, .65], [1.0, .9, .92], [-.05, .75, .93], [-2.1, .85, .6]].map(p => ({p, h: hardpoint(K, p, COL.green, .04)}));
    P.trace = [['box', COL.white], ['gear', COL.blue], ['wrench', COL.amber]].map(([ic, col], i) => { const p = A.at([0, 2.0, 0], (i - 1) * 1.1, -.6); return {b: chip(K, ic, col, p, .3), l: link(K, [1.0, .9, .92], p, col, .2, true)}; });
    P.stations = [['box', COL.white], ['bolt', COL.amber], ['drop', COL.violet], ['gear', COL.green]].map(([ic, col], i) => { const x = 3 - i * 3; const r = floorRing(K, 1.2, col, [x, 0, 0]); return {r, b: chip(K, ic, col, [x, 2.0, 0], .42), x}; });
    P.sparks = K.add(K.flow([[0, 0, 0], [.2, .3, .1], [.4, 0, .2]], {color: COL.amber, n: 16, size: 6, speed: 2}));
    P.ok = chip(K, 'check', COL.green, [0, 2.0, 0], .42); P.doc = docStack(K, 3, COL.white, .3, .4); setP(P.doc, A.at([0, .02, 0], 2.8, -.6));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    op(P.line, c.show(0, 0)); P.line.children.forEach((s, i) => s.position.x = ((i * .6 - t * .8) % 18 + 18) % 18 - 9);
    car.root.position.x = lerp(-4, 0, c.p(0, 0, 0, 1)) + (c.between(4, 0, 5, 0) ? 0 : 0);
    P.arms.forEach((a, i) => { op(a, c.show(0, .6, 4, 0)); a.userData.reach([.4 * (i ? -1 : 1) + .3 * Math.sin(t + i), 1.1, (i ? -1 : 1) * .9]); });
    P.focus.forEach((f, i) => op(f, c.show(0, 1.2, 1, 0) * stagger(c.p(0, 1.2, 0, 'end'), i, 3)));
    // 2 定位
    P.pads.forEach(p => op(p, c.show(1, 0, 5, 0)));
    P.pins.forEach((p, i) => { op(p, c.show(1, 0, 5, 0)); p.position.y = .1 + .12 * stagger(c.p(1, 0, 1, 1.4), i, 4); });
    car.root.position.y += .15 * (1 - c.p(1, .8, 1, 1.6)) * (c.after(1, 0) ? 1 : 0);
    // 3 夹紧
    const cl = c.show(2, 0, 5, 1);
    if (cl > 0) { ghostCar(car, .6); S.show('biw', .9); }
    P.clamps.forEach((g, i) => { const k = stagger(c.p(2, 0, 2, 1.4), i, 8) * (1 - c.p(5, .6, 5, 1.4)); op(g, cl); g.position.z = g.userData.z * (1 + .25 * (1 - k)); op(P.contact[i], cl * (k > .95 ? 1 : 0)); });
    // 4 测量
    P.arms[0].userData.reach && c.between(3, 0, 4, 0) && P.arms[0].userData.reach(P.meas[Math.min(3, Math.floor(c.lin(3, 0, 3, 'end') * 4))].p.map((v, i) => i === 2 ? v + .05 : v));
    P.meas.forEach((m, i) => { op(m.h, c.show(3, 0, 4, 0) * stagger(c.lin(3, 0, 3, 1.5), i, 4)); m.h.children[0].material.color.set(new THREE.Color(i === 1 ? COL.amber : COL.green).multiplyScalar(2.6)); });
    P.trace.forEach((tr, i) => { const k = stagger(c.p(3, 1.5, 3, 'end'), i, 3) * c.out(4, 0); op(tr.b, k); op(tr.l, k); K.drawLine(tr.l, k); });
    // 5 四大工艺
    const v = c.lin(4, 0, 4, 'end'), st = Math.min(3, Math.floor(v * 4));
    P.stations.forEach((s, i) => { op(s.r, c.show(4, 0, 5, 0) * (i === st ? 1 : .35)); op(s.b, c.show(4, 0, 5, 0) * (i === st ? 1 : .35)); });
    if (c.between(4, 0, 5, 0)) {
      car.root.position.x = lerp(3, -6, v); car.spin(-car.root.position.x / car.wheelR);
      S.biw.g.position.x = car.root.position.x; S.battery.g.position.x = car.root.position.x;
      if (st === 0) { car.set('paint', 0); car.set('ghost', 0); S.show('biw', 1); } else if (st === 1) { car.set('paint', 0); car.set('ghost', .3); S.show('biw', 1); } else if (st === 2) { const f = (v * 4) % 1; car.set('paint', f); car.set('ghost', 1 - f); } else { car.set('paint', 1); car.set('ghost', 0); S.show('battery', .8); }
      op(P.sparks, st === 1 ? 1 : 0); P.sparks.position.set(car.root.position.x + .4, .9, .9); P.sparks.userData.update(t, 1);
    }
    // 6 回查
    op(P.ok, c.show(5, 0)); op(P.doc, c.show(5, 1.2));
    if (c.after(5, 0)) { car.set('paint', c.p(5, 0, 5, 1)); car.set('ghost', 1 - c.p(5, 0, 5, 1)); }
  }
};

// ———————————————————— launch-2 移交工程数据与验证证据 ————————————————————
export const launch2 = {
  phases: ['归集成果', '核对配置与问题', '清单检查与签收'],
  shots: [
    {title: '核对交接对象', detail: '模型、图纸、物料清单、验证报告四叠成果归集到车旁，各自标明用途'},
    {title: '复核关联', detail: '图纸与报告之间连线，确认设计依据、验证结论和最终数据互相支撑'},
    {title: '检查系统配合', detail: '软件、硬件、整车模型三个版本环对齐；有限制的组合单独标出'},
    {title: '已关闭与未完成', detail: '已关闭的问题带着证据；未完成事项挂上影响与负责人，不只交一个文件夹'},
    {title: '清单检查', detail: '按约定清单逐项检查完整、可读取，必要时向接收方说明'},
    {title: '完成交接', detail: '成果包交到接收方，版本与签收记录留存，后续有据可查'}
  ],
  cams: [
    [{tg: [0, .9, -.6], r: 10.4, az: 30, el: 18}],
    [{tg: [0, 1.1, -1], r: 9, az: 30, el: 14}],
    [{tg: [0, 1.2, -.6], r: 9, az: 30, el: 14}],
    [{tg: [0, 1.0, -.6], r: 9.6, az: 32, el: 16}],
    [{tg: [0, 1.0, -.6], r: 9.6, az: 30, el: 16}],
    [{tg: [-1, .8, -.6], r: 11, az: 35, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    P.stacks = [['chip', COL.cyan], ['doc', COL.white], ['box', COL.amber], ['check', COL.green]].map(([ic, col], i) => { const p = A.at([0, 0, 0], (i - 1.5) * 1.5, -2.2); const s = docStack(K, 4, col, .42, .54); setP(s, p); return {s, b: chip(K, ic, col, [p[0], 1.0, p[2]], .36), p}; });
    P.rel = [[1, 3], [0, 1], [2, 3]].map(([a, b]) => link(K, [P.stacks[a].p[0], .6, P.stacks[a].p[2]], [P.stacks[b].p[0], .6, P.stacks[b].p[2]], COL.white, .5));
    P.vers = [['chip', COL.violet], ['gear', COL.blue], ['screen', COL.cyan]].map(([ic, col], i) => { const p = A.at([0, 2.3, 0], (i - 1) * 1.2, -1.0); const r = K.add(K.ring(.34, col, .014)); setP(r, p); r.rotation.y = A.ry; return {r, b: chip(K, ic, col, p, .3), p}; });
    P.limit = chip(K, 'warn', COL.amber, A.at([0, 2.85, 0], 1.2, -1.0), .26);
    P.closed = [0, 1, 2].map(i => chip(K, 'check', COL.green, A.at([0, 1.5 + i * .35, 0], -3.6, -1.2), .26));
    P.open = [0, 1].map(i => ({b: chip(K, 'flag', COL.amber, A.at([0, 1.6 + i * .4, 0], 3.4, -1.2), .28), u: chip(K, 'user', COL.amber, A.at([0, 1.6 + i * .4, 0], 3.85, -1.2), .24)}));
    P.list = [0, 1, 2, 3, 4].map(i => { const p = A.at([0, 2.5 - i * .3, 0], -3.4, -.6); const r = K.add(K.holoBox(1.2, .2, .04, COL.white, .1, .9)); setP(r, p); r.rotation.y = A.ry; return {r, ok: chip(K, 'check', COL.green, A.at(p, .75), .2)}; });
    P.explain = chip(K, 'people', COL.cyan, A.at([0, 1.2, 0], 3.4, -.4), .4);
    P.pkg = chip(K, 'box', COL.cyan, [0, 1.6, -2], .6);
    P.recv = floorRing(K, .9, COL.green, A.at([0, 0, 0], -4.2, -.8)); P.stamp = chip(K, 'stamp', COL.green, A.at([0, 1.4, 0], -4.2, -.8), .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    P.stacks.forEach((st, i) => { const k = stagger(c.p(0, 0, 0, 1.4), i, 4); const live = c.out(5, 0); op(st.s, k * live); op(st.b, c.show(0, 1, 5, 0) * k); st.s.userData.sheets.forEach((s, j) => s.position.y = j * .04 * k + .02); });
    P.rel.forEach((l, i) => { op(l, c.show(1, 0, 2, .5)); K.drawLine(l, stagger(c.p(1, 0, 1, 'end'), i, 3)); });
    P.vers.forEach((v, i) => { const k = c.show(2, 0, 3, .5); const al = c.p(2, .6, 2, 1.6); op(v.r, k); op(v.b, k); v.r.position.y = v.p[1] + (i - 1) * .3 * (1 - al); v.b.position.y = v.r.position.y; });
    op(P.limit, c.show(2, 1.8, 3, .5));
    if (c.between(2, 0, 3, .5)) { ghostCar(car, .8); S.show('eea', .9); S.eea.reach = 1; }
    P.closed.forEach((b, i) => op(b, c.show(3, 0, 4, 0) * stagger(c.p(3, 0, 3, 1), i, 3)));
    P.open.forEach((o, i) => { const k = c.show(3, 1, 4, 0) * stagger(c.p(3, 1, 3, 'end'), i, 2); op(o.b, k); op(o.u, k); });
    P.list.forEach((r, i) => { const k = stagger(c.p(4, 0, 4, 1.4), i, 5); op(r.r, c.show(4, 0, 5, 0)); op(r.ok, c.show(4, 0, 5, 0) * (k > .9 ? 1 : 0)); });
    op(P.explain, c.show(4, 1.3, 5, 0));
    const mv = c.p(5, 0, 5, 1.2); op(P.pkg, c.show(5, 0)); setP(P.pkg, mixV([0, 1.6, -2], A.at([0, 1.0, 0], -4.2, -.8), mv));
    op(P.recv, c.show(5, .3)); op(P.stamp, c.show(5, 1.2)); P.stamp.scale.setScalar(.4 * (1 + .4 * c.pulse(5, 1.2, .8)));
  }
};

// ———————————————————— launch-3 汇聚经验与后续迭代 ————————————————————
export const launch3 = {
  phases: ['回收问题与拆解', '分析与归档', '复用到下一轮'],
  shots: [
    {title: '回收现场问题', detail: '设计、试验、现场三路反馈流回复盘中心，完整过程一起收回'},
    {title: '拆解案例', detail: '案例拆成现象、触发条件、受影响配置三块，避免把偶然当规律'},
    {title: '比较改进结果', detail: '原因、解决方法与验证证据连在一起，并划出适用边界'},
    {title: '归入经验库', detail: '有依据的知识按系统归档，沉淀成设计规则、检查表和参考方案'},
    {title: '下一项目检索', detail: '新车型检索经验库，先核对新条件，再复用方法而不是照搬旧设计'},
    {title: '回到需求与计划', detail: '经验回到下一轮的需求、计划与风险识别，开发质量持续改进'}
  ],
  cams: [
    [{tg: [0, 1.0, -.6], r: 10, az: 32, el: 18}],
    [{tg: [0, 1.4, -1.2], r: 8.6, az: 30, el: 12}],
    [{tg: [0, 1.4, -1.2], r: 8.6, az: 30, el: 12}],
    [{tg: [0, 1.0, -1.6], r: 9.6, az: 30, el: 16}],
    [{tg: [-1.2, .8, -.8], r: 11.4, az: 34, el: 18}],
    [{tg: [0, .8, 0], r: 9.4, az: 28, el: 14}, {b: 1, tg: [0, .7, 0], r: 8.4, az: 40, el: 10, dur: 4}]
  ],
  build(K, S, car) {
    const P = {}, hub = A.at([0, 1.6, 0], 0, -1.6);
    P.hub = K.add(K.ring(.4, COL.cyan, .014)); setP(P.hub, hub); P.hub.rotation.y = A.ry; P.hubI = chip(K, 'search', COL.cyan, hub, .4);
    P.src = [['palette', COL.pink, -3.2], ['search', COL.green, 0], ['wrench', COL.amber, 3.2]].map(([ic, col, al]) => { const p = A.at([0, 1.0, 0], al, al === 0 ? 1.6 : -.4); return {b: chip(K, ic, col, p, .36), f: K.add(K.flow([p, [(p[0] + hub[0]) / 2, 2.4, (p[2] + hub[2]) / 2], hub], {color: col, n: 10, size: 6, speed: .6}))}; });
    P.tiles = [['eye', COL.white], ['bolt', COL.amber], ['gear', COL.blue]].map(([ic, col], i) => { const p = A.at([0, 1.6, 0], (i - 1) * 1.2, -1.6); const r = K.add(K.holoBox(.9, .6, .04, col, .12, 1)); setP(r, p); r.rotation.y = A.ry; return {r, b: chip(K, ic, col, p, .3), p}; });
    P.bound = K.add(K.ring(1.9, COL.green, .01)); setP(P.bound, A.at([0, 1.6, 0], 0, -1.65)); P.bound.rotation.y = A.ry;
    P.ev = link(K, P.tiles[0].p, P.tiles[2].p, COL.green, .5);
    P.shelf = [0, 1, 2].map(r => [0, 1, 2, 3].map(cI => { const p = A.at([0, .5 + r * .45, 0], (cI - 1.5) * .7, -2.4); const b = K.add(K.holoBox(.55, .3, .3, [COL.cyan, COL.amber, COL.green][r], .15, .9)); setP(b, p); b.rotation.y = A.ry; return b; })).flat();
    P.book = chip(K, 'book', COL.amber, A.at([0, 2.0, 0], 0, -2.4), .42);
    P.newCar = car.makeClone(0x1d3b66); K.add(P.newCar); setP(P.newCar, A.at([0, 0, 0], -4.6, -.4)); P.newCar.rotation.y = 0;
    P.query = K.add(K.flow([A.at([0, 1.2, 0], -4.6, -.4), A.at([0, 2.0, 0], -2.3, -1.4), A.at([0, 1.4, 0], 0, -2.4)], {color: COL.cyan, n: 14, size: 6, speed: .7}));
    P.cond = chip(K, 'search', COL.white, A.at([0, 1.9, 0], -4.6, -.4), .34);
    P.loop = K.add(K.ring(3.2, COL.cyan, .012)); P.loop.rotation.x = -Math.PI / 2; setP(P.loop, [0, .03, 0]);
    P.loopFlow = K.add(K.flow(Array.from({length: 33}, (_, i) => { const a = i / 32 * Math.PI * 2; return [Math.cos(a) * 3.2, .05, Math.sin(a) * 3.2]; }), {color: COL.cyan, n: 30, size: 6, speed: .15}));
    P.goal = chip(K, 'target', COL.green, [0, 2.0, 0], .44);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    const s0 = c.show(0, 0, 4, 0);
    op(P.hub, s0); op(P.hubI, c.show(0, 0, 1, 0));
    P.src.forEach((s, i) => { const k = stagger(c.p(0, 0, 0, 1.2), i, 3) * c.out(1, 0); op(s.b, k); op(s.f, c.show(0, .6, 1, 0)); s.f.userData.update(t, c.lin(0, .6, 0, 'end')); });
    P.tiles.forEach((tl, i) => { const k = stagger(c.p(1, 0, 1, 1.2), i, 3), live = c.show(1, 0, 3, .6); op(tl.r, k * live); op(tl.b, k * live); setP(tl.r, mixV(P.hub.position.toArray(), tl.p, k)); setP(tl.b, tl.r.position.toArray()); });
    op(P.ev, c.show(2, 0, 3, .6)); K.drawLine(P.ev, c.p(2, 0, 2, 1)); op(P.bound, c.show(2, 1, 3, .6)); P.bound.scale.setScalar(c.p(2, 1, 2, 'end'));
    P.shelf.forEach((b, i) => op(b, c.show(3, 0, 5, 1) * stagger(c.p(3, 0, 3, 'end'), i, 12, .8)));
    op(P.book, c.show(3, .5, 5, 1));
    op(P.newCar, c.show(4, 0, 5, 1)); op(P.query, c.show(4, .4, 5, 0)); P.query.userData.update(t, 1); op(P.cond, c.show(4, 1, 5, 0));
    op(P.loop, c.show(5, 0)); op(P.loopFlow, c.show(5, 0)); P.loopFlow.userData.update(t, 1);
    op(P.goal, c.show(5, 1)); car.set('edges', .4 * c.pulse(5, 1, 2.5));
  }
};
