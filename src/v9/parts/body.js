// 白车身：门槛 / A·B·C 柱 / 顶边梁 / 前后来纵梁 / 地板横梁 / 顶盖横梁 / 防撞梁 / 减震塔 / 前围板。
// 关键：梁不是圆柱"管子"，而是按真实冲压件截面（帽形 / C 型槽 / 矩形管 / 椭圆管）扫掠出来的闭合型材，
// 带翻边、带端盖、拐角有焊道与接头加强板；截面沿路径还能渐变（A 柱上细下粗）。
// 尺寸跟随整车：车长 4.72m，门槛高 0.30m，顶边梁随车顶弧线（car.topAt 存在时直接取车顶高度）。
export function buildBiw(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  const g = ctx.reg('biw', '白车身骨架', 'engineering-1 / launch-1');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const car = opts.car || null;
  const roofAt = car && car.topAt ? (x => car.topAt(x).roof) : (x => 1.36 - .12 * Math.pow((x - .15) / 1.65, 2));
  const z0 = .76, zr = .60, ys = .30;
  const xs = [1.0, .45, -.05, -.75, -1.55];
  const yA = roofAt(xs[1]) - .035, yC = roofAt(xs[3]) - .04;

  const matShell = P.tier('shell', {color: C.steel, roughness: .42});
  const matStamped = P.tier('shell', {color: C.castAlu, roughness: .48});
  const matHot = P.tier('machined', {color: C.darkSteel, roughness: .32});
  const matBead = P.tier('machined', {color: 0xd8c9a8, roughness: .38, metalness: .55});

  const beams = [];
  const beam = (name, pts, profile, {segments = 18, scaleAt = null, mat = matShell} = {}) => {
    const m = mesh(G.sweep(pts, profile, {segments, scaleAt, caps: true}), mat, name);
    m.userData.role = name;
    beams.push(m);
    return m;
  };

  // ---------- 门槛（帽形截面，两端翻边）----------
  for (const s of [-1, 1]) {
    beam(`rocker-${s > 0 ? 'L' : 'R'}`, [[1.85, .335, s * .70], [1.2, .31, s * .755], [-1.1, .31, s * .755], [-1.75, .345, s * .72]], G.SECT.hat(.105, .135, .014, .0018), {segments: 22});
    // 门槛内加强件（双层板，厚度方向错开）
    beam(`rocker-inner-${s > 0 ? 'L' : 'R'}`, [[1.7, .30, s * .66], [0, .29, s * .70], [-1.6, .31, s * .66]], G.SECT.channel(.07, .05, .0016), {segments: 18, mat: matStamped});
  }

  // ---------- A 柱（上细下粗）----------
  for (const s of [-1, 1]) {
    beam(`A-pillar-${s > 0 ? 'L' : 'R'}`, [[1.00, .90, s * .765], [.78, 1.06, s * .705], [xs[1], yA, s * zr]],
      G.SECT.hat(.058, .085, .011, .0016), {segments: 16, scaleAt: t => 1.06 - .20 * t});
  }

  // ---------- 顶边梁 ----------
  for (const s of [-1, 1]) {
    beam(`roof-rail-${s > 0 ? 'L' : 'R'}`, [[xs[1], yA, s * zr], [-.20, roofAt(-.20) - .035, s * (zr - .015)], [xs[3], yC, s * zr]],
      G.SECT.channel(.072, .052, .0018), {segments: 20});
  }

  // ---------- B 柱（横向加宽，是"侧碰"主承力件）----------
  for (const s of [-1, 1]) {
    beam(`B-pillar-${s > 0 ? 'L' : 'R'}`, [[xs[2], .31, s * .735], [xs[2], .72, s * .79], [xs[2] - .02, roofAt(xs[2]) - .035, s * (zr + .015)]],
      G.SECT.hat(.075, .10, .012, .0018), {segments: 16, scaleAt: t => 1 + .08 * Math.sin(t * Math.PI)});
  }

  // ---------- C 柱 ----------
  for (const s of [-1, 1]) {
    beam(`C-pillar-${s > 0 ? 'L' : 'R'}`, [[xs[3], yC, s * zr], [-1.20, 1.06, s * .655], [xs[4], .88, s * .72]],
      G.SECT.hat(.07, .06, .012, .0016), {segments: 18});
  }

  // ---------- 前 / 后纵梁（Front / Rear rail）----------
  for (const s of [-1, 1]) {
    beam(`front-rail-${s > 0 ? 'L' : 'R'}`, [[2.26, .47, s * .44], [1.72, .44, s * .47], [1.20, .32, s * .50]], G.SECT.hat(.085, .105, .013, .0018), {segments: 12});
    beam(`rear-rail-${s > 0 ? 'L' : 'R'}`, [[-2.26, .49, s * .46], [-1.72, .445, s * .49], [-1.20, .32, s * .54]], G.SECT.hat(.08, .095, .013, .0018), {segments: 12});
    // 纵梁前端能量吸收盒（溃缩盒）
    const crush = mesh(G.cbox(.13, .08, .075, .006), matStamped, `crash-box-${s > 0 ? 'L' : 'R'}`);
    crush.position.set(2.33, .47, s * .44);
  }

  // ---------- 地板横梁 ----------
  const crossMembers = [];
  for (const x of [1.20, .45, -.05, -.60, -1.20]) {
    const b = beam(`floor-cross-${x}`, [[x, .30, z0 - .02], [x, .285, 0], [x, .30, -(z0 - .02)]], G.SECT.channel(.065, .048, .0016), {segments: 8, mat: matStamped});
    crossMembers.push(b);
  }
  // 顶盖横梁（roof bow）
  const bows = [];
  for (const x of [.45, -.25, -.95]) {
    const y = roofAt(x) - .045;
    const b = beam(`roof-bow-${x}`, [[x, y, zr - .02], [x, y + .015, 0], [x, y, -(zr - .02)]], G.SECT.rect(.045, .03), {segments: 10, mat: matStamped});
    bows.push(b);
  }

  // ---------- 前 / 后防撞梁（椭圆管 + 吸能盒）----------
  for (const [x, y, zz] of [[2.30, .48, .72], [-2.30, .50, .72]]) {
    const bumper = mesh(G.sweep([[x, y, zz], [x + .02, y, 0], [x, y, -zz]], G.SECT.oval(.105, .075, 12), {segments: 10}), matHot, x > 0 ? 'bumper-front' : 'bumper-rear');
  }

  // ---------- 减震塔（前）----------
  const towers = [];
  for (const s of [-1, 1]) {
    const t = new THREE.Group(); t.name = 'shock-tower'; t.position.set(1.32, .45, s * .52); g.add(t);
    const cone = mesh(G.lathe([[.115, 0], [.105, .02], [.075, .10], [.055, .16], [.055, .185], [.03, .185], [.03, .16], [.05, .16], [.05, .10], [.08, .02], [.09, 0], [.115, 0]], 16, {angle: 44}), matStamped, 'tower-shell', t);
    cone.rotation.z = -.25;
    const topRing = mesh(G.lathe([[.032, 0], [.058, 0], [.058, .012], [.032, .012], [.032, 0]], 14, {angle: 40}), matHot, 'tower-top', t);
    topRing.position.set(-.018, .185, 0); topRing.rotation.z = -.25;
    towers.push(t);
  }

  // ---------- 前围板 / 地板（带孔与加强筋，不是一张整板）----------
  const firewall = mesh(G.rplateHoles(1.42, .52, .0022, [
    {x: -.45, y: .05, w: .16, h: .10, r: .02},
    {x: .10, y: .02, w: .30, h: .12, r: .03},
    {x: .52, y: .06, w: .12, h: .08, r: .02},
    {x: -.05, y: -.14, w: .18, h: .06, r: .02}
  ], {r: .015, edge: .0004, seg: 2}), matStamped, 'firewall');
  firewall.position.set(1.02, .62, 0); firewall.rotation.y = Math.PI / 2;
  const floorPan = mesh(G.rplateHoles(2.5, 1.30, .0018, [
    {x: -.55, y: 0, w: .28, h: .18, r: .03}, {x: .55, y: 0, w: .28, h: .18, r: .03},
    {x: 0, y: .40, w: .50, h: .10, r: .02}, {x: 0, y: -.40, w: .50, h: .10, r: .02}
  ], {r: .02, edge: .0004, seg: 2}), matStamped, 'floor-pan');
  floorPan.rotation.x = -Math.PI / 2; floorPan.position.set(0, .285, 0);
  // 地板加强筋
  const floorRibs = [];
  for (let i = 0; i < 6; i++) {
    const r = mesh(G.cbox(.012, .012, 1.2, .0012), matStamped, 'floor-rib');
    r.position.set(-.9 + i * .36, .295, 0);
    floorRibs.push(r);
  }

  // ---------- 侧碰加强梁（车门内）----------
  const impactBars = [];
  for (const s of [-1, 1]) {
    const b = mesh(G.sweep([[.95, .55, s * .74], [-.05, .52, s * .76], [-.95, .55, s * .74]], G.SECT.oval(.05, .035, 8), {segments: 10}), matHot, `impact-bar-${s > 0 ? 'L' : 'R'}`);
    impactBars.push(b);
  }

  // ---------- 接头加强板（gusset）：梁柱交接处的三角板 ----------
  const joints = [];
  const gussetSpec = [
    [.98, .86, .74, -.5], [.98, .86, -.74, .5], [-.06, .70, .78, .3], [-.06, .70, -.78, -.3],
    [-.76, .95, .62, .4], [-.76, .95, -.62, -.4], [1.24, .40, .64, -.4], [1.24, .40, -.64, .4]
  ];
  for (const [x, y, z, rz] of gussetSpec) {
    const gu = mesh(G.cbox(.055, .045, .0035, .0008), matStamped, 'gusset');
    gu.position.set(x, y, z);
    gu.rotation.set(0, 0, rz);
    joints.push(gu);
  }

  // ---------- 焊道：沿门槛与 A/B 柱交接处（真实焊缝是凸起的一条）----------
  const welds = [];
  welds.push(mesh(G.bead([[1.55, .345, .755], [1.2, .325, .757], [.6, .32, .757]], {radius: .004, segs: 22}), matBead, 'weld-bead'));
  welds.push(mesh(G.bead([[-.06, .70, .788], [-.06, .95, .80], [-.06, 1.18, .74]], {radius: .0035, segs: 18}), matBead, 'weld-bead'));
  welds.push(mesh(G.bead([[.98, .86, .742], [.86, 1.0, .70]], {radius: .0035, segs: 10}), matBead, 'weld-bead'));

  // ---------- 螺栓（车身连接：门铰链、副车架）----------
  const boltPos = [
    [2.30, .40, .60], [2.30, .40, -.60], [1.24, .40, .64], [1.24, .40, -.64],
    [-1.30, .38, .58], [-1.30, .38, -.58], [.98, .80, .73], [.98, .80, -.73]
  ];
  const bolts = mesh(F.boltArray(P, boltPos.map(p => ({p, r: [Math.PI / 2, 0, 0]})), {d: 10 * MM, len: 22 * MM, threaded: false, name: 'body-bolts'}), matHot, 'body-bolts');

  // ---------- 车身铭牌 ----------
  const plate = mesh(new THREE.PlaneGeometry(.10, .04), P.tier('label', {map: L.label({serial: 'BIW-2418-01', spec: 'Steel BIW · 1480MPa hot-stamp', w: 512, h: 256, qr: false})}), 'nameplate');
  plate.position.set(-1.10, .32, z0 + .002);
  plate.rotation.set(-Math.PI / 2, 0, Math.PI / 2);

  return ctx.expose(g, {
    beams, crossMembers, bows, towers, firewall, floorPan, floorRibs, impactBars,
    joints, gussets: joints, welds, bolts, plate,
    roofAt, xs, z0, zr
  }, 30000);
}
