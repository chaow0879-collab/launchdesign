// 第 1 阶段：需求与技术定义
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, wall, road, airflow, matrix, stagger, axes, THREE} from './lib.js';

const A0 = axes(32), A1 = axes(48), A2 = axes(20), A4 = axes(36), A5 = axes(24);

export const demand1 = {
  phases: ['理解用户与场景', '把期待变成目标', '在约束中形成矩阵'],
  shots: [
    {title: '需求点亮整车', detail: '车身轮廓从一条线画出，用户与三类使用场景围绕整车出现'},
    {title: '场景带出需求', detail: '通勤、家庭、长途依次点亮；座舱空间、充电和智能体验各自浮现'},
    {title: '期待变成目标', detail: '每个期待落成一个可检查的目标环，并配上判定方法'},
    {title: '续航牵动全车', detail: '电池、整车质量、风阻和能量流一起汇向续航这一个目标'},
    {title: '成本法规周期', detail: '三道边界墙围住目标，相互牵制的位置闪烁提示'},
    {title: '目标矩阵', detail: '目标排成矩阵，造型、工程、验证三方围绕同一辆车接入'}
  ],
  cams: [
    [{tg: [-.3, .8, -.3], r: 9.4, az: 32, el: 14}],
    [{tg: [-.3, .85, -.3], r: 9.4, az: 48, el: 16}, {b: 2, tg: [0, .75, 0], r: 6.2, az: 50, el: 42}, {b: 3, tg: [-1.4, .8, .5], r: 7.6, az: 160, el: 20}],
    [{tg: [0, 1.45, 0], r: 8.2, az: 20, el: 15}],
    [{tg: [.9, .85, 0], r: 9.6, az: 88, el: 9}, {b: 3, tg: [.9, 1.2, 0], r: 9.2, az: 70, el: 15}],
    [{tg: [-.3, .8, -.3], r: 11, az: 36, el: 30}],
    [{tg: [-.3, 1.3, -.3], r: 10, az: 24, el: 17}]
  ],
  build(K, S, car) {
    const P = {};
    P.user = chip(K, 'user', COL.cyan, [1.5, 2.15, .5], .5);
    P.userLink = link(K, [1.5, 1.95, .5], [.6, 1.25, 0], COL.cyan, .15);
    const sc = [['city', 2.6], ['home', 0], ['route', -2.6]];
    P.scen = sc.map(([ic, along]) => { const p = A0.at([0, 0, 0], along, -2.9); return {ring: floorRing(K, .55, COL.blue, p), icon: chip(K, ic, COL.blue, [p[0], 1.0, p[2]], .55), p}; });
    P.road = road(K, 18, COL.blue);
    const reqRow = [-1, 0, 1].map(i => A1.at([0, 2.05, 0], i * .62));
    P.req = [['seat', COL.teal], ['plug', COL.amber], ['chip', COL.violet]].map(([ic, c], i) => ({b: chip(K, ic, c, reqRow[i], .42), c, home: reqRow[i]}));
    P.post = K.add(K.holoBox(.3, 1.1, .24, COL.amber, .12, .9)); setP(P.post, [-3.3, .55, 1.7]);
    P.plug = K.add(K.tube([[-3.25, 1.0, 1.6], [-2.9, 1.15, 1.45], [-2.4, 1.0, 1.15], [-2.02, .84, .95]], .022, COL.amber, {glow: true}));
    P.port = K.add(K.ring(.08, COL.amber, .012)); setP(P.port, [-1.99, .84, .93]); P.port.rotation.y = 0;
    // 目标环 + 方法图标（正对第 3 镜头）
    const goals = [['seat', COL.teal, 'ruler'], ['plug', COL.amber, 'clock'], ['chip', COL.violet, 'search'], ['route', COL.green, 'flag']];
    P.goals = goals.map(([ic, c, m], i) => {
      const p = A2.at([0, 2.05, 0], (i - 1.5) * .85);
      const ring = K.add(K.ring(.3, c, .012)); setP(ring, p); ring.rotation.y = A2.ry;
      const arc = K.add(new THREE.Mesh(new THREE.TorusGeometry(.37, .022, 6, 64), new THREE.MeshBasicMaterial({color: new THREE.Color(c).multiplyScalar(2.4), transparent: true, toneMapped: false, depthWrite: false}))); setP(arc, p); arc.rotation.y = A2.ry;
      const meth = chip(K, m, COL.white, A2.at(p, .3, .05, -.4), .26);
      const ok = chip(K, 'check', COL.green, A2.at(p, 0, .06), .22);
      return {ring, arc, meth, ok, p, c, ic};
    });
    P.goalIcons = goals.slice(3).map(([ic, c]) => chip(K, ic, c, P.goals[3].p, .3));
    // 续航
    P.rangeArrow = K.add(K.tube([[2.4, .03, 0], [5.5, .03, 0], [8.5, .03, 0]], .03, COL.green, {glow: true}));
    P.rangeHead = K.add(K.glow(new THREE.ConeGeometry(.12, .3, 16), COL.green, 2.5)); P.rangeHead.rotation.z = -Math.PI / 2;
    P.air = airflow(K, car, 7, COL.cyan);
    P.weightArrows = [-1.4, 0, 1.4].map(x => { const a = K.add(K.glow(new THREE.ConeGeometry(.08, .22, 12), COL.white, 1.8, .8)); a.rotation.z = Math.PI; setP(a, [x, 1.75, .3]); return a; });
    P.rangeIcons = [['battery', COL.teal, [-.3, .5, 1.4]], ['weight', COL.white, [-.2, 2.05, .3]], ['wind', COL.cyan, [2.7, 1.45, .5]], ['bolt', COL.amber, [-1.6, 1.3, 1.0]]].map(([ic, c, p]) => ({b: chip(K, ic, c, p, .4), p, c}));
    P.rangeGoal = K.add(K.ring(.36, COL.green, .016)); setP(P.rangeGoal, [3.6, 1.7, 0]); P.rangeGoal.rotation.y = axes(80).ry;
    P.rangeGoalIcon = chip(K, 'route', COL.green, [3.6, 1.7, 0], .44);
    P.rangeLinks = P.rangeIcons.map(r => link(K, r.p, [3.6, 1.7, 0], r.c, .3));
    // 约束墙：背面一道、两侧各一道，开口朝镜头
    const wallDef = [['coin', COL.amber, A4.at([0, 0, 0], 0, -2.6), A4.ry, 6.4], ['law', COL.violet, A4.at([0, 0, 0], -3.3, -.2), A4.ry + Math.PI / 2, 5], ['clock', COL.pink, A4.at([0, 0, 0], 3.3, -.2), A4.ry + Math.PI / 2, 5]];
    P.walls = wallDef.map(([ic, c, p, ry, w]) => { const wl = wall(K, w, 1.5, c, ic); setP(wl, p); wl.rotation.y = ry; wl.userData.home = p; return wl; });
    const gp = A4.at([0, 2.05, 0], 0);
    P.goals4 = goals.map(([ic, c], i) => { const p = A4.at([0, 2.0, 0], (i - 1.5) * .8); const r = K.add(K.ring(.26, c, .012)); setP(r, p); r.rotation.y = A4.ry; const b = chip(K, ic, c, p, .3); return {r, b, p}; });
    P.tension = [[0, 0], [1, 1], [2, 2], [3, 0]].map(([gi, wi]) => { const a = P.goals4[gi].p, w = P.walls[wi].userData.home; return link(K, a, [w[0] * .8, 1.1, w[2] * .8], COL.amber, .1, true); });
    P.warn = P.walls.map(w => chip(K, 'warn', COL.amber, [w.userData.home[0] * .75, 1.55, w.userData.home[2] * .75], .32));
    // 目标矩阵 + 三方团队
    P.mx = matrix(K, 3, 4, .44, COL.cyan); setP(P.mx, A5.at([0, 1.85, 0], 0, -1.2)); P.mx.rotation.y = A5.ry;
    P.teams = [['palette', COL.pink, -3.0], ['gear', COL.blue, 0], ['check', COL.green, 3.0]].map(([ic, c, along]) => { const p = A5.at([0, 0, 0], along * 1.1, along === 0 ? -3.6 : -1.4); return {ring: floorRing(K, .5, c, p), icon: chip(K, ic, c, [p[0], 1.3, p[2]], .5), p, c}; });
    P.teamLinks = P.teams.map(tm => link(K, [tm.p[0], 1.35, tm.p[2]], P.mx.position.toArray(), tm.c, .5));
    P.teamToCar = P.teams.map(tm => link(K, [tm.p[0], .55, tm.p[2]], [tm.p[0] * .25, .9, tm.p[2] * .25], tm.c, .05));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // —— 1 需求点亮整车 ——
    const draw = c.p(0, 0, 0, 1);
    car.set('edges', c.in(0, 0, .4) * (1 - c.p(0, 1, 0, 2) * .85) * c.out(1, 0));
    car.edgeMat.uniforms.uReveal.value = lerp(-2.5, 2.5, draw);
    car.set('paint', c.p(0, .6, 0, 1.6));
    op(P.user, c.show(0, 1, 2, 0)); op(P.userLink, c.show(0, 1, 2, 0)); K.drawLine(P.userLink, c.p(0, 1, 0, 1.6));
    // —— 2 场景带出需求 ——
    const hiCity = c.pulse(1, 0, 1.4), hiFam = c.pulse(1, 1, 2.2);
    P.scen.forEach((s, i) => { const hi = i === 0 ? hiCity : hiFam, k = stagger(c.p(0, 2, 0, 'end'), i, 3), live = c.show(0, 2, 1, 2); op(s.ring, k * live * (.6 + .4 * hi)); op(s.icon, k * live); s.icon.position.y = .75 + .3 * k; s.icon.scale.setScalar(.55 * (1 + .5 * hi)); });
    op(P.road, c.show(1, 0, 1, 2) * .9); P.road.userData.move(t, 7);
    if (c.between(1, 0, 1, 2.2)) car.spin(t * 7 / car.wheelR);
    const cabinK = c.show(1, 2, 2, 0);
    car.set('paint', Math.min(car.get('paint'), 1 - cabinK * .88)); car.set('ghost', cabinK);
    S.show('cabin', cabinK); S.show('occupant', c.show(1, 2, 1, 3) * .9);
    const reqK = [c.in(1, 2), c.in(1, 3), c.in(1, 3.5)];
    op(P.post, c.show(1, 3, 2, 0)); op(P.plug, c.show(1, 3, 2, 0)); K.growTube(P.plug, c.p(1, 3, 1, 3.5)); op(P.port, c.show(1, 3.3, 2, 0) * (.6 + .4 * c.pulse(1, 3.4, 1.4)));
    S.show('battery', c.show(1, 3.3, 2, 0) * .9); S.battery.modules.forEach((m, i) => op(m.userData.top, clamp((t - c.T(1, 3.3)) * 1.6 - i * .12)));
    S.show('eea', c.show(1, 3.6, 2, 0) * .85); S.eea.reach = c.lin(1, 3.6, 1, 'end');
    // —— 3 期待变成目标 ——
    P.goals.forEach((g, i) => {
      const k = stagger(c.p(2, 0, 2, 1), i, 4), live = c.out(3, 0, .8);
      op(g.ring, k * live); op(g.arc, k * live); g.arc.geometry.setDrawRange(0, Math.floor(g.arc.geometry.index.count * k * .7 / 6) * 6);
      const m = stagger(c.p(2, 1, 2, 'end'), i, 4); op(g.meth, m * live); op(g.ok, c.show(2, 1.7) * m * live);
      g.ring.position.y = g.arc.position.y = lerp(2.4, 2.05, k);
    });
    op(P.goalIcons[0], stagger(c.p(2, 0, 2, 1), 3, 4) * c.out(3, 0, .8));
    P.req.forEach((r, i) => { const k = c.p(2, 0, 2, .7); setP(r.b, mixV(r.home, P.goals[i].p, k)); r.b.scale.setScalar(.42 * (1 - .28 * k)); op(r.b, reqK[i] * c.out(3, 0, .8)); });
    // —— 4 续航牵动全车 ——
    const r4 = c.show(3, 0, 4, 0);
    S.show('battery', r4); car.set('ghost', Math.max(car.get('ghost'), r4)); car.set('paint', Math.min(car.get('paint'), 1 - r4 * .85));
    S.battery.modules.forEach(m => { if (r4 > 0) op(m.userData.top, 1); });
    op(P.rangeArrow, r4); K.growTube(P.rangeArrow, c.p(3, 0, 3, 1)); op(P.rangeHead, r4 * c.in(3, .3)); setP(P.rangeHead, [lerp(2.6, 8.5, c.p(3, 0, 3, 1)), .03, 0]);
    op(P.rangeIcons[0].b, c.show(3, 0, 4, 0));
    op(P.rangeIcons[1].b, c.show(3, 1, 4, 0)); S.show('biw', c.show(3, 1, 3, 2.2) * .8); P.weightArrows.forEach((a, i) => { op(a, c.show(3, 1, 3, 2.2)); a.position.y = 1.75 - .25 * ((t * 1.4 + i * .33) % 1); });
    op(P.rangeIcons[2].b, c.show(3, 2, 4, 0)); op(P.air, c.show(3, 2, 4, 0)); P.air.userData.update(t, c.lin(3, 2, 3, 2.6));
    op(P.rangeIcons[3].b, c.show(3, 2.5, 4, 0)); S.show('hv', c.show(3, 2.5, 4, 0)); S.show('drive', c.show(3, 2.5, 4, 0) * .9); S.show('thermal', c.show(3, 2.6, 4, 0) * .7);
    op(P.rangeGoal, c.show(3, 2.8, 4, 1)); op(P.rangeGoalIcon, c.show(3, 3, 4, 1)); P.rangeGoal.scale.setScalar(1 + .3 * c.pulse(3, 3.2, 1.4));
    P.rangeLinks.forEach((l, i) => { op(l, c.show(3, 3, 4, 1)); K.drawLine(l, stagger(c.p(3, 3, 3, 'end'), i, 4)); });
    // —— 5 成本法规周期 ——
    P.walls.forEach((w, i) => {
      const k = i === 0 ? c.p(4, 0, 4, .8) : c.p(4, 1 + i * .25, 4, 1.8 + i * .25);
      op(w, Math.min(k * 1.3, c.out(5, 0, .8))); w.scale.y = Math.max(.001, k);
      const sq = c.p(4, 2, 4, 'end') * .3, h = w.userData.home; setP(w, [h[0] * (1 - sq), 0, h[2] * (1 - sq)]);
    });
    P.goals4.forEach((g, i) => { const k = c.show(4, 0, 5, .2) * stagger(c.p(4, 0, 4, 1), i, 4); op(g.r, k); op(g.b, k); g.r.position.y = g.b.position.y = 2.0 + .06 * Math.sin(t * 3 + i) * c.show(4, 2); });
    P.tension.forEach((l, i) => { const k = c.show(4, 2, 5, 0); op(l, k * (.55 + .45 * Math.sin(t * 9 + i))); K.drawLine(l, c.p(4, 2, 4, 2.6)); });
    P.warn.forEach((w, i) => op(w, c.show(4, 2.2 + i * .2, 5, 0) * (.6 + .4 * Math.sin(t * 7 + i * 2))));
    // —— 6 目标矩阵 ——
    const mk = c.p(5, 0, 5, .8);
    op(P.mx, c.in(5, 0)); P.mx.userData.cells.forEach((cell, i) => { const k = stagger(mk, i, 12, .7); op(cell, k); cell.scale.setScalar(.3 + .7 * k); });
    P.goals4.forEach((g, i) => { if (c.after(5, 0)) { const k = c.p(5, 0, 5, .5); op(g.r, 1 - k); op(g.b, 1 - k); setP(g.b, mixV(g.p, P.mx.userData.cells[i * 3 % 12].getWorldPosition(new THREE.Vector3()).toArray(), k)); } });
    P.teams.forEach((tm, i) => { const k = stagger(c.p(5, 1, 5, 'end'), i, 3); op(tm.ring, k); op(tm.icon, k); op(P.teamLinks[i], k); K.drawLine(P.teamLinks[i], k); op(P.teamToCar[i], c.show(5, 1.4)); K.drawLine(P.teamToCar[i], c.p(5, 1.4, 5, 'end')); });
    if (c.after(5, 0)) { car.set('paint', c.p(5, 0, 5, 1)); car.set('ghost', 1 - c.p(5, 0, 5, 1)); car.set('edges', .4 * c.pulse(5, 1.4, 3)); }
  }
};

