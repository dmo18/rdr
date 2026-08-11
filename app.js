const CFG = {
  width: 456,
  height: 257,
  mapHeight: 243,
  home: { lat: 26.06197904865014, lon: -80.18787062578414 },
  refreshMs: 5 * 60 * 1000,
  frameMs: 850,
  views: [
    { id:'home', name:'HOME', tag:'HOME · 20 MI', center:{lat:26.06197904865014,lon:-80.18787062578414}, zoom:10, duration:12000, sources:['kamx'], labels:['davie','hollywood','dania','fortlauderdale','hallandale','miramar'] },
    { id:'metro', name:'BROWARD / MIAMI', tag:'METRO · 90 MI', center:{lat:25.92,lon:-80.35}, zoom:8, duration:10000, sources:['kamx'], labels:['fortlauderdale','miami','bocaraton','westpalm','homestead','keylargo','hollywood'] },
    { id:'florida', name:'FLORIDA', tag:'FLORIDA', center:{lat:27.05,lon:-81.45}, zoom:6, duration:9000, sources:['conus'], labels:['miami','keywest','naples','fortmyers','tampa','orlando','jacksonville','westpalm'] },
    { id:'regional', name:'GULF / CUBA', tag:'GULF · CUBA · BAHAMAS', center:{lat:24.8,lon:-83.6}, zoom:5, duration:10000, sources:['conus','carib'], labels:['florida','cuba','havana','bahamas','yucatan','keywest','miami','gulf'] }
  ],
  places: {
    davie:{lat:26.0765,lon:-80.2521,label:'DAVIE'}, hollywood:{lat:26.0112,lon:-80.1495,label:'HOLLYWOOD',major:true}, dania:{lat:26.0523,lon:-80.1439,label:'DANIA'}, fortlauderdale:{lat:26.1224,lon:-80.1373,label:'FORT LAUDERDALE',major:true}, hallandale:{lat:25.9812,lon:-80.1484,label:'HALLANDALE'}, miramar:{lat:25.9861,lon:-80.3036,label:'MIRAMAR'},
    miami:{lat:25.7617,lon:-80.1918,label:'MIAMI',major:true}, bocaraton:{lat:26.3683,lon:-80.1289,label:'BOCA RATON'}, westpalm:{lat:26.7153,lon:-80.0534,label:'WEST PALM'}, homestead:{lat:25.4687,lon:-80.4776,label:'HOMESTEAD'}, keylargo:{lat:25.0865,lon:-80.4473,label:'KEY LARGO'}, keywest:{lat:24.5551,lon:-81.7800,label:'KEY WEST',major:true}, naples:{lat:26.1423,lon:-81.7948,label:'NAPLES'}, fortmyers:{lat:26.6406,lon:-81.8723,label:'FORT MYERS'}, tampa:{lat:27.9506,lon:-82.4572,label:'TAMPA',major:true}, orlando:{lat:28.5383,lon:-81.3792,label:'ORLANDO',major:true}, jacksonville:{lat:30.3322,lon:-81.6557,label:'JACKSONVILLE'},
    florida:{lat:27.5,lon:-81.6,label:'FLORIDA',region:true}, cuba:{lat:22.4,lon:-79.7,label:'CUBA',region:true}, havana:{lat:23.1136,lon:-82.3666,label:'HAVANA'}, bahamas:{lat:24.4,lon:-76.7,label:'BAHAMAS',region:true}, yucatan:{lat:20.8,lon:-87.1,label:'YUCATÁN',region:true}, gulf:{lat:25.8,lon:-90.0,label:'GULF OF MEXICO',region:true}
  },
  services: {
    kamx:{url:'https://opengeo.ncep.noaa.gov/geoserver/kamx/ows',layer:'kamx_sr_bref'},
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
const loopRange = document.getElementById('loopRange');
const radarTime = document.getElementById('radarTime');
const query = new URLSearchParams(location.search);
const forcedView = query.get('view');

const state = {
  current:0,
  rotateTimer:null,
  frameTimer:null,
  frameIndex:0,
  times:new Map(),
  nodes:new Map(),
  loaded:new Set(),
  lastFrameTime:null,
  homeDbz:null,
  homeStatus:'LOADING',
  nearest:null,
  errors:[]
};

function fitPanel(){
  const scale = Math.min(innerWidth / CFG.width, innerHeight / CFG.height);
  panel.style.transform = `scale(${Math.max(.2, scale)})`;
}

function worldPixel(lat,lon,z){
  const n=2**z;
  const x=(lon+180)/360*n*256;
  const lr=Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/180;
  const y=(1-Math.asinh(Math.tan(lr))/Math.PI)/2*n*256;
  return{x,y};
}
function pixelToMercator(px,py,z){
  const world=256*(2**z),half=20037508.342789244;
  return{x:(px/world*2-1)*half,y:(1-py/world*2)*half};
}
function viewMap(def){return{center:def.center,zoom:def.zoom,width:CFG.width,height:CFG.mapHeight}}
function viewport(map){
  const c=worldPixel(map.center.lat,map.center.lon,map.zoom),left=c.x-map.width/2,right=c.x+map.width/2,top=c.y-map.height/2,bottom=c.y+map.height/2,a=pixelToMercator(left,bottom,map.zoom),b=pixelToMercator(right,top,map.zoom);
  return{left,right,top,bottom,bbox:[a.x,a.y,b.x,b.y]};
}
function latLonToPercent(lat,lon,map){
  const vp=viewport(map),p=worldPixel(lat,lon,map.zoom);
  return{x:(p.x-vp.left)/map.width*100,y:(p.y-vp.top)/map.height*100};
}

function makeView(def){
  const root=document.createElement('section');root.className='radar-view';root.dataset.view=def.id;
  root.innerHTML='<div class="tile-layer"></div><div class="radar-layer radar-a"></div><div class="radar-layer radar-b"></div><div class="warning-layer"></div><div class="shade"></div><div class="label-layer"></div>';
  viewsHost.appendChild(root);
  const node={root,base:root.querySelector('.tile-layer'),radarA:root.querySelector('.radar-a'),radarB:root.querySelector('.radar-b'),warnings:root.querySelector('.warning-layer'),labels:root.querySelector('.label-layer'),def,frames:[],lastFrameTime:null};
  state.nodes.set(def.id,node);
  renderBase(node);
  renderLabels(node);
  return node;
}

function renderBase(node){
  const map=viewMap(node.def),vp=viewport(map),host=node.base;host.innerHTML='';
  const minX=Math.floor(vp.left/256)-1,maxX=Math.floor(vp.right/256)+1,minY=Math.floor(vp.top/256)-1,maxY=Math.floor(vp.bottom/256)+1,n=2**map.zoom;
  for(let tx=minX;tx<=maxX;tx++) for(let ty=minY;ty<=maxY;ty++){
    if(ty<0||ty>=n)continue;
    const ix=((tx%n)+n)%n,img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';
    img.src=`https://basemaps.cartocdn.com/dark_nolabels/${map.zoom}/${ix}/${ty}.png`;
    img.style.left=`${tx*256-vp.left}px`;img.style.top=`${ty*256-vp.top}px`;host.appendChild(img);
  }
}
function renderLabels(node){
  const host=node.labels,map=viewMap(node.def);host.innerHTML='';
  for(const key of node.def.labels){
    const p=CFG.places[key];if(!p)continue;const xy=latLonToPercent(p.lat,p.lon,map);if(xy.x<-5||xy.x>105||xy.y<-5||xy.y>105)continue;
    const el=document.createElement('span');el.className=`map-label${p.major?' major':''}${p.region?' region':''}`;el.textContent=p.label;el.style.left=`${xy.x}%`;el.style.top=`${xy.y}%`;host.appendChild(el);
  }
}

function wmsUrl(service,map,time=null){
  const vp=viewport(map),p=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:service.layer,STYLES:'',SRS:'EPSG:3857',BBOX:vp.bbox.join(','),WIDTH:String(map.width),HEIGHT:String(map.height),FORMAT:'image/png',TRANSPARENT:'TRUE'});
  if(time)p.set('TIME',time);p.set('_',String(Date.now()));return`${service.url}?${p}`;
}
function featureInfoUrl(service,map,x,y,time=null){
  const vp=viewport(map),p=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:service.layer,QUERY_LAYERS:service.layer,STYLES:'',SRS:'EPSG:3857',BBOX:vp.bbox.join(','),WIDTH:String(map.width),HEIGHT:String(map.height),X:String(Math.round(x)),Y:String(Math.round(y)),INFO_FORMAT:'application/json',FEATURE_COUNT:'1'});
  if(time)p.set('TIME',time);p.set('_',String(Date.now()));return`${service.url}?${p}`;
}

