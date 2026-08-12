'use strict';

/*
 * RDR vNext UX layer.
 *
 * The NOAA/MRMS acquisition engine stays unchanged. This module replaces the
 * final presentation layer with a map-first composition: transparent labels,
 * visible lightning risk, storm motion arrows, compact alert reporting in the
 * perimeter HUD, and no floating advisory card over the map.
 */

const V_UX_BUILD='vnext-2026.08.12.1';
const V_MOTION_CACHE=new Map();

function vEnsureUx(){
  if(!state.ux)state.ux={};
  state.ux.build=V_UX_BUILD;
  return state.ux;
}

function vHaloText(text,x,y,{font='700 6px Arial,Helvetica,sans-serif',fill='#eef5f7',align='center',alpha=.98,halo='rgba(1,6,9,.78)',haloRadius=.85}={}){
  ctx.save();ctx.font=font;ctx.textAlign=align;ctx.textBaseline='middle';ctx.globalAlpha=alpha;
  ctx.fillStyle=halo;
  for(const[dx,dy]of [[-haloRadius,0],[haloRadius,0],[0,-haloRadius],[0,haloRadius],[-haloRadius,-haloRadius],[haloRadius,haloRadius]])ctx.fillText(text,x+dx,y+dy);
  ctx.fillStyle=fill;ctx.fillText(text,x,y);ctx.restore();
}

function vCityLabels(occ){
  const def=view(),base=def.id==='home'?7.0:def.id==='metro'?6.7:def.id==='florida'?6.25:5.9,max=def.id==='home'?6:def.id==='metro'?6:def.id==='florida'?7:6;
  let drawn=0;
  for(const[name,lat,lon]of def.labels){
    if(drawn>=max||!within(lat,lon,def))continue;
    if(def.id==='home'&&name==='HALLANDALE')continue;
    if(def.id==='metro'&&['HOLLYWOOD','KEY LARGO'].includes(name))continue;
    const p=ePoint(lat,lon,def),off=E_LABEL_OFF[def.id]?.[name]||[0,0],x=p.x+off[0],y=p.y+off[1];if(!eInMap(y,6))continue;
    const font=`800 ${base}px Arial,Helvetica,sans-serif`;ctx.font=font;const w=Math.ceil(ctx.measureText(name).width)+4,h=9.5,b=ePlace(occ,w,h,[[x-w/2,y-h/2],[x-w/2,y-h-10],[x-w/2,y+3]]);if(!b)continue;
    vHaloText(name,b.x+b.w/2,b.y+b.h/2+.1,{font,fill:'rgba(238,246,249,.96)',halo:'rgba(0,6,10,.78)',haloRadius:.72});drawn++;
  }
  const ux=vEnsureUx();ux.cityLabels=drawn;ux.cityLabelBoxes=0;
}

function vLightningAtHome(){
  const field=state.severe.lightning,a=field?.views?.home;if(!a)return null;const def=CFG.views[0],p=mapXY(CFG.home.lat,CFG.home.lon,def),cx=Math.round(p.x),cy=Math.round(p.y);let best=null;
  for(let y=Math.max(0,cy-4);y<=Math.min(CFG.height-1,cy+4);y++)for(let x=Math.max(0,cx-4);x<=Math.min(CFG.width-1,cx+4);x++){const q=a[y*CFG.width+x];if(q!==MISSING&&(best===null||q>best))best=q}
  return best===null?null:best/10;
}

function vNearestLightning(threshold=30){
  const field=state.severe.lightning;if(!field)return null;let best=null,bestD2=Infinity;
  for(const id of ['home','metro']){
    const def=CFG.views.find(v=>v.id===id),a=field.views?.[id];if(!a)continue;const step=id==='home'?2:3;
    for(let y=E_MAP_TOP;y<E_MAP_BOTTOM;y+=step)for(let x=0;x<CFG.width;x+=step){const q=a[y*CFG.width+x];if(q===MISSING||q<threshold*10)continue;const p=pixelLatLon(x,y,def),dy=(p.lat-CFG.home.lat)*69,dx=(p.lon-CFG.home.lon)*62.3,d2=dx*dx+dy*dy;if(d2<bestD2){bestD2=d2;best={...p,value:q/10}}}
    if(best&&id==='home')break;
  }
  if(!best)return null;return{...best,miles:haversineMiles(CFG.home,best),dir:dir8(bearing(CFG.home,best))};
}

