'use strict';

const radarCanvas=document.createElement('canvas');radarCanvas.width=CFG.width;radarCanvas.height=CFG.mapHeight;const radarCtx=radarCanvas.getContext('2d');
const LAND_POLYS=[
  [[-84.95,23.10],[-84.1,23.0],[-83.2,22.8],[-82.4,22.4],[-81.6,22.1],[-80.8,22.0],[-80.0,21.8],[-79.1,21.7],[-78.2,21.5],[-77.2,21.6],[-76.1,21.9],[-75.2,22.5],[-74.2,22.8],[-74.0,23.1],[-75.1,23.2],[-76.0,23.1],[-77.0,23.0],[-78.2,23.1],[-79.3,23.2],[-80.5,23.2],[-81.7,23.3],[-82.8,23.3],[-84.0,23.4],[-84.95,23.10]],
  [[-90.4,21.6],[-89.7,21.6],[-88.8,21.5],[-87.7,21.2],[-87.0,20.6],[-86.8,19.5],[-87.2,18.5],[-88.2,18.2],[-89.2,19.0],[-90.0,20.2],[-90.4,21.6]],
  [[-78.7,27.1],[-78.0,26.8],[-77.4,26.2],[-77.0,25.5],[-76.6,24.7],[-76.1,24.0],[-75.5,23.5],[-75.2,24.0],[-75.8,25.0],[-76.4,26.0],[-77.2,26.8],[-78.0,27.3],[-78.7,27.1]]
];

