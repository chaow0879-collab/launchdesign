#!/usr/bin/env node
// =====================================================================
// demo/render-filmstrip.mjs —— 不用浏览器，直接把时间轴采样渲染成 PNG 胶片条
//
//   node src/v9/demo/render-filmstrip.mjs
//
// 为什么不用浏览器截图：本机沙箱禁止 Chrome 起子进程的命名管道（mojo EPERM）。
// 这里自写一个极小的正交投影光栅器 + 内置 PNG 编码（node:zlib），
// 只吃 stateAt(t) 的位置/旋转/透明度，所以图和 verify 的数字同源。
//
// 输出：
//   src/v9/demo/out/filmstrip-<shot>.png   每个镜头 6 帧
//   src/v9/demo/out/filmstrip-all.png      6 镜 × 6 帧总表
// =====================================================================
import {deflateSync} from 'node:zlib';
import {writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {getShot, SHOT_COUNT, unitsById} from './engineering-2.js';
import {samplePath} from '../timeline.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
mkdirSync(OUT, {recursive: true});

/* ------------------------------ 画布 ------------------------------ */
function makeCanvas(w, h) {
  const buf = new Float32Array(w * h * 3);
  // 竖向渐变底色
  for (let y = 0; y < h; y++) {
    const k = y / Math.max(1, h - 1);
    const r = 10 - 6 * k, g = 18 - 10 * k, b = 28 - 14 * k;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      buf[i] = r / 255; buf[i + 1] = g / 255; buf[i + 2] = b / 255;
    }
  }
  return {w, h, buf};
}

function blendPx(c, x, y, r, g, b, a) {
  if (a <= 0.002 || x < 0 || y < 0 || x >= c.w || y >= c.h) return;
  if (a > 1) a = 1;
  const i = (y * c.w + x) * 3;
  c.buf[i] += (r - c.buf[i]) * a;
  c.buf[i + 1] += (g - c.buf[i + 1]) * a;
  c.buf[i + 2] += (b - c.buf[i + 2]) * a;
}

// 凸四边形填充（点在多边形内 + bbox）
function fillQuad(c, q, r, g, b, a) {
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const p of q) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  minX = Math.max(0, Math.floor(minX)); maxX = Math.min(c.w - 1, Math.ceil(maxX));
  minY = Math.max(0, Math.floor(minY)); maxY = Math.min(c.h - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let inside = true, sign = 0;
      for (let i = 0; i < 4; i++) {
        const p0 = q[i], p1 = q[(i + 1) % 4];
        const cr = (p1.x - p0.x) * (y + 0.5 - p0.y) - (p1.y - p0.y) * (x + 0.5 - p0.x);
        const s = Math.sign(cr);
        if (s !== 0) { if (sign === 0) sign = s; else if (s !== sign) { inside = false; break; } }
      }
      if (inside) blendPx(c, x, y, r, g, b, a);
    }
  }
}

function strokeLine(c, x0, y0, x1, y1, r, g, b, a, width = 1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.4) + 1;
  for (let i = 0; i <= n; i++) {
    const k = i / n, x = x0 + (x1 - x0) * k, y = y0 + (y1 - y0) * k;
    const px = Math.round(x), py = Math.round(y);
    const half = Math.floor(width / 2);
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) blendPx(c, px + dx, py + dy, r, g, b, a);
  }
}

/* -------------------------- 3×5 数字字模 -------------------------- */
const FONT = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '.': ['000', '000', '000', '000', '010'],
  's': ['000', '011', '010', '010', '011'],
  '-': ['000', '000', '111', '000', '000'],
  'F': ['111', '100', '110', '100', '100'],
  'R': ['110', '101', '110', '101', '101'],
  'A': ['111', '101', '111', '101', '101'],
  'M': ['101', '111', '111', '101', '101'],
  'E': ['111', '100', '110', '100', '111'],
  'T': ['111', '010', '010', '010', '010'],
  'I': ['111', '010', '010', '010', '111'],
  'L': ['100', '100', '100', '100', '111'],
  'N': ['101', '111', '111', '101', '101'],
  'G': ['111', '100', '101', '101', '111'],
  '2': ['111', '001', '111', '100', '111'],
  ' ': ['000', '000', '000', '000', '000']
};
function drawText(c, text, x, y, scale, r, g, b, a) {
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const glyph = FONT[ch] || FONT[' '];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        if (glyph[row][col] === '1') {
          for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
            blendPx(c, cx + col * scale + dx, y + row * scale + dy, r, g, b, a);
          }
        }
      }
    }
    cx += 4 * scale;
  }
}

