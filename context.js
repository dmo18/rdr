'use strict';

function arcUrl(base,layer,bbox,outFields='*'){
  const [w,s,e,n]=bbox,p=new URLSearchParams({where:'1=1',geometry:`${w},${s},${e},${n}`,geometryType:'esriGeometryEnvelope',inSR:'4326',outSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields,returnGeometry:'true',f:'geojson'});
  return`${base}/${layer}/query?${p}`;
}
async function arcQuery(base,layer,bbox,outFields='*'){
  const j=await fetchJson(arcUrl(base,layer,bbox,outFields));return j?.features||[];
}

async function loadBoundaries(def=view()){
  if(state.boundaries.has(def.id))return state.boundaries.get(def.id);
  const jobs=[arcQuery(CFG.reference,3,def.bbox)];
  if(def.id==='home'||def.id==='metro')jobs.push(arcQuery(CFG.reference,2,def.bbox));else jobs.push(Promise.resolve([]));
  const [states,counties]=await Promise.all(jobs),value={states,counties};state.boundaries.set(def.id,value);render();return value;
}

async function loadWarnings(){
  try{const features=await arcQuery(CFG.warnings,0,CFG.views[3].bbox);state.warnings.clear();for(const f of features)state.warnings.set(String(f.id??f.properties?.OBJECTID??Math.random()),f)}
  catch(e){state.errors.push(`warnings: ${e}`)}render();
}

async function loadTropics(){
  const layers=[2,3,5,6,7,8,10,11,15,16];let all=[];
  for(const layer of layers){try{const features=await arcQuery(CFG.tropics,layer,CFG.views[3].bbox);for(const f of features)f._layer=layer;all=all.concat(features)}catch(e){state.errors.push(`tropics ${layer}: ${e}`)}}
  state.tropics=all;render();
}

function cToF(c){return Number.isFinite(c)?Math.round(c*9/5+32):null}
async function loadWeather(){
  try{
    const headers={Accept:'application/geo+json'};
    const p=await fetchJson(`${CFG.nws}/points/${CFG.home.lat.toFixed(4)},${CFG.home.lon.toFixed(4)}`,headers),stationsUrl=p?.properties?.observationStations;
    if(!stationsUrl)throw new Error('no NWS stations endpoint');
    const stations=await fetchJson(stationsUrl,headers),station=stations?.features?.[0]?.id;if(!station)throw new Error('no NWS station');
    const obs=await fetchJson(`${station}/observations/latest`,headers),q=obs.properties||{},temp=cToF(q.temperature?.value),rh=Number.isFinite(q.relativeHumidity?.value)?Math.round(q.relativeHumidity.value):null;
    const windMph=Number.isFinite(q.windSpeed?.value)?Math.round(q.windSpeed.value*2.23694):null,windDir=Number.isFinite(q.windDirection?.value)?dir8(q.windDirection.value):null;
    state.weather={temp,rh,windMph,windDir,text:q.textDescription||'',time:q.timestamp?new Date(q.timestamp):null,station:station.split('/').at(-1)};
  }catch(e){state.errors.push(`weather: ${e}`)}render();
}

async function refreshVectors(){
  await Promise.allSettled([loadBoundaries(view()),loadWarnings(),loadTropics(),loadWeather()]);
}
