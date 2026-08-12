'use strict';

const E_ALERT_COLORS={
  TOR:'#ff4b4b',SVR:'#ffe044',FFW:'#46d46b',FLD:'#45c978',SMW:'#f0a000',SQW:'#c71585',
  HUR:'#ff4fa3',TRP:'#ff7b62',SUR:'#ff6b6b',WRN:'#ff8a4c',WCH:'#aa91ff',ADV:'#62c9ff',ALERT:'#9eb1ba'
};

function alertSig(f){return String(f?.properties?.sig||'').trim().toUpperCase()}
function alertName(f){const p=f?.properties||{};return String(p.prod_type||p.event||'Weather Alert').trim()||'Weather Alert'}
function alertExpired(f){const p=f?.properties||{};for(const k of ['ends','expiration']){const t=Date.parse(p[k]||'');if(Number.isFinite(t)&&t<Date.now()-60000)return true}return false}
function alertMeta(f){
  const p=f?.properties||{},sig=alertSig(f),ph=String(p.phenom||'').toUpperCase(),name=alertName(f),u=name.toUpperCase();let code='ALERT',priority=10;
  if(ph==='TO'||u.includes('TORNADO')){code='TOR';priority=100}
  else if(ph==='SV'||u.includes('SEVERE THUNDERSTORM')){code='SVR';priority=92}
  else if(ph==='FF'||u.includes('FLASH FLOOD')){code='FFW';priority=90}
  else if(ph==='HU'||u.includes('HURRICANE')){code='HUR';priority=88}
  else if(u.includes('STORM SURGE')){code='SUR';priority=87}
  else if(ph==='TR'||u.includes('TROPICAL STORM')){code='TRP';priority=84}
  else if(ph==='MA'||u.includes('SPECIAL MARINE')){code='SMW';priority=82}
  else if(ph==='SQ'||u.includes('SNOW SQUALL')){code='SQW';priority=80}
  else if(ph==='FL'||u.includes('FLOOD WARNING')){code='FLD';priority=76}
  else if(sig==='W'||u.includes(' WARNING')){code='WRN';priority=70}
  else if(sig==='A'||u.includes(' WATCH')){code='WCH';priority=50}
  else if(sig==='Y'||u.includes(' ADVISORY')){code='ADV';priority=30}
  else if(u.includes(' ALERT')){code='ALERT';priority=20}
  const color=E_ALERT_COLORS[code]||E_ALERT_COLORS.ALERT,isWarning=sig==='W'||priority>=70,isWatch=sig==='A'||code==='WCH',isAdvisory=sig==='Y'||code==='ADV';
  return{code,name,sig,priority,color,isWarning,isWatch,isAdvisory,width:isWarning?(priority>=88?2.2:1.55):isWatch?1.15:.8,dash:isWarning?[]:isWatch?[4,2]:[2,2],fill:isWarning?(priority>=88?'.050':'.032'):isWatch?'.016':'.008'};
}
function alertDisplayable(f){if(!f?.geometry||alertExpired(f))return false;const m=alertMeta(f),u=m.name.toUpperCase();return['W','A','Y'].includes(m.sig)||/WARNING|WATCH|ADVISORY|ALERT/.test(u)}
function alertVisibleInView(f,def=view()){if(!alertDisplayable(f))return false;const m=alertMeta(f);if(m.isAdvisory&&['florida','regional'].includes(def.id)&&!containsPoint(f.geometry,CFG.home))return false;return true}
function warningCode(f){return alertMeta(f).code}
function alertPriority(f){return alertMeta(f).priority}
function localAlert(){const a=[];for(const f of state.warnings.values())if(alertDisplayable(f)&&containsPoint(f.geometry,CFG.home))a.push(f);a.sort((x,y)=>alertPriority(y)-alertPriority(x));return a[0]||null}

async function alertArcQuery(layer,bbox){
  const[w,s,e,n]=bbox,p=new URLSearchParams({where:"sig IN ('W','A','Y')",geometry:`${w},${s},${e},${n}`,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'objectid,prod_type,msg_type,phenom,url,expiration,onset,ends,issuance,sig,wfo,event,cap_id',returnGeometry:'true',f:'geojson'}),j=await fetchJson(`${CFG.warnings}/${layer}/query?${p}`);return j?.features||[]
}
function alertFeatureKey(f,i=0){const p=f?.properties||{},b=eGeomBounds(f.geometry),g=b?`${b.w.toFixed(3)},${b.s.toFixed(3)},${b.e.toFixed(3)},${b.n.toFixed(3)}`:String(i);return`${p.cap_id||p.event||p.objectid||i}|${p.phenom||''}|${p.sig||''}|${g}`}
async function loadWarnings(){
  const settled=await Promise.allSettled([alertArcQuery(0,CFG.views[3].bbox),alertArcQuery(1,CFG.views[3].bbox)]),success=settled.some(x=>x.status==='fulfilled');
  if(!success){state.errors.push(`alerts: ${settled.map(x=>x.reason||'unavailable').join(' | ')}`);panel.dataset.alerts='unavailable';render();return}
  const urgent=settled[0].status==='fulfilled'?settled[0].value:[],broad=settled[1].status==='fulfilled'?settled[1].value:[],merged=new Map();let i=0;
  for(const f of broad.concat(urgent)){if(!alertDisplayable(f))continue;merged.set(alertFeatureKey(f,i++),f)}
  state.warnings.clear();for(const[k,f]of merged)state.warnings.set(k,f);panel.dataset.alerts=String(state.warnings.size);render();
}