function vBolt(x,y,scale=1,alpha=1){
  ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=alpha;ctx.shadowColor='rgba(255,241,111,.72)';ctx.shadowBlur=4.5;ctx.fillStyle='#fff27a';ctx.beginPath();ctx.moveTo(1.3,-5.5);ctx.lineTo(-2.5,-.4);ctx.lineTo(.2,-.4);ctx.lineTo(-1.4,5.5);ctx.lineTo(3,-1.2);ctx.lineTo(.3,-1.2);ctx.closePath();ctx.fill();ctx.restore();
}

function vLightningSymbols(occ,now=performance.now()){
  const def=view(),field=state.severe.lightning,maxCount=def.id==='home'?3:def.id==='metro'?4:def.id==='florida'?5:4,peaks=ePeak(field,def,35,maxCount);let drawn=0;
  for(let i=0;i<peaks.length;i++){
    const q=peaks[i];if(!eInMap(q.y,7))continue;const pulse=.78+.22*Math.sin(now/310+i*1.7),s=q.value>=70?1.1:.88;
    ctx.save();ctx.strokeStyle=`rgba(255,241,111,${.22+.18*pulse})`;ctx.lineWidth=.55;ctx.beginPath();ctx.arc(q.x,q.y,4.5+(q.value/100)*3,0,Math.PI*2);ctx.stroke();ctx.restore();vBolt(q.x,q.y,s,pulse);drawn++;
  }
  const ux=vEnsureUx();ux.lightningSymbols=drawn;ux.lightningMode='mrms-probability';
}

function vCentroidAround(frame,def,cx,cy,radiusPx=24,threshold=28){
  const a=frame?.views?.[def.id];if(!a)return null;let sw=0,sx=0,sy=0,count=0;const r2=radiusPx*radiusPx,step=def.id==='regional'?3:2;
  for(let y=Math.max(E_MAP_TOP,Math.floor(cy-radiusPx));y<=Math.min(E_MAP_BOTTOM-1,Math.ceil(cy+radiusPx));y+=step)for(let x=Math.max(0,Math.floor(cx-radiusPx));x<=Math.min(CFG.width-1,Math.ceil(cx+radiusPx));x+=step){
    const dx=x-cx,dy=y-cy;if(dx*dx+dy*dy>r2)continue;const q=a[y*CFG.width+x];if(q===MISSING||q<threshold*10)continue;const w=Math.max(1,q/10-threshold+1);sw+=w;sx+=x*w;sy+=y*w;count++;
  }
  if(count<4||!sw)return null;const x=sx/sw,y=sy/sw,p=pixelLatLon(x,y,def);return{x,y,lat:p.lat,lon:p.lon,count};
}

function vStormTracks(def=view()){
  if(state.frames.length<2)return[];const old=state.frames.at(-2),cur=state.frames.at(-1),key=`${old.key}|${cur.key}|${def.id}|vnext1`;if(V_MOTION_CACHE.has(key))return V_MOTION_CACHE.get(key);
  const hours=(cur.time-old.time)/3600000;if(!(hours>0)){V_MOTION_CACHE.set(key,[]);return[]}
  const max=def.id==='home'?2:def.id==='metro'?3:def.id==='florida'?3:2,radius=def.id==='home'?24:def.id==='metro'?28:def.id==='florida'?20:12,cores=eCells(cur,def).filter(c=>c.value>=45&&eInMap(c.y,10)).slice(0,8),out=[];
  for(const c of cores){if(out.some(o=>(o.x-c.x)**2+(o.y-c.y)**2<42**2))continue;const a=vCentroidAround(old,def,c.x,c.y,radius),b=vCentroidAround(cur,def,c.x,c.y,radius);if(!a||!b)continue;const miles=haversineMiles(a,b),mph=miles/hours;if(mph<5||mph>85)continue;const brg=bearing(a,b);out.push({x:b.x,y:b.y,mph:Math.round(mph),bearing:brg,dir:dir8(brg),value:c.value});if(out.length>=max)break}
  if(!out.length&&['home','metro'].includes(def.id)&&state.motion&&Number.isFinite(state.motion.mph)){const c=cores[0];if(c)out.push({x:c.x,y:c.y,mph:state.motion.mph,bearing:state.motion.bearing,dir:state.motion.dir,value:c.value})}
  V_MOTION_CACHE.set(key,out);while(V_MOTION_CACHE.size>20)V_MOTION_CACHE.delete(V_MOTION_CACHE.keys().next().value);return out;
}

