// 第 8 阶段：量产支持与技术交付
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, stagger, axes, dim, hardpoint, docStack, robotArm, section, THREE} from './lib.js';
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
    [{tg: [-4.5, .8, 0], r: 13, az: 70, el: 20}],
    [{tg: [-8.2, .8, 0], r: 9.4, az: 30, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    // 滚床：34 条横链，跨度 -13…+7.4（循环点落在画面外），随车身同步位移（线动则车动、线停则车停）
    P.line = K.add(new THREE.Group()); for (let i = 0; i < 34; i++) { const s = K.glow(new THREE.BoxGeometry(.06, .01, 1.6), COL.blue, 1.6, .5); s.position.set(-13 + i * .6, .006, 0); P.line.add(s); }
    P.arms = [robotArm(K, [.8, 0, 1.7]), robotArm(K, [-.8, 0, -1.7])];
    // 腕部夹爪：两片爪板，闭合时沿 z 各收拢 9 cm 咬住车身侧面，接触点灯亮
    P.grip = P.arms.map(a => { const tip = a.children.find(o => o.material && o.material.isMeshBasicMaterial); const g = new THREE.Group(); const j = [-1, 1].map(s => { const m = K.holoBox(.035, .16, .05, COL.amber, .3, 1); m.position.y = .06; m.position.z = s * .12; g.add(m); return m; }); a.add(g); return {g, j, tip}; });
    P.gdot = P.arms.map(() => K.add(K.glow(new THREE.SphereGeometry(.03, 10, 8), COL.green, 2.8)));
    P.sh = K.add(K.shadowPatch(2.9, .5));      // 车身在滚床上的接触阴影，随车一起走
    P.focus = [['gear', COL.blue], ['box', COL.white], ['ruler', COL.amber]].map(([ic, col], i) => chip(K, ic, col, A.at([0, 2.0, 0], (i - 1) * 1.1, -.6), .34));
    P.pins = [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].map(([x, z]) => { const p = K.add(K.glow(new THREE.CylinderGeometry(.03, .03, .2, 10), COL.amber, 2.4)); setP(p, [x, .2, z]); return p; });
    P.pads = [[1.6, .7], [1.6, -.7], [-1.5, .7], [-1.5, -.7]].map(([x, z]) => { const p = K.add(K.holoBox(.24, .1, .24, COL.cyan, .2, 1)); setP(p, [x, .05, z]); return p; });
    P.clamps = [[1.2, .9], [.4, .95], [-.6, .95], [-1.4, .9], [1.2, -.9], [.4, -.95], [-.6, -.95], [-1.4, -.9]].map(([x, z]) => { const g = K.add(new THREE.Group()); const jaw = K.holoBox(.12, .24, .08, COL.amber, .25, 1); g.add(jaw); setP(g, [x, .35, z]); g.userData.z = z; return g; });
    P.contact = P.clamps.map(cl => { const d = K.add(K.glow(new THREE.SphereGeometry(.03, 10, 8), COL.green, 2.6)); setP(d, [cl.position.x, .35, cl.userData.z * .86]); return d; });
    P.meas = [[2.1, .7, .65], [1.0, .9, .92], [-.05, .75, .93], [-2.1, .85, .6]].map(p => ({p, h: hardpoint(K, p, COL.green, .04)}));
    P.trace = [['box', COL.white], ['gear', COL.blue], ['wrench', COL.amber]].map(([ic, col], i) => { const p = A.at([0, 2.0, 0], (i - 1) * 1.1, -.6); return {b: chip(K, ic, col, p, .3), l: link(K, [1.0, .9, .92], p, col, .2, true)}; });
    // 四个工艺站：0 / -3 / -6 / -9，车身从 0 一路开到 -9，正好依次穿过四站
    P.stations = [['box', COL.white], ['bolt', COL.amber], ['drop', COL.violet], ['gear', COL.green]].map(([ic, col], i) => { const x = -i * 3; const r = floorRing(K, 1.2, col, [x, 0, 0]); return {r, b: chip(K, ic, col, [x, 2.0, 0], .42), x}; });
    P.sparks = K.add(K.flow([[0, 0, 0], [.2, .3, .1], [.4, 0, .2]], {color: COL.amber, n: 16, size: 6, speed: 2}));
    P.ok = chip(K, 'check', COL.green, [0, 2.0, 0], .42); P.docP = A.at([0, .02, 0], 2.8, -.6); P.doc = docStack(K, 3, COL.white, .3, .4); setP(P.doc, P.docP);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // —— 输送线：滚床与车身同一速度。进站 4.6 m → 停线定位 → 四站连走 9 m，全程连续无跳变 ——
    const inX = lerp(-4.6, 0, c.p(0, 0, 0, 1)), run = c.lin(4, .3, 4, 'end');
    const carX = c.after(4, 0) ? lerp(0, -9, ease(run)) : inX;
    car.root.position.x = carX; car.spin(-carX / car.wheelR);
    car.root.position.y = .18 * (1 - c.p(0, .8, 0, 'end'));      // 进站时车身随滚床落到支承面（0.18 m 下沉）
    op(P.line, c.show(0, 0));
    P.line.children.forEach((s, i) => { s.position.x = -13 + ((((i * .6 + carX + 4.6) % 20.4) + 20.4) % 20.4); });
    op(P.sh, clamp(Math.abs(carX) / 1.4)); setP(P.sh, [carX, .012, 0]);
    // 机械臂：随车跟踪 → 下探 → 夹爪闭合咬住车身 → 测量时张开 → 起车时抬起让位
    P.arms.forEach((a, i) => {
      const s = i ? -1 : 1, down = c.p(0, 1.2, 0, 'end'), rel = c.p(4, 0, 4, .7);
      op(a, c.show(0, .6, 4, .3));
      a.userData.reach([clamp(carX + .3, -.9, .45), lerp(1.5, .78, down) + .75 * rel, s * .95]);
      const gw = P.grip[i], k = c.p(0, 1.5, 0, 'end') * (1 - c.p(3, 0, 3, .5));
      gw.g.position.copy(gw.tip.position); gw.g.rotation.x = -Math.PI / 2 * k;
      gw.j[0].position.z = -.12 + .092 * k; gw.j[1].position.z = .12 - .092 * k;
      const tp = gw.tip.position; op(P.gdot[i], k > .96 ? 1 : 0); setP(P.gdot[i], [tp.x + (i ? -.8 : .8), tp.y, tp.z + (i ? -1.7 : 1.7)]);
    });
    P.focus.forEach((f, i) => op(f, c.show(0, 1.2, 1, 0) * stagger(c.p(0, 1.2, 0, 'end'), i, 3)));
    // 2 定位
    P.pads.forEach(p => op(p, c.show(1, 0, 5, 0)));
    P.pins.forEach((p, i) => { op(p, c.show(1, 0, 5, 0)); p.position.y = .1 + .16 * stagger(c.p(1, 0, 1, 1.4), i, 4); });   // 定位销上行 0.16 m 插入
    // 3 夹紧：夹臂先摆下 90° 再沿 z 收拢 0.25 m 压住侧面，接触点亮起
    const cl = c.show(2, 0, 5, 1);
    if (cl > 0) { ghostCar(car, .6); S.show('biw', .9); }
    P.clamps.forEach((g, i) => { const k = stagger(c.p(2, 0, 2, 1.4), i, 8) * (1 - c.p(5, .6, 5, 1.4)); op(g, cl); g.position.z = g.userData.z * (1 + .28 * (1 - k)); g.rotation.y = -(1 - k) * Math.PI / 2; op(P.contact[i], cl * (k > .95 ? 1 : 0)); });
    // 4 测量
    P.arms[0].userData.reach && c.between(3, 0, 4, 0) && P.arms[0].userData.reach(P.meas[Math.min(3, Math.floor(c.lin(3, 0, 3, 'end') * 4))].p.map((v, i) => i === 2 ? v + .05 : v));
    P.meas.forEach((m, i) => { op(m.h, c.show(3, 0, 4, 0) * stagger(c.lin(3, 0, 3, 1.5), i, 4)); m.h.children[0].material.color.set(new THREE.Color(i === 1 ? COL.amber : COL.green).multiplyScalar(2.6)); });
    P.trace.forEach((tr, i) => { const k = stagger(c.p(3, 1.5, 3, 'end'), i, 3) * c.out(4, 0); op(tr.b, k); op(tr.l, k); K.drawLine(tr.l, k); });
    // 5 四大工艺：车身沿滚床依次通过冲压→焊装→涂装→总装（站序跟着车身位移走）
    const st = Math.min(3, Math.floor(run * 4));
    P.stations.forEach((s, i) => { op(s.r, c.show(4, 0, 5, 0) * (i === st ? 1 : .35)); op(s.b, c.show(4, 0, 5, 0) * (i === st ? 1 : .35)); });
    if (c.between(4, 0, 5, 0)) {
      S.biw.g.position.x = carX; S.battery.g.position.x = carX;
      if (st === 0) { car.set('paint', 0); car.set('ghost', 0); S.show('biw', 1); } else if (st === 1) { car.set('paint', 0); car.set('ghost', .3); S.show('biw', 1); } else if (st === 2) { const f = (run * 4) % 1; car.set('paint', f); car.set('ghost', 1 - f); } else { car.set('paint', 1); car.set('ghost', 0); S.show('battery', .8); }
      op(P.sparks, st === 1 ? 1 : 0); P.sparks.position.set(carX + .4, .9, .9); P.sparks.userData.update(t, 1);
    }
    // 6 回查：确认标与变更记录跟着车身停在总装站
    op(P.ok, c.show(5, 0)); op(P.doc, c.show(5, 1.2));
    setP(P.ok, [carX, 2.0, 0]); setP(P.doc, [carX + P.docP[0], .02, P.docP[2]]);
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
    // 交接台面：四叠成果要落在这张台面上（落点由 stopAt 钉住，不再往下穿）
    P.table = K.add(K.holoBox(5.2, .07, 1.4, COL.white, .1, .8)); setP(P.table, A.at([0, 0, 0], 0, -3.6, .5)); P.table.rotation.y = A.ry;
    P.legs = [[-2.3, -.5], [-2.3, .5], [2.3, -.5], [2.3, .5]].map(([a, z]) => { const l = K.holoBox(.06, .46, .06, COL.white, .08, .7); setP(l, A.at([0, 0, 0], a, -3.6 + z, .23)); l.rotation.y = A.ry; return l; });
    // 四叠成果：整叠从上方落下 → 停在台面；四张薄片边落边压合（0.13 m 摊开 → 0.04 m 成叠）
    P.stacks = [['chip', COL.cyan], ['doc', COL.white], ['box', COL.amber], ['check', COL.green]].map(([ic, col], i) => {
      const p = A.at([0, 0, 0], (i - 1.5) * 1.5, -3.6, .54);
      const s = docStack(K, 4, col, .42, .54); setP(s, p);
      const d = K.stopAt(s, [[0, 1.2, 0], [0, -.05, 0]], .96, {squash: .05}); K.nodeRoot.add(d);
      return {s, d, b: chip(K, ic, col, [p[0], 1.02, p[2]], .36), p};
    });
    P.rel = [[1, 3], [0, 1], [2, 3]].map(([a, b]) => link(K, [P.stacks[a].p[0], .8, P.stacks[a].p[2]], [P.stacks[b].p[0], .8, P.stacks[b].p[2]], COL.white, .5));
    P.vers = [['chip', COL.violet], ['gear', COL.blue], ['screen', COL.cyan]].map(([ic, col], i) => { const p = A.at([0, 2.3, 0], (i - 1) * 1.2, -1.0); const r = K.add(K.ring(.34, col, .014)); setP(r, p); r.rotation.y = A.ry; return {r, b: chip(K, ic, col, p, .3), p}; });
    P.versOk = K.add(K.ring(.5, COL.green, .012)); setP(P.versOk, A.at([0, 2.3, 0], 0, -1.0)); P.versOk.rotation.y = A.ry;
    P.limit = chip(K, 'warn', COL.amber, A.at([0, 2.85, 0], 1.2, -1.0), .26);
    P.closed = [0, 1, 2].map(i => chip(K, 'check', COL.green, A.at([0, 1.5 + i * .35, 0], -3.6, -1.2), .26));
    P.open = [0, 1].map(i => ({b: chip(K, 'flag', COL.amber, A.at([0, 1.6 + i * .4, 0], 3.4, -1.2), .28), u: chip(K, 'user', COL.amber, A.at([0, 1.6 + i * .4, 0], 3.85, -1.2), .24)}));
    P.list = [0, 1, 2, 3, 4].map(i => { const p = A.at([0, 2.5 - i * .3, 0], -3.4, -.6); const r = K.add(K.holoBox(1.2, .2, .04, COL.white, .1, .9)); setP(r, p); r.rotation.y = A.ry; return {r, ok: chip(K, 'check', COL.green, A.at(p, .75), .2)}; });
    P.explain = chip(K, 'people', COL.cyan, A.at([0, 1.2, 0], 3.4, -.4), .4);
    // 接收台：成果包沿弧线飞过来，落在接收台上停住
    const RP = A.at([0, 0, 0], -4.2, -.8);
    P.pkg = chip(K, 'box', COL.cyan, [0, 1.6, -2], .6);
    P.pkgG = K.stopAt(P.pkg, [[0, 0, 0], [-1.4, .75, 2.6], [RP[0], -1.18, RP[2] + 2]], .99, {squash: .05}); K.nodeRoot.add(P.pkgG);
    P.recvPad = K.add(K.holoBox(1.15, .09, 1.15, COL.green, .1, .85)); setP(P.recvPad, [RP[0], .045, RP[2]]); P.recvPad.rotation.y = A.ry;
    P.recvSh = K.add(K.shadowPatch(.8, .5)); setP(P.recvSh, [RP[0], .012, RP[2]]);
    P.recv = floorRing(K, .9, COL.green, A.at([0, 0, 0], -4.2, -.8)); P.stamp = chip(K, 'stamp', COL.green, A.at([0, 1.4, 0], -4.2, -.8), .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // 1 归集：四叠成果从上方落到交接台面，落点由 stopAt 钉住；四张薄片边落边压合成一叠
    P.stacks.forEach((st, i) => {
      const k = stagger(c.p(0, 0, 0, 1.4), i, 4), live = c.out(5, 0);
      op(st.s, k * live); op(st.b, c.show(0, 1, 5, 0) * k);
      st.d.userData.travel(k);
      st.s.userData.sheets.forEach((s, j) => s.position.y = j * lerp(.13, .04, clamp((k - j * .03) / .85)));
    });
    P.rel.forEach((l, i) => { op(l, c.show(1, 0, 2, .5)); K.drawLine(l, stagger(c.p(1, 0, 1, 'end'), i, 3)); });
    // 2 三个版本环先收拢到同一轴心，再各自转 90° 互相扣合（不是淡入）
    const C = A.at([0, 2.3, 0], 0, -1.0);
    P.vers.forEach((v, i) => {
      const k = c.show(2, 0, 3, .5), al = c.p(2, .6, 2, 1.6);
      op(v.r, k); op(v.b, k);
      setP(v.r, mixV(v.p, C, al));
      v.r.rotation.set(al * (i === 1 ? Math.PI / 2 : 0), A.ry + al * (i === 2 ? Math.PI / 2 : 0), 0);
      setP(v.b, mixV(v.p, [C[0], C[1] + .55 + i * .34, C[2]], al));
    });
    op(P.versOk, c.show(2, 1.5, 3, .4) * (.7 + .3 * c.pulse(2, 1.6, .8))); P.versOk.scale.setScalar(lerp(1.7, 1, c.p(2, 1.5, 2, 2)));
    op(P.limit, c.show(2, 1.8, 3, .5));
    if (c.between(2, 0, 3, .5)) { ghostCar(car, .8); S.show('eea', .9); S.eea.reach = 1; }
    P.closed.forEach((b, i) => op(b, c.show(3, 0, 4, 0) * stagger(c.p(3, 0, 3, 1), i, 3)));
    P.open.forEach((o, i) => { const k = c.show(3, 1, 4, 0) * stagger(c.p(3, 1, 3, 'end'), i, 2); op(o.b, k); op(o.u, k); });
    P.list.forEach((r, i) => { const k = stagger(c.p(4, 0, 4, 1.4), i, 5); op(r.r, c.show(4, 0, 5, 0)); op(r.ok, c.show(4, 0, 5, 0) * (k > .9 ? 1 : 0)); });
    op(P.explain, c.show(4, 1.3, 5, 0));
    // 6 交接：成果包沿弧线飞到接收台并停住（stopAt 停在台面上，不穿透）
    op(P.pkg, c.show(5, 0)); P.pkgG.userData.travel(c.p(5, 0, 5, 1.2));
    op(P.recvPad, c.show(5, .2)); op(P.recvSh, c.show(5, .2));
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
    [{tg: [0, .8, 0], r: 9.4, az: 28, el: 14}, {b: 1, tg: [0, .7, 0], r: 8.4, az: 40, el: 10, dur: 4}, {b: 2.4, tg: [-2.4, .75, 3.4], r: 8.6, az: 50, el: 14, dur: 2.4}]
  ],
  build(K, S, car) {
    const P = {}, hub = A.at([0, 1.6, 0], 0, -1.6);
    P.hub = K.add(K.ring(.4, COL.cyan, .014)); setP(P.hub, hub); P.hub.rotation.y = A.ry; P.hubI = chip(K, 'search', COL.cyan, hub, .4);
    P.src = [['palette', COL.pink, -3.2], ['search', COL.green, 0], ['wrench', COL.amber, 3.2]].map(([ic, col, al]) => { const p = A.at([0, 1.0, 0], al, al === 0 ? 1.6 : -.4); return {b: chip(K, ic, col, p, .36), f: K.add(K.flow([p, [(p[0] + hub[0]) / 2, 2.4, (p[2] + hub[2]) / 2], hub], {color: col, n: 10, size: 6, speed: .6}))}; });
    P.tiles = [['eye', COL.white], ['bolt', COL.amber], ['gear', COL.blue]].map(([ic, col], i) => { const p = A.at([0, 1.6, 0], (i - 1) * 1.2, -1.6); const r = K.add(K.holoBox(.9, .6, .04, col, .12, 1)); setP(r, p); r.rotation.y = A.ry; return {r, b: chip(K, ic, col, p, .3), p}; });
    P.bound = K.add(K.ring(1.9, COL.green, .01)); setP(P.bound, A.at([0, 1.6, 0], 0, -1.65)); P.bound.rotation.y = A.ry;
    P.ev = link(K, P.tiles[0].p, P.tiles[2].p, COL.green, .5);
    P.shelf = [0, 1, 2].map(r => [0, 1, 2, 3].map(cI => { const p = A.at([0, .5 + r * .45, 0], (cI - 1.5) * .7, -2.4); const b = K.add(K.holoBox(.55, .3, .3, [COL.cyan, COL.amber, COL.green][r], .15, .9)); setP(b, p); b.rotation.y = A.ry; b.userData.h0 = p; return b; })).flat();
    P.book = chip(K, 'book', COL.amber, A.at([0, 2.0, 0], 0, -2.4), .42);
    // 下一款车：实体用克隆网格（y 向挤出生长），线框用车身轮廓采样的 7 条 tube（growTube 逐段长）
    const NEWP = A.at([0, 0, 0], -4.6, -.4);
    P.newCar = car.makeClone(0x1d3b66); K.add(P.newCar); setP(P.newCar, NEWP); P.newCar.rotation.y = 0;
    P.cage = K.add(new THREE.Group()); setP(P.cage, NEWP);
    P.cageT = [...[-2.05, -.7, .6, 2.0].map(x => [[x, .05, -1.02], ...section(car, x, 14), [x, .05, 1.02]]),
      ...[1, -1].map(sg => car.profile.filter((b, k) => k % 2 === 0).map(b => [b.x, b.top + .015, sg * Math.max(.42, b.half + .01)])),
      car.profile.filter((b, k) => k % 2 === 0).map(b => [b.x, Math.max(.55, b.roof) + .015, .04])]
      .map(pts => { const m = K.tube(pts, .011, COL.cyan, {glow: true}); P.cage.add(m); return m; });
    P.carsh = K.add(K.shadowPatch(2.4, .55)); setP(P.carsh, [NEWP[0], .012, NEWP[2]]);
    P.query = K.add(K.flow([A.at([0, 1.2, 0], -4.6, -.4), A.at([0, 2.0, 0], -2.3, -1.4), A.at([0, 1.4, 0], 0, -2.4)], {color: COL.cyan, n: 14, size: 6, speed: .7}));
    P.cond = chip(K, 'search', COL.white, A.at([0, 1.9, 0], -4.6, -.4), .34);
    P.loop = K.add(K.ring(3.2, COL.cyan, .012)); P.loop.rotation.x = -Math.PI / 2; setP(P.loop, [0, .03, 0]);
    P.loopFlow = K.add(K.flow(Array.from({length: 33}, (_, i) => { const a = i / 32 * Math.PI * 2; return [Math.cos(a) * 3.2, .05, Math.sin(a) * 3.2]; }), {color: COL.cyan, n: 30, size: 6, speed: .15}));
    P.goal = chip(K, 'target', COL.green, [0, 2.0, 0], .44);
    // 需求（P.goal）/ 计划 / 风险 三样各挂一个，第 6 句才不止一个大环
    P.plan = chip(K, 'clock', COL.cyan, [-1.9, 1.5, 1.15], .36); P.risk = chip(K, 'warn', COL.amber, [1.9, 1.5, 1.15], .36);
    // 三路汇成一个汇点 J，再一条主流流进下一款车的车身
    const J = [-1.15, 1.35, .8];
    P.legs = [[0, 2.0, 0], [-1.9, 1.5, 1.15], [1.9, 1.5, 1.15]].map((p, i) => K.add(K.flow([p, [(p[0] + J[0]) / 2, J[1] + .5, (p[2] + J[2]) / 2], J], {color: [COL.green, COL.cyan, COL.amber][i], n: 8, size: 5, speed: .9})));
    P.trunk = K.add(K.flow([J, [(J[0] + NEWP[0]) / 2, 2.05, (J[2] + NEWP[2]) / 2], [NEWP[0], .95, NEWP[2]]], {color: COL.cyan, n: 20, size: 7, speed: .55}));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    const s0 = c.show(0, 0, 4, 0);
    op(P.hub, s0); op(P.hubI, c.show(0, 0, 1, 0));
    // 三路反馈各自按旁白进度流到汇点，先到的先亮（reach 跟着说话走）
    P.src.forEach((s, i) => { const k = stagger(c.p(0, 0, 0, 1.2), i, 3) * c.out(1, 0); op(s.b, k); op(s.f, c.show(0, .6, 1, 0)); s.f.userData.update(t, c.lin(0, .5 + i * .25, 0, 'end')); });
    P.tiles.forEach((tl, i) => { const k = stagger(c.p(1, 0, 1, 1.2), i, 3), live = c.show(1, 0, 3, .6); op(tl.r, k * live); op(tl.b, k * live); setP(tl.r, mixV(P.hub.position.toArray(), tl.p, k)); setP(tl.b, tl.r.position.toArray()); });
    op(P.ev, c.show(2, 0, 3, .6)); K.drawLine(P.ev, c.p(2, 0, 2, 1)); op(P.bound, c.show(2, 1, 3, .6)); P.bound.scale.setScalar(c.p(2, 1, 2, 'end'));
    // 3 归档：每个经验块从镜头侧滑进自己的格位后停住（0.5 m 沿视线方向进给）
    P.shelf.forEach((b, i) => { const k = stagger(c.p(3, 0, 3, 'end'), i, 12, .8), sl = 1 - k; op(b, k > .01 ? c.show(3, 0, 5, 1) : 0); setP(b, [b.userData.h0[0] + A.d[0] * .5 * sl, b.userData.h0[1], b.userData.h0[2] + A.d[2] * .5 * sl]); });
    op(P.book, c.show(3, .5, 5, 1));
    op(P.query, c.show(4, .4, 5, 0)); P.query.userData.update(t, 1); op(P.cond, c.show(4, 1, 5, 0));
    op(P.loop, c.show(5, 0)); op(P.loopFlow, c.show(5, 0)); P.loopFlow.userData.update(t, 1);
    // 5 经验回流：需求/计划/风险三路在 J 汇成一条主流，流进下一款车的车身
    op(P.goal, c.show(5, 1)); op(P.plan, c.show(5, 1.2)); op(P.risk, c.show(5, 1.6));
    P.legs.forEach((l, i) => { op(l, c.after(5, .8) ? 1 : 0); l.userData.update(t, c.lin(5, .8 + i * .25, 5, 2.4)); });
    op(P.trunk, c.after(5, 1.6) ? 1 : 0); P.trunk.userData.update(t, c.lin(5, 1.6, 5, 2.9));
    // 6 下一款车出现：先线框逐段长出来（growTube），壳体再从地面挤出到全高（几何顶点真实上移）
    const cg = c.lin(5, 2.0, 5, 2.9), grow = c.p(5, 2.5, 5, 'end');
    op(P.cage, c.after(5, 2.0) ? 1 : 0);
    P.cageT.forEach((m, i) => K.growTube(m, stagger(cg, i, P.cageT.length, .5)));
    op(P.newCar, c.after(5, 2.5) ? 1 : 0); P.newCar.scale.set(1, lerp(.035, 1, grow), 1);
    op(P.carsh, grow * .9); P.carsh.scale.setScalar(lerp(.6, 1, grow));
    car.set('edges', .4 * c.pulse(5, 1, 2.5));
  }
};
