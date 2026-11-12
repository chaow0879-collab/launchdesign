// 第 3 阶段：CAS 数字造型
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, stagger, axes, dim, hardpoint, profileCurve, docStack, cad, featureLines, curvComb, section, ctrlNet, THREE} from './lib.js';

function skeleton(K, car, color = COL.cyan) {
  const pr = car.profile.filter((b, i) => i % 2 === 0);
  const top = K.add(K.line(pr.map(b => [b.x, b.top, 0]), color, .95));
  const sides = [1, -1].map(s => K.add(K.line(pr.filter(b => b.x > -2.3 && b.x < 2.3).map(b => [b.x, Math.min(b.top, .9), s * (b.half + .01)]), color, .9)));
  const plan = [1, -1].map(s => K.add(K.line(pr.map(b => [b.x, .3, s * Math.max(.5, b.half * .95)]), color, .7)));
  const secs = [-1.9, -1.2, -.4, .4, 1.2, 1.9].map(x => K.add(K.line(section(car, x), color, .9)));
  return {top, sides, plan, secs};
}

export const cas1 = {
  phases: ['控制线与断面', '生成曲面', '控制网与复核'],
  shots: [
    {title: '建立控制线', detail: '车顶中线、两侧肩线和平面轮廓先画出，再用多道截面连成三维骨架'},
    {title: '检查断面', detail: '放大一道截面，曲率梳显示饱满程度与走向，并与草图意图叠合比对'},
    {title: '逐段生成曲面', detail: '曲面从车头向车尾逐段铺开，车头、座舱、车尾连成整体'},
    {title: '控制网调形', detail: '控制网展开，拉动少数几个控制点，曲面随之平顺变化'},
    {title: '接缝与布置边界', detail: '分缝位置亮起检查；乘员与车轮的布置边界放进来，确认曲面没有侵入'},
    {title: '回看整体', detail: '数字模型绕车一周复看比例姿态，准备交给深化与实物评审'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 8.6, az: 40, el: 18}],
    [{tg: [-.4, .9, 0], r: 4.4, az: 5, el: 8, drift: 0}],
    [{tg: [0, .7, 0], r: 8.4, az: 50, el: 16}],
    [{tg: [0, .8, 0], r: 7.4, az: 35, el: 38}],
    [{tg: [.4, .7, 0], r: 7.4, az: 60, el: 14}],
    [{tg: [0, .7, 0], r: 8.6, az: 30, el: 14}, {b: 1, tg: [0, .7, 0], r: 8.6, az: 150, el: 14, dur: 3.6}]
  ],
  build(K, S, car) {
    const P = {};
    P.sk = skeleton(K, car);
    const sx = -.4, pts = section(car, sx, 40);
    P.sec = K.add(K.line(pts, COL.white, 1));
    P.comb = curvComb(K, pts, COL.amber, .3);
    P.intent = K.add(K.line(pts.map(p => [p[0] + .002, p[1] + .015 * Math.cos(p[2] * 3), p[2]]), COL.pink, .9, true));
    P.okSec = chip(K, 'check', COL.green, [sx, 1.75, .6], .3);
    P.net = ctrlNet(K, car, 9, 5);
    P.pick = [[20, 22], [12, 0], [30, 0]]; // 被拉动的控制点索引
    P.seams = [1.0, -.05, -1.15].map(x => K.add(K.line(section(car, x).map(p => [p[0], p[1] + .005, p[2]]), COL.amber, .95)));
    P.bound = [K.add(K.holoBox(.5, .3, .5, COL.green, .05, .8)), K.add(K.holoBox(.9, .85, .3, COL.green, .04, .7)), K.add(K.holoBox(.9, .85, .3, COL.green, .04, .7))];
    setP(P.bound[0], [-.1, 1.18, -.37]); setP(P.bound[1], [car.wheelCenters[0].x, .4, .82]); setP(P.bound[2], [car.wheelCenters[2].x, .4, .82]);
    P.okB = chip(K, 'check', COL.green, [-.1, 1.75, -.37], .3);
    P.next = [['search', COL.cyan, [2.6, 1.6, -1.2]], ['box', COL.amber, [-2.6, 1.6, -1.2]]].map(([ic, col, p]) => chip(K, ic, col, p, .4));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, sk = P.sk;
    car.set('paint', 0); car.set('wheels', 0);
    // 1 控制线
    const live = c.out(2, 1.5, 1.2);
    op(sk.top, c.in(0, 0) * live); K.drawLine(sk.top, c.p(0, 0, 0, .6));
    sk.sides.forEach((l, i) => { op(l, c.in(0, .3) * live); K.drawLine(l, c.p(0, .3, 0, .9)); });
    sk.plan.forEach((l, i) => { op(l, c.in(0, .5) * live * .8); K.drawLine(l, c.p(0, .5, 0, 1)); });
    sk.secs.forEach((l, i) => { op(l, c.in(0, 1) * live * (i === 2 ? (1 - c.show(1, 0, 2, 0) * .0) : 1)); K.drawLine(l, stagger(c.p(0, 1, 0, 'end'), i, 6)); });
    // 2 截面
    const s2 = c.show(1, 0, 2, .3);
    op(P.sec, s2); op(P.comb, c.show(1, .5, 2, .3)); K.drawLine(P.comb, c.p(1, .5, 1, 1.5));
    op(P.intent, c.show(1, 2, 2, .3)); op(P.okSec, c.show(1, 2.4, 2, .3));
    // 3 生成曲面：从车头向车尾
    const grow = c.p(2, 0, 2, 2.2);
    if (c.after(2, 0)) { cad(car, 1); car.clip([1, 0, 0], lerp(-2.5, 2.5, grow)); car.set('wheels', grow); car.set('edges', .35 * c.show(2, 0, 3, 0)); }
    // 4 控制网
    const nk = c.show(3, 0, 4, 0);
    op(P.net, nk);
    const pull = c.p(3, 1, 3, 1.8) * (1 - c.p(3, 2.2, 3, 'end') * .4);
    P.net.userData.dots.forEach((d, i) => { d.position.copy(d.userData.home); d.scale.setScalar(1); });
    const center = P.net.userData.dots[22].userData.home;
    if (nk > 0) {
      P.net.userData.dots.forEach((d, i) => { const dd = d.userData.home.distanceTo(center); const w = Math.exp(-dd * dd / .5); d.position.y += .18 * pull * w; if (i === 22) d.scale.setScalar(1.8); });
      car.setDeformScale(.2); car.setDeformFollow(true);          // 漆面/油泥跟随同一个 uDeform，控制点拉动时曲面真的鼓起来
      cad(car, 1, {center: [center.x, center.y - .04, center.z], radius: .6, amount: 2.2 * pull, lit: .9 * nk});
    } else { car.setDeformScale(.08); car.setDeformFollow(false); }   // 其余镜头回到原系数与关闭状态，行为不变
    P.net.userData.refresh();
    // 5 接缝与边界
    P.seams.forEach((l, i) => { op(l, c.show(4, 0, 5, 0)); K.drawLine(l, stagger(c.p(4, 0, 4, 1), i, 3)); });
    P.bound.forEach((b, i) => op(b, c.show(4, 1, 5, .5) * stagger(c.p(4, 1, 4, 1.8), i, 3)));
    op(P.okB, c.show(4, 1.8, 5, .5)); S.show('occupant', c.show(4, 1, 5, .5) * .7); S.sub(S.occupant.front2, 0); S.sub(S.occupant.rear, 0);
    // 6 回看整体
    if (c.after(5, 0)) { cad(car, 1 - c.p(5, 1.5, 5, 'end')); car.set('paint', c.p(5, 1.5, 5, 'end')); }
    P.next.forEach((n, i) => op(n, c.show(5, 2) * stagger(c.p(5, 2, 5, 'end'), i, 2)));
  }
};