function vStormMotionArrows(occ){
  const def=view(),tracks=vStormTracks(def);let drawn=0;
  for(const t of tracks){const r=t.bearing*Math.PI/180,len=def.id==='home'?17:def.id==='metro'?19:22,dx=Math.sin(r)*len,dy=-Math.cos(r)*len,x1=t.x+dx*.18,y1=t.y+dy*.18,x2=t.x+dx,y2=t.y+dy;if(!eInMap(y1,7)||!eInMap(y2,7))continue;
    ctx.save();ctx.strokeStyle='rgba(132,226,249,.82)';ctx.fillStyle='rgba(132,226,249,.92)';ctx.lineWidth=.85;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();const ang=Math.atan2(y2-y1,x2-x1),ah=3.8;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-Math.cos(ang-.55)*ah,y2-Math.sin(ang-.55)*ah);ctx.lineTo(x2-Math.cos(ang+.55)*ah,y2-Math.sin(ang+.55)*ah);ctx.closePath();ctx.fill();ctx.restore();
    if(def.id!=='regional'&&drawn<2){const text=`${t.dir} ${t.mph}`,font='800 4.7px Arial,Helvetica,sans-serif';ctx.font=font;const w=Math.ceil(ctx.measureText(text).width)+3,h=7,b=ePlace(occ,w,h,[[x2+3,y2-4],[x2-w-3,y2-4],[x2+3,y2+2]]);if(b)vHaloText(text,b.x+b.w/2,b.y+b.h/2,{font,fill:'#8fe7fb',halo:'rgba(0,7,10,.78)',haloRadius:.65})}
    drawn++;
  }
  const ux=vEnsureUx();ux.motionArrows=drawn;
}

function vStormFocus(occ){
  const def=view(),limit=def.id==='home'?1:def.id==='metro'?2:def.id==='florida'?3:2;let shown=0;
  for(const c of eCells()){if(shown>=limit||c.value<50||!eInMap(c.y,10))continue;const accent=c.value>=60?'#d852bc':c.value>=55?'#f04c66':'#f56a43',label=`${Math.round(c.value)} dBZ`;
    ctx.save();ctx.strokeStyle=accent;ctx.lineWidth=.85;ctx.beginPath();ctx.arc(c.x,c.y,3.7,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.font='800 5.1px Arial,Helvetica,sans-serif';const w=Math.ceil(ctx.measureText(label).width)+7,h=9.5,b=ePlace(occ,w,h,[[c.x+6,c.y-11],[c.x+6,c.y+3],[c.x-w-6,c.y-11]]);if(!b)continue;ctx.save();ctx.fillStyle='rgba(2,8,11,.58)';eRound(ctx,b.x,b.y,w,h,2);ctx.fill();ctx.strokeStyle=accent;ctx.globalAlpha=.75;ctx.lineWidth=.55;ctx.stroke();ctx.restore();vHaloText(label,b.x+w/2,b.y+h/2,{font:'800 5.1px Arial,Helvetica,sans-serif',fill:'#f5f8f9',halo:'rgba(0,5,8,.72)',haloRadius:.55});shown++;
  }
}

function vExpiry(f){const p=f?.properties||{},d=new Date(p.ends||p.expiration||'');if(!Number.isFinite(d.getTime()))return'';return d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).replace(' AM','a').replace(' PM','p')}
function vAlertPlace(item){if(!item?.c)return'';const labels=view().labels||[];let best=null,dist=Infinity;for(const[name,lat,lon]of labels){const d=haversineMiles(item.c,{lat,lon});if(d<dist){dist=d;best=name}}const cap=view().id==='regional'?240:view().id==='florida'?130:view().id==='metro'?60:30;return dist<=cap?best:''}
function vAlertSummary(){
  const alerts=eWarningsInView();if(!alerts.length)return null;const local=localAlert(),urgent=alerts.find(x=>x.meta.isWarning),localIn=local?alerts.find(x=>x.f===local):null,primary=urgent||localIn||alerts[0],same=alerts.filter(x=>x.meta.code===primary.meta.code).length,place=primary.f===local?'HOME':vAlertPlace(primary),expires=vExpiry(primary.f);return{alerts,primary,meta:primary.meta,count:alerts.length,same,local:primary.f===local,place,expires};
}

