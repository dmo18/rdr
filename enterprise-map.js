'use strict';

/*
 * RDR Enterprise v8 renderer.
 * Data acquisition remains in core.js, radar.js and context.js. This file is
 * intentionally presentation-only: one map, one hierarchy, one set of rules.
 */

const eRadarCache=new Map(),eBaseCache=new Map(),eLineCache=new Map(),ePeakCache=new Map(),eCellCache=new Map();
const E_MAP_TOP=29,E_MAP_BOTTOM=220,E_FOOT_TOP=220;
const E_LAND=[
  [[-82.2682,23.1886],[-81.4045,23.1173],[-80.6188,23.106],[-79.6795,22.7653],[-79.2815,22.3992],[-78.3474,22.5122],[-77.9933,22.2772],[-77.1464,21.6579],[-76.5238,21.2068],[-76.1946,21.2206],[-75.5982,21.0166],[-75.6711,20.7351],[-74.9339,20.6939],[-74.178,20.2846],[-74.2966,20.0504],[-74.9616,19.9234],[-75.6347,19.8738],[-76.3237,19.9529],[-77.7555,19.8555],[-77.0851,20.4134],[-77.4927,20.6731],[-78.1373,20.7399],[-78.4828,21.0286],[-78.7199,21.5981],[-79.285,21.5592],[-80.2175,21.8273],[-80.5175,22.0371],[-81.8209,22.1921],[-82.17,22.3871],[-81.795,22.637],[-82.7759,22.6882],[-83.4945,22.1685],[-83.9088,22.1546],[-84.0522,21.9106],[-84.547,21.8012],[-84.9749,21.896],[-84.4471,22.205],[-84.2304,22.5658],[-83.7782,22.7881],[-83.2675,22.983],[-82.5104,23.0787],[-82.2682,23.1886]],
  [[-77.5347,23.7598],[-77.78,23.71],[-78.0341,24.2862],[-78.4085,24.5756],[-78.1909,25.2103],[-77.89,25.17],[-77.54,24.34],[-77.5347,23.7598]],
  [[-77.82,26.58],[-78.91,26.42],[-78.98,26.79],[-78.51,26.87],[-77.85,26.84],[-77.82,26.58]],
  [[-77,26.59],[-77.1726,25.8792],[-77.3564,26.0074],[-77.34,26.53],[-77.788,26.9252],[-77.79,27.04],[-77,26.59]],
  [[-91.2,18],[-91,19],[-90.77,19.284],[-90.53,19.867],[-90.45,20.708],[-90.279,21],[-89.601,21.262],[-88.544,21.494],[-87.658,21.459],[-87.052,21.544],[-86.812,21.332],[-86.846,20.85],[-87.383,20.255],[-87.621,19.647],[-87.437,19.472],[-87.587,19.04],[-87.837,18.26],[-88.091,18.517],[-88.3,18.5],[-88.49,18.487],[-88.848,17.883],[-89.03,18.002],[-90.068,17.819],[-91.2,18]]
];

const E_LABEL_OFF={
  home:{'FORT LAUDERDALE':[0,-8],'DANIA BEACH':[8,3],'HOLLYWOOD':[3,9],'DAVIE':[-8,0],'MIRAMAR':[-8,2]},
  metro:{'WEST PALM':[-2,-5],'BOCA RATON':[0,-2],'FORT LAUDERDALE':[0,-8],'MIAMI':[0,7],'HOMESTEAD':[0,6]},
  florida:{'JACKSONVILLE':[0,7],'ORLANDO':[4,0],'TAMPA':[-6,0],'WEST PALM':[-5,-2],'FORT MYERS':[-3,1],'NAPLES':[0,5],'MIAMI':[0,8],'KEY WEST':[0,6]},
  regional:{'GULF OF MEXICO':[0,0],'FLORIDA':[0,0],'MIAMI':[0,6],'KEY WEST':[0,7],'HAVANA':[0,5],'CUBA':[0,0],'BAHAMAS':[0,0],'YUCATAN':[0,0]}
};

