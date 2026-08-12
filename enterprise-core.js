'use strict';

function walkCoords(v,fn){if(!Array.isArray(v))return;if(v.length>=2&&Number.isFinite(v[0])&&Number.isFinite(v[1]))fn(v);else for(const x of v)walkCoords(x,fn)}
function geometryCenter(g){if(!g)return null;let w=Infinity,e=-Infinity,s=Infinity,n=-Infinity;walkCoords(g.coordinates,c=>{w=Math.min(w,c[0]);e=Math.max(e,c[0]);s=Math.min(s,c[1]);n=Math.max(n,c[1])});return Number.isFinite(w)?{lon:(w+e)/2,lat:(s+n)/2}:null}
function displayedFrame(){if(!state.frames.length)return null;return state.frames[clamp(state.cursor,0,state.frames.length-1)]||state.frames.at(-1)}
function warningCode(f){const p=f?.properties||{},ph=String(p.phenom||p.event||p.prod_type||'').toUpperCase();if(ph==='TO'||ph.includes('TORNADO'))return'TOR';if(ph==='SV'||ph.includes('SEVERE'))return'SVR';if(ph==='FF'||ph.includes('FLASH FLOOD'))return'FFW';if(ph.includes('FLOOD'))return'FLD';return'WX'}
function pointInRing(pt,ring){let c=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>pt.lat)!==(b[1]>pt.lat))&&(pt.lon<(b[0]-a[0])*(pt.lat-a[1])/(b[1]-a[1]+1e-12)+a[0]))c=!c}return c}
function containsPoint(g,pt){if(!g)return false;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];return polys.some(p=>p[0]&&pointInRing(pt,p[0]))}
function localAlert(){for(const f of state.warnings.values())if(containsPoint(f.geometry,CFG.home))return f;return null}
function renderUnavailable(){
  ctx.fillStyle='#04131b';ctx.fillRect(0,0,CFG.width,CFG.height);const g=ctx.createLinearGradient(0,0,0,CFG.height);g.addColorStop(0,'rgba(13,42,54,.45)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,CFG.width,CFG.height);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#eaf4f7';ctx.font='900 13px Arial,Helvetica,sans-serif';ctx.fillText('LIVE RADAR UNAVAILABLE',CFG.width/2,116);ctx.fillStyle='#8ca4ae';ctx.font='700 6px Arial,Helvetica,sans-serif';ctx.fillText('WAITING FOR CURRENT NOAA MRMS DATA',CFG.width/2,133);
}