function vWarningLabels(occ){
  const def=view(),max=def.id==='home'?2:def.id==='metro'?3:def.id==='florida'?4:3;let labels=0;
  for(const item of eWarningsInView()){if(labels>=max)break;const{c,meta}=item;if(!meta.isWarning||meta.isAdvisory||meta.isWatch)continue;const p=ePoint(c.lat,c.lon);if(!eInMap(p.y,8))continue;const font='900 5.4px Arial,Helvetica,sans-serif';ctx.font=font;const w=Math.ceil(ctx.measureText(meta.code).width)+4,h=8,b=ePlace(occ,w,h,[[p.x+3,p.y-9],[p.x-w-3,p.y-9],[p.x+3,p.y+2]]);if(!b)continue;vHaloText(meta.code,b.x+b.w/2,b.y+b.h/2,{font,fill:meta.color,halo:'rgba(0,5,8,.82)',haloRadius:.75});labels++}
  const ux=vEnsureUx();ux.warningLabels=labels;ux.advisoryLabels=0;
}

function vHomeText(){
  const h=state.home,n=h.nearest,e=h.eta,local=localAlert(),lm=local?alertMeta(local):null,ltg=vNearestLightning(30),extras=[];
  if(local)extras.push(`HOME ${lm.code}`);else if(ltg&&ltg.miles<=25)extras.push(`LTG ${Math.max(1,Math.round(ltg.miles))} MI ${ltg.dir}`);
  if(h.status!=='DRY'){const dbz=Number.isFinite(h.dbz)?`${Math.round(h.dbz)} dBZ`:'';return{main:h.status,sub:[dbz&&`AT HOME ${dbz}`,...extras].filter(Boolean).join('  •  ')}}
  if(n)return{main:'DRY',sub:[`RAIN ${Math.max(1,Math.round(n.miles))} MI ${n.dir}${e?` ETA ${e.minutes}m`:''}`,...extras].filter(Boolean).join('  •  ')};
  return{main:'DRY',sub:['NO RAIN NEAR HOME',...extras].join('  •  ')};
}

function vHazardText(){
  const sum=vAlertSummary();if(sum){const main=`${sum.meta.code}${sum.same>1?` ${sum.same}`:''}`,name=sum.meta.code==='SVR'?'SEVERE T-STORM':sum.meta.code==='TOR'?'TORNADO WARNING':sum.meta.code==='FFW'?'FLASH FLOOD':sum.meta.name.toUpperCase(),where=sum.place?`${sum.place}`:'IN VIEW',when=sum.expires?`${sum.expires}`:'';return{main,sub:[name,where,when].filter(Boolean).join('  •  '),accent:sum.meta.color}}
  const ltg=fieldMax(state.severe.lightning),near=vNearestLightning(30),mesh=fieldMax(state.severe.mesh),tropical=view().id==='regional'&&state.tropics.length;
  if(ltg!=null&&ltg>=30)return{main:`LTG ${Math.round(ltg)}%`,sub:near?`RISK  •  ${Math.max(1,Math.round(near.miles))} MI ${near.dir}`:'LIGHTNING RISK IN VIEW',accent:'#fff27a'};
  if(mesh!=null&&mesh>=25.4)return{main:`HAIL ${(mesh/25.4).toFixed(1)}\"`,sub:'MRMS MESH IN VIEW',accent:'#ff84d7'};
  if(tropical)return{main:'TROPICS',sub:'NHC FEATURES ACTIVE',accent:'#ffd160'};
  return{main:'NONE',sub:'NO ACTIVE THREATS',accent:'#8da4ad'};
}

