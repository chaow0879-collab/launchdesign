// 第 2 阶段：概念与总布置
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, stagger, axes, dim, hardpoint, profileCurve, docStack, THREE} from './lib.js';

const PINK = COL.pink, INK = 0xffe7f3;
// 用真车采样画出的侧视草图线：上沿、窗线、肩线、轮拱
function sketchLines(K, car, z = 0, color = INK) {
  const pr = car.profile.filter((b, i) => i % 2 === 0);
  const top = pr.map(b => [b.x, b.top, z]);
  const win = pr.filter(b => b.x > -1.45 && b.x < 1.0).map(b => [b.x, Math.max(.98, b.roof - .07 - .06 * Math.exp(-Math.pow(b.x / .7, 2)) * 0), z]);
  const shoulder = pr.filter(b => b.x > -2.25 && b.x < 2.2).map(b => [b.x, Math.min(b.top, .9 + .05 * Math.cos(b.x * .7)), z]);
  const base = [[-2.6, .02, z], [2.6, .02, z]];
  const wheel = c => { const pts = []; for (let a = 0; a <= 64; a++) { const u = a / 64 * Math.PI * 2; pts.push([c.x + Math.cos(u) * car.wheelR, c.y + Math.sin(u) * car.wheelR, z]); } return pts; };
  const L = (pts, o = .95) => K.add(K.line(pts, color, o));
  return {base: L(base, .7), wf: L(wheel(car.wheelCenters[0])), wr: L(wheel(car.wheelCenters[2])), top: L(top), win: L(win, .8), shoulder: L(shoulder, .8)};
}

