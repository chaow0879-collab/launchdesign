// =====================================================================
// demo/adapter.js —— 把 v9 时间轴包成"v8 节点"的形状，方便 scene.js 只改两行
//
// v8 的节点接口：{phases, shots, cams, build(K,S,car), update(c,P,K,S,car)}
// v9 的节点只需要：mount(stage) + render(t) —— 画面完全由 timeline.stateAt(t) 决定。
//
// 用法（scene.js）：
//   import {createV9Node} from './v9/demo/adapter.js';
//   NODES['engineering-2'] = createV9Node(1);          // 1 = engineering-2 那组镜头
//   setNode 里：node.v9 ? node.mount({scene, camera, controls}) : props = node.build(...)
//   apply   里：node.v9 ? node.render(t) : (car.reset(); S.reset(); K.resetProps(); node.update(...))
// 详见 out/INTEGRATION.md
// =====================================================================
import {getShot} from './engineering-2.js';
import {buildShotStage, applyStates, frameCamera} from './bind-three.js';

export function createV9Node(shotIndex = 0) {
  const shot = getShot(shotIndex);
  let rig = null;
  let stage = null;

  return {
    // v8 界面读这两个字段
    phases: ['装配就位', '接通与流动', '复核与保护'],
    shots: [{
      title: shot.title,
      detail: shot.detail
    }],

    // v9 标记：scene.js 见到它就走时间轴分支
    v9: true,
    duration: shot.timeline.duration,
    timeline: shot.timeline,
    content: shot,

    // v8 的空实现，防止旧代码路径误用
    cams: [],
    build() { return {}; },
    update() {},

    // stage = {scene, camera, controls}（core 返回的现成对象即可，不需要新 renderer）
    mount(s) {
      stage = s;
      if (rig) rig.dispose();
      rig = buildShotStage(s, shot);
      frameCamera(s, shot.camera);
      return rig;
    },
    render(t) {
      if (!rig) return null;
      const states = shot.timeline.stateAt(t);
      applyStates(rig, states);
      return states;
    },
    // 逐镜切换（一个工序内 6 句 = 6 个镜头时用）
    setShot(i) {
      const next = getShot(i);
      shot.timeline = next.timeline;
      this.duration = next.timeline.duration;
      if (stage) { if (rig) rig.dispose(); rig = buildShotStage(stage, next); frameCamera(stage, next.camera); }
      return next;
    },
    dispose() { if (rig) rig.dispose(); rig = null; }
  };
}
