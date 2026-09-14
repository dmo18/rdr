'use strict';
(async()=>{
 const ids=['home','metro','florida','regional'],q=new URLSearchParams(location.search),id=ids.includes(q.get('view'))?q.get('view'):'florida';
 const r=await fetch('fixture.json',{cache:'no-store'});if(!r.ok)throw new Error(`fixture ${r.status}`);const fx=await r.json();
 const typed=o=>Object.fromEntries(Object.entries(o||{}).map(([k,a])=>[k,Int16Array.from(a)]));
 state.view=CFG.views.findIndex(v=>v.id===id);state.frames=(fx.runtime?.frames||[]).map(f=>({key:f.key,time:new Date(f.time),views:typed(f.views)}));state.cursor=Math.max(0,state.frames.length-1);
 state.severe.lightning=fx.runtime?.severe?.lightning?{...fx.runtime.severe.lightning,time:new Date(fx.runtime.severe.lightning.time),views:typed(fx.runtime.severe.lightning.views)}:null;
 state.severe.mesh=fx.runtime?.severe?.mesh?{...fx.runtime.severe.mesh,time:new Date(fx.runtime.severe.mesh.time),views:typed(fx.runtime.severe.mesh.views)}:null;
 state.warnings=new Map((fx.runtime?.warnings||[]).map((f,i)=>[String(f.id??f.properties?.OBJECTID??i),f]));state.tropics=fx.runtime?.tropics||[];
 for(const v of ids){const x=fx.views?.[v];if(x?.boundaries)state.boundaries.set(v,x.boundaries);if(x?.surface)state.surface.set(v,x.surface)}
 const vx=fx.views?.[id]||{};state.weather=vx.weather||fx.runtime?.weather||null;if(state.weather?.time)state.weather.time=new Date(state.weather.time);if(state.weather?.forecast?.startTime)state.weather.forecast.startTime=new Date(state.weather.forecast.startTime);state.home=vx.home||fx.runtime?.home||state.home;state.motion=vx.motion||fx.runtime?.motion||null;if(state.frames.length)deriveHome();
 panel.dataset.view=id;panel.dataset.ready='true';panel.dataset.radar='live';panel.dataset.freshness='live';panel.dataset.surface='live';boot.classList.add('off');
 const first0=performance.now();render(first0);const firstPaintMs=performance.now()-first0,prepMs=typeof eWarmCurrentView==='function'?eWarmCurrentView():null;state.perf={samples:[]};const manual=[];for(let i=0;i<90;i++){const t=performance.now();render(t);manual.push(performance.now()-t)}manual.sort((a,b)=>a-b);const stats={avg:manual.reduce((a,b)=>a+b,0)/manual.length,p50:manual[Math.floor(manual.length*.5)],p95:manual[Math.floor(manual.length*.95)],max:manual.at(-1),count:manual.length};window.__RDR__=state;window.__QA__={ready:true,capturedAt:fx.capturedAt,view:id,firstPaintMs,prepMs,warm:stats,frames:state.frames.length,severe:{lightning:!!state.severe.lightning,mesh:!!state.severe.mesh}};render(performance.now());
})().catch(e=>{console.error(e);window.__QA__={ready:false,error:e.message,stack:e.stack};document.body.dataset.qaError=e.message});
