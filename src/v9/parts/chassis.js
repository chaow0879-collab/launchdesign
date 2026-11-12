// 底盘角总成：麦弗逊滑柱（弹簧/减振器/防尘套/顶胶）+ 下摆臂（衬套/球头）+ 转向节 + 轮毂轴承
// + 通风制动盘（带钻孔/帽/五颗轮毂螺栓）+ 卡钳（分泵/刹车片/放气螺钉/软管）+ 稳定杆连杆。
// 局部坐标：原点在轮心，x 向前，z 向外（+z = 车外侧）。
export function buildSuspensionCorner(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('suspension', '悬架角总成', 'engineering-2 / validation-2');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matCast = P.tier('shell', {color: C.castAlu, roughness: .48});
  const matSteel = P.tier('machined', {color: C.steel, roughness: .3});
  const matDark = P.tier('shell', {color: C.blackSteel, roughness: .42});
  const matRubber = P.tier('rubber', {color: 0x16191c, roughness: .9});
  const matSpring = P.tier('machined', {color: C.spring, roughness: .26});
  // lod='lo'：非特写角（例如前轴）用，省掉防尘套细节/钻孔/稳定杆连杆等，外观轮廓不变
  const lo = opts.lod === 'lo';

  // ---------- 滑柱：减振器筒 + 活塞杆 + 防尘套 + 顶胶 ----------
  const strut = new THREE.Group(); strut.name = 'strut'; strut.position.set(0, .06, -.055); g.add(strut);
  const damper = mesh(G.lathe([[.020, 0], [.034, 0], [.034, .010], [.031, .012], [.031, .28], [.026, .295], [.020, .296], [.020, 0]], 16, {angle: 34}), matDark, 'damper-body', strut);
  const rod = mesh(G.rcyl(.011, .19, {seg: 10}), P.tier('chrome', {color: 0xd2d9de, roughness: .12}), 'piston-rod', strut);
  rod.position.y = .38;
  const dustBoot = mesh(G.bellows(.034, .10, 4, .12, 12), matRubber, 'dust-boot', strut);
  dustBoot.position.y = .345;
  const bumpStop = mesh(G.bellows(.020, .05, 3, .22, 10), P.tier('plastic', {color: 0xd9c86a, roughness: .75}), 'bump-stop', strut);
  bumpStop.position.y = .44;
  // 弹簧（真实螺旋线 + 两端并紧）
  const spring = mesh(G.spring(.075, .009, 6, .26, {perTurn: 11, radial: 5}), matSpring, 'spring', strut);
  spring.position.y = .19;
  for (const [y, r] of [[.055, .075], [.325, .072]]) {
    if (lo) break;
    const seat = mesh(G.lathe([[r - .018, 0], [r + .004, 0], [r + .004, .008], [r - .018, .008], [r - .018, 0]], 16, {angle: 45}), P.tier('shell', {color: C.darkAlu}), 'spring-seat', strut);
    seat.position.y = y;
  }
  // 顶胶：橡胶 + 钢碗 + 螺栓
  const topMount = new THREE.Group(); topMount.name = 'top-mount'; topMount.position.y = .57; strut.add(topMount);
  const tmRubber = mesh(G.lathe([[.018, 0], [.055, 0], [.055, .012], [.018, .012], [.018, 0]], 16, {angle: 52}), matRubber, 'top-rubber', topMount);
  const tmSteel = mesh(G.lathe([[.016, .012], [.048, .012], [.048, .024], [.016, .024], [.016, .012]], 16, {angle: 40}), matSteel, 'top-plate', topMount);
  const tmBolts = [];
  if (!lo) for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const b = F.bolt(P, {d: 8 * .001, len: 16 * .001, threaded: false});
    b.position.set(Math.cos(a) * .040, .026, Math.sin(a) * .040);
    topMount.add(b); tmBolts.push(b);
  }

  // ---------- 下摆臂（L 形，双衬套 + 球头）----------
  const arm = new THREE.Group(); arm.name = 'lower-arm'; g.add(arm);
  const armGeo = G.sweep([[0, -.115, -.075], [0, -.135, -.18], [0, -.125, -.30]], G.SECT.oval(.055, .026, 10), {segments: 10});
  const lowerArm = mesh(armGeo, matCast, 'lower-arm-body', arm);
  const bushings = [];
  for (const dz of [-.015, .015]) {
    const b = mesh(G.lathe([[.014, 0], [.030, 0], [.030, .026], [.014, .026], [.014, 0]], 14, {angle: 50}), matRubber, 'bush', arm);
    b.rotation.z = Math.PI / 2;
    b.position.set(0, -.128, -.30 + dz);
    bushings.push(b);
    if (lo) continue;
    const sleeve = mesh(G.tube(.0155, .011, .034, 12), matSteel, 'bush-sleeve', arm);
    sleeve.rotation.z = Math.PI / 2; sleeve.position.copy(b.position);
  }
  // 球头（球 + 锥 + 防尘套）
  const ballJoint = new THREE.Group(); ballJoint.name = 'ball-joint'; ballJoint.position.set(0, -.115, -.065); arm.add(ballJoint);
  const ball = mesh(G.lathe([[0, -.012], [.014, -.006], [.016, 0], [.014, .006], [0, .012]], 12, {angle: 30}), matSteel, 'ball', ballJoint);
  const bjBoot = mesh(G.bellows(.024, .022, 2, .12, 10), matRubber, 'ball-boot', ballJoint);
  const bjStud = mesh(G.rcyl(.009, .03, {seg: 8}), matSteel, 'ball-stud', ballJoint);
  bjStud.position.y = .02;

  // ---------- 转向节 + 轮毂 ----------
  const knuckle = new THREE.Group(); knuckle.name = 'knuckle'; g.add(knuckle);
  const knBody = mesh(G.cbox(.10, .22, .055, .008), matCast, 'knuckle-body', knuckle);
  knBody.position.set(0, -.02, -.085);
  const knRibs = [];
  for (const s of [-1, 1]) {
    knRibs.push({geo: G.cbox(.008, .17, .045, .001), matrix: new THREE.Matrix4().makeTranslation(s * .035, -.02, -.085)});
  }
  mesh(G.mergeGeos(knRibs), P.tier('shell', {color: C.castAlu, roughness: .52}), 'knuckle-ribs', knuckle);
  const hub = mesh(G.lathe([[0, 0], [.028, 0], [.028, .026], [.062, .026], [.062, .048], [.030, .048], [.030, .062], [0, .062]], 20, {angle: 34}), matSteel, 'hub', knuckle);
  hub.rotation.x = -Math.PI / 2; hub.position.set(0, 0, -.045);
  // 五颗轮毂螺栓 + 螺母
  const studs = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2 + .3;
    const st = F.stud(P, {d: 12 * .001, len: 30 * .001});
    st.position.set(Math.cos(a) * .045, .055, Math.sin(a) * .045);
    knuckle.add(st); studs.push(st);
  }
  // ABS 传感器
  const absSensor = lo ? null : mesh(G.rcyl(.008, .03, {seg: 8}), P.tier('plastic', {color: 0x24292e}), 'abs-sensor', knuckle);
  if (absSensor) { absSensor.rotation.z = Math.PI / 2; absSensor.position.set(.045, .05, -.10); }
  const absWire = lo ? null : mesh(G.cable([[.06, .05, -.10], [.09, .02, -.12], [.10, -.04, -.14]], .004, {segs: 12, radial: 4}), matRubber, 'abs-wire', knuckle);

  // ---------- 通风制动盘 ----------
  const disc = new THREE.Group(); disc.name = 'brake-disc'; g.add(disc);
  const ring = mesh(G.lathe([[.098, -.014], [.170, -.014], [.170, .014], [.098, .014], [.098, -.014]], 30, {angle: 26}), P.tier('machined', {color: 0x9aa3aa, roughness: .34, metalness: .85}), 'friction-ring', disc);
  ring.rotation.x = Math.PI / 2;
  const hat = mesh(G.lathe([[.040, -.030], [.072, -.030], [.072, -.014], [.040, -.014], [.040, -.030]], 20, {angle: 40}), P.tier('shell', {color: C.darkSteel}), 'disc-hat', disc);
  hat.rotation.x = Math.PI / 2;
  // 钻孔（用深色小圆柱表现，不做布尔；16 个孔）
  const holeEntries = [];
  for (let i = 0; i < 16; i++) {
    const a = i * (Math.PI * 2 / 16) + .1;
    const r = i % 2 ? .128 : .150;
    holeEntries.push({p: [Math.cos(a) * r, Math.sin(a) * r, .016], r: [Math.PI / 2, 0, 0]});
  }
  // 孔洞作为暗色小圆片（贴面），比布尔省面数，视觉上仍是穿孔
  const holes = new THREE.Group(); holes.name = 'disc-holes'; disc.add(holes);
  if (!lo) for (const h of holeEntries) {
    const d = mesh(new THREE.CircleGeometry(.0055, 8), P.tier('label', {color: 0x2a3035, roughness: .9, textures: null, metalness: 0}), 'disc-hole', holes);
    d.position.set(h.p[0], h.p[1], h.p[2]);
  }

  // ---------- 卡钳 ----------
  const caliper = new THREE.Group(); caliper.name = 'caliper'; caliper.position.set(.115, .085, .004); g.add(caliper);
  const calBody = mesh(G.cbox(.075, .095, .062, .008), P.tier('shell', {color: 0xb0332c, roughness: .38}), 'caliper-body', caliper);
  const calRibs = [];
  for (let i = 0; i < 3; i++) calRibs.push({geo: G.cbox(.006, .07, .05, .001), matrix: new THREE.Matrix4().makeTranslation(-.036 + i * .012, 0, .004)});
  mesh(G.mergeGeos(calRibs), P.tier('machined', {color: 0x8c2a24}), 'caliper-ribs', caliper);
  const pads = [];
  for (const s of [-1, 1]) {
    const pad = mesh(G.cbox(.058, .080, .012, .003), P.tier('ceramic', {color: 0x4a4f52, roughness: .8}), 'brake-pad', caliper);
    pad.position.set(0, 0, s * .024);
    pads.push(pad);
    const piston = mesh(G.rcyl(.019, .022, {seg: 12}), P.tier('chrome', {color: 0xd6dde2}), 'piston', caliper);
    piston.rotation.x = Math.PI / 2; piston.position.set(0, 0, s * .032);
  }
  const bleed = mesh(G.rcyl(.005, .014, {seg: 8}), P.tier('machined', {color: C.brass}), 'bleed-screw', caliper);
  bleed.position.set(-.02, .055, .02);
  const banjo = mesh(G.rcyl(.009, .014, {seg: 10}), P.tier('machined', {color: C.brass}), 'banjo', caliper);
  banjo.position.set(0, .058, -.01);
  const hose = mesh(G.cable([[0, .07, -.01], [.01, .14, -.03], [.03, .22, -.06]], .007, {segs: 14, radial: 5}), matRubber, 'brake-hose', caliper);
  const calBolts = [];
  for (const y of [-.03, .03]) {
    const b = F.bolt(P, {d: 10 * .001, len: 26 * .001, threaded: false});
    b.position.set(-.02, y, -.034); b.rotation.x = -Math.PI / 2;
    caliper.add(b); calBolts.push(b);
  }

  // ---------- 稳定杆连杆（球头 + 杆）----------
  const swayLink = lo ? null : new THREE.Group();
  if (swayLink) {
    swayLink.name = 'sway-link'; swayLink.position.set(-.06, -.13, -.20); g.add(swayLink);
    const linkRod = mesh(G.rcyl(.008, .13, {seg: 8}), matSteel, 'link-rod', swayLink);
    linkRod.rotation.z = .35;
    for (const s of [-1, 1]) {
      const end = mesh(G.lathe([[0, -.012], [.014, -.004], [.014, .006], [0, .014]], 10, {angle: 34}), matSteel, 'link-end', swayLink);
      end.position.set(s * .022, s * .064, 0);
      const boot = mesh(G.bellows(.017, .018, 2, .1, 8), matRubber, 'link-boot', swayLink);
      boot.position.copy(end.position);
    }
  }

  const plate = mesh(new THREE.PlaneGeometry(.07, .03), P.tier('label', {map: L.label({serial: 'MCA-FR', spec: 'MacPherson · vented Ø330', w: 256, h: 96, qr: false})}), 'nameplate', strut);
  plate.position.set(0, .16, .034); plate.rotation.x = -.2;

  const shadow = mesh(new THREE.PlaneGeometry(.62, .5), P.tier('label', {map: L.softShadow({strength: .6}), transparent: true, opacity: .5, depthWrite: false}), 'contact-shadow');
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -.36;

  return ctx.expose(g, {
    strut, damper, rod, dustBoot, bumpStop, spring, topMount, tmRubber, tmBolts,
    arm, lowerArm, bushings, ballJoint, ball, bjBoot, bjStud,
    knuckle, knBody, hub, studs, absSensor, absWire,
    disc, ring, hat, holes, caliper, calBody, pads, bleed, banjo, hose, calBolts,
    swayLink, linkRod: swayLink ? swayLink.children[0] : null, plate, shadow
  }, 12000);
}

