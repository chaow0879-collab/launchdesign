// 电驱总成：电机壳体（带纵向散热筋）+ 两端端盖（螺栓圈）+ 减速器（铸造壳体 + 加强筋）
// + 半轴（带防尘套）+ 逆变器（散热筋 + 三相铜排）+ 悬置（橡胶衬套）。
// 局部坐标：轴向 = z，原点在轴心。真实比例参考 150kW 三合一电驱。
export function buildDriveUnit(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  const g = ctx.reg('drive-unit', '电驱总成', 'engineering-2 / validation-2');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const rMotor = .152, motorLen = .30;

  // ---------- 电机壳体：车削 + 12 条纵向散热筋 ----------
  const motor = new THREE.Group(); motor.name = 'motor'; motor.position.z = -.02; g.add(motor);
  const housingPts = [
    [rMotor * .70, -motorLen / 2 - .004],
    [rMotor * .96, -motorLen / 2],
    [rMotor, -motorLen / 2 + .012],
    [rMotor, motorLen / 2 - .012],
    [rMotor * .96, motorLen / 2],
    [rMotor * .70, motorLen / 2 + .004]
  ];
  const housingGeo = G.lathe(housingPts, 22, {angle: 30});
  housingGeo.rotateX(Math.PI / 2);
  const housing = mesh(housingGeo, P.tier('shell', {color: C.castAlu, roughness: .46}), 'housing', motor);
  // 散热筋：沿圆周 12 条，合并成一个几何
  const finEntries = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2;
    const geo = G.cbox(.012, .022, motorLen * .82, .0022);
    const m4 = new THREE.Matrix4();
    m4.makeRotationZ(a);
    m4.setPosition(Math.cos(a) * (rMotor + .009), Math.sin(a) * (rMotor + .009), 0);
    finEntries.push({geo, matrix: m4});
  }
  const fins = mesh(G.mergeGeos(finEntries), P.tier('shell', {color: C.castAlu, roughness: .5}), 'cooling-fins', motor);

  // ---------- 端盖 + 螺栓圈 ----------
  const bells = [];
  for (const s of [-1, 1]) {
    const z = s * (motorLen / 2 - .002);
    const bell = mesh(G.lathe([[0, 0], [rMotor * .94, 0], [rMotor * .94, .012], [rMotor * .62, .012], [rMotor * .62, .02], [rMotor * .18, .02], [rMotor * .18, 0]], 20, {angle: 34}), P.tier('machined', {color: C.alu, roughness: .34}), `end-bell-${s > 0 ? 'F' : 'R'}`, motor);
    bell.rotation.x = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    bell.position.z = z;
    bells.push(bell);
    // 螺栓圈（10 颗，静态合并）
    const ring = [];
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      ring.push({p: [Math.cos(a) * rMotor * .85, Math.sin(a) * rMotor * .85, z + s * .013], r: [0, 0, 0]});
    }
    const boltRing = F.boltArray(P, ring, {d: 6 * MM, headOnly: true, flange: false, name: 'bell-bolts'});
    motor.add(boltRing);
  }

  // ---------- 减速器：铸造壳体 + 加强筋 + 输出端 ----------
  const gearbox = new THREE.Group(); gearbox.name = 'gearbox'; gearbox.position.set(0, -.03, -.245); g.add(gearbox);
  const gbShell = mesh(G.rbox(.24, .25, .20, .022, 3), P.tier('shell', {color: C.darkAlu, roughness: .5}), 'gearbox-shell', gearbox);
  // 加强筋（壳体上的凸筋，是"铸造件"最强的识别特征）
  const ribEntries = [];
  for (let i = 0; i < 5; i++) {
    ribEntries.push({geo: G.cbox(.004, .20, .008, .001), matrix: new THREE.Matrix4().makeTranslation(-.09 + i * .045, .0, .102)});
    ribEntries.push({geo: G.cbox(.004, .20, .008, .001), matrix: new THREE.Matrix4().makeTranslation(-.09 + i * .045, .0, -.102)});
  }
  mesh(G.mergeGeos(ribEntries), P.tier('shell', {color: C.darkAlu, roughness: .52}), 'gearbox-ribs', gearbox);
  const gbCover = mesh(G.lathe([[.03, 0], [.075, 0], [.075, .01], [.03, .01], [.03, 0]], 16, {angle: 40}), P.tier('machined', {color: C.alu}), 'gearbox-cover', gearbox);
  gbCover.rotation.x = Math.PI / 2; gbCover.position.set(-.02, -.02, -.105);
  const drainPlug = mesh(G.rcyl(.008, .012, {seg: 8}), P.tier('machined', {color: C.brass}), 'drain-plug', gearbox);
  drainPlug.rotation.x = Math.PI / 2; drainPlug.position.set(.09, -.09, -.105);

  // ---------- 半轴 + 防尘套 ----------
  const shafts = [], boots = [];
  for (const s of [-1, 1]) {
    const zOut = s * .26;
    const shaft = mesh(G.rcyl(.019, .26, {seg: 12}), P.tier('machined', {color: C.darkSteel, roughness: .3}), `half-shaft-${s > 0 ? 'L' : 'R'}`);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, -.03, s * .17);
    shafts.push(shaft);
    const boot = mesh(G.bellows(.032, .075, 4, .16, 10), P.tier('rubber', {color: 0x16191c, roughness: .88}), `cv-boot-${s > 0 ? 'L' : 'R'}`);
    boot.rotation.x = Math.PI / 2;
    boot.position.set(0, -.03, s * .245);
    boots.push(boot);
    const band = mesh(G.lathe([[.030, 0], [.036, 0], [.036, .006], [.030, .006], [.030, 0]], 14, {angle: 40}), P.tier('machined', {color: C.steel}), 'boot-band');
    band.rotation.x = Math.PI / 2; band.position.set(0, -.03, s * .29);
    // 半轴端部螺纹 + 螺母
    const endNut = F.nut(P, {d: 14 * MM});
    endNut.rotation.x = Math.PI / 2; endNut.position.set(0, -.03, s * .305);
    g.add(endNut);
  }

  // ---------- 逆变器：壳体 + 散热筋 + 三相铜排 + 高压插头 ----------
  const inverter = new THREE.Group(); inverter.name = 'inverter'; inverter.position.set(0, .195, .02); g.add(inverter);
  const invShell = mesh(G.rbox(.30, .075, .24, .012, 2), P.tier('shell', {color: C.darkAlu, roughness: .44}), 'inverter-shell', inverter);
  const invFins = [];
  for (let i = 0; i < 9; i++) {
    invFins.push({geo: G.cbox(.006, .016, .21, .0008), matrix: new THREE.Matrix4().makeTranslation(-.13 + i * .032, .043, 0)});
  }
  mesh(G.mergeGeos(invFins), P.tier('shell', {color: C.darkAlu, roughness: .48}), 'inverter-fins', inverter);
  // 三相铜排
  const phases = [];
  for (let i = 0; i < 3; i++) {
    const bar = mesh(G.cbox(.016, .004, .07, .0006), P.tier('copper', {color: C.copper}), 'phase-bar', inverter);
    bar.position.set(-.05 + i * .028, .012, -.13);
    phases.push(bar);
  }
  const hvPlug = new THREE.Group(); hvPlug.name = 'hvPlug'; hvPlug.position.set(.12, .02, .10); inverter.add(hvPlug);
  const plugBody = mesh(G.rbox(.06, .05, .08, .008, 2), P.tier('plastic', {color: C.orangeHV, roughness: .5}), 'hv-plug-body', hvPlug);
  const plugCable = mesh(G.cable([[0, 0, .04], [.03, -.03, .12], [.02, -.12, .18]], .014, {segs: 14, radial: 6}), P.tier('rubber', {color: C.orangeHV, roughness: .7}), 'hv-cable', hvPlug);
  const hazardBand = mesh(G.cable([[-.005, 0, .055], [.005, 0, .06]], .0155, {segs: 4, radial: 6}), P.tier('label', {map: L.hazard(), roughness: .6}), 'hazard-band', hvPlug);

  // ---------- 悬置：铸造支架 + 橡胶衬套 ----------
  const mounts = [];
  for (const s of [-1, 1]) {
    const bracket = mesh(G.cbox(.05, .06, .09, .006), P.tier('shell', {color: C.castAlu}), 'mount-bracket', g);
    bracket.position.set(s * .157, .02, -.02);
    const bush = mesh(G.lathe([[.014, 0], [.026, 0], [.026, .026], [.014, .026], [.014, 0]], 14, {angle: 55}), P.tier('rubber', {color: 0x171a1d, roughness: .9}), 'mount-bush', g);
    bush.rotation.z = Math.PI / 2;
    bush.position.set(s * .175, .02, -.02);
    mounts.push(bracket);
  }

  // ---------- 铭牌 + 高压警示 + 接地螺栓 ----------
  const plate = mesh(new THREE.PlaneGeometry(.09, .045), P.tier('label', {map: L.label({serial: opts.serial ?? 'EDU-150-3IN1', spec: '150kW · 3200Nm · 12k rpm', w: 512, h: 256, qr: false})}), 'nameplate', g);
  plate.position.set(-.02, -.155, .12);
  plate.rotation.set(-Math.PI / 2 + .5, 0, 0);
  const warn = mesh(new THREE.PlaneGeometry(.04, .04), P.tier('label', {map: L.warning({label: ''}), transparent: true}), 'warning', g);
  warn.position.set(.07, .075, .10); warn.rotation.x = -Math.PI / 2;
  const ground = F.bolt(P, {d: 8 * MM, len: 14 * MM, name: 'ground-bolt'});
  ground.position.set(-.12, .11, -.10); g.add(ground);
  const groundStrap = mesh(G.cable([[-.12, .11, -.10], [-.16, .06, -.06]], .004, {segs: 8, radial: 5}), P.tier('copper', {color: 0xb87333}), 'ground-strap', g);

  return ctx.expose(g, {
    motor, housing, fins, bells, gearbox, gbShell, gbCover, shafts, boots,
    inverter, invShell, phases, hvPlug, plugBody, plugCable, mounts, plate, warn, ground, groundStrap
  }, 9000);
}
