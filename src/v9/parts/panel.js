// 车身板件：车门外板（带鼓形曲面 + 特征棱线 + 分缝）+ 窗框 + 玻璃 + 门把手 + 铰链 + 密封条
// + 内板（减轻孔/加强筋）+ 扬声器罩 + 铭牌。
// 外板不是一块平板：用圆角矩形距离场映射出真实轮廓，再沿法向起鼓；边缘是折边，能看到板厚。
export function buildDoorPanel(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const MM = .001;
  const g = ctx.reg('door-panel', '车门板件', 'cas-2 / classa-2');
  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const W = opts.W ?? .92, H = opts.H ?? .60;
  const paintColor = opts.color ?? 0xcfd6dd;

  // ---------- 外板：曲面 + 折边 ----------
  const skin = mesh(G.curvedPanel(W, H, .0016, {crownX: .012, crownY: .018, r: .022, segX: 14, segZ: 9}), P.tier('paint', {color: paintColor}), 'outer-skin');
  // 特征棱线（腰线）：一条凸起的细棱，掠射光下会拉出一条高光——"有造型"的关键
  const charLine = mesh(G.bead([[-W / 2 + .02, .07, .016], [0, .10, .019], [W / 2 - .02, .07, .016]], {radius: .0028, segs: 26, waviness: .05}), P.tier('paint', {color: paintColor, roughness: .26}), 'character-line');
  // 下裙分缝：沿下边缘的凹槽
  const sillSeam = mesh(G.seam([[-W / 2 + .03, -H / 2 + .035, .012], [0, -H / 2 + .028, .014], [W / 2 - .03, -H / 2 + .035, .012]], {width: .0022, depth: .0014, segs: 20}), P.tier('plastic', {color: 0x24292e, roughness: .7}), 'sill-seam');
  // 前缘分缝（与前翼子板之间的间隙）
  const frontSeam = mesh(G.seam([[W / 2 - .012, -H / 2 + .05, .012], [W / 2 - .010, 0, .014], [W / 2 - .014, H / 2 - .05, .010]], {width: .0028, depth: .0018, segs: 14}), P.tier('plastic', {color: 0x1f242a, roughness: .72}), 'front-seam');

  // ---------- 窗框（帽形型材沿窗口边界）----------
  const frame = new THREE.Group(); frame.name = 'window-frame'; g.add(frame);
  const beltY = .12, topY = H / 2 - .035;
  const framePath = [[-W / 2 + .06, beltY, .012], [-W / 2 + .10, topY - .02, .010], [0, topY, .008], [W / 2 - .12, topY - .03, .008], [W / 2 - .07, beltY + .02, .012]];
  const frameBeam = mesh(G.sweep(framePath, G.SECT.hat(.036, .028, .007, .0014), {segments: 20}), P.tier('shell', {color: C.darkSteel, roughness: .4}), 'frame-beam', frame);
  const beltReinf = mesh(G.sweep([[-W / 2 + .04, beltY, .013], [0, beltY + .006, .014], [W / 2 - .04, beltY, .013]], G.SECT.channel(.026, .02, .0014), {segments: 14}), P.tier('shell', {color: C.darkSteel}), 'belt-reinforcement', frame);

  // ---------- 玻璃（独立件，可单独驱动升降）----------
  const glass = mesh(G.curvedPanel(W - .16, H / 2 - .07, .0035, {crownX: .006, crownY: .004, r: .018, segX: 10, segZ: 6}), P.tier('glass', {color: C.glass, opacity: .30}), 'glass');
  glass.position.set(-.01, (topY + beltY) / 2 - .01, .006);
  // 玻璃黑边（frit）：一圈深色带，程序化贴图做不到的用几何细带
  const frit = mesh(G.rplateHoles(W - .18, H / 2 - .09, .0008, [{x: 0, y: 0, w: W - .21, h: H / 2 - .12, r: .014}], {r: .015, edge: .0002, seg: 2}), P.tier('plastic', {color: 0x0f1316, roughness: .5}), 'frit');
  frit.position.copy(glass.position); frit.position.z += .0022;

  // ---------- 门把手（隐藏式：凹槽 + 拉手 + 微动开关）----------
  const handle = new THREE.Group(); handle.name = 'handle'; handle.position.set(.16, .05, .016); g.add(handle);
  const handlePocket = mesh(G.cbox(.14, .038, .012, .004), P.tier('plastic', {color: 0x1b2025, roughness: .62}), 'handle-pocket', handle);
  handlePocket.position.z = -.004;
  const handleGrip = mesh(G.rbox(.11, .024, .020, .008, 2), P.tier('chrome', {color: 0xd7dde2}), 'handle-grip', handle);
  handleGrip.position.z = .006;
  const microSwitch = mesh(G.cbox(.012, .008, .004, .0006), P.tier('plastic', {color: 0x3a4248}), 'micro-switch', handle);
  microSwitch.position.set(-.05, 0, .004);

  // ---------- 铰链（上下各一，加工件 + 销轴）----------
  const hinges = [];
  for (const y of [-H / 2 + .12, H / 2 - .12]) {
    const h = new THREE.Group(); h.name = 'hinge'; h.position.set(-W / 2 + .012, y, .004); g.add(h);
    const plateA = mesh(G.rplateHoles(.055, .045, .004, [{x: .012, y: .01, r: .004}, {x: .012, y: -.012, r: .004}], {r: .006, edge: .0004, seg: 2}), P.tier('machined', {color: C.darkSteel}), 'hinge-plate', h);
    plateA.rotation.y = Math.PI / 2;
    const plateB = mesh(G.rplateHoles(.05, .04, .004, [{x: .01, y: 0, r: .004}], {r: .006, edge: .0004, seg: 2}), P.tier('machined', {color: C.darkSteel}), 'hinge-plate-b', h);
    plateB.rotation.y = Math.PI / 2; plateB.position.set(.03, 0, .03); plateB.rotation.z = .5;
    const pin = mesh(G.rcyl(.005, .07, {seg: 10}), P.tier('chrome', {color: 0xc8d0d6}), 'hinge-pin', h);
    pin.position.set(0, 0, .022);
    // 铰链螺栓
    for (const by of [.012, -.012]) {
      const b = F.bolt(P, {d: 6 * MM, len: 14 * MM, threaded: false});
      b.position.set(.004, by, .004);
      b.rotation.z = -Math.PI / 2;
      h.add(b);
    }
    hinges.push(h);
  }

  // ---------- 密封条（门框一圈，橡胶）----------
  const seal = mesh(G.sweep([[W / 2 - .04, -H / 2 + .04, -.012], [W / 2 - .03, H / 2 - .06, -.014], [-W / 2 + .04, H / 2 - .04, -.014], [-W / 2 + .03, -H / 2 + .04, -.012]], G.SECT.oval(.014, .010, 8), {segments: 26, closedPath: true, caps: false}), P.tier('rubber', {color: 0x16191c, roughness: .9}), 'seal');

  // ---------- 内板：减轻孔 + 加强筋 + 扬声器罩 ----------
  const inner = new THREE.Group(); inner.name = 'inner-panel'; inner.position.z = -.035; g.add(inner);
  const innerPanel = mesh(G.rplateHoles(W - .04, H - .04, .0018, [
    {x: -.20, y: .10, w: .20, h: .12, r: .03}, {x: .22, y: .12, w: .16, h: .10, r: .03},
    {x: 0, y: -.14, w: .34, h: .10, r: .03}
  ], {r: .03, edge: .0004, seg: 2}), P.tier('shell', {color: 0x8d979f, roughness: .5}), 'inner-plate', inner);
  const ribs = [];
  for (let i = 0; i < 4; i++) {
    const r = mesh(G.cbox(.008, H - .05, .006, .0008), P.tier('shell', {color: 0x8d979f}), 'inner-rib', inner);
    r.position.set(-.30 + i * .20, 0, -.006);
    ribs.push(r);
  }
  // 扬声器：外圈 + 冲孔网
  const speakerRing = mesh(G.lathe([[.048, 0], [.058, 0], [.058, .01], [.048, .01], [.048, 0]], 18, {angle: 40}), P.tier('plastic', {color: 0x22282e}), 'speaker-ring', inner);
  speakerRing.rotation.x = Math.PI / 2; speakerRing.position.set(-.24, -.14, -.008);
  const speakerMesh = mesh(new THREE.CircleGeometry(.046, 20), P.tier('label', {map: L.perf({holes: 16, kind: 'hex', light: '#8e9aa4', dark: '#10151a'}), roughness: .55, metalness: .35}), 'speaker-grille', inner);
  speakerMesh.position.set(-.24, -.14, -.0145); speakerMesh.rotation.y = Math.PI;

  // ---------- 铭牌 / 标识 ----------
  const emblem = mesh(new THREE.PlaneGeometry(.055, .022), P.tier('chrome', {color: 0xd8dfe4, map: L.stamp({text: 'LONGCHUANG', bg: '#c9d2d8', fg: '#1a2026'})}), 'emblem');
  emblem.position.set(-.28, .20, .017);
  const vin = mesh(new THREE.PlaneGeometry(.06, .02), P.tier('label', {map: L.label({serial: opts.vin ?? 'LDC2418A01', spec: 'DOOR · RR · AL5052', brand: 'VIN', w: 256, h: 96, qr: false})}), 'vin-label');
  vin.position.set(.30, -.21, .018);
  const buildStamp = mesh(new THREE.PlaneGeometry(.05, .02), P.tier('label', {map: L.stamp({text: 'AL-5052'})}), 'stamp', inner);
  buildStamp.position.set(.24, -.18, -.013);
  buildStamp.rotation.y = Math.PI;

  // 接触阴影（板件平放时的暗影）
  const shadow = mesh(new THREE.PlaneGeometry(1.1, .78), P.tier('label', {map: L.softShadow({strength: .5}), transparent: true, opacity: .4, depthWrite: false}), 'contact-shadow');
  shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -.315, .02);

  return ctx.expose(g, {skin, charLine, sillSeam, frontSeam, frame, frameBeam, beltReinf, glass, frit, handle, hinges, seal, inner, innerPanel, ribs, speakerRing, speakerMesh, emblem, vin, buildStamp, shadow}, 9000);
}
