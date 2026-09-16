import puppeteer from 'puppeteer-core';

const base=process.argv[2]||'http://127.0.0.1:8765/';
const browser=await puppeteer.launch({executablePath:process.env.CHROME,headless:true,args:['--no-sandbox','--disable-gpu']});
const legacyApis=()=>{
  for(const [owner,key] of [[Promise,'allSettled'],[Array.prototype,'at'],[Array.prototype,'flat'],[Object,'fromEntries'],[window,'DecompressionStream'],[window,'AbortController']])try{Object.defineProperty(owner,key,{value:undefined,configurable:true})}catch(e){}
  window.fetch=url=>Promise.resolve(new Response(String(url).includes('list-type=2')?'<ListBucketResult/>':'{"features":[]}',{status:200}));
};
try{
  const page=await browser.newPage();await page.evaluateOnNewDocument(legacyApis);await page.setViewport({width:456,height:257,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}?yodeck=1&legacy=${Date.now()}`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__RDR__&&panel.dataset.ready==='true',{timeout:10000});
  const result=await page.evaluate(()=>({ready:panel.dataset.ready,bootOff:boot.className.includes('off'),radar:panel.dataset.radar,settled:typeof Promise.allSettled,at:typeof [].at,flat:typeof [].flat,fromEntries:typeof Object.fromEntries,fromEntriesValue:Object.fromEntries([['yodeck',1]]).yodeck}));await page.close();
  if(errors.length||result.ready!=='true'||!result.bootOff||result.settled!=='function'||result.at!=='function'||result.flat!=='function'||result.fromEntries!=='function'||result.fromEntriesValue!==1)throw new Error(`legacy bootstrap failed: ${JSON.stringify({result,errors})}`);

  const broken=await browser.newPage();await broken.setRequestInterception(true);broken.on('request',request=>request.url().includes('/app.js?')?request.respond({status:200,contentType:'application/javascript',body:'this is not valid javascript('}):request.continue());
  await broken.goto(`${base}?broken=${Date.now()}`,{waitUntil:'domcontentloaded'});await broken.waitForFunction(()=>panel.dataset.ready==='true'&&boot.className.includes('off'),{timeout:5000});const fallback=await broken.evaluate(()=>({ready:panel.dataset.ready,radar:panel.dataset.radar,freshness:panel.dataset.freshness,bootOff:boot.className.includes('off')}));await broken.close();
  if(fallback.ready!=='true'||fallback.radar!=='unavailable'||fallback.freshness!=='stale'||!fallback.bootOff)throw new Error(`startup fail-safe failed: ${JSON.stringify(fallback)}`);
  console.log(JSON.stringify({result,fallback}));
}finally{await browser.close()}