export const concept1 = {
  phases: ['落笔与推演', '比例与体量', 'CMF 与方向'],
  shots: [
    {title: '侧面落笔', detail: '在地面基准和两个轮心上落笔，车顶、车窗、肩线一笔笔画出'},
    {title: '推演姿态', detail: '前低后高、舒展或紧凑的几种车顶走势快速推演，并连回产品定位'},
    {title: '比例校核', detail: '轴距、前后悬和座舱比例标在草图上；乘员与电池放进轮廓里检查'},
    {title: '立成三维', detail: '二维线条拉出宽度、长成体量，镜头转到前方和侧前方核对关系'},
    {title: '色彩材质灯光', detail: '车漆在几种颜色材质间切换，光线绕车移动，表面气质随之变化'},
    {title: '确认造型方向', detail: '保留选定方向，需要工程共同解决的位置被逐一标记并记录'}
  ],
  cams: [
    [{tg: [0, .75, 0], r: 8.2, az: 90, el: 3, drift: 0}],
    [{tg: [0, .8, 0], r: 8.0, az: 90, el: 3, drift: 0}],
    [{tg: [0, .7, 0], r: 8.2, az: 90, el: 3, drift: 0}],
    [{tg: [0, .7, 0], r: 8.2, az: 90, el: 4, drift: 0}, {b: 0.6, tg: [0, .7, 0], r: 8.6, az: 40, el: 14, dur: 2.4}, {b: 1.5, tg: [.4, .7, 0], r: 7.6, az: 8, el: 10, dur: 2.2}],
    [{tg: [0, .7, 0], r: 8.0, az: 35, el: 12}],
    [{tg: [0, .8, 0], r: 8.8, az: 30, el: 16}]
  ],
  build(K, S, car) {
    const P = {};
    P.sk = sketchLines(K, car, 0);
    P.alt = [-.08, .06, .13].map((dy, i) => K.add(K.line(car.profile.filter((b, j) => j % 2 === 0).map(b => [b.x, b.top + dy * Math.exp(-Math.pow((b.x + (i - 1) * .6) / 1.1, 2)), .01]), [PINK, COL.violet, COL.cyan][i], .7)));
    P.pos = chip(K, 'target', PINK, [0, 2.15, 0], .42);
    P.posLinks = [[-1.2, 1.25, 0], [.3, 1.42, 0], [1.6, 1.0, 0]].map(p => link(K, [0, 2.0, 0], p, PINK, .05));
    const wc = car.wheelCenters, bb = car.bbox;
    P.dims = [dim(K, [wc[2].x, .12, .02], [wc[0].x, .12, .02], COL.amber), dim(K, [wc[0].x, .12, .02], [bb.max.x, .12, .02], COL.white), dim(K, [bb.min.x, .12, .02], [wc[2].x, .12, .02], COL.white)];
    P.cabinBox = K.add(K.line([[-1.4, .45, .02], [1.0, .45, .02], [1.0, 1.36, .02], [-1.4, 1.36, .02], [-1.4, .45, .02]], COL.teal, .8));
    // 立体化：多条截面线
    P.ext = [-.9, -.45, .45, .9].map(z => { const s = sketchLines(K, car, z, COL.cyan); return s; });
    P.cross = [-1.6, -.6, .4, 1.4].map(x => { const pts = []; for (let k = 0; k <= 24; k++) { const z = -.93 + k * 1.86 / 24; pts.push([x, car.heightAt(x, z), z]); } return K.add(K.line(pts, COL.cyan, .8)); });
    // CMF 色板
    P.sw = [[0xcfd6dd, .3, .35], [0x1d3b66, .25, .6], [0x8b1e2d, .3, .55], [0x2a2d31, .5, .2]].map(([col, r, m], i) => { const s = K.add(new THREE.Mesh(new THREE.SphereGeometry(.17, 32, 20), new THREE.MeshPhysicalMaterial({color: col, roughness: r, metalness: m, clearcoat: 1, transparent: true}))); setP(s, axes(35).at([0, 2.05, 0], (i - 1.5) * .55, -.6)); s.userData.col = col; s.userData.r = r; s.userData.m = m; return s; });
    P.sel = K.add(K.ring(.24, COL.white, .01));
    P.mood = K.add(K.tube([[1.0, .95, .62], [.9, .97, 0], [1.0, .95, -.62]], .012, COL.teal, {glow: true}));
    // 标记需工程共解的问题
    P.flags = [[2.1, .75, .55], [-.2, 1.42, 0], [1.4, .95, .9]].map(p => ({h: hardpoint(K, p, COL.amber, .05), b: chip(K, 'warn', COL.amber, [p[0], p[1] + .35, p[2]], .28), p}));
    P.doc = docStack(K, 4, COL.amber, .34, .44); setP(P.doc, axes(30).at([0, .02, 0], 3.1, -.6));
    P.docLinks = P.flags.map(f => link(K, [f.p[0], f.p[1] + .35, f.p[2]], P.doc.position.toArray().map((v, i) => i === 1 ? .3 : v), COL.amber, .3, true));
    P.ok = chip(K, 'check', COL.green, [0, 2.0, 0], .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, sk = P.sk;
    // 1 落笔
    const vis1 = c.out(3, 1.2, 1.2);
    car.set('paint', 0); car.set('wheels', 0);
    op(sk.base, c.in(0, 0) * vis1); K.drawLine(sk.base, c.p(0, 0, 0, .6));
    op(sk.wf, c.in(0, .3) * vis1); K.drawLine(sk.wf, c.p(0, .3, 0, .9)); op(sk.wr, c.in(0, .5) * vis1); K.drawLine(sk.wr, c.p(0, .5, 0, 1));
    op(sk.top, c.in(0, 1) * vis1); K.drawLine(sk.top, c.p(0, 1, 0, 1.55));
    op(sk.win, c.in(0, 1.4) * vis1); K.drawLine(sk.win, c.p(0, 1.4, 0, 1.8));
    op(sk.shoulder, c.in(0, 1.7) * vis1); K.drawLine(sk.shoulder, c.p(0, 1.7, 0, 'end'));
    // 2 推演
    P.alt.forEach((l, i) => { const k = stagger(c.p(1, 0, 1, 2), i, 3); op(l, c.show(1, 0, 2, 0) * (k > 0 ? .35 + .65 * Math.max(0, 1 - Math.abs(c.lin(1, 0, 1, 2) * 3 - i - .5)) : 0)); K.drawLine(l, k); });
    op(P.pos, c.show(1, 2, 2, 0)); P.posLinks.forEach((l, i) => { op(l, c.show(1, 2.2, 2, 0)); K.drawLine(l, c.p(1, 2.2, 1, 'end')); });
    // 3 比例
    P.dims.forEach((d, i) => op(d, stagger(c.p(2, 0, 2, .8), i, 3) * c.out(3, .5)));
    op(P.cabinBox, c.show(2, .5, 3, .5)); K.drawLine(P.cabinBox, c.p(2, .5, 2, 1));
    const fit = c.show(2, 1, 3, .5);
    S.show('occupant', fit * .9); S.show('battery', fit * .8); S.show('drive', fit * .6);
    // 4 立体化
    const ex = c.p(3, 0, 3, 1);
    P.ext.forEach((s, i) => Object.values(s).forEach(l => { op(l, c.show(3, 0, 4, .3) * stagger(ex, i, 4) * .7); K.drawLine(l, 1); }));
    P.cross.forEach((l, i) => { op(l, c.show(3, .5, 4, .3) * .8); K.drawLine(l, stagger(c.p(3, .5, 3, 1.5), i, 4)); });
    const vol = c.p(3, 1, 3, 2.4);
    if (c.after(3, 0)) { car.set('clay', vol * c.out(4, 0, 1.2)); car.set('edges', c.show(3, .6, 4, .3) * .6); car.edgeMat.uniforms.uReveal.value = lerp(-2.5, 2.5, c.p(3, .6, 3, 1.4)); car.set('wheels', vol); }
    // 5 CMF
    const cmf = c.show(4, 0);
    if (cmf > 0) { car.set('paint', c.p(4, 0, 4, .5)); car.set('wheels', 1); }
    const phase = c.lin(4, .2, 5, 0) * 4, i0 = Math.min(3, Math.floor(phase)), i1 = Math.min(3, i0 + 1), f = smooth((phase - i0 - .6) / .4);
    if (cmf > 0) {
      const a = P.sw[i0].userData, b = P.sw[i1].userData;
      car.paint.color.setHex(a.col).lerp(new THREE.Color(b.col), f); car.paint.roughness = lerp(a.r, b.r, f); car.paint.metalness = lerp(a.m, b.m, f);
    }
    P.sw.forEach((s, i) => { op(s, c.show(4, 0, 5, 1) * stagger(c.p(4, 0, 4, .6), i, 4)); });
    op(P.sel, c.show(4, .3, 5, 1)); setP(P.sel, P.sw[Math.round(Math.min(3, phase))].position.toArray()); P.sel.rotation.y = axes(35).ry;
    const lt = c.lin(4, 1, 4, 'end');
    if (c.after(4, 1)) { const a = lerp(.6, 3.6, lt); core(K).key.position.set(Math.cos(a) * 7, 5.5, Math.sin(a) * 7); core(K).key.intensity = 2.4; }
    op(P.mood, c.show(4, .6, 5, 1)); S.show('cabin', c.show(4, .6, 5, 1) * .4);
    if (c.after(5, 0)) { const last = P.sw[1].userData; car.paint.color.setHex(last.col); car.paint.roughness = last.r; car.paint.metalness = last.m; car.set('paint', 1); car.set('wheels', 1); }
    // 6 确认方向
    op(P.ok, c.show(5, 0, 5, 1.2));
    P.flags.forEach((fl, i) => { const k = stagger(c.p(5, 1, 5, 2), i, 3); op(fl.h, k); op(fl.b, k); });
    op(P.doc, c.show(5, 1.8)); P.docLinks.forEach((l, i) => { op(l, c.show(5, 2)); K.drawLine(l, stagger(c.p(5, 2, 5, 'end'), i, 3)); });
  }
};
const core = K => K.core;

// ———————————————————— concept-2 布置乘员、电池与系统 ————————————————————
export const concept2 = {
  phases: ['乘员基准', '电池与电驱', '包络与空间底图'],
  shots: [
    {title: '座椅与乘员就位', detail: '座椅落位、测量假人坐入，髋点与基准线在车内亮起'},
    {title: '人机关系', detail: '头部余量、腿部空间、前方视野和操作距离逐项亮起；上车路径与车门开启范围画出'},
    {title: '电池进入地板', detail: '电池包从车头方向送入地板下；厚度、容量、防护依次标出，乘坐位置随之抬高'},
    {title: '电驱与底盘活动范围', detail: '电驱装上车轴，前轮转向、车轮上下跳动各自扫出活动范围'},
    {title: '空间包络与装配路径', detail: '各系统包络显形；装配与维修的进出路线用虚线标出'},
    {title: '总布置底图', detail: '乘坐、性能、系统三方汇合；镜头升到正上方，布置底图在地面展开'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 8, az: 40, el: 30}],
    [{tg: [.25, .9, -.3], r: 4.6, az: 120, el: 8}, {b: 1, tg: [.2, .7, -.6], r: 6.2, az: 70, el: 22}],
    [{tg: [0, .45, 0], r: 6.6, az: 90, el: 6}],
    [{tg: [1.3, .45, 0], r: 5.6, az: 40, el: 22}],
    [{tg: [0, .55, 0], r: 8.6, az: 40, el: 28}],
    [{tg: [0, .6, 0], r: 8.6, az: 40, el: 26}, {b: 1, tg: [0, 0, 0], r: 9.2, az: 90, el: 82, dur: 2.4}]
  ],
  build(K, S, car) {
    const P = {}, wc = car.wheelCenters;
    P.hpts = [[.1, .52, -.37], [.1, .52, .37], [-.82, .52, -.37]].map(p => hardpoint(K, p, COL.amber, .045));
    P.ref = [K.add(K.line([[-2.3, .52, 0], [2.3, .52, 0]], COL.amber, .6, true)), K.add(K.line([[.1, .1, -.37], [.1, 1.45, -.37]], COL.amber, .6, true))];
    P.headRing = K.add(K.ring(.17, COL.green, .008)); setP(P.headRing, [-.1, 1.16, -.37]); P.headRing.rotation.x = Math.PI / 2;
    P.leg = dim(K, [.1, .5, -.37], [.75, .36, -.37], COL.teal);
    P.view = K.add(K.fan(4.2, .5, COL.cyan, .2)); P.view.rotation.set(0, 0, 0); setP(P.view, [-.08, 1.16, -.37]); P.view.rotation.z = -.08;
    P.reach = link(K, [-.05, .98, -.37], [.55, .9, -.37], COL.violet, .05);
    P.ingress = K.add(K.line([[.1, .55, -1.6], [.05, .75, -1.1], [.08, .66, -.7], [.1, .52, -.37]], COL.green, .9, true));
    P.door = K.add(new THREE.Mesh(new THREE.RingGeometry(0.02, 1.05, 32, 1, Math.PI, Math.PI * .42), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.green).multiplyScalar(1.4), transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}))); P.door.rotation.x = -Math.PI / 2; setP(P.door, [.95, .05, -.9]);
    P.thick = dim(K, [-.4, .1, .75], [-.4, .3, .75], COL.teal, .08);
    P.shield = chip(K, 'shield', COL.green, [.4, -.05, .9], .3); P.capI = chip(K, 'battery', COL.teal, [-.4, .55, .95], .3);
    P.impact = [-1, 0, 1].map(i => { const a = K.add(K.glow(new THREE.ConeGeometry(.05, .16, 10), COL.red, 2)); setP(a, [i * .7, -.25, .5]); return a; });
    P.roof = K.add(K.line(car.profile.filter((b, i) => i % 2 === 0 && b.x > -1.9 && b.x < 1.5).map(b => [b.x, b.top + .06 * Math.exp(-Math.pow((b.x + .1) / .9, 2)), .95]), COL.amber, .9));
    P.steer = K.add(new THREE.Mesh(new THREE.RingGeometry(.22, .4, 40, 1, -.6, 1.2), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.cyan).multiplyScalar(1.6), transparent: true, opacity: .35, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending}))); P.steer.rotation.x = -Math.PI / 2; setP(P.steer, [wc[0].x, .03, wc[0].z]);
    P.jounce = [0, 1].map(i => { const b = K.add(K.holoBox(.78, .5, .32, COL.teal, .05, .7)); setP(b, [wc[i].x, wc[i].y + .05, wc[i].z]); return b; });
    P.env = [[[S.battery.x0, .22, 0], [2.4, .24, 1.42], COL.teal], [[wc[0].x, .38, 0], [.62, .5, 1.0], COL.blue], [[wc[2].x, .38, 0], [.62, .5, 1.0], COL.blue], [[1.15, .78, 0], [.4, .3, .8], COL.violet], [[1.75, .64, 0], [.3, .2, .9], COL.cyan]].map(([p, s, col]) => { const b = K.add(K.holoBox(...s, col, .07, .9)); setP(b, p); return b; });
    P.paths = [[[wc[2].x, -.6, 0], [wc[2].x, .38, 0]], [[S.battery.x0, -.7, 0], [S.battery.x0, .22, 0]], [[2.9, .9, 0], [2.0, .8, 0], [1.75, .66, 0]]].map(pts => K.add(K.line(pts, COL.white, .9, true)));
    P.wr = chip(K, 'wrench', COL.white, [2.6, 1.2, 0], .3);
    P.three = [['seat', COL.teal, -1.6], ['target', COL.green, 0], ['gear', COL.blue, 1.6]].map(([ic, col, al]) => { const p = axes(40).at([0, 2.0, 0], al, -.4); return {b: chip(K, ic, col, p, .38), l: link(K, p, [0, 1.0, 0], col, .1), p}; });
    // 地面布置底图：整车外廓 + 系统投影
    const out = []; car.profile.filter((b, i) => i % 3 === 0).forEach(b => out.push([b.x, .02, b.half + .05])); const back = out.map(p => [p[0], .02, -p[2]]).reverse();
    P.plan = K.add(K.line([...out, ...back, out[0]], COL.cyan, .95));
    P.planFills = [[S.battery.x0, 2.3, 1.36, COL.teal], [wc[0].x, .5, .9, COL.blue], [wc[2].x, .5, .9, COL.blue], [.1, .55, .5, COL.amber], [-.82, .55, 1.2, COL.amber]].map(([x, l, w, col]) => { const m = K.add(new THREE.Mesh(new THREE.PlaneGeometry(l, w), new THREE.MeshBasicMaterial({color: new THREE.Color(col).multiplyScalar(1.3), transparent: true, opacity: .28, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}))); m.rotation.x = -Math.PI / 2; setP(m, [x, .025, 0]); return m; });
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.set('paint', .1); car.set('ghost', 1);
    // 1 座椅与乘员
    S.show('cabin', 1);
    S.cabin.seats.forEach((s, i) => { const k = stagger(c.p(0, 0, 0, .8), i, 3); s.position.y += .8 * (1 - k); S.sub(s, k); });
    S.show('occupant', c.show(0, .6) * .9);
    const sit = c.p(0, .6, 0, 1.2);
    [S.occupant.front, S.occupant.front2, S.occupant.rear].forEach(o => o.position.y += .5 * (1 - sit));
    P.hpts.forEach((h, i) => op(h, stagger(c.p(0, 1, 0, 1.5), i, 3)));
    P.ref.forEach((l, i) => { op(l, c.show(0, 1.2, 2, 0)); K.drawLine(l, c.p(0, 1.2, 0, 'end')); });
    // 2 人机
    op(P.headRing, c.show(1, 0, 2, 0)); P.headRing.scale.setScalar(1 + .15 * Math.sin(t * 4));
    op(P.leg, c.show(1, .3, 2, 0)); op(P.view, c.show(1, .5, 2, 0)); P.view.material.uniforms.uT.value = t;
    op(P.reach, c.show(1, .7, 2, 0)); K.drawLine(P.reach, c.p(1, .7, 1, 1));
    op(P.ingress, c.show(1, 1, 2, 0)); K.drawLine(P.ingress, c.p(1, 1, 1, 'end')); op(P.door, c.show(1, 1.2, 2, 0) * .9); P.door.scale.setScalar(c.p(1, 1.2, 1, 'end'));
    // 3 电池进入：先沿 z 滑到车下，再上抬，在地板接触点被 stopAt 停住（之后 u 不再前进，不穿进车身）
    S.show('battery', c.show(2, 0));
    const B = S.battery;
    // solver 不挂进场景：B.g 必须留在 sysRoot 下，S.show/op 依赖 groups.battery 的层级
    P.slide = P.slide || (() => {
      const pts = [[3.4, -.34, 0], [1.6, -.34, 0], [.4, -.34, 0], [.18, -.12, 0], [0, 0, 0], [0, .16, 0]];
      const curve = K.curve(pts), target = new THREE.Vector3(0, 0, 0);
      let best = 1, bestD = Infinity;
      for (let i = 0; i <= 96; i++) { const u = i / 96, p = curve.getPointAt(u), d = p.distanceTo(target); if (d < bestD) { bestD = d; best = u; } }
      return K.stopAt(new THREE.Group(), curve, best);       // best ≈ 地板接触点所在弧长参数
    })();
    const inK = c.p(2, 0, 2, .9);
    P.slide.userData.travel(inK); B.g.position.copy(P.slide.children[0].position);
    op(P.thick, c.show(2, 1, 3, 0)); op(P.capI, c.show(2, 1.3, 3, 0)); S.battery.modules.forEach((m, i) => op(m.userData.top, .3 + .7 * c.pulse(2, 1.3 + i * .04, .8)));
    op(P.shield, c.show(2, 1.6, 3, 0)); P.impact.forEach((a, i) => { op(a, c.show(2, 1.6, 3, 0) * .9); a.position.y = -.25 + .08 * ((t * 2 + i * .3) % 1); });
    // 乘员/座椅抬高量由电池上表面高度推导（B.y0 + .06），且电池就位后才开始抬
    const topY = B.y0 + .06, raise = c.p(2, 2, 2, 'end') * clamp(inK * 2);
    [S.occupant.front, S.occupant.front2, S.occupant.rear].forEach(o => o.position.y += topY * raise); S.cabin.seats.forEach(s => s.position.y += topY * raise);
    op(P.roof, c.show(2, 2, 3, 0)); K.drawLine(P.roof, raise);
    // 4 电驱与底盘
    S.show('drive', c.show(3, 0)); S.show('chassis', c.show(3, 0) * .9);
    S.front.g.position.y -= .5 * (1 - c.p(3, 0, 3, .8)); S.rear.g.position.y -= .5 * (1 - c.p(3, .2, 3, 1));
    const st = c.show(3, 1, 4, 0); op(P.steer, st); car.wheels[0].rotation.y = car.wheels[1].rotation.y = .5 * Math.sin((t - c.T(3, 1)) * 2.2) * st;
    const jb = c.show(3, 1.5, 4, 0) * .06 * Math.sin(t * 4); car.wheels.forEach(w => w.position.y += jb); P.jounce.forEach(b => op(b, c.show(3, 1.5, 4, 0)));
    // 5 包络与路径
    P.env.forEach((b, i) => op(b, c.show(4, 0, 5, 1) * stagger(c.p(4, 0, 4, .8), i, 5)));
    P.paths.forEach((l, i) => { op(l, c.show(4, 1, 5, 0)); K.drawLine(l, stagger(c.p(4, 1, 4, 'end'), i, 3)); });
    op(P.wr, c.show(4, 1.5, 5, 0));
    if (c.between(4, 1, 5, 0)) { const k = K.pulse(c.lin(4, 1, 4, 'end')); S.rear.g.position.y -= .25 * k; }
    // 6 底图
    P.three.forEach((x, i) => { const k = stagger(c.p(5, 0, 5, .8), i, 3) * c.out(5, 1.2); op(x.b, k); op(x.l, k); K.drawLine(x.l, k); });
    op(P.plan, c.show(5, 1)); K.drawLine(P.plan, c.p(5, 1, 5, 1.6)); P.planFills.forEach((m, i) => op(m, c.show(5, 1.3) * stagger(c.p(5, 1.3, 5, 'end'), i, 5)));
    if (c.after(5, 0)) { S.show('drive', 1); S.show('battery', 1); S.show('occupant', .8); S.show('thermal', c.show(5, 0) * .5); }
  }
};

