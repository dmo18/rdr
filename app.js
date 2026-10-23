'use strict';

function detectLowPower() {
  const hc = Number(navigator.hardwareConcurrency) || 0,
    dm = Number(navigator.deviceMemory) || 0,
    ua = String(navigator.userAgent || '').toLowerCase();
  return query.has('yodeck') || hc > 0 && hc <= 4 || dm > 0 && dm <= 4 || ua.includes('armv') || ua.includes('raspberry');
}
state.runtime = state.runtime || {};
state.runtime.lowPower = detectLowPower();
if (navigator.deviceMemory && navigator.deviceMemory <= 1) CFG.radarObservedFrames = 20;
function showView(index) {
  const next = (index + CFG.views.length) % CFG.views.length, def = CFG.views[next];
  // Never expose a context-free view while geography is still downloading.
  if (!state.boundaries.has(def.id)) return false;
  state.view = next;
  state.viewStarted = performance.now();
  panel.dataset.view = def.id;
  state.cursor = 0;
  state.transition = null;
  render();
  return true;
}
function scheduleRotation() {
  state.viewStarted = performance.now();
  // Rotation is driven by loop completion, never an unrelated wall clock timer.
}
function advanceRadarFrame() {
  if (state.runtime.stopped) return;
  const n = state.frames.length;
  const from = clamp(state.cursor, 0, Math.max(0, n - 1)), to = n > 1 ? (from + 1) % n : 0;
  const wrapped = n < 2 || to === 0;
  if (!forcedView && wrapped && performance.now() - state.viewStarted >= view().duration) {
    if (showView(state.view + 1)) return;
  }
  state.cursor = to;
  if (state.runtime.lowPower || wrapped || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.transition = null;
    render(performance.now());
  } else state.transition = {from, to, start: performance.now()};
  // Build only the next raster, outside the visible paint. Caches are byte capped.
  clearTimeout(state.warmTimer);
  state.warmTimer = setTimeout(() => {
    if (!state.runtime.stopped && state.frames.length) eRadarCanvas(state.frames[(state.cursor + 1) % state.frames.length]);
  }, 30);
}
function paintLoop(now) {
  if (state.runtime.lowPower) return;
  if (now - state.lastPaint >= 1000 / CFG.animFps) {
    state.lastPaint = now;
    render(now);
  }
  state.raf = requestAnimationFrame(paintLoop);
}
function startAnimation() {
  clearTimeout(state.animTimer);
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
  state.lastPaint = 0;
  const tick = () => {
    if (state.runtime.stopped) return;
    advanceRadarFrame();
    state.animTimer = setTimeout(tick, CFG.radarFrameMs);
  };
  state.animTimer = setTimeout(tick, CFG.radarFrameMs);
  if (!state.runtime.lowPower) state.raf = requestAnimationFrame(paintLoop);
}
function startPolling() {
  state.pollStops = [];
  const repeat = (task, interval) => {
    let timer, running = false, failures = 0;
    const run = async () => {
      if (state.runtime.stopped || running) return;
      running = true;
      try { await task(); failures = 0; }
      catch (error) { failures = Math.min(failures + 1, 3); state.errors.push(String(error)); }
      finally {
        running = false;
        if (!state.runtime.stopped) timer = setTimeout(run, Math.min(interval * Math.pow(2, failures), 600000));
      }
    };
    timer = setTimeout(run, interval);
    state.pollStops.push(() => clearTimeout(timer));
  };
  repeat(() => pollRadar(), CFG.pollMs);
  repeat(() => refreshVectors(), CFG.vectorMs);
  repeat(() => loadSevere(), CFG.severeMs);
}
addEventListener('pagehide', () => {
  state.runtime.stopped = true;
  ['animTimer', 'warmTimer', 'radarRetryTimer', 'radarBackfillRetryTimer', 'radarBackfillStartTimer', 'prefetchTimer', 'severeStartTimer'].forEach(key => clearTimeout(state[key]));
  if (state.raf) cancelAnimationFrame(state.raf);
  (state.pollStops || []).forEach(stop => stop());
});
addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
async function deferredSevere() {
  if (verifyMode) return;
  let waits = 0;
  while (!state.runtime.stopped && state.radarBackfilling && waits < 12) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    waits++;
  }
  if (!state.runtime.stopped) loadSevere().catch(e => state.errors.push(String(e)));
}
async function init() {
  fitPanel();
  addEventListener('resize', fitPanel, {
    passive: true
  });
  if (forcedView) {
    const i = CFG.views.findIndex(v => v.id === forcedView);
    if (i >= 0) state.view = i;
  }
  panel.dataset.view = view().id;
  render();
  const boundaryPromise = loadBoundaries(view()).catch(e => state.errors.push(`boundaries: ${e}`)),
    surfacePromise = loadSurfaceObs(view()).catch(e => state.errors.push(`surface: ${e}`)),
    radarPromise = pollRadar({
      initial: true
    }).catch(e => state.errors.push(String(e))),
    enrichmentPromise = Promise.allSettled([surfacePromise, loadWarnings(), loadTropics(), loadWeather()]);
  await Promise.allSettled([boundaryPromise, radarPromise]);
  if (state.runtime.stopped) return;
  if (!state.frames.length) {
    panel.dataset.radar = 'unavailable';
    panel.dataset.freshness = 'stale';
    state.home.status = 'UNAVAILABLE';
  } else {
    panel.dataset.radar = state.lastListError || freshness() === 'stale' ? 'degraded' : 'live';
    panel.dataset.freshness = freshness();
    state.cursor = Math.max(0, state.frames.length - 1);
    deriveHome();
    state.startupPrepMs = typeof eWarmCurrentView === 'function' && !state.runtime.lowPower ? eWarmCurrentView() : null;
  }
  panel.dataset.ready = 'true';
  panel.dataset.runtime = state.runtime.lowPower ? 'low-power' : 'standard';
  boot.classList.add('off');
  window.__RDR__ = state;
  render();
  startAnimation();
  scheduleRotation();
  startPolling();
  enrichmentPromise.then(() => render());
  state.severeStartTimer = setTimeout(() => deferredSevere(), 5000);
  state.prefetchTimer = setTimeout(async () => {
    for (const def of CFG.views) {
      if (state.runtime.stopped) return;
      if (def.id !== view().id) {
        await loadBoundaries(def).catch(e => state.errors.push(`prefetch ${def.id}: ${e}`));
        await loadSurfaceObs(def).catch(e => state.errors.push(`surface ${def.id}: ${e}`));
        // Prepare geography while the current view stays on screen.
        if (state.boundaries.has(def.id)) {
          eBase(def);
          await radarYield();
          eLines(def);
          await radarYield();
        }
      }
    }
  }, 1200);
}
init().catch(e => {
  state.errors.push(String(e));
  panel.dataset.ready = 'true';
  panel.dataset.radar = 'unavailable';
  panel.dataset.freshness = 'stale';
  state.home.status = 'UNAVAILABLE';
  boot.classList.add('off');
  window.__RDR__ = state;
  render();
});
