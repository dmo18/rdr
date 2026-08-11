const CFG = {
  width: 456,
  height: 257,
  mapHeight: 239,
  home: { lat: 26.06197904865014, lon: -80.18787062578414 },
  local: { center: { lat: 26.06197904865014, lon: -80.18787062578414 }, zoom: 9, width: 456, height: 239 },
  regional: { center: { lat: 25.4, lon: -84.0 }, zoom: 3, width: 145, height: 92 },
  refreshMs: 5 * 60 * 1000,
  frameMs: 720,
  services: {
    local: { url: 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows', layer: 'conus_bref_qcd' },
    kamx: { url: 'https://opengeo.ncep.noaa.gov/geoserver/kamx/ows', layer: 'kamx_sr_bref' },
    conus: { url: 'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows', layer: 'conus_bref_qcd' },
    carib: { url: 'https://opengeo.ncep.noaa.gov/geoserver/carib/carib_bref_qcd/ows', layer: 'carib_bref_qcd' },
    warnings: { url: 'https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows', layer: 'warnings' }
  }
};

const panel = document.getElementById('panel');
const statusTime = document.getElementById('statusTime');
const statusSource = document.getElementById('statusSource');
const statusAlerts = document.getElementById('statusAlerts');
const homeSignal = document.getElementById('homeSignal');
const boot = document.getElementById('boot');

const state = {
  localFrames: [],
  frameIndex: 0,
  frameTimer: null,
  localLoaded: false,
  regionalLoaded: false,
  warningsLoaded: false,
  radarTimes: [],
  lastFrameTime: null,
  errors: []
};

function fitPanel(){
  const scale = Math.min(innerWidth / CFG.width, innerHeight / CFG.height, 1);
  document.documentElement.style.setProperty('--scale', String(Math.max(.2, scale)));
}

function worldPixel(lat, lon, z){
  const n = 2 ** z;
  const x = (lon + 180) / 360 * n * 256;
  const latRad = Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n * 256;
  return { x, y };
}

function pixelToMercator(px, py, z){
  const world = 256 * (2 ** z);
  const half = 20037508.342789244;
  return {
    x: (px / world * 2 - 1) * half,
    y: (1 - py / world * 2) * half
  };
}

function viewport(map){
  const c = worldPixel(map.center.lat, map.center.lon, map.zoom);
  const left = c.x - map.width / 2;
  const right = c.x + map.width / 2;
  const top = c.y - map.height / 2;
  const bottom = c.y + map.height / 2;
  const a = pixelToMercator(left, bottom, map.zoom);
  const b = pixelToMercator(right, top, map.zoom);
  return { left, right, top, bottom, bbox: [a.x, a.y, b.x, b.y] };
}

function renderTiles(hostId, map){
  const host = document.getElementById(hostId);
  host.innerHTML = '';
  const vp = viewport(map);
  const tileMinX = Math.floor(vp.left / 256) - 1;
  const tileMaxX = Math.floor(vp.right / 256) + 1;
  const tileMinY = Math.floor(vp.top / 256) - 1;
  const tileMaxY = Math.floor(vp.bottom / 256) + 1;
  const n = 2 ** map.zoom;
  for(let tx = tileMinX; tx <= tileMaxX; tx++){
    for(let ty = tileMinY; ty <= tileMaxY; ty++){
      if(ty < 0 || ty >= n) continue;
      const ix = ((tx % n) + n) % n;
      const img = document.createElement('img');
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.src = `https://tile.openstreetmap.org/${map.zoom}/${ix}/${ty}.png`;
      img.style.left = `${tx * 256 - vp.left}px`;
      img.style.top = `${ty * 256 - vp.top}px`;
      host.appendChild(img);
    }
  }
}

function wmsUrl(service, map, time = null){
  const vp = viewport(map);
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetMap',
    LAYERS: service.layer, STYLES: '', SRS: 'EPSG:3857',
    BBOX: vp.bbox.join(','), WIDTH: String(map.width), HEIGHT: String(map.height),
    FORMAT: 'image/png', TRANSPARENT: 'TRUE', TILED: 'FALSE'
  });
  if(time) p.set('TIME', time);
  p.set('_', String(Date.now()));
  return `${service.url}?${p.toString()}`;
}


function featureInfoUrl(service, map){
  const vp = viewport(map);
  const p = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
    LAYERS: service.layer, QUERY_LAYERS: service.layer, STYLES: '',
    SRS: 'EPSG:3857', BBOX: vp.bbox.join(','),
    WIDTH: String(map.width), HEIGHT: String(map.height),
    X: String(Math.floor(map.width / 2)), Y: String(Math.floor(map.height / 2)),
    INFO_FORMAT: 'application/json', FEATURE_COUNT: '1'
  });
  p.set('_', String(Date.now()));
  return `${service.url}?${p.toString()}`;
}

