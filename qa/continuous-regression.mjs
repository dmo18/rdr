import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const timers = new Map(), listeners = {}, panel = {dataset:{}, style:{}}, canvas = {getContext:()=>({})};
let id = 0, now = 0;
const sandbox = {console, URLSearchParams, navigator:{hardwareConcurrency:4,deviceMemory:4},location:{search:'?yodeck=1'},document:{getElementById:n=>n==='display'?canvas:panel},performance:{now:()=>now},setTimeout:(f,ms)=>{timers.set(++id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),clearInterval:id=>timers.delete(id),addEventListener:(n,f)=>{(listeners[n]||(listeners[n]=[])).push(f)},matchMedia:()=>({matches:true}),cancelAnimationFrame:()=>{},requestAnimationFrame:()=>1};
const c=vm.createContext(sandbox), run=s=>vm.runInContext(s,c);
for(const file of ['core.js','radar.js','enterprise-core.js','enterprise-map.js'])run(fs.readFileSync(file,'utf8'));
run(fs.readFileSync('app.js','utf8').split('init().catch')[0]);
run(`render=()=>{};deriveHome=()=>{state.deriveCalls=(state.deriveCalls||0)+1};eRadarCanvas=()=>{};
function makeFrame(i){const a=new Int16Array(2);return {key:'f'+i,time:new Date(2026,9,23,0,i*2),views:{home:a,metro:a}};}
for(let i=0;i<24;i++)commitObservedFrame(makeFrame(i));
state.cursor=10;state.playingKey=displayedFrame().key;
commitObservedFrame(makeFrame(24));`);
assert.equal(run('state.frames.length'),24,'history is bounded');
assert.equal(run('displayedFrame().key'),run('state.playingKey'),'new scan preserves displayed observation');
const derives=run('state.deriveCalls');run('commitObservedFrame(makeFrame(2))');
assert.equal(run('state.deriveCalls'),derives,'historical insertion does not recalculate latest-home analysis');
run('state.cursor=0;state.playingKey=displayedFrame().key;commitObservedFrame(makeFrame(0));');
assert.equal(run('displayedFrame().key'),run('state.playingKey'),'older backfill retains playing frame');
run('state.frames=[makeFrame(10)];state.cursor=0;state.deriveCalls=0;commitObservedFrame(makeFrame(9));commitObservedFrame(makeFrame(8));commitObservedFrame(makeFrame(7));');
assert.equal(run('state.deriveCalls'),2,'recent backfill updates motion analysis; older history avoids repeating it');
run('state.frames=[makeFrame(0),makeFrame(1),makeFrame(2)];state.view=0;state.viewStarted=0;state.boundaries.set("metro",{});state.cursor=0');
now=30000;run('advanceRadarFrame()');assert.equal(run('state.view'),0,'no rotation mid loop');
run('state.cursor=2;advanceRadarFrame()');assert.equal(run('state.view'),1,'rotation at completed loop');assert.equal(run('state.cursor'),0,'new view starts with oldest observed frame');
run('state.viewStarted=0;state.cursor=2;advanceRadarFrame()');assert.equal(run('state.view'),1,'unready geography never exposed');
run('state.radarBackfilling=true;state.radarLoading=false;recentKeys=()=>{throw new Error("must not overlap")};');await run('pollRadar()');assert.equal(run('state.radarLoading'),false,'poll does not overlap history acquisition');
// Poll callbacks cannot overlap and reschedule only after settlement.
run('state.runtime.stopped=false;state.radarBackfilling=false;state.pollCalls=0;pollRadar=()=>{state.pollCalls++;return new Promise(resolve=>{state.resolvePoll=resolve})};startPolling()');
const timer=[...timers.values()].find(t=>t.ms===120000);assert.ok(timer);const pending=timer.f();await timer.f();assert.equal(run('state.pollCalls'),1);run('state.resolvePoll()');await pending;
for(const f of listeners.pagehide)f();assert.equal(run('state.runtime.stopped'),true);const before=run('state.cursor');run('advanceRadarFrame()');assert.equal(run('state.cursor'),before,'shutdown prevents animation');
run('state.curves=0;state.closed=false;eRound({beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},quadraticCurveTo:()=>state.curves++,closePath:()=>state.closed=true},0,0,12,8,2)');
assert.equal(run('state.curves'),4,'storm label path works without Canvas.roundRect');assert.equal(run('state.closed'),true);
console.log('9 continuous-playback/history/poll/shutdown regression groups passed');
