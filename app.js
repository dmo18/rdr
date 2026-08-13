'use strict';

function detectLowPower(){
  const hc=Number(navigator.hardwareConcurrency)||0,dm=Number(navigator.deviceMemory)||0,ua=String(navigator.userAgent||'').toLowerCase();
  return query.has('yodeck')||(hc>0&&hc<=4)||(dm>0&&dm<=4)||ua.includes('armv')||ua.includes('raspberry');
}
state.runtime=state.runtime||{};state.runtime.lowPower=detectLowPower();

function showView(index){
  const next=(index+CFG.views.length)%CFG.views.length,def=CFG.views[next];
  state.view=next;panel.dataset.view=def.id;state.cursor=Math.max(0,state.frames.length-1);state.transition=null;
  if(typeof eWarmCurrentView==='function'&&!state.runtime.lowPower)eWarmCurrentView();
  render();
  Promise.allSettled([loadBoundaries(def),loadSurfaceObs(def)]).then(()=>{
    if(view().id!==def.id)return;
    if(typeof eWarmCurrentView==='function'&&!state.runtime.lowPower)eWarmCurrentView();
    render();
  }).catch(e=>state.errors.push(`view context: ${e}`));
}
function scheduleRotation(){
  clearTimeout(state.rotateTimer);if(forcedView)return;
  const delay=view().duration;
  state.rotateTimer=setTimeout(()=>{showView(state.view+1);scheduleRotation()},delay);
}
function advanceRadarFrame(){
  if(state.frames.length<2)return;
  const from=clamp(state.cursor,0,state.frames.length-1),to=(from+1)%state.frames.length;
  state.cursor=to;
  if(state.runtime.lowPower){state.transition=null;render(performance.now());return}
  state.transition={from,to,start:performance.now()};
}
function paintLoop(now){
  if(state.runtime.lowPower)return;
  if(now-state.lastPaint>=1000/CFG.animFps){state.lastPaint=now;render(now)}
  state.raf=requestAnimationFrame(paintLoop);
}
function startAnimation(){
  clearInterval(state.animTimer);if(state.raf)cancelAnimationFrame(state.raf);state.raf=null;state.lastPaint=0;
  state.animTimer=setInterval(advanceRadarFrame,CFG.radarFrameMs);
  if(!state.runtime.lowPower)state.raf=requestAnimationFrame(paintLoop);
}
function startPolling(){
  clearInterval(state.pollTimer);clearInterval(state.vectorTimer);clearInterval(state.severeTimer);
  state.pollTimer=setInterval(()=>pollRadar().catch(e=>state.errors.push(String(e))),CFG.pollMs);
  state.vectorTimer=setInterval(()=>refreshVectors().catch(e=>state.errors.push(String(e))),CFG.vectorMs);
  state.severeTimer=setInterval(()=>loadSevere().catch(e=>state.errors.push(String(e))),CFG.severeMs);
}
async function deferredSevere(){
  if(verifyMode)return;
  let waits=0;
  while(state.radarBackfilling&&waits<12){await new Promise(resolve=>setTimeout(resolve,1500));waits++}
  loadSevere().catch(e=>state.errors.push(String(e)));
}
async function init(){
  fitPanel();addEventListener('resize',fitPanel,{passive:true});if(forcedView){const i=CFG.views.findIndex(v=>v.id===forcedView);if(i>=0)state.view=i}panel.dataset.view=view().id;render();
  const boundaryPromise=loadBoundaries(view()).catch(e=>state.errors.push(`boundaries: ${e}`)),surfacePromise=loadSurfaceObs(view()).catch(e=>state.errors.push(`surface: ${e}`)),radarPromise=pollRadar({initial:true}).catch(e=>state.errors.push(String(e))),enrichmentPromise=Promise.allSettled([surfacePromise,loadWarnings(),loadTropics(),loadWeather()]);
  await Promise.allSettled([boundaryPromise,radarPromise]);
  if(!state.frames.length){panel.dataset.radar='unavailable';panel.dataset.freshness='stale'}else{panel.dataset.radar='live';panel.dataset.freshness=freshness();state.cursor=Math.max(0,state.frames.length-1);deriveHome();state.startupPrepMs=typeof eWarmCurrentView==='function'&&!state.runtime.lowPower?eWarmCurrentView():null}
  panel.dataset.ready='true';panel.dataset.runtime=state.runtime.lowPower?'low-power':'standard';boot.classList.add('off');window.__RDR__=state;render();
  startAnimation();scheduleRotation();startPolling();
  enrichmentPromise.then(()=>render());setTimeout(()=>deferredSevere(),5000);
  setTimeout(()=>{for(const def of CFG.views){if(def.id===view().id)continue;loadBoundaries(def).catch(e=>state.errors.push(`prefetch ${def.id}: ${e}`))}},1200);
}
init().catch(e=>{state.errors.push(String(e));panel.dataset.ready='true';panel.dataset.radar='unavailable';panel.dataset.freshness='stale';boot.classList.add('off');window.__RDR__=state;render()});
