// 第 4 阶段：实体模型评审
import {COL, op, clamp, ease, smooth, lerp, mixV, setP, chip, link, floorRing, stagger, axes, dim, hardpoint, section, docStack, gantry, robotArm, lightBars, cad, curvComb, THREE} from './lib.js';

const CLAY = 0xb07a52;
function block(K, car) {
  const bb = car.bbox, w = bb.max.x - bb.min.x + .2, d = bb.max.z - bb.min.z + .1;
  // 顶面细分（40×22）用于按刀路做顶点级去料；base 存原始顶面高度，每帧从它重算，保证可回退
  const geo = new THREE.BoxGeometry(w, 1, d, 40, 4, 22);
  const m = K.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({color: 0x9c6b47, roughness: .8, metalness: 0, transparent: true})));
  m.userData.h0 = bb.max.y + .12;
  m.userData.base = Float32Array.from(geo.attributes.position.array);
  return m;
}
const setBlock = (m, top, bot = .05) => { const h = Math.max(.01, top - bot); m.scale.y = h; m.position.y = bot + h / 2; };
// 按刀路前缀对坯料顶面做局部切削：已走过的整行削到目标面，当前行只削刀具 x 已越过的部分，未走到的保持坯料高度
// idx = 当前刀路点序号（每行 47 点、共 19 行，偶数行从 +x 扫向 -x），allow = 留给精加工的余量
const ROW_PT = 47, ROW_STEP = 1.7 / 18;
function carveBlank(blk, car, idx, allow, active) {
  const pos = blk.geometry.attributes.position, base = blk.userData.base;
  const S = Math.max(.001, blk.scale.y), Py = blk.position.y, top0 = blk.userData.h0;
  const rowCur = Math.floor(idx / ROW_PT), desc = rowCur % 2 === 0;
  const sx = 2.3 - .1 * (idx % ROW_PT), toolX = desc ? sx : -sx;
  for (let i = 0; i < pos.count; i++) {
    const lx = base[i * 3], ly = base[i * 3 + 1], lz = base[i * 3 + 2];
    if (ly < .49 || !active) { pos.setY(i, ly); continue; }            // 只动顶面（含侧壁顶沿）；未开工时全部归位
    const row = Math.min(18, Math.max(0, Math.round((.85 - lz) / ROW_STEP)));
    const cut = row < rowCur ? 1 : row > rowCur ? 0 : (desc ? (toolX <= lx ? 1 : 0) : (toolX >= lx ? 1 : 0));
    if (!cut) { pos.setY(i, ly); continue; }
    // 车身投影内削到“车身顶面 + 余量”，投影外 .3m 内线性塌到坯料底，避免留下 1.5m 高的边墙挡镜头
    const edge = Math.min(clamp((2.40 - Math.abs(lx)) / .3), clamp((.95 - Math.abs(lz)) / .3));
    const surf = Math.min(top0, car.heightAt(lx, lz) + allow);
    const target = Math.max(.16, lerp(.16, surf, edge));
    pos.setY(i, Math.min(.5, (target - Py) / S));                      // 换算回局部坐标，不低于原顶面
  }
  pos.needsUpdate = true;
  if (active) blk.geometry.computeVertexNormals();
}