function ePoint(lat,lon,def=view()){return mapXY(lat,lon,def)}
function eTrace(target,def,coords,close=false){for(let i=0;i<coords.length;i++){const q=coords[i],p=ePoint(q[1],q[0],def);i?target.lineTo(p.x,p.y):target.moveTo(p.x,p.y)}if(close)target.closePath()}
function eGeometry(target,def,g,stroke=null,fill=null,width=1,dash=[]){
  if(!g)return;target.save();target.strokeStyle=stroke||'transparent';target.fillStyle=fill||'transparent';target.lineWidth=width;target.setLineDash(dash);
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:null;
  const lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:null;
  const points=g.type==='Point'?[g.coordinates]:g.type==='MultiPoint'?g.coordinates:null;
  if(polys)for(const poly of polys){target.beginPath();for(const ring of poly)eTrace(target,def,ring,true);if(fill)target.fill('evenodd');if(stroke)target.stroke()}
  if(lines)for(const line of lines){target.beginPath();eTrace(target,def,line);if(stroke)target.stroke()}
  if(points)for(const q of points){const p=ePoint(q[1],q[0],def);target.beginPath();target.arc(p.x,p.y,2,0,Math.PI*2);if(fill)target.fill();if(stroke)target.stroke()}
  target.restore();
}
function eRound(target,x,y,w,h,r){target.beginPath();target.roundRect(x,y,w,h,r)}
function eOverlap(a,b,p=1){return !(a.x+a.w+p<b.x||b.x+b.w+p<a.x||a.y+a.h+p<b.y||b.y+b.h+p<a.y)}
function eInMap(y,pad=0){return y>=E_MAP_TOP+pad&&y<=E_MAP_BOTTOM-pad}
function eFitText(text,maxWidth,font){ctx.font=font;if(ctx.measureText(text).width<=maxWidth)return text;let s=text;while(s.length>3&&ctx.measureText(s+'…').width>maxWidth)s=s.slice(0,-1);return s+'…'}

function eBase(def=view()){
  const bd=state.boundaries.get(def.id),key=`${def.id}|${bd?.states?.length||0}|${bd?.counties?.length||0}|v8`;
  if(eBaseCache.has(key))return eBaseCache.get(key);
  const c=document.createElement('canvas');c.width=CFG.width;c.height=CFG.height;const x=c.getContext('2d');
  const ocean=x.createLinearGradient(0,E_MAP_TOP,0,E_MAP_BOTTOM);ocean.addColorStop(0,'#071922');ocean.addColorStop(1,'#04131b');x.fillStyle=ocean;x.fillRect(0,0,CFG.width,CFG.height);
  const glow=x.createRadialGradient(CFG.width*.58,CFG.height*.44,10,CFG.width*.58,CFG.height*.44,CFG.width*.74);glow.addColorStop(0,'rgba(39,91,108,.075)');glow.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=glow;x.fillRect(0,0,CFG.width,CFG.height);
  x.fillStyle='#16252d';for(const poly of E_LAND){x.beginPath();eTrace(x,def,poly,true);x.fill()}
  for(const f of bd?.states||[])eGeometry(x,def,f.geometry,null,'#16252d');
  if(def.id==='regional'||def.id==='florida'){
    const lonStep=def.id==='regional'?5:2,latStep=def.id==='regional'?4:2,[w,s,e,n]=def.bbox;x.save();x.strokeStyle='rgba(118,150,163,.08)';x.lineWidth=.45;
    for(let lon=Math.ceil(w/lonStep)*lonStep;lon<e;lon+=lonStep){const a=ePoint(s,lon,def),b=ePoint(n,lon,def);x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}
    for(let lat=Math.ceil(s/latStep)*latStep;lat<n;lat+=latStep){const a=ePoint(lat,w,def),b=ePoint(lat,e,def);x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}x.restore();
  }
  eBaseCache.set(key,c);while(eBaseCache.size>12)eBaseCache.delete(eBaseCache.keys().next().value);return c;
}
function eLines(def=view()){
  const bd=state.boundaries.get(def.id),key=`${def.id}|${bd?.states?.length||0}|${bd?.counties?.length||0}|v8`;
  if(eLineCache.has(key))return eLineCache.get(key);
  const c=document.createElement('canvas');c.width=CFG.width;c.height=CFG.height;const x=c.getContext('2d');
  const countyA=def.id==='home'?.24:def.id==='metro'?.22:def.id==='florida'?.18:.10;
  for(const f of bd?.counties||[])eGeometry(x,def,f.geometry,`rgba(137,165,176,${countyA})`,null,.48);
  for(const f of bd?.states||[])eGeometry(x,def,f.geometry,'rgba(218,230,235,.72)',null,.9);
  x.strokeStyle='rgba(211,226,232,.30)';x.lineWidth=.55;for(const poly of E_LAND){x.beginPath();eTrace(x,def,poly,true);x.stroke()}
  eLineCache.set(key,c);while(eLineCache.size>12)eLineCache.delete(eLineCache.keys().next().value);return c;
}

