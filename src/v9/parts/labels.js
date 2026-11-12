// 程序化贴图库：全部用 canvas 2D 现场绘制，不联网、不读外部图片、不使用随机数。
// Node 端（bench）没有 document，所有函数会退化为 null，材质照常建立（只是没有贴图）。
// 每个贴图都带一份"确定性噪声"，用来打破单一 roughness 带来的塑料感。
const TAU = Math.PI * 2;

// 确定性伪随机：同一个 seed 永远得到同一张图
function h1(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function h2(n) { const x = Math.sin(n * 269.5 + 183.3) * 24634.6345; return x - Math.floor(x); }

export function createLabels(THREE) {
  const hasDOM = typeof document !== 'undefined' && !!document.createElement;
  const cache = new Map();

  function canvas(w, h) {
    if (!hasDOM) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return {c, g: c.getContext('2d')};
  }

  function texture(cv, {repeat = [1, 1], srgb = true, aniso = 4, filter = true} = {}) {
    if (!cv) return null;
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    if (filter) { t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; }
    t.needsUpdate = true;
    return t;
  }

  function cached(key, make) {
    if (cache.has(key)) return cache.get(key);
    const v = make();
    cache.set(key, v);
    return v;
  }

  // ---------------- 金属拉丝 ----------------
  // 横向细密条纹 + 微噪声，作为 map 和 roughnessMap：拉丝高光会随视角拉长，不再是纯色塑料。
  function brushed({base = '#aab6c0', lines = 900, seed = 1, size = 512, contrast = .28} = {}) {
    return cached(`brushed:${base}:${lines}:${seed}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = base; g.fillRect(0, 0, size, size);
      for (let i = 0; i < lines; i++) {
        const y = h1(i * 1.7 + seed) * size;
        const w = .4 + h2(i * 3.1 + seed) * 2.2;
        const a = .03 + h1(i * 5.3 + seed) * contrast * .5;
        g.strokeStyle = h1(i * 2.3 + seed) > .5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * .9})`;
        g.lineWidth = w;
        g.beginPath();
        const x0 = h1(i * 7.1) * size;
        g.moveTo(x0 - size * .15, y);
        g.lineTo(x0 + size * .9, y + (h2(i * 9.7) - .5) * 3);
        g.stroke();
      }
      // 少量深浅斑块，模拟铸造/轧制的不均匀
      for (let i = 0; i < 26; i++) {
        const x = h1(i * 11.3 + seed) * size, y = h2(i * 13.7 + seed) * size, r = 20 + h1(i * 17.9) * 90;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        const dark = h1(i * 19.1 + seed) > .5;
        gr.addColorStop(0, dark ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.09)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 微噪声粗糙度 ----------------
  // 单一 roughness 值是"塑料感"的主因；这张图让高光边缘碎掉一点。
  function noise({size = 256, seed = 2, strength = .35, base = 128} = {}) {
    return cached(`noise:${size}:${seed}:${strength}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      const img = g.createImageData(size, size);
      for (let i = 0; i < size * size; i++) {
        const v = base + (h1(i * 0.37 + seed) - .5) * 255 * strength + (h2(i * 0.11 + seed) - .5) * 40;
        const q = Math.max(0, Math.min(255, v));
        img.data[i * 4] = q; img.data[i * 4 + 1] = q; img.data[i * 4 + 2] = q; img.data[i * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      return texture(c, {srgb: false, repeat: [2, 2]});
    });
  }

  // ---------------- 铭牌 / 条码 / 序列号 ----------------
  // 银色阳极氧化铭牌：品牌行 + 规格行 + 序列号 + 条码 + 二维码块 + 边框。
  function label({w = 512, h = 256, serial = 'LC-0000-000', spec = 'Li-ion 3.7V 50Ah', brand = 'LONGCHUANG', accent = '#111', bg = '#c9d2d8', barcode = true, qr = true} = {}) {
    return cached(`label:${w}:${h}:${serial}:${spec}:${brand}:${accent}:${bg}:${barcode}:${qr}`, () => {
      const cv = canvas(w, h); if (!cv) return null;
      const {c, g} = cv;
      const grd = g.createLinearGradient(0, 0, w, h);
      grd.addColorStop(0, '#eef3f6'); grd.addColorStop(.45, bg); grd.addColorStop(1, '#aab6be');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // 拉丝底纹
      for (let i = 0; i < 320; i++) {
        g.strokeStyle = `rgba(255,255,255,${.03 + h1(i * 3.7) * .05})`;
        g.beginPath(); const y = h1(i * 1.3) * h; g.moveTo(0, y); g.lineTo(w, y + (h2(i * 2.1) - .5) * 2); g.stroke();
      }
      g.strokeStyle = 'rgba(30,40,48,.55)'; g.lineWidth = 3; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = accent; g.textBaseline = 'top';
      g.font = `700 ${Math.round(h * .115)}px "Segoe UI", Arial, sans-serif`;
      g.fillText(brand, 26, 26);
      g.font = `600 ${Math.round(h * .082)}px "Segoe UI", Arial, sans-serif`;
      g.fillText(spec, 26, 26 + h * .15);
      g.font = `500 ${Math.round(h * .07)}px Consolas, "Courier New", monospace`;
      g.fillText('S/N ' + serial, 26, 26 + h * .30);
      g.fillText('MADE IN PRC  ·  IP67  ·  RoHS', 26, h * .72);
      if (barcode) {
        // 条码：宽度由确定性哈希给出，符合"条码"的视觉节奏
        const bx = 26, by = h * .46, bh = h * .20;
        let x = bx;
        g.fillStyle = '#0d1114';
        let i = 0;
        while (x < w * .58) {
          const bw = 1 + Math.floor(h1(i * 2.7) * 4);
          if (h1(i * 1.9) > .42) g.fillRect(x, by, bw, bh);
          x += bw + 1 + Math.floor(h2(i * 3.3) * 2);
          i++;
        }
      }
      if (qr) {
        // 二维码：三个定位角 + 确定性点阵
        const qs = h * .40, qx = w - qs - 26, qy = h * .40;
        g.fillStyle = '#f2f6f8'; g.fillRect(qx, qy, qs, qs);
        g.fillStyle = '#0d1114';
        const cell = qs / 21;
        for (let iy = 0; iy < 21; iy++) for (let ix = 0; ix < 21; ix++) {
          const finder = (ix < 7 && iy < 7) || (ix > 13 && iy < 7) || (ix < 7 && iy > 13);
          const ring = (ix === 0 || iy === 0 || ix === 6 || iy === 6) && finder;
          const core = finder && ix > 1 && ix < 5 && iy > 1 && iy < 5;
          if (finder ? (ring || core) : h1(ix * 31.7 + iy * 17.3 + 5) > .52) g.fillRect(qx + ix * cell, qy + iy * cell, cell, cell);
        }
      }
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 高压警示 ----------------
  function warning({size = 256, label = 'HIGH VOLTAGE'} = {}) {
    return cached(`warn:${size}:${label}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.clearRect(0, 0, size, size);
      const cx = size / 2;
      // 黄色三角 + 黑边 + 闪电
      const tri = () => { g.beginPath(); g.moveTo(cx, size * .10); g.lineTo(size * .93, size * .82); g.lineTo(size * .07, size * .82); g.closePath(); };
      tri(); g.fillStyle = '#f2c500'; g.fill();
      g.lineWidth = size * .045; g.strokeStyle = '#131313'; g.stroke();
      g.fillStyle = '#131313';
      g.beginPath();
      g.moveTo(cx + size * .02, size * .30); g.lineTo(cx - size * .15, size * .58);
      g.lineTo(cx - size * .01, size * .58); g.lineTo(cx - size * .05, size * .74);
      g.lineTo(cx + size * .15, size * .50); g.lineTo(cx + size * .01, size * .50);
      g.closePath(); g.fill();
      if (label) {
        g.fillStyle = '#131313';
        g.font = `700 ${Math.round(size * .062)}px "Segoe UI", Arial, sans-serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, cx, size * .90);
      }
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 高压橙色斜条纹（线缆护套/维修开关） ----------------
  function hazard({w = 128, h = 128, a = '#ff6a1f', b = '#f6f2e8'} = {}) {
    return cached(`hazard:${a}:${b}`, () => {
      const cv = canvas(w, h); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = b; g.fillRect(0, 0, w, h);
      g.fillStyle = a;
      for (let i = -h; i < w + h; i += 32) {
        g.beginPath();
        g.moveTo(i, 0); g.lineTo(i + 16, 0); g.lineTo(i + 16 - h, h); g.lineTo(i - h, h);
        g.closePath(); g.fill();
      }
      return texture(c, {repeat: [3, 1]});
    });
  }

  // ---------------- 电路板 ----------------
  function pcb({w = 512, h = 512, base = '#0d3b2e', copper = '#b98a3c', seed = 7} = {}) {
    return cached(`pcb:${w}:${h}:${base}:${seed}`, () => {
      const cv = canvas(w, h); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      // 走线：45°/90° 折线
      g.lineCap = 'round'; g.lineJoin = 'round';
      for (let i = 0; i < 60; i++) {
        const x = h1(i * 3.1 + seed) * w, y = h2(i * 4.7 + seed) * h;
        const len = 24 + h1(i * 5.9) * 120;
        const dir = h1(i * 7.3) > .5 ? 1 : -1;
        g.strokeStyle = h1(i * 9.1) > .6 ? copper : '#1f6b52';
        g.lineWidth = h1(i * 11.3) > .8 ? 3.4 : 1.6;
        g.beginPath(); g.moveTo(x, y);
        g.lineTo(x + dir * len * .6, y); g.lineTo(x + dir * len, y + dir * len * .35);
        g.stroke();
      }
      // 焊盘
      for (let i = 0; i < 90; i++) {
        const x = h1(i * 13.1) * w, y = h2(i * 17.3) * h, r = 1.6 + h1(i * 19.7) * 3.4;
        g.fillStyle = copper; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = '#0a1410'; g.beginPath(); g.arc(x, y, r * .38, 0, TAU); g.fill();
      }
      // 丝印
      g.fillStyle = 'rgba(235,240,240,.78)';
      g.font = '600 13px Consolas, monospace';
      const refs = ['U1', 'U2', 'C12', 'R7', 'L3', 'Q4', 'J5', 'TP2', 'D1', 'Y1'];
      for (let i = 0; i < 22; i++) {
        const x = h1(i * 23.1) * (w - 60), y = h2(i * 29.3) * (h - 20) + 10;
        g.fillText(refs[i % refs.length], x, y);
      }
      g.strokeStyle = 'rgba(235,240,240,.6)'; g.lineWidth = 2; g.strokeRect(10, 10, w - 20, h - 20);
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 六边形/圆孔冲孔网（格栅、扬声器罩、托盘减轻孔） ----------------
  function perf({size = 256, holes = 14, kind = 'hex', dark = '#0b1114', light = '#95a3ae'} = {}) {
    return cached(`perf:${size}:${holes}:${kind}:${dark}:${light}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = light; g.fillRect(0, 0, size, size);
      const step = size / holes;
      g.fillStyle = dark;
      if (kind === 'hex') {
        for (let iy = -1; iy <= holes + 1; iy++) for (let ix = -1; ix <= holes + 1; ix++) {
          const cx = ix * step + (iy % 2 ? step / 2 : 0), cy = iy * step * .88;
          const r = step * .34;
          g.beginPath();
          for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); }
          g.closePath(); g.fill();
        }
      } else {
        for (let iy = 0; iy <= holes; iy++) for (let ix = 0; ix <= holes; ix++) {
          const cx = ix * step, cy = iy * step;
          g.beginPath(); g.arc(cx, cy, step * .3, 0, TAU); g.fill();
        }
      }
      // 孔边高光
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
      for (let iy = 0; iy <= holes; iy++) for (let ix = 0; ix <= holes; ix++) {
        g.beginPath(); g.arc(ix * step, iy * step, step * .3, Math.PI, Math.PI * 1.9); g.stroke();
      }
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 织物质感（座椅面套） ----------------
  // map + bumpMap 同时用：斜纹布的经纬起伏在掠射光下会显现，是"去塑料"最有效的一招。
  function fabric({size = 256, base = '#39424a', thread = '#4a555e', seed = 11} = {}) {
    return cached(`fabric:${size}:${base}:${thread}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = base; g.fillRect(0, 0, size, size);
      const n = 34, step = size / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const over = (i + j) % 2 === 0;
        const a = .10 + h1(i * 3.7 + j * 7.1 + seed) * .16;
        g.fillStyle = `rgba(255,255,255,${a * (over ? 1 : .45)})`;
        g.fillRect(i * step + .6, j * step + .6, step - 1.2, step - 1.2);
        g.fillStyle = `rgba(0,0,0,${a * (over ? .25 : .55)})`;
        g.fillRect(i * step + step * .5, j * step + step * .5, step * .5 - 1, 1.2);
      }
      // 纱线毛羽
      for (let i = 0; i < 1400; i++) {
        const x = h1(i * 1.9) * size, y = h2(i * 2.6) * size;
        g.fillStyle = `rgba(${h1(i * 4.1) > .5 ? '255,255,255' : '0,0,0'},${.03 + h1(i * 5.3) * .05})`;
        g.fillRect(x, y, 1.4, 1.4);
      }
      return texture(c, {repeat: [4, 4]});
    });
  }

  // 织物的灰度版（bumpMap 用）
  function fabricBump({size = 256} = {}) {
    return cached('fabricBump', () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = '#808080'; g.fillRect(0, 0, size, size);
      const n = 34, step = size / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const over = (i + j) % 2 === 0;
        const v = over ? 210 : 64;
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(i * step + 1, j * step + 1, step - 2, step - 2);
      }
      return texture(c, {srgb: false, repeat: [4, 4]});
    });
  }

  // ---------------- 碳纤维斜纹 ----------------
  function carbon({size = 256, dark = '#14181c', light = '#2b3238'} = {}) {
    return cached('carbon:' + dark + light, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      const n = 12, step = size / n;
      g.fillStyle = dark; g.fillRect(0, 0, size, size);
      for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
        const diag = (ix + iy) % 4;
        const cols = diag < 2 ? light : dark;
        g.fillStyle = cols;
        g.fillRect(ix * step, iy * step, step - 1, step - 1);
        g.fillStyle = diag < 2 ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.35)';
        for (let k = 0; k < step; k += 2) g.fillRect(ix * step + k, iy * step, 1, step - 1);
      }
      return texture(c, {repeat: [3, 3]});
    });
  }

  // ---------------- 冲压/铸造标识（钢印） ----------------
  function stamp({text = 'LC 4280', size = 256, fg = '#2a3238', bg = '#aab6c0'} = {}) {
    return cached(`stamp:${text}:${fg}:${bg}`, () => {
      const cv = canvas(size, size / 2); if (!cv) return null;
      const {c, g} = cv;
      g.fillStyle = bg; g.fillRect(0, 0, size, size / 2);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(0,0,0,${h1(i * 2.3) * .06})`;
        g.fillRect(h1(i * 3.1) * size, h2(i * 4.7) * size / 2, 1 + h1(i * 5.9) * 3, 1);
      }
      g.fillStyle = fg;
      g.font = `800 ${Math.round(size * .2)}px "Segoe UI", Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(text, size / 2, size / 4);
      g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(4, 4, size - 8, size / 2 - 8);
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 网格（测量/科技感衬底） ----------------
  function grid({size = 256, cells = 8, color = 'rgba(88,225,255,.30)', bg = 'rgba(6,14,24,0)'} = {}) {
    return cached(`grid:${size}:${cells}:${color}`, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      g.clearRect(0, 0, size, size);
      if (bg !== 'rgba(6,14,24,0)') { g.fillStyle = bg; g.fillRect(0, 0, size, size); }
      g.strokeStyle = color; g.lineWidth = 1;
      const step = size / cells;
      for (let i = 0; i <= cells; i++) {
        g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
        g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
      }
      return texture(c, {repeat: [1, 1]});
    });
  }

  // ---------------- 径向渐变（LED 光晕/热场） ----------------
  function glow({size = 128, inner = 'rgba(120,235,255,.95)', outer = 'rgba(30,120,180,0)'} = {}) {
    return cached('glow:' + inner + outer, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gr.addColorStop(0, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
      return texture(c, {repeat: [1, 1]});
    });
  }

  // 软阴影贴片（部件落位时的接地暗影，避免"浮在空气里的积木"）
  function softShadow({size = 128, strength = .85} = {}) {
    return cached('softShadow:' + strength, () => {
      const cv = canvas(size, size); if (!cv) return null;
      const {c, g} = cv;
      const gr = g.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`);
      gr.addColorStop(.55, `rgba(0,0,0,${strength * .45})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, size, size);
      return texture(c, {repeat: [1, 1]});
    });
  }

  return {
    brushed, noise, label, warning, hazard, pcb, perf, fabric, fabricBump,
    carbon, stamp, grid, glow, softShadow,
    hasDOM, _cache: cache
  };
}
