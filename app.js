const CFG = {
  width: 456,
  height: 257,
  mapHeight: 257,
  home: { lat: 26.06197904865014, lon: -80.18787062578414 },
  refreshMs: 5 * 60 * 1000,
  weatherRefreshMs: 15 * 60 * 1000,
  frameMs: 850,
  views: [
    { id:'home', name:'HOME', type:'radar', center:{lat:26.06197904865014,lon:-80.18787062578414}, zoom:10, duration:14000, sources:['conus'], labels:['plantation','davie','hollywood','dania','fortlauderdale','hallandale','miramar','pembroke','aventura'] },
    { id:'metro', name:'BROWARD / MIAMI', type:'radar', center:{lat:25.92,lon:-80.35}, zoom:8, duration:9000, sources:['conus'], labels:['fortlauderdale','miami','bocaraton','westpalm','homestead','keylargo','hollywood','pembroke'] },
    { id:'florida', name:'FLORIDA', type:'radar', center:{lat:27.05,lon:-81.45}, zoom:6, duration:8000, sources:['conus'], labels:['miami','keywest','naples','fortmyers','tampa','orlando','jacksonville','westpalm'] },
    { id:'regional', name:'GULF / CUBA', type:'radar', center:{lat:24.8,lon:-83.6}, zoom:5, duration:8000, sources:['conus','carib'], labels:['florida','cuba','havana','bahamas','yucatan','keywest','miami','gulf'] },
    { id:'satellite', name:'SATELLITE', type:'image', duration:7000, image:'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/se/GEOCOLOR/1200x1200.jpg', source:'GOES EAST · CLOUDS · SOUTHEAST' },
    { id:'lightning', name:'LIGHTNING', type:'image', duration:7000, image:'https://cdn.star.nesdis.noaa.gov/GOES19/GLM/SECTOR/se/EXTENT3/1200x1200.jpg', source:'GOES EAST GLM · FLASH EXTENT DENSITY' },
    { id:'tropics', name:'TROPICS', type:'image', duration:8000, image:'https://www.nhc.noaa.gov/xgtwo/two_atl_7d0.png', source:'NHC · ATLANTIC 7-DAY TROPICAL OUTLOOK' }
  ],
  places: {
    plantation:{lat:26.1276,lon:-80.2331,label:'PLANTATION'}, davie:{lat:26.0765,lon:-80.2521,label:'DAVIE'}, hollywood:{lat:26.0112,lon:-80.1495,label:'HOLLYWOOD',major:true}, dania:{lat:26.0523,lon:-80.1439,label:'DANIA'}, fortlauderdale:{lat:26.1224,lon:-80.1373,label:'FORT LAUDERDALE',major:true}, hallandale:{lat:25.9812,lon:-80.1484,label:'HALLANDALE'}, miramar:{lat:25.9861,lon:-80.3036,label:'MIRAMAR'}, pembroke:{lat:26.0078,lon:-80.2963,label:'PEMBROKE'}, aventura:{lat:25.9565,lon:-80.1392,label:'AVENTURA'},
    miami:{lat:25.7617,lon:-80.1918,label:'MIAMI',major:true}, bocaraton:{lat:26.3683,lon:-80.1289,label:'BOCA RATON'}, westpalm:{lat:26.7153,lon:-80.0534,label:'WEST PALM'}, homestead:{lat:25.4687,lon:-80.4776,label:'HOMESTEAD'}, keylargo:{lat:25.0865,lon:-80.4473,label:'KEY LARGO'}, keywest:{lat:24.5551,lon:-81.7800,label:'KEY WEST',major:true}, naples:{lat:26.1423,lon:-81.7948,label:'NAPLES'}, fortmyers:{lat:26.6406,lon:-81.8723,label:'FORT MYERS'}, tampa:{lat:27.9506,lon:-82.4572,label:'TAMPA',major:true}, orlando:{lat:28.5383,lon:-81.3792,label:'ORLANDO',major:true}, jacksonville:{lat:30.3322,lon:-81.6557,label:'JACKSONVILLE'},
    florida:{lat:27.5,lon:-81.6,label:'FLORIDA',region:true}, cuba:{lat:22.4,lon:-79.7,label:'CUBA',region:true}, havana:{lat:23.1136,lon:-82.3666,label:'HAVANA'}, bahamas:{lat:24.4,lon:-76.7,label:'BAHAMAS',region:true}, yucatan:{lat:20.8,lon:-87.1,label:'YUCATÁN',region:true}, gulf:{lat:25.8,lon:-90.0,label:'GULF OF MEXICO',region:true}
  },
  services: {
    conus:{url:'https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows',layer:'conus_bref_qcd'},
    carib:{url:'https://opengeo.ncep.noaa.gov/geoserver/carib/carib_bref_qcd/ows',layer:'carib_bref_qcd'},
    warnings:{url:'https://opengeo.ncep.noaa.gov/geoserver/wwa/warnings/ows',layer:'warnings'}
  }
};