function extractReflectivity(payload){
  const props = payload?.features?.[0]?.properties || payload?.properties || {};
  const entries = Object.entries(props);
  const preferred = entries.filter(([key]) => /gray|value|reflect|bref|dbz/i.test(key));
  const candidates = [...preferred, ...entries];
  for(const [, raw] of candidates){
    const value = Number(raw);
    if(Number.isFinite(value) && value >= -50 && value <= 100) return value;
  }
  return null;
}

function classifyReflectivity(dbz){
  if(dbz == null || dbz < 5) return { label: 'DRY', color: '#8fd3ff' };
  if(dbz < 20) return { label: 'SPRINKLE', color: '#69e58b' };
  if(dbz < 35) return { label: 'RAIN', color: '#ffe05a' };
  if(dbz < 50) return { label: 'HEAVY', color: '#ff9a45' };
  return { label: 'INTENSE', color: '#ff5367' };
}

async function updateHomeRain(){
  try{
    const r = await fetch(featureInfoUrl(CFG.services.local, CFG.local), { cache: 'no-store', mode: 'cors' });
    if(!r.ok) throw new Error(`home reflectivity ${r.status}`);
    const payload = await r.json();
    const dbz = extractReflectivity(payload);
    const status = classifyReflectivity(dbz);
    homeSignal.textContent = status.label;
    homeSignal.style.color = status.color;
    panel.dataset.homeRain = status.label.toLowerCase();
    if(dbz != null) panel.dataset.homeDbz = dbz.toFixed(1);
  }catch(err){
    state.errors.push(`home rain: ${err.message || err}`);
    if(state.localLoaded){
      homeSignal.textContent = 'RADAR';
      homeSignal.style.color = '#dbe9f4';
      panel.dataset.homeRain = 'unknown';
    }
  }
}

function addWmsImage(hostId, service, map, options = {}){
  const host = document.getElementById(hostId);
  if(options.replace !== false) host.innerHTML = '';
  const img = document.createElement('img');
  if(options.className) img.className = options.className;
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  img.src = wmsUrl(service, map, options.time || null);
  if(options.onLoad) img.addEventListener('load', () => options.onLoad(img), { once:true });
  if(options.onError) img.addEventListener('error', () => options.onError(img), { once:true });
  host.appendChild(img);
  return img;
}

function parseTimeDimension(xmlText, layerName){
  try{
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const layers = [...xml.querySelectorAll('Layer')];
    const layer = layers.find(l => l.querySelector(':scope > Name')?.textContent?.trim() === layerName) || layers.find(l => l.textContent.includes(layerName));
    const el = layer?.querySelector('Dimension[name="time"], Extent[name="time"]');
    if(!el) return [];
    const raw = el.textContent.trim();
    if(!raw) return [];
    if(raw.includes(',') && !raw.includes('/')) return raw.split(',').map(s => s.trim()).filter(Boolean).slice(-10);
    if(raw.includes('/')){
      const [startS, endS, stepS='PT5M'] = raw.split('/');
      const start = new Date(startS), end = new Date(endS);
      const m = stepS.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      const step = m ? ((+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0))) * 1000 : 300000;
      if(!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || step <= 0) return [];
      const out=[];
      const first = Math.max(start.getTime(), end.getTime() - step * 9);
      for(let t=first;t<=end.getTime()+1000;t+=step) out.push(new Date(t).toISOString());
      return out.slice(-10);
    }
    return [raw];
  }catch(err){ state.errors.push(String(err)); return []; }
}

async function fetchRadarTimes(){
  const s = CFG.services.local;
  const u = `${s.url}?service=WMS&version=1.1.1&request=GetCapabilities&_=${Date.now()}`;
  try{
    const r = await fetch(u, { cache:'no-store', mode:'cors' });
    if(!r.ok) throw new Error(`capabilities ${r.status}`);
    return parseTimeDimension(await r.text(), s.layer);
  }catch(err){
    state.errors.push(`radar time list: ${err.message || err}`);
    return [];
  }
}

function startFrameLoop(){
  clearInterval(state.frameTimer);
  if(state.localFrames.length < 2) return;
  const step = () => {
    state.localFrames.forEach(img => img.classList.remove('active'));
    state.frameIndex = (state.frameIndex + 1) % state.localFrames.length;
    const img = state.localFrames[state.frameIndex];
    img.classList.add('active');
    const t = img.dataset.time;
    if(t) state.lastFrameTime = new Date(t);
    updateTelemetry();
  };
  state.frameIndex = Math.max(0, state.localFrames.length - 2);
  step();
  state.frameTimer = setInterval(step, CFG.frameMs);
}