// ———————————————————— demand-2 并行评估整车与智能系统 ————————————————————
import {dim, hardpoint, profileCurve, taskBars, docStack} from './lib.js';
const B0 = axes(35), B4 = axes(30), B5 = axes(28);
export const demand2 = {
  phases: ['统一空间基准', '剖开看冲突', '协调并确认边界'],
  shots: [
    {title: '统一坐标基准', detail: '整车尺寸线与各系统包络放进同一坐标，坐标轴在车下亮起'},
    {title: '侧面剖开', detail: '沿中线剖开，乘员头部、座椅高度和地板下电池在同一竖向空间里对比'},
    {title: '调整带来变化', detail: '抬高乘员或加厚电池，车顶轮廓随之被推高，变化一目了然'},
    {title: '冲突与活动空间', detail: '重叠处变红；前轮转向扫过的范围、电池拆装路径和维修空间逐一显示'},
    {title: '硬点协调与取舍', detail: '各专业拉动硬点；无法兼顾时连线回到目标层作出取舍'},
    {title: '边界成为输入', detail: '检查过的边界变绿锁定，造型和工程两侧同时接入'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 9.2, az: 35, el: 22}],
    [{tg: [0, .75, 0], r: 7.4, az: 90, el: 4}],
    [{tg: [0, .9, 0], r: 6.8, az: 90, el: 6}],
    [{tg: [.4, .5, 0], r: 8, az: 50, el: 30}, {b: 1, tg: [1.2, .45, .3], r: 5.6, az: 40, el: 34}],
    [{tg: [0, .9, 0], r: 9.4, az: 30, el: 22}],
    [{tg: [0, .9, 0], r: 9.6, az: 28, el: 18}]
  ],
  build(K, S, car) {
    const P = {}, bb = car.bbox, wc = car.wheelCenters;
    P.dims = [dim(K, [bb.min.x, .03, 1.25], [bb.max.x, .03, 1.25]), dim(K, [wc[2].x, .03, 1.45], [wc[0].x, .03, 1.45], COL.amber), dim(K, [bb.max.x + .35, 0, 0], [bb.max.x + .35, bb.max.y, 0], COL.white), dim(K, [bb.min.x - .3, .03, -.93], [bb.min.x - .3, .03, .93], COL.white)];
    P.dims[2].rotation.set(0, 0, 0); P.dims[3].children.forEach(l => l.rotation.set(0, 0, 0));
    P.boxes = [[[S.battery.x0, .22, 0], [2.3, .2, 1.36], COL.teal], [[car.wheelCenters[0].x, .4, 0], [.5, .45, .9], COL.blue], [[car.wheelCenters[2].x, .4, 0], [.5, .45, .9], COL.blue], [[-.2, .85, 0], [2.0, .8, 1.5], COL.violet]].map(([p, s, col]) => { const b = K.add(K.holoBox(...s, col, .05, .8)); setP(b, p); return b; });
    P.axes = [[1, 0, 0, COL.red], [0, 1, 0, COL.green], [0, 0, 1, COL.blue]].map(([x, y, z, col]) => { const a = K.add(K.tube([[0, .02, 0], [x * 1.1, .02 + y * 1.1, z * 1.1]], .012, col, {glow: true})); return a; });
    // 剖面轮廓线
    P.cut = K.add(K.line(profileCurve(car, {z: 0}), COL.cyan, .95));
    P.vert = [[.0, .4, 1.13], [-.3, .36, .55], [-.6, .12, .29]].map(([x, y0, y1], i) => dim(K, [x + i * .25, y0, .02], [x + i * .25, y1, .02], [COL.green, COL.teal, COL.amber][i], .1));
    P.vert.forEach(d => d.children.forEach(l => {}));
    P.squeeze = chip(K, 'warn', COL.amber, [.1, 1.62, .05], .34);
    P.roofNew = K.add(K.line(car.profile.filter((b, i) => i % 2 === 0 && b.x > -1.9 && b.x < 1.5).map(b => [b.x, b.top + .09 * Math.exp(-Math.pow((b.x + .1) / .9, 2)), .02]), COL.amber, .95));
    // 冲突与活动空间
    P.clash = K.add(K.glow(new THREE.BoxGeometry(.5, .12, .5), COL.red, 2.4, .45)); setP(P.clash, [.75, .3, -.37]);
    P.clashWarn = chip(K, 'warn', COL.red, [.75, .8, -.37], .3);
    P.steer = K.add(new THREE.Mesh(new THREE.RingGeometry(.25, .42, 40, 1, -.55, 1.1), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.cyan).multiplyScalar(1.6), transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending}))); P.steer.rotation.x = -Math.PI / 2; setP(P.steer, [wc[0].x, .03, wc[0].z]);
    P.path = K.add(K.line([[0, .2, 0], [0, -.05, 0], [-.4, -.05, 1.6], [-.4, .02, 2.4]], COL.teal, .9, true));
    P.service = K.add(K.holoBox(1.2, .35, 1.0, COL.white, .04, .6)); setP(P.service, [-1.4, -.0, 1.7]);
    P.wrench = chip(K, 'wrench', COL.white, [-1.4, .55, 1.7], .32);
    // 硬点与专业
    const hp = [[wc[0].x, wc[0].y, wc[0].z], [wc[2].x, wc[2].y, wc[2].z], [.1, .72, -.37], [-.2, 1.38, 0], [1.14, .26, .6], [-1.17, .26, .6], [2.3, .5, 0], [-2.32, .55, 0]];
    P.hp = hp.map(p => hardpoint(K, p));
    P.roles = [['palette', COL.pink, -2.8], ['seat', COL.teal, -1.4], ['bolt', COL.amber, 0], ['chip', COL.violet, 1.4], ['gear', COL.blue, 2.8]].map(([ic, col, al]) => { const p = B4.at([0, 2.15, 0], al, -.8); return {b: chip(K, ic, col, p, .36), l: link(K, p, hp[Math.abs(Math.round(al * 2)) % hp.length], col, .1), p}; });
    P.goal = K.add(K.ring(.36, COL.green, .014)); setP(P.goal, B4.at([0, 2.65, 0], 0, -1.2)); P.goal.rotation.y = B4.ry; P.goalIcon = chip(K, 'target', COL.green, P.goal.position.toArray(), .36);
    P.loop = link(K, [.75, .7, -.37], P.goal.position.toArray(), COL.amber, .6, true);
    // 确认
    P.shell = K.add(K.line(profileCurve(car, {z: 0}), COL.green, .9)); P.shell2 = K.add(K.line(profileCurve(car, {z: .85}), COL.green, .6)); P.shell3 = K.add(K.line(profileCurve(car, {z: -.85}), COL.green, .6));
    P.lockI = chip(K, 'lock', COL.green, [0, 1.85, 0], .36);
    P.side = [['palette', COL.pink, -3.0], ['gear', COL.blue, 3.0]].map(([ic, col, al]) => { const p = B5.at([0, 1.1, 0], al, -.5); return {b: chip(K, ic, col, p, .46), l: link(K, p, [al > 0 ? 1.4 : -1.4, 1.0, 0], col, .2), p}; });
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    // 1 统一坐标
    const g0 = c.p(0, 0, 0, 1);
    car.set('paint', 1 - .9 * g0); car.set('ghost', g0);
    P.dims.forEach((d, i) => op(d, stagger(c.p(0, 1, 0, 2), i, 4) * c.out(1, 0)));
    P.boxes.forEach((b, i) => { op(b, stagger(c.p(0, 1.3, 0, 2.3), i, 4) * c.out(1, 0)); });
    P.axes.forEach((a, i) => { op(a, c.show(0, 2, 1, 0)); K.growTube(a, c.p(0, 2, 0, 2.6)); });
    S.show('battery', c.show(0, 1.3, 4, 0) * .8); S.show('drive', c.show(0, 1.5, 4, 0) * .7); S.show('cabin', c.show(0, 1.6) * .6);
    // 2 剖开
    const cut = c.show(1, 0, 3, 0);
    if (cut > 0) { car.clip([0, 0, -1], lerp(1.2, 0, c.p(1, 0, 1, .8))); car.set('paint', .9); car.set('ghost', .3); }
    op(P.cut, cut); K.drawLine(P.cut, c.p(1, 0, 1, 1));
    S.show('occupant', c.show(1, 1, 3, 0) * .9); S.sub(S.occupant.front2, 0); S.sub(S.occupant.rear, 0);
    P.vert.forEach((d, i) => op(d, stagger(c.p(1, 1, 1, 'end'), i, 3) * c.out(3, 0)));
    op(P.squeeze, c.show(1, 1.8, 2, 1) * (.6 + .4 * Math.sin(t * 6)));
    // 3 调整
    const adj = c.p(2, 0, 2, .8);
    S.occupant.front.position.y += .07 * adj; S.battery.g.scale.y = 1 + .25 * adj;
    op(P.roofNew, c.show(2, .3, 3, 0)); K.drawLine(P.roofNew, c.p(2, .3, 2, 1));
    // 4 冲突与活动空间
    op(P.clash, c.show(3, 0, 4, 0) * (.5 + .5 * Math.sin(t * 8))); op(P.clashWarn, c.show(3, 0, 4, 1));
    const st = c.show(3, 1, 4, 0); op(P.steer, st); car.wheels[0].rotation.y = car.wheels[1].rotation.y = .5 * Math.sin((t - c.T(3, 1)) * 2.4) * st;
    op(P.path, c.show(3, 1.4, 4, 0)); K.drawLine(P.path, c.p(3, 1.4, 3, 2));
    const out = c.p(3, 1.6, 3, 2.4) * c.out(4, 0); if (c.after(3, 1.6)) { S.battery.g.position.set(-.4 * out, -.25 * out, 1.6 * out); }
    op(P.service, c.show(3, 2, 4, 0)); op(P.wrench, c.show(3, 2, 4, 0));
    // 5 硬点协调
    const h5 = c.show(4, 0, 5, 1);
    P.hp.forEach((h, i) => { op(h, h5 * stagger(c.p(4, 0, 4, .6), i, 8)); h.position.y += .04 * Math.sin(t * 2 + i) * c.show(4, .5, 4, 1); h.scale.setScalar(1 + .4 * c.pulse(4, .4 + i * .05, .8)); });
    P.roles.forEach((r, i) => { const k = stagger(c.p(4, .3, 4, 1), i, 5); op(r.b, k * c.out(5, 0)); op(r.l, k * c.out(5, 0)); K.drawLine(r.l, k); });
    op(P.goal, c.show(4, 1, 5, 0)); op(P.goalIcon, c.show(4, 1, 5, 0)); op(P.loop, c.show(4, 1, 5, 0)); K.drawLine(P.loop, c.p(4, 1, 4, 1.6));
    P.goal.scale.setScalar(1 + .25 * c.pulse(4, 1.6, 1.2));
    // 6 确认
    const ok = c.show(5, 0);
    [P.shell, P.shell2, P.shell3].forEach((l, i) => { op(l, ok); K.drawLine(l, c.p(5, 0, 5, .8)); });
    op(P.lockI, c.show(5, .6));
    P.side.forEach((s, i) => { const k = stagger(c.p(5, 1, 5, 'end'), i, 2); op(s.b, k); op(s.l, k); K.drawLine(s.l, k); });
    if (ok > 0) { car.set('ghost', 1 - ok * .6); car.set('paint', ok * .9); car.set('edges', .3 * ok); }
  }
};

