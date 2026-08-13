'use strict';

const sm16=n=>(n&0x8000)?-(n&0x7fff):(n&0x7fff);
const sm32=n=>(n&0x80000000)?-(n&0x7fffffff):(n&0x7fffffff);
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c};
const radarYield=()=>new Promise(resolve=>setTimeout(resolve,0));

function parseGrib(ab){
  const d=new DataView(ab),u=new Uint8Array(ab),u32=o=>d.getUint32(o,false),u16=o=>d.getUint16(o,false);
  if(String.fromCharCode(...u.subarray(0,4))!=='GRIB')throw new Error('invalid GRIB2');
  let o=16,s={};
  while(o<u.length-4){
    if(u[o]===55&&u[o+1]===55&&u[o+2]===55&&u[o+3]===55)break;
    const len=u32(o),num=d.getUint8(o+4);if(!len||o+len>u.length)throw new Error('invalid GRIB section');s[num]={o,len};o+=len;
  }
  const a=s[1],g=s[3],r=s[5],z=s[7];if(!a||!g||!r||!z)throw new Error('incomplete GRIB2');
  const template=u16(r.o+9);if(template!==41)throw new Error(`unsupported GRIB packing ${template}`);
  const png=u.slice(z.o+5,z.o+z.len),pd=new DataView(png.buffer,png.byteOffset,png.byteLength);
  if(pd.getUint32(0,false)!==0x89504e47)throw new Error('missing PNG payload');
  const meta={
    nx:u32(g.o+30),ny:u32(g.o+34),la1:sm32(u32(g.o+46))/1e6,lo1:sm32(u32(g.o+50))/1e6,
    dx:u32(g.o+63)/1e6,dy:u32(g.o+67)/1e6,scan:d.getUint8(g.o+71),
    R:d.getFloat32(r.o+11,false),E:sm16(u16(r.o+15)),D:sm16(u16(r.o+17)),bits:d.getUint8(r.o+19),
    ref:new Date(Date.UTC(d.getUint16(a.o+12,false),d.getUint8(a.o+14)-1,d.getUint8(a.o+15),d.getUint8(a.o+16),d.getUint8(a.o+17),d.getUint8(a.o+18))),
    png,width:pd.getUint32(16,false),height:pd.getUint32(20,false),bitDepth:png[24],colorType:png[25],interlace:png[28]
  };
  const pngPacking=(meta.colorType===0&&meta.bitDepth===meta.bits&&[8,16].includes(meta.bits))||(meta.colorType===2&&meta.bitDepth===8&&meta.bits===24)||(meta.colorType===6&&meta.bitDepth===8&&meta.bits===32);
  if(meta.interlace!==0||!pngPacking)throw new Error(`unsupported PNG ${meta.bitDepth}/${meta.colorType}/${meta.interlace} for ${meta.bits}-bit GRIB`);
  if(meta.width!==meta.nx||meta.height!==meta.ny)throw new Error('grid PNG mismatch');
  return meta;
}

function makeSamplers(meta,defs=CFG.views){
  return defs.map(def=>{
    const x0=new Int32Array(CFG.width),x1=new Int32Array(CFG.width),xf=new Float32Array(CFG.width),buckets=new Map();
    for(let x=0;x<CFG.width;x++){
      const lon=def.bbox[0]+x/(CFG.width-1)*(def.bbox[2]-def.bbox[0]),sx=(lon360(lon)-meta.lo1)/meta.dx;
      if(sx<0||sx>meta.nx-1){x0[x]=x1[x]=-1;continue}
      x0[x]=Math.floor(sx);x1[x]=Math.min(meta.nx-1,x0[x]+1);xf[x]=sx-x0[x];
    }
    for(let y=0;y<CFG.mapHeight;y++){
      const lat=def.bbox[3]-y/(CFG.mapHeight-1)*(def.bbox[3]-def.bbox[1]),sy=(meta.la1-lat)/meta.dy;
      if(sy<0||sy>meta.ny-1)continue;
      const y0=Math.floor(sy),y1=Math.min(meta.ny-1,y0+1),yf=sy-y0;
      if(!buckets.has(y1))buckets.set(y1,[]);buckets.get(y1).push({target:y,y0,yf});
    }
    const data=new Int16Array(CFG.width*CFG.mapHeight);data.fill(MISSING);
    return{def,x0,x1,xf,buckets,data};
  });
}

