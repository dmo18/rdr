function renderAll(){ renderCurrent();renderRain();renderForecast();renderClouds();renderStorm();renderAlerts();renderTropical();renderSeverity();renderStatus();renderRadar();computeRotation();updateDiagnostics(); }

function computeRotation(){
  const alert=topAlert(), trop=tropicalAlert(), arrival=rainArrival(), storm=isStormCode(state.weather?.current?.weather_code)||nearStorm();
  let r=[];
  if(alert) r.push('alerts');
  if(trop) r.push('tropical');
  if(storm) r.push('storm','radar');
  else if(arrival || n(state.weather?.current?.rain,0)>0) r.push('radar','rain');
  r.push('current','forecast','radar','clouds');
  if(storm) r.push('storm');
  if(alert) r.push('alerts');
  if(trop) r.push('tropical');
  state.rotation=r; if(!state.rotation.length)state.rotation=['current'];
  state.rotationIndex=Math.max(0,state.rotation.indexOf(state.activeScreen));
  renderDots();
}
function nearStorm(){const h=state.weather?.hourly;if(!h)return false;const s=getHourStartIndex();return h.weather_code.slice(s,s+6).some(isStormCode)}
function durationFor(screen){if(screen==='alerts')return 12000;if(screen==='radar')return rainArrival()||nearStorm()?11500:9000;if(screen==='current')return 10000;return CONFIG.screenDefaultMs}
function showScreen(name){
  if(!screens.some(s=>s.dataset.screen===name))name='current';state.activeScreen=name;screens.forEach(s=>s.classList.toggle('active',s.dataset.screen===name));renderDots();
  if(name==='radar')startRadarAnimation();else stopRadarAnimation();
}
function startRotation(){
  clearTimeout(state.rotationTimer);if(forcedScreen){showScreen(forcedScreen);return}
  const advance=()=>{if(!state.rotation.length)computeRotation();state.rotationIndex=(state.rotationIndex+1)%state.rotation.length;const next=state.rotation[state.rotationIndex];showScreen(next);state.rotationTimer=setTimeout(advance,durationFor(next));};
  state.rotationTimer=setTimeout(advance,durationFor(state.activeScreen));
}
function renderDots(){const host=$('screenDots');host.innerHTML='';const list=state.rotation.length?state.rotation:['current'];list.forEach((s,idx)=>{const i=document.createElement('i');i.classList.toggle('active',forcedScreen?s===state.activeScreen:idx===state.rotationIndex);i.title=s;host.appendChild(i)})}

function buildMapBase(){
  const host=$('mapBase');host.innerHTML=''; const z=8, tile=256, ntiles=2**z; const latRad=CONFIG.lat*Math.PI/180; const xf=(CONFIG.lon+180)/360*ntiles; const yf=(1-Math.asinh(Math.tan(latRad))/Math.PI)/2*ntiles;
  const centerPx={x:xf*tile,y:yf*tile};const startX=Math.floor((centerPx.x-320)/tile)-1,endX=Math.ceil((centerPx.x+320)/tile)+1;const startY=Math.floor((centerPx.y-198)/tile)-1,endY=Math.ceil((centerPx.y+198)/tile)+1;
  for(let x=startX;x<=endX;x++)for(let y=startY;y<=endY;y++){if(y<0||y>=ntiles)continue;const ix=((x%ntiles)+ntiles)%ntiles;const img=document.createElement('img');img.className='map-tile';img.alt='';img.loading='eager';img.referrerPolicy='no-referrer';img.src=`https://tile.openstreetmap.org/${z}/${ix}/${y}.png`;img.style.left=`${320+(x*tile-centerPx.x)}px`;img.style.top=`${198+(y*tile-centerPx.y)}px`;img.onerror=()=>img.remove();host.appendChild(img)}
}
function radarImageUrl(frame){return `${state.radar.host}${frame.path}/512/7/${CONFIG.lat}/${CONFIG.lon}/2/1_1.png`;}
function renderRadar(){
  const overlay=$('radarOverlay'), fallback=$('radarFallback');
  if(demoMode){fallback.classList.remove('hidden');fallback.querySelector('strong').textContent='RADAR SIMULATION MODE';fallback.querySelector('span').textContent='Live radar is intentionally bypassed while deterministic test data is active.';$('radarStamp').textContent='SIMULATION';overlay.removeAttribute('src');return}
  if(!state.radar.ok||!state.radar.frames.length){fallback.classList.remove('hidden');$('radarStamp').textContent='SOURCE UNAVAILABLE';overlay.removeAttribute('src');return}
  fallback.classList.add('hidden'); const f=state.radar.frames[Math.max(0,state.radar.frames.length-1)];overlay.src=radarImageUrl(f);overlay.onerror=()=>{fallback.classList.remove('hidden');state.health.radar='down';renderStatus()};$('radarStamp').textContent=`FRAME ${fmtTime.format(new Date(f.time*1000))}`;
}
function startRadarAnimation(){
  stopRadarAnimation(); if(demoMode||!state.radar.ok||state.radar.frames.length<2)return;state.radar.index=Math.max(0,state.radar.frames.length-6);
  state.radar.timer=setInterval(()=>{const f=state.radar.frames[state.radar.index%state.radar.frames.length];$('radarOverlay').src=radarImageUrl(f);$('radarStamp').textContent=`FRAME ${fmtTime.format(new Date(f.time*1000))}`;state.radar.index++;},850);
}
function stopRadarAnimation(){if(state.radar.timer){clearInterval(state.radar.timer);state.radar.timer=null}}

