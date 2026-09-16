import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const panel={dataset:{}}, canvas={getContext:()=>({})};
const context=vm.createContext({
  console, assert, Map, Set, Date, Math, Number, String, Array, Object, Int16Array,
  Uint8Array, Uint32Array, Int32Array, Float32Array, DataView, Promise,
  URLSearchParams, performance:{now:()=>0}, navigator:{}, location:{search:''},
  document:{getElementById:id=>id==='panel'?panel:canvas,createElement:()=>canvas},
  setTimeout:()=>0, clearTimeout:()=>{}, fetch:()=>Promise.reject(new Error('network disabled in deterministic QA')),
  DecompressionStream:undefined
});
vm.runInContext(fs.readFileSync('core.js','utf8'),context,{filename:'core.js'});
vm.runInContext(fs.readFileSync('radar.js','utf8'),context,{filename:'radar.js'});

const result=vm.runInContext(`(() => {
  const size=CFG.width*CFG.mapHeight;
  const blank=()=>new Int16Array(size);
  const frame=(n, when, x, strength=300)=>{
    const metro=blank(), home=blank();
    for(let yy=-3;yy<=3;yy++)for(let xx=-3;xx<=3;xx++)metro[(160+yy)*CFG.width+x+xx]=strength;
    return {key:'observed-'+n,time:new Date(when),views:{home,metro,florida:blank(),regional:blank()}};
  };
  const now=Date.now(), interval=5*60000;
  state.frames=[];state.lastGoodFrames=[];state.runtime.lowPower=true;
  for(let i=0;i<6;i++)commitObservedFrame(frame(i,now-(6-i)*interval,100+i*20));
  assert.equal(state.frames.length,5,'observed window is capped at five frames');
  assert.deepEqual(state.frames.map(f=>f.key),['observed-1','observed-2','observed-3','observed-4','observed-5'],'window retains the newest five in time order');
  assert.equal(panel.dataset.observedFrames,'5');
  assert.equal(panel.dataset.loop,'observed-5-of-5');
  assert.equal(state.motionOverlay.kind,'extrapolated');
  assert.equal(state.motionOverlay.suppressed,false,'stable observed motion produces a labelled extrapolation');
  assert.ok(state.motionOverlay.confidence>=75);
  const lastGood=state.lastGoodFrames.map(f=>f.key);
  state.frames=[];
  assert.equal(restoreLastGoodFrames(),true,'last-good observed frames can be restored');
  assert.deepEqual(state.frames.map(f=>f.key),lastGood);
  assert.equal(panel.dataset.fallback,'last-good-observed');

  state.frames=[frame('old-a',now-31*60000,120),frame('old-b',now-26*60000,140),frame('old-c',now-21*60000,160)];
  deriveHome();
  assert.equal(state.motionOverlay.suppressed,true,'stale observations suppress extrapolation');
  assert.equal(state.motionOverlay.reason,'stale-observation');

  state.frames=[frame('wide-a',now-10*60000,100),frame('wide-b',now-5*60000,120),frame('wide-c',now,105)];
  deriveHome();
  assert.equal(state.motionOverlay.suppressed,true,'unstable direction suppresses extrapolation');
  assert.equal(state.motionOverlay.reason,'low-confidence-motion');
  return {frames:lastGood,confidence:state.lastGoodFrames.length,lowPower:state.runtime.lowPower};
})()`,context);

const ui=fs.readFileSync('enterprise-ui.js','utf8');
const map=fs.readFileSync('enterprise-map.js','utf8');
assert.match(ui,/OBSERVED LOOP/);
assert.match(ui,/EXTRAPOLATION SUPPRESSED/);
assert.match(ui,/utcTime\(frames\[i\]\.time\)/,'each rail point renders its observed timestamp');
assert.match(map,/function eMotionOverlay/);
assert.doesNotMatch(map.match(/function eMotionOverlay[\s\S]*?(?=function ePeak)/)?.[0]||'',/requestAnimationFrame/,'motion overlay is static for low-power players');
console.log(JSON.stringify({ok:true,...result}));
