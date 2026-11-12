// 工装/刀具/夹具/机械臂：立铣刀、六轴机械臂、快速夹钳、百分表检具。
// 这些是"工序节点"里最容易露出塑料积木感的东西：现在全部按真机制造特征来建——
// 刀具有螺旋容屑槽、夹钳有螺纹压杆和销轴、机械臂有关节壳体与线缆护套、检具表盘有刻度和玻璃。
export function buildEndMill(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('end-mill', '立铣刀', 'clay-1 / launch-1');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const r = opts.r ?? .006;
  const cutterLen = opts.cutterLen ?? .032;

  // 刀柄锥面 + 夹头螺母（工具系统部分）
  const holder = mesh(G.lathe([
    [.011, cutterLen + .048], [.017, cutterLen + .046], [.020, cutterLen + .030],
    [.020, cutterLen + .016], [.016, cutterLen + .012], [.013, cutterLen + .004],
    [.011, cutterLen + .002], [.011, cutterLen + .048]
  ], 18, {angle: 34}), P.tier('machined', {color: C.darkSteel, roughness: .3}), 'tool-holder');
  const nut = mesh(G.lathe([[.011, cutterLen + .002], [.0155, cutterLen + .002], [.0155, cutterLen + .014], [.0135, cutterLen + .016], [.011, cutterLen + .016], [.011, cutterLen + .002]], 16, {angle: 40}), P.tier('machined', {color: 0x9099a1, roughness: .28}), 'collet-nut');
  // 螺母上的槽（用一圈小凹块表示，近看是"滚花/开槽"）
  const notchEntries = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    notchEntries.push({geo: G.cbox(.0022, .012, .0012, .0002), matrix: new THREE.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * .0152, cutterLen + .008, Math.sin(a) * .0152)});
  }
  const notches = mesh(G.mergeGeos(notchEntries), P.tier('machined', {color: 0x4a545c}), 'nut-slots');

  // 刀体（圆柱）+ 三条螺旋容屑槽
  const body = mesh(G.lathe([[0, 0], [r * .72, 0], [r * .92, .003], [r, .006], [r, cutterLen], [0, cutterLen]], 16, {angle: 26}), P.tier('machined', {color: 0xc3cbd1, roughness: .18, metalness: .92}), 'cutter-body');
  const flutes = [];
  for (let i = 0; i < 3; i++) {
    const geo = G.thread(r * .98, cutterLen * .82, .010, {seg: 20, depth: .0016});
    geo.rotateY(i / 3 * Math.PI * 2);
    const f = mesh(geo, P.tier('machined', {color: 0x2f363c, roughness: .4, side: THREE.DoubleSide}), `flute-${i}`);
    f.position.y = cutterLen * .52;
    flutes.push(f);
  }
  // 刀尖倒角 + 端面刃
  const tip = mesh(G.lathe([[0, -.0016], [r * .55, -.001], [r * .9, -.0002], [r, .0012], [r * .55, .0002], [0, -.0006]], 16, {angle: 30}), P.tier('machined', {color: 0xd6dde2, roughness: .16}), 'tip');

  // 激光打标（刀具规格）
  const mark = mesh(new THREE.PlaneGeometry(.014, .005), P.tier('label', {map: L.stamp({text: 'φ12 4F', bg: '#c3cbd1', fg: '#2b3339'})}), 'tool-mark');
  mark.position.set(0, cutterLen + .034, .0202);
  mark.rotation.x = 0;

  return ctx.expose(g, {holder, nut, notches, body, flutes, tip, mark}, 2500);
}