function parseTimeDimension(xmlText,layerName){
  try{
    const xml=new DOMParser().parseFromString(xmlText,'text/xml'),layers=[...xml.querySelectorAll('Layer')],layer=layers.find(l=>l.querySelector(':scope > Name')?.textContent?.trim()===layerName)||layers.find(l=>l.textContent.includes(layerName)),el=layer?.querySelector('Dimension[name="time"],Extent[name="time"]');
    if(!el)return[];const raw=el.textContent.trim();if(!raw)return[];
    if(raw.includes(',')&&!raw.includes('/'))return raw.split(',').map(s=>s.trim()).filter(Boolean).slice(-6);
    if(raw.includes('/')){const[a,b,stepS='PT5M']=raw.split('/'),start=new Date(a),end=new Date(b),m=stepS.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/),step=m?((+(m[1]||0))*3600+(+(m[2]||0))*60+(+(m[3]||0)))*1000:300000;if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||step<=0)return[];const out=[],first=Math.max(start.getTime(),end.getTime()-step*5);for(let t=first;t<=end.getTime()+1000;t+=step)out.push(new Date(t).toISOString());return out.slice(-6)}
    return[raw];
  }catch(err){state.errors.push(`time parse ${err}`);return[]}
}
async function fetchTimes(key){
  if(state.times.has(key))return state.times.get(key);
  const s=CFG.services[key],u=`${s.url}?service=WMS&version=1.1.1&request=GetCapabilities&_=${Date.now()}`;
  try{const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error(r.status);const times=parseTimeDimension(await r.text(),s.layer);state.times.set(key,times);return times}catch(err){state.errors.push(`${key} times ${err}`);state.times.set(key,[]);return[]}
}

