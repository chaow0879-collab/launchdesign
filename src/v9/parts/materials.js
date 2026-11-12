// 材质库：按"档位"分材质，而不是所有件一个 MeshStandard。
// 每个部件建立自己的 palette()，避免共享材质被工序脚本的透明度动画互相污染（现有 kit 的 op() 会写 m.opacity）。
// 档位参数（与任务卡一致）：
//   壳体 .45/.35 · 加工件 .25/.80（带各向异性高光）· 塑料 .60/0 · 橡胶 .85/0 · 玻璃 .04 + opacity .3
// 贴图全部来自 labels.js 的程序化 canvas。

export function createMaterials(THREE, labels) {
  const {Color} = THREE;

  const COLORS = {
    alu: 0xc4ccd2, castAlu: 0xa2aeb8, darkAlu: 0x606f7b, deepAlu: 0x3f4c56,
    steel: 0xb9c3cb, darkSteel: 0x7b8893, blackSteel: 0x3b454d, spring: 0xc9a24a,
    copper: 0xc07a3e, brass: 0xc9a45e, gold: 0xd8b26a,
    plasticBlack: 0x1d2328, plasticGraphite: 0x333b42, plasticGrey: 0x8b98a3,
    orangeHV: 0xff6a1f, orangeDeep: 0xcf4708, yellow: 0xf2c500, red: 0xd8382f,
    rubber: 0x141719, seal: 0x1b1f22, glass: 0xa8d8f0,
    leather: 0x2a3036, fabric: 0x3a444b, fabricLight: 0x59646d,
    white: 0xe8eef2, green: 0x2f8a5a, pcbGreen: 0x0d3b2e, ceramic: 0xd9dee2,
    bronze: 0x8a6a45, tape: 0x282c30
  };

  // 档位表：kind 选择 Standard / Physical；tex 里 [函数名, 参数] 交给 labels
  const TIERS = {
    // 壳体：压铸铝 / 深冲钣金，有一点拉丝，粗糙度中等
    shell: {kind: 'physical', metalness: .35, roughness: .45, tex: {map: ['brushed', {base: '#dfe4e8'}], roughnessMap: ['noise', {strength: .30}]}},
    // 加工件：铣削/车削面，高金属度 + 低粗糙度 + 各向异性高光（刀纹方向）
    machined: {kind: 'physical', metalness: .80, roughness: .25, anisotropy: .42, tex: {map: ['brushed', {base: '#e9edf0', lines: 1400}], roughnessMap: ['noise', {strength: .42}]}},
    // 塑料：无金属度，粗糙度中等，只有细微粗糙度扰动
    plastic: {kind: 'physical', metalness: 0, roughness: .60, tex: {roughnessMap: ['noise', {strength: .45}]}},
    // 橡胶/密封：很粗糙，没有高光
    rubber: {kind: 'physical', metalness: 0, roughness: .85, tex: {roughnessMap: ['noise', {strength: .6}]}},
    // 织物：sheen + 斜纹贴图 + 凹凸，座舱里最关键的一档
    fabric: {kind: 'physical', metalness: 0, roughness: .86, sheen: 1, sheenRoughness: .9, tex: {map: ['fabric', {}], bumpMap: ['fabricBump', {}]}, bumpScale: .0006},
    // 玻璃：roughness .04 + opacity .3（也可传 transmission 走真折射）
    glass: {kind: 'physical', metalness: 0, roughness: .04, transparent: true, opacity: .30, ior: 1.5, clearcoat: 1, clearcoatRoughness: .03, depthWrite: false},
    // 铭牌/标签：贴图直接给 map
    label: {kind: 'standard', metalness: .08, roughness: .45},
    // 铜排
    copper: {kind: 'physical', metalness: 1, roughness: .28, tex: {roughnessMap: ['noise', {strength: .3}]}},
    // 阳极氧化（黑色/彩色铝）
    anodized: {kind: 'physical', metalness: .62, roughness: .36, tex: {map: ['brushed', {base: '#cfd6db'}], roughnessMap: ['noise', {strength: .35}]}},
    // 碳纤维
    carbon: {kind: 'physical', metalness: .22, roughness: .34, clearcoat: 1, clearcoatRoughness: .15, tex: {map: ['carbon', {}]}},
    // 车漆
    paint: {kind: 'physical', metalness: .30, roughness: .28, clearcoat: 1, clearcoatRoughness: .05},
    // PCB
    pcb: {kind: 'standard', metalness: .15, roughness: .55, tex: {map: ['pcb', {}]}},
    // 电镀铬（镜面）
    chrome: {kind: 'physical', metalness: 1, roughness: .08, envMapIntensity: 1.5},
    // 陶瓷/绝缘片
    ceramic: {kind: 'physical', metalness: 0, roughness: .42},
    // 警示贴（不透明）
    sticker: {kind: 'standard', metalness: .05, roughness: .52}
  };

  function texOf(spec) {
    if (!spec) return null;
    const [name, args] = spec;
    const fn = labels[name];
    if (typeof fn !== 'function') return null;
    return args ? fn(args) : fn();
  }

  function palette() {
    const cache = new Map();
    const used = new Set();
    const P = {
      COLORS,
      TIERS,
      // 主入口：P.tier('machined', {color: C.alu})
      tier(name, opts = {}) {
        const spec = TIERS[name] || TIERS.shell;
        const key = name + '|' + JSON.stringify(opts, (k, v) => (v && v.isTexture) ? (v.uuid) : v);
        if (cache.has(key)) return cache.get(key);
        const kind = spec.kind === 'standard' ? 'Standard' : 'Physical';
        const params = {
          color: new Color(opts.color !== undefined ? opts.color : COLORS.alu),
          metalness: opts.metalness !== undefined ? opts.metalness : spec.metalness,
          roughness: opts.roughness !== undefined ? opts.roughness : spec.roughness
        };
        if (spec.kind !== 'standard') {
          params.envMapIntensity = opts.envMapIntensity !== undefined ? opts.envMapIntensity : 1.1;
        }
        if (spec.clearcoat) { params.clearcoat = spec.clearcoat; params.clearcoatRoughness = spec.clearcoatRoughness ?? .1; }
        if (spec.sheen) { params.sheen = spec.sheen; params.sheenRoughness = spec.sheenRoughness ?? .85; params.sheenColor = new Color(opts.sheenColor ?? 0xdfe8ee); }
        if (spec.ior !== undefined) params.ior = opts.ior ?? spec.ior;
        if (spec.anisotropy && 'anisotropy' in new THREE.MeshPhysicalMaterial()) {
          params.anisotropy = opts.anisotropy ?? spec.anisotropy;
          params.anisotropyRotation = opts.anisotropyRotation ?? .6;
        }
        if (spec.transparent && opts.transparent === undefined) { params.transparent = true; params.opacity = spec.opacity; params.depthWrite = spec.depthWrite ?? false; }
        if (opts.transmission !== undefined) { params.transmission = opts.transmission; params.thickness = opts.thickness ?? .004; params.transparent = false; params.opacity = 1; }
        if (opts.transparent !== undefined) params.transparent = opts.transparent;
        if (opts.opacity !== undefined) params.opacity = opts.opacity;
        if (opts.depthWrite !== undefined) params.depthWrite = opts.depthWrite;
        if (opts.side !== undefined) params.side = opts.side;
        if (opts.flatShading) params.flatShading = true;
        if (opts.emissive !== undefined) { params.emissive = new Color(opts.emissive); params.emissiveIntensity = opts.emissiveIntensity ?? .6; }
        // 贴图：opts.textures 可覆盖档位默认（传 null / {} 表示不要贴图）；opts.map 直接给 Texture
        const texSpec = opts.textures === undefined ? (spec.tex || {}) : (opts.textures || {});
        for (const [slot, sp] of Object.entries(texSpec)) {
          if (!sp) continue;
          params[slot] = Array.isArray(sp) ? texOf(sp) : sp;
        }
        if (opts.map) params.map = opts.map;
        if (opts.bumpScale !== undefined) params.bumpScale = opts.bumpScale;
        if (spec.bumpScale && opts.bumpScale === undefined) params.bumpScale = spec.bumpScale;
        if (opts.roughnessMap) params.roughnessMap = opts.roughnessMap;
        if (opts.emissiveMap) params.emissiveMap = opts.emissiveMap;
        const Mat = THREE['Mesh' + kind + 'Material'];
        const mat = new Mat(params);
        mat.userData.tier = name;
        mat.name = `${name}${opts.color !== undefined ? '-' + opts.color.toString(16) : ''}`;
        cache.set(key, mat);
        used.add(name);
        return mat;
      },
      // 自发光（LED/能量条）：toneMapped 关掉，暗场里能看出来是"发光件"而不是涂了亮色漆的塑料
      emissive(color = 0x58e1ff, intensity = 2.2, opacity = 1) {
        const m = new THREE.MeshBasicMaterial({color: new Color(color).multiplyScalar(intensity), transparent: true, opacity, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending});
        m.userData.tier = 'emissive';
        return m;
      },
      used: () => Array.from(used)
    };
    return P;
  }

  return {COLORS, TIERS, palette, texOf};
}
