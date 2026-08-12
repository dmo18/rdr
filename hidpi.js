'use strict';

/*
 * Adaptive high-density renderer.
 *
 * RDR keeps a 456 x 257 logical coordinate system for the Yodeck target, but
 * the backing canvas tracks the final physical display size. This prevents a
 * 456 x 257 bitmap from being enlarged on laptops, TVs, tablets and phones.
 * Vector geography, text, alert polygons and the radar raster are rebuilt at
 * the active backing resolution while the UX geometry remains unchanged.
 */

const RDR_MAX_RENDER_SCALE=5;
const RDR_RENDER_STEP=.25;

function rdrPhysicalTarget(cssScale){
  const dpr=Math.max(1,Number(window.devicePixelRatio)||1);
  return Math.max(1,cssScale*dpr);
}
function rdrQuantizedScale(target){
  return Math.min(RDR_MAX_RENDER_SCALE,Math.max(1,Math.ceil(target/RDR_RENDER_STEP)*RDR_RENDER_STEP));
}
function rdrBackingKey(){return`${canvas.width}x${canvas.height}`}
function rdrSetMainTransform(){
  const sx=canvas.width/CFG.width,sy=canvas.height/CFG.height;
  ctx.setTransform(sx,0,0,sy,0,0);
  ctx.imageSmoothingEnabled=true;
  try{ctx.imageSmoothingQuality='high'}catch{}
}
function rdrInvalidateRenderCaches(){
  eRadarCache.clear();eBaseCache.clear();eLineCache.clear();
}
function rdrLayerCanvas(alpha=true){
  const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
  const x=c.getContext('2d',{alpha});
  x.setTransform(c.width/CFG.width,0,0,c.height/CFG.height,0,0);
  x.imageSmoothingEnabled=true;
  try{x.imageSmoothingQuality='high'}catch{}
  return{c,x};
}

fitPanel=function(){
  const cssScale=Math.max(.2,Math.min(innerWidth/CFG.width,innerHeight/CFG.height));
  panel.style.transform=`translate(-50%,-50%) scale(${cssScale})`;
  const physicalTarget=rdrPhysicalTarget(cssScale),renderScale=rdrQuantizedScale(physicalTarget),bw=Math.max(CFG.width,Math.round(CFG.width*renderScale)),bh=Math.max(CFG.height,Math.round(CFG.height*renderScale));
  const changed=canvas.width!==bw||canvas.height!==bh;
  if(changed){canvas.width=bw;canvas.height=bh;rdrInvalidateRenderCaches()}
  rdrSetMainTransform();
  state.render={cssScale,pixelRatio:Math.max(1,Number(window.devicePixelRatio)||1),physicalTarget,scale:canvas.width/CFG.width,backingWidth:canvas.width,backingHeight:canvas.height,capped:physicalTarget>RDR_MAX_RENDER_SCALE+.001};
  panel.dataset.renderScale=state.render.scale.toFixed(2);panel.dataset.backing=`${canvas.width}x${canvas.height}`;panel.dataset.resolution=state.render.capped?'hidpi-capped':'hidpi-native';
  if(changed&&panel.dataset.ready==='true')requestAnimationFrame(()=>render(performance.now()));
};

// Rebuild vector layers at the backing resolution so coastlines, counties and
// state lines are not bitmap-scaled on larger displays.
eBase=function(def=view()){
  const bd=state.boundaries.get(def.id),key=`${def.id}|${bd?.states?.length||0}|${bd?.counties?.length||0}|${rdrBackingKey()}|hidpi`;
  if(eBaseCache.has(key))return eBaseCache.get(key);
  const{c,x}=rdrLayerCanvas(false);
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
};

eLines=function(def=view()){
  const bd=state.boundaries.get(def.id),key=`${def.id}|${bd?.states?.length||0}|${bd?.counties?.length||0}|${rdrBackingKey()}|hidpi`;
  if(eLineCache.has(key))return eLineCache.get(key);
  const{c,x}=rdrLayerCanvas(true),countyA=def.id==='home'?.24:def.id==='metro'?.22:def.id==='florida'?.18:.10;
  for(const f of bd?.counties||[])eGeometry(x,def,f.geometry,`rgba(137,165,176,${countyA})`,null,.48);
  for(const f of bd?.states||[])eGeometry(x,def,f.geometry,'rgba(218,230,235,.72)',null,.9);
  x.strokeStyle='rgba(211,226,232,.30)';x.lineWidth=.55;for(const poly of E_LAND){x.beginPath();eTrace(x,def,poly,true);x.stroke()}
  eLineCache.set(key,c);while(eLineCache.size>12)eLineCache.delete(eLineCache.keys().next().value);return c;
};