function eRadarColor(z){
  if(z<5)return null;
  const p=[[5,[28,111,210]],[10,[19,153,228]],[15,[25,190,168]],[20,[34,202,98]],[25,[91,211,67]],[30,[181,219,55]],[35,[236,214,47]],[40,[247,162,39]],[45,[247,104,36]],[50,[232,58,54]],[55,[226,49,99]],[60,[201,54,160]],[65,[153,65,213]],[70,[248,248,250]]];
  for(let i=0;i<p.length-1;i++){const[a,ca]=p[i],[b,cb]=p[i+1];if(z<=b){const t=clamp((z-a)/(b-a),0,1);return[ca[0]+(cb[0]-ca[0])*t,ca[1]+(cb[1]-ca[1])*t,ca[2]+(cb[2]-ca[2])*t]}}return p.at(-1)[1];
}
function eRadarCanvas(frame,def=view()){
  if(!frame)return null;const key=`${frame.key}|${def.id}|enterprise-v8`;if(eRadarCache.has(key))return eRadarCache.get(key);
  const a=frame.views?.[def.id];if(!a)return null;const n=CFG.width*CFG.height,tmp=new Float32Array(n); 
  // Small cross filter removes resampling grit without sacrificing compact cores.
  for(let y=0;y<CFG.height;y++)for(let x=0;x<CFG.width;x++){
    const i=y*CFG.width+x,q=a[i]===MISSING?0:Math.max(0,a[i]);if(q>=430){tmp[i]=q;continue}
    let s=q*4,w=4;
    if(x){const v=a[i-1];if(v!==MISSING){s+=Math.max(0,v);w++}}
    if(x<CFG.width-1){const v=a[i+1];if(v!==MISSING){s+=Math.max(0,v);w++}}
    if(y){const v=a[i-CFG.width];if(v!==MISSING){s+=Math.max(0,v);w++}}
    if(y<CFG.height-1){const v=a[i+CFG.width];if(v!==MISSING){s+=Math.max(0,v);w++}}
    tmp[i]=s/w;
  }
  const c=document.createElement('canvas');c.width=CFG.width;c.height=CFG.height;const x=c.getContext('2d'),im=x.createImageData(CFG.width,CFG.height),d=im.data;
  for(let i=0;i<n;i++){
    const raw=a[i]===MISSING?0:Math.max(0,a[i]),q=raw>=430?raw:tmp[i],z=q/10,col=eRadarColor(z);if(!col)continue;
    const j=i*4;d[j]=col[0]|0;d[j+1]=col[1]|0;d[j+2]=col[2]|0;d[j+3]=z<10?130:z<20?182:z<35?220:242;
  }
  x.putImageData(im,0,0);eRadarCache.set(key,c);while(eRadarCache.size>28)eRadarCache.delete(eRadarCache.keys().next().value);return c;
}
function eRadar(now=performance.now()){
  if(!state.frames.length)return;const tr=state.transition,draw=(f,a)=>{const c=eRadarCanvas(f);if(!c)return;ctx.globalAlpha=a;ctx.drawImage(c,0,0)};ctx.save();
  if(tr&&tr.from!==tr.to){const u=clamp((now-tr.start)/CFG.radarBlendMs,0,1),t=u*u*(3-2*u);draw(state.frames[tr.from],1-t);draw(state.frames[tr.to],t);if(u>=1)state.transition=null}else draw(displayedFrame(),1);ctx.globalAlpha=1;ctx.restore();
}