function updateClock(){const now=new Date();$('clock').textContent=fmtTime.format(now).toUpperCase();document.body.classList.toggle('night',now.getHours()<6||now.getHours()>=21);renderStatus()}
function updateDiagnostics(){
  if(!diagnosticMode)return;const el=$('diagnostics');el.classList.remove('hidden');window.__RDR_DIAGNOSTICS__={version:CONFIG.version,health:{...state.health},updatedAt:state.updatedAt,activeScreen:state.activeScreen,rotation:[...state.rotation],errors:[...state.errors],hasWeather:!!state.weather,alerts:state.alerts.length,radarFrames:state.radar.frames.length};
  el.innerHTML=`<b>RDR DIAGNOSTICS ${CONFIG.version}</b>\nlocation: ${CONFIG.lat}, ${CONFIG.lon}\nnetwork: ${networkEnabled}\nweather: ${state.health.weather}\nalerts: ${state.health.alerts} (${state.alerts.length})\nradar: ${state.health.radar} (${state.radar.frames.length} frames)\nactive: ${state.activeScreen}\nrotation: ${state.rotation.join(' > ')}\nupdated: ${state.updatedAt?new Date(state.updatedAt).toISOString():'none'}\nerrors: ${state.errors.length?state.errors.map(e=>e.message).join(' | '):'none'}`;
}

async function refreshAll(initial=false){
  if(initial)setBoot(networkEnabled?'CONNECTING TO PUBLIC WEATHER SOURCES':'LOADING SIMULATION');
  if(demoMode){applyDemo(demoMode);} else if(!networkEnabled){state.weather=demoWeather('offline');state.updatedAt=Date.now();state.alerts=[];state.health={weather:'stale',alerts:'down',radar:'down'};state.sourceNotes.push('Network disabled: safe local fallback active');}
  else{
    const hadCache=primeFromCache();
    const task=Promise.allSettled([loadWeather(),loadAlerts(),loadRadar()]).then(()=>{if(state.booted)renderAll()});
    await Promise.race([task,sleep(hadCache?1400:5500)]);
  }
  if(!state.weather){state.weather=demoWeather('offline');state.updatedAt=Date.now();state.health.weather='stale';state.sourceNotes.push('Weather source unavailable, safe local fallback active');}
  renderAll();
  if(initial){setBoot('DISPLAY READY');setTimeout(()=>{$('boot').classList.add('off');state.booted=true},300);startRotation();}
}

function fitViewport(){
  const scale=Math.min(innerWidth/640,innerHeight/480);
  $('app').style.transform=`scale(${Math.max(.1,scale)})`;
}

async function init(){
  fitViewport();window.addEventListener('resize',fitViewport,{passive:true});
  buildMapBase();updateClock();setInterval(updateClock,15000);
  await refreshAll(true);
  setInterval(async()=>{await loadWeather();renderAll()},CONFIG.weatherRefreshMs);
  setInterval(async()=>{await loadAlerts();renderAll()},CONFIG.alertRefreshMs);
  setInterval(async()=>{await loadRadar();renderRadar()},CONFIG.radarRefreshMs);
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){updateClock();renderAll()}});
}

init().catch(err=>{recordError(err);setBoot('SAFE FALLBACK ACTIVE');state.weather=demoWeather('offline');state.health.weather='stale';renderAll();setTimeout(()=>$('boot').classList.add('off'),400)});
