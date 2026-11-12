// 渲染核心：影棚灯箱、湿地面、辉光与暗角、相机。所有画面状态都由“工序时间 t”算出，没有自走时钟。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {RGBShiftShader} from 'three/addons/shaders/RGBShiftShader.js';
import {RectAreaLightUniformsLib} from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

// —— 灯箱：顶部一条沿车身纵轴，左前 / 右后各一条斜置（y≈1.8）。
// meshI 是画面里灯条本身的亮度，envI 是烘进环境贴图的亮度（决定漆面长条反射），lightI 是面光源强度（决定随镜头滑动的长条高光）。
const STRIPS = [
  {p: [0, 4.2, 0], s: [8, .06, .12], r: [0, 0, 0], color: 0xeaf6ff, meshI: 1.0, envI: 1.8, lightI: .55},
  {p: [2.9, 1.8, 2.4], s: [5.6, .05, .1], r: [0, .62, 0], color: 0x9fd8ff, meshI: .85, envI: 1.1, lightI: .35},
  {p: [-2.9, 1.8, -2.4], s: [5.6, .05, .1], r: [0, -.62, 0], color: 0x9fd8ff, meshI: .85, envI: 1.1, lightI: .35}
];

// 暗角：线性 HDR 空间里只能用乘法压边，不能用 examples 的 VignetteShader
//（那条 shader 是往“纸白 1-darkness”混，在线性空间会把四角提亮）。
const VignetteDarkShader = {
  name: 'VignetteDarkShader',
  uniforms: {tDiffuse: {value: null}, uStrength: {value: .3}, uAspect: {value: 1}, uSoft: {value: .55}},
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uStrength; uniform float uAspect; uniform float uSoft; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = (vUv - .5) * vec2(uAspect, 1.0);
      float r = length(d) * 1.4142;
      gl_FragColor = vec4(c.rgb * (1.0 - uStrength * smoothstep(uSoft, 1.0, r)), c.a);
    }`
};

export function createCore(canvas) {
  RectAreaLightUniformsLib.init();       // RectAreaLight（长条面光源）必须先初始化 LTC 贴图
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .78;
// 现场调光口子：URL 加 ?exp=0.9 可临时覆盖曝光（0.4~1.6），不改代码就能定亮度
{
  const _e = Number(new URLSearchParams(location.search).get('exp'));
  if (Number.isFinite(_e) && _e > 0) renderer.toneMappingExposure = Math.min(1.6, Math.max(.3, _e));
}
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x060a11);
  scene.background = BG;
  scene.fog = new THREE.Fog(0x060a11, 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---- 影棚灯箱：真实几何（进画面 + 参与 PMREM 烘焙）+ 同位置的面光源（让漆面有随镜头移动的长条高光） ----
  const envScene = new THREE.Scene();
  const room = new RoomEnvironment();
  for (const c of [...room.children]) envScene.add(c);        // 保留原影棚底色，只把灯箱叠进去
  const strips = STRIPS.map(d => {
    const geo = new THREE.BoxGeometry(...d.s);
    const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(d.color).multiplyScalar(d.meshI), fog: false, toneMapped: false});
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'studio-strip';
    mesh.position.set(...d.p); mesh.rotation.set(...d.r);
    scene.add(mesh);
    const envMesh = new THREE.Mesh(geo.clone(), new THREE.MeshBasicMaterial({color: new THREE.Color(d.color).multiplyScalar(d.envI)}));
    envMesh.position.copy(mesh.position); envMesh.rotation.copy(mesh.rotation);
    envScene.add(envMesh);
    const light = new THREE.RectAreaLight(d.color, d.lightI, d.s[0], Math.max(.16, d.s[2] * 3));
    light.position.set(...d.p);
    light.lookAt(0, .6, 0);
    scene.add(light);
    return {mesh, mat, light, envMesh, base: new THREE.Color(d.color), meshI: d.meshI, lightI: d.lightI};
  });
  // 只烘焙一次：灯条在环境贴图里是定值，随强度变化的是画面里的灯条本体与面光源。
  // 这样漆面的长条反射不需要 SSR，也没有每帧重烘 PMREM 的开销。
  const env = pmrem.fromScene(envScene, .02).texture;
  scene.environment = env;
  scene.environmentIntensity = .28;

  const camera = new THREE.PerspectiveCamera(32, 1, .05, 120);
  camera.position.set(6, 2.6, 7);
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x0b1218, .16); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(4, 8, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb4ff, .8); rim.position.set(-6, 3, -5); scene.add(rim);

  // 地面：深色微反光 + 近车更“湿”（粗糙度按到车心的距离渐变）+ 渐隐网格 + 车下接触阴影
  const floorMat = new THREE.MeshStandardMaterial({color: 0x060a10, roughness: .74, metalness: 0, envMapIntensity: .22});
  floorMat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFloorW;')
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        // 近车 1.1~4.6 m 内粗糙度从 .92 压到 .14：只在车周围形成湿反光，远处保持哑光，避免整块镜面地板
        float wet = 1.0 - smoothstep(1.1, 4.6, length(vFloorW.xz));
        float ripple = .07 * sin(vFloorW.x * 2.7) * sin(vFloorW.z * 3.3);
        roughnessFactor = mix(.94, .40, wet) + ripple * wet;`);
  };
  floorMat.customProgramCacheKey = () => 'floor-wet';
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uColor: {value: new THREE.Color(0x1d5478)}, uOpacity: {value: .34}, uGain: {value: 1}},
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uGain; varying vec2 vP;
      float line(float x, float w){ float d = abs(fract(x - .5) - .5); return 1.0 - smoothstep(0.0, w, d / fwidth(x)); }
      void main(){ float r = length(vP); float fade = smoothstep(14.0, 2.5, r);
        float g = max(line(vP.x * 2.0, 1.0), line(vP.y * 2.0, 1.0)) * .35 + max(line(vP.x * .5, 1.2), line(vP.y * .5, 1.2)) * .55;
        gl_FragColor = vec4(uColor * uGain, g * fade * uOpacity); }`,
    extensions: {derivatives: true}
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), gridMat); grid.rotation.x = -Math.PI / 2; grid.position.y = .002; scene.add(grid);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(.55, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  contact.rotation.x = -Math.PI / 2; contact.position.y = .004; scene.add(contact);

  // 后期：RenderPass → Bloom → 暗角 → RGB 微偏移 → OutputPass（色调映射与 sRGB 只在 OutputPass 做一次）
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // 数值与 UI 侧假设同源（U 的 T-102 按 1.05/.55/.72 做视觉），单点来源就是这里：
  // scene.js 每帧只调 core.setBloom()，不再写死强度，所以"UI 有光、车没光"不会发生。
  const BLOOM = {strength: .40, radius: .38, threshold: 1.05, res: 512};
  const bloom = new UnrealBloomPass(new THREE.Vector2(BLOOM.res, BLOOM.res), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  composer.addPass(bloom);
  const vignette = new ShaderPass(VignetteDarkShader);
  vignette.uniforms.uStrength.value = .52;
  composer.addPass(vignette);
  const rgbShift = new ShaderPass(RGBShiftShader);
  rgbShift.uniforms.amount.value = .0007;
  composer.addPass(rgbShift);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 1.2; controls.maxDistance = 18; controls.maxPolarAngle = Math.PI * .495; controls.enabled = true;

  // ---- 对外接口 ----
  function setBloom(strength, radius, threshold) {
    if (strength != null) BLOOM.strength = strength;
    if (radius != null) BLOOM.radius = radius;
    if (threshold != null) BLOOM.threshold = threshold;
    bloom.strength = BLOOM.strength; bloom.radius = BLOOM.radius; bloom.threshold = BLOOM.threshold;
  }
  function setStrips(intensity = 1, hue = null) {
    for (const s of strips) {
      const c = s.base.clone();
      if (hue != null) c.lerp(new THREE.Color(hue), .6);
      s.mat.color.copy(c).multiplyScalar(s.meshI * intensity);
      s.light.color.copy(c);
      s.light.intensity = s.lightI * intensity;
    }
  }
  let gridGain = 1;
  function setGrid(intensity) {
    if (intensity != null) gridGain = intensity;
    gridMat.uniforms.uGain.value = gridGain;
    gridMat.uniforms.uOpacity.value = .55;
  }
  function setGrade(on = true) {
    vignette.enabled = !!on; rgbShift.enabled = !!on;
  }
  setStrips(); setGrid(); setGrade(true);

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    vignette.uniforms.uAspect.value = w / Math.max(1, h);
  }
  resize();
  window.addEventListener('resize', resize);
  return {
    THREE, renderer, scene, camera, composer, bloom, controls, floor, grid, contact, key, rim, hemi, env, resize, pmrem,
    setBloom, setStrips, setGrid, setGrade,
    grade: {vignette, rgbShift},
    rig: {strips, lights: strips.map(s => s.light), setStrips}
  };
}

// 相机镜位：{tg:[x,y,z], r:距离, az:方位角(度), el:仰角(度), fov}
export function camPose(c) {
  const az = THREE.MathUtils.degToRad(c.az ?? 35), el = THREE.MathUtils.degToRad(c.el ?? 14), r = c.r ?? 7;
  const tg = new THREE.Vector3(...(c.tg || [0, .7, 0]));
  const pos = new THREE.Vector3(tg.x + r * Math.cos(el) * Math.cos(az), tg.y + r * Math.sin(el), tg.z + r * Math.cos(el) * Math.sin(az));
  return {pos, tg, fov: c.fov ?? 32};
}
export function mixCam(a, b, k) {
  // 方位角走最短弧
  let daz = (b.az ?? 35) - (a.az ?? 35); daz = ((daz + 540) % 360) - 180;
  return {tg: (a.tg || [0, .7, 0]).map((v, i) => lerp(v, (b.tg || [0, .7, 0])[i], k)), r: lerp(a.r ?? 7, b.r ?? 7, k), az: (a.az ?? 35) + daz * k, el: lerp(a.el ?? 14, b.el ?? 14, k), fov: lerp(a.fov ?? 32, b.fov ?? 32, k)};
}