/* ---------------------------- 投影 ---------------------------- */
function makeCam(cellW, cellH, spec) {
  const az = (spec.az ?? 36) * Math.PI / 180;
  const el = (spec.el ?? 18) * Math.PI / 180;
  const tg = spec.tg || [0, 0.55, 0];
  const scale = cellH / ((spec.r ?? 6) * 0.42);
  const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  return {
    cx: cellW * 0.5, cy: cellH * 0.55, scale,
    project(p) {
      const dx = p.x - tg[0], dy = p.y - tg[1], dz = p.z - tg[2];
      const X = dx * ca - dz * sa;
      const Z = dx * sa + dz * ca;
      const Y = dy * ce - Z * se;
      const D = dy * se + Z * ce;
      return {x: this.cx + X * this.scale, y: this.cy - Y * this.scale, d: D};
    }
  };
}

/* ---------------------------- 几何 ---------------------------- */
const ROT = (p, rot) => {
  // 与 bind-three 一致：THREE 的 XYZ 欧拉 = 先绕 X，再绕 Y，再绕 Z（对向量右乘）
  let {x, y, z} = p;
  const cx = Math.cos(rot.x), sx = Math.sin(rot.x);
  const cy = Math.cos(rot.y), sy = Math.sin(rot.y);
  const cz = Math.cos(rot.z), sz = Math.sin(rot.z);
  let y1 = y * cx - z * sx, z1 = y * sx + z * cx;
  let x1 = x * cy + z1 * sy, z2 = -x * sy + z1 * cy;
  let x2 = x1 * cz - y1 * sz, y2 = x1 * sz + y1 * cz;
  return {x: x2, y: y2, z: z2};
};

