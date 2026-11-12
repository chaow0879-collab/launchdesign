// 车内系统（教学示意，按真车尺寸摆放）：电池包、电驱、热管理、高压线、低压线束与控制器、传感器、
// 座椅与座舱、白车身骨架、悬架、乘员包络。
// 几何来自 v9 部件库（src/v9/parts）：真倒角、分材质、板缝、真螺栓/针脚；flow/线框/光晕这类“科技层”
// 仍用 kit（它们是光效，不是实体）。
//
// 对外契约（26 个工序脚本在用，名字与层级不准改）：
//   S.battery.{g,pack,tray,plate,coolant,modules[12],busbars[2],lid,hvPort,L,Wd,x0,y0}
//   S.cabin.{g,seats[3],dash,wheel,disp} / S.eea.{g,central,zones[4],sensors,screen,loom,branches,sig,trunkSig,fans,reach}
//   S.biw.{g,beams[],joints[]} / S.chassis.{g,parts[4],rack,sub} / S.drive.{g} / S.rear,S.front
//   S.thermal / S.hv / S.occupant / S.show / S.sub / S.reset / S.apply
import * as THREE from 'three';
import {op, COL} from './kit.js';
import {createParts} from '../v9/parts/index.js';

export function createSystems(K, car) {
  const root = K.sysRoot;
  const sys = {}, groups = {};
  const W = (k) => { const g = new THREE.Group(); g.name = k; root.add(g); groups[k] = g; return g; };
  const wc = car.wheelCenters; // [FL(+z), FR(-z), RL(+z), RR(-z)]，前轮 x≈1.48，后轮 x≈-1.39
  const xF = wc[0].x, xR = wc[2].x, track = Math.abs(wc[0].z), wr = car.wheelR;
  const metal = (c, o = {}) => new THREE.MeshStandardMaterial({color: c, metalness: o.m ?? .6, roughness: o.r ?? .35, emissive: o.e ?? 0x000000, emissiveIntensity: o.ei ?? 0, transparent: true});

  // ---------- 部件库 ----------
  // 一次建好工具箱；部件各自带 palette，材质互不共享，op() 的透明度动画不会串台。
  const parts = createParts(THREE, {car});
  // 非索引几何补一条顺序索引：K.growTube 是按索引数量做“生长”的，白车身梁必须能被它驱动
  const growable = (m) => {
    const geo = m && m.geometry;
    if (geo && !geo.index) {
      const n = geo.attributes.position.count;
      const arr = n > 65535 ? new Uint32Array(n) : new Uint16Array(n);
      for (let i = 0; i < n; i++) arr[i] = i;
      geo.setIndex(new THREE.BufferAttribute(arr, 1));
    }
    return m;
  };

  // ---------- 电池包 ----------
  {
    const g = W('battery');
    const L = 2.3, Wd = 1.36, x0 = -.02, y0 = .17;
    // 旧件的托盘底面在 y=.15。新包按“底面 y=0”建模，整体抬到旧高度，包围盒对齐：
    // 旧包 y≈.10~.40 / x≈-1.21~1.21 / z≈±.71，新包抬升后 y≈.15~.39、同宽同长。
    const pack = parts.build('batteryPack', {serial: 'PACK-2418-96S', L, W: Wd});
    const lift = .15;
    for (const c of pack.children.slice()) c.position.y += lift;
    g.add(pack);
    // 旧件模组中心在 y=.29（engineering-2 的落位动画按这个高度写死），新模组对齐到同一高度
    for (const m of pack.modules) m.position.y = y0 + .12;

    // 每个模组保留旧的“顶面能量层”语义：concept/demand/validation 会 op() 它、validation 还会改它的颜色
    for (const m of pack.modules) {
      const top = K.glow(new THREE.BoxGeometry(.30, .004, .26), COL.teal, 1.4, .55);
      top.position.y = .062;
      top.name = 'module-top';
      m.add(top);
      m.userData.top = top;
      m.userData.topCol = top.material.color.clone();
    }

    // 冷却流道：仍是 kit 的发光管（节点用 K.growTube 按进度“铺开”，必须要索引几何）
    const serp = [];
    for (let i = 0; i <= 8; i++) {
      const x = x0 - L / 2 + .12 + i * (L - .24) / 8;
      serp.push([x, .205, i % 2 ? .55 : -.55], [x + .001, .205, i % 2 ? -.55 : .55]);
    }
    const coolant = K.tube(serp, .014, 0x2aa9ff, {glow: true, segs: 220});
    coolant.name = 'coolant-flow';
    pack.add(coolant);

    // 母排能量层：同样保持 kit 发光管（B.busbars.forEach(b => K.growTube(b, ...))）
    const busbars = [.32, -.32].map(z => {
      const b = K.tube([[-1.02, .352, z], [1.02, .352, z]], .012, COL.orange, {glow: true});
      pack.add(b);
      return b;
    });
    // 旧包的高压口是橙色小盒；新件是高压连接器总成（含端子/卡扣/警示带）
    sys.battery = {
      g, pack, tray: pack.tray, plate: pack.coolantPlate, coolant, modules: pack.modules,
      busbars, lid: pack.lid, hvPort: pack.hvConnector, L, Wd, x0, y0,
      frame: pack.tray, gasket: pack.gasket, bms: pack.bms, bolts: pack.lidBolts
    };
  }
  // ---------- 电驱（前后） ----------
  const motor = (x, k) => {
    const g2 = new THREE.Group(); g2.name = 'motor'; g2.position.set(x, wr, 0);
    const unit = parts.build('driveUnit');
    g2.add(unit);
    // 旧件的青色光环（工序里会跟着车轮转）：保留，作为电机端面的能量环。
    // 用低段数环：旧 K.ring 是 8×64 的环（1024 面/个），4 个就 4k，这里 6×28 足够亮且省 3/4。
    const ringGeo = new THREE.TorusGeometry(.155, .008, 6, 28);
    const rings = [-1, 1].map(s => { const r = K.glow(ringGeo, COL.cyan, 2.4, .95); r.position.z = s * .10; g2.add(r); return r; });
    return {
      g: g2, part: unit, housing: unit.housing, inv: unit.inverter, gear: unit.gearbox,
      shafts: unit.shafts, rings, boots: unit.boots, fins: unit.fins
    };
  };
  {
    const g = W('drive');
    sys.rear = motor(xR, 1);
    sys.front = motor(xF, -1);
    sys.front.g.scale.setScalar(.85);
    g.add(sys.rear.g, sys.front.g);
    sys.drive = {g};
  }
  // ---------- 热管理 ----------
  {
    const g = W('thermal');
    const rad = K.holoBox(.06, .34, 1.0, COL.blue, .25, .9); rad.position.set(2.08, .48, 0); g.add(rad);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .1, 16), metal(0x5fb7ff, {e: 0x2a7fff, ei: .5})); pump.position.set(1.85, .4, -.25); g.add(pump);
    const loopPts = [[2.05, .45, .3], [1.75, .42, .3], [1.5, .4, .15], [1.2, .26, .3], [0, .24, .45], [-1.15, .26, .3], [-1.39, .4, .1], [-1.2, .3, -.35], [0, .24, -.5], [1.2, .26, -.35], [1.85, .4, -.25], [2.05, .45, -.3]];
    const pipe = K.tube(loopPts, .017, 0x3da0ff, {segs: 200}); g.add(pipe);
    const cold = K.flow(loopPts, {color: COL.cyan, n: 46, size: 5, speed: .12}); g.add(cold);
    const hvac = K.holoBox(.32, .22, .7, COL.teal, .12, .8); hvac.position.set(1.15, .78, 0); g.add(hvac);
    const cabinAir = K.flow([[1.05, .82, .3], [.7, .95, .4], [.1, 1.0, .4], [-.6, .95, .35]], {color: COL.teal, n: 20, size: 4.5, speed: .18}); g.add(cabinAir);
    const cabinAir2 = K.flow([[1.05, .82, -.3], [.7, .95, -.4], [.1, 1.0, -.4], [-.6, .95, -.35]], {color: COL.teal, n: 20, size: 4.5, speed: .18}); g.add(cabinAir2);
    sys.thermal = {g, rad, pump, pipe, cold, hvac, cabinAir, cabinAir2, loopPts};
  }
  // ---------- 高压线 ----------
  {
    const g = W('hv');
    const a = K.tube([[1.18, .27, .2], [1.32, .4, .22], [1.42, .58, .12]], .022, COL.orange, {glow: true});
    const b = K.tube([[-1.17, .27, -.2], [-1.3, .42, -.22], [-1.39, .58, -.1]], .022, COL.orange, {glow: true});
    const fa = K.flow([[1.18, .27, .2], [1.32, .4, .22], [1.42, .58, .12]], {color: COL.amber, n: 10, size: 6, speed: .7});
    const fb = K.flow([[-1.17, .27, -.2], [-1.3, .42, -.22], [-1.39, .58, -.1]], {color: COL.amber, n: 10, size: 6, speed: .7});
    g.add(a, b, fa, fb); sys.hv = {g, cables: [a, b], flows: [fa, fb]};
  }
  // ---------- 电子电气：中央计算 + 区域控制器 + 线束 + 传感器 ----------
  {
    const g = W('eea');
    // 旧件是“盒子 + 一条发光条”；新件是带散热鳍片、两排真针脚、密封胶条与铭牌的控制器。
    // 中央域控用全细节，四个区域控制器用 lod='lo'（远景、数量多）。
    const ecu = (p, s = 1, c = COL.cyan, lod = null) => {
      const n = new THREE.Group(); n.position.set(...p);
      const unit = parts.build('ecu', lod === 'lo' ? {lod: 'lo'} : {});
      unit.scale.setScalar(s * .9);   // 旧盒 160×60×120mm，新件 180×120×40mm，缩到与旧包围盒一致
      n.add(unit);
      n.userData.unit = unit;
      n.userData.accent = c;
      if (unit.leds && unit.leds[0]) unit.leds[0].material.color.set(c).multiplyScalar(2.2);
      g.add(n); return n;
    };
    const central = ecu([.35, .5, 0], 1.6, COL.violet);
    const zones = [ecu([1.7, .62, .4], 1, COL.cyan, 'lo'), ecu([1.7, .62, -.4], 1, COL.cyan, 'lo'), ecu([-1.75, .66, .35], 1, COL.cyan, 'lo'), ecu([-1.75, .66, -.35], 1, COL.cyan, 'lo')];
    const P = {
      camF: [.95, 1.15, 0], radarF: [2.32, .47, 0], radarFL: [2.12, .5, .72], radarFR: [2.12, .5, -.72], radarRL: [-2.18, .52, .72], radarRR: [-2.18, .52, -.72],
      camL: [.15, .98, .93], camR: [.15, .98, -.93], camB: [-2.27, .86, 0], lidar: [.72, 1.36, 0], antenna: [-.85, 1.4, 0], screen: [.72, .98, 0]
    };
    const sensors = {};
    for (const [k, p] of Object.entries(P)) { if (k === 'screen') continue; const s = new THREE.Mesh(new THREE.SphereGeometry(k === 'lidar' ? .05 : .035, 16, 12), new THREE.MeshStandardMaterial({color: 0x101820, emissive: k.startsWith('radar') ? COL.amber : COL.cyan, emissiveIntensity: 1.2, transparent: true})); s.position.set(...p); g.add(s); sensors[k] = s; }
    const screen = K.panel(.36, .16, COL.cyan, .3); screen.position.set(...P.screen); screen.rotation.y = Math.PI / 2; screen.rotation.x = 0; screen.rotation.z = 0; g.add(screen); screen.rotateX(-.35);
    // 线束：主干环 + 支路
    const trunk = [[1.7, .62, .4], [1.2, .48, .62], [0, .42, .66], [-1.2, .48, .62], [-1.75, .66, .35], [-1.75, .66, -.35], [-1.2, .48, -.62], [0, .42, -.66], [1.2, .48, -.62], [1.7, .62, -.4]];
    const loom = K.tube(trunk, .016, 0x2bc3ff, {glow: true, segs: 220}); g.add(loom);
    const br = (a, b, mid) => { const pts = mid ? [a, mid, b] : [a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + .05, (a[2] + b[2]) / 2], b]; const t = K.tube(pts, .008, 0x2bc3ff, {glow: true, segs: 40}); g.add(t); return {t, pts}; };
    const branches = [
      br([1.7, .62, .4], P.radarFL), br([1.7, .62, -.4], P.radarFR), br([1.7, .62, .4], P.radarF, [2.1, .55, .2]),
      br([.35, .5, 0], P.camF, [.8, .9, .05]), br([.35, .5, 0], P.screen, [.6, .7, 0]), br([0, .42, .66], P.camL, [.1, .7, .85]), br([0, .42, -.66], P.camR, [.1, .7, -.85]),
      br([-1.75, .66, .35], P.radarRL), br([-1.75, .66, -.35], P.radarRR), br([-1.75, .66, .35], P.camB, [-2.1, .78, .1]),
      br([.35, .5, 0], [0, .42, .66]), br([.35, .5, 0], [0, .42, -.66]), br([.35, .5, 0], P.lidar, [.6, 1.1, 0])
    ];
    const sig = branches.map(b => K.flow(b.pts, {color: COL.cyan, n: 6, size: 4.5, speed: .9}));
    sig.forEach(f => g.add(f));
    const trunkSig = K.flow(trunk, {color: COL.cyan, n: 30, size: 4, speed: .2}); g.add(trunkSig);
    // 探测扇区
    const fans = {};
    const fan = (k, r, ang, rotY, col = COL.cyan) => { const f = K.fan(r, ang, col, .14); f.rotation.x = -Math.PI / 2; f.rotation.z = rotY; f.position.set(P[k][0], P[k][1] - .02, P[k][2]); g.add(f); fans[k] = f; };
    fan('camF', 7, .9, 0); fan('radarF', 9, .35, 0, COL.amber); fan('radarFL', 3.2, 1.6, .9, COL.amber); fan('radarFR', 3.2, 1.6, -.9, COL.amber); fan('radarRL', 3.2, 1.6, 2.3, COL.amber); fan('radarRR', 3.2, 1.6, -2.3, COL.amber); fan('camB', 3.5, 1.4, Math.PI);
    sys.eea = {g, central, zones, sensors, screen, loom, branches, sig, trunkSig, fans, P, trunk};
  }
  // ---------- 座舱：座椅、方向盘、仪表板 ----------
  {
    const g = W('cabin');
    // 座椅：旧件 3 个（前两张桶椅 + 后排一张连体），原点在安装面 y=.36，包围盒 .36~1.18m。
    // 新座椅按地面 y=0 建模、总高 .875m，等比缩到 .937 后正好落在旧包围盒里。
    const seat = (x, z, wide = false) => {
      const s = parts.build('seat');
      s.position.set(x, .36, z);
      s.scale.setScalar(.937);
      if (wide) s.scale.z = .937 * 1.95;         // 后排：旧件是 1.25m 连体坐垫
      g.add(s); return s;                        // 部件库与旧件同向（靠背在 -x、面朝车头 +x），不需要旋转
    };
    const seats = [seat(.08, .37), seat(.08, -.37), seat(-.86, 0, true)];
    // 仪表板：旧件是一整块圆角盒；这里拆成上本体 + 下部软质护板 + 出风口 + 屏幕边框（分材质，不再是单色块）
    const dash = new THREE.Group(); dash.name = 'dash'; g.add(dash);
    const dashMain = K.solid(K.rbox(.32, .15, 1.36, .05), 0x2c3640, {tier: 'shell'}); dashMain.position.set(.88, .79, 0); dash.add(dashMain);
    const dashLower = K.solid(K.rbox(.26, .10, 1.28, .04), 0x1b2329, {tier: 'plastic'}); dashLower.position.set(.84, .70, 0); dash.add(dashLower);
    for (const s of [-1, 1]) {
      const vent = K.solid(K.rbox(.03, .045, .18, .012), 0x11161a, {tier: 'rubber'}); vent.position.set(.86, .80, s * .42); dash.add(vent);
      for (let i = 0; i < 3; i++) { const slat = K.solid(new THREE.BoxGeometry(.02, .004, .16), 0x39434b, {tier: 'machined'}); slat.position.set(.855, .785 + i * .014, s * .42); dash.add(slat); }
    }
    const dashTrim = K.solid(K.rbox(.012, .012, 1.24, .004), 0x8f9aa3, {tier: 'machined', edge: .3}); dashTrim.position.set(1.03, .84, 0); dash.add(dashTrim);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(.17, .02, 10, 40), metal(0x1d252c, {m: .2, r: .5})); wheel.position.set(.55, .9, -.37); wheel.rotation.y = Math.PI / 2; g.add(wheel); wheel.rotation.set(0, Math.PI / 2, 0); wheel.rotateX(-.35);
    const disp = K.panel(.24, .15, COL.cyan, .35); disp.position.set(.82, .98, 0); disp.rotation.set(0, Math.PI / 2, 0); disp.rotateX(-.3); g.add(disp);
    sys.cabin = {g, seats, dash, wheel, disp};
  }
  // ---------- 白车身骨架 ----------
  {
    const g = W('biw');
    // 旧件是 27 根 kit 圆管；新件是 41 根按真实冲压截面扫掠的梁（帽形/C 型槽/矩形/椭圆管）：
    // 门槛、A/B/C 柱、顶边梁、前后纵梁、地板横梁、顶盖横梁、门洞框、铰链柱、后轮罩、减震塔撑杆、防撞梁。
    const bp = parts.build('biw', {car});
    g.add(bp);
    const beams = bp.beams.slice();
    beams.forEach(growable);          // 工序用 K.growTube 沿梁“画出来”，需要索引
    // 焊点：旧件按每根梁两端各一个；新件沿用同一规则（取每根梁的路径端点），取前 24 根避免糊成一片
    const joints = [];
    const jgeo = new THREE.SphereGeometry(.03, 6, 4);
    for (let i = 0; i < Math.min(beams.length, 24); i++) {
      const path = beams[i].userData.path;
      if (!path) continue;
      for (const p of [path[0], path[path.length - 1]]) {
        const j = K.glow(jgeo, COL.amber, 2.6, .95);
        j.position.set(p[0], p[1], p[2]);
        g.add(j); joints.push(j);
      }
    }
    sys.biw = {g, beams, joints, part: bp, towers: bp.towers, firewall: bp.firewall, floorPan: bp.floorPan};
  }
  // ---------- 悬架 / 制动 / 转向 ----------
  {
    const g = W('chassis');
    // 每个角总成带弹簧、减振器、下摆臂、转向节、通风盘、卡钳；工序会直接推 spring/knuckle/disc 的位置。
    const partsList = wc.map((c, i) => {
      const isRear = i >= 2;
      const s = parts.build('suspension', isRear ? {} : {lod: 'lo'});
      s.position.set(c.x, c.y, c.z);
      s.rotation.y = c.z < 0 ? Math.PI : 0;   // -z 侧镜像到车外
      s.userData.corner = i;
      g.add(s);
      return Object.assign(s, {armL: s.arm});   // 旧字段名兼容
    });
    const rack = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 1.0, 12), metal(0x9fb0bd)); rack.rotation.x = Math.PI / 2; rack.position.set(xF - .15, .38, 0); g.add(rack);
    const sub = K.tube([[xF + .2, .3, .45], [xF - .3, .28, .45], [xF - .3, .28, -.45], [xF + .2, .3, -.45]], .025, 0x7d8e9b, {segs: 40, metal: .7}); g.add(sub);
    sys.chassis = {g, parts: partsList, rack, sub};
  }
  // ---------- 乘员包络（抽象测量假人，只用于空间检查） ----------
  {
    const g = W('occupant');
    const mk = (x, z) => {
      const o = new THREE.Group(); o.position.set(x, .36, z);
      const mat = () => new THREE.MeshBasicMaterial({color: COL.teal, transparent: true, opacity: .16, depthWrite: false, blending: THREE.AdditiveBlending});
      const cap = (r, len, p, rz) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat()); m.position.set(...p); m.rotation.z = rz; o.add(m); const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 25), new THREE.LineBasicMaterial({color: new THREE.Color(COL.teal).multiplyScalar(1.6), transparent: true, opacity: .45, toneMapped: false, depthWrite: false})); e.position.copy(m.position); e.rotation.copy(m.rotation); o.add(e); return m; };
      cap(.13, .34, [-.12, .42, 0], .2); // 躯干
      const head = new THREE.Mesh(new THREE.SphereGeometry(.105, 20, 14), mat()); head.position.set(-.2, .8, 0); o.add(head);
      cap(.075, .36, [.12, .12, 0], Math.PI / 2 - .1); // 大腿
      cap(.06, .36, [.38, -.1, 0], .35); // 小腿
      const clearance = K.ring(.15, COL.green, .006); clearance.position.set(-.2, .8, 0); clearance.rotation.x = Math.PI / 2; o.add(clearance);
      o.userData.head = head; o.userData.clear = clearance; g.add(o); return o;
    };
    sys.occupant = {g, front: mk(.1, -.37), front2: mk(.1, .37), rear: mk(-.82, -.37)};
  }

  // 记录所有子件初始位姿，便于每帧复位
  const inits = [];
  root.traverse(o => inits.push([o, o.position.clone(), o.rotation.clone(), o.scale.clone()]));
  const vis = {}, subs = [], groupSet = new Set(Object.values(groups));
  for (const [k, g] of Object.entries(groups)) g.traverse(o => o.userData.sysKey = k);
  Object.keys(groups).forEach(k => { vis[k] = 0; op(groups[k], 0); });
  return Object.assign(sys, {
    groups,
    partsLib: parts,
    reset() { sys.battery.modules.forEach(m => m.userData.top.material.color.copy(m.userData.topCol)); for (const [o, p, r, s] of inits) { o.position.copy(p); o.rotation.copy(r); o.scale.copy(s); if (o !== root && !groupSet.has(o)) o.visible = true; } Object.keys(vis).forEach(k => vis[k] = 0); subs.length = 0; Object.values(sys.eea.fans).forEach(f => subs.push([f, 0])); },
    // 单独调某个子件的透明度（乘以所在系统的透明度）
    sub(obj, o) { subs.push([obj, o]); },
    show(k, o) { vis[k] = Math.max(vis[k], o); },
    apply(t) {
      for (const k of Object.keys(groups)) op(groups[k], vis[k]);
      for (const [obj, o] of subs) { const k = obj.userData.sysKey; const v = (vis[k] ?? 1) * o; op(obj, v); }
      // 默认的流动（随时间 t 平滑运动）
      if (vis.thermal) { sys.thermal.cold.userData.update(t, sys.thermal.reach ?? 1); sys.thermal.cabinAir.userData.update(t, sys.thermal.air ?? 0); sys.thermal.cabinAir2.userData.update(t, sys.thermal.air ?? 0); }
      if (vis.hv) sys.hv.flows.forEach(f => f.userData.update(t, sys.hv.reach ?? 1));
      if (vis.eea) { sys.eea.sig.forEach((f, i) => f.userData.update(t + i * .13, sys.eea.reach ?? 1)); sys.eea.trunkSig.userData.update(t, sys.eea.reach ?? 1); Object.values(sys.eea.fans).forEach(f => { f.material.uniforms.uT.value = t; }); }
      sys.thermal.reach = undefined; sys.thermal.air = undefined; sys.hv.reach = undefined; sys.eea.reach = undefined;
    }
  });
}
