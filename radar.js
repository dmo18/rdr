'use strict';

const PRIMARY='https://radar.weather.gov/ridge/standard/KAMX_loop.gif';
const FALLBACK='https://radar.weather.gov/ridge/standard/KAMX_0.gif';
const REFRESH_MS=90_000;

const image=document.getElementById('radarImage');
const liveState=document.getElementById('liveState');
const scanTime=document.getElementById('scanTime');
const sourceFailure=document.getElementById('sourceFailure');
let fallbackAttempt=false;

const timeFmt=new Intl.DateTimeFormat('en-US',{
  hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false,timeZone:'America/New_York'
});

function stamp(){
  scanTime.textContent=timeFmt.format(new Date());
}

function setState(mode){
  liveState.className='live-state'+(mode==='live'?'':` ${mode}`);
  liveState.innerHTML=`<i></i>${mode==='live'?'LIVE':mode==='degraded'?'FRAME':'OFFLINE'}`;
}

function source(url){
  const join=url.includes('?')?'&':'?';
  return `${url}${join}v=${Date.now()}`;
}

function loadLoop(){
  fallbackAttempt=false;
  image.onload=()=>{
    sourceFailure.classList.add('hidden');
    setState(fallbackAttempt?'degraded':'live');
    stamp();
  };
  image.onerror=()=>{
    if(!fallbackAttempt){
      fallbackAttempt=true;
      image.src=source(FALLBACK);
      return;
    }
    setState('down');
    sourceFailure.classList.remove('hidden');
    stamp();
  };
  image.src=source(PRIMARY);
}

function fit(){
  const scale=Math.min(innerWidth/456,innerHeight/257);
  const app=document.getElementById('radarApp');
  app.style.transform=`scale(${Math.max(.1,scale)})`;
}

fit();
addEventListener('resize',fit,{passive:true});
loadLoop();
setInterval(loadLoop,REFRESH_MS);
setInterval(()=>{
  if(liveState.classList.contains('down')) stamp();
},1000);

if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