async function loadLocalRadar(){
  const host = document.getElementById('localRadar');
  host.innerHTML = '';
  state.localFrames = [];
  state.localLoaded = false;
  const times = await fetchRadarTimes();
  state.radarTimes = times;
  const wanted = times.length ? times.slice(-8) : [null];
  let loaded = 0;
  const done = () => {
    loaded++;
    if(loaded === 1){
      state.localLoaded = true;
      panel.dataset.localRadar = 'ok';
      homeSignal.textContent = 'RADAR';
      homeSignal.style.color = '#dbe9f4';
      maybeReady();
    }
    if(loaded === wanted.length) startFrameLoop();
  };
  wanted.forEach((time, idx) => {
    const img = addWmsImage('localRadar', CFG.services.local, CFG.local, {
      replace:false,
      time,
      onLoad:done,
      onError:() => {
        if(idx === wanted.length - 1 && !state.localLoaded) loadLocalFallback();
      }
    });
    img.dataset.time = time || '';
    if(idx === wanted.length - 1) img.classList.add('active');
    state.localFrames.push(img);
  });
  if(times.length) state.lastFrameTime = new Date(times[times.length-1]);
}

function loadLocalFallback(){
  const host = document.getElementById('localRadar');
  host.innerHTML=''; state.localFrames=[];
  const img = addWmsImage('localRadar', CFG.services.kamx, CFG.local, {
    onLoad: () => {
      img.classList.add('active');
      state.localFrames=[img]; state.localLoaded=true; panel.dataset.localRadar='fallback';
      statusSource.textContent='KAMX FALLBACK'; homeSignal.textContent='RADAR'; homeSignal.style.color='#ffd36b'; maybeReady(); updateTelemetry();
    },
    onError: () => { panel.dataset.localRadar='down'; homeSignal.textContent='NO RADAR'; homeSignal.style.color='#ff7c8e'; maybeReady(); }
  });
}

function loadWarnings(){
  state.warningsLoaded = false;
  addWmsImage('localWarnings', CFG.services.warnings, CFG.local, {
    onLoad: () => { state.warningsLoaded=true; statusAlerts.textContent='ALERTS ON'; },
    onError: () => { statusAlerts.textContent='ALERTS ?'; }
  });
  addWmsImage('regionalWarnings', CFG.services.warnings, CFG.regional);
}

function loadRegional(){
  state.regionalLoaded = false;
  let ok=0;
  const loaded=()=>{ ok++; if(ok>=1){ state.regionalLoaded=true; panel.dataset.regionalRadar='ok'; maybeReady(); } };
  addWmsImage('regionalConus', CFG.services.conus, CFG.regional, { onLoad:loaded });
  addWmsImage('regionalCarib', CFG.services.carib, CFG.regional, { onLoad:loaded });
  positionRegionalHome();
}

function positionRegionalHome(){
  const vp=viewport(CFG.regional); const p=worldPixel(CFG.home.lat,CFG.home.lon,CFG.regional.zoom);
  const x=(p.x-vp.left)/CFG.regional.width*100; const y=(p.y-vp.top)/CFG.regional.height*100;
  const el=document.querySelector('.regional-home'); el.style.left=`${x}%`; el.style.top=`${y}%`;
}

function updateTelemetry(){
  const d = state.lastFrameTime && Number.isFinite(state.lastFrameTime.getTime()) ? state.lastFrameTime : new Date();
  statusTime.textContent = d.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}).toUpperCase();
}

function maybeReady(){
  if(state.localLoaded || panel.dataset.localRadar === 'down'){
    panel.dataset.ready='true';
    setTimeout(()=>boot.classList.add('off'), 250);
  }
}

async function refreshAll(){
  renderTiles('localBase', CFG.local);
  renderTiles('regionalBase', CFG.regional);
  await loadLocalRadar();
  loadRegional();
  loadWarnings();
  updateTelemetry();
  updateHomeRain();
}

function init(){
  fitPanel(); addEventListener('resize',fitPanel,{passive:true});
  renderTiles('localBase', CFG.local); renderTiles('regionalBase', CFG.regional); positionRegionalHome();
  refreshAll();
  setInterval(refreshAll, CFG.refreshMs);
  setInterval(updateTelemetry, 15000);
  window.__RDR_DIAGNOSTICS__ = state;
}

init();