const BOX_FACES = [
  [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [4, 5, 1, 0], [3, 2, 6, 7]
];

function boxCorners(size) {
  const [w, h, d] = size;
  const hs = [w / 2, h / 2, d / 2];
  const out = [];
  for (let i = 0; i < 8; i++) {
    out.push({
      x: (i & 1 ? 1 : -1) * hs[0],
      y: (i & 2 ? 1 : -1) * hs[1],
      z: (i & 4 ? 1 : -1) * hs[2]
    });
  }
  return out;
}

function unitSize(unit) {
  if (unit.size) return unit.size;
  const d = (unit.r ?? 0.05) * 2;
  if (unit.kind === 'cyl') return unit.axis === 'z' ? [d, d, unit.h ?? .1] : unit.axis === 'x' ? [unit.h ?? .1, d, d] : [d, unit.h ?? .1, d];
  if (unit.kind === 'hex') return [d, unit.h ?? .05, d];
  if (unit.kind === 'sphere') return [d, d, d];
  if (unit.kind === 'torus') return [d, d, 0.03];
  return [d, d, d];
}

/* ---------------------------- 画一帧 ---------------------------- */
function drawFrame(c, ox, oy, cw, ch, shot, states, t) {
  const cam = makeCam(cw, ch, shot.camera);
  const units = unitsById(shot);
  const prims = [];

  for (const unit of shot.units) {
    const st = states[unit.id];
    if (!st || st.opacity <= 0.01) continue;
    if (unit.id === 'ground') continue;          // 大地面会把小物件全盖住，胶片条里不画
    const par = unit.parent ? states[unit.parent].pos : {x: 0, y: 0, z: 0};
    const base = {x: par.x + st.pos.x, y: par.y + st.pos.y, z: par.z + st.pos.z};
    const color = hexRgb(unit.color ?? 0x9fb3c2, unit.alpha ?? 1) ;
    const alpha = st.opacity * (unit.kind === 'dots' ? 1 : 0.92);

    if (unit.kind === 'tube' || unit.kind === 'line') {
      const pts = (unit.path || []).map((p) => ({x: base.x + p[0], y: base.y + p[1], z: base.z + p[2]}));
      const reach = st.flow.active ? st.flow.reach : 1;
      prims.push({type: 'path', pts, color, alpha: alpha * (unit.kind === 'line' ? 0.9 : 0.8), width: unit.kind === 'line' ? 1 : 2, reach, depth: 0});
      continue;
    }
    if (unit.kind === 'dots' || unit.kind === 'marker') {
      const pts = unit.path || [];
      const n = unit.kind === 'marker' ? 1 : (unit.n ?? 12);
      const u0 = st.flow.active ? st.flow.u : 0;
      const reach = st.flow.active ? st.flow.reach : 0;
      const out = [];
      for (let i = 0; i < n; i++) {
        const s = unit.kind === 'marker' ? (u0 + (unit.offset ?? 0)) % 1 : (u0 + i / n) % 1;
        if (unit.kind !== 'marker' && s > reach) continue;
        const p = samplePath(pts, s);
        out.push({x: base.x + p.x, y: base.y + p.y, z: base.z + p.z});
      }
      prims.push({type: 'dots', pts: out, color, alpha, size: Math.max(2.2, (unit.size ?? 0.02) * cam.scale * 1.3), depth: 0});
      continue;
    }
    if (unit.kind === 'torus') {
      const r = unit.r ?? .3, arc = unit.arc ?? Math.PI * 2;
      const pts = [];
      const seg = 40;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * arc;
        const local = {x: Math.cos(a) * r, y: Math.sin(a) * r, z: 0};
        const rp = ROT(local, st.rot);
        pts.push({x: base.x + rp.x, y: base.y + rp.y, z: base.z + rp.z});
      }
      prims.push({type: 'path', pts, color, alpha, width: 2, reach: 1, depth: 0});
      continue;
    }

    // 盒体近似
    const size = unitSize(unit);
    const corners = boxCorners(size).map((p) => {
      const sp = {x: p.x * st.scale.x, y: p.y * st.scale.y, z: p.z * st.scale.z};
      const rp = ROT(sp, st.rot);
      return {x: base.x + rp.x, y: base.y + rp.y, z: base.z + rp.z};
    });
    const pr = corners.map((p) => cam.project(p));
    // 接触高亮只闪 0.6 s：画出"碰上了"的那一下，而不是一直橙着
    const hit = !!(st.contact && st.contact.hit && st.contact.at != null && (t - st.contact.at) < 0.6);
    for (const f of BOX_FACES) {
      const q = f.map((i) => pr[i]);
      const depth = (q[0].d + q[1].d + q[2].d + q[3].d) / 4;
      // 面法向亮度：用屏幕空间叉积的符号 + 世界法向近似
      const e1 = {x: corners[f[1]].x - corners[f[0]].x, y: corners[f[1]].y - corners[f[0]].y, z: corners[f[1]].z - corners[f[0]].z};
      const e2 = {x: corners[f[3]].x - corners[f[0]].x, y: corners[f[3]].y - corners[f[0]].y, z: corners[f[3]].z - corners[f[0]].z};
      const n = {x: e1.y * e2.z - e1.z * e2.y, y: e1.z * e2.x - e1.x * e2.z, z: e1.x * e2.y - e1.y * e2.x};
      const nl = Math.hypot(n.x, n.y, n.z) || 1;
      const nd = (n.x * 0.35 + n.y * 0.85 + n.z * 0.4) / nl;
      const lum = 0.34 + 0.66 * Math.max(0, nd);
      prims.push({type: 'quad', q, color: [color[0] * lum, color[1] * lum, color[2] * lum], alpha, depth, hit});
    }
  }

  prims.sort((a, b) => b.depth - a.depth);
  for (const p of prims) {
    if (p.type === 'quad') {
      for (const q of [p.q]) fillQuad(c, q.map((v) => ({x: ox + v.x, y: oy + v.y})), p.color[0], p.color[1], p.color[2], p.alpha);
      const q = p.q.map((v) => ({x: ox + v.x, y: oy + v.y}));
      const ec = p.hit ? [1, 0.72, 0.28] : [p.color[0] * 0.35 + 0.06, p.color[1] * 0.35 + 0.08, p.color[2] * 0.35 + 0.1];
      for (let i = 0; i < 4; i++) strokeLine(c, q[i].x, q[i].y, q[(i + 1) % 4].x, q[(i + 1) % 4].y, ec[0], ec[1], ec[2], p.hit ? 0.85 : 0.45);
    } else if (p.type === 'path') {
      const pr = p.pts.map((v) => cam.project(v));
      const keep = Math.max(1, Math.ceil(pr.length * (p.reach ?? 1)));
      for (let i = 1; i < Math.min(pr.length, keep); i++) {
        strokeLine(c, ox + pr[i - 1].x, oy + pr[i - 1].y, ox + pr[i].x, oy + pr[i].y,
          p.color[0] * 1.6, p.color[1] * 1.6, p.color[2] * 1.6, p.alpha, p.width);
      }
    } else if (p.type === 'dots') {
      for (const v of p.pts) {
        const pr = cam.project(v);
        const s = Math.round(p.size);
        for (let dy = -s; dy <= s; dy++) for (let dx = -s; dx <= s; dx++) {
          if (dx * dx + dy * dy > s * s) continue;
          blendPx(c, Math.round(ox + pr.x) + dx, Math.round(oy + pr.y) + dy, p.color[0] * 1.8, p.color[1] * 1.8, p.color[2] * 1.8, p.alpha);
        }
      }
    }
  }

  // 时间进度条
  const barW = Math.round(cw * 0.8), barX = ox + Math.round(cw * 0.1), barY = oy + ch - 10;
  for (let x = 0; x < barW; x++) blendPx(c, barX + x, barY, 0.2, 0.35, 0.45, 0.35);
  const k = Math.min(1, t / Math.max(0.001, shot.timeline.duration));
  for (let x = 0; x < Math.round(barW * k); x++) blendPx(c, barX + x, barY, 0.35, 0.88, 1.0, 0.9);
  drawText(c, t.toFixed(1) + 's', barX, barY - 24, 2, 0.6, 0.8, 0.9, 0.9);
}

