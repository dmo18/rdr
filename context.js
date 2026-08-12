'use strict';

function arcUrl(base,layer,bbox,outFields='*'){const[w,s,e,n]=bbox,p=new URLSearchParams({where:'1=1',geometry:`${w},${s},${e},${n}`,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields,returnGeometry:'true',f:'geojson'});return`${base}/${layer}/query?${p}`}
async function arcQuery(base,layer,bbox,outFields='*'){const j=await fetchJson(arcUrl(base,layer,bbox,outFields));return j?.features||[]}
async function loadBoundaries(def=view()){
  if(state.boundaries.has(def.id))return state.boundaries.get(def.id);const jobs=[arcQuery(CFG.reference,3,def.bbox)];if(def.id!=='regional')jobs.push(arcQuery(CFG.reference,2,def.bbox));else jobs.push(Promise.resolve([]));const[states,counties]=await Promise.all(jobs),value={states,counties};state.boundaries.set(def.id,value);render();return value;
}
function surfaceLayers(def){if(def.id==='home')return[160,150,140];if(def.id==='metro')return[150,160,140,130];if(def.id==='florida')return[130,140,120,150,160];return[120,110,130,140,150]}
function featureTime(f){const t=f?.properties?.timeobs;if(t==null)return null;const d=new Date(t);return Number.isFinite(d.getTime())?d:null}
async function loadSurfaceObs(def=view()){
  const fields='stationname,timeobs,cloudcover,cloudbase,winddir,windspeed,windgust,temperature,dewpoint,visibility,sealevelpress';let features=null,lastError=null,usedLayer=null;
  for(const layer of surfaceLayers(def)){for(let attempt=0;attempt<2;attempt++){try{const got=await arcQuery(CFG.surfaceObs,layer,def.bbox,fields);if(got.length){features=got;usedLayer=layer;break}}catch(e){lastError=e;if(attempt===0)await new Promise(r=>setTimeout(r,180))}}if(features?.length)break}
  if(!features){state.errors.push(`surface: ${lastError||'no current observations'}`);panel.dataset.surface='unavailable';render();return}
  const cut=Date.now()-2*60*60*1000,current=features.filter(f=>{const d=featureTime(f);return !d||d.getTime()>=cut});state.surface.set(def.id,current.length?current:features);panel.dataset.surface=(current.length||features.length)?'live':'empty';panel.dataset.surfaceLayer=String(usedLayer);render();return state.surface.get(def.id);
}
async function loadWarnings(){try{const features=await arcQuery(CFG.warnings,0,CFG.views[3].bbox);state.warnings.clear();for(const f of features)state.warnings.set(String(f.id??f.properties?.OBJECTID??Math.random()),f)}catch(e){state.errors.push(`warnings: ${e}`)}render()}
async function loadTropics(){
  const layers=[2,3,5,6,7,8,10,11,15,16],groups=await Promise.all(layers.map(async layer=>{try{const features=await arcQuery(CFG.tropics,layer,CFG.views[3].bbox);for(const f of features)f._layer=layer;return features}catch(e){state.errors.push(`tropics ${layer}: ${e}`);return[]}}));state.tropics=groups.flat();render();return state.tropics;
}
function cToF(c){return Number.isFinite(c)?Math.round(c*9/5+32):null}
function cloudCodeValue(code){const s=String(code||'').toUpperCase();if(['CLR','SKC'].includes(s))return 0;if(s==='FEW')return .18;if(s==='SCT')return .42;if(s==='BKN')return .72;if(['OVC','VV'].includes(s))return 1;const n=parseFloat(s);return Number.isFinite(n)?clamp(n/8,0,1):null}
function qvSpeedMph(qv){
  const v=Number(qv?.value);if(!Number.isFinite(v))return null;const u=String(qv?.unitCode||'').toLowerCase();
  if(u.includes('km_h-1')||u.includes('km/h'))return Math.round(v*.621371);
  if(u.includes('m_s-1')||u.includes('m/s'))return Math.round(v*2.23694);
  if(u.includes('kt')||u.includes('knot'))return Math.round(v*1.15078);
  if(u.includes('mi_h-1')||u.includes('mph'))return Math.round(v);
  return null;
}
async function loadWeather(){
  try{
    const headers={Accept:'application/geo+json'},p=await fetchJson(`${CFG.nws}/points/${CFG.home.lat.toFixed(4)},${CFG.home.lon.toFixed(4)}`,headers),pp=p?.properties||{},stationsUrl=pp.observationStations;if(!stationsUrl)throw new Error('no NWS stations endpoint');const stations=await fetchJson(stationsUrl,headers),station=stations?.features?.[0]?.id;if(!station)throw new Error('no NWS station');const obs=await fetchJson(`${station}/observations/latest`,headers),q=obs.properties||{},temp=cToF(q.temperature?.value),dew=cToF(q.dewpoint?.value),rh=Number.isFinite(q.relativeHumidity?.value)?Math.round(q.relativeHumidity.value):null,windMph=qvSpeedMph(q.windSpeed),windDir=Number.isFinite(q.windDirection?.value)?dir8(q.windDirection.value):null,layers=Array.isArray(q.cloudLayers)?q.cloudLayers:[],cloudCover=layers.reduce((m,l)=>Math.max(m,cloudCodeValue(l?.amount)||0),0),cloudCode=layers.map(l=>l?.amount).filter(Boolean).at(-1)||((q.textDescription||'').toLowerCase().includes('clear')?'CLR':''),pressure=Number.isFinite(q.barometricPressure?.value)?q.barometricPressure.value/3386.389:null,visibility=Number.isFinite(q.visibility?.value)?q.visibility.value/1609.344:null;let forecast=null;
    if(pp.forecastHourly){try{const fj=await fetchJson(pp.forecastHourly,headers),period=fj?.properties?.periods?.[0];if(period)forecast={temp:period.temperature,pop:period.probabilityOfPrecipitation?.value,windSpeed:period.windSpeed,windDirection:period.windDirection,shortForecast:period.shortForecast||'',startTime:period.startTime?new Date(period.startTime):null}}catch(e){state.errors.push(`hourly: ${e}`)}}
    state.weather={temp,dew,rh,windMph,windDir,text:q.textDescription||'',time:q.timestamp?new Date(q.timestamp):null,station:station.split('/').at(-1),cloudCover,cloudCode,pressure,visibility,forecast};
  }catch(e){state.errors.push(`weather: ${e}`)}render();return state.weather;
}
async function refreshVectors(){await Promise.allSettled([loadBoundaries(view()),loadSurfaceObs(view()),loadWarnings(),loadTropics(),loadWeather()])}
