'use strict';

const CONFIG = Object.freeze({
  lat: 26.06197904865014,
  lon: -80.18787062578414,
  timezone: 'America/New_York',
  location: 'BROWARD COUNTY, FL',
  weatherRefreshMs: 10 * 60 * 1000,
  alertRefreshMs: 5 * 60 * 1000,
  radarRefreshMs: 5 * 60 * 1000,
  screenDefaultMs: 9000,
  cacheKey: 'rdr.weather.cache.v3',
  version: '3.0.0'
});

const qs = new URLSearchParams(location.search);
const demoMode = qs.get('demo');
const forcedScreen = qs.get('screen');
const diagnosticMode = qs.has('diag') || qs.has('diagnostics');
const networkEnabled = !demoMode && !qs.has('offline');

const state = {
  weather: null,
  alerts: [],
  radar: {host:'', frames:[], index:0, timer:null, ok:false, updated:0},
  health: {weather:'pending', alerts:'pending', radar:'pending'},
  updatedAt: 0,
  activeScreen: 'current',
  rotation: [],
  rotationIndex: 0,
  rotationTimer: null,
  errors: [],
  booted: false,
  sourceNotes: []
};

const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll('.screen')];
const fmtTime = new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:CONFIG.timezone});
const fmtHour = new Intl.DateTimeFormat('en-US',{hour:'numeric',timeZone:CONFIG.timezone});
const fmtShort = new Intl.DateTimeFormat('en-US',{weekday:'short',hour:'numeric',minute:'2-digit',timeZone:CONFIG.timezone});
const toDate = (v) => new Date(typeof v === 'number' ? v*1000 : v);
const toMs = (v) => toDate(v).getTime();

window.addEventListener('error', e => recordError(`JS: ${e.message}`));
window.addEventListener('unhandledrejection', e => recordError(`PROMISE: ${String(e.reason?.message || e.reason)}`));

function recordError(message){
  state.errors.push({at:new Date().toISOString(), message:String(message).slice(0,220)});
  if(state.errors.length > 20) state.errors.shift();
  updateDiagnostics();
}

function setBoot(message){ $('bootStatus').textContent = message; }
function sleep(ms){ return new Promise(r => setTimeout(r,ms)); }

async function fetchJson(url, label, timeoutMs=8500, tries=2){
  let last;
  for(let n=0;n<tries;n++){
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try{
      const res = await fetch(url,{signal:ctl.signal,cache:'no-store',headers:{'Accept':'application/json'}});
      if(!res.ok) throw new Error(`${label} HTTP ${res.status}`);
      const json = await res.json();
      clearTimeout(timer);
      return json;
    }catch(err){
      clearTimeout(timer); last = err;
      if(n+1 < tries) await sleep(650*(n+1));
    }
  }
  throw last || new Error(`${label} failed`);
}

function weatherUrl(){
  const varsCurrent = 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m';
  const varsHourly = 'temperature_2m,precipitation_probability,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_gusts_10m';
  const vars15 = 'precipitation,rain,weather_code';
  return `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.lat}&longitude=${CONFIG.lon}&current=${varsCurrent}&hourly=${varsHourly}&minutely_15=${vars15}&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=${encodeURIComponent(CONFIG.timezone)}&timeformat=unixtime&forecast_days=2`;
}

function alertsUrl(){ return `https://api.weather.gov/alerts/active?point=${CONFIG.lat},${CONFIG.lon}`; }

function validateWeather(w){
  if(!w || !w.current || !w.hourly || !Array.isArray(w.hourly.time)) throw new Error('Weather payload missing required fields');
  if(!Number.isFinite(Number(w.current.temperature_2m))) throw new Error('Weather payload has invalid temperature');
  return w;
}

async function loadWeather(){
  if(!networkEnabled){ state.health.weather='demo'; return; }
  try{
    const w = validateWeather(await fetchJson(weatherUrl(),'weather'));
    state.weather = w; state.health.weather='ok'; state.updatedAt=Date.now();
    persistCache();
  }catch(err){
    state.health.weather='down'; recordError(err);
    const cached = readCache();
    if(cached?.weather){ state.weather = cached.weather; state.updatedAt = cached.updatedAt || 0; state.health.weather='stale'; }
  }
}

async function loadAlerts(){
  if(!networkEnabled){ state.health.alerts='demo'; return; }
  try{
    const j = await fetchJson(alertsUrl(),'alerts',8500,2);
    state.alerts = Array.isArray(j.features) ? j.features.map(f=>f.properties||{}).filter(Boolean) : [];
    state.health.alerts='ok'; persistCache();
  }catch(err){
    state.health.alerts='down'; recordError(err);
    const cached = readCache();
    if(Array.isArray(cached?.alerts)){ state.alerts = cached.alerts; state.health.alerts='stale'; }
  }
}

