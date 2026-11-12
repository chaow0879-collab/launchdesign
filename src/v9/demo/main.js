// =====================================================================
// demo/main.js —— 浏览器入口：6 个镜头按钮 + 进度条 + 逐帧 stateAt(t)
// 时钟只用来推进播放头；画面完全由 stateAt(t) 决定，拖动进度条可逐帧复现。
// URL 参数：?shot=0&t=6.5&ui=0&speed=1
// =====================================================================
import {createStage, buildShotStage, applyStates, frameCamera} from './bind-three.js';
import {getShot, SHOT_COUNT, SHOT_META} from './engineering-2.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('view');
const stage = createStage(canvas);

const ui = params.get('ui') !== '0';
if (!ui) document.body.classList.add('no-ui');

const el = {
  tabs: document.getElementById('tabs'),
  name: document.getElementById('shot-name'),
  detail: document.getElementById('shot-detail'),
  time: document.getElementById('time'),
  contact: document.getElementById('contacts'),
  flows: document.getElementById('flows'),
  scrub: document.getElementById('scrub'),
  play: document.getElementById('play')
};

let index = Math.min(SHOT_COUNT - 1, Math.max(0, Number(params.get('shot') ?? 0) || 0));
let t = params.get('t') != null ? Math.max(0, Number(params.get('t')) || 0) : 0;
let playing = params.get('t') == null;
let speed = Number(params.get('speed') ?? 1) || 1;
let shot = null;
let rig = null;
let lastContactKey = '';

function buildTabs() {
  if (!el.tabs) return;
  SHOT_META.forEach((m, i) => {
    const b = document.createElement('button');
    b.textContent = `${i + 1} ${m.title}`;
    b.addEventListener('click', () => load(i));
    el.tabs.appendChild(b);
  });
}

function load(i) {
  index = ((i % SHOT_COUNT) + SHOT_COUNT) % SHOT_COUNT;
  shot = getShot(index);
  if (rig) rig.dispose();
  rig = buildShotStage(stage, shot);
  frameCamera(stage, shot.camera);
  t = 0;
  if (el.scrub) { el.scrub.max = String(shot.timeline.duration); el.scrub.value = '0'; }
  if (el.name) el.name.textContent = `engineering-2 · ${shot.title}`;
  if (el.detail) el.detail.textContent = shot.detail;
  if (el.tabs) [...el.tabs.children].forEach((b, k) => b.classList.toggle('on', k === index));
  lastContactKey = '';
  update();
}

// 接触/流动面板：每 ~0.08 s 刷新一次，避免每帧重建 DOM
function refreshPanel(states) {
  const contacts = [];
  const flows = [];
  for (const [id, st] of Object.entries(states)) {
    if (st.opacity < 0.25) continue;
    if (st.contact && st.contact.hit) contacts.push(`${id} → ${st.contact.other}`);
    if (st.flow && st.flow.active) flows.push(`${id}  u=${st.flow.u.toFixed(2)}  reach=${st.flow.reach.toFixed(2)}`);
  }
  const key = contacts.join('|') + '#' + flows.length;
  if (key === lastContactKey) return;
  lastContactKey = key;
  if (el.contact) el.contact.innerHTML = contacts.length
    ? contacts.map((c) => `<li>${c}</li>`).join('')
    : '<li class="dim">（本时刻没有正在贴面的对象）</li>';
  if (el.flows) el.flows.innerHTML = flows.length
    ? flows.map((c) => `<li>${c}</li>`).join('')
    : '<li class="dim">（本时刻没有流动）</li>';
}

function update() {
  if (!shot) return;
  const states = shot.timeline.stateAt(t);
  applyStates(rig, states);
  stage.controls.update();
  stage.renderer.render(stage.scene, stage.camera);
  if (el.time) el.time.textContent = `${t.toFixed(2)} / ${shot.timeline.duration.toFixed(2)} s`;
  if (el.scrub && document.activeElement !== el.scrub) el.scrub.value = String(t);
  if (el.play) el.play.textContent = playing ? '暂停' : '播放';
  refreshPanel(states);
}

let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
  last = now;
  if (playing && shot) {
    t += dt * speed;
    if (t > shot.timeline.duration) t = 0;
  }
  update();
}

/* ------------------------------ 交互 ------------------------------ */
if (el.scrub) {
  el.scrub.addEventListener('input', () => { playing = false; t = Number(el.scrub.value); update(); });
}
if (el.play) {
  el.play.addEventListener('click', () => { playing = !playing; update(); });
}
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); playing = !playing; }
  else if (e.code === 'ArrowRight') load(index + 1);
  else if (e.code === 'ArrowLeft') load(index - 1);
});

buildTabs();
load(index);
if (params.get('t') != null) { t = Math.max(0, Number(params.get('t')) || 0); playing = false; update(); }

// 供截图/调试脚本用
window.__demo = {
  seek(i, sec) { if (i !== index) load(i); t = Math.max(0, sec); playing = false; update(); },
  pause() { playing = false; update(); },
  play() { playing = true; },
  stateAt(sec) { return shot.timeline.stateAt(sec); },
  get shot() { return shot; }
};
window.__ready = true;
requestAnimationFrame(frame);