function valueFromX(x,m){return(m.R+x*(2**m.E))*(10**(-m.D))}
function sampleValue(v,kind){if(!Number.isFinite(v)||v<=-900)return null;if(kind==='radar'&&v<=-90)return 0;return v}
function interpolated(a,b,t){if(a===null&&b===null)return null;if(a===null)return b;if(b===null)return a;return a+(b-a)*t}
function normalizedValue(v,kind){
  if(!Number.isFinite(v)||v<=-900)return MISSING;
  if(kind==='radar'&&v<=-90)return 0;
  return clamp(Math.round(v*10),-32767,32767);
}

async function decodePngToViews(meta,kind='radar'){
  const png=meta.png,pd=new DataView(png.buffer,png.byteOffset,png.byteLength),chunks=[];let o=8;
  while(o<png.length){
    const n=pd.getUint32(o,false),type=String.fromCharCode(...png.subarray(o+4,o+8));
    if(type==='IDAT')chunks.push(png.slice(o+8,o+8+n));o+=12+n;if(type==='IEND')break;
  }
  const total=chunks.reduce((a,b)=>a+b.length,0),packed=new Uint8Array(total);let at=0;
  for(const c of chunks){packed.set(c,at);at+=c.length}
  const raw=new Uint8Array(await inflate(packed,'deflate')),bpp=meta.bits===24?3:meta.bits===32?4:meta.bitDepth/8,stride=meta.nx*bpp;
  const row=new Uint8Array(stride),prev=new Uint8Array(stride),samplers=makeSamplers(meta);let pos=0;
  const readBuf=(buf,i)=>{
    if(meta.bits===16)return(buf[i*2]<<8)|buf[i*2+1];
    if(meta.bits===24){const o=i*3;return buf[o]*65536+buf[o+1]*256+buf[o+2]}
    if(meta.bits===32){const o=i*4;return buf[o]*16777216+buf[o+1]*65536+buf[o+2]*256+buf[o+3]}
    return buf[i];
  };
  const yieldEvery=state.runtime&&state.runtime.lowPower?48:192;
  for(let sy=0;sy<meta.ny;sy++){
    const filter=raw[pos++];
    for(let i=0;i<stride;i++){
      const rb=raw[pos++],a=i>=bpp?row[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;
      row[i]=(rb+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):filter===4?paeth(a,b,c):0))&255;
    }
    for(const s of samplers){
      const tasks=s.buckets.get(sy);if(!tasks)continue;
      for(const task of tasks){
        const base=task.target*CFG.width;
        for(let x=0;x<CFG.width;x++){
          const ix0=s.x0[x];if(ix0<0)continue;const ix1=s.x1[x],fx=s.xf[x];
          const topRow=task.y0===sy?row:prev;
          const a0=valueFromX(readBuf(topRow,ix0),meta),a1=valueFromX(readBuf(topRow,ix1),meta),b0=valueFromX(readBuf(row,ix0),meta),b1=valueFromX(readBuf(row,ix1),meta);
          const top=interpolated(sampleValue(a0,kind),sampleValue(a1,kind),fx),bottom=interpolated(sampleValue(b0,kind),sampleValue(b1,kind),fx),v=interpolated(top,bottom,task.yf);
          s.data[base+x]=normalizedValue(v,kind);
        }
      }
    }
    prev.set(row);
    if(sy>0&&sy%yieldEvery===0)await radarYield();
  }
  return Object.fromEntries(samplers.map(s=>[s.def.id,s.data]));
}

