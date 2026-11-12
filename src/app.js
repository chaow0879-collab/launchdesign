import {createCarScene} from './scene.js';
import cinematicPlan from '../data/shots-v7.json';

const $=s=>document.querySelector(s);
const story=JSON.parse($('#story-data').textContent);
const audioData=JSON.parse($('#audio-data').textContent);const nodeIds=Object.keys(audioData).filter(k=>k!=='__web');
const chapters=story.chapters,groups=Object.fromEntries(story.groups.map(g=>[g.id,g]));
const nodes=chapters.flatMap((c,ci)=>c.steps.map((s,si)=>({...s,chapter:c,ci,si})));
const byId=Object.fromEntries(nodes.map(n=>[n.id,n]));
const audio=$('#narration');audio.preload='auto';
const blobs=new Map();let index=0,scene,ready=false,playing=false,playGeneration=0,lastCaption='',lastFrame=0;
let selected=false,virtualMode=false,virtualTime=0,virtualAnchor=0,soundBlocked=false,userMuted=false,mediaFailure=false,lastShot=-1,freeView=false,pendingSeek=null;
// 动效开关：prefers-reduced-motion 一旦为真，所有 JS 触发的过渡都退化为瞬变
const reduceMotion=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let captionTimer=0;
const escapes={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>escapes[c]);
const format=s=>`${String(Math.floor((s||0)/60)).padStart(2,'0')}:${String(Math.floor((s||0)%60)).padStart(2,'0')}`;
const shortTitles=['需求定义','概念布局','CAS造型','实体模型','A级曲面','工程设计','试制验证','量产交付'];
const chapterEn=['DEFINE THE VISION','SHAPE THE CONCEPT','BUILD THE FORM','FEEL THE PROPORTION','REFINE THE SURFACE','ENGINEER THE VEHICLE','VALIDATE & IMPROVE','DELIVER THE DESIGN'];
const viewLabels={demand:['目标与边界','真实车型外观 · 教学示例'],concept:['比例与总布置','包络与布置叠加为教学示意'],cas:['数字造型','线框用于说明数字建模过程'],clay:['实体模型','材质模拟油泥表面'],classa:['曲面品质','灯光反射示意 · 非曲面检测结果'],engineering:['系统协同','内部系统示意 · 非该车实际工程数据'],validation:['验证与闭环','扫描与性能效果仅作教学示意'],launch:['技术成果','展示车型不代表龙创项目案例']};
function roleEntry(g,n){return n.roleTasks?.find(r=>r.groupId===g);}
function roleTask(g,n){return roleEntry(g,n)?.task||groups[g].purpose;}
let lastAction='',lastPhase=-1,lastShotCount='',lastShotTitle='',lastShotDetail='';
function renderCoverage(shot,a={}){
 const n=nodes[index],all=n.coverageDetails||[],byShot=all.filter(x=>x.shotIndices?.includes(shot));
 const byGroup=all.filter(x=>(a.groupIds||[]).includes(x.groupId));
 const focusId=cinematicPlan.nodes.find(x=>x.id===n.id)?.shots[shot]?.focusCoverageId;
 const item=all.find(x=>x.id===focusId)||byShot[0]||byGroup[0]||all[0];
 if($('#coverage-focus'))$('#coverage-focus').hidden=!item;
 if(item){
  $('#coverage-focus .coverage-heading>span').textContent=item.visualCoverage?.level==='task-card'?'同步专业工作':'镜头中的专业';
  $('#coverage-title').textContent=`${groups[item.groupId]?.name||''} · ${item.title}`;
  $('#coverage-task').textContent=item.task;$('#coverage-output').textContent=item.output;$('#coverage-purpose').textContent=item.purpose;
 }
 for(const el of document.querySelectorAll('#leads [data-role],#parallel [data-role]'))el.classList.toggle('shot-linked',(a.groupIds||byShot.map(x=>x.groupId)).includes(el.dataset.role));
}
// 主导/同步按当前镜头渲染；该镜头没有专属分工（derived:false）或无 shots 数据时回退节点级
function renderRoles(shot){
 const n=nodes[index],s=n.shots?.[shot];
 const leads=s&&Array.isArray(s.leads)&&s.leads.length?s.leads:n.leads;
 const parallel=s&&Array.isArray(s.parallel)&&s.parallel.length?s.parallel:n.parallel;
 $('#leads').innerHTML=leads.map(g=>`<button class="lead-card" data-role="${g}" aria-label="查看${esc(groups[g].name)}在本步的作用"><small class="channel-name">${esc(groups[g].channel||'技术族')}</small><b>${esc(groups[g].name)}</b><span class="arrow">↗</span><p>${esc(roleTask(g,n))}</p></button>`).join('');
 $('#parallel').innerHTML=parallel.map(g=>`<button class="parallel-chip" data-role="${g}" title="${esc(roleTask(g,n))}">${esc(groups[g].name)}</button>`).join('');
}
function updateAction(p){
 const a=scene?.getActionInfo?.();if(!a)return;
 const phases=a.phases||['准备输入','开展工作','形成结果'];
 const pi=a.phaseIndex??Math.min(2,Math.floor(p*3));
 const key=nodes[index].id+'-'+pi+'-'+a.title;
 if(key!==lastAction){
  $('#action-title').textContent=a.title||phases[pi];$('#action-detail').textContent=a.detail||'';
  $('#action-phases').innerHTML=phases.map((x,i)=>`<span class="action-phase ${i===pi?'current':i<pi?'done':''}"><i>${i<pi?'✓':i+1}</i>${esc(typeof x==='string'?x:x.title)}</span>`).join('');
  lastAction=key;
 }
 document.documentElement.style.setProperty('--phase-progress',(p*3)%1);
 const shot=a.shotIndex??Math.min(5,Math.floor(p*6)),count=a.shotCount||6;
 document.documentElement.style.setProperty('--shot-progress',String((p*count)%1));
 const sc=`${String(shot+1).padStart(2,'0')} / ${String(count).padStart(2,'0')}`;
 if(sc!==lastShotCount){lastShotCount=sc;if($('#shot-count'))$('#shot-count').textContent=sc;}
 const st=a.shotTitle||phases[pi];
 if(st!==lastShotTitle){lastShotTitle=st;if($('#shot-title'))$('#shot-title').textContent=st;}
 const sd=a.shotDetail||a.detail||'';
 if(sd!==lastShotDetail){lastShotDetail=sd;if($('#shot-detail'))$('#shot-detail').textContent=sd;}
 if(shot!==lastShot&&$('#shot-strip')){
  const shotNames=Array.from({length:count},(_,i)=>scene?.shotMeta?.(nodes[index].id,i)||cinematicPlan.nodes.find(x=>x.id===nodes[index].id)?.shots?.[i]||{});
  $('#shot-strip').innerHTML=Array.from({length:count},(_,i)=>`<button data-shot="${i}" class="${i===shot?'active':i<shot?'done':''}" title="${esc(shotNames[i]?.detail||'')}" aria-label="第${i+1}镜头：${esc(shotNames[i]?.title||'')}，点击继续播放" ${i===shot?'aria-current="true"':''}><span>${String(i+1).padStart(2,'0')}</span><small>${esc(shotNames[i]?.title||'')}</small></button>`).join('');renderRoles(shot);renderCoverage(shot,a);lastShot=shot;
 }
}
function duration(){return Number.isFinite(audio.duration)&&audio.duration>0?audio.duration:audioData[nodes[index].id]?.duration||0;}
function currentTime(){return virtualMode||pendingSeek!==null?Math.min(duration(),virtualTime+(playing?(performance.now()-virtualAnchor)/1000*Number($('#rate').value):0)):(audio.currentTime||0);}
function seekTo(t){t=Math.max(0,Math.min(duration(),t));virtualTime=t;virtualAnchor=performance.now();pendingSeek=audio.readyState<1?t:null;try{audio.currentTime=t;}catch{pendingSeek=t;}updateProgress();}
function syncState(){
 document.body.classList.toggle('playing',playing);document.body.classList.toggle('paused',!playing);
 $('#play .play-icon').textContent=playing?'Ⅱ':'▶';$('#play .play-label').textContent=playing?'暂停播放':'自动播放';
 $('#status').textContent=playing?(mediaFailure?'动画继续 · 配音暂不可用':soundBlocked?'自动演示中 · 点击开启声音':userMuted?'自动演示中 · 静音':'讲解中 · AI 配音'):ready?'已暂停 · 点击继续':'正在准备';
 $('#play').setAttribute('aria-label',playing?'暂停播放':'自动播放当前工序');
 scene?.setPlaying(playing);
 const silent=audio.muted||soundBlocked;$('#mute').textContent=soundBlocked?'开启讲解声音':silent?'声音 关':'声音 开';$('#mute').setAttribute('aria-label',silent?'开启讲解声音':'关闭声音');
 if($('#autoplay-hint'))$('#autoplay-hint').hidden=!soundBlocked;
}
function pause(){const t=currentTime();playGeneration++;playing=false;virtualTime=t;virtualAnchor=performance.now();audio.pause();syncState();}
function clipURL(id){
 if(!blobs.has(id)){const b=atob(audioData[id].base64),data=new Uint8Array(b.length);for(let i=0;i<b.length;i++)data[i]=b.charCodeAt(i);blobs.set(id,URL.createObjectURL(new Blob([data],{type:'audio/mpeg'})));}
 return blobs.get(id);
}
function selectNode(i,{auto=true}={}){
 const target=Math.max(0,Math.min(nodes.length-1,i));
 if(selected&&target===index){if(auto&&!playing)start();return;}
 const switching=$('#experience');if(switching&&!reduceMotion.matches)switching.classList.add('is-switching');
 playGeneration++;audio.pause();index=target;selected=true;virtualMode=false;virtualTime=0;virtualAnchor=performance.now();mediaFailure=false;pendingSeek=0;
 const n=nodes[index];lastCaption='';lastAction='';lastShot=-1;closeRole();freeView=false;syncCameraMode();
 $('#work-panel').scrollTop=0;
 audio.src=clipURL(n.id);audio.playbackRate=Number($('#rate').value);
 $('#chapter-kicker').textContent=chapterEn[n.ci];$('#chapter-count').textContent=`${String(n.ci+1).padStart(2,'0')} / 08`;
 $('#chapter-title').textContent=n.chapter.title;$('#chapter-subtitle').textContent=n.chapter.subtitle;$('#relationship').textContent=n.chapter.relationship;
 $('#node-count').textContent=`${String(index+1).padStart(2,'0')} / ${nodes.length}`;$('#step-title').textContent=n.title;
 for(const k of ['professional','plain','goal','input','output'])$('#'+k).textContent=n[k];
 renderRoles(0);
 const coverage=n.coverageDetails||[];
 if($('#coverage-toggle')){$('#coverage-toggle').textContent=`本步 ${coverage.length} 项专业工作`;$('#coverage-toggle').setAttribute('aria-expanded','false');}
 if($('#coverage-list')){$('#coverage-list').hidden=true;$('#coverage-list').innerHTML=coverage.map(c=>`<details><summary>${esc(groups[c.groupId]?.name)} · ${esc(c.title)}</summary><p>${esc(c.task)}</p><p><b>交付：</b>${esc(c.output)}</p><p><b>目的：</b>${esc(c.purpose)}</p></details>`).join('');}
 const readable=v=>Array.isArray(v)?v.join('；'):v||'';
 if($('#workflow-gate'))$('#workflow-gate').textContent=readable(n.workflow?.gate);
 if($('#workflow-parallel'))$('#workflow-parallel').textContent=readable(n.workflow?.parallelWork);
 $('#steps').innerHTML=n.chapter.steps.map((s,si)=>{const parallel=(n.chapter.id==='concept'&&si<2)||(n.chapter.id==='engineering'&&si<3);return `<button data-node="${s.id}" class="${si===n.si?'active':''}" ${si===n.si?'aria-current="step"':''} title="${parallel?'并行工作流，按讲解顺序展示':'点击即播放'}">${parallel?'∥ ':`${si+1}. `}${esc(s.title)}</button>`;}).join('');
 $('#chapters').innerHTML=chapters.map((c,ci)=>`<button data-chapter="${ci}" class="${ci===n.ci?'active':ci<n.ci?'completed':''}" ${ci===n.ci?'aria-current="step"':''} title="${esc(c.title)}，点击即播放"><span>${String(ci+1).padStart(2,'0')}</span>${shortTitles[ci]}</button>`).join('');
 $('#view-label').textContent=viewLabels[n.chapter.id][0];$('#view-detail').textContent=viewLabels[n.chapter.id][1];
 $('#prev').disabled=index===0;$('#next').disabled=index===nodes.length-1;
 scene?.setNode(n.id);updateProgress();
 if(auto)start();
 if(switching&&switching.classList.contains('is-switching'))setTimeout(()=>switching.classList.remove('is-switching'),280);
}
async function start(){
 if(!ready)return;
 let t=currentTime();if(t>=duration()-.15)t=0;
 virtualTime=t;virtualAnchor=performance.now();try{audio.currentTime=t;}catch{}
 const token=++playGeneration;playing=true;audio.muted=userMuted||soundBlocked;syncState();
 try{await audio.play();if(token!==playGeneration)return;virtualMode=false;syncState();}
 catch(e){
  if(token!==playGeneration)return;
  if(e.name==='AbortError')return;
  soundBlocked=e.name==='NotAllowedError';mediaFailure=!soundBlocked;audio.muted=true;
  if(soundBlocked){try{await audio.play();if(token!==playGeneration)return;virtualMode=false;syncState();return;}catch{if(token!==playGeneration)return;}}
  // Some browsers also block muted audio. The visual timeline must still run.
  virtualMode=true;virtualTime=t;virtualAnchor=performance.now();syncState();
 }
}
function unlockSound(){
 if(!ready||!soundBlocked||userMuted)return;
 const t=currentTime(),token=playGeneration;soundBlocked=false;audio.muted=false;try{audio.currentTime=t;}catch{}
 if(playing){audio.play().then(()=>{if(token!==playGeneration)return;virtualMode=false;mediaFailure=false;syncState();}).catch(()=>{if(token!==playGeneration)return;soundBlocked=true;audio.muted=true;virtualMode=true;virtualTime=t;virtualAnchor=performance.now();syncState();});}
 syncState();
}
function syncCameraMode(){if($('#camera-mode')){$('#camera-mode').textContent=freeView?'自由观察 · 返回运镜':'自动运镜';$('#camera-mode').setAttribute('aria-pressed',String(!freeView));}}
function showRole(id){
 const g=groups[id],n=nodes[index],p=$('#role-popover');
 p.querySelector('h3').textContent=g.name;p.querySelector('.role-task').textContent=`${n.title}：${roleTask(id,n)}。`;
 p.querySelector('.role-purpose').textContent=roleEntry(id,n)?.purpose||g.purpose;p.querySelector('.role-output').textContent=roleEntry(id,n)?.output||n.output;p.querySelector('.role-channel').textContent=`${g.family||'技术族'} / ${g.channel||''} / ${g.code||''}`;
 p.querySelector('.role-examples').textContent=(g.examples||[]).slice(0,10).join('、')+((g.examples||[]).length>10?' 等':'');p.hidden=false;
}
function closeRole(){$('#role-popover').hidden=true;}
function sentenceAt(n,p){
 const sentences=n.narration.match(/[^。！？]+[。！？]?/g)||[n.narration];
 const total=sentences.reduce((a,s)=>a+s.length,0);let run=0;
 for(const s of sentences){run+=s.length;if(p<=run/total)return s;}return sentences.at(-1);
}
function updateProgress(){
 const d=duration(),t=currentTime(),p=d?t/d:0;
 $('#time').textContent=`${format(t)} / ${format(d)}`;$('#seek').value=Math.round(p*1000);$('#seek').style.setProperty('--progress',`${p*100}%`);
 const timeline=audioData[nodes[index].id]?.segments||[];
 let si=0;for(let i=0;i<timeline.length;i++){if(t>=timeline[i].start)si=i;}
 const seg=timeline[si];
 const caption=seg?.captionText||sentenceAt(nodes[index],p);
 if(caption!==lastCaption){
  lastCaption=caption;const cap=$('#caption');
  if(cap){
   clearTimeout(captionTimer);
   if(reduceMotion.matches){cap.style.opacity='1';cap.textContent=caption;}
   else{cap.style.opacity='0';captionTimer=setTimeout(()=>{cap.textContent=caption;cap.style.opacity='1';},110);}
  }
 }
 const local=seg?Math.max(0,Math.min(.999999,(t-seg.start)/Math.max(.1,seg.end-seg.start))):0;
 const actionProgress=seg?(si+local)/timeline.length:p;
 document.documentElement.style.setProperty('--node-progress',p);
 scene?.setTime(nodes[index].id,t);updateAction(actionProgress);
}
function advance(){if(!playing)return;if(index<nodes.length-1)selectNode(index+1);else{pause();$('#status').textContent='全程讲解完成 · 可选择任意节点重看';}}
function tick(t){if(t-lastFrame>16){updateProgress();lastFrame=t;if(playing&&virtualMode&&currentTime()>=duration())advance();}requestAnimationFrame(tick);}
$('#play').addEventListener('click',()=>playing?pause():start());
$('#prev').addEventListener('click',()=>selectNode(index-1));$('#next').addEventListener('click',()=>selectNode(index+1));
$('#steps').addEventListener('click',e=>{const b=e.target.closest('[data-node]');if(b)selectNode(nodes.findIndex(n=>n.id===b.dataset.node));});
$('#chapters').addEventListener('click',e=>{const b=e.target.closest('[data-chapter]');if(b){const ci=Number(b.dataset.chapter);selectNode(ci===nodes[index].ci?index:nodes.findIndex(n=>n.ci===ci));}});
$('#work-panel').addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(b)showRole(b.dataset.role);});
$('#role-popover .close').addEventListener('click',closeRole);
$('#coverage-toggle')?.addEventListener('click',()=>{const list=$('#coverage-list');if(!list)return;list.hidden=!list.hidden;$('#coverage-toggle').setAttribute('aria-expanded',String(!list.hidden));});
$('#seek').addEventListener('input',()=>seekTo(duration()*Number($('#seek').value)/1000));
$('#rate').addEventListener('change',()=>{if(virtualMode||pendingSeek!==null){virtualTime=virtualTime+(playing?(performance.now()-virtualAnchor)/1000*audio.playbackRate:0);virtualAnchor=performance.now();}audio.playbackRate=Number($('#rate').value);});
$('#mute').addEventListener('click',()=>{if(soundBlocked){userMuted=false;unlockSound();return;}userMuted=!userMuted;audio.muted=userMuted;syncState();});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#mute'))unlockSound();},{capture:true});
document.addEventListener('keydown',()=>unlockSound(),{capture:true});
$('#reset-view').addEventListener('click',()=>{freeView=false;scene?.resetView();syncCameraMode();});
$('#camera-mode')?.addEventListener('click',()=>{if(freeView){freeView=false;scene?.resetView();}else{freeView=true;scene?.setAutoCamera?.(false);}syncCameraMode();});
$('#shot-strip')?.addEventListener('click',e=>{const b=e.target.closest('[data-shot]');if(!b)return;const i=Number(b.dataset.shot);if(i!==lastShot){const segments=audioData[nodes[index].id]?.segments||[],perShot=segments.length===6,seg=segments[perShot?i:Math.floor(i/2)];seekTo(seg?seg.start+(perShot?0:(seg.end-seg.start)*(i%2)/2):duration()*i/6);scene?.resetView();freeView=false;syncCameraMode();}if(!playing)start();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(e){$('#status').textContent='当前浏览器不支持全屏，可最大化窗口';}});
$('#about').addEventListener('click',()=>$('#about-dialog').showModal());$('#about-dialog .close').addEventListener('click',()=>$('#about-dialog').close());
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|BUTTON/.test(e.target.tagName)||$('#about-dialog').open)return;if(e.code==='Space'){e.preventDefault();playing?pause():start();}if(e.code==='ArrowRight'){e.preventDefault();selectNode(index+1);}if(e.code==='ArrowLeft'){e.preventDefault();selectNode(index-1);}if(e.code==='Escape')closeRole();});
audio.addEventListener('ended',()=>{if(!virtualMode)advance();});
audio.addEventListener('loadedmetadata',()=>{if(pendingSeek!==null){const t=currentTime();pendingSeek=null;audio.currentTime=t;updateProgress();}});
audio.addEventListener('error',()=>{mediaFailure=true;if(playing){virtualTime=currentTime();virtualAnchor=performance.now();virtualMode=true;}syncState();});
window.addEventListener('beforeunload',()=>{audio.pause();scene?.destroy();for(const url of blobs.values())URL.revokeObjectURL(url);});
async function init(){
 try{
  const refs=document.createElement('p');refs.className='sources';refs.append('流程交叉复核：',document.getElementById('workflow-source-links').content.cloneNode(true));$('#about-dialog').insertBefore(refs,$('#about-dialog small'));
  if(!nodes.length||nodes.some(n=>!(audioData[n.id]?.base64||audioData[n.id]?.url)))throw new Error('配音素材不完整');
  if(audioData.__web){$('#loading p')&&($('#loading p').textContent='正在载入车模与配音…');await Promise.all(nodes.map(async n=>{const r=await fetch(audioData[n.id].url);if(!r.ok)throw new Error('配音载入失败');blobs.set(n.id,URL.createObjectURL(await r.blob()));}));}
  selectNode(0,{auto:false});
  let modelBuffer;if($('#model-data').dataset.src){const r=await fetch($('#model-data').dataset.src);if(!r.ok)throw new Error('车模载入失败');if(/\.txt$/.test($('#model-data').dataset.src)){const b=atob((await r.text()).trim()),bytes=new Uint8Array(b.length);for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);modelBuffer=bytes.buffer;}else modelBuffer=await r.arrayBuffer();}else{const b=atob($('#model-data').textContent.trim()),bytes=new Uint8Array(b.length);for(let i=0;i<b.length;i++)bytes[i]=b.charCodeAt(i);modelBuffer=bytes.buffer;}
  scene=await createCarScene({canvas:$('#scene'),modelBuffer,onInteract:()=>{freeView=true;syncCameraMode();}});
  scene.setNode(nodes[0].id);scene.setTime(nodes[0].id,0);updateAction(0);scene.setPlaying(false);ready=true;$('#play').disabled=false;syncState();
  $('#loading').classList.add('loaded');setTimeout(()=>$('#loading').hidden=true,550);
  requestAnimationFrame(tick);
  start();
 }catch(e){$('#loading h2').textContent='暂时无法打开三维演示';$('#loading p').textContent='请使用支持 WebGL 的新版 Edge 或 Chrome。'+e.message;console.error(e);}
}
window.__debugSeek=(ni,sec)=>{selectNode(ni,{auto:false});seekTo(sec);pause();seekTo(sec);};
init();
