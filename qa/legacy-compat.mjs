import fs from 'node:fs';

const files=['core.js','radar.js','context.js','enterprise-core.js','enterprise-map.js','enterprise-overlays.js','enterprise-ui.js','alerts.js','hidpi.js','vnext.js','vnext-motion.js','alert-copy.js','app.js'];
const unsupported=[['optional chaining',/\?\./],['nullish coalescing',/\?\?(?![.=])/],['optional catch binding',/catch\s*\{/]];
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  for(const [name,pattern] of unsupported)if(pattern.test(source))throw new Error(`${file} retains ${name}, which Yodeck Chromium cannot parse`);
}
const core=fs.readFileSync('core.js','utf8');
for(const name of ['Promise.allSettled','Array.prototype.at','Array.prototype.flat','Object.fromEntries'])if(!core.includes(`if (!${name})`))throw new Error(`missing legacy ${name} shim`);
console.log(`legacy Yodeck syntax/API gate passed for ${files.length} runtime files`);
