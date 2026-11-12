// 座椅总成（前排）：滑轨 + 座盆骨架 + 发泡 + 面套 + 靠背 + 头枕 + 安全带 + 线束标签。
// 尺寸：坐垫上表面距安装面约 0.32m，坐垫宽 0.50m，靠背高 0.56m，头枕高 0.15m。
// 去方块感的做法：分层（骨架/发泡/面套/缝线/包边）、分材质（织物 sheen + 加工件 + 塑料 + 橡胶）、
// 侧翼有真实圆角与缝线凹槽、滑轨是 C 型槽型材而不是方条。
export function buildSeat(ctx, opts = {}) {
  const {THREE, G, F, L} = ctx;
  const P = ctx.palette();
  const C = P.COLORS;
  const g = ctx.reg('seat', '座椅总成', 'concept-2 / validation-1');
  const MM = .001;
  const fabricColor = opts.fabricColor ?? C.fabric;

  const mesh = (geo, mat, name, parent = g) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'part'; parent.add(m); return m; };
  const matFabric = P.tier('fabric', {color: fabricColor});
  const matFabricDark = P.tier('fabric', {color: new THREE.Color(fabricColor).multiplyScalar(.72), sheenColor: 0xaab4bb});
  const matPlastic = P.tier('plastic', {color: C.plasticGraphite});
  const matPlasticDark = P.tier('plastic', {color: C.plasticBlack, roughness: .68});
  const matMetal = P.tier('machined', {color: C.alu});
  const matSteel = P.tier('shell', {color: C.darkSteel});
  const matRubber = P.tier('rubber', {color: C.rubber});

  // ---------- 滑轨：两根 C 型槽 + 前后安装脚 ----------
  const rails = [];
  for (const s of [-1, 1]) {
    const z = s * .17;
    const rail = mesh(G.sweep([[-.30, .045, z], [0, .048, z], [.30, .045, z]], G.SECT.channel(.042, .032, .0022), {segments: 5}), matMetal, `rail-${s > 0 ? 'L' : 'R'}`);
    rails.push(rail);
    // 滑轨锁止齿条（细齿，让侧面不再是光板）
    const teeth = [];
    for (let i = 0; i < 9; i++) teeth.push({geo: G.box(.012, .003, .006), matrix: new THREE.Matrix4().makeTranslation(-.24 + i * .06, .058, z + s * .016)});
    mesh(G.mergeGeos(teeth), P.tier('machined', {color: C.darkSteel}), `rail-teeth-${s > 0 ? 'L' : 'R'}`);
  }
  // 前后安装脚 + 螺栓
  const feet = [], bolts = [];
  for (const s of [-1, 1]) for (const x of [-.24, .24]) {
    feet.push({geo: G.cbox(.07, .012, .08, .0012), matrix: new THREE.Matrix4().makeTranslation(x, .006, s * .17)});
    const b = F.bolt(P, {d: 10 * MM, len: 18 * MM, threaded: false, flange: false, name: 'bolt'});
    b.position.set(x, .012, s * .17);
    b.rotation.x = Math.PI;
    g.add(b); bolts.push(b);
  }
  mesh(G.mergeGeos(feet), P.tier('shell', {color: C.castAlu}), 'rail-feet');

  // ---------- 座盆骨架：两侧钣金支架 + 两根横管 ----------
  const frame = new THREE.Group(); frame.name = 'frame'; g.add(frame);
  for (const s of [-1, 1]) {
    const side = mesh(G.rplateHoles(.40, .07, .0035, [{x: -.12, y: 0, r: .012}, {x: .12, y: 0, r: .012}, {x: 0, y: 0, r: .02}], {r: .012, edge: .0004, seg: 2}), matSteel, `frame-side-${s > 0 ? 'L' : 'R'}`, frame);
    side.position.set(0, .095, s * .225);
    side.rotation.x = Math.PI / 2;
  }
  for (const x of [-.16, .16]) {
    const cross = mesh(G.rcyl(.011, .46, {seg: 12}), matSteel, 'frame-cross', frame);
    cross.rotation.x = Math.PI / 2; cross.position.set(x, .085, 0);
  }
  // 座盆钣金（有减轻孔，说明这是"设计过的零件"）
  const pan = mesh(G.rplateHoles(.40, .36, .0022, [
    {x: -.10, y: .08, w: .10, h: .10, r: .02}, {x: .10, y: .08, w: .10, h: .10, r: .02},
    {x: 0, y: -.10, w: .16, h: .07, r: .02}
  ], {r: .02, edge: .0004, seg: 2}), matSteel, 'pan', frame);
  pan.rotation.x = -Math.PI / 2; pan.position.set(0, .112, 0);

  // ---------- 座垫：发泡分层 + 侧翼 + 面套 + 缝线 ----------
  const cushion = new THREE.Group(); cushion.name = 'cushion'; g.add(cushion);
  const cushionBase = mesh(G.rbox(.45, .072, .40, .026, 2), P.tier('shell', {color: 0x384048, metalness: .05, roughness: .7}), 'cushion-foam', cushion);
  cushionBase.position.set(0, .155, 0);
  // 面套上垫（比发泡略小，边缘能看到发泡与包边）
  const topPad = mesh(G.rbox(.43, .022, .38, .014, 2), matFabric, 'cushion-cover', cushion);
  topPad.position.set(0, .198, 0);
  const bolsters = [];
  for (const s of [-1, 1]) {
    const b = mesh(G.rbox(.43, .085, .075, .028, 2), matFabric, `bolster-${s > 0 ? 'L' : 'R'}`, cushion);
    b.position.set(0, .19, s * .195);
    b.rotation.x = s * .22;
    bolsters.push(b);
    // 侧翼缝线（凹槽）
    const seam = mesh(G.seam([[-.20, .205, s * .152], [0, .212, s * .158], [.20, .205, s * .152]], {width: .0022, depth: .0012, segs: 10}), matFabricDark, 'seam', cushion);
    seam.position.y = 0;
  }
  // 坐垫横向绗缝：三条凹槽
  for (let i = 0; i < 3; i++) {
    const x = -.11 + i * .11;
    const q = mesh(G.seam([[x, .207, -.17], [x, .209, 0], [x, .207, .17]], {width: .0024, depth: .0013, segs: 8}), matFabricDark, 'quilt-seam', cushion);
  }
  // 包边（滚边条）：沿座垫前沿一圈细管
  const piping = mesh(G.cable([[-.21, .195, -.20], [-.21, .192, 0], [-.21, .195, .20]], .0045, {segs: 12, radial: 4}), matFabricDark, 'piping', cushion);
  piping.position.x = 0;

  // ---------- 靠背：骨架 + 发泡 + 侧翼 + 腰托 ----------
  const backrest = new THREE.Group(); backrest.name = 'backrest'; backrest.position.set(-.205, .155, 0); backrest.rotation.z = .16; g.add(backrest);
  const backShell = mesh(G.rplateHoles(.50, .55, .004, [
    {x: -.16, y: .13, w: .07, h: .16, r: .02}, {x: .16, y: .13, w: .07, h: .16, r: .02},
    {x: 0, y: -.16, w: .18, h: .06, r: .02}
  ], {r: .03, edge: .0005, seg: 2}), matSteel, 'back-shell', backrest);
  backShell.position.set(-.052, .26, 0);
  backShell.rotation.y = Math.PI / 2; backShell.rotation.z = Math.PI / 2;
  const backPad = mesh(G.rbox(.09, .50, .42, .03, 2), matFabric, 'back-pad', backrest);
  backPad.position.set(0, .27, 0);
  const backBolsters = [];
  for (const s of [-1, 1]) {
    const b = mesh(G.rbox(.075, .46, .085, .03, 2), matFabric, `back-bolster-${s > 0 ? 'L' : 'R'}`, backrest);
    b.position.set(.012, .27, s * .195);
    b.rotation.x = s * -.18;
    backBolsters.push(b);
  }
  const lumbar = mesh(G.rbox(.05, .15, .34, .018, 2), matFabricDark, 'lumbar', backrest);
  lumbar.position.set(.045, .12, 0);
  // 靠背竖向绗缝
  for (const z of [-.09, 0, .09]) {
    const q = mesh(G.seam([[.046, .05, z], [.05, .30, z], [.046, .50, z]], {width: .0022, depth: .0012, segs: 8}), matFabricDark, 'back-seam', backrest);
  }
  // 靠背侧面的塑料护板（分材质：织物旁边是注塑件）
  for (const s of [-1, 1]) {
    const trim = mesh(G.cbox(.05, .30, .012, .004), matPlastic, `back-trim-${s > 0 ? 'L' : 'R'}`, backrest);
    trim.position.set(.005, .26, s * .232);
  }
  // 靠背骨架与座盆的连接（调角器）：两侧圆盘 + 手柄
  const recliners = [];
  for (const s of [-1, 1]) {
    const disc = mesh(G.lathe([[.026, -.007], [.042, -.007], [.042, .007], [.026, .007], [.026, -.007]], 14, {angle: 40}), P.tier('machined', {color: C.darkAlu}), 'recliner', g);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(-.16, .155, s * .215);
    recliners.push(disc);
  }
  const handle = mesh(G.sweep([[-.16, .16, .26], [-.14, .19, .29], [-.11, .205, .30]], G.SECT.rect(.028, .012), {segments: 6}), matPlastic, 'recline-handle', g);
  const handleKnob = mesh(G.cbox(.034, .022, .034, .005), matPlasticDark, 'handle-knob', g);
  handleKnob.position.set(-.11, .205, .30);

  // ---------- 头枕：发泡 + 两根导杆 + 塑料导套 ----------
  const headrest = new THREE.Group(); headrest.name = 'headrest'; headrest.position.set(-.30, .78, 0); headrest.rotation.z = .16; g.add(headrest);
  const hrPad = mesh(G.rbox(.095, .155, .255, .038, 2), matFabric, 'headrest-pad', headrest);
  const hrDark = mesh(G.cbox(.085, .135, .24, .006), matFabricDark, 'headrest-insert', headrest);
  hrDark.position.x = -.006;
  const posts = [], guides = [];
  for (const s of [-1, 1]) {
    const post = mesh(G.rcyl(.0055, .15, {seg: 10}), matMetal, 'headrest-post', headrest);
    post.position.set(0, -.12, s * .055);
    posts.push(post);
    const guide = mesh(G.lathe([[.0095, 0], [.0125, 0], [.0125, .022], [.0095, .022], [.0095, 0]], 12, {angle: 40}), matPlastic, 'headrest-guide', g);
    guide.position.set(-.265, .655, s * .055);
    guides.push(guide);
  }

  // ---------- 安全带：织带 + 锁扣 + 锚点 ----------
  const belt = new THREE.Group(); belt.name = 'belt'; g.add(belt);
  const strapProfile = [[-.026, -.0008], [.026, -.0008], [.026, .0008], [-.026, .0008]];
  const strap = mesh(G.sweep([[-.27, .85, .155], [-.20, .55, .20], [-.08, .30, .17], [.02, .22, .10]], strapProfile, {segments: 18, caps: true, smooth: false}), P.tier('fabric', {color: 0x22282d, sheen: .55}), 'strap', belt);
  const buckle = mesh(G.cbox(.055, .03, .045, .003), matMetal, 'buckle', belt);
  buckle.position.set(.02, .215, .10);
  const buckleBtn = mesh(G.cbox(.03, .006, .018, .001), P.tier('plastic', {color: C.red, roughness: .45}), 'buckle-button', belt);
  buckleBtn.position.set(.02, .235, .10);
  const anchor = mesh(G.rplateHoles(.05, .06, .003, [{x: 0, y: 0, r: .008}], {r: .008, edge: .0003, seg: 2}), matSteel, 'anchor', belt);
  anchor.position.set(-.27, .845, .155); anchor.rotation.y = Math.PI / 2;
  const anchorBolt = F.bolt(P, {d: 10 * MM, len: 22 * MM, name: 'bolt'});
  anchorBolt.position.set(-.255, .845, .155); anchorBolt.rotation.z = -Math.PI / 2; belt.add(anchorBolt);

  // ---------- 线束卡夹 + 铭牌（缝在骨架上的布标）----------
  const clip = F.clamp(P, {r: 6 * MM, w: 9 * MM, name: 'harness-clip'});
  clip.rotation.z = Math.PI / 2; clip.position.set(-.12, .085, .245); g.add(clip);
  const tag = mesh(new THREE.PlaneGeometry(.055, .028), P.tier('label', {map: L.label({serial: 'ST-2418-FR', spec: 'Seat assy · 8-way · heated', brand: 'LONGCHUANG', w: 256, h: 128, qr: false})}), 'label', g);
  tag.position.set(.0, .10, .229); tag.rotation.y = Math.PI / 2;
  const tag2 = mesh(new THREE.PlaneGeometry(.05, .024), P.tier('label', {map: L.stamp({text: 'PA66-GF30', bg: '#b9c2c9', fg: '#2c343a'})}), 'stamp', frame);
  tag2.position.set(.10, .108, .222);

  // ---------- 侧气囊标识（小标签，工程师视角的细节）----------
  const airbag = mesh(new THREE.PlaneGeometry(.036, .018), P.tier('label', {map: L.label({serial: 'SRS', spec: 'AIRBAG', brand: 'SRS', w: 128, h: 64, qr: false, barcode: false})}), 'airbag-tag', g);
  airbag.position.set(-.20, .55, .225); airbag.rotation.set(0, Math.PI / 2, .16);

  // 接触阴影（落在地板上的暗影，避免"悬空积木"）
  const shadow = mesh(new THREE.PlaneGeometry(.7, .62), P.tier('label', {map: L.softShadow(), transparent: true, opacity: .55, depthWrite: false}), 'contact-shadow', g);
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = .002;

  const sub = {
    frame, pan, cushion, backrest, headrest, belt,
    cushionBase, topPad, backPad, lumbar, hrPad,
    bolsters, backBolsters, recliners, rails, bolts, posts, guides,
    buckle, strap, anchor, handle, handleKnob, clip, tag, airbag, shadow
  };
  return ctx.expose(g, sub, 8000);
}
