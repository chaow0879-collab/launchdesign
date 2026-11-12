// v8 新动画：真车 + 全息工具。每帧只由（工序, 时间 t）决定画面；节拍取自配音里的句内停顿。
import * as THREE from 'three';
import {createCore, camPose, mixCam, clamp, smooth, ease, lerp} from './engine/core.js';
import {loadCar, buildCar} from './engine/car.js';
import {createKit} from './engine/kit.js';
import {createSystems} from './engine/systems.js';
import beatsData from '../data/beats.json';
import {NODES} from './nodes/index.js';

export async function createCarScene({canvas, modelBuffer, onInteract}) {
  const core = createCore(canvas);
  const {scene, camera, composer, controls, renderer} = core;
  const loaded = await loadCar(modelBuffer);
  const car = buildCar(loaded);
  scene.add(car.root);
  const K = createKit(scene);
  K.car = car; K.core = core;
  const S = createSystems(K, car);
  K.sys = S;
  window.__car = car;

  let nodeId = null, node = null, props = null, t = 0, playing = false, autoCam = true, dirty = true;
  let userView = false;
  // 相机接管：拖拽时临时接管，松手 idle 后平滑回位；freeMode（面板"自由视角"）下不回位。
  // OrbitControls 全程 enabled=true（下面任何地方都不关它），所以播放中也能拖转/滚轮缩放。
  let freeMode = false, dragging = false, returnK = 1, idleF = 0;
  controls.addEventListener('start', () => {
    if (freeMode) { dragging = true; returnK = 0; return; }
    if (autoCam) { userView = true; autoCam = false; onInteract?.(); }
    dragging = true; returnK = 0; idleF = 0;
  });
  controls.addEventListener('end', () => { dragging = false; idleF = 0; });

  // ---- 时间工具（c）：按“第 s 句、第 b 个半句”取时间 ----
  function makeCtx(id) {
    const sents = beatsData[id];
    const T = (s, b = 0) => {
      if (s >= sents.length) return sents.at(-1).until;
      const st = sents[s], n = st.beats.length;
      if (b === 'end' || b >= n) return st.end;
      if (b < 0) b = Math.max(0, n + b);
      const i = Math.floor(b), f = b - i, bt = st.beats[i];
      return lerp(bt.t0, bt.t1, f);
    };
    const c = {
      sents, T, t: 0, shot: 0, q: 0, nb: s => sents[s].beats.length,
      // 从 (s0,b0) 到 (s1,b1) 的进度 0..1（缓动）
      p(s0, b0, s1 = s0, b1 = 'end', fn = ease) { const a = T(s0, b0), b = T(s1, b1); return fn(clamp((c.t - a) / Math.max(.05, b - a))); },
      lin(s0, b0, s1 = s0, b1 = 'end') { return c.p(s0, b0, s1, b1, x => x); },
      // 在 (s,b) 处用 d 秒淡入
      in(s, b = 0, d = .6) { const a = T(s, b) - .15; return smooth((c.t - a) / d); },
      // 在 (s,b) 处用 d 秒淡出
      out(s, b = 0, d = .6) { const a = T(s, b) - .2; return 1 - smooth((c.t - a) / d); },
      // 可见区间：在 (s0,b0) 出现，到 (s1,b1) 消失
      show(s0, b0, s1 = 99, b1 = 0, d = .6) { return Math.min(c.in(s0, b0, d), s1 >= 99 ? 1 : c.out(s1, b1, d)); },
      // 一次性脉冲（亮起再回落）
      pulse(s, b = 0, d = 1.2) { const a = T(s, b) - .1; const x = (c.t - a) / d; return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI); },
      after(s, b = 0) { return c.t >= T(s, b) - .15; },
      between(s0, b0, s1, b1) { return c.t >= T(s0, b0) - .15 && c.t < T(s1, b1) - .15; }
    };
    return c;
  }
  let ctx = null;

  function setNode(id) {
    if (id === nodeId) return;
    nodeId = id; node = NODES[id];
    K.clearNode(); K.resetProps();
    ctx = makeCtx(id);
    props = node?.build ? node.build(K, S, car, ctx) : {}; K.lock(); window.__props = props;
    userView = false; autoCam = true; freeMode = false; dragging = false; returnK = 1; dirty = true;
  }

  // ---- 相机：每句一个镜位，句间 0.9 秒 expo-out 过渡；句内 drift/推进 + ≤0.02 的手持感 ----
  const camState = {pos: new THREE.Vector3(), tg: new THREE.Vector3(), fov: 32};
  const expoOut = x => x >= 1 ? 1 : 1 - Math.pow(2, -10 * Math.max(0, x));   // 句间过渡曲线
  const HAND_AMP = .018;                                                       // 手持幅度（世界单位，≤.02）
  // 手持：只由 t 推导（不用 performance.now），暂停/回退不会漂移；两个 ≤0.3Hz 的正弦叠加
  const hand = t => ({
    x: HAND_AMP * (.6 * Math.sin(t * 1.62) + .4 * Math.sin(t * 1.07 + 1.7)),
    y: HAND_AMP * (.6 * Math.sin(t * 1.62 * 1.13 + 2.1) + .4 * Math.sin(t * 1.07 + .4))
  });
  // 工具接触工件的句子（下标 = beats.json 句序，见各节点 update 里的接触时刻）：只在这些镜头加 3% 推进
  const CONTACT = {
    'concept-2': [2],     // 电池包推入地板
    'clay-1': [2, 3],     // 主轴下刀 / 精加工贴面
    'clay-2': [1],        // 刮刀贴合曲面
    'clay-3': [1],        // 扫描光幕扫过表面
    'engineering-1': [4], // 机械臂逐点拧紧
    'engineering-2': [1], // 模组落位 + 螺栓紧固
    'engineering-3': [1], // 插头推入并锁止
    'validation-1': [2],  // 举升台把电池送入车身
    'launch-1': [2]       // 夹具闭合
  };
  function contactBump(tNow, s) {
    if (!(CONTACT[nodeId] || []).includes(s)) return 0;
    const x = (tNow - (ctx.T(s, 0) + .25)) / 1.2;
    return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI);
  }
  function camFor(tNow) {
    const cams = node?.cams || [];
    if (!cams.length) return {tg: [0, .7, 0], r: 8, az: 35, el: 14};
    const sents = ctx.sents;
    let s = 0; for (let i = 0; i < sents.length; i++) if (tNow >= sents[i].start - .35) s = i;
    const spec = k => { const v = cams[Math.min(k, cams.length - 1)]; return Array.isArray(v) ? v : [v]; };
    // 一句里可以有多个镜位关键帧：{b:半句序号, ...}
    const camAt = (k, time) => {
      const keys = spec(k); let cur = keys[0];
      for (let i = 1; i < keys.length; i++) { const ta = ctx.T(k, keys[i].b ?? 0) - .3, w = keys[i].dur ?? .9; if (time >= ta) cur = mixCam(cur, keys[i], ease((time - ta) / w)); }
      const st = sents[k], q = clamp((time - st.start) / Math.max(1, st.until - st.start));
      const drift = cur.drift ?? 6;
      // 句首 fov 冲击：最多 2.2°，0.55 秒内回落
      const imp = Math.max(0, 1 - (time - st.start) / .55);
      return {...cur, fov: (cur.fov ?? 32) + 2.2 * imp * imp, az: (cur.az ?? 35) + drift * (q - .5), r: (cur.r ?? 7) * (1 - .085 * q)};
    };
    let cur = camAt(s, tNow);
    const start = sents[s].start - .35;
    if (s > 0 && tNow < start + .9) cur = mixCam(camAt(s - 1, start), cur, expoOut((tNow - start) / .9));
    if (s === 0) { const k = ease((tNow + .2) / 2.2); cur = {...cur, r: (cur.r ?? 7) * (1 + .18 * (1 - k)), el: (cur.el ?? 14) + 6 * (1 - k)}; }
    const cb = contactBump(tNow, s);
    if (cb > 0) cur = {...cur, r: (cur.r ?? 7) * (1 - .03 * cb)};
    // 手持：相机与目标同时平移，取景关系不变
    const h = hand(tNow), tg = cur.tg || [0, .7, 0];
    cur = {...cur, tg: [tg[0] + h.x, tg[1] + h.y * .6, tg[2] + h.x * .5]};
    return cur;
  }

  // 舞台可用区域：避开右侧工序面板和下方镜头条，让车始终落在空白处
  function frameArea() {
    const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight;
    const r = q => document.querySelector(q)?.getBoundingClientRect();
    const panel = r('#work-panel'), strip = r('#action-overlay'), head = r('header');
    let right = W, bottom = H, top = head ? head.bottom : 0;
    if (panel && panel.width > 0 && panel.left > W * .5) right = panel.left - 12;
    if (strip && strip.height > 0 && strip.top > H * .45) bottom = strip.top - 6;
    const aw = Math.max(200, right - 0), ah = Math.max(160, bottom - top);
    const s = Math.min(aw / W, ah / H) * 1.06;
    const vx = (aw - s * W) / 2, vy = top + (ah - s * H) / 2;
    camera.setViewOffset(s * W, s * H, -vx, -vy, W, H);
  }
  function apply() {
    frameArea();
    if (!node) return;
    ctx.t = t;
    let s = 0; for (let i = 0; i < ctx.sents.length; i++) if (t >= ctx.sents[i].start - .15) s = i;
    ctx.shot = s; ctx.q = clamp((t - ctx.sents[s].start) / Math.max(.5, ctx.sents[s].until - ctx.sents[s].start));
    car.reset(); S.reset(); K.resetProps();
    core.key.position.set(4, 8, 5); core.key.intensity = 1.7; core.key.color.set(0xffffff); core.setGrid(); core.setStrips(); scene.environmentIntensity = .75;
    node.update?.(ctx, props, K, S, car);
    // bloom 只在 core.js 定值一次：节点里 validation.js:73 还留着一句 `bloom.strength = .5`（旧基准 .38 时代的"加亮"），
    // 在 1.05 基准下会变成全片唯一一个变暗的镜头，所以节点更新之后再统一回来。
    core.setBloom();
    car.apply(t); S.apply(t);
    const pose = camPose(camFor(t));
    if (autoCam) {
      camera.position.copy(pose.pos); camera.fov = pose.fov; camera.updateProjectionMatrix();
      controls.target.copy(pose.tg); camera.lookAt(pose.tg);
    } else if (!freeMode) {
      // 松手后先停 1.5s 让用户看，再 0→1 平滑回位（约 1.2s）；回位途中自动运镜仍在更新基准值，是"追着基准回去"
      if (!dragging) { idleF++; if (idleF > 90) returnK = Math.min(1, returnK + 1 / 72); }
      const k = returnK * returnK * (3 - 2 * returnK);
      camera.position.lerp(pose.pos, k);
      controls.target.lerp(pose.tg, k);
      camera.fov += (pose.fov - camera.fov) * k;
      camera.updateProjectionMatrix();
      camera.lookAt(controls.target);
      if (returnK >= 1) { autoCam = true; dirty = true; }
    }
  }

  let raf = 0, lastT = -1;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!autoCam) controls.update();
    if (t !== lastT || dirty || !autoCam || playing) { apply(); lastT = t; dirty = false; }
    composer.render();
  }
  frame();

  return {
    setNode, setTime(id, time) { if (id !== nodeId) setNode(id); t = time; },
    setPlaying(v) { playing = v; },
    setAutoCamera(v) { autoCam = v; freeMode = !v; controls.enabled = true; dragging = false; returnK = v ? 1 : 0; dirty = true; },
    resetView() { autoCam = true; freeMode = false; dragging = false; returnK = 1; userView = false; dirty = true; },
    shotMeta(id, i) { return NODES[id]?.shots?.[i]; },
    getActionInfo() {
      if (!node || !ctx) return null;
      const s = ctx.shot, meta = node.shots?.[s] || {};
      const ph = node.phases || ['准备输入', '开展工作', '形成结果'];
      return {title: meta.title, detail: meta.detail, phases: ph, phaseIndex: Math.min(2, Math.floor(s / 2)), shotIndex: s, shotCount: 6, shotTitle: meta.title, shotDetail: meta.detail};
    },
    renderOnce() { apply(); composer.render(); },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); }
  };
}
