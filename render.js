'use strict';

const radarCache=new Map();
const LAND_POLYS=[
  [[-84.95,23.10],[-84.1,23.0],[-83.2,22.8],[-82.4,22.4],[-81.6,22.1],[-80.8,22.0],[-80.0,21.8],[-79.1,21.7],[-78.2,21.5],[-77.2,21.6],[-76.1,21.9],[-75.2,22.5],[-74.2,22.8],[-74.0,23.1],[-75.1,23.2],[-76.0,23.1],[-77.0,23.0],[-78.2,23.1],[-79.3,23.2],[-80.5,23.2],[-81.7,23.3],[-82.8,23.3],[-84.0,23.4],[-84.95,23.10]],
  [[-90.4,21.6],[-89.7,21.6],[-88.8,21.5],[-87.7,21.2],[-87.0,20.6],[-86.8,19.5],[-87.2,18.5],[-88.2,18.2],[-89.2,19.0],[-90.0,20.2],[-90.4,21.6]],
  [[-78.7,27.1],[-78.0,26.8],[-77.4,26.2],[-77.0,25.5],[-76.6,24.7],[-76.1,24.0],[-75.5,23.5],[-75.2,24.0],[-75.8,25.0],[-76.4,26.0],[-77.2,26.8],[-78.0,27.3],[-78.7,27.1]]
];

