// 第 5 阶段：A 级曲面
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, stagger, axes, dim, hardpoint, section, docStack, lightBars, cad, ctrlNet, curvComb, featureLines, THREE} from './lib.js';

const zebra = (car, k, phase = 0, freq = 26) => { car.set('zebra', k); const u = car.layers.zebra.mat.uniforms; u.uPhase.value = phase; u.uFreq.value = freq; };

export const classa1 = {
  phases: ['看反射找问题', '调控制网与连续性', '复核整体'],
  shots: [
    {title: '反射条纹', detail: '车身换成黑白反射条纹，条纹在表面流动，不自然的折转处被圈出'},
    {title: '放大接缝曲率', detail: '放大相邻曲面的交界，控制点与曲率梳显示问题真正发生的位置'},
    {title: '精修控制网', detail: '调整少量控制点：该平顺处衔接自然，该锐利的特征线保留'},
    {title: '核对连续性', detail: '不同交界按各自要求检查：特征线保持转折，大面要求曲率连续'},
    {title: '重新观察反射', detail: '条纹再次移动，问题处已顺滑，邻近区域光影没有被破坏'},
    {title: '回看整体表面', detail: '回到整车，与造型意图和工程边界一起评审；条纹只用于说明方法'}
  ],
  cams: [
    [{tg: [0, .75, 0], r: 7.8, az: 70, el: 12}],
    [{tg: [1.3, .9, .6], r: 2.8, az: 60, el: 30}],
    [{tg: [1.2, .85, .5], r: 3.8, az: 45, el: 36}],
    [{tg: [.6, .85, .4], r: 4.6, az: 65, el: 22}],
    [{tg: [0, .75, 0], r: 7.4, az: 75, el: 12}],
    [{tg: [0, .75, 0], r: 8.6, az: 32, el: 14}]
  ],
  build(K, S, car) {
    const P = {};
    P.spot = K.add(K.ring(.22, COL.amber, .01)); setP(P.spot, [1.3, car.heightAt(1.3, .7) + .02, .7]); P.spot.rotation.x = -Math.PI / 2;
    P.spotI = chip(K, 'warn', COL.amber, [1.3, 1.35, .7], .28);
    const pts = section(car, 1.3, 40); P.sec = K.add(K.line(pts, COL.white, .9)); P.comb = curvComb(K, pts, COL.amber, .35);
    P.net = ctrlNet(K, car, 11, 5, COL.cyan);
    P.cont = [['G0', COL.white], ['G1', COL.cyan], ['G2', COL.green]].map(([n, col], i) => { const p = [[.9, .95, .9], [-.05, 1.05, .85], [-1.2, .95, .9]][i]; const r = K.add(K.ring(.10 + i * .075, col, .008 + i * .004)); setP(r, p); r.rotation.y = axes(65).ry; return r; });
    // G0/G1/G2 没有文字贴图可用，用语义图标代替：cross=有台阶、link=接上但不顺、check=顺滑（颜色与各自环一致）
    P.contTag = [['cross', COL.white], ['link', COL.cyan], ['check', COL.green]].map(([ic, col], i) => { const p = [[.9, .95, .9], [-.05, 1.05, .85], [-1.2, .95, .9]][i]; return chip(K, ic, col, [p[0], p[1] + .13 + i * .07, p[2]], .22); });
    P.fl = featureLines(K, car, COL.cyan);
    P.box = K.add(K.holoBox(4.9, 1.45, 2.0, COL.green, .02, .5)); setP(P.box, [0, .73, 0]);
    P.ok = chip(K, 'check', COL.green, [1.3, 1.35, .7], .28);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.set('paint', 0); cad(car, .0);
    const zb = c.show(0, 0, 5, 1.2);
    zebra(car, zb, t * 1.4 + (c.after(4, 0) ? 0 : 0), 24);
    op(P.spot, c.show(0, 1, 4, 1) * (.6 + .4 * Math.sin(t * 6))); op(P.spotI, c.show(0, 1.2, 1, 0));
    P.spot.material.color.set(new THREE.Color(c.after(4, 1) ? COL.green : COL.amber).multiplyScalar(2.4));
    op(P.sec, c.show(1, 0, 3, 0)); op(P.comb, c.show(1, .6, 3, 0)); K.drawLine(P.comb, c.p(1, .6, 1, 1.4));
    P.comb.scale.y = 1 - .5 * c.p(2, .5, 2, 1.5);
    const nk = c.show(1, .3, 3, .5); op(P.net, nk);
    const pull = c.p(2, 0, 2, 1.2), dots = P.net.userData.dots, cen = dots[47].userData.home;
    dots.forEach(d => { d.position.copy(d.userData.home); const dd = d.userData.home.distanceTo(cen); d.position.y += .06 * Math.sin(pull * Math.PI) * Math.exp(-dd * dd / .2); }); P.net.userData.refresh();
    P.cont.forEach((r, i) => { const k = c.show(3, 0, 4, 0) * stagger(c.p(3, 0, 3, 1.4), i, 3); op(r, k); op(P.contTag[i], k); });
    ['shoulder1', 'archF1', 'door01'].forEach((k, i) => op(P.fl[k], c.show(3, .3, 4, 0) * .7));
    op(P.ok, c.show(4, 1.2, 5, 1));
    if (c.after(5, 0)) { car.set('paint', c.p(5, 0, 5, 1.4)); op(P.box, c.show(5, 1)); Object.values(P.fl).forEach(l => op(l, c.show(5, 1) * .35)); }
  }
};