export const clay1 = {
  phases: ['基座与坯料', '设备与刀路', '加工与检查'],
  shots: [
    {title: '准备坯料', detail: '钢制基座就位，油泥坯料包住骨架，三处加工基准点亮'},
    {title: '定位加工设备', detail: '龙门铣进场，主轴与进给方向标出，绿色框是设备行程，黄线是安全边界'},
    {title: '粗加工', detail: '刀路沿表面逐道铺开，粗加工一层层去除余量'},
    {title: '数控精加工', detail: '加工头往复走刀贴合曲面，碎屑飞出，数字模型的形体在实物上显现'},
    {title: '截面样板检查', detail: '在关键位置放上截面样板对照轮廓，偏差处修整后转绿'},
    {title: '真实尺度评审', detail: '加工完成的油泥模型在灯光下以 1:1 体量供评审'}
  ],
  cams: [
    [{tg: [0, .6, 0], r: 8.6, az: 35, el: 18}],
    [{tg: [0, 1.0, 0], r: 9.4, az: 40, el: 16}],
    [{tg: [0, .8, 0], r: 8.2, az: 30, el: 30}],
    [{tg: [.6, .8, 0], r: 6.6, az: 55, el: 20}],
    [{tg: [0, .7, 0], r: 7.4, az: 70, el: 12}],
    [{tg: [0, .7, 0], r: 8.6, az: 30, el: 12}, {b: 1, tg: [0, .7, 0], r: 8.6, az: 120, el: 12, dur: 4}]
  ],
  build(K, S, car) {
    const P = {};
    P.base = K.add(K.holoBox(4.4, .1, 1.5, COL.white, .25, .8)); setP(P.base, [0, .05, 0]);
    P.frame = K.add(new THREE.Group()); for (const x of [-1.6, -.5, .6, 1.7]) { const f = K.solid(new THREE.BoxGeometry(.06, .5, 1.2), 0x8a98a5, {metal: .8, rough: .3}); f.position.set(x, .35, 0); P.frame.add(f); }
    P.blk = block(K, car);
    P.datum = [[2.5, .05, .9], [2.5, .05, -.9], [-2.5, .05, .9]].map(p => hardpoint(K, p, COL.amber, .05));
    P.gan = gantry(K, 3.0, 2.2, COL.cyan); setP(P.gan, [3.2, 0, 0]);
    P.travel = K.add(K.holoBox(5.2, 1.6, 2.4, COL.green, .03, .6)); setP(P.travel, [0, .85, 0]);
    P.safe = K.add(K.line(Array.from({length: 65}, (_, i) => { const a = i / 64 * Math.PI * 2; return [Math.cos(a) * 3.6, .02, Math.sin(a) * 2.2]; }), COL.amber, .9, true));
    P.feed = [[1, 0, 0], [0, 0, 1], [0, -1, 0]].map(([x, y, z], i) => { const a = K.add(K.tube([[0, 0, 0], [x * .5, y * .5, z * .5]], .012, [COL.red, COL.blue, COL.green][i], {glow: true})); return a; });
    // 刀路：之字形贴着车顶面；从 +z 侧（镜头一侧）扫向 -z，近侧坯料先被削掉，不会留墙挡车
    const zz = []; for (let i = 0; i <= 18; i++) { const z = .85 - i * 1.7 / 18; const row = []; for (let x = 2.3; x >= -2.3; x -= .1) row.push([x, car.heightAt(x, z) + .02, z]); zz.push(...(i % 2 ? row.reverse() : row)); }
    P.path = K.add(K.line(zz, COL.cyan, .7)); P.pathPts = zz;
    P.chips = K.add(K.flow([[0, 0, 0], [.2, .3, .1], [.4, .1, .2]], {color: COL.amber, n: 14, size: 5, speed: 1.6}));
    P.tmpl = [-1.2, -.1, 1.4].map(x => K.add(K.line(section(car, x).map(p => [p[0], p[1] + .02, p[2]]), COL.white, .95)));
    P.dev = K.add(K.glow(new THREE.SphereGeometry(.12, 16, 12), COL.amber, 2.2, .5)); setP(P.dev, [-.1, car.heightAt(-.1, .6), .6]);
    P.ok = chip(K, 'check', COL.green, [-.1, 1.75, .6], .3);
    P.bars = lightBars(K, 4, 6, COL.white);
    P.eye = chip(K, 'eye', COL.cyan, axes(30).at([0, 2.1, 0], 0, -.5), .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.set('paint', 0); car.set('wheels', 0); car.set('clay', 1);
    // 1 基座与坯料
    op(P.base, c.in(0, 0)); op(P.frame, c.show(0, 0, 0, 1.6)); P.frame.position.y = -.4 * (1 - c.p(0, 0, 0, .8));
    const top0 = P.blk.userData.h0;
    op(P.blk, c.show(0, .8, 4, 0)); setBlock(P.blk, lerp(.06, top0, c.p(0, .8, 0, 1.8)));
    P.datum.forEach((d, i) => op(d, c.show(0, 1.8, 2, 0) * stagger(c.p(0, 1.8, 0, 'end'), i, 3)));
    // 2 设备
    const g = c.show(1, 0); op(P.gan, g); P.gan.position.x = lerp(4.4, 2.6, c.p(1, 0, 1, .8));
    op(P.feed[0], c.show(1, .6, 2, 0)); op(P.feed[1], c.show(1, .6, 2, 0)); op(P.feed[2], c.show(1, .6, 2, 0));
    const tip = P.gan.userData.carriage.position; P.feed.forEach(f => setP(f, [P.gan.position.x, P.gan.userData.h - .62, 0]));
    op(P.travel, c.show(1, 1.5, 2, 1)); op(P.safe, c.show(1, 2, 3, 0)); K.drawLine(P.safe, c.p(1, 2, 1, 'end'));
    // 3 粗加工：刀路沿表面铺开，坯料按刀路前缀逐行去料（不再整体缩放）
    op(P.path, c.show(2, 0, 4, 0) * .8); K.drawLine(P.path, c.lin(2, 0, 2, 1.2));
    // 4 精加工：主轴往复，余量收净后块体淡出
    const fine = c.lin(3, 0, 3, 'end');
    if (c.after(3, 0)) { op(P.blk, c.out(4, 0) * (1 - fine * .9)); }
    const k = Math.floor((c.after(2, 0) ? c.lin(2, 0, 4, 0) : 0) * (P.pathPts.length - 1)), pp = P.pathPts[Math.max(0, k)];
    // 粗加工留 .05 余量，精加工收到 .008（留一点避免与 clay 层 z-fighting）；每帧从原始顶点重算，可任意回退
    carveBlank(P.blk, car, k, lerp(.05, .008, c.after(3, 0) ? ease(fine) : 0), c.after(2, 0) && !c.after(4, 1));
    if (c.between(2, 0, 4, 0)) { P.gan.position.x = pp[0]; P.gan.userData.carriage.position.set(0, P.gan.userData.h, pp[2]); P.gan.userData.carriage.position.y = pp[1] + .6; }
    op(P.chips, c.show(2, .3, 4, 0)); P.chips.position.set(pp[0], pp[1], pp[2]); P.chips.userData.update(t, 1);
    if (c.after(4, 0)) { op(P.gan, c.out(4, 0)); }
    // 5 截面样板
    P.tmpl.forEach((l, i) => { op(l, c.show(4, 0, 5, .5) * stagger(c.p(4, 0, 4, 1), i, 3)); });
    const fix = c.p(4, 1.5, 4, 2.3);
    op(P.dev, c.show(4, 1, 5, 0) * (1 - fix) * (.6 + .4 * Math.sin(t * 7))); op(P.ok, c.show(4, 2.3, 5, .5));
    // 6 体量评审
    op(P.bars, c.show(5, 0)); P.bars.userData.bars.forEach((b, i) => b.position.x = Math.sin(t * .4 + i) * .6);
    op(P.eye, c.show(5, 1));
    if (c.after(5, 0)) { op(P.datum[0], 0); }
  }
};

// ———————————————————— clay-2 刮削精修与光影评审 ————————————————————
export const clay2 = {
  phases: ['工具接近', '刮削精修', '光带评审'],
  shots: [
    {title: '工具接近表面', detail: '刮刀移到需要修改的翼子板区域，光圈标出要改变的范围'},
    {title: '往返刮削', detail: '刮刀贴着曲面往返，接触点亮起，曲率变化同步显示'},
    {title: '分区精修', detail: '刮削轨迹按同一方向排开，修改向四周自然过渡'},
    {title: '共同调整', detail: '设计与模型两方对照轮廓，修改前后的截面线叠在一起比较'},
    {title: '移动光带观察', detail: '顶部光带扫过车身，反射条纹若突然折转，就标出待查位置'},
    {title: '记录修改', detail: '修改范围与原因被记录，作为下一步数字回采的依据'}
  ],
  cams: [
    [{tg: [1.5, .75, .6], r: 4.6, az: 55, el: 22}],
    [{tg: [1.5, .78, .7], r: 3.0, az: 60, el: 25}],
    [{tg: [1.4, .78, .6], r: 3.6, az: 40, el: 40}],
    [{tg: [1.2, .8, 0], r: 5.6, az: 80, el: 10}],
    [{tg: [0, .7, 0], r: 7.6, az: 40, el: 14}],
    [{tg: [.6, .8, 0], r: 7.2, az: 35, el: 18}]
  ],
  build(K, S, car) {
    const P = {};
    const cx = 1.5, cz = .62, cy = car.heightAt(cx, cz);
    P.cen = [cx, cy, cz];
    P.zone = K.add(K.ring(.38, COL.cyan, .01)); P.zone.rotation.x = -Math.PI / 2; setP(P.zone, [cx, cy + .02, cz]);
    P.tool = K.add(new THREE.Group());
    const blade = K.solid(new THREE.BoxGeometry(.16, .01, .05), 0xd7dee4, {metal: .9, rough: .2}); const handle = K.solid(new THREE.CylinderGeometry(.018, .02, .38, 12), 0x3a2a1e, {metal: .1, rough: .7}); handle.position.y = .2; handle.rotation.z = .3;
    const tipG = K.glow(new THREE.SphereGeometry(.025, 10, 8), COL.amber, 3); P.tool.add(blade, handle, tipG);
    // 刀刃与曲面之间恒定的间隙：刀口两端各采一次 heightAt，刀身绕 z 跟着切向摆；这根小竖线的长度就是间隙本身
    P.gapTick = K.line([[0, -.005, 0], [0, -.014, 0]], COL.amber, .95); P.tool.add(P.gapTick);
    // 刮过的区域亮起来：沿刀路铺一条贴合曲面的亮带，随刀刃进度显出（不是整块淡入）
    P.burnPts = (() => { const o = []; for (let j = 0; j < 7; j++) { const z = cz - .21 + j * .07, row = []; for (let x = cx - .35; x <= cx + .351; x += .03) row.push([x, car.heightAt(x, z) + .007, z]); o.push(...(j % 2 ? row.reverse() : row)); } return o; })();
    P.burn = K.add(K.tube(P.burnPts, .009, COL.white, {glow: true, segs: 300}));
    P.strokes = Array.from({length: 7}, (_, i) => { const z = cz - .21 + i * .07; const pts = []; for (let x = cx - .35; x <= cx + .35; x += .05) pts.push([x, car.heightAt(x, z) + .012, z]); return K.add(K.line(pts, COL.amber, .8)); });
    P.comb = K.add(K.line(section(car, cx).map(p => [p[0] + .002, p[1] + .02, p[2]]), COL.white, .8));
    P.curv = curvComb(K, section(car, cx).map(p => [p[0], p[1] + .02, p[2]]), COL.amber, .3);
    P.before = K.add(K.line(car.profile.filter(b => b.x > .5 && b.x < 2.3).map(b => [b.x, b.top + .03, .95]), COL.amber, .9));
    P.after = K.add(K.line(car.profile.filter(b => b.x > .5 && b.x < 2.3).map(b => [b.x, b.top + .03 - .03 * Math.exp(-Math.pow((b.x - 1.5) / .3, 2)), .96]), COL.green, .95));
    P.who = [['palette', COL.pink, [.4, 1.6, 1.0]], ['wrench', COL.amber, [2.4, 1.6, 1.0]]].map(([ic, col, p]) => ({b: chip(K, ic, col, p, .36), l: link(K, p, [1.5, 1.0, .9], col, .1)}));
    P.bars = lightBars(K, 5, 6, COL.white);
    P.kink = K.add(K.ring(.16, COL.amber, .01)); setP(P.kink, [-.6, car.heightAt(-.6, .7) + .03, .7]); P.kink.rotation.x = -Math.PI / 2;
    P.kinkI = chip(K, 'warn', COL.amber, [-.6, 1.35, .7], .26);
    P.box = K.add(K.holoBox(.8, .3, .6, COL.green, .05, .9)); setP(P.box, [cx, cy, cz - .1]);
    P.doc = docStack(K, 3, COL.white, .3, .4); setP(P.doc, [2.9, .02, 1.2]);
    P.docL = link(K, [cx, cy + .2, cz], [2.9, .25, 1.2], COL.white, .3, true);
    P.next = chip(K, 'chip', COL.cyan, [2.9, 1.0, 1.2], .32);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t, [cx, cy, cz] = P.cen;
    car.set('paint', 0); car.set('clay', 1);
    op(P.zone, c.show(0, .6, 3, 0) * (.7 + .3 * Math.sin(t * 3))); P.zone.scale.setScalar(1 + .5 * c.p(2, 0, 2, 1));
    // 工具运动：刀刃沿刮削路线推进，刀口两端各采一次车面高度 → 刀身跟着切向摆，刃口与曲面间隙恒定
    const app = c.p(0, 0, 0, 1.2), bladeK = c.lin(1, 0, 2, 'end');
    let x = cx, z = cz, lift = .6 * (1 - app);
    if (c.between(1, 0, 3, 0)) { const bp = P.burn.userData.curve.getPointAt(bladeK); x = bp.x; z = bp.z; lift = 0; }   // 刀位与亮带同一条弧长参数
    const e0 = car.heightAt(x - .08, z), e1 = car.heightAt(x + .08, z), tilt = Math.atan2(e1 - e0, .16);
    op(P.tool, c.show(0, 0, 3, 0)); setP(P.tool, [x, (e0 + e1) / 2 + .014 + lift, z]); P.tool.rotation.set(0, .4, tilt);
    op(P.burn, c.show(1, .2, 3, .3)); K.growTube(P.burn, bladeK);        // 刮过的区域跟着刀刃亮起来
    op(P.comb, c.show(1, 1, 2, 1)); op(P.curv, c.show(1, .7, 2, 1));
    P.strokes.forEach((l, i) => { op(l, c.show(2, 0, 3, .5) * stagger(c.p(2, 0, 2, 'end'), i, 7)); });
    // 4 共同调整
    op(P.before, c.show(3, 0, 4, 0)); op(P.after, c.show(3, .8, 4, 0)); K.drawLine(P.after, c.p(3, .8, 3, 'end'));
    P.who.forEach((w, i) => { const k = c.show(3, 0, 4, 0) * stagger(c.p(3, 0, 3, .8), i, 2); op(w.b, k); op(w.l, k); K.drawLine(w.l, k); });
    // 5 光带
    const lb = c.show(4, 0, 5, 1); op(P.bars, lb); P.bars.userData.bars.forEach((b, i) => b.position.x = lerp(-2.5, 2.5, c.lin(4, 0, 4, 'end')) * (i % 2 ? 1 : .8));
    if (lb > 0) { car.set('zebra', lb * .55); car.layers.zebra.mat.uniforms.uPhase.value = c.lin(4, 0, 4, 'end') * 12; }
    op(P.kink, c.show(4, 1.2, 5, 1) * (.6 + .4 * Math.sin(t * 6))); op(P.kinkI, c.show(4, 1.4, 5, 1));
    // 6 记录
    op(P.box, c.show(5, 0)); op(P.doc, c.show(5, .6)); op(P.docL, c.show(5, .6)); K.drawLine(P.docL, c.p(5, .6, 5, 1.2)); op(P.next, c.show(5, 1.4));
  }
};

// ———————————————————— clay-3 扫描回采与曲面对齐 ————————————————————
export const clay3 = {
  phases: ['建立测量基准', '采集点云', '配准与偏差'],
  shots: [
    {title: '扫描基准', detail: '扫描臂就位，车身上的基准靶点与坐标轴先建立对应关系'},
    {title: '光束采集', detail: '扫描光幕逐段扫过表面，被照到的地方留下测量点'},
    {title: '形成点云', detail: '油泥车淡去，密集点云完整记录实体形状'},
    {title: '配准数据', detail: '数字模型先偏在一旁，按基准移动到点云上精确重合'},
    {title: '偏差分析', detail: '偏差色图显出修改区域；真实修改与测量误差分开标注'},
    {title: '回到数字模型', detail: '确认的变化写回数字模型，再与实物核对一致'}
  ],
  cams: [
    [{tg: [0, .7, 0], r: 8.4, az: 40, el: 18}],
    [{tg: [0, .8, 0], r: 7.6, az: 55, el: 22}],
    [{tg: [0, .7, 0], r: 7.4, az: 35, el: 16}],
    [{tg: [0, .8, 0], r: 7.8, az: 45, el: 20}],
    [{tg: [.6, .8, 0], r: 6.4, az: 40, el: 24}],
    [{tg: [0, .8, 0], r: 8.4, az: 30, el: 16}]
  ],
  build(K, S, car) {
    const P = {};
    P.arm = robotArm(K, [0, 0, 1.9]);
    P.targets = [[2.0, .82, .7], [-.2, 1.38, 0], [-1.9, .95, .7], [.8, .6, .92]].map(p => hardpoint(K, p, COL.white, .035));
    P.axes = [[1, 0, 0, COL.red], [0, 1, 0, COL.green], [0, 0, 1, COL.blue]].map(([x, y, z, col]) => K.add(K.tube([[2.6, .02, 1.2], [2.6 + x * .7, .02 + y * .7, 1.2 + z * .7]], .012, col, {glow: true})));
    P.fan = K.add(new THREE.Mesh(new THREE.PlaneGeometry(.02, 1, 1, 1), new THREE.MeshBasicMaterial({visible: false})));
    P.sheet = K.add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), new THREE.MeshBasicMaterial({color: new THREE.Color(COL.cyan).multiplyScalar(1.6), transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false}))); P.sheet.rotation.y = Math.PI / 2;
    P.sheetEdge = K.add(K.glow(new THREE.BoxGeometry(.01, 1.6, 2.2), COL.cyan, 2.6, .8));
    P.links = P.targets.map(tg => link(K, tg.position.toArray(), [2.6, .3, 1.2], COL.white, .1, true));
    P.cmp = [['check', COL.green, [1.9, 1.35, .6]], ['cross', COL.white, [-.9, 1.6, .5]]].map(([ic, col, p]) => chip(K, ic, col, p, .28));
    P.loop = chip(K, 'loop', COL.cyan, [0, 2.1, 0], .4);
    return P;
  },
  update(c, P, K, S, car) {
    const t = c.t;
    car.set('paint', 0);
    const clayK = 1 - c.p(2, 0, 2, 1.2);
    car.set('clay', clayK);
    // 1 基准
    op(P.arm, c.show(0, 0, 3, 0)); P.arm.userData.reach([.6 + .3 * Math.sin(t * .5), 1.4, .9]);
    P.targets.forEach((h, i) => op(h, c.show(0, .6, 4, 0) * stagger(c.p(0, .6, 0, 1.6), i, 4)));
    P.axes.forEach(a => { op(a, c.show(0, 1.2, 4, 0)); K.growTube(a, c.p(0, 1.2, 0, 1.8)); });
    P.links.forEach((l, i) => { op(l, c.show(0, 1.6, 1, 0)); K.drawLine(l, c.p(0, 1.6, 0, 'end')); });
    // 2 采集：扫描臂沿车长方向跟着光幕走，点云按扫描进度逐段出现（reveal 只放已扫过的段落，不整块淡入）
    const sw = c.lin(1, 0, 1, 'end'), sx = lerp(2.5, -2.5, sw), seg = Math.floor(sw * 16) / 16;
    op(P.sheet, c.show(1, 0, 1, 2.6)); op(P.sheetEdge, c.show(1, 0, 1, 2.6)); P.sheet.position.set(sx, .8, 0); P.sheetEdge.position.set(sx, .8, 0);
    const scanOn = c.between(1, 0, 3, 0);
    P.arm.position.x = scanOn ? clamp(sx * .6, -1.4, 1.4) : 0;
    if (scanOn) P.arm.userData.reach([sx, 1.45, .75]);
    car.set('points', c.after(1, 0) ? 1 : 0); car.ptsMat.uniforms.uReveal.value = c.after(2, 0) ? 10 : -lerp(2.5, -2.5, seg);
    // 4 配准
    const off = c.show(3, 0, 5, 1);
    if (off > 0) { const k = c.p(3, .6, 3, 'end'); cad(car, .55 * off); car.body.position.set(0, 0, 0); car.layers.heat.group.position.set(.5 * (1 - k), .25 * (1 - k), -.4 * (1 - k)); car.layers.heat.group.rotation.y = .1 * (1 - k); }
    else { car.layers.heat.group.position.set(0, 0, 0); car.layers.heat.group.rotation.y = 0; }
    // 5 偏差
    if (c.after(4, 0)) { const u = car.layers.heat.mat.uniforms; car.set('heat', c.show(4, 0, 5, 1)); u.uMode.value = 0; u.uLoad.value = c.p(4, 0, 4, 1); u.uCenter.value.set(1.5, .8, .6); u.uRadius.value = .5; car.layers.heat.group.position.set(0, 0, 0); car.layers.heat.group.rotation.y = 0; }
    P.cmp.forEach((m, i) => op(m, c.show(4, 1 + i * .5, 5, .5)));
    // 6 回写
    if (c.after(5, 0)) { const k = c.p(5, 0, 5, 1.2); cad(car, k); car.set('points', 1 - k); }
    op(P.loop, c.show(5, 1));
  }
};