function traceCoords(coords,close=false){coords.forEach((c,i)=>{const p=mapXY(c[1],c[0]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});if(close)ctx.closePath()}
function drawGeometry(g,stroke,fill,width=1,dash=[]){
  if(!g)return;ctx.save();ctx.lineWidth=width;ctx.strokeStyle=stroke||'transparent';ctx.fillStyle=fill||'transparent';ctx.setLineDash(dash);
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:null,lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:null,points=g.type==='Point'?[g.coordinates]:g.type==='MultiPoint'?g.coordinates:null;
  if(polys)for(const poly of polys){ctx.beginPath();for(const ring of poly)traceCoords(ring,true);if(fill)ctx.fill('evenodd');if(stroke)ctx.stroke()}
  if(lines)for(const line of lines){ctx.beginPath();traceCoords(line);if(stroke)ctx.stroke()}
  if(points)for(const c of points){const p=mapXY(c[1],c[0]);ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);if(fill)ctx.fill();if(stroke)ctx.stroke()}
  ctx.restore();
}
function drawStaticLand(){
  ctx.save();ctx.fillStyle='#13191d';ctx.strokeStyle='rgba(145,171,181,.42)';ctx.lineWidth=.75;ctx.shadowColor='rgba(60,190,225,.10)';ctx.shadowBlur=3;
  for(const poly of LAND_POLYS){ctx.beginPath();traceCoords(poly,true);ctx.fill();ctx.stroke()}ctx.restore();
}
function drawBase(){
  const ocean=ctx.createLinearGradient(0,CFG.top,0,CFG.top+CFG.mapHeight);ocean.addColorStop(0,'#05090d');ocean.addColorStop(1,'#03070a');ctx.fillStyle=ocean;ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight);
  const halo=ctx.createRadialGradient(CFG.width*.62,CFG.top+CFG.mapHeight*.45,10,CFG.width*.62,CFG.top+CFG.mapHeight*.45,CFG.width*.75);halo.addColorStop(0,'rgba(24,42,50,.17)');halo.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=halo;ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight);
  drawStaticLand();
  const b=state.boundaries.get(view().id);
  for(const f of b?.states||[])drawGeometry(f.geometry,'rgba(168,190,200,.42)','#12191d',.75);
  if(view().id==='home'||view().id==='metro')for(const f of b?.counties||[])drawGeometry(f.geometry,'rgba(146,166,176,.18)',null,.42);
}
function colorDbz(v){
  if(v<5)return[0,0,0,0];
  for(let i=0;i<radarStops.length-1;i++){
    const [a,ca]=radarStops[i],[b,cb]=radarStops[i+1];if(v>=a&&v<=b){const t=(v-a)/(b-a);return[Math.round(ca[0]+(cb[0]-ca[0])*t),Math.round(ca[1]+(cb[1]-ca[1])*t),Math.round(ca[2]+(cb[2]-ca[2])*t),Math.round(clamp(174+v*1.1,178,248))]}
  }
  const c=radarStops.at(-1)[1];return[c[0],c[1],c[2],250];
}
function radarCanvasFor(frame,id=view().id){
  if(!frame)return null;const key=`${frame.key}|${id}`;if(radarCache.has(key))return radarCache.get(key);
  const c=document.createElement('canvas');c.width=CFG.width;c.height=CFG.mapHeight;const x=c.getContext('2d'),a=frame.views[id],img=x.createImageData(CFG.width,CFG.mapHeight),d=img.data;
  for(let i=0;i<a.length;i++){const q=a[i];if(q===MISSING||q<50)continue;const z=q/10,col=colorDbz(z),j=i*4;d[j]=col[0];d[j+1]=col[1];d[j+2]=col[2];d[j+3]=col[3]}
  x.putImageData(img,0,0);radarCache.set(key,c);while(radarCache.size>32)radarCache.delete(radarCache.keys().next().value);return c;
}
function displayedFrame(){if(!state.frames.length)return null;return state.frames[clamp(state.cursor,0,state.frames.length-1)]||state.frames.at(-1)}
function drawRadarCanvas(c,alpha){
  if(!c||alpha<=0)return;ctx.save();ctx.globalAlpha=alpha*.42;ctx.filter='blur(2.2px) saturate(1.28)';ctx.drawImage(c,0,CFG.top);ctx.globalAlpha=alpha;ctx.filter='none';ctx.drawImage(c,0,CFG.top);ctx.restore();
}
function drawRadar(now=performance.now()){
  if(!state.frames.length)return;const tr=state.transition;
  if(tr&&tr.from!==tr.to){const u=clamp((now-tr.start)/CFG.radarBlendMs,0,1),e=u*u*(3-2*u);drawRadarCanvas(radarCanvasFor(state.frames[tr.from]),1-e);drawRadarCanvas(radarCanvasFor(state.frames[tr.to]),e);if(u>=1)state.transition=null}
  else drawRadarCanvas(radarCanvasFor(displayedFrame()),1);
}
function surfaceFeatures(){return state.surface.get(view().id)||[]}
function cloudFraction(v){return cloudCodeValue(v)}
function drawCloudField(now=performance.now()){
  const features=surfaceFeatures();if(!features.length)return;const radiusBase=view().id==='home'?48:view().id==='metro'?38:view().id==='florida'?24:15,t=now/1000;
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const [i,f] of features.entries()){
    const c=f.geometry?.coordinates;if(!c)continue;const frac=cloudFraction(f.properties?.cloudcover);if(!(frac>.06))continue;const p=mapXY(c[1],c[0]),speed=Number(f.properties?.windspeed)||0,dir=(Number(f.properties?.winddir)||0)+180,rad=dir*Math.PI/180,drift=Math.min(7,speed*.16),dx=Math.sin(rad)*drift*Math.sin(t*.10+i*.77),dy=-Math.cos(rad)*drift*Math.sin(t*.10+i*.77);
    const lobes=frac>.75?3:frac>.35?2:1;
    for(let l=0;l<lobes;l++){
      const seed=i*11+l*17,cx=p.x+dx+(seeded(seed)-.5)*radiusBase*.52,cy=p.y+dy+(seeded(seed+2)-.5)*radiusBase*.30,r=radiusBase*(.55+frac*.65)*(l?0.72:1),g=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
      const a=.025+frac*.075;g.addColorStop(0,`rgba(224,233,238,${a})`);g.addColorStop(.42,`rgba(174,190,199,${a*.62})`);g.addColorStop(1,'rgba(90,108,119,0)');ctx.fillStyle=g;ctx.fillRect(cx-r,cy-r,r*2,r*2);
    }
  }
  ctx.restore();
}
function windVectorAt(px,py){
  let su=0,sv=0,sw=0;for(const f of surfaceFeatures()){
    const c=f.geometry?.coordinates,spd=Number(f.properties?.windspeed),dir=Number(f.properties?.winddir);if(!c||!Number.isFinite(spd)||!Number.isFinite(dir)||spd<1)continue;const p=mapXY(c[1],c[0]),d2=(p.x-px)**2+(p.y-py)**2,w=1/(80+d2),toward=(dir+180)*Math.PI/180;su+=Math.sin(toward)*spd*w;sv+=-Math.cos(toward)*spd*w;sw+=w;
  }
  if(!sw)return null;return{u:su/sw,v:sv/sw,speed:Math.hypot(su/sw,sv/sw)};
}
function resetWindParticles(){
  state.windParticles=[];state.windView=view().id;state.windLast=performance.now();const n=view().id==='home'?52:view().id==='metro'?46:view().id==='florida'?36:28;
  for(let i=0;i<n;i++)state.windParticles.push({x:seeded(i+state.view*101)*CFG.width,y:CFG.top+seeded(i+31+state.view*71)*CFG.mapHeight,life:seeded(i+61)*1.8});
}
function drawWindFlow(now=performance.now()){
  if(!surfaceFeatures().length)return;if(state.windView!==view().id||!state.windParticles.length)resetWindParticles();const dt=clamp((now-state.windLast)/1000,0,.18);state.windLast=now;const scale=view().id==='home'?.72:view().id==='metro'?.52:view().id==='florida'?.31:.18;
  ctx.save();ctx.lineCap='round';ctx.globalCompositeOperation='screen';
  for(let i=0;i<state.windParticles.length;i++){
    const p=state.windParticles[i],v=windVectorAt(p.x,p.y);if(!v||v.speed<1){p.x=seeded(i+now*.00001)*CFG.width;p.y=CFG.top+seeded(i+41+now*.00001)*CFG.mapHeight;continue}
    const mag=Math.max(1,v.speed),ux=v.u/mag,uy=v.v/mag,len=2.5+Math.min(5,mag*.16);p.x+=v.u*scale*dt;p.y+=v.v*scale*dt;p.life+=dt;
    if(p.x<-8||p.x>CFG.width+8||p.y<CFG.top-8||p.y>CFG.top+CFG.mapHeight+8||p.life>2.8){p.x=seeded(i+Math.floor(now/2500))*CFG.width;p.y=CFG.top+seeded(i+73+Math.floor(now/2500))*CFG.mapHeight;p.life=0}
    const a=.12+Math.min(.32,mag/70);ctx.strokeStyle=`rgba(200,235,249,${a})`;ctx.lineWidth=mag>25?1:.7;ctx.beginPath();ctx.moveTo(p.x-ux*len,p.y-uy*len);ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  ctx.restore();
}
function drawSevereOverlay(now=performance.now()){
  const ltg=state.severe.lightning?.views?.[view().id],mesh=state.severe.mesh?.views?.[view().id];ctx.save();
  if(ltg){ctx.globalCompositeOperation='screen';for(let y=5;y<CFG.mapHeight-5;y+=11)for(let x=5;x<CFG.width-5;x+=11){let m=0;for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){const q=ltg[yy*CFG.width+xx];if(q!==MISSING)m=Math.max(m,q/10)}if(m>=22){const py=CFG.top+y,r=3+Math.min(8,m*.07),pulse=.55+.45*Math.sin(now/180+x*.17+y*.11),g=ctx.createRadialGradient(x,py,0,x,py,r);g.addColorStop(0,`rgba(205,245,255,${.10+.18*pulse})`);g.addColorStop(.35,`rgba(84,205,255,${.08+.12*pulse})`);g.addColorStop(1,'rgba(40,100,255,0)');ctx.fillStyle=g;ctx.fillRect(x-r,py-r,r*2,r*2);if(m>=48&&pulse>.82){ctx.strokeStyle=`rgba(245,252,255,${.45+.45*pulse})`;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(x,py-3);ctx.lineTo(x-1,py);ctx.lineTo(x+1,py);ctx.lineTo(x,py+4);ctx.stroke()}}}}
  if(mesh){ctx.globalCompositeOperation='source-over';for(let y=4;y<CFG.mapHeight;y+=9)for(let x=4;x<CFG.width;x+=9){let m=0;for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){const q=mesh[yy*CFG.width+xx];if(q!==MISSING)m=Math.max(m,q/10)}if(m>=25.4){const pulse=.75+.25*Math.sin(now/260+x*.09+y*.13);ctx.strokeStyle=`rgba(255,73,220,${.48+.34*pulse})`;ctx.shadowColor='rgba(255,45,218,.65)';ctx.shadowBlur=3;ctx.lineWidth=m>=50.8?1.35:.8;ctx.beginPath();ctx.arc(x,CFG.top+y,(m>=50.8?3.4:2.2)*pulse,0,Math.PI*2);ctx.stroke()}}}
  ctx.restore();
}
function warningStyle(f){
  const p=f.properties||{},ph=String(p.phenom||p.event||p.prod_type||'').toUpperCase(),sig=String(p.sig||'').toUpperCase();
  if(ph==='TO'||ph.includes('TORNADO'))return['#ff49f4','rgba(255,40,245,.09)',2.4];if(ph==='SV'||ph.includes('SEVERE'))return['#ffe54d','rgba(255,220,50,.07)',2];if(ph==='FF'||ph.includes('FLOOD'))return['#41ff79','rgba(60,255,115,.055)',1.7];return[sig==='W'?'#ff8b55':'#79cfff','rgba(255,255,255,.025)',1.15];
}
function drawWarnings(){ctx.save();ctx.shadowBlur=3;for(const f of state.warnings.values()){const[s,fill,w]=warningStyle(f);ctx.shadowColor=s;drawGeometry(f.geometry,s,fill,w)}ctx.restore()}
function drawTropics(){
  for(const f of state.tropics){const l=f._layer;if(l===7)drawGeometry(f.geometry,'rgba(116,232,255,.95)','rgba(75,215,255,.07)',1.35,[3,2]);else if(l===6||l===11)drawGeometry(f.geometry,l===6?'#73eaff':'rgba(150,177,190,.66)',null,l===6?1.7:.85,l===11?[2,2]:[]);else if(l===5||l===10)drawGeometry(f.geometry,'#ffffff','#ffffff',1);else if(l===8)drawGeometry(f.geometry,'#ffd04e',null,1.7);else if(l===15||l===16)drawGeometry(f.geometry,'rgba(255,106,92,.82)','rgba(255,88,74,.045)',1);else if(l===2||l===3)drawGeometry(f.geometry,'rgba(255,178,65,.88)','rgba(255,160,42,.04)',1,[3,2])}
}
function drawMotion(){
  if(!state.motion||!['home','metro'].includes(view().id))return;const a=mapXY(state.motion.from.lat,state.motion.from.lon),b=mapXY(state.motion.to.lat,state.motion.to.lon);if(!Number.isFinite(a.x+b.x))return;const ex=b.x+(b.x-a.x)*1.7,ey=b.y+(b.y-a.y)*1.7,ang=Math.atan2(ey-b.y,ex-b.x);
  ctx.save();ctx.strokeStyle='rgba(112,232,255,.88)';ctx.fillStyle='#72e9ff';ctx.shadowColor='rgba(80,220,255,.65)';ctx.shadowBlur=4;ctx.lineWidth=1.3;ctx.setLineDash([4,2]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-5*Math.cos(ang-.55),ey-5*Math.sin(ang-.55));ctx.lineTo(ex-5*Math.cos(ang+.55),ey-5*Math.sin(ang+.55));ctx.closePath();ctx.fill();ctx.restore();
}
function drawLabels(){
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 7px Inter,system-ui,-apple-system,"Segoe UI",sans-serif';for(const[name,lat,lon]of view().labels){if(!within(lat,lon))continue;const p=mapXY(lat,lon);ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.92)';ctx.strokeText(name,p.x,p.y);ctx.fillStyle='rgba(235,241,244,.84)';ctx.fillText(name,p.x,p.y)}
  if(within(CFG.home.lat,CFG.home.lon)){const h=mapXY(CFG.home.lat,CFG.home.lon);ctx.strokeStyle='#f7fcff';ctx.shadowColor='rgba(82,226,255,.85)';ctx.shadowBlur=5;ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(h.x,h.y,5.5,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#59e5ff';ctx.beginPath();ctx.arc(h.x,h.y,2.25,0,Math.PI*2);ctx.fill()}ctx.restore();
}
function pointInRing(pt,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>pt.lat)!==(b[1]>pt.lat))&&(pt.lon<(b[0]-a[0])*(pt.lat-a[1])/(b[1]-a[1]+1e-12)+a[0]))c=!c}return c}
function containsPoint(g,pt){if(!g)return false;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polys.some(p=>p[0]&&pointInRing(pt,p[0]))}
function localAlert(){for(const f of state.warnings.values())if(containsPoint(f.geometry,CFG.home))return f;return null}
function surfaceStats(){
  let clouds=0,cn=0,wind=0;for(const f of surfaceFeatures()){const c=cloudFraction(f.properties?.cloudcover);if(c!=null){clouds+=c;cn++}const w=Number(f.properties?.windspeed);if(Number.isFinite(w))wind=Math.max(wind,w)}return{cloud:cn?clouds/cn:null,wind};
}
function drawWeatherGlyph(x,y){
  const cover=state.weather?.cloudCover||0,text=String(state.weather?.text||'').toLowerCase();ctx.save();ctx.translate(x,y);ctx.lineWidth=1;ctx.strokeStyle='rgba(232,244,250,.92)';ctx.fillStyle='rgba(210,225,232,.28)';if(cover>.18||text.includes('cloud')){ctx.beginPath();ctx.arc(-3,0,3,Math.PI,0);ctx.arc(1,-1.5,4,Math.PI,0);ctx.arc(5,0,3,Math.PI,0);ctx.lineTo(5,2);ctx.lineTo(-3,2);ctx.closePath();ctx.fill();ctx.stroke()}else{ctx.beginPath();ctx.arc(1,0,3,0,Math.PI*2);ctx.stroke();for(let a=0;a<Math.PI*2;a+=Math.PI/2){ctx.beginPath();ctx.moveTo(1+Math.cos(a)*5,Math.sin(a)*5);ctx.lineTo(1+Math.cos(a)*7,Math.sin(a)*7);ctx.stroke()}}if(text.includes('thunder')){ctx.strokeStyle='#7de8ff';ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(-1,6);ctx.lineTo(1,5);ctx.lineTo(0,8);ctx.stroke()}else if(text.includes('rain')||text.includes('shower')){ctx.strokeStyle='#69d7ff';ctx.beginPath();ctx.moveTo(-2,4);ctx.lineTo(-3,7);ctx.moveTo(2,4);ctx.lineTo(1,7);ctx.stroke()}ctx.restore();
}
function drawTimeline(shown){
  const x=172,y=248,w=112,h=3,grad=ctx.createLinearGradient(x,y,x+w,y);for(let i=0;i<radarStops.length;i++){const [z,c]=radarStops[i];grad.addColorStop(i/(radarStops.length-1),`rgb(${c[0]},${c[1]},${c[2]})`)}ctx.fillStyle='rgba(255,255,255,.08)';ctx.beginPath();ctx.roundRect(x-18,241,w+36,13,6);ctx.fill();ctx.fillStyle=grad;ctx.fillRect(x,y,w,h);ctx.font='700 5px Inter,system-ui,sans-serif';ctx.fillStyle='#7f929c';ctx.textBaseline='middle';ctx.textAlign='right';ctx.fillText('LOW',x-4,249);ctx.textAlign='left';ctx.fillText('HIGH',x+w+4,249);ctx.textAlign='center';ctx.fillStyle='#eaf6fa';ctx.font='800 6px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText(shown?compactTime(shown.time):'--:--',x+w/2,244);
}
function drawVignette(){const g=ctx.createRadialGradient(CFG.width/2,CFG.top+CFG.mapHeight/2,CFG.mapHeight*.2,CFG.width/2,CFG.top+CFG.mapHeight/2,CFG.width*.65);g.addColorStop(.58,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.33)');ctx.fillStyle=g;ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight)}
function drawHUD(){
  const fresh=freshness(),shown=displayedFrame(),latest=state.frames.at(-1),w=state.weather,alert=localAlert(),ss=surfaceStats();panel.dataset.freshness=fresh;
  const top=ctx.createLinearGradient(0,0,0,CFG.top);top.addColorStop(0,'rgba(2,4,7,.99)');top.addColorStop(1,'rgba(3,7,10,.94)');ctx.fillStyle=top;ctx.fillRect(0,0,CFG.width,CFG.top);ctx.fillStyle='rgba(1,4,7,.965)';ctx.fillRect(0,CFG.top+CFG.mapHeight,CFG.width,CFG.bottom);
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#f0f7fa';ctx.font='500 16px Inter,system-ui,sans-serif';ctx.fillText(w?.temp!=null?`${w.temp}°`:'--°',6,12);drawWeatherGlyph(43,11);
  ctx.font='800 7px Inter,system-ui,sans-serif';ctx.fillStyle='#dce9ee';ctx.fillText(view().name,56,8);ctx.font='650 5.5px Inter,system-ui,sans-serif';ctx.fillStyle=alert?'#ffe45b':'#7f939e';const cond=alert?String(alert.properties?.prod_type||alert.properties?.event||'LOCAL ALERT').replaceAll('_',' ').toUpperCase():(w?.text||'LIVE WEATHER').toUpperCase();ctx.fillText(cond.slice(0,28),56,19);
  ctx.beginPath();ctx.fillStyle=fresh==='live'?'#46ee91':fresh==='delayed'?'#ffc84d':'#ff655f';ctx.arc(222,8,2.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#a9bdc6';ctx.font='750 5.5px Inter,system-ui,sans-serif';ctx.fillText('LIVE MRMS',228,8);ctx.fillStyle='#70848e';ctx.fillText(latest?`QC ${utcTime(latest.time)}`:'ACQUIRING',228,19);
  ctx.textAlign='right';ctx.font='800 7px Inter,system-ui,sans-serif';ctx.fillStyle='#edf6f9';ctx.fillText(w?.windMph!=null?`${w.windDir||''} ${w.windMph} MPH`:'NOAA',450,8);ctx.font='650 5.5px Inter,system-ui,sans-serif';ctx.fillStyle='#81939c';const cl=w?.cloudCover!=null?`CLOUD ${Math.round(w.cloudCover*100)}%`:ss.cloud!=null?`CLOUD ${Math.round(ss.cloud*100)}%`:'';ctx.fillText(`${cl}${w?.rh!=null?`  RH ${w.rh}%`:''}`,450,19);

  ctx.textAlign='left';ctx.font='850 7px Inter,system-ui,sans-serif';const hc=state.home.status==='DRY'?'#8ed5ff':state.home.status==='LIGHT'?'#6ff0a0':state.home.status==='RAIN'?'#ffe75d':state.home.status==='HEAVY'?'#ff9b45':'#ff5c7a';ctx.fillStyle=hc;ctx.fillText(`HOME ${state.home.status}`,6,244);ctx.font='650 5.5px Inter,system-ui,sans-serif';ctx.fillStyle='#8497a1';const near=state.home.nearest?`RAIN ${Math.max(1,Math.round(state.home.nearest.miles))}MI ${state.home.nearest.dir}`:'NO NEAR RAIN',eta=state.home.eta?` · ETA ${state.home.eta.minutes}m`:'';ctx.fillText(`${near}${eta}`,6,253);
  drawTimeline(shown);
  const lm=fieldMax(state.severe.lightning),mm=fieldMax(state.severe.mesh),chips=[];if(lm!=null&&lm>=10)chips.push(`LTG30 ${Math.round(lm)}%`);if(mm!=null&&mm>=12.7)chips.push(`HAIL ${(mm/25.4).toFixed(1)}in`);if(!chips.length&&ss.cloud!=null)chips.push(`CLD ${Math.round(ss.cloud*100)}%`);if(state.motion)chips.push(`${state.motion.dir} ${state.motion.mph}mph`);else if(ss.wind>0)chips.push(`WND ${Math.round(ss.wind)}kt`);
  ctx.textAlign='right';ctx.font='750 6px Inter,system-ui,sans-serif';ctx.fillStyle=chips.length?'#dcecf2':'#788b94';ctx.fillText(chips.slice(0,2).join(' · '),450,244);ctx.font='650 5.5px Inter,system-ui,sans-serif';ctx.fillStyle='#758892';const loop=state.frames.length>1&&shown&&latest?`${Math.round((shown.time-latest.time)/60000)}m LOOP`:'NOW';ctx.fillText(`${loop} · ${fresh.toUpperCase()}`,450,253);
}
function renderUnavailable(){ctx.fillStyle='#05090d';ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 11px Inter,system-ui,sans-serif';ctx.fillStyle='#ff8e6f';ctx.fillText('LIVE MRMS FEED UNAVAILABLE',228,124);ctx.font='650 6px Inter,system-ui,sans-serif';ctx.fillStyle='#8aa0ad';ctx.fillText('NO STALE RADAR FALLBACK',228,140)}
function render(now=performance.now()){
  ctx.fillStyle='#020508';ctx.fillRect(0,0,CFG.width,CFG.height);if(state.frames.length){drawBase();drawCloudField(now);drawRadar(now);drawSevereOverlay(now);drawTropics();drawWarnings();drawWindFlow(now);drawMotion();drawLabels();drawVignette()}else renderUnavailable();drawHUD();
}