const panel = document.getElementById('panel');
const viewsHost = document.getElementById('views');
const boot = document.getElementById('boot');
const viewName = document.getElementById('viewName');
const homeState = document.getElementById('homeState');
const nearestRain = document.getElementById('nearestRain');
const nowTemp = document.getElementById('nowTemp');
const nowWx = document.getElementById('nowWx');
const forecast = document.getElementById('forecast');
const sourceBadge = document.getElementById('sourceBadge');
const weatherLine = document.getElementById('weatherLine');
const alertLine = document.getElementById('alertLine');
const loopRange = document.getElementById('loopRange');
const radarTime = document.getElementById('radarTime');
const query = new URLSearchParams(location.search);
const forcedView = query.get('view');
const demo = query.get('demo') === '1';

const state = {
  current:0,
  rotateTimer:null,
  frameTimer:null,
  frameIndex:0,
  times:new Map(),
  nodes:new Map(),
  loaded:new Set(),
  homeDbz:null,
  homeStatus:'LOADING',
  nearest:null,
  weather:{temp:null,short:'LOADING',sky:null,pop:null,periods:[],thunder:false,alerts:[]},
  errors:[]
};

function fitPanel(){
  const scale = Math.min(innerWidth / CFG.width, innerHeight / CFG.height);
  panel.style.transform = `scale(${Math.max(.2, scale)})`;
}
function worldPixel(lat,lon,z){
  const n=2**z,x=(lon+180)/360*n*256,lr=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180,y=(1-Math.asinh(Math.tan(lr))/Math.PI)/2*n*256;
  return{x,y};
}
function pixelToMercator(px,py,z){const world=256*(2**z),half=20037508.342789244;return{x:(px/world*2-1)*half,y:(1-py/world*2)*half}}
function viewMap(def){return{center:def.center,zoom:def.zoom,width:CFG.width,height:CFG.mapHeight}}
function viewport(map){
  const c=worldPixel(map.center.lat,map.center.lon,map.zoom),left=c.x-map.width/2,right=c.x+map.width/2,top=c.y-map.height/2,bottom=c.y+map.height/2,a=pixelToMercator(left,bottom,map.zoom),b=pixelToMercator(right,top,map.zoom);
  return{left,right,top,bottom,bbox:[a.x,a.y,b.x,b.y]};
}
function latLonToPercent(lat,lon,map){const vp=viewport(map),p=worldPixel(lat,lon,map.zoom);return{x:(p.x-vp.left)/map.width*100,y:(p.y-vp.top)/map.height*100}}