function traceCoords(coords,close=false){
  coords.forEach((c,i)=>{const p=mapXY(c[1],c[0]);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});if(close)ctx.closePath();
}
function drawGeometry(g,stroke,fill,width=1,dash=[]){
  if(!g)return;ctx.save();ctx.lineWidth=width;ctx.strokeStyle=stroke||'transparent';ctx.fillStyle=fill||'transparent';ctx.setLineDash(dash);
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:null,lines=g.type==='LineString'?[g.coordinates]:g.type==='MultiLineString'?g.coordinates:null,points=g.type==='Point'?[g.coordinates]:g.type==='MultiPoint'?g.coordinates:null;
  if(polys)for(const poly of polys){ctx.beginPath();for(const ring of poly)traceCoords(ring,true);if(fill)ctx.fill('evenodd');if(stroke)ctx.stroke()}
  if(lines)for(const line of lines){ctx.beginPath();traceCoords(line);if(stroke)ctx.stroke()}
  if(points)for(const c of points){const p=mapXY(c[1],c[0]);ctx.beginPath();ctx.arc(p.x,p.y,2.5,0,Math.PI*2);if(fill)ctx.fill();if(stroke)ctx.stroke()}
  ctx.restore();
}
function drawStaticLand(){
  ctx.save();ctx.fillStyle='#09141b';ctx.strokeStyle='rgba(151,193,211,.32)';ctx.lineWidth=.7;
  for(const poly of LAND_POLYS){ctx.beginPath();traceCoords(poly,true);ctx.fill();ctx.stroke()}ctx.restore();
}
function drawGrid(){
  const b=view().bbox,lonStep=view().id==='home'?.1:view().id==='metro'?.5:view().id==='florida'?2:5,latStep=view().id==='home'?.1:view().id==='metro'?.5:view().id==='florida'?2:5;
  ctx.save();ctx.strokeStyle='rgba(111,166,190,.075)';ctx.lineWidth=.5;ctx.setLineDash([2,3]);
  for(let lon=Math.ceil(b[0]/lonStep)*lonStep;lon<b[2];lon+=lonStep){const p1=mapXY(b[1],lon),p2=mapXY(b[3],lon);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
  for(let lat=Math.ceil(b[1]/latStep)*latStep;lat<b[3];lat+=latStep){const p1=mapXY(lat,b[0]),p2=mapXY(lat,b[2]);ctx.beginPath();ctx.moveTo(p1.x,p1.y);ctx.lineTo(p2.x,p2.y);ctx.stroke()}
  ctx.restore();
}
function drawBase(){
  ctx.fillStyle='#020a11';ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight);drawGrid();drawStaticLand();
  const b=state.boundaries.get(view().id);
  for(const f of b?.states||[])drawGeometry(f.geometry,'rgba(177,216,232,.38)','#0a151d',.8);
  if(view().id==='home'||view().id==='metro')for(const f of b?.counties||[])drawGeometry(f.geometry,'rgba(137,178,197,.20)',null,.45);
}
function colorDbz(v){
  if(v<5)return[0,0,0,0];
  for(let i=0;i<radarStops.length-1;i++){
    const [a,ca]=radarStops[i],[b,cb]=radarStops[i+1];if(v>=a&&v<=b){const t=(v-a)/(b-a);return[ca[0]+(cb[0]-ca[0])*t,ca[1]+(cb[1]-ca[1])*t,ca[2]+(cb[2]-ca[2])*t,clamp(155+v*1.45,165,238)]}
  }
  const c=radarStops.at(-1)[1];return[c[0],c[1],c[2],240];
}
function displayedFrame(){if(!state.frames.length)return null;return state.frames[clamp(state.cursor,0,state.frames.length-1)]||state.frames.at(-1)}
function drawRadar(){
  const f=displayedFrame();if(!f)return;const a=f.views[view().id],img=radarCtx.createImageData(CFG.width,CFG.mapHeight),d=img.data;
  for(let i=0;i<a.length;i++){const q=a[i];if(q===MISSING||q<50)continue;const c=colorDbz(q/10),j=i*4;d[j]=c[0];d[j+1]=c[1];d[j+2]=c[2];d[j+3]=c[3]}
  radarCtx.putImageData(img,0,0);ctx.save();ctx.globalCompositeOperation='source-over';ctx.drawImage(radarCanvas,0,CFG.top);ctx.restore();
}
function drawSevereOverlay(){
  const ltg=state.severe.lightning?.views?.[view().id],mesh=state.severe.mesh?.views?.[view().id];
  ctx.save();
  if(ltg){ctx.fillStyle='rgba(126,233,255,.78)';for(let y=2;y<CFG.mapHeight;y+=7)for(let x=2;x<CFG.width;x+=7){let m=0;for(let yy=y-2;yy<=y+2;yy++)for(let xx=x-2;xx<=x+2;xx++){const q=ltg[yy*CFG.width+xx];if(q!==MISSING)m=Math.max(m,q/10)}if(m>=30){const py=CFG.top+y,sz=m>=60?2:1;ctx.fillRect(x-sz/2,py-sz/2,sz,sz)}}}
  if(mesh){ctx.strokeStyle='rgba(255,82,220,.92)';ctx.lineWidth=.8;for(let y=3;y<CFG.mapHeight;y+=8)for(let x=3;x<CFG.width;x+=8){let m=0;for(let yy=y-3;yy<=y+3;yy++)for(let xx=x-3;xx<=x+3;xx++){const q=mesh[yy*CFG.width+xx];if(q!==MISSING)m=Math.max(m,q/10)}if(m>=25.4){ctx.beginPath();ctx.arc(x,CFG.top+y,m>=50.8?3:2,0,Math.PI*2);ctx.stroke()}}}
  ctx.restore();
}
function warningStyle(f){
  const p=f.properties||{},ph=String(p.phenom||p.event||p.prod_type||'').toUpperCase(),sig=String(p.sig||'').toUpperCase();
  if(ph==='TO'||ph.includes('TORNADO'))return['#ff42f4','rgba(255,50,245,.075)',2.1];
  if(ph==='SV'||ph.includes('SEVERE'))return['#ffe64e','rgba(255,224,65,.055)',1.8];
  if(ph==='FF'||ph.includes('FLOOD'))return['#3dff77','rgba(60,255,115,.045)',1.5];
  return[sig==='W'?'#ff8755':'#7dc8ff','rgba(255,255,255,.02)',1];
}
function drawWarnings(){for(const f of state.warnings.values()){const[s,fill,w]=warningStyle(f);drawGeometry(f.geometry,s,fill,w)}}
function drawTropics(){
  for(const f of state.tropics){
    const l=f._layer;
    if(l===7)drawGeometry(f.geometry,'rgba(122,235,255,.9)','rgba(80,220,255,.055)',1.1,[3,2]);
    else if(l===6||l===11)drawGeometry(f.geometry,l===6?'#7fe9ff':'rgba(140,170,185,.62)',null,l===6?1.5:.8,l===11?[2,2]:[]);
    else if(l===5||l===10)drawGeometry(f.geometry,'#f8fcff','#f8fcff',.8);
    else if(l===8)drawGeometry(f.geometry,'#ffcf4e',null,1.5);
    else if(l===15||l===16)drawGeometry(f.geometry,'rgba(255,115,95,.75)','rgba(255,90,75,.035)',.8);
    else if(l===2||l===3)drawGeometry(f.geometry,'rgba(255,178,70,.78)','rgba(255,164,45,.03)',.8,[3,2]);
  }
}
function drawMotion(){
  if(!state.motion||!['home','metro'].includes(view().id))return;const a=mapXY(state.motion.from.lat,state.motion.from.lon),b=mapXY(state.motion.to.lat,state.motion.to.lon);if(!Number.isFinite(a.x+b.x))return;
  const ex=b.x+(b.x-a.x)*1.6,ey=b.y+(b.y-a.y)*1.6,ang=Math.atan2(ey-b.y,ex-b.x);
  ctx.save();ctx.strokeStyle='rgba(113,230,255,.82)';ctx.fillStyle='#71e6ff';ctx.lineWidth=1.2;ctx.setLineDash([4,2]);ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(ex,ey);ctx.lineTo(ex-5*Math.cos(ang-.55),ey-5*Math.sin(ang-.55));ctx.lineTo(ex-5*Math.cos(ang+.55),ey-5*Math.sin(ang+.55));ctx.closePath();ctx.fill();ctx.restore();
}
function drawLabels(){
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='800 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';
  for(const[name,lat,lon]of view().labels){if(!within(lat,lon))continue;const p=mapXY(lat,lon);ctx.lineWidth=3;ctx.strokeStyle='rgba(0,2,5,.92)';ctx.strokeText(name,p.x,p.y);ctx.fillStyle='rgba(228,244,251,.86)';ctx.fillText(name,p.x,p.y)}
  if(within(CFG.home.lat,CFG.home.lon)){const h=mapXY(CFG.home.lat,CFG.home.lon);ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(h.x,h.y,5.3,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#55e4ff';ctx.beginPath();ctx.arc(h.x,h.y,2.2,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(85,228,255,.45)';ctx.beginPath();ctx.moveTo(h.x-8,h.y);ctx.lineTo(h.x-3.5,h.y);ctx.moveTo(h.x+3.5,h.y);ctx.lineTo(h.x+8,h.y);ctx.moveTo(h.x,h.y-8);ctx.lineTo(h.x,h.y-3.5);ctx.moveTo(h.x,h.y+3.5);ctx.lineTo(h.x,h.y+8);ctx.stroke()}
  ctx.restore();
}
function pointInRing(pt,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>pt.lat)!==(b[1]>pt.lat))&&(pt.lon<(b[0]-a[0])*(pt.lat-a[1])/(b[1]-a[1]+1e-12)+a[0]))c=!c}return c}
function containsPoint(g,pt){if(!g)return false;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polys.some(p=>p[0]&&pointInRing(pt,p[0]))}
function localAlert(){for(const f of state.warnings.values())if(containsPoint(f.geometry,CFG.home))return f;return null}
function drawLegend(){
  const xs=252,w=68,y=252,vals=[5,20,35,50,65];for(let i=0;i<vals.length;i++){const c=colorDbz(vals[i]);ctx.fillStyle=`rgb(${c[0]},${c[1]},${c[2]})`;ctx.fillRect(xs+i*(w/vals.length),y-3,Math.ceil(w/vals.length),3)}
  ctx.fillStyle='#6e8795';ctx.font='700 5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.textAlign='left';ctx.fillText('dBZ',323,253);
}
function drawHUD(){
  const fresh=freshness(),shown=displayedFrame(),latest=state.frames.at(-1),w=state.weather,alert=localAlert();panel.dataset.freshness=fresh;
  ctx.fillStyle='rgba(1,6,10,.965)';ctx.fillRect(0,0,CFG.width,CFG.top);ctx.fillRect(0,CFG.top+CFG.mapHeight,CFG.width,CFG.bottom);
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.font='900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillStyle='#5de5ff';ctx.fillText(`RDR  ${view().name}`,6,8);
  ctx.beginPath();ctx.fillStyle=fresh==='live'?'#44ef91':fresh==='delayed'?'#ffc84d':'#ff655f';ctx.arc(185,8,2.2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b9d0dc';ctx.font='800 6px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillText('LIVE MRMS',191,8);
  ctx.textAlign='right';ctx.fillStyle='#e8f4f8';ctx.font='900 8px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';const wx=w?.temp!=null?`${w.temp}°  ${w.windDir||''}${w.windMph!=null?w.windMph:''}`:'NOAA';ctx.fillText(wx,450,8);
  ctx.font='800 6px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.textAlign='left';ctx.fillStyle=alert?'#ffe65a':'#7894a4';const sub=alert?String(alert.properties?.prod_type||alert.properties?.event||alert.properties?.phenom||'LOCAL ALERT').replaceAll('_',' ').toUpperCase():`QC COMPOSITE  ${latest?utcTime(latest.time):'ACQUIRING'}`;ctx.fillText(sub.slice(0,53),6,20);
  ctx.textAlign='right';ctx.fillStyle='#7894a4';const obs=w?.rh!=null?`RH ${w.rh}%  ${w.station||''}`:`AGE ${Number.isFinite(ageMs())?Math.max(0,Math.round(ageMs()/60000)):'--'}m`;ctx.fillText(obs,450,20);

  const y1=243,y2=252;ctx.textAlign='left';ctx.font='900 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';const hc=state.home.status==='DRY'?'#8ed5ff':state.home.status==='LIGHT'?'#6ff0a0':state.home.status==='RAIN'?'#ffe75d':state.home.status==='HEAVY'?'#ff9b45':'#ff5c7a';ctx.fillStyle=hc;ctx.fillText(`HOME NOW ${state.home.status}${state.home.dbz>=5?` ${Math.round(state.home.dbz)}dBZ`:''}`,6,y1);
  ctx.fillStyle='#c8dce5';ctx.font='800 6px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';const near=state.home.nearest?`RAIN ${Math.max(1,Math.round(state.home.nearest.miles))}MI ${state.home.nearest.dir}`:'NO NEAR RAIN',eta=state.home.eta?` · ETA ~${state.home.eta.minutes}m`:'';ctx.fillText(`${near}${eta}`,6,y2);
  const lm=fieldMax(state.severe.lightning),mm=fieldMax(state.severe.mesh),chips=[];if(lm!=null&&lm>=10)chips.push(`LTG30 ${Math.round(lm)}%`);if(mm!=null&&mm>=12.7)chips.push(`MESH ${(mm/25.4).toFixed(1)}in`);if(state.motion)chips.push(`MOVE ${state.motion.dir}${state.motion.mph}`);
  ctx.textAlign='center';ctx.fillStyle=chips.length?'#e9f5fa':'#718895';ctx.fillText(chips.slice(0,2).join('  ·  '),218,y1);drawLegend();
  ctx.textAlign='right';ctx.fillStyle='#dcebf1';ctx.font='900 7px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillText(shown?compactTime(shown.time):'--:--',450,y1);ctx.font='800 5.5px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillStyle='#7894a4';const loop=state.frames.length>1&&shown&&latest?`${Math.round((shown.time-latest.time)/60000)}m LOOP`:'NOW';ctx.fillText(loop,450,y2);
}
function renderUnavailable(){ctx.fillStyle='#020a11';ctx.fillRect(0,CFG.top,CFG.width,CFG.mapHeight);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillStyle='#ff8e6f';ctx.fillText('LIVE MRMS FEED UNAVAILABLE',228,124);ctx.font='700 6px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';ctx.fillStyle='#8aa0ad';ctx.fillText('NO STALE RADAR FALLBACK',228,140)}
function render(){
  ctx.fillStyle='#02070d';ctx.fillRect(0,0,CFG.width,CFG.height);if(state.frames.length){drawBase();drawRadar();drawSevereOverlay();drawTropics();drawWarnings();drawMotion();drawLabels()}else renderUnavailable();drawHUD();
}
