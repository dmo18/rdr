'use strict';

/*
 * Human-readable alert copy policy.
 * Counts must always say exactly what they count. Never use a bare +N suffix.
 */
const ALERT_COPY_BUILD='alert-copy-2026.08.12.1';

function rdrAlertNoun(meta,count=1){
  if(meta?.isWarning)return count===1?'WARNING':'WARNINGS';
  if(meta?.isWatch)return count===1?'WATCH':'WATCHES';
  if(meta?.isAdvisory)return count===1?'ADVISORY':'ADVISORIES';
  return count===1?'ALERT':'ALERTS';
}
function rdrTypedAlertLabel(meta,count=1){
  const n=Math.max(1,Math.round(Number(count)||1)),code=meta?.code||'WX',noun=rdrAlertNoun(meta,n);
  return n===1?`${code} ${noun}`:`${n} ${code} ${noun}`;
}
function rdrAlertDisplayName(meta){
  if(!meta)return'WEATHER ALERT';
  if(meta.code==='SVR')return'SEVERE T-STORM WARNING';
  if(meta.code==='TOR')return'TORNADO WARNING';
  if(meta.code==='FFW')return'FLASH FLOOD WARNING';
  if(meta.code==='HUR')return'HURRICANE WARNING';
  if(meta.code==='TRP')return'TROPICAL STORM WARNING';
  return String(meta.name||'WEATHER ALERT').toUpperCase();
}
function rdrCopyState(){
  if(!state.ux)state.ux={};
  state.ux.alertCopyBuild=ALERT_COPY_BUILD;
  state.ux.alertCounterPolicy='typed-counts-only';
  state.ux.ambiguousPlusCounter=false;
  return state.ux;
}

if(typeof vAlertSummary==='function'){
  const baseVAlertSummary=vAlertSummary;
  vAlertSummary=function(){
    const sum=baseVAlertSummary();if(!sum)return null;
    const same=Math.max(1,Number(sum.same)||1),count=Math.max(same,Number(sum.count)||same);
    return{...sum,same,count,typedLabel:rdrTypedAlertLabel(sum.meta,same),otherCount:Math.max(0,count-same)};
  };
}

if(typeof vHazardText==='function'){
  const baseVHazardText=vHazardText;
  vHazardText=function(){
    const sum=typeof vAlertSummary==='function'?vAlertSummary():null;
    if(sum){
      const main=sum.typedLabel||rdrTypedAlertLabel(sum.meta,sum.same),name=rdrAlertDisplayName(sum.meta),sub=[sum.same===1?name:null,sum.place||'IN VIEW',sum.expires?`UNTIL ${sum.expires}`:null].filter(Boolean).join('  •  '),ux=rdrCopyState();
      ux.alertHazardMain=main;ux.alertHazardSub=sub;
      return{main,sub,accent:sum.meta.color};
    }
    const out=baseVHazardText();const ux=rdrCopyState();ux.alertHazardMain=out.main;ux.alertHazardSub=out.sub;return out;
  };
}

