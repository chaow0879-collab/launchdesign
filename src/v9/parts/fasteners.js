// 连接件：真螺栓（六角头 + 垫圈 + 螺纹段）、螺母、垫圈、螺柱、端子、针脚、管夹。
// 尺寸按真实紧固件比例：M8 头对边 13mm、头高 5.6mm、螺纹节距 1.25mm。
// 局部坐标：螺栓从 y=0 的法兰面开始，头部朝 +y，杆部朝 -y（放置时贴合安装面即可）。
export function createFasteners(THREE, G) {
  const {rcyl, lathe, cbox, rbox, thread, rplateHoles, mergeGeos} = G;
  const MM = .001;

  // ---------- 螺栓几何（按材质分组返回：头/垫圈/杆/螺纹）----------
  function boltGeos({d = 8 * MM, len = 20 * MM, af = null, headH = null, flange = true, threaded = true, headOnly = false, seg = 6} = {}) {
    const rHexR = (af ?? d * 1.625) / 2 / Math.cos(Math.PI / 6);
    const hh = headH ?? d * .7;
    const headPts = [
      [0, 0],
      [rHexR * .985, 0],
      [rHexR, hh * .18],
      [rHexR, hh * .82],
      [rHexR * .88, hh],
      [0, hh]
    ];
    const head = lathe(headPts, seg, {angle: 32});
    const geos = {head, headMat: 'machined'};
    if (flange) geos.washer = lathe([[d * .56, 0], [d * 1.02, 0], [d * 1.02, d * .16], [d * .56, d * .16], [d * .56, 0]], 10, {angle: 40});
    if (headOnly) return geos;
    geos.shank = lathe([[0, 0], [d / 2, 0], [d / 2, -len + .0004], [0, -len]], 8, {angle: 30});
    if (threaded && len > d * 1.2) {
      const tl = Math.min(len * .72, len - d * .4);
      const th = thread(d * .99, tl, Math.max(.0008, d * .16), {seg: 22, depth: d * .075});
      // thread() 以 0 为中心，挪到杆的下段（靠近牙尖）
      th.translate(0, -(len * .18 + tl / 2), 0);
      geos.thread = th;
    }
    return geos;
  }

  // 组装成可动画的螺栓组：head+washer 走 machined，shank+thread 走 darkSteel
  function bolt(P, opts = {}) {
    const g = new THREE.Group();
    g.name = opts.name || 'bolt';
    g.userData.kind = 'fastener';
    const geos = boltGeos(opts);
    const headMat = P.tier(opts.headTier || 'machined', {color: opts.color ?? 0xc8d0d6});
    const shankMat = P.tier(opts.shankTier || 'machined', {color: opts.shankColor ?? 0x8d99a3, roughness: .32, metalness: .85});
    const add = (geo, mat, name) => {
      const m = new THREE.Mesh(geo, mat); m.name = name; m.userData.kind = 'fastener-part'; g.add(m); return m;
    };
    const head = add(geos.head, headMat, 'head');
    if (geos.washer) add(geos.washer, headMat, 'washer');
    const shank = add(geos.shank, shankMat, 'shank');
    if (geos.thread) {
      const t = add(geos.thread, P.tier('machined', {color: 0x9aa6b0, roughness: .34, side: THREE.DoubleSide}), 'thread');
      t.userData.kind = 'thread';
    }
    g.userData.head = head;
    g.userData.shank = shank;
    g.userData.size = opts.d ?? 8 * MM;
    return g;
  }

  // 静态螺栓阵列：合并成一个几何，省 draw call（用于盖板一圈、端盖螺栓圈）
  function boltArray(P, list, opts = {}) {
    const geos = boltGeos(opts);
    const parts = [];
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (const it of list) {
      const pos = new THREE.Vector3(...(it.p || [0, 0, 0]));
      if (it.q) q.copy(it.q); else q.setFromEuler(new THREE.Euler(...(it.r || [0, 0, 0])));
      m4.compose(pos, q, s);
      for (const key of ['head', 'washer', 'shank', 'thread']) {
        if (geos[key]) parts.push({geo: geos[key], matrix: m4.clone()});
      }
    }
    const merged = mergeGeos(parts);
    const mesh = new THREE.Mesh(merged, P.tier('machined', {color: opts.color ?? 0xc2ccd3, roughness: .3}));
    mesh.name = opts.name || 'bolt-array';
    mesh.userData.kind = 'fastener-array';
    mesh.userData.count = list.length;
    return mesh;
  }

  function nutGeos({d = 8 * MM, af = null, h = null} = {}) {
    const rHex = (af ?? d * 1.6) / 2 / Math.cos(Math.PI / 6);
    const hh = h ?? d * .8;
    const rHole = d * .5;
    return lathe([[rHole, -hh / 2], [rHex, -hh / 2], [rHex, hh / 2], [rHole, hh / 2], [rHole, -hh / 2]], 6, {angle: 32});
  }

  function nut(P, opts = {}) {
    const m = new THREE.Mesh(nutGeos(opts), P.tier('machined', {color: opts.color ?? 0xbfc9d0}));
    m.name = opts.name || 'nut';
    m.userData.kind = 'fastener';
    return m;
  }

  function washerGeos({d = 8 * MM, t = 1.6 * MM} = {}) {
    const ri = d * .53, ro = d * 1.02;
    return lathe([[ri, -t / 2], [ro, -t / 2], [ro, t / 2], [ri, t / 2], [ri, -t / 2]], 14, {angle: 40});
  }

  function washer(P, opts = {}) {
    const m = new THREE.Mesh(washerGeos(opts), P.tier('machined', {color: opts.color ?? 0xc9d2d8, roughness: .3}));
    m.name = opts.name || 'washer';
    m.userData.kind = 'fastener';
    return m;
  }

  // 轮毂螺柱：球头螺柱 + 螺母（轮端）
  function stud(P, {d = 12 * MM, len = 34 * MM} = {}) {
    const g = new THREE.Group(); g.name = 'stud'; g.userData.kind = 'fastener';
    const body = new THREE.Mesh(lathe([[0, 0], [d / 2, 0], [d / 2, len * .28], [d * .42, len * .36], [d / 2, len * .44], [d / 2, len], [0, len]], 10, {angle: 32}), P.tier('machined', {color: 0xa8b3bc}));
    const n = nut(P, {d, af: d * 1.6, h: d * .75, name: 'nut'});
    n.position.y = len * .54;
    g.add(body, n);
    g.userData.nut = n;
    return g;
  }

  // 高压端子：铜排端子（圆孔）+ 螺纹柱 + 绝缘帽
  function terminal(P, {d = 6 * MM, lugW = 20 * MM, lugL = 26 * MM, name = 'terminal'} = {}) {
    const g = new THREE.Group(); g.name = name; g.userData.kind = 'terminal';
    const lug = new THREE.Mesh(rplateHoles(lugW, lugL, 1.4 * MM, [{x: lugW * .18, y: 0, r: d * .62}], {r: 2 * MM, edge: .0003, seg: 2}), P.tier('copper', {color: 0xc07a3e}));
    lug.name = 'lug';
    const barrel = new THREE.Mesh(rcyl(d * .72, 12 * MM, {seg: 12}), P.tier('copper', {color: 0xb06f38}));
    barrel.name = 'barrel'; barrel.position.set(-lugW * .28, 0, 0);
    barrel.rotation.z = Math.PI / 2;
    const boltM = bolt(P, {d: d * .8, len: 10 * MM, name: 'bolt', color: 0xd7dee3});
    boltM.position.set(lugW * .18, 1.4 * MM, 0);
    g.add(lug, barrel, boltM);
    g.userData.lug = lug;
    return g;
  }

  // ECU 针脚：方形冲压针（12 三角面/根，1.2mm 针不需要倒角）
  function pinField(P, {rows = 2, cols = 8, pitch = 3 * MM, pin = 1.2 * MM, len = 9 * MM, color = 0xd8b26a} = {}) {
    const geo = new THREE.BoxGeometry(pin, len, pin);
    const mat = P.tier('machined', {color, roughness: .22, metalness: .95});
    const grp = new THREE.Group(); grp.name = 'pins'; grp.userData.kind = 'pin-field';
    const merged = [];
    const m4 = new THREE.Matrix4();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      m4.makeTranslation((c - (cols - 1) / 2) * pitch, len / 2, (r - (rows - 1) / 2) * pitch);
      merged.push({geo, matrix: m4.clone()});
    }
    const mesh = new THREE.Mesh(mergeGeos(merged), mat);
    mesh.name = 'pin-field'; mesh.userData.count = rows * cols;
    grp.add(mesh);
    grp.userData.pinCount = rows * cols;
    return grp;
  }

  // 管夹：整圈钢带 + 橡胶内衬 + 两个耳片 + 安装螺栓
  function clamp(P, {r = 8 * MM, w = 12 * MM, name = 'clamp'} = {}) {
    const g = new THREE.Group(); g.name = name; g.userData.kind = 'clamp';
    const bandGeo = lathe([[r, -w / 2], [r + 1.2 * MM, -w / 2], [r + 1.2 * MM, w / 2], [r, w / 2], [r, -w / 2]], 14, {angle: 30});
    const body = new THREE.Mesh(bandGeo, P.tier('machined', {color: 0xb9c3ca}));
    body.name = 'band'; body.rotation.x = Math.PI / 2;
    const liner = new THREE.Mesh(lathe([[r - .9 * MM, -w * .32], [r, -w * .32], [r, w * .32], [r - .9 * MM, w * .32], [r - .9 * MM, -w * .32]], 12, {angle: 50}), P.tier('rubber', {color: 0x191d20}));
    liner.name = 'liner'; liner.rotation.x = Math.PI / 2;
    const ear = P.tier('machined', {color: 0xb9c3ca});
    const e1 = new THREE.Mesh(cbox(w * .9, 3 * MM, 2.4 * MM, .0004), ear);
    e1.position.set(r + 2.2 * MM, 0, 0); e1.name = 'ear';
    const e2 = e1.clone(); e2.position.x = -r - 2.2 * MM;
    g.add(body, liner, e1, e2);
    return g;
  }

  return {MM, boltGeos, bolt, boltArray, nutGeos, nut, washerGeos, washer, stud, terminal, pinField, clamp};
}