export function buildRobotArm(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('robot-arm', '六轴机械臂', 'launch-1 / clay-1');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matCast = P.tier('shell', {color: 0xe4e8ea, roughness: .42});
  const matCast2 = P.tier('shell', {color: C.darkAlu, roughness: .5});
  const matJoint = P.tier('machined', {color: 0x8d979f, roughness: .3});
  const matRubber = P.tier('rubber', {color: 0x171b1e});

  // ---------- 底座 + 地脚螺栓 ----------
  const base = mesh(G.lathe([[.19, 0], [.19, .028], [.165, .038], [.165, .10], [.12, .112], [.12, .13], [0, .13]], 20, {angle: 36}), matCast2, 'base');
  const baseBolts = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2;
    baseBolts.push({p: [Math.cos(a) * .16, .01, Math.sin(a) * .16], r: [0, 0, 0]});
  }
  const baseBoltMesh = F.boltArray(P, baseBolts, {d: 12 * .001, len: 26 * .001, threaded: false, name: 'anchor-bolts', color: 0x8d979f});
  baseBoltMesh.name = 'anchor-bolts';
  g.add(baseBoltMesh);

  // ---------- J1 回转体 ----------
  const j1 = new THREE.Group(); j1.name = 'J1'; j1.position.y = .13; g.add(j1);
  const turret = mesh(G.lathe([[.145, 0], [.145, .05], [.125, .075], [.10, .085], [.10, .12], [0, .12]], 18, {angle: 38}), matCast, 'turret', j1);
  const shoulderRing = mesh(G.lathe([[.085, 0], [.10, 0], [.10, .014], [.085, .014], [.085, 0]], 18, {angle: 40}), matJoint, 'shoulder-ring', j1);
  shoulderRing.rotation.x = Math.PI / 2; shoulderRing.position.set(0, .075, .085);

  // ---------- 大臂（铸造壳体 + 侧面加强筋）----------
  const arm = new THREE.Group(); arm.name = 'arm'; g.add(arm);
  const shoulder = new THREE.Vector3(0, .29, 0);
  const elbow = new THREE.Vector3(.20, .92, .24);
  const wrist = new THREE.Vector3(.56, .83, .58);
  const upper = mesh(G.sweep([shoulder.toArray(), [.10, .62, .12], elbow.toArray()], G.SECT.oval(.115, .085, 12), {segments: 14}), matCast, 'upper-arm', arm);
  const lower = mesh(G.sweep([elbow.toArray(), [.38, .86, .40], wrist.toArray()], G.SECT.oval(.088, .07, 12), {segments: 14}), matCast, 'forearm', arm);
  const upperRibs = [];
  for (const s of [-1, 1]) {
    upperRibs.push({geo: G.cbox(.012, .34, .012, .001), matrix: new THREE.Matrix4().makeRotationZ(-.62).setPosition(.09, .60, s * .045)});
  }
  const ribMesh = mesh(G.mergeGeos(upperRibs), matCast2, 'arm-ribs', arm);
  // 关节壳体
  const joints = [];
  for (const [p, r, w] of [[shoulder, .105, .12], [elbow, .085, .10], [wrist, .062, .08]]) {
    const j = mesh(G.lathe([[r, -w / 2], [r * .96, -w / 2], [r * .96, w / 2], [r, w / 2], [r, -w / 2]], 18, {angle: 34}), matJoint, 'joint-housing', arm);
    j.position.copy(p);
    j.rotation.x = Math.PI / 2;
    // 关节端盖
    for (const s of [-1, 1]) {
      const cap = mesh(G.lathe([[r * .42, 0], [r * .82, 0], [r * .82, .008], [r * .42, .008], [r * .42, 0]], 14, {angle: 40}), matCast2, 'joint-cap', arm);
      cap.position.copy(p); cap.position.z += s * (w / 2 + .004);
      cap.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    joints.push(j);
  }
  // 线缆 + 波纹护套
  const cablePath = [[.02, .22, .10], [.06, .40, .12], [.12, .62, .14], [.24, .86, .20], [.40, .88, .32], [.52, .85, .48]];
  const wristCable = mesh(G.cable(cablePath, .009, {segs: 30, radial: 6}), matRubber, 'cable', arm);
  const conduit = mesh(G.bellows(.014, .14, 5, .18, 12), matRubber, 'conduit', arm);
  conduit.position.set(.13, .70, .13); conduit.rotation.z = -.55;
  // 腕部三轴 + 法兰
  const toolFlange = mesh(G.lathe([[.018, 0], [.042, 0], [.042, .012], [.034, .012], [.034, .02], [.018, .02], [.018, 0]], 14, {angle: 40}), matJoint, 'tool-flange', arm);
  toolFlange.position.set(wrist.x + .04, wrist.y - .06, wrist.z + .02);
  toolFlange.rotation.x = Math.PI / 2.4;
  // 夹爪：本体 + 两指 + 橡胶垫
  const gripper = new THREE.Group(); gripper.name = 'gripper'; gripper.position.copy(toolFlange.position); gripper.rotation.copy(toolFlange.rotation); g.add(gripper);
  const grBase = mesh(G.cbox(.09, .03, .07, .004), matCast2, 'gripper-body', gripper);
  grBase.position.y = -.02;
  const fingers = [];
  for (const s of [-1, 1]) {
    const f = mesh(G.cbox(.016, .12, .03, .003), matJoint, 'finger', gripper);
    f.position.set(s * .035, -.09, 0);
    fingers.push(f);
    const pad = mesh(G.cbox(.006, .10, .024, .0015), matRubber, 'finger-pad', gripper);
    pad.position.set(s * .026, -.09, 0);
  }
  // 铭牌
  const plate = mesh(new THREE.PlaneGeometry(.06, .03), P.tier('label', {map: L.label({serial: opts.serial ?? 'IR-6A-1200', spec: '6-axis · 12kg · 1.4m', w: 512, h: 256, qr: false})}), 'nameplate', g);
  plate.position.set(.10, .22, .115); plate.rotation.x = -.35;

  return ctx.expose(g, {base, baseBolts: baseBoltMesh, j1, turret, shoulderRing, arm, upper, lower, ribMesh, joints, wristCable, conduit, toolFlange, gripper, grBase, fingers, plate}, 9000);
}

