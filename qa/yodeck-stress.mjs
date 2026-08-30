import puppeteer from 'puppeteer-core';
import fs from 'node:fs';

const base=process.env.RDR_URL||'http://127.0.0.1:8765/',outDir=process.env.RDR_OUT||'/tmp/rdr-yodeck-stress',chrome=process.env.CHROME;
if(!chrome)throw new Error('set CHROME to a Chromium executable');
fs.mkdirSync(outDir,{recursive:true});
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const result={viewport:[456,257],cpuThrottle:4,views:{}};
const setup=async page=>{const cdp=await page.target().createCDPSession();await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true})};
const ready=page=>page.waitForFunction(()=>window.__RDR__&&panel.dataset.ready==='true'&&panel.dataset.radar==='live'&&state.frames.length>=1,{timeout:120000,polling:250});
const idleRadar=page=>page.waitForFunction(()=>!state.radarLoading&&!state.radarBackfilling,{timeout:75000,polling:250});
const diag=page=>page.evaluate(()=>({viewport:[innerWidth,innerHeight],panel:[panel.getBoundingClientRect().width,panel.getBoundingClientRect().height],backing:[canvas.width,canvas.height],frames:state.frames.length,radarLoading:state.radarLoading,backfillLocked:state.radarBackfilling,severe:{lightning:!!state.severe.lightning,mesh:!!state.severe.mesh},errors:[...state.errors],dataset:{...panel.dataset}}));
try{
  for(const id of ['home','metro','florida','regional']){
    const page=await browser.newPage();await page.setViewport({width:456,height:257,deviceScaleFactor:1});await setup(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const started=Date.now();await page.goto(`${base}?view=${id}&yodeck=1&stress=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});await ready(page);await page.reload({waitUntil:'domcontentloaded',timeout:120000});await ready(page);await idleRadar(page);
    const d=await diag(page);d.readyReloadMs=Date.now()-started;d.browserErrors=errors;result.views[id]=d;await (await page.$('#panel')).screenshot({path:`${outDir}/${id}.png`});await page.close();
    if(d.viewport[0]!==456||d.viewport[1]!==257||d.panel[0]!==456||d.panel[1]!==257||d.radarLoading||d.backfillLocked||errors.length)throw new Error(`${id}: ${JSON.stringify(d)}`);
  }
  const page=await browser.newPage();await page.setViewport({width:456,height:257,deviceScaleFactor:1});await setup(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}?view=florida&yodeck=1&full-stress=${Date.now()}`,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>window.__RDR__&&state.frames.length>=3&&state.severe.lightning&&state.severe.mesh,{timeout:180000,polling:500});await page.evaluate(()=>pollRadar());await page.waitForFunction(()=>!state.radarLoading,{timeout:45000,polling:250});
  result.full=await diag(page);result.full.browserErrors=errors;await (await page.$('#panel')).screenshot({path:`${outDir}/full-runtime.png`});await page.close();
  if(result.full.radarLoading||result.full.backfillLocked||result.full.frames<3||!result.full.severe.lightning||!result.full.severe.mesh||errors.length)throw new Error(`full: ${JSON.stringify(result.full)}`);
}finally{result.finished=new Date().toISOString();fs.writeFileSync(`${outDir}/results.json`,JSON.stringify(result,null,2));await browser.close()}
console.log(JSON.stringify(result,null,2));