function vHeader(){
  const w=state.weather||{},latest=state.frames.at(-1)?.time,age=Number.isFinite(ageMs())?Math.max(0,Math.round(ageMs()/60000)):null,pop=Number.isFinite(w.forecast?.pop)?Math.round(w.forecast.pop):null,cl=w.cloudCover!=null?Math.round(w.cloudCover*100):null,fresh=freshness(),sum=vAlertSummary();
  const g=ctx.createLinearGradient(0,0,0,E_MAP_TOP);g.addColorStop(0,'rgba(2,8,12,.97)');g.addColorStop(.76,'rgba(2,9,13,.89)');g.addColorStop(1,'rgba(2,9,13,.70)');ctx.fillStyle=g;ctx.fillRect(0,0,CFG.width,E_MAP_TOP);ctx.fillStyle='#31b8de';ctx.fillRect(0,0,2.5,E_MAP_TOP);
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#f3f8fa';ctx.font='900 9.4px Arial,Helvetica,sans-serif';ctx.fillText('LIVE RADAR',8,8.2);ctx.fillStyle='#78d9f4';ctx.font='800 5.5px Arial,Helvetica,sans-serif';ctx.fillText(view().name,8,20);
  ctx.fillStyle='#9cb1ba';ctx.font='700 4.45px Arial,Helvetica,sans-serif';ctx.fillText(`MRMS ${latest?utcTime(latest):'--:--Z'}`,118,8.2);ctx.fillStyle=fresh==='live'?'#54e895':fresh==='delayed'?'#efca59':'#f16e65';ctx.beginPath();ctx.arc(119.5,19.6,1.45,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cbd7dc';ctx.font='800 4.65px Arial,Helvetica,sans-serif';ctx.fillText(`${fresh.toUpperCase()}${age!=null?`  ${age}m`:''}`,124,19.6);
  if(sum){const alert=`${sum.local?'HOME ':''}${sum.meta.code}${sum.same>1?` ${sum.same}`:''}${sum.place&&!sum.local?`  •  ${sum.place}`:''}${sum.expires?`  •  ${sum.expires}`:''}`;ctx.fillStyle=sum.meta.color;ctx.font='900 4.7px Arial,Helvetica,sans-serif';ctx.textAlign='center';ctx.fillText(eFitText(alert,118,'900 4.7px Arial,Helvetica,sans-serif'),257,19.6)}
  ctx.textAlign='right';ctx.fillStyle='#f7fafb';ctx.font='500 14.4px Arial,Helvetica,sans-serif';ctx.fillText(w.temp!=null?`${w.temp}°`:'--°',377,9.2);ctx.fillStyle='#e4ebee';ctx.font='800 7.5px Arial,Helvetica,sans-serif';ctx.fillText(new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),451,9.2);ctx.fillStyle='#9aaeb7';ctx.font='700 4.55px Arial,Helvetica,sans-serif';const wx=[w.windDir&&w.windMph!=null?`${w.windDir} ${w.windMph} MPH`:null,pop!=null?`NEXT HR ${pop}%`:cl!=null?`CLOUD ${cl}%`:null].filter(Boolean).join('  •  ');ctx.fillText(eFitText(wx||'CURRENT CONDITIONS',154,'700 4.55px Arial,Helvetica,sans-serif'),451,20);
  ctx.strokeStyle='rgba(119,151,164,.24)';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(0,E_MAP_TOP-.5);ctx.lineTo(CFG.width,E_MAP_TOP-.5);ctx.stroke();
}

