'use strict';

const CFG={
  width:456,height:257,top:28,bottom:19,mapHeight:210,
  home:{lat:26.06197904865014,lon:-80.18787062578414},
  pollMs:120000,vectorMs:300000,severeMs:180000,radarFrameMs:980,radarBlendMs:360,animFps:15,
  views:[
    {id:'home',name:'HOME',duration:12000,bbox:[-80.46,25.84,-79.96,26.30],labels:[['DAVIE',26.0765,-80.2521],['HOLLYWOOD',26.0112,-80.1495],['DANIA',26.0523,-80.1439],['FORT LAUDERDALE',26.1224,-80.1373],['HALLANDALE',25.9812,-80.1484],['MIRAMAR',25.9861,-80.3036]]},
    {id:'metro',name:'BROWARD / MIAMI',duration:11000,bbox:[-81.10,25.00,-79.45,27.02],labels:[['WEST PALM',26.7153,-80.0534],['BOCA RATON',26.3683,-80.1289],['FORT LAUDERDALE',26.1224,-80.1373],['HOLLYWOOD',26.0112,-80.1495],['MIAMI',25.7617,-80.1918],['HOMESTEAD',25.4687,-80.4776],['KEY LARGO',25.0865,-80.4473]]},
    {id:'florida',name:'FLORIDA',duration:10000,bbox:[-87.80,24.00,-79.20,31.25],labels:[['JACKSONVILLE',30.3322,-81.6557],['ORLANDO',28.5383,-81.3792],['TAMPA',27.9506,-82.4572],['WEST PALM',26.7153,-80.0534],['FORT MYERS',26.6406,-81.8723],['NAPLES',26.1423,-81.7948],['MIAMI',25.7617,-80.1918],['KEY WEST',24.5551,-81.7800]]},
    {id:'regional',name:'GULF / CUBA',duration:12000,bbox:[-98.00,18.00,-72.00,32.80],labels:[['GULF OF MEXICO',25.9,-90.0],['FLORIDA',27.4,-81.7],['MIAMI',25.7617,-80.1918],['KEY WEST',24.5551,-81.7800],['HAVANA',23.1136,-82.3666],['CUBA',22.25,-79.7],['BAHAMAS',24.4,-76.7],['YUCATAN',21.0,-87.1]]}
  ],
  mrmsBucket:'https://noaa-mrms-pds.s3.amazonaws.com',
  radarProduct:'MergedReflectivityQCComposite_00.50',
  severeProducts:{lightning:'LightningProbabilityNext30minGrid_scale_1',mesh:'MESH_00.50'},
  reference:'https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer',
  warnings:'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer',
  tropics:'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer',
  surfaceObs:'https://mapservices.weather.noaa.gov/vector/rest/services/obs/surface_obs/MapServer',
  nws:'https://api.weather.gov'
};

const panel=document.getElementById('panel');
const canvas=document.getElementById('display');
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true});
const boot=document.getElementById('boot');
const query=new URLSearchParams(location.search);
const forcedView=query.get('view');
const verifyMode=query.has('verify');

const state={
  view:0,cursor:0,frames:[],radarLoading:false,lastListError:null,
  boundaries:new Map(),surface:new Map(),warnings:new Map(),tropics:[],weather:null,
  severe:{lightning:null,mesh:null},home:{dbz:null,status:'LOADING',nearest:null,eta:null},motion:null,
  transition:null,windParticles:[],windView:null,windLast:0,raf:null,lastPaint:0,
  rotateTimer:null,animTimer:null,pollTimer:null,vectorTimer:null,severeTimer:null,errors:[]
};

const MISSING=-32768;
const radarStops=[
  [5,[0,103,214]],[10,[0,167,255]],[15,[0,213,155]],[20,[0,231,76]],[25,[60,240,60]],
  [30,[181,239,45]],[35,[250,226,43]],[40,[255,169,35]],[45,[255,96,34]],[50,[246,44,48]],
  [55,[255,34,122]],[60,[221,39,216]],[65,[166,55,241]],[70,[248,248,255]]
];

function fitPanel(){
  const s=Math.min(innerWidth/CFG.width,innerHeight/CFG.height);
  panel.style.transform=`translate(-50%,-50%) scale(${Math.max(.2,s)})`;
}
function view(){return CFG.views[state.view]}
function lon360(lon){return lon<0?lon+360:lon}
function mapXY(lat,lon,def=view()){
  const [w,s,e,n]=def.bbox;
  return{x:(lon-w)/(e-w)*CFG.width,y:CFG.top+(n-lat)/(n-s)*CFG.mapHeight};
}
function within(lat,lon,def=view()){
  const b=def.bbox;return lon>=b[0]&&lon<=b[2]&&lat>=b[1]&&lat<=b[3];
}
function pixelLatLon(x,y,def=CFG.views[0]){
  const [w,s,e,n]=def.bbox;
  return{lon:w+x/(CFG.width-1)*(e-w),lat:n-y/(CFG.mapHeight-1)*(n-s)};
}
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
function ageMs(){const f=state.frames.at(-1);return f?Date.now()-f.time.getTime():Infinity}
function freshness(){const a=ageMs();return a<270000?'live':a<480000?'delayed':'stale'}
function compactTime(d){return d&&Number.isFinite(d.getTime())?d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(' ','').replace('AM','a').replace('PM','p'):'--:--'}
function utcTime(d){return d&&Number.isFinite(d.getTime())?d.toLocaleTimeString('en-US',{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hour12:false})+'Z':'--:--Z'}
function dayStamp(d=new Date()){return d.toISOString().slice(0,10).replaceAll('-','')}
function keyTime(key){
  const m=key.match(/(\d{8})-(\d{6})/);if(!m)return null;
  return new Date(Date.UTC(+m[1].slice(0,4),+m[1].slice(4,6)-1,+m[1].slice(6,8),+m[2].slice(0,2),+m[2].slice(2,4),+m[2].slice(4,6)));
}
async function fetchText(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.text()}
async function fetchJson(url,headers={}){const r=await fetch(url,{cache:'no-store',headers});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()}
async function inflate(buf,kind){return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream(kind))).arrayBuffer()}
async function listProductDay(product,stamp){
  const prefix=`CONUS/${product}/${stamp}/`;
  const url=`${CFG.mrmsBucket}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;
  const xml=await fetchText(url);
  return[...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map(m=>m[1]).filter(k=>k.endsWith('.grib2.gz'));
}
async function recentKeys(product,count=5){
  const now=new Date();let keys=await listProductDay(product,dayStamp(now));
  if(keys.length<count){const y=new Date(now.getTime()-86400000);keys=(await listProductDay(product,dayStamp(y))).concat(keys)}
  return[...new Set(keys)].sort().slice(-count);
}
function haversineMiles(a,b){
  const R=3958.7613,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dp=(b.lat-a.lat)*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(h));
}
function bearing(a,b){
  const p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dl=(b.lon-a.lon)*Math.PI/180;
  return(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*180/Math.PI+360)%360;
}
function dir8(deg){return['N','NE','E','SE','S','SW','W','NW'][Math.round(((deg%360)+360)%360/45)%8]}
function angleDiff(a,b){let d=Math.abs(a-b)%360;return d>180?360-d:d}
function seeded(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x)}
