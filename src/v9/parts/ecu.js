// 区域控制器 ECU：压铸上盖 + 散热筋 + 两排真针脚接插件 + 内部 PCB + 密封胶条 + 安装耳 + 螺栓。
// 尺寸：180 × 120 × 40 mm（不含接插件与散热筋）。原点在安装底面中心。
export function buildEcu(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  const g = ctx.reg('ecu', '区域控制器', 'engineering-3 / validation-3');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const W = .18, D = .12, wall = .004, baseH = .026;
  // lod='lo'：区域控制器用（数量多、只在远景出现），省掉板内器件与细节，保留壳体/散热筋/针脚/铭牌
  const lo = opts.lod === 'lo';

  // ---------- 下壳体：底板 + 四壁（不是实心块，能看见内部 PCB）----------
  const base = new THREE.Group(); base.name = 'base'; g.add(base);
  const floor = mesh(G.rplate(W, D, .004, {r: .008, edge: .0005, seg: 2}), P.tier('shell', {color: C.alu, roughness: .42}), 'base-floor', base);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = .002;
  const walls = [];
  for (const s of [-1, 1]) {
    const wx = mesh(G.cbox(wall, baseH, D, .0008), P.tier('shell', {color: C.castAlu, roughness: .48}), 'wall-x', base);
    wx.position.set(s * (W / 2 - wall / 2), baseH / 2 + .004, 0);
    walls.push(wx);
    const wz = mesh(G.cbox(W, baseH, wall, .0008), P.tier('shell', {color: C.castAlu, roughness: .48}), 'wall-z', base);
    wz.position.set(0, baseH / 2 + .004, s * (D / 2 - wall / 2));
    walls.push(wz);
  }
  // 内部加强柱（压铸件的工艺特征）
  if (!lo) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const boss = mesh(G.lathe([[.004, 0], [.0075, 0], [.0075, .02], [.004, .02], [.004, 0]], 8, {angle: 45}), P.tier('shell', {color: C.castAlu}), 'boss', base);
    boss.position.set(sx * (W / 2 - .016), .006, sz * (D / 2 - .016));
  }

  // ---------- PCB：板 + 芯片 + 电容 + 连接器 ----------
  const pcbGrp = new THREE.Group(); pcbGrp.name = 'pcb'; pcbGrp.position.y = .012; base.add(pcbGrp);
  const board = mesh(G.rplate(W - .022, D - .020, .0016, {r: .004, edge: .0003, seg: 2}), P.tier('pcb', {color: 0xffffff, metalness: .25}), 'board', pcbGrp);
  board.rotation.x = -Math.PI / 2;
  const chips = [];
  const chipSpec = [[-.045, -.018, .022, .022], [-.010, -.018, .018, .018], [.020, -.020, .026, .018], [.050, .010, .014, .014]];
  if (!lo) for (const [x, z, w, d] of chipSpec) {
    const chip = mesh(G.cbox(w, .0035, d, .0004), P.tier('plastic', {color: 0x14181b, roughness: .5}), 'chip', pcbGrp);
    chip.position.set(x, .0026, z);
    chips.push(chip);
    const pins = mesh(G.mergeGeos([
      {geo: G.box(w + .004, .0008, .0012), matrix: new THREE.Matrix4().makeTranslation(x, .0012, z - d / 2 - .0012)},
      {geo: G.box(w + .004, .0008, .0012), matrix: new THREE.Matrix4().makeTranslation(x, .0012, z + d / 2 + .0012)}
    ]), P.tier('machined', {color: 0xc9d2d8}), 'chip-pins', pcbGrp);
  }
  const caps = [];
  let crystal = null;
  if (!lo) {
    for (let i = 0; i < 4; i++) {
      const cap = mesh(G.rcyl(.0035, .006, {seg: 6}), P.tier('machined', {color: 0x8a949c}), 'capacitor', pcbGrp);
      cap.position.set(.048 - i * .011, .004, -.040);
      caps.push(cap);
    }
    crystal = mesh(G.cbox(.008, .0025, .005, .0003), P.tier('machined', {color: 0xb8c2c9}), 'crystal', pcbGrp);
    crystal.position.set(-.030, .0026, .030);
  }

  // ---------- 两排接插件：塑料护套 + 真针脚 ----------
  const connectors = [], pins = [];
  for (let k = 0; k < 2; k++) {
    const zc = (k ? 1 : -1) * .030;
    const shroud = mesh(G.rbox(.030, .024, .052, .0035, 1), P.tier('plastic', {color: 0x2b3238, roughness: .58}), `connector-${k}`, g);
    shroud.position.set(W / 2 + .008, .022, zc);
    connectors.push(shroud);
    const pf = F.pinField(P, {rows: 2, cols: 8, pitch: 3.2 * MM, pin: 1.1 * MM, len: 11 * MM});
    pf.position.set(W / 2 + .012, .012, zc);
    pf.rotation.z = -Math.PI / 2;
    g.add(pf);
    pins.push(pf);
    // 防呆键与卡扣
    const key = mesh(G.box(.006, .01, .008), P.tier('plastic', {color: 0x3b444b}), 'connector-key', g);
    key.position.set(W / 2 + .022, .034, zc + (k ? .018 : -.018));
    // 线束出线（橡胶护套）
    const grommet = mesh(G.lathe([[.010, 0], [.016, 0], [.016, .012], [.010, .012], [.010, 0]], 12, {angle: 50}), P.tier('rubber', {color: 0x1a1e22}), 'grommet', g);
    grommet.rotation.z = Math.PI / 2;
    grommet.position.set(W / 2 + .024, .022, zc);
  }

  // ---------- 上盖 + 散热筋 + 密封胶条 ----------
  const lid = new THREE.Group(); lid.name = 'lid'; g.add(lid);
  const lidPlate = mesh(G.rplate(W + .002, D + .002, .004, {r: .009, edge: .0006, seg: 2}), P.tier('shell', {color: C.alu, roughness: .38}), 'lid-plate', lid);
  lidPlate.rotation.x = -Math.PI / 2;
  lidPlate.position.y = .032;
  // 散热筋（压铸鳍片，比一整块平板强得多）
  const finEntries = [];
  for (let i = 0; i < 8; i++) {
    finEntries.push({geo: G.cbox(.005, .016, D - .03, .0008), matrix: new THREE.Matrix4().makeTranslation(-.062 + i * .0175, .042, 0)});
  }
  const fins = mesh(G.mergeGeos(finEntries), P.tier('shell', {color: C.alu, roughness: .44}), 'heatsink-fins', lid);
  const sinkBase = mesh(G.rplate(W - .01, D - .01, .003, {r: .006, edge: .0004, seg: 2}), P.tier('shell', {color: C.castAlu, roughness: .46}), 'heatsink-base', lid);
  sinkBase.rotation.x = -Math.PI / 2;
  sinkBase.position.y = .0355;
  const gasket = mesh(G.seam([[W / 2, .028, -D / 2 + .004], [W / 2, .028, D / 2 - .004], [-W / 2, .028, D / 2 - .004], [-W / 2, .028, -D / 2 + .004], [W / 2, .028, -D / 2 + .004]], {width: .0035, depth: .001, segs: 24}), P.tier('rubber', {color: 0x191d20}), 'gasket', g);

  // ---------- 安装耳 + 螺栓 ----------
  const ears = [], bolts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ear = mesh(G.cbox(.020, .006, .018, .0012), P.tier('shell', {color: C.castAlu}), 'mount-ear', g);
    ear.position.set(sx * (W / 2 - .004), .006, sz * (D / 2 - .002));
    ears.push(ear);
    const b = F.bolt(P, {d: 6 * MM, len: 16 * MM, threaded: false, flange: false});
    b.position.set(sx * (W / 2 - .004), .009, sz * (D / 2 - .002));
    g.add(b); bolts.push(b);
  }

  // ---------- 铭牌 / 警示 / 指示灯 ----------
  const label = mesh(new THREE.PlaneGeometry(.075, .042), P.tier('label', {map: L.label({serial: opts.serial ?? 'ZCU-2418-A', spec: 'Zonal Ctrl · 12V/48V · IP6K9K', w: 512, h: 256})}), 'label', g);
  label.position.set(-.020, .0472, .026); label.rotation.x = -Math.PI / 2;
  const warn = mesh(new THREE.PlaneGeometry(.028, .028), P.tier('label', {map: L.warning({label: ''}), transparent: true}), 'warning', g);
  warn.position.set(.052, .0472, .046); warn.rotation.x = -Math.PI / 2;
  const serial = mesh(new THREE.PlaneGeometry(.05, .012), P.tier('label', {map: L.stamp({text: 'ALSi9Cu3', bg: '#aeb9c1', fg: '#2a3238'})}), 'stamp', g);
  serial.position.set(.052, .0472, -.030); serial.rotation.x = -Math.PI / 2;
  const leds = [];
  for (let i = 0; i < 3; i++) {
    const led = mesh(G.box(.008, .003, .005), P.emissive([0x5dff9a, 0x58e1ff, 0xffb547][i], 1.9, .95), `led-${i}`, g);
    led.position.set(-.072 + i * .014, .0475, -.046);
    leds.push(led);
  }
  // 接地柱
  const gnd = mesh(G.lathe([[.004, 0], [.008, 0], [.008, .01], [.004, .01], [.004, 0]], 10, {angle: 45}), P.tier('machined', {color: C.brass}), 'ground-post', g);
  gnd.position.set(-.082, .006, .048);

  return ctx.expose(g, {
    base, floor, walls, pcb: pcbGrp, board, chips, caps, crystal,
    connectors, pins, lid, lidPlate, fins, sinkBase, gasket,
    ears, bolts, label, warn, serial, leds, gnd
  }, 4000);
}
