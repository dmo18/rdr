'use strict';

async function showView(index){
  const next=(index+CFG.views.length)%CFG.views.length,def=CFG.views[next];
  await Promise.allSettled([loadBoundaries(def),loadSurfaceObs(def)]);
  state.view=next;panel.dataset.view=def.id;state.cursor=Math.max(0,state.frames.length-1);state.transition=null;
  if(typeof eWarmCurrentView==='function')eWarmCurrentView();render();
}
function scheduleRotation(){clearTimeout(state.rotateTimer);if(forcedView)return;state.rotateTimer=setTimeout(async()=>{await showView(state.view+1);scheduleRotation()},view().duration)}
function advanceRadarFrame(){if(state.frames.length<2)return;const from=clamp(state.cursor,0,state.frames.length-1),to=(from+1)%state.frames.length;state.transition={from,to,start:performance.now()};state.cursor=to}
function paintLoop(now){if(now-state.lastPaint>=1000/CFG.animFps){state.lastPaint=now;render(now)}state.raf=requestAnimationFrame(paintLoop)}
function startAnimation(){clearInterval(state.animTimer);state.animTimer=setInterval(advanceRadarFrame,CFG.radarFrameMs);if(state.raf)cancelAnimationFrame(state.raf);state.lastPaint=0;state.raf=requestAnimationFrame(paintLoop)}
function startPolling(){clearInterval(state.pollTimer);clearInterval(state.vectorTimer);clearInterval(state.severeTimer);state.pollTimer=setInterval(()=>pollRadar().catch(e=>state.errors.push(String(e))),CFG.pollMs);state.vectorTimer=setInterval(()=>refreshVectors().catch(e=>state.errors.push(String(e))),CFG.vectorMs);state.severeTimer=setInterval(()=>loadSevere().catch(e=>state.errors.push(String(e))),CFG.severeMs)}
async function init(){
  fitPanel();addEventListener('resize',fitPanel,{passive:true});
  if(forcedView){const i=CFG.views.findIndex(v=>v.id===forcedView);if(i>=0)state.view=i}
  panel.dataset.view=view().id;render();
  const contextPromise=refreshVectors().catch(e=>state.errors.push(String(e))),radarPromise=pollRadar({initial:true}).catch(e=>state.errors.push(String(e)));
  await Promise.allSettled([contextPromise,radarPromise]);
  if(!state.frames.length){panel.dataset.radar='unavailable';panel.dataset.freshness='stale'}else{panel.dataset.radar='live';panel.dataset.freshness=freshness();state.cursor=Math.max(0,state.frames.length-1);deriveHome();state.startupPrepMs=typeof eWarmCurrentView==='function'?eWarmCurrentView():null}
  panel.dataset.ready='true';boot.classList.add('off');render();
  if(!verifyMode)await loadSevere().catch(e=>state.errors.push(String(e)));
  state.cursor=Math.max(0,state.frames.length-1);deriveHome();if(typeof eWarmCurrentView==='function')eWarmCurrentView();render();startAnimation();scheduleRotation();startPolling();window.__RDR__=state;
  setTimeout(async()=>{for(const def of CFG.views){if(def.id===view().id)continue;try{await loadBoundaries(def)}catch(e){state.errors.push(`prefetch ${def.id}: ${e}`)}}},0);
}
init().catch(e=>{state.errors.push(String(e));panel.dataset.ready='true';panel.dataset.radar='unavailable';panel.dataset.freshness='stale';boot.classList.add('off');render()});