async function loadRadar(){
  if(!networkEnabled){ state.health.radar='demo'; state.radar.ok=true; return; }
  try{
    const j = await fetchJson('https://api.rainviewer.com/public/weather-maps.json','radar',8500,2);
    const frames = j?.radar?.past;
    if(!j?.host || !Array.isArray(frames) || !frames.length) throw new Error('Radar payload missing frames');
    state.radar.host = j.host; state.radar.frames = frames.slice(-10); state.radar.updated=Date.now(); state.radar.ok=true; state.health.radar='ok';
  }catch(err){
    state.health.radar='down'; state.radar.ok=false; recordError(err);
  }
}

function persistCache(){
  try{ localStorage.setItem(CONFIG.cacheKey,JSON.stringify({weather:state.weather,alerts:state.alerts,updatedAt:state.updatedAt,savedAt:Date.now()})); }catch(_){}
}
function readCache(){
  try{ const v=JSON.parse(localStorage.getItem(CONFIG.cacheKey)||'null'); return v && v.savedAt && (Date.now()-v.savedAt < 12*60*60*1000) ? v : null; }catch(_){ return null; }
}
function primeFromCache(){
  if(demoMode || !networkEnabled) return false;
  const cached=readCache(); if(!cached?.weather) return false;
  state.weather=cached.weather; state.alerts=Array.isArray(cached.alerts)?cached.alerts:[]; state.updatedAt=cached.updatedAt||cached.savedAt||0;
  state.health.weather='stale'; state.health.alerts='stale';
  return true;
}

function demoWeather(kind='clear'){
  const now = new Date(); now.setMinutes(0,0,0);
  const hourly={time:[],temperature_2m:[],precipitation_probability:[],precipitation:[],rain:[],weather_code:[],cloud_cover:[],wind_speed_10m:[],wind_gusts_10m:[]};
  const min15={time:[],precipitation:[],rain:[],weather_code:[]};
  const profiles={
    clear:{t:86,code:1,cloud:18,wind:9,gust:14,pop:[5,7,9,12,14,18],rain:[0,0,0,0,0,0]},
    rain:{t:82,code:61,cloud:84,wind:13,gust:22,pop:[35,68,88,76,45,24],rain:[0,.05,.18,.13,.03,0]},
    storm:{t:84,code:95,cloud:91,wind:18,gust:38,pop:[58,84,92,88,63,37],rain:[.02,.15,.31,.25,.09,.01]},
    severe:{t:83,code:96,cloud:96,wind:24,gust:51,pop:[72,91,96,89,71,42],rain:[.06,.22,.42,.31,.14,.03]},
    hurricane:{t:81,code:95,cloud:100,wind:41,gust:69,pop:[90,96,98,98,95,90],rain:[.25,.43,.55,.61,.48,.37]},
    offline:{t:84,code:2,cloud:45,wind:10,gust:16,pop:[20,24,27,22,18,15],rain:[0,0,0,0,0,0]}
  };
  const p=profiles[kind]||profiles.clear;
  for(let i=0;i<24;i++){
    const d=new Date(now.getTime()+i*3600000); hourly.time.push(localIso(d));
    hourly.temperature_2m.push(p.t-Math.min(i,8)*.8); hourly.precipitation_probability.push(p.pop[i%6]); hourly.precipitation.push(p.rain[i%6]); hourly.rain.push(p.rain[i%6]); hourly.weather_code.push(i<5?p.code:2); hourly.cloud_cover.push(Math.max(10,Math.min(100,p.cloud+(i-2)*3))); hourly.wind_speed_10m.push(p.wind+i*.3); hourly.wind_gusts_10m.push(p.gust+i*.5);
  }
  for(let i=0;i<16;i++){
    const d=new Date(Date.now()+i*15*60000); min15.time.push(localIso(d));
    const r=(kind==='rain'||kind==='storm'||kind==='severe'||kind==='hurricane') && i>=2 ? Math.max(.01,p.rain[Math.min(5,Math.floor(i/4))]) : 0;
    min15.precipitation.push(r); min15.rain.push(r); min15.weather_code.push(r>0?p.code:2);
  }
  return {current:{time:localIso(new Date()),temperature_2m:p.t,relative_humidity_2m:74,apparent_temperature:p.t+5,is_day:1,precipitation:p.rain[0],rain:p.rain[0],weather_code:p.code,cloud_cover:p.cloud,wind_speed_10m:p.wind,wind_direction_10m:135,wind_gusts_10m:p.gust},hourly,minutely_15:min15};
}
function localIso(d){ const z=n=>String(n).padStart(2,'0'); return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; }