export function buildToggleClamp(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('toggle-clamp', '快速夹钳', 'launch-1');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matSteel = P.tier('machined', {color: 0xb6c0c8, roughness: .3});
  const matDark = P.tier('machined', {color: C.blackSteel, roughness: .34});
  const matRubber = P.tier('rubber', {color: 0x1a1e21});

  // 底座（带安装孔）
  const basePlate = mesh(G.rplateHoles(.16, .10, .008, [{x: -.055, y: 0, r: .006}, {x: .055, y: 0, r: .006}], {r: .008, edge: .0006, seg: 2}), matSteel, 'base-plate');
  // 立柱
  const post = mesh(G.cbox(.026, .075, .045, .003), matSteel, 'post');
  post.position.set(0, .045, 0);
  // 压臂（两根侧板 + 横梁）
  const armGrp = new THREE.Group(); armGrp.name = 'clampArm'; armGrp.position.set(0, .075, 0); g.add(armGrp);
  const armPlates = [];
  for (const s of [-1, 1]) {
    const pl = mesh(G.rplateHoles(.115, .026, .005, [{x: -.045, y: 0, r: .005}, {x: .045, y: 0, r: .005}], {r: .006, edge: .0004, seg: 2}), matDark, 'arm-plate', armGrp);
    pl.position.set(.045, 0, s * .020);
    pl.rotation.y = Math.PI / 2;
    armPlates.push(pl);
  }
  const yoke = mesh(G.cbox(.022, .034, .05, .003), matSteel, 'yoke', armGrp);
  yoke.position.set(.10, -.006, 0);
  // 压杆：真螺纹（六角螺母可调）
  const spindle = new THREE.Group(); spindle.name = 'spindle'; spindle.position.set(.10, -.02, 0); armGrp.add(spindle);
  const rod = mesh(G.rcyl(.004, .075, {seg: 10}), matSteel, 'spindle-rod', spindle);
  const screw = mesh(G.thread(.0085, .055, .00125, {seg: 18, depth: .00065}), matSteel, 'spindle-thread', spindle);
  const adjNut = F.nut(P, {d: 8 * .001});
  adjNut.position.y = .028;
  spindle.add(adjNut);
  const pad = mesh(G.lathe([[.012, 0], [.017, .002], [.017, .008], [.012, .010], [.012, 0]], 14, {angle: 45}), matRubber, 'clamp-pad', spindle);
  pad.position.y = -.045;
  // 手柄 + 橡胶握把
  const handleArm = mesh(G.sweep([[-.02, .01, 0], [-.08, .05, 0], [-.14, .085, 0]], G.SECT.rect(.018, .008), {segments: 8}), matDark, 'handle-arm', g);
  const grip = mesh(G.cable([[-.13, .08, 0], [-.175, .098, 0]], .011, {segs: 6, radial: 8}), matRubber, 'grip', g);
  // 连杆 + 销轴
  const link = mesh(G.rplateHoles(.075, .016, .004, [{x: -.03, y: 0, r: .004}, {x: .03, y: 0, r: .004}], {r: .005, edge: .0004, seg: 2}), matSteel, 'link');
  link.position.set(-.02, .052, .024); link.rotation.z = .5; link.rotation.y = Math.PI / 2;
  const pins = [];
  for (const [x, y, z] of [[0, .075, .03], [.045, .076, .034], [.10, .062, .034]]) {
    const pin = mesh(G.rcyl(.004, .05, {seg: 8}), P.tier('chrome', {color: 0xd0d7dc}), 'pivot-pin');
    pin.position.set(x, y, z); pin.rotation.x = Math.PI / 2;
    pins.push(pin);
    const clip = mesh(G.lathe([[.006, 0], [.009, 0], [.009, .0016], [.006, .0016], [.006, 0]], 10, {angle: 50}), matDark, 'circlip');
    clip.position.set(x, y, z + .026); clip.rotation.x = Math.PI / 2;
  }
  // 底座螺栓
  const bolts = [];
  for (const x of [-.055, .055]) {
    const b = F.bolt(P, {d: 8 * .001, len: 20 * .001, threaded: false});
    b.position.set(x, .008, 0);
    g.add(b); bolts.push(b);
  }
  // 载荷标牌
  const tag = mesh(new THREE.PlaneGeometry(.05, .022), P.tier('label', {map: L.label({serial: 'TC-250', spec: 'HOLD 250kg · STAINLESS', brand: 'CLAMP', w: 256, h: 96, qr: false})}), 'label');
  tag.position.set(.055, .006, .0505);

  return ctx.expose(g, {basePlate, post, armGrp, armPlates, yoke, spindle, rod, screw, adjNut, pad, handleArm, grip, link, pins, bolts, tag}, 4000);
}

