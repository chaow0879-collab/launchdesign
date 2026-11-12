// 几何生成器：圆角盒 / 倒角块 / 拉伸板 / 扫掠型材 / 车削件 / 螺纹 / 波纹管 / 弹簧 / 板缝。
// 约定：
//   - 只通过注入的 THREE 使用 three，不在本文件 import，方便 Node 端离线统计三角面。
//   - 全部确定性生成，不使用随机数。
//   - 半径单位是米。真实零件比例：薄板 2~3mm，壳体 4~6mm，铸件 8~12mm。
const TAU = Math.PI * 2;

export function createGeo(THREE) {
  const {BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Shape, Path, ExtrudeGeometry, LatheGeometry, TubeGeometry, TorusGeometry, CylinderGeometry, SphereGeometry, CircleGeometry} = THREE;
  const V3 = THREE.Vector3;

  // ---------- 基础工具 ----------
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  // 一维坐标表：两端是 arc 段圆角带，中间是平面区（尽量少切分，省面数）
  function axisCoords(half, r, arc) {
    const inner = half - r;
    const out = [];
    const n = Math.max(1, arc | 0);
    for (let i = 0; i <= n; i++) out.push(-half + r * (i / n));
    if (inner > 1e-6) out.push(inner);
    for (let i = 1; i <= n; i++) out.push(inner + r * (i / n));
    return out;
  }

  // ---------- 圆角盒 ----------
  // 做法：把外盒表面的每个采样点向"内盒"做球面推出，得到真正的等半径圆角，
  // 法线解析给出（圆角带平滑、平面区恒定），所以圆角高光是真的连续过渡，而不是切角假象。
  function rbox(w, h, d, r = .02, arc = 2, {flat = false} = {}) {
    const halfs = [w / 2, h / 2, d / 2];
    r = Math.max(1e-5, Math.min(r, halfs[0] * .999, halfs[1] * .999, halfs[2] * .999));
    const inner = [halfs[0] - r, halfs[1] - r, halfs[2] - r];
    const coords = halfs.map(hh => axisCoords(hh, r, arc));
    // 每个面的参数轴：保证 e1 × e2 = 外法线（决定绕序）
    const faces = [
      {k: 0, s: 1, e1: 1, e2: 2}, {k: 0, s: -1, e1: 2, e2: 1},
      {k: 1, s: 1, e1: 2, e2: 0}, {k: 1, s: -1, e1: 0, e2: 2},
      {k: 2, s: 1, e1: 0, e2: 1}, {k: 2, s: -1, e1: 1, e2: 0}
    ];
    const pos = [], nor = [], uv = [], idx = [];
    const p = [0, 0, 0];
    for (const f of faces) {
      const base = pos.length / 3;
      const A = coords[f.e1], B = coords[f.e2];
      for (let i = 0; i < A.length; i++) for (let j = 0; j < B.length; j++) {
        p[f.e1] = A[i]; p[f.e2] = B[j]; p[f.k] = f.s * halfs[f.k];
        const q0 = clamp(p[0], -inner[0], inner[0]);
        const q1 = clamp(p[1], -inner[1], inner[1]);
        const q2 = clamp(p[2], -inner[2], inner[2]);
        let dx = p[0] - q0, dy = p[1] - q1, dz = p[2] - q2;
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        pos.push(q0 + r * dx, q1 + r * dy, q2 + r * dz);
        nor.push(dx, dy, dz);
        uv.push((A[i] + halfs[f.e1]) / (2 * halfs[f.e1]), (B[j] + halfs[f.e2]) / (2 * halfs[f.e2]));
      }
      const nB = B.length;
      for (let i = 0; i < A.length - 1; i++) for (let j = 0; j < nB - 1; j++) {
        const a = base + i * nB + j, b = base + (i + 1) * nB + j;
        const c = base + i * nB + j + 1, dd = base + (i + 1) * nB + j + 1;
        idx.push(a, b, dd, a, dd, c);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return flat ? flatShade(g) : g;
  }

  // ---------- 倒角块（机加工件：45° 倒棱 + 硬边，44 三角面）----------
  // 6 个面 + 12 条倒棱 + 8 个角三角，正好 44 面；比圆角盒省 60% 面数，是倒角钣金/铸件的主力。
  function chamferBox(w, h, d, c = .0015) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    c = Math.max(1e-6, Math.min(c, hx * .98, hy * .98, hz * .98));
    const ix = hx - c, iy = hy - c, iz = hz - c;
    const key = (sx, sy, sz) => `${sx}${sy}${sz}`;
    const PX = {}, PY = {}, PZ = {};
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const k = key(sx, sy, sz);
      PX[k] = [sx * hx, sy * iy, sz * iz];
      PY[k] = [sx * ix, sy * hy, sz * iz];
      PZ[k] = [sx * ix, sy * iy, sz * hz];
    }
    const pos = [];
    const tri = (a, b, cc) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2]); };
    const quad = (a, b, cc, dd) => { tri(a, b, cc); tri(a, cc, dd); };
    for (const s of [-1, 1]) {
      // ±X 面
      quad(PX[key(s, -1, -1)], PX[key(s, -1, 1)], PX[key(s, 1, 1)], PX[key(s, 1, -1)]);
      // ±Y 面
      quad(PY[key(-1, s, -1)], PY[key(1, s, -1)], PY[key(1, s, 1)], PY[key(-1, s, 1)]);
      // ±Z 面
      quad(PZ[key(-1, -1, s)], PZ[key(-1, 1, s)], PZ[key(1, 1, s)], PZ[key(1, -1, s)]);
    }
    // 12 条倒棱
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) quad(PX[key(sx, sy, -1)], PX[key(sx, sy, 1)], PY[key(sx, sy, 1)], PY[key(sx, sy, -1)]);
    for (const sy of [-1, 1]) for (const sz of [-1, 1]) quad(PY[key(-1, sy, sz)], PY[key(1, sy, sz)], PZ[key(1, sy, sz)], PZ[key(-1, sy, sz)]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) quad(PX[key(sx, -1, sz)], PX[key(sx, 1, sz)], PZ[key(sx, 1, sz)], PZ[key(sx, -1, sz)]);
    // 8 个角
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) tri(PX[key(sx, sy, sz)], PY[key(sx, sy, sz)], PZ[key(sx, sy, sz)]);
    // 绕序统一朝外（凸体 + 原点在内部：面法线与面心同向即可）
    const arr = pos;
    for (let i = 0; i < arr.length; i += 9) {
      const ax = arr[i], ay = arr[i + 1], az = arr[i + 2];
      const bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5];
      const cx = arr[i + 6], cy = arr[i + 7], cz = arr[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const gx = (ax + bx + cx) / 3, gy = (ay + by + cy) / 3, gz = (az + bz + cz) / 3;
      if (nx * gx + ny * gy + nz * gz < 0) {
        // 交换 B/C
        arr[i + 3] = cx; arr[i + 4] = cy; arr[i + 5] = cz;
        arr[i + 6] = bx; arr[i + 7] = by; arr[i + 8] = bz;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(arr, 3));
    // 简易投影 UV：取法线主轴，用另外两轴做平面投影（足够贴拉丝/铭牌贴图）
    const n = arr.length / 3;
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < arr.length; i += 9) {
      const ax = arr[i], ay = arr[i + 1], az = arr[i + 2];
      const bx = arr[i + 3], by = arr[i + 4], bz = arr[i + 5];
      const cx = arr[i + 6], cy = arr[i + 7], cz = arr[i + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
      const o = Math.floor(i / 3);
      for (let k = 0; k < 3; k++) {
        const px = arr[i + k * 3], py = arr[i + k * 3 + 1], pz = arr[i + k * 3 + 2];
        let u, v;
        if (nx >= ny && nx >= nz) { u = pz / Math.max(1e-6, d) + .5; v = py / Math.max(1e-6, h) + .5; }
        else if (ny >= nz) { u = px / Math.max(1e-6, w) + .5; v = pz / Math.max(1e-6, d) + .5; }
        else { u = px / Math.max(1e-6, w) + .5; v = py / Math.max(1e-6, h) + .5; }
        uv[(o + k) * 2] = u; uv[(o + k) * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  function cbox(w, h, d, c = .0015) {
    return chamferBox(w, h, d, c);
  }

  // 最省的实心块：12 面（只给 1cm 以下的小特征用，肉眼看不见倒角）
  function box(w, h, d) {
    return new THREE.BoxGeometry(w, h, d);
  }

  function flatShade(g) {
    const n = g.index ? g.toNonIndexed() : g;
    n.computeVertexNormals();
    return n;
  }

  // ---------- 圆角矩形路径 ----------
  function roundRectPath(w, h, r) {
    const x = Math.max(1e-4, w / 2), y = Math.max(1e-4, h / 2);
    r = Math.max(0, Math.min(r, x * .999, y * .999));
    const s = new Shape();
    s.moveTo(-x + r, -y);
    s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r);
    s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
    s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r);
    s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y);
    return s;
  }

  // ---------- 拉伸 ----------
  function extrude(shape, depth, {bevel = 0, curveSegments = 3, bevelSegments = 2, steps = 1} = {}) {
    const g = new ExtrudeGeometry(shape, {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments, curveSegments, steps});
    g.translate(0, 0, -depth / 2);
    return g;
  }

  // 带倒角边的薄板：外形尺寸 w×h×t，四角半径 r，厚度方向一圈很小的倒角
  function rplate(w, h, t, {r = .006, edge = .0008, seg = 3} = {}) {
    const e = Math.min(edge, t * .45, r * .75);
    const shape = roundRectPath(Math.max(.001, w - 2 * (r ? e : 0)), Math.max(.001, h - 2 * (r ? e : 0)), Math.max(.0005, r - e));
    const depth = Math.max(.0002, t - 2 * e);
    return extrude(shape, depth, {bevel: e, curveSegments: seg, bevelSegments: 2});
  }

  // 带孔板：holes = [{x,y,r}] 或 [{x,y,w,h,r}]
  // 与 rplate 保持同一口径：外形 w×h、厚度 t（bevel 向内让，不额外长胖）
  function rplateHoles(w, h, t, holes = [], {r = .006, edge = .0006, seg = 3} = {}) {
    const e = Math.min(edge, t * .45, r * .75);
    const body = roundRectPath(Math.max(.001, w - 2 * e), Math.max(.001, h - 2 * e), Math.max(.0005, r - e));
    for (const hole of holes) {
      const p = new Path();
      if (hole.r !== undefined && hole.w === undefined) {
        p.absarc(hole.x, hole.y, hole.r, 0, TAU, true);
      } else {
        const hw = hole.w / 2, hh = hole.h / 2, hr = Math.min(hole.r ?? 0, hw, hh);
        p.moveTo(hole.x - hw + hr, hole.y - hh);
        p.lineTo(hole.x + hw - hr, hole.y - hh); p.quadraticCurveTo(hole.x + hw, hole.y - hh, hole.x + hw, hole.y - hh + hr);
        p.lineTo(hole.x + hw, hole.y + hh - hr); p.quadraticCurveTo(hole.x + hw, hole.y + hh, hole.x + hw - hr, hole.y + hh);
        p.lineTo(hole.x - hw + hr, hole.y + hh); p.quadraticCurveTo(hole.x - hw, hole.y + hh, hole.x - hw, hole.y + hh - hr);
        p.lineTo(hole.x - hw, hole.y - hh + hr); p.quadraticCurveTo(hole.x - hw, hole.y - hh, hole.x - hw + hr, hole.y - hh);
      }
      body.holes.push(p);
    }
    return extrude(body, Math.max(.0004, t - 2 * e), {bevel: e, curveSegments: seg, bevelSegments: 1});
  }

  // ---------- 扫掠型材（白车身梁、C 型槽、铝型材、门框）----------
  // 平行传输标架，避免 Frenet 在直线/急弯处翻转；profile 是闭合的 [u,v] 点列（在法线/副法线平面里）。
  function framesFor(curve, count, closed) {
    const ts = [], ps = [];
    const n = closed ? count : count;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      ps.push(curve.getPointAt(Math.min(.999999, t)));
      ts.push(curve.getTangentAt(Math.min(.999999, t)).normalize());
    }
    const normals = [], binormals = [];
    let up = new V3(0, 1, 0);
    if (Math.abs(ts[0].dot(up)) > .95) up = new V3(0, 0, 1);
    let nrm = new V3().crossVectors(ts[0], up).normalize();
    for (let i = 0; i <= n; i++) {
      const t = ts[i];
      // 沿切线方向传播法线（平行传输）：只去掉法线里的切向分量
      nrm.addScaledVector(t, -nrm.dot(t));
      if (nrm.lengthSq() < 1e-10) { const alt = Math.abs(t.x) < .9 ? new V3(1, 0, 0) : new V3(0, 0, 1); nrm.crossVectors(t, alt); }
      nrm.normalize();
      const b = new V3().crossVectors(t, nrm).normalize();
      normals.push(nrm.clone());
      binormals.push(b);
    }
    return {ps, ts, normals, binormals, n};
  }

  // profile: [[u,v],...] 闭合；scaleAt(t)->number 可让截面沿路径渐变（A 柱上宽下窄）
  function sweep(pts, profile, {segments = 24, closedPath = false, caps = true, scaleAt = null, smooth = true} = {}) {
    const curve = new CatmullRomCurve3(pts.map(q => q.isVector3 ? q.clone() : new V3(q[0], q[1], q[2])), closedPath, 'centripetal');
    const {ps, normals, binormals, n} = framesFor(curve, Math.max(2, segments), closedPath);
    const m = profile.length;
    const rings = closedPath ? n : n + 1;
    const pos = [], uv = [], idx = [];
    for (let i = 0; i < rings; i++) {
      const t = i / n;
      const s = scaleAt ? scaleAt(t) : 1;
      const P = ps[i], N = normals[i], B = binormals[i];
      for (let j = 0; j < m; j++) {
        const [u, v] = profile[j];
        pos.push(P.x + (N.x * u + B.x * v) * s, P.y + (N.y * u + B.y * v) * s, P.z + (N.z * u + B.z * v) * s);
        uv.push(j / m, t);
      }
    }
    const ring = (i) => (closedPath ? (i % rings) : i);
    const quad = (a, b, c, d) => { idx.push(a, c, b, b, c, d); };
    for (let i = 0; i < (closedPath ? rings : rings - 1); i++) {
      const i0 = ring(i), i1 = ring(i + 1);
      for (let j = 0; j < m; j++) {
        const j1 = (j + 1) % m;
        quad(i0 * m + j, i1 * m + j, i0 * m + j1, i1 * m + j1);
      }
    }
    if (caps && !closedPath) {
      // 端盖：中心点扇形。首端朝 -T，末端朝 +T
      const capAt = (ringIndex, flip) => {
        const P = ps[ringIndex], N = normals[ringIndex], B = binormals[ringIndex];
        const center = pos.length / 3;
        pos.push(P.x, P.y, P.z); uv.push(.5, .5);
        const start = ringIndex * m;
        for (let j = 0; j < m; j++) {
          const a = start + j, b = start + (j + 1) % m;
          if (flip) idx.push(center, b, a); else idx.push(center, a, b);
        }
      };
      capAt(0, true);
      capAt(rings - 1, false);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return smooth ? creaseNormals(g, 38) : g;
  }

  // 常用型材截面（闭合点列，u=横向 v=厚度），全部按米
  const SECT = {
    // 矩形管
    rect: (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
    // 帽形（白车身纵梁/门槛内板）：两侧翻边 + 顶面
    hat: (w, h, flange = .012, wall = .0016) => {
      const w2 = w / 2 - wall, h2 = h / 2;
      return [
        [-w2 - flange, -h2], [-w2, -h2], [-w2, h2 - wall], [w2, h2 - wall], [w2, -h2],
        [w2 + flange, -h2], [w2 + flange, -h2 + wall], [-w2 - flange, -h2 + wall]
      ];
    },
    // 双帽（门槛加强件，闭口 + 中间隔板感）
    doubleHat: (w, h, flange = .01, wall = .0014) => {
      const w2 = w / 2 - wall, h2 = h / 2;
      return [
        [-w2 - flange, -h2], [-w2, -h2], [-w2, h2 - wall], [w2, h2 - wall], [w2, -h2],
        [w2 + flange, -h2], [w2 + flange, h2], [-w2 - flange, h2]
      ];
    },
    // C 型槽（纵梁 / 座椅滑轨）
    channel: (w, h, wall = .002) => {
      const w2 = w / 2, h2 = h / 2;
      return [
        [-w2, -h2], [w2, -h2], [w2, -h2 + wall], [w2 - wall, -h2 + wall],
        [w2 - wall, h2 - wall], [w2, h2 - wall], [w2, h2], [-w2, h2]
      ];
    },
    // 椭圆管（防撞梁 / 摆臂）
    oval: (w, h, seg = 12) => {
      const out = [];
      for (let i = 0; i < seg; i++) { const a = i / seg * TAU; out.push([Math.cos(a) * w / 2, Math.sin(a) * h / 2]); }
      return out;
    },
    // 六边形（铸造件/挤压件）
    hex: (w, h) => [[-w / 2, -h * .25], [-w * .25, -h / 2], [w * .25, -h / 2], [w / 2, -h * .25], [w / 2, h * .25], [w * .25, h / 2], [-w * .25, h / 2], [-w / 2, h * .25]]
  };

  // ---------- 车削件 ----------
  // points: [[r,y],...] 由下到上；seg 越小越省面。默认按 35° 折角拆硬边。
  // 两端未封口（首尾半径>0）时自动补中心点做端盖：车削件必须是实心的，
  // 否则管口会漏光、有符号体积也偏小（这个问题在 rcyl/波纹管上都被抓到过）。
  function lathe(points, seg = 20, {angle = 35, smooth = false, phiStart = 0, phiLength = TAU, flip = false, caps = null} = {}) {
    let pts = points.map(p => new THREE.Vector2(Math.max(0, p[0]), p[1]));
    const closedProfile = pts.length > 2 && pts[0].distanceTo(pts[pts.length - 1]) < 1e-7;
    const full = phiLength >= TAU - 1e-6;
    if (!closedProfile && caps !== false && full) {
      const head = pts[0], tail = pts[pts.length - 1];
      if (head.x > 1e-6) pts.unshift(new THREE.Vector2(0, head.y));
      if (tail.x > 1e-6) pts.push(new THREE.Vector2(0, tail.y));
    }
    const g = new LatheGeometry(pts, Math.max(3, seg), phiStart, phiLength);
    if (flip) { g.scale(-1, 1, 1); }
    g.computeVertexNormals();
    if (!smooth) return creaseNormals(g, angle);
    return g;
  }

  // 倒角圆柱（机加工台阶轴、活塞、接头）
  function rcyl(r, h, {seg = 18, chamfer = null, bevel = null} = {}) {
    const c = Math.min(chamfer ?? bevel ?? Math.min(r * .18, h * .3), r * .45, h * .45);
    const pts = [];
    pts.push([r - c, -h / 2]);
    pts.push([r, -h / 2 + c]);
    pts.push([r, h / 2 - c]);
    pts.push([r - c, h / 2]);
    return lathe(pts, seg, {angle: 40});
  }

  // 空心管（管口有壁厚，能看进去）
  function tube(rOuter, rInner, h, seg = 18) {
    const pts = [[rInner, -h / 2], [rOuter, -h / 2], [rOuter, h / 2], [rInner, h / 2], [rInner, -h / 2]];
    return lathe(pts, seg, {angle: 30});
  }

  // 波纹管（防尘套 / 线束护套）：半径按正弦起伏
  function bellows(rBase, len, ribs = 5, amp = .18, seg = 16) {
    const pts = [];
    const steps = ribs * 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = -len / 2 + len * t;
      const r = rBase * (1 + amp * Math.sin(t * ribs * TAU));
      pts.push([r, y]);
    }
    return lathe(pts, seg, {angle: 60, smooth: true});
  }

  // ---------- 螺旋 ----------
  // 螺纹段：螺旋三角棱条，低模但轮廓正确（不是贴图假纹）
  function thread(d, len, pitch = .00125, {seg = 30, depth = .0007, smooth = true} = {}) {
    const r = d / 2, turns = Math.max(1, len / pitch);
    const pos = [], idx = [];
    const n = Math.max(6, Math.round(seg));
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = t * turns * TAU;
      const y = -len / 2 + len * t;
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * r, y, sa * r);                      // 牙根
      pos.push(ca * (r + depth), y + pitch * .42, sa * (r + depth)); // 牙顶
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, dd = i * 2 + 3;
      idx.push(a, b, dd, a, dd, c);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // 弹簧（螺旋压缩弹簧，真实线径）
  function spring(rCoil, wire, turns, len, {perTurn = 10, radial = 5} = {}) {
    const pts = [];
    const total = Math.max(8, Math.round(turns * perTurn));
    for (let i = 0; i <= total; i++) {
      const t = i / total, a = t * turns * TAU;
      pts.push(new V3(Math.cos(a) * rCoil, -len / 2 + len * t, Math.sin(a) * rCoil));
    }
    const curve = new CatmullRomCurve3(pts);
    return creaseNormals(new TubeGeometry(curve, total, wire, radial, false), 55);
  }

  // ---------- 曲面钣金件（车门外板/玻璃/翼子板）----------
  // 用"圆角矩形距离场"把规则网格映射成圆角外形，再沿法向鼓起一块（crown），
  // 前后两层 + 一圈边料构成有厚度的板，边缘是真实的折边而不是纸片。
  function curvedPanel(w, h, t, {crownX = .012, crownY = .006, r = .016, segX = 10, segZ = 6} = {}) {
    const hw = w / 2, hh = h / 2;
    const rr = Math.min(r, hw * .9, hh * .9);
    const pos = [], uv = [], idx = [];
    const mapPoint = (u, v) => {
      const x0 = u * hw, y0 = v * hh;
      const qx = clamp(x0, -(hw - rr), hw - rr), qy = clamp(y0, -(hh - rr), hh - rr);
      let dx = x0 - qx, dy = y0 - qy;
      const L = Math.hypot(dx, dy);
      let x = x0, y = y0;
      if (L > 1e-9) { x = qx + dx / L * rr; y = qy + dy / L * rr; }
      const z = crownX * (1 - u * u) + crownY * (1 - v * v);
      return [x, y, z];
    };
    // 前表面
    const front = [], back = [];
    for (let j = 0; j <= segZ; j++) for (let i = 0; i <= segX; i++) {
      const u = -1 + 2 * i / segX, v = -1 + 2 * j / segZ;
      const p = mapPoint(u, v);
      front.push(p);
      back.push([p[0], p[1], p[2] - t]);
    }
    const nf = front.length;
    for (const p of front) { pos.push(p[0], p[1], p[2]); uv.push((p[0] / w) + .5, (p[1] / h) + .5); }
    for (const p of back) { pos.push(p[0], p[1], p[2]); uv.push((p[0] / w) + .5, (p[1] / h) + .5); }
    const gridIdx = (i, j) => j * (segX + 1) + i;
    for (let j = 0; j < segZ; j++) for (let i = 0; i < segX; i++) {
      const a = gridIdx(i, j), b = gridIdx(i + 1, j), c = gridIdx(i, j + 1), d = gridIdx(i + 1, j + 1);
      // 前表面朝 +z
      idx.push(a, b, d, a, d, c);
      // 背面朝 -z
      idx.push(nf + a, nf + d, nf + b, nf + a, nf + c, nf + d);
    }
    // 边料：沿边界一圈把前后两层缝起来。边界必须按 CCW 走一圈（俯视 +z），
    // 否则四条边里有两条会反绕序，折边在背面剔除下直接消失（薄板会"漏边"）。
    const loop = [];
    for (let i = 0; i < segX; i++) loop.push(gridIdx(i, 0));                 // 下边 → +x
    for (let j = 0; j < segZ; j++) loop.push(gridIdx(segX, j));             // 右边 → +y
    for (let i = segX; i > 0; i--) loop.push(gridIdx(i, segZ));             // 上边 → -x
    for (let j = segZ; j > 0; j--) loop.push(gridIdx(0, j));                // 左边 → -y
    for (let k = 0; k < loop.length; k++) {
      const a = loop[k], b = loop[(k + 1) % loop.length];
      idx.push(a, nf + a, nf + b, a, nf + b, b);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return creaseNormals(g, 44);
  }

  // ---------- 焊缝（焊道/胶条）：沿路径的圆角棱条，可有波纹）----------
  function bead(pts, {radius = .0035, segs = 26, waviness = .12} = {}) {
    const curve = new CatmullRomCurve3(pts.map(q => q.isVector3 ? q.clone() : new V3(q[0], q[1], q[2])), false, 'centripetal');
    const total = Math.max(6, segs);
    const frames = framesFor(curve, total, false);
    const m = 6;
    const pos = [], idx = [];
    for (let i = 0; i <= total; i++) {
      const t = i / total;
      const P = frames.ps[i], N = frames.normals[i], B = frames.binormals[i];
      const s = radius * (1 + waviness * Math.sin(t * 46));
      for (let j = 0; j < m; j++) {
        const a = j / m * TAU;
        const u = Math.cos(a) * s, v = Math.sin(a) * s;
        pos.push(P.x + N.x * u + B.x * v, P.y + N.y * u + B.y * v, P.z + N.z * u + B.z * v);
      }
    }
    for (let i = 0; i < total; i++) for (let j = 0; j < m; j++) {
      const j1 = (j + 1) % m;
      const a = i * m + j, b = (i + 1) * m + j, c = i * m + j1, d = (i + 1) * m + j1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // ---------- 线缆 ----------
  function cable(pts, radius = .008, {segs = 40, radial = 7, tension = .5} = {}) {
    const curve = new CatmullRomCurve3(pts.map(q => q.isVector3 ? q.clone() : new V3(q[0], q[1], q[2])), false, 'centripetal', tension);
    return new TubeGeometry(curve, segs, radius, radial, false);
  }

  // ---------- 板缝（凹槽）----------
  // 车体/壳体的分缝：用一条很细的深色凹槽沿路径铺在表面，比贴图抗拉伸，近看仍是几何。
  function seam(pts, {width = .0016, depth = .0009, segs = 24} = {}) {
    const profile = [
      [-width / 2, 0], [-width * .28, -depth], [width * .28, -depth], [width / 2, 0]
    ];
    return sweep(pts, profile, {segments: segs, caps: false, smooth: false});
  }

  // ---------- 阵列/合并 ----------
  function mergeGeos(entries) {
    const list = entries.filter(Boolean).map(e => {
      const g = e.geo || e;
      const m = e.matrix;
      let src = g.index ? g.toNonIndexed() : g;
      if (m) { src = src.clone(); src.applyMatrix4(m); }
      if (!src.attributes.normal) src.computeVertexNormals();
      return src;
    });
    let count = 0;
    for (const g of list) count += g.attributes.position.count;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
    let o = 0;
    for (const g of list) {
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      pos.set(p.array.subarray(0, p.count * 3), o * 3);
      nor.set(n.array.subarray(0, n.count * 3), o * 3);
      if (u) uv.set(u.array.subarray(0, u.count * 2), o * 2);
      o += p.count;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    return g;
  }

  // ---------- 法线：按折角拆硬边，其余平滑 ----------
  // three 自带 computeVertexNormals 只有"全平滑"和"全平直"两档，这里按角度分组。
  function creaseNormals(geo, angleDeg = 35) {
    const src = geo.index ? geo : geo;
    const pos = src.attributes.position;
    const uvA = src.attributes.uv;
    const idx = src.index;
    const triCount = idx ? idx.count / 3 : pos.count / 3;
    const cosLimit = Math.cos(angleDeg * Math.PI / 180);
    const get = (i, out) => { out[0] = pos.getX(i); out[1] = pos.getY(i); out[2] = pos.getZ(i); return out; };
    const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
    const fn = new Float32Array(triCount * 3);
    const triIdx = new Int32Array(triCount * 3);
    const key = (x, y, z) => `${Math.round(x * 2e5)},${Math.round(y * 2e5)},${Math.round(z * 2e5)}`;
    const groups = new Map();
    for (let t = 0; t < triCount; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      triIdx[t * 3] = i0; triIdx[t * 3 + 1] = i1; triIdx[t * 3 + 2] = i2;
      get(i0, a); get(i1, b); get(i2, c);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
      const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      fn[t * 3] = nx; fn[t * 3 + 1] = ny; fn[t * 3 + 2] = nz;
      for (let k = 0; k < 3; k++) {
        const vi = triIdx[t * 3 + k];
        const kk = key(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        let arr = groups.get(kk); if (!arr) groups.set(kk, arr = []);
        arr.push(t * 3 + k);
      }
    }
    const out = new Float32Array(triCount * 9);
    const outUv = new Float32Array(triCount * 6);
    const nrm = new Float32Array(triCount * 9);
    for (let t = 0; t < triCount; t++) {
      for (let k = 0; k < 3; k++) {
        const corner = t * 3 + k, vi = triIdx[corner];
        const nx0 = fn[t * 3], ny0 = fn[t * 3 + 1], nz0 = fn[t * 3 + 2];
        let sx = 0, sy = 0, sz = 0;
        const arr = groups.get(key(pos.getX(vi), pos.getY(vi), pos.getZ(vi)));
        for (const other of arr) {
          const tt = (other / 3) | 0;
          const ox = fn[tt * 3], oy = fn[tt * 3 + 1], oz = fn[tt * 3 + 2];
          if (ox * nx0 + oy * ny0 + oz * nz0 >= cosLimit) { sx += ox; sy += oy; sz += oz; }
        }
        const l = Math.hypot(sx, sy, sz) || 1;
        const w = corner * 3;
        out[w] = pos.getX(vi); out[w + 1] = pos.getY(vi); out[w + 2] = pos.getZ(vi);
        nrm[w] = sx / l; nrm[w + 1] = sy / l; nrm[w + 2] = sz / l;
        const u = corner * 2;
        outUv[u] = uvA ? uvA.getX(vi) : 0; outUv[u + 1] = uvA ? uvA.getY(vi) : 0;
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(out, 3));
    g.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
    g.setAttribute('uv', new Float32BufferAttribute(outUv, 2));
    return g;
  }

  // ---------- 三角面统计（bench 用，也可在运行时自检）----------
  function triCount(geometry) {
    if (!geometry) return 0;
    if (geometry.index) return geometry.index.count / 3;
    const n = geometry.attributes.position ? geometry.attributes.position.count : 0;
    return n / 3;
  }

  // ---------- 贴地接触阴影（程序化，画一次复用）----------
  // 这里只做几何：一个略低于表面的薄片，贴图在 labels.js 里生成。

  return {
    clamp, rbox, cbox, box, chamferBox, flatShade, roundRectPath, extrude, rplate, rplateHoles,
    sweep, SECT, lathe, rcyl, tube, bellows, thread, spring, cable, seam,
    curvedPanel, bead,
    mergeGeos, creaseNormals, triCount, framesFor
  };
}