// ———————————————————— demand-3 建立开发计划与技术基线 ————————————————————
const C0 = axes(30);
export const demand3 = {
  phases: ['拆分任务', '理清先后与并行', '评审并形成基线'],
  shots: [
    {title: '目标拆成任务', detail: '整车目标拆成一条条任务块，每块挂上输入、交付和完成条件'},
    {title: '先后依赖', detail: '布置边界先完成，箭头把结果传给造型和结构两条任务'},
    {title: '大量并行', detail: '造型、结构、电驱、智能电子四条任务同时推进，并不断交换条件'},
    {title: '变更同步', detail: '一处接口变更沿协作线传开；没跟上的一方被标出后再更新'},
    {title: '阶段评审', detail: '评审门扫过任务，通过的变绿进入下一轮，未关闭的留下'},
    {title: '形成基线', detail: '通过的成果锁进基线平台，之后的修改带着原因与影响挂在记录上'}
  ],
  cams: [
    [{tg: [-.6, 1.2, -.6], r: 10.5, az: 30, el: 14}],
    [{tg: [-.6, 1.3, -.6], r: 10, az: 30, el: 12}],
    [{tg: [-.6, 1.2, -.6], r: 10.5, az: 34, el: 14}],
    [{tg: [-.6, 1.25, -.6], r: 10, az: 30, el: 12}],
    [{tg: [-.6, 1.2, -.6], r: 10.5, az: 26, el: 16}],
    [{tg: [-.2, .9, -.3], r: 10, az: 32, el: 20}]
  ],
  build(K, S, car) {
    const P = {};
    const lanes = [COL.teal, COL.pink, COL.blue, COL.amber, COL.violet];
    // 计划板：在车后方、正对镜头；x 方向为时间
    P.board = K.add(new THREE.Group()); setP(P.board, C0.at([0, .55, 0], -.4, -2.6)); P.board.rotation.y = C0.ry;
    const defs = [[-3.2, 2.2, 1.2, lanes[0]], [-1.9, 1.8, 1.8, lanes[1]], [-1.9, 1.4, 1.6, lanes[2]], [-1.6, 1.0, 1.9, lanes[3]], [-1.5, .6, 2.2, lanes[4]], [.2, 1.8, 1.4, lanes[1]], [.0, 1.4, 1.5, lanes[2]], [.4, 1.0, 1.2, lanes[3]], [.8, .6, 1.3, lanes[4]], [1.9, 2.2, 1.0, COL.green]];
    P.bars = defs.map(([x, y, w, col]) => { const b = K.holo(new THREE.BoxGeometry(w, .2, .1), col, .32, 1); b.position.set(x + w / 2, y, 0); P.board.add(b); b.userData = {...b.userData, x, y, w, col}; return b; });
    P.lanesBase = K.add(new THREE.Group()); P.board.add(P.lanesBase);
    P.src = K.add(K.ring(.32, COL.green, .014)); setP(P.src, C0.at([0, 2.2, 0], -3.6, -2.4)); P.src.rotation.y = C0.ry; P.srcI = chip(K, 'target', COL.green, P.src.position.toArray(), .34);
    const w = (b) => P.board.localToWorld(b.position.clone()).toArray();
    P.io = ['link', 'doc', 'check'].map((ic, i) => chip(K, ic, [COL.cyan, COL.white, COL.green][i], [0, 0, 0], .28));
    P.dep = [[0, 1], [0, 2]].map(([a, b]) => { const l = K.add(K.line([[0, 0, 0], [0, 0, 0]], COL.white, .9)); l.userData.ab = [a, b]; return l; });
    P.lay = K.add(K.holoBox(2.3, .9, 1.6, COL.teal, .06, .9)); setP(P.lay, [0, .55, 0]);
    P.sketch = K.add(K.line(profileCurve(car, {z: .95}), COL.pink, .9));
    P.exch = [[1, 2], [2, 3], [3, 4], [1, 4]].map(([a, b], i) => { const f = K.add(K.flow([[0, 0, 0], [0, 1, 0]], {color: COL.cyan, n: 8, size: 6, speed: .9})); f.userData.ab = [a, b]; return f; });
    P.change = K.add(K.ring(.2, COL.amber, .012)); P.stale = chip(K, 'warn', COL.amber, [0, 0, 0], .3);
    P.gate = K.add(K.holoBox(.06, 2.4, .6, COL.green, .2, 1)); P.board.add(P.gate); P.gate.position.set(-3.3, 1.4, 0);
    P.oks = P.bars.map(() => chip(K, 'check', COL.green, [0, 0, 0], .2));
    P.base = K.add(K.holoBox(5.6, .06, 2.6, COL.green, .12, .9)); setP(P.base, [0, .015, 0]);
    P.lockI = chip(K, 'lock', COL.green, [2.6, .5, 1.3], .38);
    P.hist = docStack(K, 4, COL.amber, .3, .4); setP(P.hist, [2.9, .1, -.9]);
    P.histLink = link(K, [2.9, .3, -.9], [1.2, .6, -.2], COL.amber, .2, true);
    P._w = w;
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, w = P._w;
    P.board.visible = true;
    car.set('edges', .2);
    // 1 拆任务
    op(P.src, c.show(0, 0, 1, 0)); op(P.srcI, c.show(0, 0, 1, 0));
    P.bars.forEach((b, i) => {
      const k = stagger(c.p(0, 0, 0, 1), i, 10, .6);
      op(b, k); b.scale.set(Math.max(.02, k), 1, 1);
      const xx = b.userData.x + b.userData.w / 2; b.position.x = lerp(-3.6, xx, k); b.position.y = lerp(2.2, b.userData.y, k);
    });
    const hi = P.bars[3]; hi.scale.y = 1 + .6 * c.show(0, 1, 1, 0);
    P.io.forEach((io, i) => { const p = w(hi); const k = stagger(c.p(0, 1, 0, 'end'), i, 3); op(io, k * c.out(1, 0)); setP(io, [p[0] + (i - 1) * .55 * C0.right[0], p[1] + .35, p[2] + (i - 1) * .55 * C0.right[2]]); });
    // 2 先后依赖
    op(P.lay, c.show(1, 0, 1, 2) * .9); P.bars[0].scale.y = 1 + .5 * c.show(1, 0, 2, 0);
    P.dep.forEach((l, i) => { const [a, b] = l.userData.ab; const pa = w(P.bars[a]), pb = w(P.bars[b]); const pts = [[pa[0] + C0.right[0] * .6, pa[1], pa[2] + C0.right[2] * .6], [pb[0] - C0.right[0] * .7, pb[1], pb[2] - C0.right[2] * .7]]; l.geometry.setFromPoints(pts.map(p => new THREE.Vector3(...p))); op(l, c.show(1, .5 + i * .6, 3, 0)); });
    op(P.sketch, c.show(1, 2, 2, 0)); K.drawLine(P.sketch, c.p(1, 2, 1, 'end')); S.show('biw', c.show(1, 2.2, 2, 0) * .7);
    // 3 并行
    const par = c.show(2, 0, 3, 0);
    [1, 2, 3, 4].forEach(i => P.bars[i].scale.y = 1 + .35 * par * (.5 + .5 * Math.sin(t * 3 + i)));
    P.exch.forEach((f, i) => { const [a, b] = f.userData.ab; const pa = w(P.bars[a]), pb = w(P.bars[b]); f.userData.update = f.userData.update; const cur = new THREE.LineCurve3(new THREE.Vector3(...pa), new THREE.Vector3(...pb)); const pos = f.geometry.attributes.position, ak = f.geometry.attributes.aK; for (let j = 0; j < 8; j++) { const u = ((t * .9 + j / 8 + i * .2) % 1); const v = cur.getPoint(u); pos.setXYZ(j, v.x, v.y, v.z); ak.setX(j, .8); } pos.needsUpdate = ak.needsUpdate = true; op(f, c.show(2, 2, 3, 0)); });
    car.set('edges', Math.max(.2, c.show(2, 1, 3, 0) * .7)); S.show('biw', Math.max(0, c.show(2, 1, 3, 0) * .6)); S.show('drive', c.show(2, 1, 3, 0) * .7); S.show('eea', c.show(2, 1, 3, 0) * .7);
    if (c.between(2, 1, 3, 0)) { car.set('paint', .25); car.set('ghost', .8); }
    // 4 变更同步
    const ch = c.p(3, 0, 3, 1.2), b2 = w(P.bars[2]);
    op(P.change, c.show(3, 0, 4, 0) * (1 - ch * .3)); setP(P.change, b2); P.change.rotation.y = C0.ry; P.change.scale.setScalar(1 + 5 * ch);
    [1, 3].forEach((i, k) => { const lit = c.pulse(3, .5 + k * .3, 1.2); P.bars[i].scale.y = 1 + lit; });
    const st = c.show(3, 1.3, 3, 2.6); op(P.stale, st); const p4 = w(P.bars[4]); setP(P.stale, [p4[0], p4[1] + .35, p4[2]]); P.bars[4].userData.edge.material.opacity = 1 - .8 * st;
    // 5 阶段评审
    const g = c.lin(4, 0, 4, 1.2); op(P.gate, c.show(4, 0, 5, 0)); P.gate.position.x = lerp(-3.4, 3.1, g);
    P.bars.forEach((b, i) => { const pass = i !== 7 && b.position.x + b.userData.w / 2 < P.gate.position.x; const k = c.show(4, 0, 5, 1) * (pass ? 1 : 0); op(P.oks[i], k); const p = w(b); setP(P.oks[i], [p[0], p[1] + .27, p[2]]); if (i === 7 && c.after(4, 1)) op(b, .35 + .3 * Math.sin(t * 6)); });
    // 6 基线
    const bl = c.p(5, 0, 5, 1);
    op(P.base, c.show(5, 0)); P.base.scale.set(bl, 1, bl);
    P.bars.forEach((b, i) => { if (c.after(5, 0) && i !== 7) { b.position.y = lerp(b.position.y, .2 + (i % 5) * .02, c.p(5, 0, 5, 1) * 0); } });
    op(P.lockI, c.show(5, .7));
    op(P.hist, c.show(5, 1)); P.hist.userData.sheets.forEach((s, i) => s.position.y = i * .04 * stagger(c.p(5, 1, 5, 'end'), i, 4) + .02);
    op(P.histLink, c.show(5, 1.3)); K.drawLine(P.histLink, c.p(5, 1.3, 5, 'end'));
    if (c.after(5, 0)) { car.set('paint', 1); car.set('ghost', 0); car.set('edges', .25 + .3 * c.pulse(5, .5, 2)); }
  }
};
