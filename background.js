'use strict';

// One decoder, a bounded queue, transferable results, and a timed fallback.
// Generate the worker from the exact same tested decoder functions as the page.
const rdrDecode = { worker: null, jobs: [], active: null, nextId: 0, retryAt: 0, stopped: false, url: null };
function rdrStopDecoder(error) {
  if (rdrDecode.worker) rdrDecode.worker.terminate();
  if (rdrDecode.url) URL.revokeObjectURL(rdrDecode.url);
  rdrDecode.worker = null;
  rdrDecode.url = null;
  rdrDecode.retryAt = Date.now() + 60000;
  const pending = rdrDecode.jobs.splice(0);
  if (rdrDecode.active) pending.unshift(rdrDecode.active);
  rdrDecode.active = null;
  pending.forEach(job => { clearTimeout(job.timer); job.reject(error || new Error('decoder stopped')); });
}
function rdrCreateDecoder() {
  const defs = [parseGrib, makeSamplers, valueFromX, sampleValue, interpolated, normalizedValue, decodePngToViews];
  const source = "'use strict';\n" +
    'const CFG=' + JSON.stringify({width: CFG.width, height: CFG.height, mapHeight: CFG.mapHeight, views: CFG.views}) + ';\n' +
    'const MISSING=' + MISSING + ';\n' +
    'const state={runtime:{lowPower:false}};\n' +
    'if(!Object.fromEntries)Object.fromEntries=function(items){var out={};items.forEach(function(x){out[x[0]]=x[1]});return out;};\n' +
    'const sm16=' + sm16.toString() + ';const sm32=' + sm32.toString() + ';const paeth=' + paeth.toString() + ';\n' +
    'const lon360=' + lon360.toString() + ';const clamp=' + clamp.toString() + ';const radarYield=' + radarYield.toString() + ';\n' +
    defs.map(f => f.toString()).join('\n') + '\n' +
    'async function inflate(buf,kind){if(typeof DecompressionStream==="function")return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream(kind))).arrayBuffer();' +
    'if(!self.fflate)importScripts("https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js");return(kind==="gzip"?self.fflate.gunzipSync:self.fflate.unzlibSync)(new Uint8Array(buf)).buffer;}\n' +
    'self.onmessage=async function(e){const j=e.data;try{const raw=await inflate(j.bytes,"gzip"),meta=parseGrib(raw),views=await decodePngToViews(meta,j.kind);delete meta.png;' +
    'self.postMessage({id:j.id,frame:{key:j.key,time:meta.ref,views:views,meta:meta}},Object.keys(views).map(k=>views[k].buffer));}catch(error){self.postMessage({id:j.id,error:String(error)});}};';
  rdrDecode.url = URL.createObjectURL(new Blob([source], {type: 'application/javascript'}));
  const worker = new Worker(rdrDecode.url);
  rdrDecode.worker = worker;
  worker.onmessage = event => {
    const job = rdrDecode.active;
    if (!job || event.data.id !== job.id) return;
    if (event.data.error) { rdrStopDecoder(new Error(event.data.error)); return; }
    clearTimeout(job.timer);
    rdrDecode.active = null;
    state.runtime.decoder = 'worker';
    job.resolve(event.data.frame);
    rdrDrainDecoder();
  };
  worker.onerror = () => rdrStopDecoder(new Error('background decoder failed'));
}
function rdrDrainDecoder() {
  if (rdrDecode.active || !rdrDecode.jobs.length || rdrDecode.stopped) return;
  const job = rdrDecode.jobs.shift();
  rdrDecode.active = job;
  job.timer = setTimeout(() => rdrStopDecoder(new Error('background decoder timeout')), 30000);
  try { rdrDecode.worker.postMessage({id: job.id, bytes: job.bytes, key: job.key, kind: job.kind}, [job.bytes]); }
  catch (error) { rdrStopDecoder(error); }
}
function rdrDecodeInWorker(bytes, key, kind) {
  if (rdrDecode.stopped || typeof Worker !== 'function' || Date.now() < rdrDecode.retryAt) return Promise.reject(new Error('worker fallback'));
  if (rdrDecode.jobs.length >= 3) return Promise.reject(new Error('decoder queue full'));
  try { if (!rdrDecode.worker) rdrCreateDecoder(); } catch (error) { rdrStopDecoder(error); return Promise.reject(error); }
  return new Promise((resolve, reject) => {
    rdrDecode.jobs.push({id: ++rdrDecode.nextId, bytes: bytes.slice(0), key, kind, resolve, reject});
    rdrDrainDecoder();
  });
}
loadFieldKey = async function (key, kind = 'radar') {
  const bytes = await fetchWithTimeout(`${CFG.mrmsBucket}/${key}`, {cache: 'no-store'}, 30000, r => r.arrayBuffer());
  try { return await rdrDecodeInWorker(bytes, key, kind); }
  catch (error) {
    if (rdrDecode.stopped) throw error;
    state.runtime.decoder = 'cooperative';
    const grib = await inflate(bytes, 'gzip'), meta = parseGrib(grib), views = await decodePngToViews(meta, kind);
    delete meta.png;
    return {key, time: meta.ref, views, meta};
  }
};
addEventListener('pagehide', () => { rdrDecode.stopped = true; rdrStopDecoder(); });