export function buildGauge(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('gauge', '百分表检具', 'launch-1 / validation-2');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matSteel = P.tier('machined', {color: C.steel, roughness: .28});
  const matDark = P.tier('shell', {color: C.blackSteel, roughness: .45});
  const matChrome = P.tier('chrome', {color: 0xd9e0e5});

  // 磁性表座
  const baseBody = mesh(G.cbox(.075, .045, .11, .006), matDark, 'magnetic-base');
  baseBody.position.y = .0225;
  const switchKnob = mesh(G.rcyl(.012, .014, {seg: 12}), P.tier('plastic', {color: C.red, roughness: .45}), 'magnet-switch');
  switchKnob.rotation.z = Math.PI / 2; switchKnob.position.set(.038, .022, -.02);
  const basePad = mesh(G.cbox(.07, .003, .105, .001), P.tier('rubber', {color: 0x14181b}), 'base-pad');
  basePad.position.y = .0012;
  // 立柱 + 万向节
  const post = mesh(G.rcyl(.008, .22, {seg: 12}), matSteel, 'post');
  post.position.set(-.01, .14, 0);
  const knuckleA = mesh(G.lathe([[.012, 0], [.019, 0], [.019, .018], [.012, .018], [.012, 0]], 14, {angle: 42}), matDark, 'knuckle');
  knuckleA.position.set(-.01, .25, 0);
  const armRod = mesh(G.rcyl(.006, .13, {seg: 10}), matSteel, 'gauge-arm');
  armRod.rotation.z = Math.PI / 2 - .18; armRod.position.set(.05, .27, 0);
  const knuckleB = knuckleA.clone(); knuckleB.position.set(.115, .283, 0);

  // 表体 + 表圈 + 表盘 + 指针 + 玻璃
  const gaugeGrp = new THREE.Group(); gaugeGrp.name = 'dial-gauge'; gaugeGrp.position.set(.125, .283, 0); g.add(gaugeGrp);
  const dialBody = mesh(G.lathe([[.026, 0], [.030, 0], [.030, .008], [.034, .008], [.034, .014], [.026, .014], [.026, 0]], 20, {angle: 40}), matSteel, 'dial-body', gaugeGrp);
  const bezel = mesh(G.lathe([[.030, .014], [.035, .014], [.035, .020], [.030, .020], [.030, .014]], 20, {angle: 40}), matChrome, 'bezel', gaugeGrp);
  const stem = mesh(G.rcyl(.004, .05, {seg: 10}), matSteel, 'stem', gaugeGrp);
  stem.position.y = -.028;
  const tip = mesh(G.lathe([[.0015, 0], [.003, .002], [.002, .012], [0, .012]], 8, {angle: 30}), matChrome, 'contact-tip', gaugeGrp);
  tip.position.y = -.056;
  // 表盘：贴图只给刻度底，再用细刻度块叠一圈，近看是"仪表"而不是白圆片
  const face = mesh(G.lathe([[0, .0172], [.029, .0172], [.029, .0175], [0, .0175]], 24, {angle: 20}), P.tier('label', {map: L.label({serial: '0.001mm', spec: 'DIAL INDICATOR · 0-10mm', brand: 'LC', w: 256, h: 256, barcode: false, qr: false}), roughness: .6}), 'dial-face', gaugeGrp);
  const ticks = [];
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    const long = i % 6 === 0;
    ticks.push({geo: new THREE.BoxGeometry(.0016, .0008, long ? .006 : .0032), matrix: new THREE.Matrix4().makeRotationY(a).setPosition(Math.cos(a) * .024, .0178, Math.sin(a) * .024)});
  }
  const tickMesh = mesh(G.mergeGeos(ticks), P.tier('machined', {color: 0x22282d}), 'ticks', gaugeGrp);
  const needle = mesh(G.cbox(.0012, .001, .023, .0002), P.tier('plastic', {color: 0xd8382f, roughness: .4}), 'needle', gaugeGrp);
  needle.rotation.y = -.6;
  needle.position.set(.010, .0182, -.006);
  const glassFace = mesh(new THREE.CircleGeometry(.030, 20), P.tier('glass', {color: C.glass, opacity: .22}), 'glass', gaugeGrp);
  glassFace.rotation.x = -Math.PI / 2; glassFace.position.y = .0205;

  // 校对环规（检具配套）
  const ringGo = mesh(G.lathe([[.018, 0], [.028, 0], [.028, .012], [.018, .012], [.018, 0]], 18, {angle: 40}), matSteel, 'ring-gauge');
  ringGo.position.set(-.085, .012, .06);
  const ringNoGo = mesh(G.lathe([[.014, 0], [.022, 0], [.022, .01], [.014, .01], [.014, 0]], 16, {angle: 40}), P.tier('machined', {color: 0xb87a45}), 'ring-no-go');
  ringNoGo.position.set(-.075, .012, .105);

  return ctx.expose(g, {baseBody, switchKnob, basePad, post, knuckleA, armRod, knuckleB, gaugeGrp, dialBody, bezel, face, ticks: tickMesh, needle, glassFace, stem, tip, ringGo, ringNoGo}, 3000);
}
