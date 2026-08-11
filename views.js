function renderCurrent(){
  const c=state.weather?.current; if(!c) return;
  const [cond,icon]=codeInfo(c.weather_code);
  $('currentTemp').textContent=round(c.temperature_2m); $('currentIcon').textContent=icon; $('currentCondition').textContent=cond;
  $('feelsLike').textContent=`${round(c.apparent_temperature)}°`; $('windNow').textContent=`${windDir(c.wind_direction_10m)} ${round(c.wind_speed_10m)} MPH`; $('humidityNow').textContent=`${round(c.relative_humidity_2m)}%`; $('cloudNow').textContent=`${round(c.cloud_cover)}%`;
  $('currentIntel').textContent=buildIntelligence();
}

function renderRain(){
  const arrival=rainArrival();
  if(state.weather?.current && (n(state.weather.current.rain,0)>0 || isRainCode(state.weather.current.weather_code))){$('rainHeadline').textContent='RAIN NOW';$('rainDetail').textContent='Precipitation is being observed or indicated in the current weather feed.';}
  else if(arrival){$('rainHeadline').textContent=arrival.mins<60?`~${Math.ceil(arrival.mins/5)*5} MIN`:fmtTime.format(arrival.at);$('rainDetail').textContent='Estimated from 15-minute forecast guidance. Timing is approximate.';}
  else{$('rainHeadline').textContent='NO RAIN SOON';$('rainDetail').textContent='No meaningful precipitation signal in the next few hours.';}
  const m=state.weather?.minutely_15; const host=$('rainTimeline'); host.innerHTML='';
  for(let k=0;k<5;k++){
    const idx=k*2; const amount=n(m?.rain?.[idx],n(m?.precipitation?.[idx],0)); const code=m?.weather_code?.[idx]; const at=m?.time?.[idx]?toDate(m.time[idx]):new Date(Date.now()+k*30*60000);
    const intensity=amount>=.2?'HEAVY':amount>=.07?'MOD':amount>.002||isRainCode(code)?'LIGHT':'NONE';
    host.insertAdjacentHTML('beforeend',`<article class="timeline-cell ${k===0?'current':''}"><span>${k===0?'NOW':fmtTime.format(at)}</span><strong>${intensity}</strong><div class="mini-bar"><i style="width:${Math.min(100,amount*350)}%"></i></div></article>`);
  }
}

function renderForecast(){
  const h=state.weather?.hourly; if(!h) return; const start=getHourStartIndex(); const host=$('hourGrid');host.innerHTML='';
  const temps=[],pops=[],winds=[]; let stormAt=null;
  for(let k=0;k<6;k++){
    const i=start+k, temp=round(h.temperature_2m?.[i]), pop=round(h.precipitation_probability?.[i]), code=h.weather_code?.[i], gust=round(h.wind_gusts_10m?.[i]);
    temps.push(temp);pops.push(pop);winds.push(gust);if(stormAt===null&&isStormCode(code))stormAt=i;
    host.insertAdjacentHTML('beforeend',`<article class="hour-card ${k===0?'now':''}"><span class="time">${k===0?'NOW':fmtHour.format(toDate(h.time[i]))}</span><span class="icon">${codeInfo(code)[1]}</span><strong>${temp}°</strong><span class="pop">${pop}%</span></article>`);
  }
  $('rainPeak').textContent=`${Math.max(...pops)}%`;$('windPeak').textContent=`${Math.max(...winds)} MPH`;$('tempRange').textContent=`${Math.min(...temps)}–${Math.max(...temps)}°`;
  $('forecastCallout').textContent=stormAt!==null?`STORMS ${fmtHour.format(toDate(h.time[stormAt]))}`:Math.max(...pops)>=70?'RAIN LIKELY':'GENERAL OUTLOOK';
}

function renderClouds(){
  const h=state.weather?.hourly;if(!h)return;const start=getHourStartIndex();const vals=[];const host=$('cloudTimeline');host.innerHTML='';
  for(let k=0;k<6;k++){const i=start+k,v=round(h.cloud_cover?.[i]);vals.push(v);host.insertAdjacentHTML('beforeend',`<article class="timeline-cell ${k===0?'current':''}"><span>${k===0?'NOW':fmtHour.format(toDate(h.time[i]))}</span><strong>${v}%</strong><div class="mini-bar"><i style="width:${v}%"></i></div></article>`)}
  const diff=vals[vals.length-1]-vals[0]; const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  $('cloudHeadline').textContent=diff>18?'CLOUDS MOVING IN':diff<-18?'CLEARING TREND':avg>82?'OVERCAST HOLDS':avg<28?'MOSTLY CLEAR':'VARIABLE CLOUDS';
  $('cloudDetail').textContent=`Cloud cover ${vals[0]}% now, ${vals[vals.length-1]}% by ${fmtHour.format(toDate(h.time[start+5]))}.`;
  document.querySelector('.cloud-a').style.transform=`translateX(${Math.max(-20,Math.min(70,diff))}px)`;
}