function vFooter(){
  ctx.fillStyle='rgba(2,8,12,.96)';ctx.fillRect(0,E_FOOT_TOP,CFG.width,CFG.height-E_FOOT_TOP);ctx.strokeStyle='rgba(123,154,166,.27)';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(0,E_FOOT_TOP+.5);ctx.lineTo(CFG.width,E_FOOT_TOP+.5);ctx.stroke();
  const home=vHomeText(),hz=vHazardText();ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle='#748f9b';ctx.font='800 4.35px Arial,Helvetica,sans-serif';ctx.fillText('HOME IMPACT',7,226);ctx.fillStyle=home.main==='DRY'?'#7fdcf7':home.main==='LIGHT'?'#78e59a':home.main==='RAIN'?'#ffe05b':home.main==='HEAVY'?'#ff8b52':'#ff5e74';ctx.font='900 8.1px Arial,Helvetica,sans-serif';ctx.fillText(home.main,7,237);ctx.fillStyle='#c1ced3';ctx.font='700 4.45px Arial,Helvetica,sans-serif';ctx.fillText(eFitText(home.sub,144,'700 4.45px Arial,Helvetica,sans-serif'),7,248.5);
  ctx.strokeStyle='rgba(121,151,163,.18)';ctx.beginPath();ctx.moveTo(155,224);ctx.lineTo(155,253);ctx.moveTo(333,224);ctx.lineTo(333,253);ctx.stroke();
  ctx.fillStyle='#748f9b';ctx.font='800 4.35px Arial,Helvetica,sans-serif';ctx.fillText('RADAR LOOP',164,226);const frames=state.frames,shown=displayedFrame(),x0=222,y=226;ctx.fillStyle='rgba(134,158,168,.32)';ctx.fillRect(x0,y-.6,90,1.2);for(let i=0;i<frames.length;i++){const x=x0+(frames.length===1?45:i/(frames.length-1)*90),sel=shown&&frames[i].key===shown.key;ctx.beginPath();ctx.fillStyle=sel?'#effbff':'#617b86';ctx.arc(x,y,sel?1.85:1.05,0,Math.PI*2);ctx.fill()}ctx.textAlign='right';ctx.fillStyle='#b8c7cd';ctx.font='700 4.25px Arial,Helvetica,sans-serif';ctx.fillText(shown?utcTime(shown.time):'--:--Z',326,226);
  const lx=166,ly=235,lw=116,vals=[8,18,28,38,48,58,68];for(let i=0;i<vals.length;i++){const c=eRadarColor(vals[i]);ctx.fillStyle=`rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;ctx.fillRect(lx+i*lw/vals.length,ly,Math.ceil(lw/vals.length),4)}ctx.textAlign='left';ctx.fillStyle='#a9bac1';ctx.font='700 4.1px Arial,Helvetica,sans-serif';ctx.fillText('LIGHT',166,246.5);ctx.textAlign='center';ctx.fillText('RAIN',224,246.5);ctx.textAlign='right';ctx.fillText('INTENSE',282,246.5);ctx.textAlign='left';ctx.fillText('dBZ',287,237.5);
  ctx.textAlign='left';ctx.fillStyle='#748f9b';ctx.font='800 4.35px Arial,Helvetica,sans-serif';ctx.fillText('HAZARDS',342,226);ctx.fillStyle=hz.accent;ctx.font='900 7.6px Arial,Helvetica,sans-serif';ctx.fillText(hz.main,342,237);ctx.fillStyle='#b1c1c7';ctx.font='700 4.25px Arial,Helvetica,sans-serif';ctx.fillText(eFitText(hz.sub,107,'700 4.25px Arial,Helvetica,sans-serif'),342,248.5);
}

function vAlertSummaryState(){
  const sum=vAlertSummary();state.alertUi={...(state.alertUi||{}),summary:!!sum,count:sum?.count||0,primary:sum?.meta?.code||null,local:!!sum?.local,placement:'header-footer'};const ux=vEnsureUx();ux.alertPanel='header-footer';ux.mapAlertBox=false;
}

function vRender(now=performance.now()){
  const t0=performance.now();if(typeof rdrSetMainTransform==='function')rdrSetMainTransform();ctx.fillStyle='#04131b';ctx.fillRect(0,0,CFG.width,CFG.height);
  const ux=vEnsureUx();ux.lightningSymbols=0;ux.motionArrows=0;ux.cityLabels=0;ux.warningLabels=0;ux.advisoryLabels=0;
  if(state.frames.length){
    const base=eBase();ctx.drawImage(base,0,0,CFG.width,CFG.height);eRadar(now);const lines=eLines();ctx.drawImage(lines,0,0,CFG.width,CFG.height);eDrawTropics();
    const occ=eOcc();vLightningSymbols(occ,now);eDrawWarnings();vStormMotionArrows(occ);eNearestRain();vStormFocus(occ);vWarningLabels(occ);vCityLabels(occ);eVignette();eHomeMarker();eScale();
  }else renderUnavailable();
  vHeader();vFooter();vAlertSummaryState();ePerf(performance.now()-t0);
}

// Keep compatibility with existing QA helpers while removing the on-map alert card.
eCityLabels=vCityLabels;
eStormFocus=vStormFocus;
eWarningLabels=vWarningLabels;
eHeader=vHeader;
eFooter=vFooter;
eHazardText=vHazardText;
eAlertSummarySpec=vAlertSummary;
eAlertSummaryBox=function(){vAlertSummaryState()};
render=vRender;
vEnsureUx();
panel.dataset.ui=V_UX_BUILD;