// ———————————————————— classa-2 反射线、间隙与工艺校核 ————————————————————
export const classa2 = {
  phases: ['分缝与翻边', '间隙面差与安装', '跨专业复核'],
  shots: [
    {title: '对齐相邻面片', detail: '机盖、车门、翼子板的分缝与开口边界逐条亮起，核对与造型要求一致'},
    {title: '截面看翻边', detail: '在车门处剖开，外板厚度、翻边和连接方式在截面上显出'},
    {title: '间隙与面差', detail: '间隙、面差逐处测量，零件公差像积木一样一层层累加'},
    {title: '安装连接件', detail: '外板后方的安装面与支架就位，按装配顺序依次进入车身'},
    {title: '跨专业复核', detail: '车身、饰件、尺寸、试制各方连到冲突处，共同调整边界'},
    {title: '形成可交接边界', detail: '边界收敛变绿，外观与工程条件合成一个方案'}
  ],
  cams: [
    [{tg: [.4, .75, .3], r: 6.8, az: 50, el: 18}],
    [{tg: [-.05, .7, .6], r: 3.8, az: 200, el: 12, drift: 0}],
    [{tg: [1.0, .8, .8], r: 3.2, az: 60, el: 16}],
    [{tg: [.2, .7, .6], r: 4.6, az: 70, el: 14}],
    [{tg: [.4, .9, .4], r: 7.4, az: 45, el: 20}],
    [{tg: [0, .75, 0], r: 8.6, az: 32, el: 14}]
  ],
  build(K, S, car) {
    const P = {};
    P.fl = featureLines(K, car, COL.cyan);
    P.hood = K.add(K.line([[1.0, .95, .62], [2.0, .82, .58], [2.0, .82, -.58], [1.0, .95, -.62], [1.0, .95, .62]].map(p => [p[0], car.heightAt(p[0], p[2]) + .01, p[2]]), COL.cyan, .9));
    // 截面：外板 + 内板 + 翻边
    const outer = [], inner = []; for (let y = .35; y <= .95; y += .03) { const z = .9 + .05 * Math.sin((y - .35) * 4); outer.push([-.05, y, z]); inner.push([-.05, y, z - .07]); }
    P.outer = K.add(K.line(outer, COL.white, 1)); P.inner = K.add(K.line(inner, COL.amber, .95));
    P.flange = K.add(K.line([outer[0], [-.05, .3, .84], inner[0]], COL.green, 1));
    P.thick = dim(K, [-.05, .65, .9], [-.05, .65, .83], COL.white, .04);
    P.gaps = [[1.0, .7, .935], [-.05, .7, .935], [-1.15, .7, .925]].map(p => K.add(K.ring(.05, COL.green, .006))).map((r, i) => { setP(r, [[1.0, .7, .94], [-.05, .7, .94], [-1.15, .7, .93]][i]); return r; });
    P.stack = [COL.teal, COL.violet, COL.amber, COL.pink].map((col, i) => { const b = K.add(K.holoBox(.18, .05, .08, col, .4, 1)); setP(b, [1.3, 1.25 + i * .07, 1.05]); return b; });
    P.flush = dim(K, [1.0, .55, .94], [1.0, .55, .99], COL.amber, .05);
    P.brk = [[1.3, .55, .8], [.5, .55, .82], [-.6, .55, .82], [1.7, .85, .7]].map(p => { const b = K.add(K.solid(K.rbox(.12, .1, .05, .01), 0x8796a3, {metal: .8, rough: .3})); setP(b, p); return b; });
    P.bolts = P.brk.map(b => { const g = K.add(K.glow(new THREE.CylinderGeometry(.015, .015, .05, 8), COL.amber, 2.4)); g.rotation.x = Math.PI / 2; setP(g, b.position.toArray()); return g; });
    P.roles = [['gear', COL.blue], ['seat', COL.teal], ['ruler', COL.white], ['wrench', COL.amber], ['search', COL.cyan]].map(([ic, col], i) => { const p = axes(45).at([0, 2.0, 0], (i - 2) * 1.0, -.5); return {b: chip(K, ic, col, p, .34), l: link(K, p, [1.0, .9, .9], col, .1)}; });
    P.ok = chip(K, 'check', COL.green, [0, 1.9, 0], .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.set('paint', .0); cad(car, 1);
    const order = ['door01', 'door11', 'door21', 'shoulder1', 'archF1', 'archR1', 'win1', 'lampF1'];
    order.forEach((k, i) => { op(P.fl[k], c.show(0, 0, 5, 0) * stagger(c.p(0, 0, 0, 1.2), i, 8)); K.drawLine(P.fl[k], stagger(c.p(0, 0, 0, 1.2), i, 8)); });
    op(P.hood, c.show(0, .5, 5, 0)); K.drawLine(P.hood, c.p(0, .5, 0, 1.2));
    // 2 截面
    const cut = c.show(1, 0, 2, .2);
    if (cut > 0) car.clip([1, 0, 0], .05);
    op(P.outer, cut); op(P.inner, c.show(1, .4, 2, .2)); op(P.flange, c.show(1, .9, 2, .2)); K.drawLine(P.flange, c.p(1, .9, 1, 1.5)); op(P.thick, c.show(1, .6, 2, .2));
    // 3 间隙面差 + 公差累加
    P.gaps.forEach((r, i) => { op(r, c.show(2, 0, 3, 1) * stagger(c.p(2, 0, 2, 1), i, 3)); r.rotation.y = Math.PI / 2; });
    op(P.flush, c.show(2, .6, 3, 0));
    P.stack.forEach((b, i) => { const k = stagger(c.p(2, 1, 2, 'end'), i, 4); op(b, c.show(2, 1, 3, 0) * k); b.position.y += .4 * (1 - k); });
    // 4 安装
    P.brk.forEach((b, i) => { const k = stagger(c.p(3, 0, 3, 1.4), i, 4); op(b, c.show(3, 0, 4, 1) * k); b.position.z -= .5 * (1 - k); op(P.bolts[i], c.show(3, 1.2, 4, 1) * k); });
    if (c.between(3, 0, 4, 1)) { cad(car, .35); car.set('ghost', .6); }
    // 5 复核
    P.roles.forEach((r, i) => { const k = stagger(c.p(4, 0, 4, 1.2), i, 5) * c.out(5, .6); op(r.b, k); op(r.l, k); K.drawLine(r.l, k); });
    // 6 收敛
    if (c.after(5, 0)) { const g = new THREE.Color(COL.green).multiplyScalar(1.5); order.forEach(k => P.fl[k].material.color.copy(g)); P.hood.material.color.copy(g); car.set('paint', c.p(5, .6, 5, 'end')); cad(car, 1 - c.p(5, .6, 5, 'end')); }
    else { const cc = new THREE.Color(COL.cyan).multiplyScalar(1.5); order.forEach(k => P.fl[k].material.color.copy(cc)); P.hood.material.color.copy(cc); }
    op(P.ok, c.show(5, .4));
  }
};

// ———————————————————— classa-3 关闭问题并发布曲面 ————————————————————
export const classa3 = {
  phases: ['分片检查', '统一基准与拼合', '签核与发布'],
  shots: [
    {title: '按区域展开', detail: '曲面按片区着色展开，逐片确认完整、状态清楚'},
    {title: '检查边界接口', detail: '放大片区交界，遗漏片区、异常接缝和未落实意见逐一排查'},
    {title: '统一定位基准', detail: '各片回到共同坐标，相关专业在同一位置讨论同一个问题'},
    {title: '接缝收拢', detail: '片区边界一条条收拢，拼合后整体保持一致'},
    {title: '版本签核', detail: '成果、说明和问题状态逐项签核，确定哪些可作为正式输入'},
    {title: '受控发布', detail: '受控曲面数据打包发布；之后的变更也要留依据并通知相关专业'}
  ],
  cams: [
    [{tg: [0, .75, 0], r: 8.6, az: 40, el: 24}],
    [{tg: [1.0, .9, .5], r: 3.6, az: 55, el: 28}],
    [{tg: [0, .75, 0], r: 8.6, az: 38, el: 20}],
    [{tg: [0, .75, 0], r: 7.6, az: 60, el: 16}],
    [{tg: [0, 1.1, 0], r: 8.8, az: 30, el: 16}],
    [{tg: [0, .9, 0], r: 10, az: 30, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    P.fl = featureLines(K, car, COL.green);
    P.axes = [[1, 0, 0, COL.red], [0, 1, 0, COL.green], [0, 0, 1, COL.blue]].map(([x, y, z, col]) => K.add(K.tube([[0, .02, 0], [x * 1.0, .02 + y * 1.0, z * 1.0]], .012, col, {glow: true})));
    P.issues = [[1.0, .95, .85], [-.4, 1.38, .3], [-1.8, .9, .7]].map(p => ({h: hardpoint(K, p, COL.amber, .045), b: chip(K, 'search', COL.amber, [p[0], p[1] + .32, p[2]], .24)}));
    // 片区状态：3 片已确认（check），2 片还要看（warn），让"命名/修改状态"有对象可落
    P.zst = [[1.95, .92, .55, 'check', COL.green], [.9, 1.42, 0, 'check', COL.green], [-.9, 1.44, 0, 'warn', COL.amber], [-2.1, .92, .5, 'check', COL.green], [-1.05, .58, .86, 'warn', COL.amber]].map(([x, y, z, ic, col]) => chip(K, ic, col, [x, y, z], .24));
    P.doc = docStack(K, 5, COL.white, .4, .52); setP(P.doc, axes(30).at([0, .02, 0], 3.0, -.4));
    P.stamp = chip(K, 'stamp', COL.green, axes(30).at([0, 1.0, 0], 3.0, -.4), .42);
    P.pkg = chip(K, 'box', COL.cyan, [0, 2.15, 0], .5);
    P.teams = [['palette', COL.pink], ['gear', COL.blue], ['ruler', COL.white], ['wrench', COL.amber], ['check', COL.green]].map(([ic, col], i) => { const p = axes(30).at([0, .8, 0], (i - 2) * 1.5, -2.4); return {b: chip(K, ic, col, p, .4), f: K.add(K.flow([[0, 2.0, 0], [p[0] / 2, 2.4, p[2] / 2], p], {color: col, n: 7, size: 6, speed: .7})), p}; });
    P.loop = chip(K, 'loop', COL.amber, [2.2, 1.9, .6], .32);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, u = car.layers.heat.mat.uniforms;
    car.set('paint', 0);
    // 片区着色（周期色块）与展开
    const zones = c.show(0, 0, 3, 1);
    car.set('heat', 1); u.uMode.value = zones > .01 ? 2 : 3; u.uLoad.value = zones; u.uT.value = 0;
    const ex = c.p(0, .4, 0, 1.4) * (1 - c.p(2, 0, 2, 1.2));
    car.layers.heat.group.scale.setScalar(1); car.layers.heat.group.position.y = .25 * ex;
    car.set('edges', .4 * zones);
    P.zst.forEach((b, i) => op(b, zones * stagger(c.p(0, .2, 0, 'end'), i, 5) * c.out(3, 0, .6)));
    P.issues.forEach((s, i) => { const k = c.show(1, 0, 3, 0) * stagger(c.p(1, 0, 1, 1.2), i, 3); op(s.h, k); op(s.b, k); });
    P.axes.forEach(a => { op(a, c.show(2, 0, 3, 1)); K.growTube(a, c.p(2, 0, 2, .7)); });
    const seams = Object.values(P.fl); seams.forEach((l, i) => { op(l, c.show(3, 0, 5, 1) * .9); K.drawLine(l, c.p(3, 0, 3, 1.5)); });
    if (c.after(3, 0)) { u.uMode.value = 3; u.uLoad.value = 0; car.set('heat', 1); }
    op(P.doc, c.show(4, 0, 5, 1)); P.doc.userData.sheets.forEach((s, i) => s.position.y = i * .04 * stagger(c.p(4, 0, 4, 1), i, 5) + .02);
    op(P.stamp, c.show(4, 1)); P.stamp.scale.setScalar(.42 * (1 + .4 * c.pulse(4, 1, .8)));
    op(P.pkg, c.show(5, 0)); P.teams.forEach((tm, i) => { const k = stagger(c.p(5, .3, 5, 1.3), i, 5); op(tm.b, k); op(tm.f, c.show(5, .5)); tm.f.userData.update(t, c.lin(5, .5, 5, 1.3)); });
    op(P.loop, c.show(5, 1.5));
    if (c.after(5, 0)) { car.set('paint', c.p(5, 0, 5, 1)); car.set('heat', 1 - c.p(5, 0, 5, 1)); }
  }
};