if(typeof vHeader==='function'){
  vHeader=function(){
    const w=state.weather||{},latest=state.frames.at(-1)?.time,age=Number.isFinite(ageMs())?Math.max(0,Math.round(ageMs()/60000)):null,pop=Number.isFinite(w.forecast?.pop)?Math.round(w.forecast.pop):null,cl=w.cloudCover!=null?Math.round(w.cloudCover*100):null,fresh=freshness(),sum=typeof vAlertSummary==='function'?vAlertSummary():null,ux=rdrCopyState();
    const g=ctx.createLinearGradient(0,0,0,E_MAP_TOP);g.addColorStop(0,'rgba(2,8,12,.97)');g.addColorStop(.76,'rgba(2,9,13,.89)');g.addColorStop(1,'rgba(2,9,13,.70)');ctx.fillStyle=g;ctx.fillRect(0,0,CFG.width,E_MAP_TOP);ctx.fillStyle='#31b8de';ctx.fillRect(0,0,2.5,E_MAP_TOP);
    ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillStyle='#f3f8fa';ctx.font='900 9.4px Arial,Helvetica,sans-serif';ctx.fillText('LIVE RADAR',8,8.2);ctx.fillStyle='#78d9f4';ctx.font='800 5.5px Arial,Helvetica,sans-serif';ctx.fillText(view().name,8,20);
    ctx.fillStyle='#9cb1ba';ctx.font='700 4.45px Arial,Helvetica,sans-serif';ctx.fillText(`MRMS ${latest?utcTime(latest):'--:--Z'}`,118,8.2);ctx.fillStyle=fresh==='live'?'#54e895':fresh==='delayed'?'#efca59':'#f16e65';ctx.beginPath();ctx.arc(119.5,19.6,1.45,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cbd7dc';ctx.font='800 4.65px Arial,Helvetica,sans-serif';ctx.fillText(`${fresh.toUpperCase()}${age!=null?`  ${age}m`:''}`,124,19.6);
    ux.alertHeaderText='';
    if(sum){const label=sum.typedLabel||rdrTypedAlertLabel(sum.meta,sum.same),alert=[sum.local?`HOME ${label}`:label,sum.place&&!sum.local?sum.place:null,sum.expires?`UNTIL ${sum.expires}`:null].filter(Boolean).join('  •  ');ux.alertHeaderText=alert;ctx.fillStyle=sum.meta.color;ctx.font='900 4.7px Arial,Helvetica,sans-serif';ctx.textAlign='center';ctx.fillText(eFitText(alert,118,'900 4.7px Arial,Helvetica,sans-serif'),257,19.6)}
    ctx.textAlign='right';ctx.fillStyle='#f7fafb';ctx.font='500 14.4px Arial,Helvetica,sans-serif';ctx.fillText(w.temp!=null?`${w.temp}°`:'--°',377,9.2);ctx.fillStyle='#e4ebee';ctx.font='800 7.5px Arial,Helvetica,sans-serif';ctx.fillText(new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}),451,9.2);ctx.fillStyle='#9aaeb7';ctx.font='700 4.55px Arial,Helvetica,sans-serif';const wx=[w.windDir&&w.windMph!=null?`${w.windDir} ${w.windMph} MPH`:null,pop!=null?`NEXT HR ${pop}%`:cl!=null?`CLOUD ${cl}%`:null].filter(Boolean).join('  •  ');ctx.fillText(eFitText(wx||'CURRENT CONDITIONS',154,'700 4.55px Arial,Helvetica,sans-serif'),451,20);
    ctx.strokeStyle='rgba(119,151,164,.24)';ctx.lineWidth=.55;ctx.beginPath();ctx.moveTo(0,E_MAP_TOP-.5);ctx.lineTo(CFG.width,E_MAP_TOP-.5);ctx.stroke();
  };
  eHeader=vHeader;
}

if(typeof vAlertSummaryState==='function'){
  const baseVAlertSummaryState=vAlertSummaryState;
  vAlertSummaryState=function(){
    baseVAlertSummaryState();const sum=typeof vAlertSummary==='function'?vAlertSummary():null,ux=rdrCopyState();
    state.alertUi={...(state.alertUi||{}),copyBuild:ALERT_COPY_BUILD,copyLabel:sum?(sum.typedLabel||rdrTypedAlertLabel(sum.meta,sum.same)):null,otherAlerts:sum?.otherCount||0,ambiguousPlusCounter:false};
    ux.alertCopyLabel=state.alertUi.copyLabel;
  };
}

/* Legacy alert card fallback, used only if the vNext composition is unavailable. */
if(typeof eAlertSummaryBox==='function'){
  eAlertSummaryBox=function(spec=typeof eAlertSummarySpec==='function'?eAlertSummarySpec():null){
    if(!spec||!Number.isFinite(spec.x)){state.alertUi={...(state.alertUi||{}),summary:!!spec,count:spec?.count||spec?.alerts?.length||0,ambiguousPlusCounter:false};return}
    const{x,y,w,h,alerts,meta,local}=spec,same=Math.max(1,(alerts||[]).filter(a=>(a.meta||alertMeta(a.f||a))?.code===meta.code).length),title=local?`HOME ${rdrTypedAlertLabel(meta,1)}`:rdrTypedAlertLabel(meta,same),sub=String(meta.name||'WEATHER ALERT').toUpperCase();
    ctx.save();ctx.fillStyle='rgba(2,8,12,.96)';eRound(ctx,x,y,w,h,2);ctx.fill();ctx.strokeStyle=meta.color;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=meta.color;ctx.fillRect(x,y,3,h);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillStyle=meta.color;ctx.font='900 5.7px Arial,Helvetica,sans-serif';ctx.fillText(eFitText(title,w-15,'900 5.7px Arial,Helvetica,sans-serif'),x+8,y+8);ctx.fillStyle='#eef5f7';ctx.font='800 5px Arial,Helvetica,sans-serif';ctx.fillText(eFitText(sub,w-15,'800 5px Arial,Helvetica,sans-serif'),x+8,y+18.5);ctx.restore();
    state.alertUi={...(state.alertUi||{}),summary:true,count:(alerts||[]).length,primary:meta.code,local,copyBuild:ALERT_COPY_BUILD,copyTitle:title,copySub:sub,ambiguousPlusCounter:false};
  };
}

rdrCopyState();
panel.dataset.copy=ALERT_COPY_BUILD;