function eWarningsInView(){
  const out=[];for(const f of state.warnings.values()){if(!alertVisibleInView(f,view()))continue;const box=eGeomBounds(f.geometry);if(!eBoxIntersects(box,view().bbox))continue;const c=geometryCenter(f.geometry)||{lon:(box.w+box.e)/2,lat:(box.s+box.n)/2},meta=alertMeta(f);out.push({f,c,code:meta.code,meta})}
  return out.sort((a,b)=>b.meta.priority-a.meta.priority||a.meta.name.localeCompare(b.meta.name));
}
function eHazardColor(code){return E_ALERT_COLORS[code]||E_ALERT_COLORS.ALERT}
function eDrawWarnings(){
  let drawn=0;const local=localAlert();for(const{f,meta}of eWarningsInView()){const fill=`rgba(${meta.code==='TOR'?'255,75,75':meta.code==='SVR'?'255,224,68':meta.code==='FFW'||meta.code==='FLD'?'70,212,107':meta.code==='HUR'?'255,79,163':meta.code==='TRP'?'255,123,98':meta.code==='SMW'?'240,160,0':meta.code==='WCH'?'170,145,255':meta.code==='ADV'?'98,201,255':'255,138,76'},${meta.fill})`;eGeometry(ctx,view(),f.geometry,meta.color,fill,meta.width,meta.dash);if(local===f)eGeometry(ctx,view(),f.geometry,'rgba(255,255,255,.55)',null,meta.width+1.1,[]);drawn++}
  state.alertUi={...(state.alertUi||{}),boundaries:drawn};
}
function eWarningLabels(occ){
  let labels=0,shown=0,local=localAlert();for(const{f,c,meta}of eWarningsInView()){if(shown>=6)break;if(meta.isAdvisory&&local!==f)continue;const p=ePoint(c.lat,c.lon);if(!eInMap(p.y,5))continue;ctx.font='900 5.8px Arial,Helvetica,sans-serif';const w=Math.max(28,Math.ceil(ctx.measureText(meta.code).width)+10),h=12,b=ePlace(occ,w,h,[[p.x+4,p.y-12],[p.x-w-4,p.y-12],[p.x+4,p.y+3],[p.x-w-4,p.y+3]]);if(!b)continue;ctx.fillStyle='rgba(4,9,12,.92)';eRound(ctx,b.x,b.y,w,h,2);ctx.fill();ctx.strokeStyle=meta.color;ctx.lineWidth=.9;ctx.stroke();ctx.fillStyle=meta.color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(meta.code,b.x+w/2,b.y+h/2+.1);labels++;shown++}
  state.alertUi={...(state.alertUi||{}),labels};
}
function eAlertSummarySpec(){
  const alerts=eWarningsInView();if(!alerts.length)return null;const local=localAlert(),urgent=alerts.find(x=>x.meta.priority>=70),localInView=local?alerts.find(x=>x.f===local):null,primary=urgent||localInView||alerts[0],meta=primary.meta;return{x:306,y:E_MAP_TOP+5,w:144,h:27,alerts,primary,meta,local:primary.f===local};
}
function eAlertSummaryBox(spec=eAlertSummarySpec()){
  if(!spec){state.alertUi={...(state.alertUi||{}),summary:false,count:0};return}const{x,y,w,h,alerts,meta,local}=spec,more=Math.max(0,alerts.length-1),title=local?`${meta.code}  HOME ALERT`:`${meta.code}  ACTIVE ALERT`,sub=`${meta.name.toUpperCase()}${more?`  +${more}`:''}`;
  ctx.save();ctx.fillStyle='rgba(2,8,12,.96)';eRound(ctx,x,y,w,h,2);ctx.fill();ctx.strokeStyle=meta.color;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=meta.color;ctx.fillRect(x,y,3,h);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=meta.color;ctx.font='900 5.7px Arial,Helvetica,sans-serif';ctx.fillText(title,x+8,y+8);ctx.fillStyle='#eef5f7';ctx.font='800 5px Arial,Helvetica,sans-serif';ctx.fillText(eFitText(sub,w-15,'800 5px Arial,Helvetica,sans-serif'),x+8,y+18.5);ctx.restore();
  state.alertUi={...(state.alertUi||{}),summary:true,count:alerts.length,primary:meta.code,local};
}
function eHazardText(){
  const alerts=eWarningsInView(),local=localAlert(),ltg=eFieldMax(state.severe.lightning),mesh=eFieldMax(state.severe.mesh),tropical=view().id==='regional'&&state.tropics.length;if(alerts.length){const top=alerts[0],same=alerts.filter(x=>x.meta.code===top.meta.code).length;return{main:`${top.meta.code}${same>1?` ${same}`:''}`,sub:`${local&&top.f===local?'HOME · ':''}${top.meta.name.toUpperCase()}`,accent:top.meta.color}}
  let main='NONE',sub='NO ACTIVE THREATS',accent='#8da4ad';if(ltg!=null&&ltg>=60){main=`LTG ${Math.round(ltg)}%`;sub=mesh!=null&&mesh>=25.4?`HAIL ${(mesh/25.4).toFixed(1)}\"`:'IN VIEW, NEXT 30 MIN';accent='#72dcf6'}else if(mesh!=null&&mesh>=25.4){main=`HAIL ${(mesh/25.4).toFixed(1)}\"`;sub='MRMS MESH IN VIEW';accent='#ff84d7'}else if(tropical){main='TROPICS';sub='NHC FEATURES ACTIVE';accent='#ffd160'}return{main,sub,accent}
}