function applyDemo(){
  state.weather=demoWeather(demoMode||'clear'); state.updatedAt=Date.now();
  state.alerts=[];
  if(demoMode==='severe') state.alerts=[{event:'Severe Thunderstorm Warning',severity:'Severe',headline:'Severe Thunderstorm Warning issued for central Broward County',description:'Damaging wind gusts and frequent lightning are possible in the warned area.',areaDesc:'Broward County',expires:new Date(Date.now()+45*60000).toISOString()}];
  if(demoMode==='hurricane') state.alerts=[{event:'Hurricane Warning',severity:'Extreme',headline:'Hurricane Warning in effect for coastal Broward County',description:'Hurricane conditions are expected. Follow official local emergency instructions.',areaDesc:'Coastal Broward County',expires:new Date(Date.now()+8*3600000).toISOString()}];
  state.health={weather:'demo',alerts:'demo',radar:'demo'};
}

function codeInfo(code){
  code=Number(code);
  if(code===0) return ['CLEAR','☀']; if(code<=2) return [code===1?'MOSTLY CLEAR':'PARTLY CLOUDY','◒']; if(code===3) return ['OVERCAST','☁'];
  if([45,48].includes(code)) return ['FOG','≋']; if([51,53,55,56,57].includes(code)) return ['DRIZZLE','⌁'];
  if([61,63,65,66,67,80,81,82].includes(code)) return ['RAIN','☂']; if([71,73,75,77,85,86].includes(code)) return ['SNOW','✣'];
  if([95,96,99].includes(code)) return ['THUNDERSTORMS','ϟ']; return ['VARIABLE','◌'];
}
function windDir(deg){ const a=['N','NE','E','SE','S','SW','W','NW']; return a[Math.round(Number(deg||0)/45)%8]; }
function n(v,f='--'){ return Number.isFinite(Number(v)) ? Number(v) : f; }
function round(v){ return Math.round(n(v,0)); }
function isStormCode(c){ return [95,96,99].includes(Number(c)); }
function isRainCode(c){ return [51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99].includes(Number(c)); }
function getHourStartIndex(){
  const t=state.weather?.hourly?.time||[]; if(!t.length) return 0;
  const now=Date.now(); let best=0,bestDiff=Infinity; t.forEach((x,i)=>{const d=Math.abs(toMs(x)-now); if(d<bestDiff){best=i;bestDiff=d}}); return best;
}

function buildIntelligence(){
  const w=state.weather; if(!w) return 'LIVE WEATHER UNAVAILABLE';
  const c=w.current; const alert=topAlert();
  if(alert) return String(alert.event||'WEATHER ALERT').toUpperCase();
  if(isStormCode(c.weather_code)) return 'THUNDERSTORMS IN THE AREA';
  if(n(c.rain,0)>0 || n(c.precipitation,0)>0) return 'RAIN OCCURRING NOW';
  const arrival=rainArrival(); if(arrival) return `RAIN POSSIBLE ${arrival.label}`;
  const idx=getHourStartIndex(); const six=(w.hourly.precipitation_probability||[]).slice(idx,idx+6); const max=Math.max(0,...six.map(x=>n(x,0)));
  if(max>=60) return 'RAIN LIKELY IN THE NEXT 6 HOURS';
  if(n(c.cloud_cover,0)>=85) return 'OVERCAST · NO IMMEDIATE HAZARD SIGNAL';
  return 'NO IMMEDIATE WEATHER HAZARDS';
}

function rainArrival(){
  const m=state.weather?.minutely_15; if(!m?.time?.length) return null;
  const now=Date.now();
  for(let i=0;i<m.time.length;i++){
    const amount=n(m.rain?.[i],n(m.precipitation?.[i],0)); if(amount<=0.002 && !isRainCode(m.weather_code?.[i])) continue;
    const at=toMs(m.time[i]); if(at < now-10*60000) continue;
    const mins=Math.max(0,Math.round((at-now)/60000));
    return {mins,at,label:mins<=5?'NOW':mins<60?`IN ~${Math.ceil(mins/5)*5} MIN`:`AROUND ${fmtTime.format(at)}`};
  }
  return null;
}

function topAlert(){
  if(!state.alerts.length) return null;
  const score=a=>{const e=(a.event||'').toLowerCase(); if(e.includes('tornado'))return 100;if(e.includes('hurricane'))return 95;if(e.includes('tropical storm'))return 90;if(e.includes('severe thunderstorm'))return 85;if(e.includes('flash flood'))return 82;if((a.severity||'').toLowerCase()==='extreme')return 80;if((a.severity||'').toLowerCase()==='severe')return 70;return 40};
  return [...state.alerts].sort((a,b)=>score(b)-score(a))[0];
}
function tropicalAlert(){ return state.alerts.find(a=>/hurricane|tropical storm|storm surge/i.test(`${a.event||''} ${a.headline||''}`)); }