async function loadFieldKey(key,kind='radar'){
  const r=await fetch(`${CFG.mrmsBucket}/${key}`,{cache:'no-store'});if(!r.ok)throw new Error(`${r.status} ${key}`);
  const grib=await inflate(await r.arrayBuffer(),'gzip'),meta=parseGrib(grib),views=await decodePngToViews(meta,kind);
  return{key,time:meta.ref,views,meta};
}

function classifyDbz(v){return v<5?'DRY':v<20?'LIGHT':v<35?'RAIN':v<50?'HEAVY':'INTENSE'}
function sampleHome(frame){
  const def=CFG.views[0],p=mapXY(CFG.home.lat,CFG.home.lon,def),cx=Math.round(p.x),cy=Math.round(p.y-CFG.top),a=frame.views.home;let best=0;
  for(let y=Math.max(0,cy-3);y<=Math.min(CFG.mapHeight-1,cy+3);y++)for(let x=Math.max(0,cx-3);x<=Math.min(CFG.width-1,cx+3);x++){
    const q=a[y*CFG.width+x];if(q!==MISSING)best=Math.max(best,q/10);
  }
  return best;
}
function nearestRain(frame){
  let best=null,bestD2=Infinity;
  for(const id of ['home','metro']){
    const def=CFG.views.find(v=>v.id===id),a=frame.views[id],step=id==='home'?1:2;
    for(let y=0;y<CFG.mapHeight;y+=step)for(let x=0;x<CFG.width;x+=step){
      const q=a[y*CFG.width+x];if(q===MISSING||q<100)continue;const p=pixelLatLon(x,y,def),dy=(p.lat-CFG.home.lat)*69,dx=(p.lon-CFG.home.lon)*62.3,d2=dx*dx+dy*dy;
      if(d2<bestD2){bestD2=d2;best={lat:p.lat,lon:p.lon,dbz:q/10}}
    }
    if(best)break;
  }
  if(!best)return null;const miles=haversineMiles(CFG.home,best),brg=bearing(CFG.home,best);return{...best,miles,dir:dir8(brg),bearing:brg};
}
function centroid(frame,id='metro',threshold=20){
  const def=CFG.views.find(v=>v.id===id),a=frame.views[id];let sw=0,slat=0,slon=0,count=0;
  for(let y=0;y<CFG.mapHeight;y+=2)for(let x=0;x<CFG.width;x+=2){
    const q=a[y*CFG.width+x];if(q===MISSING||q<threshold*10)continue;const p=pixelLatLon(x,y,def),w=Math.max(1,q/10-threshold+1);sw+=w;slat+=p.lat*w;slon+=p.lon*w;count++;
  }
  return count>8?{lat:slat/sw,lon:slon/sw,count}:null;
}
function localCentroid(frame,center,radius=65,threshold=18){
  if(!frame||!center)return null;const def=CFG.views.find(v=>v.id==='metro'),a=frame.views.metro;let sw=0,slat=0,slon=0,count=0;
  for(let y=0;y<CFG.mapHeight;y+=2)for(let x=0;x<CFG.width;x+=2){const q=a[y*CFG.width+x];if(q===MISSING||q<threshold*10)continue;const p=pixelLatLon(x,y,def),dy=(p.lat-center.lat)*69,dx=(p.lon-center.lon)*62.3;if(dx*dx+dy*dy>radius*radius)continue;const w=Math.max(1,q/10-threshold+1);sw+=w;slat+=p.lat*w;slon+=p.lon*w;count++}
  return count>5?{lat:slat/sw,lon:slon/sw,count}:null;
}
function deriveMotion(nearest=null){
  if(state.frames.length<2)return null;const a=state.frames[state.frames.length-2],b=state.frames[state.frames.length-1];let ca=null,cb=null;
  if(nearest){ca=localCentroid(a,nearest);cb=localCentroid(b,nearest)}
  if(!ca||!cb){ca=centroid(a);cb=centroid(b)}if(!ca||!cb)return null;
  const hours=(b.time-a.time)/3600000;if(hours<=0)return null;const miles=haversineMiles(ca,cb),mph=miles/hours;if(mph<2||mph>90)return null;const brg=bearing(ca,cb);
  return{from:ca,to:cb,mph:Math.round(mph),bearing:brg,dir:dir8(brg)};
}
function deriveHome(){
  const f=state.frames.length?state.frames[state.frames.length-1]:null;if(!f)return;
  const dbz=sampleHome(f),nearest=dbz<5?nearestRain(f):null,motion=deriveMotion(nearest);let eta=null;
  if(motion&&nearest){const toward=bearing(nearest,CFG.home),diff=angleDiff(motion.bearing,toward),closing=motion.mph*Math.cos(diff*Math.PI/180),mins=nearest.miles/Math.max(1,closing)*60;if(diff<55&&closing>3&&nearest.miles<150&&mins>0&&mins<180)eta={minutes:Math.round(mins),miles:nearest.miles}}
  state.motion=motion;state.home={dbz,status:classifyDbz(dbz),nearest,eta};
}