function addImage(host,url,time,frame){
  return new Promise(resolve=>{const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.dataset.frame=String(frame);img.dataset.time=time||'';img.addEventListener('load',()=>resolve({ok:true,img}),{once:true});img.addEventListener('error',()=>resolve({ok:false,img}),{once:true});img.src=url;host.appendChild(img)})
}

async function loadView(def){
  const node=state.nodes.get(def.id);if(!node)return;
  const map=viewMap(def),tempA=document.createElement('div'),tempB=document.createElement('div'),tempW=document.createElement('div');
  const primary=def.sources[0],times=await fetchTimes(primary),wanted=times.length?times.slice(-6):[null],loads=[];
  wanted.forEach((time,i)=>loads.push(addImage(tempA,wmsUrl(CFG.services[primary],map,time),time,i)));
  if(def.sources[1]){
    const secondary=def.sources[1],times2=await fetchTimes(secondary),wanted2=times2.length?times2.slice(-wanted.length):wanted.map(()=>null);
    wanted.forEach((_,i)=>{const t=wanted2[Math.min(i,wanted2.length-1)]||null;loads.push(addImage(tempB,wmsUrl(CFG.services[secondary],map,t),t,i))});
  }
  const warningPromise=addImage(tempW,wmsUrl(CFG.services.warnings,map),null,0);
  const results=await Promise.all(loads),warning=await warningPromise,good=results.filter(r=>r.ok);
  const indices=[...new Set(good.map(r=>Number(r.img.dataset.frame)))].sort((a,b)=>a-b);
  if(indices.length){
    node.radarA.replaceChildren(...tempA.childNodes);node.radarB.replaceChildren(...tempB.childNodes);node.frames=indices;
    const last=indices[indices.length-1];node.root.querySelectorAll(`.radar-layer img[data-frame="${last}"]`).forEach(i=>i.classList.add('active'));
    const timed=[...node.radarA.querySelectorAll(`img[data-frame="${last}"]`)].find(i=>i.dataset.time);node.lastFrameTime=timed?.dataset.time?new Date(timed.dataset.time):new Date();
    state.loaded.add(def.id);node.root.dataset.radar='ok';
  }else if(!state.loaded.has(def.id)) node.root.dataset.radar='down';
  if(warning.ok)node.warnings.replaceChildren(...tempW.childNodes);
}

