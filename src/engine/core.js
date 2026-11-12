// 渲染核心：影棚环境、地面、后期辉光、相机。所有画面状态都由“工序时间 t”算出，没有自走时钟。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const ease = x => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const lerp = (a, b, t) => a + (b - a) * t;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createCore(canvas) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x060a11);
  scene.background = BG;
  scene.fog = new THREE.Fog(0x060a11, 16, 34);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), .03).texture;
  scene.environment = env;
  scene.environmentIntensity = .75;

  const camera = new THREE.PerspectiveCamera(32, 1, .05, 120);
  camera.position.set(6, 2.6, 7);
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x0b1218, .35); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(4, 8, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7fb4ff, 1.6); rim.position.set(-6, 3, -5); scene.add(rim);

  // 地面：深色微反光 + 渐隐网格 + 车下接触阴影
  const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 96), new THREE.MeshStandardMaterial({color: 0x0b1118, roughness: .95, metalness: 0, envMapIntensity: .05}));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const gridMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {uColor: {value: new THREE.Color(0x2c6f9c)}, uOpacity: {value: .55}},
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; varying vec2 vP;
      float line(float x, float w){ float d = abs(fract(x - .5) - .5); return 1.0 - smoothstep(0.0, w, d / fwidth(x)); }
      void main(){ float r = length(vP); float fade = smoothstep(14.0, 2.5, r);
        float g = max(line(vP.x * 2.0, 1.0), line(vP.y * 2.0, 1.0)) * .35 + max(line(vP.x * .5, 1.2), line(vP.y * .5, 1.2)) * .55;
        gl_FragColor = vec4(uColor, g * fade * uOpacity); }`,
    extensions: {derivatives: true}
  });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), gridMat); grid.rotation.x = -Math.PI / 2; grid.position.y = .002; scene.add(grid);
  const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const r = g.createRadialGradient(64, 64, 4, 64, 64, 62); r.addColorStop(0, 'rgba(0,0,0,0.85)'); r.addColorStop(.55, 'rgba(0,0,0,0.45)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); return t; })();
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.6), new THREE.MeshBasicMaterial({map: shadowTex, transparent: true, depthWrite: false}));
  contact.rotation.x = -Math.PI / 2; contact.position.y = .004; scene.add(contact);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), .38, .35, 1.6);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08; controls.minDistance = 1.2; controls.maxDistance = 18; controls.maxPolarAngle = Math.PI * .495; controls.enabled = true;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.setSize(w, h);
    camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  return {THREE, renderer, scene, camera, composer, bloom, controls, floor, grid, contact, key, rim, hemi, env, resize, pmrem};
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