// 制动角：只保留轮端制动相关件（盘/卡钳/轮毂/挡泥板/软管），检具与台架节点用。
export function buildBrakeCorner(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('brake', '制动角总成', 'validation-2 / engineering-4');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matSteel = P.tier('machined', {color: C.steel, roughness: .3});

  // 轮毂 + 五螺栓
  const hub = mesh(G.lathe([[0, 0], [.03, 0], [.03, .03], [.066, .03], [.066, .052], [.032, .052], [.032, .07], [0, .07]], 20, {angle: 34}), matSteel, 'hub');
  hub.rotation.x = -Math.PI / 2;
  const studs = [];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2;
    const st = F.stud(P, {d: 12 * .001, len: 30 * .001});
    st.position.set(Math.cos(a) * .045, .062, Math.sin(a) * .045);
    g.add(st); studs.push(st);
  }
  // 通风盘：两层摩擦面 + 中间筋（用径向筋条表示通风槽）
  const disc = new THREE.Group(); disc.name = 'disc'; g.add(disc);
  for (const s of [-1, 1]) {
    const face = mesh(G.lathe([[.1, 0], [.17, 0], [.17, .004], [.1, .004], [.1, 0]], 30, {angle: 24}), P.tier('machined', {color: 0x9aa3aa, roughness: .32}), 'friction-face', disc);
    face.rotation.x = Math.PI / 2; face.position.z = s * .013;
  }
  const vaneEntries = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    vaneEntries.push({geo: G.cbox(.006, .026, .012, .0008), matrix: new THREE.Matrix4().makeRotationZ(a).setPosition(Math.cos(a) * .136, Math.sin(a) * .136, 0)});
  }
  const vanes = mesh(G.mergeGeos(vaneEntries), P.tier('shell', {color: C.darkSteel, roughness: .5}), 'vanes', disc);
  const hat = mesh(G.lathe([[.045, 0], [.078, 0], [.078, .026], [.045, .026], [.045, 0]], 20, {angle: 40}), P.tier('shell', {color: C.darkSteel}), 'hat', disc);
  hat.rotation.x = Math.PI / 2; hat.position.z = -.03;
  // 卡钳（四活塞）
  const caliper = new THREE.Group(); caliper.name = 'caliper'; caliper.position.set(.11, .10, 0); g.add(caliper);
  const calBody = mesh(G.cbox(.085, .105, .07, .009), P.tier('shell', {color: 0xb0332c, roughness: .36}), 'caliper-body', caliper);
  const pistons = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const p = mesh(G.rcyl(.017, .02, {seg: 12}), P.tier('chrome', {color: 0xd6dde2}), 'piston', caliper);
    p.rotation.x = Math.PI / 2; p.position.set(sx * .022, sy * .026, .028);
    pistons.push(p);
  }
  const bridge = mesh(G.cbox(.05, .02, .05, .004), P.tier('machined', {color: 0x8c2a24}), 'bridge', caliper);
  bridge.position.y = .052;
  const line = mesh(G.cable([[0, .06, .02], [.02, .12, .01], [.05, .18, .0]], .006, {segs: 12, radial: 5}), P.tier('rubber', {color: 0x14181b}), 'brake-line', caliper);
  // 挡泥板（冲压件，带翻边）
  const shield = mesh(G.curvedPanel(.34, .30, .0012, {crownX: .006, crownY: .006, r: .04, segX: 10, segZ: 8}), P.tier('shell', {color: 0x7d8993, roughness: .55}), 'dust-shield');
  shield.position.set(0, -.02, -.05); shield.rotation.y = Math.PI;
  // 传感器与支架
  const sensor = mesh(G.rcyl(.007, .026, {seg: 8}), P.tier('plastic', {color: 0x24292e}), 'abs-sensor');
  sensor.position.set(.06, .06, -.06); sensor.rotation.z = Math.PI / 2;
  const bracket = mesh(G.cbox(.03, .05, .008, .002), P.tier('shell', {color: C.castAlu}), 'sensor-bracket');
  bracket.position.set(.07, .05, -.055);
  const label = mesh(new THREE.PlaneGeometry(.06, .026), P.tier('label', {map: L.label({serial: opts.serial ?? 'BRK-FR-330', spec: 'Ventilated Ø330 × 28mm · 4-piston', w: 256, h: 96, qr: false})}), 'label');
  label.position.set(0, .16, .06); label.rotation.x = -.4;

  return ctx.expose(g, {hub, studs, disc, faces: disc.children, vanes, hat, caliper, calBody, pistons, bridge, line, shield, sensor, bracket, label}, 9000);
}