function activeNode(){return state.nodes.get(CFG.views[state.current].id)}
function startFrameLoop(){
  clearInterval(state.frameTimer);state.frameIndex=0;
  state.frameTimer=setInterval(()=>{
    const node=activeNode();if(!node||node.frames.length<2)return;
    state.frameIndex=(state.frameIndex+1)%node.frames.length;const idx=node.frames[state.frameIndex];
    node.root.querySelectorAll('.radar-layer img').forEach(i=>i.classList.toggle('active',Number(i.dataset.frame)===idx));
    const timed=[...node.root.querySelectorAll(`.radar-layer img[data-frame="${idx}"]`)].find(i=>i.dataset.time);if(timed?.dataset.time)node.lastFrameTime=new Date(timed.dataset.time);updateTelemetry();
  },CFG.frameMs);
}

function positionHomePin(def){const map=viewMap(def),xy=latLonToPercent(CFG.home.lat,CFG.home.lon,map),pin=document.querySelector('.home-pin');pin.style.left=`${xy.x}%`;pin.style.top=`${xy.y/100*CFG.mapHeight}px`;pin.style.opacity=(xy.x>=0&&xy.x<=100&&xy.y>=0&&xy.y<=100)?'1':'0'}
function showView(index){
  state.current=index;const def=CFG.views[index];panel.dataset.view=def.id;positionHomePin(def);
  CFG.views.forEach((v,i)=>state.nodes.get(v.id)?.root.classList.toggle('active',i===index));
  viewName.textContent=def.name;state.frameIndex=0;startFrameLoop();updateTelemetry();
}
function scheduleRotation(){
  clearTimeout(state.rotateTimer);if(forcedView)return;
  const def=CFG.views[state.current];state.rotateTimer=setTimeout(()=>{
    let next=(state.current+1)%CFG.views.length;for(let i=0;i<CFG.views.length;i++){if(state.loaded.has(CFG.views[next].id))break;next=(next+1)%CFG.views.length}showView(next);scheduleRotation();
  },def.duration);
}

function extractReflectivity(payload){
  const props=payload?.features?.[0]?.properties||payload?.properties||{},entries=Object.entries(props),preferred=entries.filter(([k])=>/gray|value|reflect|bref|dbz/i.test(k));
  for(const[,raw]of[...preferred,...entries]){const v=Number(raw);if(Number.isFinite(v)&&v>=-50&&v<=100)return v}return null;
}
function classify(dbz){if(dbz==null||dbz<5)return{label:'DRY',level:'dry'};if(dbz<20)return{label:'SPRINKLE',level:'sprinkle'};if(dbz<35)return{label:'RAIN',level:'rain'};if(dbz<50)return{label:'HEAVY',level:'heavy'};return{label:'INTENSE',level:'intense'}}

