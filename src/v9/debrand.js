// v9 品牌合规层：在运行时把车模上的一切厂商痕迹抹掉，并替换为中性 HUD。
// 只做三件事，全部是幂等的：反复调用结果相同。
//
//   1. 隐藏实体徽标（几何体，不是贴花）——材质名 Geohoodsub00031Mtl
//   2. 用中性 HUD 覆盖座舱屏显贴图 —— 材质名 /cockpithrsub/
//   3. 统一自发光上限，避免某些原厂材质在暗场里跳亮
//
// 用法（在 car.js 的 loadCar 里，拿到 gltf.scene 之后）：
//   import {applyDebrand} from '../v9/debrand.js';
//   const report = applyDebrand(gltf.scene, THREE);
//
// 依赖：只用 three 的公开 API 与浏览器 Canvas，不引入任何资源文件。

const BADGE_MATERIAL = /^Geohoodsub00031/i;
const SCREEN_MATERIAL = /cockpithrsub/i;

/** 生成一块中性座舱屏显：深底 + 冷青网格 + 进度环 + 条带。不写任何品牌字样。 */
export function neutralScreenTexture(THREE, { width = 1024, height = 512, hue = '#58e1ff' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');

  // 底
  const bg = g.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, '#050a11');
  bg.addColorStop(1, '#0a1622');
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);

  // 细网格
  g.strokeStyle = 'rgba(88,225,255,.10)';
  g.lineWidth = 1;
  for (let x = 0; x < width; x += 32) {
    g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, height); g.stroke();
  }
  for (let y = 0; y < height; y += 32) {
    g.beginPath(); g.moveTo(0, y + .5); g.lineTo(width, y + .5); g.stroke();
  }

  // 外框
  g.strokeStyle = hue;
  g.globalAlpha = .55;
  g.lineWidth = 2;
  g.strokeRect(18, 18, width - 36, height - 36);
  g.globalAlpha = 1;

  // 左上：环形进度
  const cx = 150, cy = 150, r = 74;
  g.strokeStyle = 'rgba(88,225,255,.18)';
  g.lineWidth = 10;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = hue;
  g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.42); g.stroke();

  // 右下：条带
  const bars = [.82, .56, .68, .34, .74];
  bars.forEach((v, i) => {
    const x = 330 + i * 118;
    const h = v * 200;
    g.fillStyle = 'rgba(88,225,255,.16)';
    g.fillRect(x, 400 - h, 74, h);
    g.fillStyle = hue;
    g.globalAlpha = .85;
    g.fillRect(x, 400 - h, 74, 4);
    g.globalAlpha = 1;
  });

  // 右上一组等宽刻线，纯装饰性读数
  g.fillStyle = 'rgba(88,225,255,.35)';
  for (let i = 0; i < 24; i++) {
    const h2 = 6 + ((i * 37) % 26);
    g.fillRect(560 + i * 18, 92, 8, h2);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/**
 * @param {THREE.Object3D} root  gltf.scene
 * @param {object} THREE        命名空间（避免本文件重复 import 造成多实例）
 * @returns {{badgesHidden:number, screensReplaced:number, emissiveClamped:number}}
 */
export function applyDebrand(root, THREE) {
  const report = { badgesHidden: 0, screensReplaced: 0, emissiveClamped: 0 };
  const screenTex = neutralScreenTexture(THREE);
  const seen = new Set();
  const badgeMeshes = [];

  const matName = (m) => (m && (m.name || '')) || '';

  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];

    // 1) 实体徽标：整块 primitive 摘掉。徽标是贴在车表面的独立片，
    //    摘除后不会露洞（它与车身面共用 mesh 但不同 material/primitive）。
    if (mats.some((m) => BADGE_MATERIAL.test(matName(m)))) {
      badgeMeshes.push(o);
      return;
    }

    // 2) 座舱屏显：换成中性 HUD（baseColor + emissive 同图）
    for (const m of mats) {
      const name = matName(m);
      if (!SCREEN_MATERIAL.test(name)) continue;
      const key = name + ':' + o.uuid;
      if (seen.has(key)) continue;
      seen.add(key);
      if (m.map) m.map.dispose?.();
      if (m.emissiveMap) m.emissiveMap.dispose?.();
      m.map = screenTex;
      m.emissiveMap = screenTex;
      if (m.emissive) m.emissive.setHex(0x0a2230);
      m.emissiveIntensity = 1.35;
      m.needsUpdate = true;
      report.screensReplaced += 1;
    }

    // 3) 自发光限幅：原厂材质里个别自发光过亮，暗场里会跳
    for (const m of mats) {
      if (m && m.emissive && m.emissiveIntensity > 1.6) {
        m.emissiveIntensity = 1.6;
        report.emissiveClamped += 1;
      }
    }
  });

  // 遍历结束后再摘除，避免在 traverse 过程中改树结构
  for (const m of badgeMeshes) {
    m.geometry?.dispose?.();
    m.parent?.remove(m);
    report.badgesHidden += 1;
  }

  return report;
}

/** 静态自检：确认车模里已无品牌材质残留（返回命中的名字列表）。 */
export function scanBrandMaterialNames(root) {
  const hits = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const n = (m && m.name) || '';
      if (/tesla|badge|model\s*3|sketchfab|rblx/i.test(n)) hits.push(n);
    }
  });
  return [...new Set(hits)];
}