function rdrFilteredRadar(a){
  const sw=CFG.width,sh=CFG.height,n=sw*sh,out=new Float32Array(n);
  for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
    const i=y*sw+x,q=a[i]===MISSING?0:Math.max(0,a[i]);if(q>=430){out[i]=q;continue}
    let sum=q*4,weight=4;
    if(x){const v=a[i-1];if(v!==MISSING){sum+=Math.max(0,v);weight++}}
    if(x<sw-1){const v=a[i+1];if(v!==MISSING){sum+=Math.max(0,v);weight++}}
    if(y){const v=a[i-sw];if(v!==MISSING){sum+=Math.max(0,v);weight++}}
    if(y<sh-1){const v=a[i+sw];if(v!==MISSING){sum+=Math.max(0,v);weight++}}
    out[i]=sum/weight;
  }
  return out;
}

// The source MRMS field is numeric, not an image. For larger displays we
// interpolate that numeric field into the physical backing raster before color
// mapping. This removes the blocky 456 x 257 bitmap upscale while preserving
// the same meteorological values and strong-cell cores.
eRadarCanvas=function(frame,def=view()){
  if(!frame)return null;const key=`${frame.key}|${def.id}|${rdrBackingKey()}|hidpi`;
  if(eRadarCache.has(key))return eRadarCache.get(key);
  const a=frame.views?.[def.id];if(!a)return null;
  const sw=CFG.width,sh=CFG.height,src=rdrFilteredRadar(a),rw=canvas.width,rh=canvas.height,c=document.createElement('canvas');c.width=rw;c.height=rh;
  const x=c.getContext('2d'),im=x.createImageData(rw,rh),d=im.data,x0=new Int32Array(rw),x1=new Int32Array(rw),xf=new Float32Array(rw);
  for(let px=0;px<rw;px++){const sx=rw===1?0:px/(rw-1)*(sw-1),a0=Math.floor(sx);x0[px]=a0;x1[px]=Math.min(sw-1,a0+1);xf[px]=sx-a0}
  for(let py=0;py<rh;py++){
    const sy=rh===1?0:py/(rh-1)*(sh-1),y0=Math.floor(sy),y1=Math.min(sh-1,y0+1),fy=sy-y0,r0=y0*sw,r1=y1*sw,base=py*rw;
    for(let px=0;px<rw;px++){
      const xa=x0[px],xb=x1[px],fx=xf[px],top=src[r0+xa]+(src[r0+xb]-src[r0+xa])*fx,bottom=src[r1+xa]+(src[r1+xb]-src[r1+xa])*fx,q=top+(bottom-top)*fy,z=q/10,col=eRadarColor(z);if(!col)continue;
      const j=(base+px)*4;d[j]=col[0]|0;d[j+1]=col[1]|0;d[j+2]=col[2]|0;d[j+3]=z<10?130:z<20?182:z<35?220:242;
    }
  }
  x.putImageData(im,0,0);eRadarCache.set(key,c);while(eRadarCache.size>28)eRadarCache.delete(eRadarCache.keys().next().value);return c;
};

eRadar=function(now=performance.now()){
  if(!state.frames.length)return;const tr=state.transition,draw=(f,a)=>{const c=eRadarCanvas(f);if(!c)return;ctx.globalAlpha=a;ctx.drawImage(c,0,0,CFG.width,CFG.height)};ctx.save();
  if(tr&&tr.from!==tr.to){const u=clamp((now-tr.start)/CFG.radarBlendMs,0,1),t=u*u*(3-2*u);draw(state.frames[tr.from],1-t);draw(state.frames[tr.to],t);if(u>=1)state.transition=null}else draw(displayedFrame(),1);ctx.globalAlpha=1;ctx.restore();
};

// alerts.js owns the production composition. Re-state it here only so the
// high-density cached base/line canvases are drawn into logical dimensions.
render=function(now=performance.now()){
  const t0=performance.now();rdrSetMainTransform();ctx.fillStyle='#04131b';ctx.fillRect(0,0,CFG.width,CFG.height);
  let alertBox=null;if(state.frames.length){ctx.drawImage(eBase(),0,0,CFG.width,CFG.height);eRadar(now);ctx.drawImage(eLines(),0,0,CFG.width,CFG.height);eDrawTropics();eDrawWarnings();eNearestRain();const occ=eOcc();alertBox=eAlertSummarySpec();if(alertBox)occ.push({x:alertBox.x,y:alertBox.y,w:alertBox.w,h:alertBox.h});eSevereSymbols(occ);eStormFocus(occ);eWarningLabels(occ);eCityLabels(occ);eHomeMarker();eScale();eVignette()}else renderUnavailable();
  eHeader();eFooter();if(alertBox)eAlertSummaryBox(alertBox);else eAlertSummaryBox(null);ePerf(performance.now()-t0);
};
