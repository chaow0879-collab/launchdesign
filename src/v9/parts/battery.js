// 电池：模组（≤3k）与整包（托盘/冷板/母排/高压连接器/BMS/上盖）。
// 尺寸：模组 .59×.115×.35m，整包 L2.30×W1.36×H0.14m（与现有 systems.js 的电池包同一坐标与尺寸）。
// 去方块感：铝型材边框 + 端板、每颗电芯单独顶盖（有缝）、铜排有厚度与折弯、螺纹端子、
// 液冷板蛇形流道、上盖有密封胶条与一圈螺栓、高压连接器是橙色塑料件 + 铜端子 + 卡扣 + 警示带。
export function buildBatteryModule(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  // detail='pack' 是整包里用的简化版（只留外形识别特征），'hero' 是特写版
  const hero = opts.detail !== 'pack';
  const Lx = opts.L ?? .59, Ly = opts.H ?? .115, Lz = opts.W ?? .35;
  const g = ctx.reg('battery-module', '电池模组', 'engineering-2 / validation-3');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };

  // ---------- 铝型材边框（上下框 + 两侧端板）----------
  const housing = mesh(G.rbox(Lx, Ly, Lz, .010, hero ? 2 : 1), P.tier('shell', {color: C.castAlu}), 'housing');
  const frameTop = mesh(G.cbox(Lx + .004, .008, Lz + .004, .003), P.tier('machined', {color: C.darkAlu, roughness: .38}), 'frame-top');
  frameTop.position.y = Ly / 2 - .004;
  const endPlates = [];
  for (const s of [-1, 1]) {
    const ep = mesh(G.cbox(.010, Ly - .004, Lz + .002, .0015), P.tier('machined', {color: C.alu, roughness: .3}), `end-plate-${s > 0 ? 'F' : 'B'}`);
    ep.position.x = s * (Lx / 2 - .002);
    endPlates.push(ep);
  }

  // ---------- 6 个方形电芯单元（每个单独顶盖 + 缝隙，不是一整块）----------
  const cells = [];
  const cellW = (Lx - .04) / 6;
  for (let i = 0; i < 6; i++) {
    const x = -Lx / 2 + .02 + cellW * (i + .5);
    const cell = mesh(G.cbox(cellW - .004, .012, Lz - .05, .0012), P.tier('plastic', {color: 0x2b333a, roughness: .62}), `cell-${i}`);
    cell.position.set(x, Ly / 2 + .004, 0);
    cells.push(cell);
    if (!hero) continue;
    // 电芯极柱（正/负）：柱 + 绝缘垫圈（分材质）
    for (const s of [-1, 1]) {
      const post = mesh(G.lathe([[0, 0], [.006, 0], [.006, .007], [0, .007]], 6, {angle: 30}), P.tier('machined', {color: C.alu, roughness: .22}), 'cell-post');
      post.position.set(x, Ly / 2 + .012, s * (Lz * .28));
      const ring = mesh(new THREE.RingGeometry(.0075, .0125, 8), P.tier('plastic', {color: C.orangeDeep, roughness: .55}), 'post-insulator');
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, Ly / 2 + .0118, s * (Lz * .28));
    }
  }

  // ---------- 铜排（带折弯与螺栓孔）----------
  const busbars = [];
  for (const s of [-1, 1]) {
    const bus = mesh(G.cbox(Lx - .075, .0035, .022, .0008), P.tier('copper', {color: C.copper}), `busbar-${s > 0 ? 'P' : 'N'}`);
    bus.position.set(0, Ly / 2 + .016, s * .095);
    busbars.push(bus);
    if (!hero) continue;
    for (let i = 0; i < 6; i++) {
      const x = -Lx / 2 + .02 + cellW * (i + .5);
      const tab = mesh(G.box(.012, .012, .0016), P.tier('copper', {color: 0xb06d34}), 'busbar-tab');
      tab.position.set(x, Ly / 2 + .01, s * .095);
    }
  }
  // 中间跨接铜排（串联用）
  const bridge = mesh(G.cbox(.02, .0035, Lz * .46, .0008), P.tier('copper', {color: C.copper}), 'busbar-bridge');
  bridge.position.set(Lx / 2 - .028, Ly / 2 + .016, 0);

  // ---------- 高压端子（螺纹柱 + 螺母）----------
  const terminals = [];
  for (const s of [-1, 1]) {
    const term = mesh(G.lathe([[0, 0], [.008, 0], [.008, .014], [0, .014]], 8, {angle: 30}), P.tier('machined', {color: C.brass, roughness: .25}), 'terminal');
    term.position.set(-Lx / 2 + .018, Ly / 2 + .02, s * .095);
    terminals.push(term);
    if (hero) {
      const nutM = F.nut(P, {d: 8 * MM});
      nutM.position.set(term.position.x, Ly / 2 + .034, term.position.z);
      g.add(nutM);
    }
  }

  // ---------- 模组端部紧固螺栓 ----------
  const bolts = [];
  if (hero) {
    for (const s of [-1, 1]) {
      const b = F.bolt(P, {d: 8 * MM, len: 16 * MM, threaded: false, flange: false, name: 'bolt'});
      b.position.set(s * (Lx / 2 + .002), Ly * .62, 0);
      b.rotation.z = s > 0 ? Math.PI / 2 : -Math.PI / 2;
      g.add(b); bolts.push(b);
    }
  }

  // ---------- 提手 / 汇流排护罩 ----------
  if (hero) {
    for (const s of [-1, 1]) {
      mesh(G.sweep([[s * .14, Ly / 2 + .004, -Lz / 2 + .02], [s * .14, Ly / 2 + .03, -Lz / 2 + .035], [s * .14, Ly / 2 + .004, -Lz / 2 + .05]], G.SECT.rect(.014, .006), {segments: 6}), P.tier('plastic', {color: C.plasticGraphite}), 'handle');
    }
  }
  const cover = mesh(G.cbox(Lx * .5, .002, Lz * .8, .0006), P.tier('plastic', {color: C.plasticBlack, roughness: .7}), 'busbar-cover');
  cover.position.set(-Lx * .22, Ly / 2 + .024, 0);

  // ---------- 从控 BMS 板 + 线束 ----------
  let bms = null, harness = null;
  if (hero) {
    bms = mesh(G.rplate(.11, .085, .0016, {r: .004, edge: .0003, seg: 2}), P.tier('pcb', {color: 0xffffff, metalness: .2}), 'bms-slave');
    bms.position.set(-Lx / 2 + .075, Ly / 2 + .018, -Lz / 2 + .06);
    bms.rotation.x = -Math.PI / 2;
    const conn = mesh(G.cbox(.02, .008, .012, .0012), P.tier('plastic', {color: 0x3b444b}), 'bms-connector');
    conn.position.set(-Lx / 2 + .075, Ly / 2 + .026, -Lz / 2 + .10);
    harness = mesh(G.cable([[-Lx / 2 + .075, Ly / 2 + .018, -Lz / 2 + .06], [-Lx / 2 + .20, Ly / 2 + .02, -.10], [Lx / 2 - .10, Ly / 2 + .02, .02]], .004, {segs: 14, radial: 4}), P.tier('rubber', {color: 0x1d2226}), 'bms-harness');
  }

  // ---------- 铭牌 + 高压警示 ----------
  const label = mesh(new THREE.PlaneGeometry(.10, .05), P.tier('label', {map: L.label({serial: opts.serial ?? 'MOD-2418-06', spec: 'NMC 3.7V 50Ah · 6S1P', w: 512, h: 256})}), 'label');
  label.position.set(0, -Ly / 2 + .002, Lz / 2 + .0006);
  label.rotation.x = -Math.PI / 2;
  const warn = mesh(new THREE.PlaneGeometry(.035, .035), P.tier('label', {map: L.warning({label: ''}), transparent: true}), 'warning');
  warn.position.set(-Lx / 2 + .055, -Ly / 2 + .002, Lz / 2 + .0007);
  warn.rotation.x = -Math.PI / 2;

  // 底部导热垫（橡胶）
  const pad = mesh(G.cbox(Lx - .03, .0025, Lz - .04, .0006), P.tier('rubber', {color: 0x2a2f33}), 'thermal-pad');
  pad.position.y = -Ly / 2 - .0015;

  return ctx.expose(g, {housing, frameTop, endPlates, cells, busbars, bridge, terminals, bolts, cover, bms, harness, label, warn, pad}, 3000);
}

