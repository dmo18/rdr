// Deterministic pixel proof for refactors that must not change the picture.
// Renders qa/replay.html from a fixed fixture with a frozen clock and hashes every
// canvas pixel. See docs/DEADCODE.md section 3 and qa/README.md.
//
//   node qa/pixel-freeze.mjs render <fixture.json> <outDir>   (env RDR_ROOT, CHROME)
//   node qa/pixel-freeze.mjs compare <dirA> <dirB>
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const W = 456, H = 257, VIEWS = ['home', 'metro', 'florida', 'regional'], SCALES = [1, 2];
const [mode, a, b] = process.argv.slice(2);

if (mode === 'compare') {
  const A = JSON.parse(fs.readFileSync(path.join(a, 'manifest.json'), 'utf8')).states;
  const B = JSON.parse(fs.readFileSync(path.join(b, 'manifest.json'), 'utf8')).states;
  const names = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const diff = names.filter(n => !A[n] || !B[n] || A[n].pixels !== B[n].pixels || A[n].state !== B[n].state);
  console.log(diff.length ? `DIFFER ${diff.length}/${names.length}: ${diff.slice(0, 12).join(' ')}` : `IDENTICAL ${names.length} states`);
  process.exit(diff.length ? 1 : 0);
}
if (mode !== 'render' || !a || !b) { console.error('usage: render <fixture> <outDir> | compare <dirA> <dirB>'); process.exit(2); }