// ———————————————————— concept-3 联合评审与方向收敛 ————————————————————
const A3 = axes(28);
export const concept3 = {
  phases: ['并列比较', '叠合工程约束', '取舍与收敛'],
  shots: [
    {title: '三个方向并列', detail: '三个造型方向站在同一基准线上，产品目标连到每一个方向'},
    {title: '比较姿态差异', detail: '各方案车顶走势与前后悬被描出，结合体验与实现条件判断'},
    {title: '叠合工程硬点', detail: '低趴方案的轮廓压到乘员头部余量，冲突点亮红'},
    {title: '核对内部包络', detail: '乘员、电池和其他系统包络装进外形，找出放不下的位置'},
    {title: '联合评审取舍', detail: '设计与工程在冲突点会合，车顶微调后转绿，取舍理由与待验证项被记录'},
    {title: '选定方向向下传', detail: '选定方案化为线框交给数字建模，未关闭的问题旗标一路跟随'}
  ],
  cams: [
    [{tg: [0, .8, 0], r: 13, az: 28, el: 14}],
    [{tg: [0, .8, 0], r: 12, az: 70, el: 8}],
    [{tg: [0, .8, 0], r: 7.4, az: 90, el: 4, drift: 0}],
    [{tg: [0, .7, 0], r: 7.6, az: 55, el: 26}],
    [{tg: [0, 1.0, 0], r: 7.8, az: 75, el: 12}],
    [{tg: [0, .8, 0], r: 8.8, az: 30, el: 16}]
  ],
  build(K, S, car) {
    const P = {};
    P.vars = [[0x8b1e2d, 1.05, .93, -3.0], [0x1d3b66, .97, 1.06, 3.0]].map(([col, sx, sy, along]) => { const r = car.makeClone(col); r.scale.set(sx, sy, 1); const g = K.add(r); setP(g, A3.at([0, 0, 0], along, -.6)); g.userData.home = g.position.toArray(); g.userData.sx = sx; g.userData.sy = sy; return g; });
    P.base = K.add(K.glow(new THREE.BoxGeometry(11, .006, .03), COL.white, 1.6, .6)); setP(P.base, A3.at([0, .01, 0], 0, -.6)); P.base.rotation.y = A3.ry;
    P.goal = chip(K, 'target', COL.green, A3.at([0, 2.5, 0], 0, -1), .44);
    P.goalLinks = [-3, 0, 3].map(al => link(K, P.goal.position.toArray(), A3.at([0, 1.5, 0], al, -.6), COL.green, .05));
    P.roofs = [[-3, .93, 1.05], [0, 1, 1], [3, 1.06, .97]].map(([al, sy, sx]) => { const off = A3.at([0, 0, 0], al, -.6); return K.add(K.line(car.profile.filter((b, i) => i % 2 === 0).map(b => [off[0] + b.x * sx * 1, b.top * sy + .02, off[2]]), COL.white, .9)); });
    P.judge = [['user', COL.cyan], ['gear', COL.blue]].map(([ic, col], i) => chip(K, ic, col, [i ? 1.2 : -1.2, 2.2, 0], .38));
    P.low = K.add(K.line(car.profile.filter((b, i) => i % 2 === 0).map(b => [b.x * 1.05, b.top * .93, .02]), COL.pink, .95));
    P.head = K.add(K.ring(.15, COL.red, .01)); setP(P.head, [-.1, 1.16, .02]);
    P.clash = chip(K, 'warn', COL.red, [-.1, 1.62, .02], .3);
    P.hps = [[car.wheelCenters[0].x, car.wheelCenters[0].y, .02], [car.wheelCenters[2].x, car.wheelCenters[2].y, .02], [.1, .52, .02], [-.1, 1.16, .02], [-.82, .52, .02]].map(p => hardpoint(K, p, COL.amber, .05));
    P.conf = K.add(K.glow(new THREE.SphereGeometry(.22, 20, 14), COL.red, 2, .35)); setP(P.conf, [-.1, 1.25, -.37]);
    P.sides = [['palette', COL.pink, [-1.6, 2.0, .8]], ['gear', COL.blue, [1.4, 2.0, .8]]].map(([ic, col, p]) => ({b: chip(K, ic, col, p, .4), l: link(K, p, [-.1, 1.3, -.3], col, .2)}));
    P.newRoof = K.add(K.line(car.profile.filter((b, i) => i % 2 === 0 && b.x > -1.9 && b.x < 1.5).map(b => [b.x, b.top + .025 * Math.exp(-Math.pow((b.x + .1) / .8, 2)), .9]), COL.green, .95));
    P.rec = [['doc', COL.white, [-1.6, 1.6, 1.2]], ['flag', COL.amber, [1.5, 1.6, 1.2]]].map(([ic, col, p]) => chip(K, ic, col, p, .32));
    P.trail = [[2.1, .75, .55], [-.2, 1.45, 0]].map(p => ({h: hardpoint(K, p, COL.amber, .05), f: chip(K, 'flag', COL.amber, [p[0], p[1] + .32, p[2]], .26), p}));
    P.cas = chip(K, 'chip', COL.cyan, [3.4, 1.5, -.5], .44);
    P.casLink = link(K, [1.8, 1.0, 0], [3.4, 1.35, -.5], COL.cyan, .2);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.paint.color.setHex(0xcfd6dd);
    // 1 并列
    P.vars.forEach((v, i) => op(v, c.show(0, 0, 2, .8) * stagger(c.p(0, 0, 0, 1), i, 2)));
    op(P.base, c.show(0, 0, 2, .8));
    op(P.goal, c.show(0, 1, 2, 0)); P.goalLinks.forEach((l, i) => { op(l, c.show(0, 1.2, 2, 0)); K.drawLine(l, stagger(c.p(0, 1.2, 0, 'end'), i, 3)); });
    // 2 差异
    P.roofs.forEach((l, i) => { op(l, c.show(1, 0, 2, .5)); K.drawLine(l, stagger(c.p(1, 0, 1, 1), i, 3)); });
    P.judge.forEach((j, i) => op(j, c.show(1, 1, 2, 0) * stagger(c.p(1, 1, 1, 'end'), i, 2)));
    // 3 叠合
    P.vars.forEach((v, i) => { const k = c.p(2, 0, 2, .8); const h = v.userData.home; setP(v, mixV(h, [0, 0, 0], k)); });
    op(P.low, c.show(2, .4, 4, 1)); K.drawLine(P.low, c.p(2, .4, 2, 1));
    P.hps.forEach((h, i) => op(h, c.show(2, .2, 4, 0) * stagger(c.p(2, .2, 2, .9), i, 5)));
    S.show('occupant', c.show(2, .6, 5, 0) * .85); S.sub(S.occupant.front2, 0); S.sub(S.occupant.rear, 0);
    op(P.head, c.show(2, 1, 4, 1) * (.6 + .4 * Math.sin(t * 7))); op(P.clash, c.show(2, 1.2, 4, 1));
    if (c.after(2, 0)) { car.set('paint', .2); car.set('ghost', .9); }
    // 4 内部包络
    S.show('battery', c.show(3, 0, 5, 1) * .9); S.show('drive', c.show(3, .5, 5, 1) * .8); S.show('cabin', c.show(3, .3, 5, 1) * .5); S.show('eea', c.show(3, 1, 5, 0) * .4);
    op(P.conf, c.show(3, 1, 4, 1.5) * (.5 + .5 * Math.sin(t * 6)));
    // 5 联合评审
    P.sides.forEach((s, i) => { const k = stagger(c.p(4, 0, 4, .8), i, 2) * c.out(5, .5); op(s.b, k); op(s.l, k); K.drawLine(s.l, k); });
    const fix = c.p(4, .8, 4, 1.4); op(P.newRoof, c.show(4, .8, 5, .5)); K.drawLine(P.newRoof, fix);
    if (c.after(4, 1.2)) { P.head.material.color.set(new THREE.Color(COL.green).multiplyScalar(2.4)); P.conf.material.color.set(new THREE.Color(COL.green).multiplyScalar(2)); } else { P.head.material.color.set(new THREE.Color(COL.red).multiplyScalar(2.4)); P.conf.material.color.set(new THREE.Color(COL.red).multiplyScalar(2)); }
    P.rec.forEach((r, i) => op(r, c.show(4, 1 + i, 5, .5)));
    // 6 向下传
    if (c.after(5, 0)) { const k = c.p(5, 0, 5, 1); car.set('paint', 1 - k * .8); car.set('ghost', k * .5); car.set('edges', k); car.edgeMat.uniforms.uReveal.value = 3; }
    op(P.cas, c.show(5, .5)); op(P.casLink, c.show(5, .6)); K.drawLine(P.casLink, c.p(5, .6, 5, 1.2));
    P.trail.forEach((tr, i) => { const k = c.show(5, 1.2); op(tr.h, k); op(tr.f, k); tr.f.position.y += .05 * Math.sin(t * 3 + i); });
  }
};