export function buildBatteryPack(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  const Lx = opts.L ?? 2.30, Wz = opts.W ?? 1.36, trayH = .052;
  const g = ctx.reg('battery-pack', '电池包总成', 'engineering-2 / validation-1');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };

  // ---------- 托盘：底板 + 四壁 + 加强筋 + 安装点（不是一个大方块）----------
  const tray = new THREE.Group(); tray.name = 'tray'; g.add(tray);
  const trayFloor = mesh(G.rplate(Lx, Wz, .005, {r: .03, edge: .0006, seg: 2}), P.tier('shell', {color: C.darkAlu, roughness: .4}), 'tray-floor', tray);
  trayFloor.rotation.x = -Math.PI / 2;
  const walls = [];
  for (const s of [-1, 1]) {
    const w1 = mesh(G.cbox(.012, trayH, Wz + .012, .002), P.tier('shell', {color: C.castAlu}), 'tray-wall-x', tray);
    w1.position.set(s * (Lx / 2 + .006), trayH / 2, 0);
    walls.push(w1);
    const w2 = mesh(G.cbox(Lx + .012, trayH, .012, .002), P.tier('shell', {color: C.castAlu}), 'tray-wall-z', tray);
    w2.position.set(0, trayH / 2, s * (Wz / 2 + .006));
    walls.push(w2);
  }
  const ribs = [];
  for (let i = 0; i < 7; i++) {
    const r = mesh(G.cbox(Lx - .02, .012, .006, .0012), P.tier('shell', {color: C.darkAlu}), 'tray-rib', tray);
    r.position.set(0, -.006, -Wz / 2 + .09 + i * .20);
    ribs.push(r);
  }
  // 安装点：4 个带橡胶衬套的支耳
  const mounts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const ear = mesh(G.cbox(.07, .022, .05, .002), P.tier('machined', {color: C.castAlu}), 'mount-ear', tray);
    ear.position.set(sx * (Lx / 2 - .02), .002, sz * (Wz / 2 + .03));
    const bush = mesh(G.lathe([[.006, 0], [.016, 0], [.016, .016], [.006, .016], [.006, 0]], 10, {angle: 50}), P.tier('rubber', {color: 0x1a1d20}), 'mount-bush', tray);
    bush.position.set(ear.position.x, .002, ear.position.z);
    mounts.push(ear);
  }

  // ---------- 12 个模组（整包视角用简化模组，仍保留独立顶盖与铜排）----------
  const modules = [];
  const modL = .345, modW = .30, modH = .082;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const mG = buildBatteryModule(ctx, {detail: 'pack', L: modL, H: modH, W: modW, serial: `M${i}${j}`});
    mG.name = `module-${i}-${j}`;
    mG.position.set(-Lx / 2 + .19 + i * .378, .036, j ? -.32 : .32);
    g.add(mG);
    modules.push(mG);
    const ins = mesh(G.box(modL - .01, .0012, modW - .01), P.tier('plastic', {color: 0x5b4a86, roughness: .5}), 'insulator');
    ins.position.set(mG.position.x, .033, mG.position.z);
  }

  // ---------- 液冷板：板 + 蛇形流道 + 进出水接头 + 软管 ----------
  const coolantPlate = new THREE.Group(); coolantPlate.name = 'coolantPlate'; g.add(coolantPlate);
  const cp = mesh(G.rplate(Lx - .06, Wz - .05, .008, {r: .02, edge: .0006, seg: 2}), P.tier('shell', {color: C.darkAlu, roughness: .42}), 'cold-plate', coolantPlate);
  cp.rotation.x = -Math.PI / 2;
  cp.position.y = .026;
  const serp = [];
  for (let i = 0; i <= 8; i++) {
    const x = -Lx / 2 + .12 + i * (Lx - .24) / 8;
    serp.push([x, .032, i % 2 ? .55 : -.55], [x + .001, .032, i % 2 ? -.55 : .55]);
  }
  const channel = mesh(G.cable(serp, .008, {segs: 40, radial: 4}), P.tier('machined', {color: 0x4a5b66, roughness: .35}), 'coolant-channel', coolantPlate);
  const hoses = [];
  for (const s of [-1, 1]) {
    const fit = mesh(G.lathe([[.009, 0], [.013, 0], [.013, .012], [.016, .012], [.016, .022], [.009, .022], [.009, 0]], 10, {angle: 40}), P.tier('machined', {color: C.alu}), 'coolant-fitting', coolantPlate);
    fit.position.set(-Lx / 2 + .07, .032, s * .60);
    fit.rotation.z = Math.PI / 2;
    const hose = mesh(G.cable([[-Lx / 2 + .05, .032, s * .60], [-Lx / 2 + .01, .05, s * .66], [Lx / 2 - .01, .06, s * .68], [Lx / 2 + .02, .075, s * .62]], .012, {segs: 16, radial: 5}), P.tier('rubber', {color: 0x171b1e}), 'coolant-hose', coolantPlate);
    hoses.push(hose);
    const cl = F.clamp(P, {r: 12.5 * MM, w: 10 * MM, name: 'hose-clamp'});
    cl.position.set(-Lx / 2 + .02, .05, s * .655);
    cl.rotation.set(0, 0, Math.PI / 2);
    coolantPlate.add(cl);
  }

  // ---------- 母排：长铜排 + 绝缘护罩 + 2 个高压端子 ----------
  const busbar = new THREE.Group(); busbar.name = 'busbar'; g.add(busbar);
  const bars = [];
  for (const s of [-1, 1]) {
    const bar = mesh(G.cbox(Lx - .18, .005, .028, .001), P.tier('copper', {color: C.copper}), 'busbar');
    bar.position.set(0, .175, s * .30);
    bars.push(bar);
    const ins = mesh(G.cbox(Lx - .22, .004, .034, .0014), P.tier('plastic', {color: C.orangeDeep, roughness: .5}), 'busbar-cover');
    ins.position.set(0, .181, s * .30);
  }
  const hvTerminals = [];
  for (const s of [-1, 1]) {
    const t = mesh(G.lathe([[0, 0], [.012, 0], [.012, .028], [0, .028]], 10, {angle: 30}), P.tier('machined', {color: C.brass, roughness: .24}), 'hv-terminal');
    t.position.set(Lx / 2 - .12, .19, s * .30);
    hvTerminals.push(t);
    const nutM = F.nut(P, {d: 10 * MM});
    nutM.position.set(t.position.x, .212, t.position.z);
    g.add(nutM);
  }

  // ---------- 高压连接器（橙色塑料 + 铜端子 + 卡扣 + 警示带）----------
  const hvConnector = new THREE.Group(); hvConnector.name = 'hvConnector'; hvConnector.position.set(Lx / 2 + .02, .16, .20); g.add(hvConnector);
  const bodyMat = P.tier('plastic', {color: C.orangeHV, roughness: .48});
  const connBody = mesh(G.rbox(.07, .06, .11, .008, 2), bodyMat, 'connector-body', hvConnector);
  const connNeck = mesh(G.lathe([[.022, 0], [.022, .03], [0, .03]], 12, {angle: 30}), bodyMat, 'connector-neck', hvConnector);
  connNeck.rotation.z = -Math.PI / 2; connNeck.position.x = .035;
  const latch = mesh(G.cbox(.02, .012, .04, .002), P.tier('plastic', {color: 0xd85510}), 'connector-latch', hvConnector);
  latch.position.set(-.02, .036, 0);
  for (const s of [-1, 1]) {
    const barrel = mesh(G.tube(.008, .004, .05, 10), P.tier('copper', {color: 0xc07a3e}), 'terminal-barrel', hvConnector);
    barrel.rotation.z = Math.PI / 2; barrel.position.set(.022, s * .018, 0);
  }
  const hvCable = mesh(G.cable([[.075, 0, 0], [.16, -.01, .02], [.26, .02, .04]], .013, {segs: 12, radial: 5}), P.tier('rubber', {color: C.orangeHV, roughness: .7}), 'hv-cable', hvConnector);
  const band = mesh(G.tube(.0148, .0138, .012, 8), P.tier('label', {map: L.hazard(), roughness: .6}), 'hazard-band', hvConnector);
  band.rotation.z = Math.PI / 2; band.position.set(.10, 0, .008);

  // ---------- 上盖 + 密封胶条 + 一圈螺栓 ----------
  const lid = new THREE.Group(); lid.name = 'lid'; g.add(lid);
  const lidPlate = mesh(G.rplate(Lx + .03, Wz + .03, .008, {r: .03, edge: .0008, seg: 2}), P.tier('shell', {color: C.alu, roughness: .38}), 'lid-plate', lid);
  lidPlate.rotation.x = -Math.PI / 2;
  lidPlate.position.y = .213;
  const gasket = mesh(G.seam([[Lx / 2 + .005, .209, -Wz / 2 - .005], [Lx / 2 + .005, .209, Wz / 2 + .005], [-Lx / 2 - .005, .209, Wz / 2 + .005], [-Lx / 2 - .005, .209, -Wz / 2 - .005], [Lx / 2 + .005, .209, -Wz / 2 - .005]], {width: .008, depth: .002, segs: 40}), P.tier('rubber', {color: 0x1a1e21}), 'gasket', lid);
  const lidBolts = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    lidBolts.push({p: [-Lx / 2 + .12 + i * (Lx - .24) / 5, .221, s * (Wz / 2 - .01)]});
  }
  const lidBoltMesh = F.boltArray(P, lidBolts, {d: 6 * MM, headOnly: true, flange: false, name: 'lid-bolts'});
  lid.add(lidBoltMesh);

  // ---------- BMS 主控板 + 接插件 + 继电器 ----------
  const bms = new THREE.Group(); bms.name = 'bms'; bms.position.set(-Lx / 2 + .17, .165, -.42); g.add(bms);
  const board = mesh(G.rplate(.24, .16, .002, {r: .005, edge: .0003, seg: 2}), P.tier('pcb', {color: 0xffffff}), 'bms-board', bms);
  board.rotation.x = -Math.PI / 2;
  for (const s of [-1, 1]) {
    const c = mesh(G.cbox(.05, .018, .022, .002), P.tier('plastic', {color: 0x2f383f}), 'bms-connector', bms);
    c.position.set(s * .07, .012, .05);
  }
  const relays = [];
  for (let i = 0; i < 3; i++) {
    const r = mesh(G.cbox(.03, .026, .026, .002), P.tier('plastic', {color: C.plasticBlack, roughness: .6}), 'contactor', bms);
    r.position.set(-.06 + i * .06, .016, -.02);
    relays.push(r);
  }

  // ---------- 铭牌与警示 ----------
  const label = mesh(new THREE.PlaneGeometry(.20, .10), P.tier('label', {map: L.label({serial: opts.serial ?? 'PACK-2418-96S', spec: '96S1P · 78.4kWh · 355V', brand: 'LONGCHUANG', w: 512, h: 256})}), 'label');
  label.position.set(0, .222, Wz / 2 + .016);
  label.rotation.x = -Math.PI / 2;
  const warn = mesh(new THREE.PlaneGeometry(.07, .07), P.tier('label', {map: L.warning({label: 'HIGH VOLTAGE'}), transparent: true}), 'warning');
  warn.position.set(.55, .222, Wz / 2 + .017);
  warn.rotation.x = -Math.PI / 2;
  const stamp = mesh(new THREE.PlaneGeometry(.10, .05), P.tier('label', {map: L.stamp({text: 'AL-6061-T6'})}), 'stamp');
  stamp.position.set(-.9, .222, Wz / 2 + .017);
  stamp.rotation.x = -Math.PI / 2;

  return ctx.expose(g, {
    tray, trayFloor, walls, ribs, mounts, modules,
    coolantPlate, coolantChannel: channel, coolantHoses: hoses,
    busbar, busbars: bars, hvTerminals, hvConnector, lid, lidPlate, gasket, lidBolts: lidBoltMesh,
    bms, board, relays, label, warn, stamp
  }, 20000);
}