function eHeader(){
  const w=state.weather||{},latest=state.frames.at(-1)?.time,age=Number.isFinite(ageMs())?Math.max(0,Math.round(ageMs()/60000)):null,cl=w.cloudCover!=null?Math.round(w.cloudCover*100):null,pop=Number.isFinite(w.forecast?.pop)?Math.round(w.forecast.pop):null,local=localAlert(),lm=local?alertMeta(local):null,fresh=freshness();
  const g=ctx.createLinearGradient(0,0,0,E_MAP_TOP);g.addColorStop(0,'rgba(3,9,13,.98)');g.addColorStop(.78,'rgba(3,10,14,.92)');g.addColorStop(1,'rgba(3,10,14,.72)');ctx.fillStyle=g;ctx.fillRect(0,0,CFG.width,E_MAP_TOP);ctx.fillStyle='#31b8de';ctx.fillRect(0,0,3,E_MAP_TOP);
  ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#f1f6f8';ctx.font='900 9.2px Arial,Helvetica,sans-serif';ctx.fillText('RDR',9,8.2);ctx.fillStyle='#7ed9f4';ctx.font='800 5.8px Arial,Helvetica,sans-serif';ctx.fillText(view().name,9,19.6);
  ctx.fillStyle='#9fb2bb';ctx.font='700 4.6px Arial,Helvetica,sans-serif';ctx.fillText('MRMS REFLECTIVITY',65,8.3);ctx.fillStyle=fresh==='live'?'#53e895':fresh==='delayed'?'#f0c756':'#f06a62';ctx.beginPath();ctx.arc(67,19.4,1.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c8d5da';ctx.font='800 4.8px Arial,Helvetica,sans-serif';ctx.fillText(`${fresh.toUpperCase()}${latest?`  ${utcTime(latest)}${age!=null?`  ${age}m`:''}`:''}`,72,19.4);
  if(local){ctx.fillStyle=lm.color;ctx.font='900 5.2px Arial,Helvetica,sans-serif';ctx.textAlign='center';ctx.fillText(`${lm.code} ALERT AT HOME`,252,19.4)}
  ctx.textAlign='right';ctx.fillStyle='#f5f8f9';ctx.font='500 14.5px Arial,Helvetica,sans-serif';ctx.fillText(w.temp!=null?`${w.temp}°`:'--°',374,9.3);ctx.fillStyle='#dfe7ea';ctx.font='800 7.6px Arial,Helvetica,sans-serif';ctx.fillText(new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),451,9.2);ctx.fillStyle='#98adb6';ctx.font='700 4.7px Arial,Helvetica,sans-serif';const wx=[w.windDir&&w.windMph!=null?`${w.windDir} ${w.windMph} MPH`:null,w.rh!=null?`RH ${w.rh}%`:null,pop!=null?`NEXT HR ${pop}%`:cl!=null?`CLOUD ${cl}%`:null].filter(Boolean).join('  •  ');ctx.fillText(eFitText(wx||'CURRENT CONDITIONS',174,'700 4.7px Arial,Helvetica,sans-serif'),451,20);
  ctx.strokeStyle='rgba(119,151,164,.28)';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,E_MAP_TOP-.5);ctx.lineTo(CFG.width,E_MAP_TOP-.5);ctx.stroke();
}

render=function(now=performance.now()){
  const t0=performance.now();ctx.fillStyle='#04131b';ctx.fillRect(0,0,CFG.width,CFG.height);
  let alertBox=null;if(state.frames.length){ctx.drawImage(eBase(),0,0);eRadar(now);ctx.drawImage(eLines(),0,0);eDrawTropics();eDrawWarnings();eNearestRain();const occ=eOcc();alertBox=eAlertSummarySpec();if(alertBox)occ.push({x:alertBox.x,y:alertBox.y,w:alertBox.w,h:alertBox.h});eSevereSymbols(occ);eStormFocus(occ);eWarningLabels(occ);eCityLabels(occ);eHomeMarker();eScale();eVignette()}else renderUnavailable();
  eHeader();eFooter();if(alertBox)eAlertSummaryBox(alertBox);else eAlertSummaryBox(null);ePerf(performance.now()-t0);
};