const ROOT = path.resolve(process.env.RDR_ROOT || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
const FIXTURE = fs.readFileSync(a), OUT = path.resolve(b);
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// Installed before any page script: frozen wall clock, frozen monotonic clock, fixed randomness.
function freeze() {
  let now = 0, perf = 0;
  const RealDate = Date;
  class FrozenDate extends RealDate { constructor(...args) { if (args.length) super(...args); else super(now); } static now() { return now; } }
  window.Date = FrozenDate;
  Object.defineProperty(performance, 'now', { value: () => perf, configurable: true });
  Math.random = () => 0.5;
  window.requestAnimationFrame = () => 0;
  window.__setNow = ms => { now = ms; };
  window.__setPerf = ms => { perf = ms; };
}

// Runs in the page: applies one state, renders three times, returns hashes.
async function snap(spec) {
  const st = state, saved = window.__base || (window.__base = { frames: st.frames, warnings: st.warnings });
  st.frames = spec.noFrames ? [] : saved.frames;
  st.warnings = spec.synthetic ? window.__synth : saved.warnings;
  st.cursor = Math.min(spec.cursor, Math.max(0, st.frames.length - 1));
  st.transition = null;
  panel.dataset.radar = spec.degraded ? 'degraded' : 'live';
  __setNow(spec.now); __setPerf(spec.perf);
  st.alertRevision = (st.alertRevision || 0) + 1;
  invalidateAlertCache(); V_MOTION_CACHE.clear(); eCellCache.clear(); ePeakCache.clear();
  if (st.frames.length) deriveHome();
  const hash = async buf => [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map(x => x.toString(16).padStart(2, '0')).join('');
  const c = document.getElementById('display'), g = c.getContext('2d'), out = [];
  for (let i = 0; i < 3; i++) {
    render(spec.perf);
    out.push(await hash(g.getImageData(0, 0, c.width, c.height).data.buffer));
  }
  const meta = JSON.stringify({ ux: st.ux, alertUi: st.alertUi, dataset: { ...panel.dataset } });
  return { pixels: out[2], stable: out[1] === out[2], state: await hash(new TextEncoder().encode(meta)),
    cover: { frames: st.frames.length, lightning: st.ux.lightningSymbols || 0, motion: st.ux.motionArrows || 0, cities: st.ux.cityLabels || 0, warnings: st.ux.warningLabels || 0 },
    png: c.toDataURL('image/png') };
}

// Synthetic alerts: SVR and ADV boxes from vnext-qa.yml plus a tornado warning at HOME.
function makeSynthetic(t0) {
  const box = (w, s, e, n) => ({ type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] });
  const exp = new Date(t0 + 2700000).toISOString(), h = CFG.home;
  window.__synth = new Map([
    ['qa-svr', { type: 'Feature', properties: { cap_id: 'qa-svr', prod_type: 'Severe Thunderstorm Warning', phenom: 'SV', sig: 'W', expiration: exp }, geometry: box(-82.2, 27.6, -81.6, 28.2) }],
    ['qa-adv', { type: 'Feature', properties: { cap_id: 'qa-adv', prod_type: 'Heat Advisory', phenom: 'HT', sig: 'Y', expiration: exp }, geometry: box(-80.35, 25.9, -80.1, 26.2) }],
    ['qa-tor', { type: 'Feature', properties: { cap_id: 'qa-tor', prod_type: 'Tornado Warning', phenom: 'TO', sig: 'W', expiration: exp }, geometry: box(h.lon - 0.08, h.lat - 0.06, h.lon + 0.08, h.lat + 0.06) }]
  ]);
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text', '--lang=en-US'] });
const manifest = { fixture: crypto.createHash('sha256').update(FIXTURE).digest('hex'), chromium: await browser.version(), coverage: {}, states: {} };
let failed = false;
try {
  for (const scale of SCALES) for (const view of VIEWS) {
    const page = await browser.newPage(), errs = [];
    page.on('pageerror', e => errs.push('pageerror ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text()); });
    await page.emulateTimezone('America/New_York');
    await page.setViewport({ width: W, height: H, deviceScaleFactor: scale });
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith(base + 'qa/fixture.json')) return r.respond({ status: 200, contentType: 'application/json', body: FIXTURE });
      if (u.startsWith(base)) return r.continue();
      errs.push('external request ' + u); r.abort();
    });
    await page.evaluateOnNewDocument(freeze);
    await page.goto(`${base}qa/replay.html?view=${view}`);
    await page.waitForFunction(() => window.__QA__ && 'ready' in window.__QA__, { timeout: 120000 });
    const ready = await page.evaluate(() => window.__QA__.ready === true);
    if (!ready) { errs.push('replay not ready: ' + await page.evaluate(() => window.__QA__.error)); }
    const { t0, n } = await page.evaluate(() => ({ t0: state.frames.length ? state.frames[state.frames.length - 1].time.getTime() + 120000 : 0, n: state.frames.length }));
    await page.evaluate(makeSynthetic, t0);
    const specs = [];
    for (const [cn, cursor] of [['c0', 0], ['cmid', Math.floor(n / 2)], ['clast', n - 1]])
      for (const [kn, now, perf] of [['k0', t0, 1000], ['k6', t0 + 6000, 1750]])
        for (const [an, synthetic] of [['rec', false], ['syn', true]]) specs.push([`${cn}-${kn}-${an}`, { cursor, now, perf, synthetic }]);
    specs.push(['stale', { cursor: n - 1, now: t0 + 3 * 3600000, perf: 1000 }]);
    specs.push(['noframes', { cursor: 0, now: t0, perf: 1000, noFrames: true }]);
    specs.push(['degraded', { cursor: n - 1, now: t0, perf: 1000, degraded: true }]);
    const cov = { frames: 0, lightning: 0, motion: 0, cities: 0, warnings: 0 };
    for (const [name, spec] of specs) {
      const r = await page.evaluate(snap, spec), key = `${view}@${scale}x-${name}`;
      if (!r.stable) errs.push(`unstable render ${key}`);
      for (const k of Object.keys(cov)) cov[k] = Math.max(cov[k], r.cover[k]);
      manifest.states[key] = { pixels: r.pixels, state: r.state };
      fs.writeFileSync(path.join(OUT, key + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    }
    manifest.coverage[`${view}@${scale}x`] = cov;
    if (errs.length) { failed = true; console.log(`FAIL ${view}@${scale}x ${[...new Set(errs)].slice(0, 3).join(' | ')}`); }
    await page.close();
  }
} finally { await browser.close(); server.close(); }
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`${failed ? 'FAILED' : 'rendered'} ${Object.keys(manifest.states).length} states -> ${OUT}`);
for (const [k, v] of Object.entries(manifest.coverage)) console.log('coverage', k, JSON.stringify(v));
process.exit(failed ? 1 : 0);
