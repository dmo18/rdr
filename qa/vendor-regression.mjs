import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import puppeteer from 'puppeteer-core';

const VENDOR='vendor/fflate-0.8.2.min.js';
const SHA256='c3b34f2e9f5e74d4d7d64e01cac7a0c01954c6c406414d42185c7b53d6875ddf';
const ORIGIN=process.env.RDR_ORIGIN||'http://127.0.0.1:8765';
const fail=m=>{throw new Error(m)};

// 1. no CDN reference in runtime files
for(const f of fs.readdirSync('.').filter(f=>/\.(js|html|css)$/.test(f)))
  if(/jsdelivr/i.test(fs.readFileSync(f,'utf8')))fail(`${f} references jsdelivr`);

// 2. vendored file integrity
const sha=crypto.createHash('sha256').update(fs.readFileSync(VENDOR)).digest('hex');
if(sha!==SHA256)fail(`${VENDOR} sha256 ${sha} != ${SHA256}`);
if(!fs.existsSync('vendor/fflate-LICENSE.txt'))fail('missing vendor/fflate-LICENSE.txt');

// 3. headless: force the fallback, page and worker
const args=['--no-sandbox','--disable-gpu'];
if(process.env.HTTPS_PROXY)args.push(`--proxy-server=${process.env.HTTPS_PROXY}`,'--proxy-bypass-list=127.0.0.1;localhost','--ignore-certificate-errors');
const browser=await puppeteer.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args});
try{
  const page=await browser.newPage();
  await page.setViewport({width:456,height:257});
  const scriptReqs=[];
  const note=r=>{if(['script','other'].includes(r.resourceType())||/\.js(\?|$)/.test(r.url()))scriptReqs.push(r.url())};
  page.on('request',note);
  browser.on('targetcreated',async t=>{if(t.type()==='worker'||t.type()==='other'){try{const w=await t.worker();w&&w.client&&w.client.on&&w.client.on('Network.requestWillBeSent',e=>scriptReqs.push(e.request.url))}catch(_){}}});
  await page.evaluateOnNewDocument(()=>{
    delete window.DecompressionStream;
    const B=window.Blob;
    window.Blob=function(parts,opts){
      parts=(parts||[]).map(p=>typeof p==='string'&&p.includes('async function inflate')?p.replace('typeof DecompressionStream==="function"','false'):p);
      return new B(parts,opts);
    };
    window.Blob.prototype=B.prototype;
  });
  await page.goto(`${ORIGIN}/index.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof inflate==='function'&&typeof rdrCreateDecoder==='function',{timeout:20000});
  const gz=[...zlib.gzipSync(Buffer.from('rdr-vendor-regression'))];
  const pageRes=await page.evaluate(async bytes=>{
    if(typeof DecompressionStream!=='undefined')return {error:'DecompressionStream still present'};
    const out=await inflate(new Uint8Array(bytes).buffer,'gzip');
    return {text:new TextDecoder().decode(out),fflate:typeof window.fflate,src:[...document.scripts].map(s=>s.src)};
  },gz);
  if(pageRes.error)fail(pageRes.error);
  if(pageRes.text!=='rdr-vendor-regression')fail('page fallback decode mismatch');
  const workerRes=await page.evaluate(async bytes=>{
    rdrCreateDecoder();
    const src=await (await fetch(rdrDecode.url)).text();
    const m=/importScripts\((".*?")\)/.exec(src);
    const test=src+'\nself.onmessage=async function(e){try{const r=await inflate(e.data,"gzip");self.postMessage({ok:true,text:new TextDecoder().decode(r),has:typeof self.fflate})}catch(x){self.postMessage({ok:false,error:String(x)})}};';
    const w=new Worker(URL.createObjectURL(new Blob([test],{type:'application/javascript'})));
    const res=await new Promise((ok,no)=>{w.onmessage=e=>ok(e.data);w.onerror=e=>no(new Error('worker error '+e.message));setTimeout(()=>no(new Error('worker timeout')),20000);w.postMessage(new Uint8Array(bytes).buffer)});
    w.terminate();rdrStopDecoder&&rdrStopDecoder(new Error('qa done'));
    return {url:m&&JSON.parse(m[1]),usesNative:src.includes('typeof DecompressionStream==="function"'),res};
  },gz);
  if(!workerRes.url)fail('worker source has no importScripts URL');
  if(!workerRes.url.startsWith(ORIGIN+'/vendor/fflate-0.8.2.min.js'))fail(`worker fflate URL not same-origin vendor: ${workerRes.url}`);
  if(!workerRes.res.ok||workerRes.res.text!=='rdr-vendor-regression')fail('worker fallback failed: '+JSON.stringify(workerRes.res));
  const fflateReqs=scriptReqs.filter(u=>/fflate/.test(u));
  if(!fflateReqs.length||!fflateReqs.every(u=>u.startsWith(ORIGIN+'/vendor/fflate-0.8.2.min.js')))fail('fflate not loaded from same origin: '+JSON.stringify(fflateReqs));
  const third=scriptReqs.filter(u=>!u.startsWith(ORIGIN)&&!u.startsWith('blob:')&&!u.startsWith('data:'));
  const thirdJs=third.filter(u=>/\.js(\?|$)/.test(u));
  if(thirdJs.length)fail('third-party script requests: '+thirdJs.join(', '));
  console.log(`vendor regression passed: sha256 ${sha.slice(0,12)}, fflate same-origin (${fflateReqs.length} req), page+worker fallback decoded, 0 third-party scripts`);
}finally{await browser.close()}