function renderStorm(){
  const h=state.weather?.hourly;if(!h)return;const start=getHourStartIndex();let risk=0, storm=false;const gusts=[],pops=[];
  for(let i=start;i<Math.min(start+8,h.time.length);i++){const code=h.weather_code?.[i],pop=n(h.precipitation_probability?.[i],0),gust=n(h.wind_gusts_10m?.[i],0);gusts.push(gust);pops.push(pop);if(isStormCode(code)){storm=true;risk=Math.max(risk,70)}risk=Math.max(risk,Math.min(65,pop*.55+Math.max(0,gust-20)*1.4));}
  const alert=topAlert(); if(alert&&/thunderstorm|tornado/i.test(alert.event||''))risk=Math.max(risk,95);
  risk=Math.round(Math.min(100,risk)); const word=risk>=80?'HIGH':risk>=55?'ELEVATED':risk>=30?'WATCH':'LOW';
  $('stormRisk').textContent=word;$('riskFill').style.height=`${Math.max(8,risk)}%`;$('gustPeak').textContent=round(Math.max(0,...gusts));$('stormRain').textContent=round(Math.max(0,...pops));
  $('stormMessage').textContent=alert&&/thunderstorm|tornado/i.test(alert.event||'')?'Official warning activity is affecting the local risk picture.':storm?'Thunderstorm weather codes appear in the near-term forecast.':'No thunderstorm code appears in the near-term forecast.';
  $('lightningState').textContent='N/A';
}

function renderAlerts(){
  const a=topAlert();
  if(!a){$('alertType').textContent='OFFICIAL ALERTS';$('alertHeadline').textContent='NO ACTIVE WARNING';$('alertSummary').textContent='No active National Weather Service alert was returned for the configured point.';$('alertArea').textContent='BROWARD COUNTY';$('alertUntil').textContent='NORMAL ROTATION';return;}
  $('alertType').textContent=(a.severity||'OFFICIAL ALERT').toUpperCase();$('alertHeadline').textContent=(a.event||a.headline||'WEATHER ALERT').toUpperCase();
  $('alertSummary').textContent=String(a.description||a.headline||'Official weather alert is active.').replace(/\s+/g,' ').slice(0,240);
  $('alertArea').textContent=String(a.areaDesc||'LOCAL AREA').toUpperCase().slice(0,58);$('alertUntil').textContent=a.expires?`UNTIL ${fmtShort.format(toDate(a.expires)).toUpperCase()}`:'ACTIVE';
}

function renderTropical(){
  const a=tropicalAlert();
  if(a){$('tropicalHeadline').textContent=(a.event||'TROPICAL ALERT').toUpperCase();$('tropicalSummary').textContent=String(a.headline||a.description||'Official tropical alert affects the configured location.').replace(/\s+/g,' ').slice(0,240);}
  else{$('tropicalHeadline').textContent='NO LOCAL TROPICAL ALERT';$('tropicalSummary').textContent='Tropical view is removed from automatic rotation unless an official local tropical watch or warning is active.';}
}

function renderSeverity(){
  const a=topAlert();const chip=$('severityChip');chip.className='chip good';chip.textContent='NORMAL';
  if(a){const e=(a.event||'').toLowerCase();chip.className=`chip ${/tornado|hurricane|warning/.test(e)?'warn':'watch'}`;chip.textContent=/tornado|hurricane/.test(e)?'CRITICAL':'ALERT';}
  else if(isStormCode(state.weather?.current?.weather_code)){chip.className='chip watch';chip.textContent='STORMS';}
}

function sourceState(){
  const vals=Object.values(state.health);if(vals.every(v=>v==='demo'))return['SIMULATION',''];if(vals.some(v=>v==='down'))return['DEGRADED · OM/NWS/RV','degraded'];if(vals.some(v=>v==='stale'))return['CACHED · OM/NWS/RV','degraded'];return['LIVE · OM/NWS/RV',''];
}
function renderStatus(){
  const [label,cls]=sourceState();const el=$('sourceHealth');el.className=`source-health ${cls}`;el.querySelector('span').textContent=label;
  const age=state.updatedAt?Math.max(0,Math.floor((Date.now()-state.updatedAt)/60000)):null;$('freshness').textContent=age===null?'DATA --':age<1?'DATA <1 MIN':`DATA ${age} MIN`;
}
