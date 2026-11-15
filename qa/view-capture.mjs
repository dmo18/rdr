// Four-view capture and layout harness. See qa/README.md.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Checks listed here are reported as "KNOWN-FAIL <name>" and do not affect the exit code.
// Task 5 (stuck on "loading") deletes this entry.
const KNOWN_FAILING = [];

const W = 456, H = 257, FRAME_MS = 500; // FRAME_MS mirrors CFG.radarFrameMs in core.js
const VIEWS = ['home', 'metro', 'florida', 'regional'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.env.RDR_OUT || path.join(ROOT, 'qa/out/view-capture'));
const SCALE = Number(process.env.RDR_SCALE) || 1;
const STRIP_FRAMES = 6;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
async function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

// Runs in the page: collects layout violations on CSS pixels.
function layoutProbe(w, h) {
  const bad = [];
  for (const el of document.querySelectorAll('body, body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.left < -0.5 || r.top < -0.5 || r.right > w + 0.5 || r.bottom > h + 0.5) {
      const name = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
      bad.push(`${name}[${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
    }
  }
  const c = document.getElementById('display'), cr = c && c.getBoundingClientRect();
  return {
    inner: [window.innerWidth, window.innerHeight],
    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    canvas: cr ? [Math.round(cr.width * 100) / 100, Math.round(cr.height * 100) / 100] : null,
    bad,
    surface: document.getElementById('panel').dataset.surface,
  };
}

async function captureView(browser, base, id) {
  const reasons = [], known = [];
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 140)); });
  await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
  try {
    await page.goto(`${base}?view=${id}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => { const p = document.getElementById('panel'); return p && p.dataset.ready === 'true' && p.dataset.radar === 'live'; }, { timeout: 120000, polling: 250 });
  } catch (e) {
    reasons.push('never ready/live: ' + e.message.split('\n')[0]);
  }
  if (!reasons.length) {
    const info = await page.evaluate(() => { const p = document.getElementById('panel'); return { loop: p.dataset.loop, n: Number(p.dataset.observedFrames) || 0 }; });
    const n = Math.max(info.n, STRIP_FRAMES);
    const step = Math.max(1, Math.round(n / STRIP_FRAMES)) * FRAME_MS;
    const frames = [];
    for (let k = 0; k < STRIP_FRAMES; k++) {
      const f = path.join(OUT, `${id}-f${k}.png`);
      await page.screenshot({ path: f });
      frames.push(f);
      await sleep(step);
    }
    // One full loop (n * FRAME_MS) has elapsed across the strip captures.
    await page.screenshot({ path: path.join(OUT, `${id}.png`) });
    // Frame strip, combined in an offscreen canvas.
    const sp = await browser.newPage();
    const b64 = frames.map(f => fs.readFileSync(f).toString('base64'));
    const dataUrl = await sp.evaluate(async list => {
      const imgs = await Promise.all(list.map(b => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'data:image/png;base64,' + b; })));
      const c = document.createElement('canvas'); c.width = imgs[0].width * imgs.length; c.height = imgs[0].height;
      const x = c.getContext('2d'); imgs.forEach((i, k) => x.drawImage(i, k * i.width, 0));
      return c.toDataURL('image/png');
    }, b64);
    fs.writeFileSync(path.join(OUT, `${id}-strip.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    await sp.close();
    for (const f of frames) fs.unlinkSync(f);

    const r = await page.evaluate(layoutProbe, W, H);
    if (r.inner[0] !== W || r.inner[1] !== H) reasons.push(`viewport ${r.inner.join('x')}`);
    if (r.scroll[0] > W || r.scroll[1] > H) reasons.push(`scroll ${r.scroll.join('x')}`);
    if (r.bad.length) reasons.push(`outside viewport: ${r.bad.slice(0, 5).join(' ')}${r.bad.length > 5 ? ` (+${r.bad.length - 5})` : ''}`);
    if (!r.canvas || Math.abs(r.canvas[0] - W) > 0.5 || Math.abs(r.canvas[1] - H) > 0.5) reasons.push(`canvas css ${r.canvas ? r.canvas.join('x') : 'missing'}`);
    if (r.surface === 'loading') (KNOWN_FAILING.includes('surface') ? known : reasons).push('surface still loading');
  }
  if (errors.length) reasons.push(`errors(${errors.length}): ${[...new Set(errors)].slice(0, 3).join(' | ')}`);
  await page.close();
  return { id, reasons, known };
}

fs.mkdirSync(OUT, { recursive: true });
let srv = null, base = process.env.RDR_URL || 'http://127.0.0.1:8765/';
if (!process.env.RDR_URL) { srv = await startServer(); base = srv.url; }
const args = ['--no-sandbox', '--disable-gpu'];
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
if (proxy) args.push(`--proxy-server=${proxy}`, '--proxy-bypass-list=127.0.0.1;localhost', '--ignore-certificate-errors');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME, headless: true, args });
let failed = false;
try {
  for (const id of VIEWS) {
    const r = await captureView(browser, base, id);
    if (r.reasons.length) failed = true;
    const parts = [...r.reasons, ...r.known.map(k => 'KNOWN-FAIL ' + k.replace(' still loading', ''))];
    console.log(`${r.reasons.length ? 'FAIL' : 'PASS'} ${id}${parts.length ? ' ' + parts.join('; ') : ''}`);
  }
} finally {
  await browser.close();
  if (srv) srv.server.close();
}
console.log(`screenshots: ${OUT}`);
process.exit(failed ? 1 : 0);