// ———————————————————— cas-2 生成特征线与功能开口 ————————————————————
export const cas2 = {
  phases: ['梳理特征线', '灯具与门窗开口', '局部修形与回整车'],
  shots: [
    {title: '梳理特征线', detail: '肩线、轮拱、窗框、门缝与灯具边界依次在数字模型上亮起'},
    {title: '灯具内部条件', detail: '放大前灯：光学模组、散热片和安装支架在外形之下就位，光束射出'},
    {title: '门窗与分缝', detail: '门缝逐段展开，车门绕铰链打开，密封线与装配间隙同时显示'},
    {title: '局部修形', detail: '拉动翼子板附近的控制点，特征保持清晰，影响范围被限定在光圈内'},
    {title: '检查装配细节', detail: '特征线与相邻部件边界叠在一起，错位处变红，调整对齐后转绿'},
    {title: '回到整车比例', detail: '镜头退回整车，特征线与车漆一起复看整体协调'}
  ],
  cams: [
    [{tg: [.3, .75, 0], r: 8.0, az: 35, el: 12}],
    [{tg: [2.1, .72, .55], r: 2.6, az: 30, el: 10}],
    [{tg: [-.1, .75, .4], r: 6.2, az: 75, el: 10}],
    [{tg: [1.6, .75, .5], r: 3.8, az: 50, el: 30}],
    [{tg: [1.8, .7, .5], r: 3.6, az: 25, el: 14}],
    [{tg: [0, .7, 0], r: 8.6, az: 32, el: 14}]
  ],
  build(K, S, car) {
    const P = {};
    P.fl = featureLines(K, car, COL.cyan);
    P.order = ['shoulder', 'archF', 'archR', 'win', 'winB', 'door0', 'door1', 'door2', 'lampF', 'lampR'];
    // 前灯内部
    const lp = [2.0, .72, .6];
    P.lens = K.add(K.solid(new THREE.SphereGeometry(.06, 20, 14), 0xbfe8ff, {metal: .1, rough: .05, emissive: COL.white, ei: 1.2})); setP(P.lens, [lp[0] + .02, lp[1], lp[2]]);
    const sinkG = new THREE.Group(); for (let i = 0; i < 6; i++) { const f = K.solid(new THREE.BoxGeometry(.012, .1, .14), 0x9aa8b3, {metal: .9, rough: .3}); f.position.set(-.08 - i * .025, 0, 0); sinkG.add(f); } setP(sinkG, lp);
    // 灯组沿 +x 安装路径插进灯腔，抵到安装座就停；越过接触点的进度只换成 5% 轴向压紧，不再前进
    P.seat = K.add(K.holoBox(.05, .18, .22, COL.green, .14, .9)); setP(P.seat, [1.975, lp[1], lp[2]]);
    P.ins = K.add(K.stopAt(sinkG, [[-.42, 0, 0], [0, 0, 0]], 1, {squash: .05}));
    P.sink = P.ins.children[0];
    P.brk = [[lp[0] - .05, lp[1] - .08, lp[2] - .1], [lp[0] - .05, lp[1] - .08, lp[2] + .1]].map(p => { const b = K.add(K.glow(new THREE.CylinderGeometry(.012, .012, .06, 10), COL.amber, 2.2)); setP(b, p); return b; });
    P.beam = K.add(new THREE.Mesh(new THREE.ConeGeometry(.5, 3.2, 32, 1, true), new THREE.MeshBasicMaterial({color: new THREE.Color(0xfff3d6).multiplyScalar(1.3), transparent: true, opacity: .12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}))); P.beam.rotation.z = Math.PI / 2; setP(P.beam, [lp[0] + 1.7, lp[1] - .05, lp[2]]);
    P.lampIcons = [['eye', COL.white], ['thermo', COL.amber], ['wrench', COL.cyan]].map(([ic, col], i) => chip(K, ic, col, [lp[0] + .1, lp[1] + .38, lp[2] + (i - 1) * .32], .22));
    // 车门（全息门板），铰链在前缘
    const dpts = [[0, 0], [-1.05, 0], [-1.1, .55], [-.95, .95], [-.1, .98], [0, .6]];
    const shape = new THREE.Shape(dpts.map(([x, y]) => new THREE.Vector2(x, y)));
    P.door = K.add(new THREE.Group()); setP(P.door, [1.0, .38, .92]);
    const dm = K.holo(new THREE.ShapeGeometry(shape), COL.cyan, .12, 1); P.door.add(dm);
    P.seal = K.add(K.line([...dpts, dpts[0]].map(([x, y]) => [1.0 + x, .38 + y, .9]), COL.green, .95));
    P.gap = [dim(K, [1.0, .55, .95], [1.0, .55, 1.15], COL.white, .06)];
    // 铰链行程：门自由边沿圆弧开到限位角（1.62rad ≈ 93°）就被限位块挡住；行程多走的 6% 只换算成 ≤8mm 的让位
    P.arc = Array.from({length: 25}, (_, i) => { const a = i / 24 * 1.70; return [1.0 - Math.cos(a) * 1.05, .88, .92 + Math.sin(a) * 1.05]; });
    P.limit = K.add(K.holoBox(.14, .09, .09, COL.green, .22, .95)); setP(P.limit, [1.0515, .88, 1.9687]);
    P.hinge = K.add(K.stopAt(K.glow(new THREE.SphereGeometry(.03, 12, 8), COL.amber, 3), P.arc, .953, {push: .008, axis: 'y'}));
    P.arcLine = K.add(K.line(P.arc, COL.cyan, .55));
    // 局部控制点
    P.net = ctrlNet(K, car, 9, 5, COL.cyan);
    P.zone = K.add(K.ring(.45, COL.cyan, .01)); P.zone.rotation.x = -Math.PI / 2;
    // 接口错位
    P.misA = K.add(K.line([[2.0, .6, .82], [2.25, .62, .7], [2.32, .65, .5]], COL.red, .95)); P.misB = K.add(K.line([[1.98, .66, .84], [2.24, .68, .72], [2.33, .7, .52]], COL.amber, .95));
    P.okI = chip(K, 'check', COL.green, [2.2, 1.0, .7], .26); P.warnI = chip(K, 'warn', COL.red, [2.2, 1.0, .7], .26);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, fl = P.fl;
    cad(car, 1 - c.p(5, .3, 5, 1.2)); car.set('paint', c.p(5, .3, 5, 1.2));
    // 1 特征线
    P.order.forEach((k, i) => [1, -1].forEach(s => { const l = fl[k + s]; if (!l) return; const kk = stagger(c.p(0, .5, 0, 'end'), i, P.order.length, .4); op(l, kk * (1 - .55 * c.show(1, 0, 5, 0))); K.drawLine(l, kk); }));
    // 2 灯具
    const lamp = c.show(1, 0, 2, .2);
    op(fl.lampF1, Math.max(fl.lampF1.visible ? 1 : 0, lamp)); fl.lampF1.scale.setScalar(1);
    op(P.lens, c.show(1, .6, 2, .2)); op(P.seat, c.show(1, .9, 2, .2));
    const ins = P.ins.userData.travel(c.p(1, 1.1, 1, 1.9) * 1.05);   // 行程留 5% 余量，被安装座吃掉（压紧）
    op(P.ins, c.show(1, 1, 2, .2)); P.lens.position.x = P.sink.position.x + .02;
    P.brk.forEach(b => op(b, c.show(1, 1.5, 2, .2)));
    op(P.beam, c.show(1, .8, 2, .2) * (.7 + .3 * Math.sin(t * 3)));
    P.lampIcons.forEach((ic, i) => op(ic, c.show(1, .9 + i * .5, 2, .2)));
    if (lamp > 0) cad(car, .55);
    // 3 门窗
    ['door01', 'door11', 'door21'].forEach((k, i) => { op(fl[k], c.show(2, 0, 3, 0)); K.drawLine(fl[k], stagger(c.p(2, 0, 2, 1), i, 3)); });
    const open = c.p(2, 1, 2, 2) * (1 - c.p(2, 2.6, 2, 'end'));
    op(P.door, c.show(2, 1, 3, 0));
    const hg = P.hinge.userData.travel(open * 1.06);                                  // 越界进度只换成让位，门不再开大
    P.door.rotation.y = 1.62 * Math.min(1, hg.u / P.hinge.userData.stopU);           // 开到 93° 限位角停住
    op(P.hinge, c.show(2, 1, 3, 0)); op(P.limit, c.show(2, 1.1, 3, 0));
    op(P.arcLine, c.show(2, 1.1, 3, 0) * .5); K.drawLine(P.arcLine, c.p(2, 1.1, 2, 2.3));
    op(P.seal, c.show(2, 1.6, 3, 0)); K.drawLine(P.seal, c.p(2, 1.6, 2, 2.2)); op(P.gap[0], c.show(2, 2, 3, 0));
    // 4 局部修形
    const nk = c.show(3, 0, 4, 0); op(P.net, nk);
    const pull = c.p(3, .5, 3, 1.4) * (1 - c.p(3, 2, 3, 'end') * .5);
    const dots = P.net.userData.dots, cidx = 37, cen = dots[cidx].userData.home;
    dots.forEach(d => { d.position.copy(d.userData.home); const dd = d.userData.home.distanceTo(cen); d.position.y += .14 * pull * Math.exp(-dd * dd / .25); });
    P.net.userData.refresh();
    if (nk > 0) cad(car, 1, {center: [cen.x, cen.y - .03, cen.z], radius: .42, amount: 1.6 * pull, lit: .8});
    op(P.zone, nk * c.show(3, 1.5)); setP(P.zone, [cen.x, cen.y + .06, cen.z]); P.zone.scale.setScalar(1 + .1 * Math.sin(t * 4));
    // 5 接口
    const fix = c.p(4, 1, 4, 1.7);
    op(P.misA, c.show(4, 0, 5, 0)); op(P.misB, c.show(4, 0, 5, 0)); P.misB.position.y = -.06 * fix; P.misB.position.z = -.02 * fix;
    P.misA.material.color.set(new THREE.Color(fix > .9 ? COL.green : COL.red).multiplyScalar(1.5));
    op(P.warnI, c.show(4, .4, 4, 1.4)); op(P.okI, c.show(4, 1.7, 5, 0));
    // 6 回整车
    if (c.after(5, 0)) P.order.forEach(k => [1, -1].forEach(s => { const l = fl[k + s]; if (l) op(l, .6 * (1 - c.p(5, 1, 5, 'end') * .6)); }));
  }
};