async function updateHome(){
  const def=CFG.views[0],map=viewMap(def),service=CFG.services.conus;
  try{
    const p=latLonToPercent(CFG.home.lat,CFG.home.lon,map),r=await fetch(featureInfoUrl(service,map,p.x/100*map.width,p.y/100*map.height),{cache:'no-store'});if(!r.ok)throw new Error(r.status);
    const dbz=extractReflectivity(await r.json()),s=classify(dbz);state.homeDbz=dbz;state.homeStatus=s.label;panel.dataset.homeRain=s.level;homeState.textContent=s.label;homeState.dataset.level=s.level;
  }catch(err){state.errors.push(`home ${err}`);state.homeStatus='RADAR';panel.dataset.homeRain='unknown';homeState.textContent='RADAR';homeState.dataset.level='';}
  await updateNearestRain();updateTelemetry();
}

async function updateNearestRain(){
  if(state.homeStatus!=='DRY'&&state.homeStatus!=='RADAR'){state.nearest=null;nearestRain.textContent='';return}
  const map={center:CFG.home,zoom:8,width:256,height:256};
  try{
    const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='no-referrer';
    const done=new Promise((res,rej)=>{img.onload=res;img.onerror=rej});img.src=wmsUrl(CFG.services.conus,map);await done;
    const c=document.createElement('canvas');c.width=256;c.height=256;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,256,256).data,cx=128,cy=128;
    let best=null;
    for(let radius=8;radius<=118&&!best;radius+=4){for(let deg=0;deg<360;deg+=10){const rad=deg*Math.PI/180,x=Math.round(cx+Math.cos(rad)*radius),y=Math.round(cy+Math.sin(rad)*radius),a=data[(y*256+x)*4+3];if(a>45){best={radius,deg};break}}}
    if(!best){state.nearest=null;nearestRain.textContent='';return}
    const center=worldPixel(CFG.home.lat,CFG.home.lon,map.zoom),p0=pixelToMercator(center.x,center.y,map.zoom),p1=pixelToMercator(center.x+best.radius,center.y,map.zoom),meters=Math.abs(p1.x-p0.x)*Math.cos(CFG.home.lat*Math.PI/180),miles=meters/1609.344;
    const bearing=(best.deg+90)%360,dirs=['N','NE','E','SE','S','SW','W','NW'],dir=dirs[Math.round(bearing/45)%8];state.nearest={miles,dir};nearestRain.textContent=`· RAIN ${Math.max(1,Math.round(miles))} MI ${dir}`;
  }catch(err){state.errors.push(`nearest rain ${err}`);state.nearest=null;nearestRain.textContent=''}
}

function updateTelemetry(){
  const def=CFG.views[state.current],node=state.nodes.get(def.id),timeEls=node?[...node.radarA.querySelectorAll('img[data-time]')].filter(i=>i.dataset.time):[],dates=timeEls.map(i=>new Date(i.dataset.time)).filter(d=>Number.isFinite(d.getTime())).sort((a,b)=>a-b);
  if(dates.length>1){const mins=Math.max(1,Math.round((dates[dates.length-1]-dates[0])/60000));loopRange.textContent=`-${mins}m → NOW`}else loopRange.textContent='LATEST';
  const d=node?.lastFrameTime&&Number.isFinite(node.lastFrameTime.getTime())?node.lastFrameTime:new Date();radarTime.textContent=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).toUpperCase();
}

async function refreshAll(){
  state.times.clear();state.loaded.clear();
  for(const node of state.nodes.values()){renderBase(node);renderLabels(node)}
  await loadView(CFG.views[0]);if(state.loaded.has('home')){panel.dataset.ready='true';boot.classList.add('off')}
  updateHome();
  if(forcedView&&forcedView!=='home'){
    const idx=CFG.views.findIndex(v=>v.id===forcedView);if(idx>=0){await loadView(CFG.views[idx]);if(state.loaded.has(forcedView))showView(idx)}
  }
  (async()=>{for(const v of CFG.views.slice(1)){if(!state.loaded.has(v.id))await loadView(v)}})();
}

async function init(){
  fitPanel();addEventListener('resize',fitPanel,{passive:true});CFG.views.forEach(makeView);showView(0);
  await refreshAll();scheduleRotation();setInterval(refreshAll,CFG.refreshMs);setInterval(updateTelemetry,15000);window.__RDR_DIAGNOSTICS__=state;
}
init();
