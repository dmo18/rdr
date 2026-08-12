'use strict';

/* Robust storm-core detection for the vNext motion layer. */
const V_CORE_CACHE2=new Map();

function vCoreCandidates2(frame=displayedFrame(),def=view()){
  if(!frame)return[];const key=`${frame.key}|${def.id}|vnext-core2`;if(V_CORE_CACHE2.has(key))return V_CORE_CACHE2.get(key);const a=frame.views?.[def.id];if(!a)return[];const block=def.id==='home'?8:def.id==='metro'?9:def.id==='florida'?10:12,cand=[];
  for(let by=E_MAP_TOP;by<E_MAP_BOTTOM;by+=block)for(let bx=0;bx<CFG.width;bx+=block){let best=449,bx0=-1,by0=-1;for(let y=by;y<Math.min(E_MAP_BOTTOM,by+block);y++)for(let x=bx;x<Math.min(CFG.width,bx+block);x++){const q=a[y*CFG.width+x];if(q!==MISSING&&q>best){best=q;bx0=x;by0=y}}if(bx0>=0)cand.push({x:bx0,y:by0,value:best/10})}
  cand.sort((a,b)=>b.value-a.value);const out=[];for(const q of cand){if(out.some(o=>(o.x-q.x)**2+(o.y-q.y)**2<38**2))continue;out.push(q);if(out.length>=10)break}V_CORE_CACHE2.set(key,out);while(V_CORE_CACHE2.size>24)V_CORE_CACHE2.delete(V_CORE_CACHE2.keys().next().value);return out;
}

vStormTracks=function(def=view()){
  if(state.frames.length<2)return[];const old=state.frames.at(-2),cur=state.frames.at(-1),key=`${old.key}|${cur.key}|${def.id}|vnext2`;if(V_MOTION_CACHE.has(key))return V_MOTION_CACHE.get(key);const hours=(cur.time-old.time)/3600000;if(!(hours>0)){V_MOTION_CACHE.set(key,[]);return[]}
  const max=def.id==='home'?2:def.id==='metro'?3:def.id==='florida'?3:2,radius=def.id==='home'?24:def.id==='metro'?28:def.id==='florida'?20:12,cores=vCoreCandidates2(cur,def).filter(c=>c.value>=45&&eInMap(c.y,10)).slice(0,8),out=[];
  for(const c of cores){if(out.some(o=>(o.x-c.x)**2+(o.y-c.y)**2<42**2))continue;const a=vCentroidAround(old,def,c.x,c.y,radius),b=vCentroidAround(cur,def,c.x,c.y,radius);if(!a||!b)continue;const miles=haversineMiles(a,b),mph=miles/hours;if(mph<4||mph>90)continue;const brg=bearing(a,b);out.push({x:b.x,y:b.y,mph:Math.round(mph),bearing:brg,dir:dir8(brg),value:c.value});if(out.length>=max)break}
  if(!out.length&&['home','metro'].includes(def.id)&&state.motion&&Number.isFinite(state.motion.mph)){const c=cores[0];if(c)out.push({x:c.x,y:c.y,mph:state.motion.mph,bearing:state.motion.bearing,dir:state.motion.dir,value:c.value})}
  V_MOTION_CACHE.set(key,out);while(V_MOTION_CACHE.size>20)V_MOTION_CACHE.delete(V_MOTION_CACHE.keys().next().value);return out;
};

vStormFocus=function(occ){
  const def=view(),limit=def.id==='home'?1:def.id==='metro'?2:def.id==='florida'?3:2;let shown=0;
  for(const c of vCoreCandidates2(displayedFrame(),def)){if(shown>=limit||c.value<50||!eInMap(c.y,10))continue;const accent=c.value>=60?'#d852bc':c.value>=55?'#f04c66':'#f56a43',label=`${Math.round(c.value)} dBZ`;ctx.save();ctx.strokeStyle=accent;ctx.lineWidth=.85;ctx.beginPath();ctx.arc(c.x,c.y,3.7,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.font='800 5.1px Arial,Helvetica,sans-serif';const w=Math.ceil(ctx.measureText(label).width)+7,h=9.5,b=ePlace(occ,w,h,[[c.x+6,c.y-11],[c.x+6,c.y+3],[c.x-w-6,c.y-11]]);if(!b)continue;ctx.save();ctx.fillStyle='rgba(2,8,11,.58)';eRound(ctx,b.x,b.y,w,h,2);ctx.fill();ctx.strokeStyle=accent;ctx.globalAlpha=.75;ctx.lineWidth=.55;ctx.stroke();ctx.restore();vHaloText(label,b.x+w/2,b.y+h/2,{font:'800 5.1px Arial,Helvetica,sans-serif',fill:'#f5f8f9',halo:'rgba(0,5,8,.72)',haloRadius:.55});shown++}
};
eStormFocus=vStormFocus;