// ———————————————————— cas-3 对比版本并迭代模型 ————————————————————
const A0 = axes(30);
export const cas3 = {
  phases: ['新旧版本对照', '同一基准比对', '修改复核与发布'],
  shots: [
    {title: '两版分开展示', detail: '旧版与新版并排；修改范围用框标出，对应的评审要求挂在旁边'},
    {title: '颜色定位差异', detail: '新版表面按差异着色，车头和车顶的变化一眼可见'},
    {title: '对齐同一坐标', detail: '两版先错位叠合、满车都是差异；按基准对齐后，只剩真正的变化'},
    {title: '调整与影响', detail: '按意见拉动控制点，连线检查布置、接口和下游数据受到的影响'},
    {title: '重新叠合扫描', detail: '扫描面掠过叠合模型，差异区逐个转绿，没有新冲突'},
    {title: '统一版本发布', detail: '确认版本带着修改记录发给各专业，大家用同一份数据'}
  ],
  cams: [
    [{tg: [0, .7, -.8], r: 11, az: 30, el: 18}],
    [{tg: [0, .8, 0], r: 7.4, az: 38, el: 20}],
    [{tg: [0, .7, 0], r: 8.4, az: 40, el: 18}],
    [{tg: [.4, .8, 0], r: 7.6, az: 30, el: 26}],
    [{tg: [0, .7, 0], r: 8.2, az: 55, el: 16}],
    [{tg: [0, .8, 0], r: 10, az: 30, el: 20}]
  ],
  build(K, S, car) {
    const P = {};
    P.old = car.makeClone(0x7a8ea3); K.add(P.old); setP(P.old, A0.at([0, 0, 0], 0, -2.6)); P.old.userData.home = P.old.position.toArray();
    P.old.traverse(o => { if (o.material && o.userData.isPaint) { o.material.color.set(0x8193a6); o.material.roughness = .55; o.material.clearcoat = 0; } });
    // 两版差的是尺寸：旧版车身按 104.5% / 103.5% 摆（车头长 10.6cm、车顶高 5cm），叠合后差异真的从曲面边界上露出来
    P.dimN = dim(K, [2.36, .78, .55], [2.4662, .78, .55], COL.amber, .05);
    P.dimR = dim(K, [-.2, car.heightAt(-.2, 0), 0], [-.2, car.heightAt(-.2, 0) * 1.035, 0], COL.amber, .05);
    P.boxes = [[[2.05, .75, 0], [.6, .5, 1.8], COL.amber], [[-.2, 1.3, 0], [1.6, .25, 1.2], COL.violet]].map(([p, s, col]) => { const b = K.add(K.holoBox(...s, col, .06, .9)); setP(b, p); return b; });
    P.req = chip(K, 'doc', COL.white, [2.6, 1.5, .3], .34); P.reqL = link(K, [2.6, 1.35, .3], [2.2, 1.0, .2], COL.white, .05);
    P.axes = [[1, 0, 0, COL.red], [0, 1, 0, COL.green], [0, 0, 1, COL.blue]].map(([x, y, z, col]) => K.add(K.tube([[0, .02, 0], [x * .9, .02 + y * .9, z * .9]], .012, col, {glow: true})));
    P.net = ctrlNet(K, car, 9, 5, COL.cyan);
    P.imp = [['seat', COL.teal, [-1.5, 1.9, -1.0]], ['link', COL.cyan, [0, 2.05, -1.2]], ['doc', COL.white, [1.5, 1.9, -1.0]]].map(([ic, col, p]) => ({b: chip(K, ic, col, p, .34), l: link(K, [2.0, 1.0, .3], p, col, .2), p}));
    P.sweep = K.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(1.4), transparent: true, opacity: .14, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false}))); P.sweep.rotation.y = Math.PI / 2;
    P.ok = chip(K, 'check', COL.green, [0, 2.0, 0], .4);
    P.ver = K.add(K.ring(.34, COL.green, .014)); setP(P.ver, [0, 2.0, 0]); P.ver.rotation.y = axes(30).ry;
    P.teams = [['palette', COL.pink], ['seat', COL.teal], ['gear', COL.blue], ['check', COL.green]].map(([ic, col], i) => { const p = axes(30).at([0, .9, 0], (i - 1.5) * 1.7, -2.2); return {b: chip(K, ic, col, p, .4), f: K.add(K.flow([[0, 2.0, 0], [p[0] / 2, 2.3, p[2] / 2], p], {color: col, n: 8, size: 6, speed: .7})), p}; });
    P.hist = docStack(K, 4, COL.amber, .3, .4); setP(P.hist, axes(30).at([0, 0, 0], 3.0, .4));
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    cad(car, 1);
    // 1 两版分开
    op(P.old, c.show(0, 0, 4, 1.5) * (c.after(2, 0) ? .45 : 1));
    P.old.scale.set(1.045, 1.035, 1);                                 // 旧版车头长 10.6cm、车顶高 5cm：差异真的错位/超差，不靠颜色
    P.boxes.forEach((b, i) => op(b, c.show(0, 1, 2, 0) * stagger(c.p(0, 1, 0, 1.6), i, 2) * (1 + .3 * c.pulse(1, i, 1.2))));
    op(P.req, c.show(0, 1.5, 1, 0)); op(P.reqL, c.show(0, 1.5, 1, 0));
    // 2 颜色差异
    const diff = c.show(1, 0, 5, 0);
    const u = car.layers.heat.mat.uniforms;
    if (diff > 0) { u.uMode.value = 3; u.uLoad.value = diff; u.uCenter.value.set(2.1, .7, 0); u.uRadius.value = c.after(2, 0) ? .7 : 2.2; }
    // 3 对齐
    const mis = c.p(2, 0, 2, .6), align = c.p(2, 1, 2, 'end');
    const h = P.old.userData.home;
    if (c.after(2, 0)) { setP(P.old, mixV(h, [.32 * (1 - align), .11 * (1 - align), .24 * (1 - align)], mis)); P.old.rotation.y = .07 * (1 - align); if (align < .5 && mis > .5) { u.uRadius.value = 6; u.uLoad.value = 1; } else if (align >= .5) { u.uRadius.value = .7; } }
    else P.old.rotation.y = 0;
    op(P.dimN, c.show(1, .6, 3, 0)); op(P.dimR, c.show(1, 1, 3, 0));   // 对齐后只剩这两处真实尺寸差
    P.axes.forEach((a, i) => { op(a, c.show(2, .8, 3, 0)); K.growTube(a, c.p(2, .8, 2, 1.3)); });
    // 4 控制点与影响
    const nk = c.show(3, 0, 4, 0); op(P.net, nk);
    const pull = c.p(3, .3, 3, 1.1), dots = P.net.userData.dots, cen = dots[40].userData.home;
    dots.forEach(d => { d.position.copy(d.userData.home); const dd = d.userData.home.distanceTo(cen); d.position.y -= .1 * pull * Math.exp(-dd * dd / .3); }); P.net.userData.refresh();
    if (nk > 0) { u.uDeform.value = -1.2 * pull; u.uCenter.value.set(cen.x, cen.y, cen.z); u.uRadius.value = .55; }
    P.imp.forEach((m, i) => { const k = stagger(c.p(3, 1, 3, 'end'), i, 3) * c.out(4, 0); op(m.b, k); op(m.l, k); K.drawLine(m.l, k); });
    // 5 复核
    const sw = c.lin(4, 0, 4, 1.4); op(P.sweep, c.show(4, 0, 4, 1.6) * K.pulse(sw)); setP(P.sweep, [lerp(2.6, -2.6, sw), .8, 0]);
    if (c.after(4, 0)) { u.uLoad.value = lerp(1, 0, c.p(4, 0, 4, 1.4)); u.uDeform.value = -1.2; }
    op(P.ok, c.show(4, 1.5, 5, 0));
    // 6 发布
    op(P.ver, c.show(5, 0)); P.ver.scale.setScalar(1 + .2 * c.pulse(5, 0, 1));
    P.teams.forEach((tm, i) => { const k = stagger(c.p(5, .5, 5, 1.5), i, 4); op(tm.b, k); op(tm.f, c.show(5, .8)); tm.f.userData.update(t, c.lin(5, .8, 5, 1.5)); });
    op(P.hist, c.show(5, 1.5));
    if (c.after(5, 0)) { cad(car, 1 - c.p(5, 0, 5, 1)); car.set('paint', c.p(5, 0, 5, 1)); u.uDeform.value = 0; }
  }
};