async function backfillRadar(){
  if(state.radarBackfilling||!state.pendingRadarKeys||!state.pendingRadarKeys.length)return;
  state.radarBackfilling=true;
  try{
    const queue=state.pendingRadarKeys.splice(0);
    for(const key of queue){
      if(state.frames.some(f=>f.key===key))continue;
      try{
        const f=await loadFieldKey(key,'radar');state.frames.push(f);state.frames.sort((a,b)=>a.time-b.time);state.frames=state.frames.slice(-5);state.cursor=state.frames.length-1;deriveHome();render();
        await new Promise(resolve=>setTimeout(resolve,state.runtime&&state.runtime.lowPower?300:50));
      }catch(e){state.errors.push(`radar backfill: ${e}`)}
    }
  }finally{state.radarBackfilling=false}
}

async function pollRadar({initial=false}={}){
  if(state.radarLoading)return;state.radarLoading=true;
  try{
    const keys=await recentKeys(CFG.radarProduct,5),have=new Set(state.frames.map(f=>f.key)),newest=keys[keys.length-1];
    if(newest&&!have.has(newest)){
      const f=await loadFieldKey(newest,'radar');state.frames.push(f);state.frames.sort((a,b)=>a.time-b.time);state.frames=state.frames.slice(-5);state.cursor=state.frames.length-1;deriveHome();render();
      if(initial){panel.dataset.radar='live'}
    }
    state.lastListError=null;
    if(initial&&!verifyMode){
      const historyCount=state.runtime&&state.runtime.lowPower?2:3;
      state.pendingRadarKeys=keys.slice(0,-1).slice(-historyCount).reverse().filter(key=>!state.frames.some(f=>f.key===key));
      setTimeout(()=>backfillRadar().catch(e=>state.errors.push(String(e))),state.runtime&&state.runtime.lowPower?2200:900);
    }
  }catch(e){state.lastListError=e;state.errors.push(String(e));panel.dataset.radar=state.frames.length?'degraded':'unavailable';render()}
  finally{state.radarLoading=false;panel.dataset.freshness=freshness()}
}

function fieldMax(field,id=view().id){
  const a=field?.views?.[id];if(!a)return null;let m=null;for(let i=0;i<a.length;i++){const q=a[i];if(q!==MISSING&&(m===null||q>m))m=q}return m===null?null:m/10;
}
async function loadSevere(){
  for(const [name,product] of Object.entries(CFG.severeProducts)){
    try{const keys=await recentKeys(product,1),key=keys[keys.length-1];if(!key||state.severe[name]?.key===key)continue;state.severe[name]=await loadFieldKey(key,name);await radarYield()}
    catch(e){state.errors.push(`${name}: ${e}`)}
  }
  render();
}
