import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const current=readFileSync('index.html','utf8');
const assets=[...current.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"?]+\.(?:js|css))\?v=([^"]+)"/g)].map(([,file,version])=>[file,version]);
if(!assets.length)throw new Error('index has no versioned runtime assets');
const versions=new Set(assets.map(([,version])=>version));
if(versions.size!==1)throw new Error(`runtime assets do not share one release version: ${[...versions].join(', ')}`);
const base=process.env.RDR_RELEASE_BASE||'main';
const mergeBase=execFileSync('git',['merge-base',base,'HEAD'],{encoding:'utf8'}).trim();
const changed=execFileSync('git',['diff','--name-only',`${mergeBase}..HEAD`],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
let previous='';
try{previous=execFileSync('git',['show',`${mergeBase}:index.html`],{encoding:'utf8'})}catch{}
const previousVersions=new Map([...previous.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"?]+\.(?:js|css))\?v=([^"]+)"/g)].map(([,file,version])=>[file,version]));
for(const file of changed.filter(file=>/\.(?:js|css)$/.test(file))){
  const currentVersion=new Map(assets).get(file),oldVersion=previousVersions.get(file);
  if(currentVersion&&oldVersion===currentVersion)throw new Error(`${file} changed but retained cached URL version ${currentVersion}`);
}
console.log(JSON.stringify({base:mergeBase,release:[...versions][0],assets:assets.length,changed}));
