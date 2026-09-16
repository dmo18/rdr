'use strict';
(async()=>{
  const result={viewport:[innerWidth,innerHeight]};
  try{
    state.runtime.requestTimeoutMs=35;
    const nativeAbortController=window.AbortController;
    try{Object.defineProperty(window,'AbortController',{value:undefined,configurable:true})}catch{}
    if(typeof AbortController==='function')throw new Error('cannot simulate Chromium without AbortController');
    const keys=['qa-1.grib2.gz','qa-2.grib2.gz','qa-3.grib2.gz','qa-4.grib2.gz','qa-5.grib2.gz'],xml=keys.map(key=>`<Key>CONUS/${CFG.radarProduct}/qa/${key}</Key>`).join('');
    let listings=0,gribResponses=0,gribBodies=0;const realFetch=window.fetch;
    window.fetch=url=>{
      if(String(url).includes('list-type=2')){listings++;return Promise.resolve({ok:true,text:()=>Promise.resolve(`<ListBucketResult>${xml}</ListBucketResult>`)})}
      if(String(url).endsWith('.grib2.gz')){gribResponses++;return Promise.resolve({ok:true,arrayBuffer:()=>{gribBodies++;return new Promise(()=>{})}})}
      throw new Error(`unexpected request ${url}`);
    };
    await pollRadar();await pollRadar();
    state.pendingRadarKeys=[`CONUS/${CFG.radarProduct}/qa/${keys[0]}`];await backfillRadar();
    result.poll={abortController:'absent',listings,gribResponses,gribBodies,locked:state.radarLoading,backfillLocked:state.radarBackfilling,radar:panel.dataset.radar,freshness:panel.dataset.freshness,errors:[...state.errors]};
    if(listings!==2||gribResponses!==3||gribBodies!==3||state.radarLoading||state.radarBackfilling||panel.dataset.radar!=='unavailable'||panel.dataset.freshness!=='stale'||state.errors.filter(e=>/request timeout/.test(e)).length!==3)throw new Error(`GRIB timeout recovery failed: ${JSON.stringify(result.poll)}`);
    window.fetch=realFetch;
    Object.defineProperty(window,'AbortController',{value:nativeAbortController,configurable:true});

    const originalAppend=HTMLHeadElement.prototype.appendChild,originalStream=window.DecompressionStream,originalFflate=window.fflate;
    Object.defineProperty(window,'DecompressionStream',{value:undefined,configurable:true});window.fflate=undefined;let fallbackAttempts=0;
    HTMLHeadElement.prototype.appendChild=function(node){if(node.tagName==='SCRIPT'&&/fflate/.test(node.src)){fallbackAttempts++;if(fallbackAttempts===2)setTimeout(()=>{window.fflate={gunzipSync:()=>new Uint8Array(),unzlibSync:()=>new Uint8Array()};node.onload()},0);return node}return originalAppend.call(this,node)};
    let fallbackError='';try{await loadCompatInflater()}catch(e){fallbackError=String(e)}const fallback=await loadCompatInflater();
    HTMLHeadElement.prototype.appendChild=originalAppend;
    result.fallback={error:fallbackError,attempts:fallbackAttempts,retried:fallback===window.fflate};
    if(!/timeout/.test(fallbackError)||fallbackAttempts!==2||!result.fallback.retried)throw new Error(`fallback hang: ${JSON.stringify(result.fallback)}`);
    let cancelled=0,asyncCalls=0;
    window.fflate={gunzipSync:()=>{throw new Error('synchronous fallback used')},unzlibSync:()=>{throw new Error('synchronous fallback used')},gunzip:()=>{asyncCalls++;return()=>cancelled++},unzlib:(input,done)=>{asyncCalls++;setTimeout(()=>done(null,new Uint8Array([1,2,3])),0);return()=>cancelled++}};
    let asyncError='';try{await inflate(new Uint8Array([1]).buffer,'gzip')}catch(e){asyncError=String(e)}const asyncOut=await inflate(new Uint8Array([1]).buffer,'deflate');
    result.fallback.async={error:asyncError,cancelled,asyncCalls,output:[...new Uint8Array(asyncOut)]};
    if(!/decompression timeout/.test(asyncError)||cancelled!==1||asyncCalls!==2||result.fallback.async.output.join(',')!=='1,2,3')throw new Error(`async fallback recovery failed: ${JSON.stringify(result.fallback.async)}`);
    window.fflate=originalFflate;Object.defineProperty(window,'DecompressionStream',{value:originalStream,configurable:true});
    window.__QA__={ready:true,...result};document.body.dataset.qaReady='true';
  }catch(e){console.error(e);window.__QA__={ready:false,...result,error:String(e),errors:[...state.errors]};document.body.dataset.qaError=String(e)}
})();
