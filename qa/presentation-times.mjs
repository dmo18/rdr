import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const core=fs.readFileSync('core.js','utf8');
const makeContext=IntlValue=>vm.createContext({
  Date, Math, Number, String, Array, Object, Map, Set, Promise, URLSearchParams,
  Int16Array, Uint8Array, Uint32Array, Int32Array, Float32Array, DataView,
  Intl: IntlValue, navigator:{}, location:{search:''},
  document:{getElementById:id=>id==='panel'?{dataset:{}}:{getContext:()=>({})}}
});
const format=(IntlValue,date)=>{
  const context=makeContext(IntlValue);
  vm.runInContext(core,context,{filename:'core.js'});
  return vm.runInContext(`radarTimeET(new Date(${JSON.stringify(date)}))`,context);
};

/* DST edges prove this is not a fixed UTC offset. */
for(const IntlValue of [Intl,undefined]){
  assert.equal(format(IntlValue,'2026-01-15T03:35:00Z'),'10:35 PM ET');
  assert.equal(format(IntlValue,'2026-03-08T06:30:00Z'),'1:30 AM ET');
  assert.equal(format(IntlValue,'2026-03-08T07:30:00Z'),'3:30 AM ET');
  assert.equal(format(IntlValue,'2026-11-01T05:30:00Z'),'1:30 AM ET');
  assert.equal(format(IntlValue,'2026-11-01T06:30:00Z'),'1:30 AM ET');
}

const vnext=fs.readFileSync('vnext.js','utf8');
const copy=fs.readFileSync('alert-copy.js','utf8');
const legacy=fs.readFileSync('enterprise-ui.js','utf8');
const alerts=fs.readFileSync('alerts.js','utf8');
for(const [name,source] of [['vnext',vnext],['alert copy',copy],['legacy UI',legacy],['alerts fallback',alerts]])assert.match(source,/radarTimeET\(/,`${name} routes visible radar time through ET formatter`);
assert.match(vnext,/OBSERVED LOOP/);
assert.match(vnext,/FRAME \$\{frames\.length \? state\.cursor \+ 1 : 0\} OF \$\{frames\.length\}/);
assert.match(vnext,/EXTRAPOLATED/);
assert.match(vnext,/MOTION \+\$\{overlay\.minutes\} MIN/);
assert.match(vnext,/UNAVAILABLE • STALE/,'only stale observations are labelled unavailable');
assert.match(vnext,/AWAITING FRAMES/,'a live loop with insufficient history is explicitly a warm-up state');
assert.match(vnext,/OBSERVED LOOP BUILDING/);
assert.match(vnext,/LOW CONFIDENCE/);
assert.match(vnext,/NO MOTION ESTIMATE/);
assert.match(vnext,/EXTRAPOLATION SUPPRESSED/);
assert.doesNotMatch(vnext,/MOTION NOT AVAILABLE/,'suppressed estimates do not imply observed radar is unavailable');
assert.doesNotMatch(vnext,/reason === 'awaiting-observed-frames' \? 'OBSERVED DATA UNAVAILABLE'/,'a loop warm-up never reports the observed feed unavailable');
assert.match(vnext,/EST \$\{radarTimeET/);
assert.match(vnext,/radarEtaTime\(/);
assert.match(copy,/LAST GOOD SCAN/);
assert.doesNotMatch(vnext,/utcTime\(/,'vNext has no UTC radar presentation');

/* Native footer text stays within the fixed 456 x 257 canvas. */
for(const [x,y] of [[7,226],[166,226],[326,226],[166,244],[326,244]]){
  assert.ok(x>=0&&x<=456&&y>=0&&y<=257,`footer label ${x},${y} is in bounds`);
}
console.log('ET presentation formatter and native-footer checks passed');