function hexRgb(hex, alpha = 1) {
  return [((hex >> 16) & 255) / 255 * alpha, ((hex >> 8) & 255) / 255 * alpha, (hex & 255) / 255 * alpha];
}

/* ---------------------------- PNG 编码 ---------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(c) {
  const {w, h, buf} = c;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w * 3; x++) {
      const v = Math.max(0, Math.min(1, buf[y * w * 3 + x]));
      raw[y * (w * 3 + 1) + 1 + x] = Math.round(Math.pow(v, 1 / 2.2) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------------------- 出图 ---------------------------- */
const FRAMES = 6;
const CELL_W = 300, CELL_H = 210, PAD = 8, HEAD = 26;
const allShots = [];
for (let i = 0; i < SHOT_COUNT; i++) allShots.push(getShot(i));

// 每镜一张
for (const shot of allShots) {
  const w = PAD * 2 + FRAMES * CELL_W + (FRAMES - 1) * PAD;
  const h = PAD * 2 + HEAD + CELL_H;
  const c = makeCanvas(w, h);
  drawText(c, `${shot.id}  ${shot.title.slice(0, 1)}`, PAD, PAD, 3, 0.55, 0.85, 1, 0.95);
  const dur = shot.timeline.duration;
  for (let f = 0; f < FRAMES; f++) {
    const t = dur * (f + 0.5) / FRAMES;
    const ox = PAD + f * (CELL_W + PAD);
    const oy = PAD + HEAD;
    drawFrame(c, ox, oy, CELL_W, CELL_H, shot, shot.timeline.stateAt(t), t);
    // 画框
    for (let x = 0; x < CELL_W; x++) { blendPx(c, ox + x, oy, 0.15, 0.3, 0.4, 0.5); blendPx(c, ox + x, oy + CELL_H - 1, 0.15, 0.3, 0.4, 0.5); }
    for (let y = 0; y < CELL_H; y++) { blendPx(c, ox, oy + y, 0.15, 0.3, 0.4, 0.5); blendPx(c, ox + CELL_W - 1, oy + y, 0.15, 0.3, 0.4, 0.5); }
  }
  writeFileSync(join(OUT, `filmstrip-${shot.id}.png`), encodePng(c));
  console.log(`  ${shot.id}  ${dur.toFixed(2)}s  -> out/filmstrip-${shot.id}.png`);
}

// 总表：6 镜 × 6 帧
{
  const w = PAD + allShots.length * 0 + FRAMES * CELL_W + (FRAMES - 1) * PAD + PAD;
  const h = PAD * 2 + allShots.length * (CELL_H + PAD + 18);
  const c = makeCanvas(w, h);
  allShots.forEach((shot, row) => {
    const dur = shot.timeline.duration;
    const oy = PAD + row * (CELL_H + PAD + 18) + 18;
    drawText(c, `${row + 1}`, PAD, oy - 16, 3, 0.55, 0.85, 1, 0.95);
    drawText(c, `${dur.toFixed(1)}s`, PAD + 26, oy - 15, 2, 0.45, 0.65, 0.8, 0.9);
    for (let f = 0; f < FRAMES; f++) {
      const t = dur * (f + 0.5) / FRAMES;
      const ox = PAD + f * (CELL_W + PAD);
      drawFrame(c, ox, oy, CELL_W, CELL_H, shot, shot.timeline.stateAt(t), t);
      for (let x = 0; x < CELL_W; x++) { blendPx(c, ox + x, oy, 0.12, 0.24, 0.33, 0.45); blendPx(c, ox + x, oy + CELL_H - 1, 0.12, 0.24, 0.33, 0.45); }
    }
  });
  writeFileSync(join(OUT, 'filmstrip-all.png'), encodePng(c));
  console.log(`  all -> out/filmstrip-all.png (${w}x${h})`);
}