function makeView(def){
  const root=document.createElement('section');root.className='weather-view';root.dataset.view=def.id;
  if(def.type==='radar'){
    root.innerHTML='<div class="tile-layer"></div><div class="radar-layer radar-a"></div><div class="radar-layer radar-b"></div><div class="warning-layer"></div><div class="shade"></div><div class="label-layer"></div>';
    const node={root,base:root.querySelector('.tile-layer'),radarA:root.querySelector('.radar-a'),radarB:root.querySelector('.radar-b'),warnings:root.querySelector('.warning-layer'),labels:root.querySelector('.label-layer'),def,frames:[],lastFrameTime:null};
    state.nodes.set(def.id,node);if(!demo)renderBase(node);renderLabels(node);
  }else{
    root.innerHTML='<div class="image-layer"><img alt=""></div><div class="shade"></div>';
    const img=root.querySelector('img');img.referrerPolicy='no-referrer';img.addEventListener('load',()=>{root.dataset.image='ok';state.loaded.add(def.id)},{once:false});img.addEventListener('error',()=>{root.dataset.image='down';state.errors.push(`${def.id} image`)},{once:false});if(demo){root.dataset.image='demo';state.loaded.add(def.id)}else img.src=def.image;
    state.nodes.set(def.id,{root,def,img,frames:[],lastFrameTime:null});
  }
  viewsHost.appendChild(root);return state.nodes.get(def.id);
}
function renderBase(node){
  const map=viewMap(node.def),vp=viewport(map),host=node.base;host.innerHTML='';
  const minX=Math.floor(vp.left/256)-1,maxX=Math.floor(vp.right/256)+1,minY=Math.floor(vp.top/256)-1,maxY=Math.floor(vp.bottom/256)+1,n=2**map.zoom;
  for(let tx=minX;tx<=maxX;tx++) for(let ty=minY;ty<=maxY;ty++){
    if(ty<0||ty>=n)continue;const ix=((tx%n)+n)%n,img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=`https://basemaps.cartocdn.com/dark_nolabels/${map.zoom}/${ix}/${ty}.png`;img.style.left=`${tx*256-vp.left}px`;img.style.top=`${ty*256-vp.top}px`;host.appendChild(img);
  }
}
function renderLabels(node){
  const host=node.labels,map=viewMap(node.def);host.innerHTML='';
  for(const key of node.def.labels){const p=CFG.places[key];if(!p)continue;const xy=latLonToPercent(p.lat,p.lon,map);if(xy.x<-5||xy.x>105||xy.y<-5||xy.y>105)continue;const el=document.createElement('span');el.className=`map-label${p.major?' major':''}${p.region?' region':''}`;el.textContent=p.label;el.style.left=`${xy.x}%`;el.style.top=`${xy.y}%`;host.appendChild(el)}
}
function wmsUrl(service,map,time=null){
  const vp=viewport(map),p=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:service.layer,STYLES:'',SRS:'EPSG:3857',BBOX:vp.bbox.join(','),WIDTH:String(map.width),HEIGHT:String(map.height),FORMAT:'image/png',TRANSPARENT:'TRUE'});if(time)p.set('TIME',time);p.set('_',String(Date.now()));return`${service.url}?${p}`;
}
function featureInfoUrl(service,map,x,y,time=null){
  const vp=viewport(map),p=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:service.layer,QUERY_LAYERS:service.layer,STYLES:'',SRS:'EPSG:3857',BBOX:vp.bbox.join(','),WIDTH:String(map.width),HEIGHT:String(map.height),X:String(Math.round(x)),Y:String(Math.round(y)),INFO_FORMAT:'application/json',FEATURE_COUNT:'1'});if(time)p.set('TIME',time);p.set('_',String(Date.now()));return`${service.url}?${p}`;
}
function parseTimeDimension(xmlText,layerName){
  try{const xml=new DOMParser().parseFromString(xmlText,'text/xml'),layers=[...xml.querySelectorAll('Layer')],layer=layers.find(l=>l.querySelector(':scope > Name')?.textContent?.trim()===layerName)||layers.find(l=>l.textContent.includes(layerName)),el=layer?.querySelector('Dimension[name="time"],Extent[name="time"]');if(!el)return[];const raw=el.textContent.trim();if(!raw)return[];if(raw.includes(',')&&!raw.includes('/'))return raw.split(',').map(s=>s.trim()).filter(Boolean).slice(-6);if(raw.includes('/')){const[a,b,stepS='PT5M']=raw.split('/'),start=new Date(a),end=new Date(b),m=stepS.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/),step=m?((+(m[1]||0))*3600+(+(m[2]||0))*60+(+(m[3]||0)))*1000:300000;if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||step<=0)return[];const out=[],first=Math.max(start.getTime(),end.getTime()-step*5);for(let t=first;t<=end.getTime()+1000;t+=step)out.push(new Date(t).toISOString());return out.slice(-6)}return[raw]}catch(err){state.errors.push(`time parse ${err}`);return[]}
}
async function fetchTimes(key){
  if(state.times.has(key))return state.times.get(key);const s=CFG.services[key],u=`${s.url}?service=WMS&version=1.1.1&request=GetCapabilities&_=${Date.now()}`;
  try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const times=parseTimeDimension(await r.text(),s.layer);state.times.set(key,times);return times}catch(err){state.errors.push(`${key} times ${err}`);state.times.set(key,[]);return[]}
}
function addImage(host,url,time,frame){return new Promise(resolve=>{const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.dataset.frame=String(frame);img.dataset.time=time||'';img.addEventListener('load',()=>resolve({ok:true,img}),{once:true});img.addEventListener('error',()=>resolve({ok:false,img}),{once:true});img.src=url;host.appendChild(img)})}
async function loadView(def){
  if(def.type!=='radar')return;const node=state.nodes.get(def.id);if(!node)return;const map=viewMap(def),tempA=document.createElement('div'),tempB=document.createElement('div'),tempW=document.createElement('div'),primary=def.sources[0],times=await fetchTimes(primary),wanted=times.length?times.slice(-6):[null],loads=[];
  wanted.forEach((time,i)=>loads.push(addImage(tempA,wmsUrl(CFG.services[primary],map,time),time,i)));
  if(def.sources[1]){const secondary=def.sources[1],times2=await fetchTimes(secondary),wanted2=times2.length?times2.slice(-wanted.length):wanted.map(()=>null);wanted.forEach((_,i)=>{const t=wanted2[Math.min(i,wanted2.length-1)]||null;loads.push(addImage(tempB,wmsUrl(CFG.services[secondary],map,t),t,i))})}
  const warningPromise=addImage(tempW,wmsUrl(CFG.services.warnings,map),null,0),results=await Promise.all(loads),warning=await warningPromise,good=results.filter(r=>r.ok),indices=[...new Set(good.map(r=>Number(r.img.dataset.frame)))].sort((a,b)=>a-b);
  if(indices.length){node.radarA.replaceChildren(...tempA.childNodes);node.radarB.replaceChildren(...tempB.childNodes);node.frames=indices;const last=indices[indices.length-1];node.root.querySelectorAll(`.radar-layer img[data-frame="${last}"]`).forEach(i=>i.classList.add('active'));const timed=[...node.radarA.querySelectorAll(`img[data-frame="${last}"]`)].find(i=>i.dataset.time);node.lastFrameTime=timed?.dataset.time?new Date(timed.dataset.time):new Date();state.loaded.add(def.id);node.root.dataset.radar='ok'}else if(!state.loaded.has(def.id))node.root.dataset.radar='down';if(warning.ok)node.warnings.replaceChildren(...tempW.childNodes);
}
function activeNode(){return state.nodes.get(CFG.views[state.current].id)}
function startFrameLoop(){clearInterval(state.frameTimer);state.frameIndex=0;state.frameTimer=setInterval(()=>{const node=activeNode();if(!node||node.def.type!=='radar'||node.frames.length<2)return;state.frameIndex=(state.frameIndex+1)%node.frames.length;const idx=node.frames[state.frameIndex];node.root.querySelectorAll('.radar-layer img').forEach(i=>i.classList.toggle('active',Number(i.dataset.frame)===idx));const timed=[...node.root.querySelectorAll(`.radar-layer img[data-frame="${idx}"]`)].find(i=>i.dataset.time);if(timed?.dataset.time)node.lastFrameTime=new Date(timed.dataset.time);updateTelemetry()},CFG.frameMs)}
function positionHomePin(def){
  const pin=document.querySelector('.home-pin');if(def.type!=='radar'){pin.style.opacity='0';return}const map=viewMap(def),xy=latLonToPercent(CFG.home.lat,CFG.home.lon,map);pin.style.left=`${xy.x}%`;pin.style.top=`${xy.y}%`;pin.style.opacity=(xy.x>=0&&xy.x<=100&&xy.y>=0&&xy.y<=100)?'1':'0';
}
function showView(index){
  state.current=index;const def=CFG.views[index];panel.dataset.view=def.id;positionHomePin(def);CFG.views.forEach((v,i)=>state.nodes.get(v.id)?.root.classList.toggle('active',i===index));viewName.textContent=def.name;sourceBadge.textContent=def.source||'';state.frameIndex=0;startFrameLoop();updateTelemetry();
}
function scheduleRotation(){clearTimeout(state.rotateTimer);if(forcedView)return;const def=CFG.views[state.current];state.rotateTimer=setTimeout(()=>{let next=(state.current+1)%CFG.views.length;for(let i=0;i<CFG.views.length;i++){const n=state.nodes.get(CFG.views[next].id);if(n&&(CFG.views[next].type!=='radar'||state.loaded.has(CFG.views[next].id)))break;next=(next+1)%CFG.views.length}showView(next);scheduleRotation()},def.duration)}
function extractReflectivity(payload){const props=payload?.features?.[0]?.properties||payload?.properties||{},entries=Object.entries(props),preferred=entries.filter(([k])=>/gray|value|reflect|bref|dbz/i.test(k));for(const[,raw]of[...preferred,...entries]){const v=Number(raw);if(Number.isFinite(v)&&v>=-50&&v<=100)return v}return null}
function classify(dbz){if(dbz==null||dbz<5)return{label:'DRY',level:'dry'};if(dbz<20)return{label:'SPRINKLE',level:'sprinkle'};if(dbz<35)return{label:'RAIN',level:'rain'};if(dbz<50)return{label:'HEAVY',level:'heavy'};return{label:'INTENSE',level:'intense'}}
async function updateHome(){
  if(demo){state.homeDbz=0;state.homeStatus='DRY';panel.dataset.homeRain='dry';homeState.textContent='DRY';homeState.dataset.level='dry';state.nearest={miles:12,dir:'W'};nearestRain.textContent='· RAIN 12 MI W';return}
  const def=CFG.views[0],map=viewMap(def),service=CFG.services.conus;
  try{const p=latLonToPercent(CFG.home.lat,CFG.home.lon,map),r=await fetch(featureInfoUrl(service,map,p.x/100*map.width,p.y/100*map.height),{cache:'no-store'});if(!r.ok)throw new Error(r.status);const dbz=extractReflectivity(await r.json()),s=classify(dbz);state.homeDbz=dbz;state.homeStatus=s.label;panel.dataset.homeRain=s.level;homeState.textContent=s.label;homeState.dataset.level=s.level}catch(err){state.errors.push(`home ${err}`);state.homeStatus='RADAR';panel.dataset.homeRain='unknown';homeState.textContent='RADAR';homeState.dataset.level=''}await updateNearestRain();updateTelemetry();
}
async function updateNearestRain(){
  if(state.homeStatus!=='DRY'&&state.homeStatus!=='RADAR'){state.nearest=null;nearestRain.textContent='';return}if(demo)return;const map={center:CFG.home,zoom:8,width:256,height:256};
  try{const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';const done=new Promise((res,rej)=>{img.onload=res;img.onerror=rej});img.src=wmsUrl(CFG.services.conus,map);await done;const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,256,256).data,cx=128,cy=128;let best=null;for(let radius=8;radius<=118&&!best;radius+=4){for(let deg=0;deg<360;deg+=10){const rad=deg*Math.PI/180,x=Math.round(cx+Math.cos(rad)*radius),y=Math.round(cy+Math.sin(rad)*radius),a=data[(y*256+x)*4+3];if(a>45){best={radius,deg};break}}}if(!best){state.nearest=null;nearestRain.textContent='';return}const center=worldPixel(CFG.home.lat,CFG.home.lon,map.zoom),p0=pixelToMercator(center.x,center.y,map.zoom),p1=pixelToMercator(center.x+best.radius,center.y,map.zoom),meters=Math.abs(p1.x-p0.x)*Math.cos(CFG.home.lat*Math.PI/180),miles=meters/1609.344,bearing=(best.deg+90)%360,dirs=['N','NE','E','SE','S','SW','W','NW'],dir=dirs[Math.round(bearing/45)%8];state.nearest={miles,dir};nearestRain.textContent=`· RAIN ${Math.max(1,Math.round(miles))} MI ${dir}`}catch(err){state.errors.push(`nearest rain ${err}`);state.nearest=null;nearestRain.textContent=''}
}
function weatherCode(text=''){const s=text.toUpperCase();if(/THUNDER/.test(s))return'TSTM';if(/RAIN|SHOWER/.test(s))return'RAIN';if(/CLOUD|OVERCAST/.test(s))return'CLD';if(/FOG|MIST/.test(s))return'FOG';if(/SUN|CLEAR/.test(s))return'CLR';return'WX'}
function hourLabel(start){const d=new Date(start);if(!Number.isFinite(d.getTime()))return'--';return d.toLocaleTimeString([],{hour:'numeric'}).replace(' ','')}
function valueAt(values,now=Date.now()){
  let candidate=null;for(const item of values||[]){const start=new Date(String(item.validTime||'').split('/')[0]).getTime();if(!Number.isFinite(start))continue;if(start<=now)candidate=item.value;else if(candidate==null){candidate=item.value;break}else break}return candidate;
}
async function updateWeather(){
  if(demo){state.weather={temp:84,short:'TSTMS',sky:68,pop:60,thunder:true,alerts:['SEVERE TSTM'],periods:[{startTime:new Date().toISOString(),temperature:84,probabilityOfPrecipitation:{value:60},shortForecast:'Thunderstorms'},{startTime:new Date(Date.now()+3600000).toISOString(),temperature:83,probabilityOfPrecipitation:{value:55},shortForecast:'Showers'},{startTime:new Date(Date.now()+7200000).toISOString(),temperature:82,probabilityOfPrecipitation:{value:35},shortForecast:'Mostly Cloudy'},{startTime:new Date(Date.now()+10800000).toISOString(),temperature:81,probabilityOfPrecipitation:{value:20},shortForecast:'Partly Cloudy'}]};panel.dataset.weather='ok';renderWeather();return}
  try{
    const pointUrl=`https://api.weather.gov/points/${CFG.home.lat.toFixed(4)},${CFG.home.lon.toFixed(4)}`,pointR=await fetch(pointUrl,{cache:'no-store',headers:{Accept:'application/geo+json'}});if(!pointR.ok)throw new Error(`points ${pointR.status}`);const point=(await pointR.json()).properties||{},jobs=[];if(point.forecastHourly)jobs.push(fetch(point.forecastHourly,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`hourly ${r.status}`))));else jobs.push(Promise.resolve(null));if(point.forecastGridData)jobs.push(fetch(point.forecastGridData,{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error(`grid ${r.status}`))));else jobs.push(Promise.resolve(null));jobs.push(fetch(`https://api.weather.gov/alerts/active?point=${CFG.home.lat.toFixed(4)},${CFG.home.lon.toFixed(4)}`,{cache:'no-store',headers:{Accept:'application/geo+json'}}).then(r=>r.ok?r.json():null).catch(()=>null));const[hourly,grid,alerts]=await Promise.all(jobs),periods=hourly?.properties?.periods?.slice(0,4)||[],first=periods[0]||{},sky=valueAt(grid?.properties?.skyCover?.values),pop=first?.probabilityOfPrecipitation?.value,alertNames=(alerts?.features||[]).map(f=>f?.properties?.event).filter(Boolean).slice(0,2);state.weather={temp:Number.isFinite(first.temperature)?first.temperature:null,short:weatherCode(first.shortForecast||''),sky:Number.isFinite(sky)?Math.round(sky):null,pop:Number.isFinite(pop)?Math.round(pop):null,periods,thunder:periods.some(p=>/thunder/i.test(p.shortForecast||'')),alerts:alertNames};panel.dataset.weather='ok';renderWeather();
  }catch(err){state.errors.push(`weather ${err}`);panel.dataset.weather='down';renderWeather()}
}
function renderWeather(){
  const w=state.weather;nowTemp.textContent=Number.isFinite(w.temp)?`${Math.round(w.temp)}°`:'--°';nowWx.textContent=w.short||'WEATHER';forecast.innerHTML='';for(const p of (w.periods||[]).slice(0,4)){const cell=document.createElement('div');cell.className='forecast-cell';const pop=p?.probabilityOfPrecipitation?.value;cell.innerHTML=`<b>${hourLabel(p.startTime)}</b><strong>${Number.isFinite(p.temperature)?Math.round(p.temperature)+'°':'--°'}</strong><span>${Number.isFinite(pop)?Math.round(pop)+'%':'--'} · ${weatherCode(p.shortForecast||'')}</span>`;forecast.appendChild(cell)}const cloud=Number.isFinite(w.sky)?`${w.sky}%`:'--',tstm=w.thunder?'NEXT 4H':'NONE';weatherLine.textContent=`CLOUD ${cloud} · TSTM ${tstm}`;if(w.alerts?.length){alertLine.textContent=w.alerts[0].toUpperCase().replace('SEVERE THUNDERSTORM','SVR TSTM').replace('FLASH FLOOD','FLASH FLOOD')}else alertLine.textContent='NO ALERTS';
}
function updateTelemetry(){
  const def=CFG.views[state.current],node=state.nodes.get(def.id);if(def.type==='radar'){const timeEls=node?[...node.radarA.querySelectorAll('img[data-time]')].filter(i=>i.dataset.time):[],dates=timeEls.map(i=>new Date(i.dataset.time)).filter(d=>Number.isFinite(d.getTime())).sort((a,b)=>a-b);if(dates.length>1){const mins=Math.max(1,Math.round((dates[dates.length-1]-dates[0])/60000));loopRange.textContent=`-${mins}m→NOW`}else loopRange.textContent='LATEST';const d=node?.lastFrameTime&&Number.isFinite(node.lastFrameTime.getTime())?node.lastFrameTime:new Date();radarTime.textContent=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).toUpperCase()}else{loopRange.textContent='LIVE';radarTime.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).toUpperCase()}
}
async function refreshRadar(){
  if(demo){panel.dataset.ready='true';boot.classList.add('off');return}state.times.clear();for(const node of state.nodes.values()){if(node.def.type==='radar'){renderBase(node);renderLabels(node)}}await loadView(CFG.views[0]);if(state.loaded.has('home')){panel.dataset.ready='true';boot.classList.add('off')}updateHome();if(forcedView&&forcedView!=='home'){const idx=CFG.views.findIndex(v=>v.id===forcedView);if(idx>=0&&CFG.views[idx].type==='radar'){await loadView(CFG.views[idx]);if(state.loaded.has(forcedView))showView(idx)}}(async()=>{for(const v of CFG.views.filter(v=>v.type==='radar').slice(1)){if(!state.loaded.has(v.id))await loadView(v)}})();
}
function renderDemoBackdrop(){
  for(const def of CFG.views.filter(v=>v.type==='radar')){const node=state.nodes.get(def.id);node.base.innerHTML='';node.root.style.background='radial-gradient(circle at 35% 45%,#163348 0,#091520 28%,#02070c 70%)';const fake=document.createElement('div');fake.style.cssText='position:absolute;left:14%;top:30%;width:135px;height:70px;border-radius:50%;background:radial-gradient(ellipse,#ffd94a 0 12%,#59ef75 22% 48%,rgba(17,170,255,.8) 55% 66%,transparent 70%);filter:blur(2px);opacity:.86;transform:rotate(-18deg)';node.radarA.replaceChildren(fake);node.frames=[0];node.lastFrameTime=new Date();state.loaded.add(def.id)}panel.dataset.ready='true';boot.classList.add('off');
}
async function init(){
  fitPanel();addEventListener('resize',fitPanel,{passive:true});CFG.views.forEach(makeView);showView(0);if(demo){renderDemoBackdrop();await updateHome();await updateWeather()}else{await Promise.all([refreshRadar(),updateWeather()])}if(forcedView){const idx=CFG.views.findIndex(v=>v.id===forcedView);if(idx>=0){const def=CFG.views[idx];if(def.type==='image'||state.loaded.has(def.id))showView(idx)}}scheduleRotation();if(!demo){setInterval(refreshRadar,CFG.refreshMs);setInterval(updateWeather,CFG.weatherRefreshMs)}setInterval(updateTelemetry,15000);window.__RDR_DIAGNOSTICS__=state;
}
init();