function ePeak(field,def=view(),threshold=50,count=3){
  if(!field)return[];const key=`${field.key}|${def.id}|${threshold}|${count}|v8`;if(ePeakCache.has(key))return ePeakCache.get(key);const a=field.views?.[def.id];if(!a)return[];
  const cand=[];for(let y=5;y<CFG.height-5;y+=7)for(let x=5;x<CFG.width-5;x+=7){const q=a[y*CFG.width+x];if(q===MISSING||q<threshold*10)continue;let m=q;for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){const z=a[yy*CFG.width+xx];if(z!==MISSING)m=Math.max(m,z)}if(q>=m-5)cand.push({x,y,value:q/10})}
  cand.sort((a,b)=>b.value-a.value);const out=[];for(const q of cand){if(out.some(o=>(o.x-q.x)**2+(o.y-q.y)**2<45**2))continue;out.push(q);if(out.length>=count)break}ePeakCache.set(key,out);return out;
}
function eCells(frame=displayedFrame(),def=view()){
  if(!frame)return[];const key=`${frame.key}|${def.id}|v8`;if(eCellCache.has(key))return eCellCache.get(key);const a=frame.views?.[def.id];if(!a)return[];
  const cand=[],step=def.id==='home'?4:def.id==='metro'?5:6;for(let y=5;y<CFG.height-5;y+=step)for(let x=5;x<CFG.width-5;x+=step){const q=a[y*CFG.width+x];if(q===MISSING||q<450)continue;let m=q;for(let yy=y-3;yy<=y+3;yy+=2)for(let xx=x-3;xx<=x+3;xx+=2){const z=a[yy*CFG.width+xx];if(z!==MISSING)m=Math.max(m,z)}if(q>=m-5)cand.push({x,y,value:q/10})}
  cand.sort((a,b)=>b.value-a.value);const out=[];for(const q of cand){if(out.some(o=>(o.x-q.x)**2+(o.y-q.y)**2<58**2))continue;out.push(q);if(out.length>=2)break}eCellCache.set(key,out);while(eCellCache.size>28)eCellCache.delete(eCellCache.keys().next().value);return out;
}
function eFieldMax(field,id=view().id){const a=field?.views?.[id];if(!a)return null;let m=null;for(const q of a)if(q!==MISSING&&(m===null||q>m))m=q;return m==null?null:m/10}
function eGeomBounds(g){if(!g)return null;let w=Infinity,s=Infinity,e=-Infinity,n=-Infinity;walkCoords(g.coordinates,q=>{w=Math.min(w,q[0]);e=Math.max(e,q[0]);s=Math.min(s,q[1]);n=Math.max(n,q[1])});return Number.isFinite(w)?{w,s,e,n}:null}
function eBoxIntersects(a,b){return a&&!(a.e<b[0]||a.w>b[2]||a.n<b[1]||a.s>b[3])}
function eWarningsInView(){const out=[];for(const f of state.warnings.values()){const box=eGeomBounds(f.geometry);if(!eBoxIntersects(box,view().bbox))continue;const c=geometryCenter(f.geometry)||{lon:(box.w+box.e)/2,lat:(box.s+box.n)/2};out.push({f,c,code:warningCode(f)})}return out}
function eHazardColor(code){return code==='TOR'?'#ff4bd8':code==='SVR'?'#ffd54a':code==='FFW'?'#59ec8d':'#8ba4ad'}
function eDrawWarnings(){for(const {f,code} of eWarningsInView()){if(!['TOR','SVR','FFW'].includes(code))continue;const c=eHazardColor(code);eGeometry(ctx,view(),f.geometry,c,code==='TOR'?'rgba(255,75,216,.045)':code==='SVR'?'rgba(255,213,74,.035)':'rgba(89,236,141,.03)',code==='TOR'?2:1.5)}}
function eDrawTropics(){
  for(const f of state.tropics){const l=f._layer;if(l===7)eGeometry(ctx,view(),f.geometry,'rgba(89,213,255,.95)','rgba(89,213,255,.035)',1.25,[3,2]);else if(l===6)eGeometry(ctx,view(),f.geometry,'#6edcff',null,1.45);else if(l===11)eGeometry(ctx,view(),f.geometry,'rgba(180,202,211,.68)',null,.75,[2,2]);else if(l===5||l===10)eGeometry(ctx,view(),f.geometry,'#fff','#fff',.8);else if(l===8)eGeometry(ctx,view(),f.geometry,'#ffd15a',null,1.35);else if(l===15||l===16)eGeometry(ctx,view(),f.geometry,'rgba(255,99,83,.78)','rgba(255,99,83,.025)',.9);else if(l===2||l===3)eGeometry(ctx,view(),f.geometry,'rgba(255,170,65,.78)',null,.8,[3,2])}
}
