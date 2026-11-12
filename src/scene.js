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
  controls.addEventListener('start', () => { if (!autoCam) return; userView = true; autoCam = false; onInteract?.(); });

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
    userView = false; autoCam = true; dirty = true;
  }

  // ---- 相机：每句一个镜位，句首 1.4 秒平滑过渡，句内缓慢推移 ----
  const camState = {pos: new THREE.Vector3(), tg: new THREE.Vector3(), fov: 32};
  function camFor(tNow) {
    const cams = node?.cams || [];
    if (!cams.length) return {tg: [0, .7, 0], r: 8, az: 35, el: 14};
    const sents = ctx.sents;
    let s = 0; for (let i = 0; i < sents.length; i++) if (tNow >= sents[i].start - .35) s = i;
    const spec = k => { const v = cams[Math.min(k, cams.length - 1)]; return Array.isArray(v) ? v : [v]; };
    // 一句里可以有多个镜位关键帧：{b:半句序号, ...}
    const camAt = (k, time) => {
      const keys = spec(k); let cur = keys[0];
      for (let i = 1; i < keys.length; i++) { const ta = ctx.T(k, keys[i].b ?? 0) - .3, w = keys[i].dur ?? 1.6; if (time >= ta) cur = mixCam(cur, keys[i], ease((time - ta) / w)); }
      const st = sents[k], q = clamp((time - st.start) / Math.max(1, st.until - st.start));
      const drift = cur.drift ?? 4;
      return {...cur, az: (cur.az ?? 35) + drift * (q - .5), r: (cur.r ?? 7) * (1 - .035 * q)};
    };
    let cur = camAt(s, tNow);
    const start = sents[s].start - .35;
    if (s > 0 && tNow < start + 1.6) cur = mixCam(camAt(s - 1, start), cur, ease((tNow - start) / 1.6));
    if (s === 0) { const k = ease((tNow + .2) / 2.2); cur = {...cur, r: (cur.r ?? 7) * (1 + .18 * (1 - k)), el: (cur.el ?? 14) + 6 * (1 - k)}; }
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
    core.key.position.set(4, 8, 5); core.key.intensity = 1.7; core.key.color.set(0xffffff); core.grid.material.uniforms.uOpacity.value = .55; core.bloom.strength = .38; scene.environmentIntensity = .75;
    node.update?.(ctx, props, K, S, car);
    car.apply(t); S.apply(t);
    if (autoCam) {
      const pose = camPose(camFor(t));
      camera.position.copy(pose.pos); camera.fov = pose.fov; camera.updateProjectionMatrix();
      controls.target.copy(pose.tg); camera.lookAt(pose.tg);
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
    setAutoCamera(v) { autoCam = v; controls.enabled = true; dirty = true; },
    resetView() { autoCam = true; userView = false; dirty = true; },
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
