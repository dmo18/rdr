'use strict';

// Native-size office presentation. Data remains in the acquisition modules.
function rdrText(text, x, y, size = 10, color = '#edf7fb', width = 440, align = 'left') {
  const font = `700 ${size}px Arial,Helvetica,sans-serif`;
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(eFitText(String(text), width, font), x, y);
}
function rdrTime(time) {
  return time ? new Date(time).toLocaleTimeString('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true}) : '--:--';
}
vHeader = function () {
  const w = state.weather || {}, shown = displayedFrame(), fresh = freshness();
  const age = Number.isFinite(ageMs()) ? `${Math.max(0, Math.round(ageMs() / 60000))}m old` : 'NO SCAN';
  ctx.fillStyle = '#030e15';
  ctx.fillRect(0, 0, CFG.width, E_MAP_TOP);
  ctx.fillStyle = '#40c8ec'; ctx.fillRect(0, 0, 3, E_MAP_TOP);
  rdrText(view().name, 8, 11, 11, '#e6f8ff', 215);
  const wind = w.windDir && w.windMph != null ? `${w.windDir} ${w.windMph}mph` : 'WIND --';
  const pop = w.forecast && Number.isFinite(w.forecast.pop) ? `1h rain ${Math.round(w.forecast.pop)}%` : '';
  rdrText(`${w.temp != null ? w.temp + '°' : '--°'}  ${wind}  ${pop}`, 449, 11, 10, '#edf7fb', 225, 'right');
  rdrText(`${rdrTime(shown && shown.time)} ET  ·  ${state.frames.length ? state.cursor + 1 : 0}/${state.frames.length}`, 8, 30, 10, '#bfe8f7', 220);
  const label = panel.dataset.radar === 'degraded' ? 'UPDATE FAILED' : fresh.toUpperCase();
  rdrText(`${label} · newest ${age}`, 449, 30, 9, fresh === 'live' && label !== 'UPDATE FAILED' ? '#6be9a5' : '#ffcf70', 225, 'right');
};
vFooter = function () {
  ctx.fillStyle = '#030e15'; ctx.fillRect(0, E_FOOT_TOP, CFG.width, CFG.height - E_FOOT_TOP);
  const home = vHomeText(), hazard = vHazardText(), frames = state.frames;
  const status = frames.length ? home.main : 'UNAVAILABLE';
  const sub = frames.length ? home.sub : 'Waiting for observed radar';
  rdrText(`HOME NOW: ${status}`, 8, 220, 11, status === 'DRY' ? '#8de3fc' : '#ffe17e', 130);
  rdrText(sub.replace(/\s+•\s+/g, ' · ').replace('LTG ', 'LTG RISK '), 145, 220, 9, '#e2eef3', 303);
  // Keep active alerts readable; alternate full detail rather than micro-print.
  const sum = vAlertSummary(), phase = Math.floor(Date.now() / 6000) % 2;
  let detail = hazard.main === 'NONE' ? 'No active warnings in this view' : `${hazard.main} · ${hazard.sub}`;
  const ux = rdrCopyState();
  ux.alertFooterHeadline = '';
  if (sum) {
    ux.alertFooterHeadline = `${sum.local ? 'HOME · ' : ''}${sum.typedLabel} · ${rdrAlertDisplayName(sum.meta)}`;
    detail = phase === 0 ? ux.alertFooterHeadline : [sum.place || 'IN VIEW', sum.expires ? `Until ${sum.expires}` : '', sum.otherCount ? `${sum.otherCount} other alerts` : ''].filter(Boolean).join(' · ');
  }
  ux.alertFooterText = detail;
  rdrText(detail, 8, 235, 10, hazard.accent || '#cee5ee', 440);
  const first = frames.length ? frames[0].time : null, last = frames.length ? frames[frames.length - 1].time : null;
  const span = first && last ? Math.round((last - first) / 60000) : 0;
  rdrText(`${span} min history`, 8, 250, 8, '#a4c9d8', 104);
  rdrText(`${rdrTime(first)}–${rdrTime(last)} ET`, 449, 250, 8, '#a4c9d8', 165, 'right');
  const x0 = 116, width = 155, n = frames.length;
  ctx.fillStyle = '#315364'; ctx.fillRect(x0, 249, width, 2);
  if (n) {ctx.fillStyle = '#7fe1ff';ctx.fillRect(x0, 249, n > 1 ? width * state.cursor / (n - 1) : width, 2);}
};
eHeader = vHeader;
eFooter = vFooter;

// Alert times use the same office timezone as scan times.
vExpiry = function (feature) {
  const p = feature.properties || {}, time = new Date(p.ends || p.expiration || '');
  return Number.isFinite(time.getTime()) ? rdrTime(time) + ' ET' : '';
};

// Static vector paths are expensive on the Pi. Repaint only after the actual
// source/view/backing changes, retaining exact warning geometry and expiration.
const rdrVectorCache = new Map();
function rdrVectorLayer(kind, source, draw) {
  const key = `${kind}|${view().id}|${rdrBackingKey()}`;
  let cached = rdrVectorCache.get(key);
  if (!cached || cached.source !== source) {
    const layer = rdrLayerCanvas(true);
    draw(layer.x);
    cached = {source, canvas: layer.c, count: kind === 'warnings' && state.alertUi ? state.alertUi.boundaries : 0};
    rdrVectorCache.set(key, cached);
    const cap = Math.max(1, Math.floor(8 * 1024 * 1024 / (canvas.width * canvas.height * 4)));
    while (rdrVectorCache.size > cap) rdrVectorCache.delete(rdrVectorCache.keys().next().value);
  }
  if (kind === 'warnings' && state.alertUi) state.alertUi.boundaries = cached.count;
  ctx.drawImage(cached.canvas, 0, 0, CFG.width, CFG.height);
}
const rdrDrawWarnings = eDrawWarnings, rdrDrawTropics = eDrawTropics;
eDrawWarnings = function () { rdrVectorLayer('warnings', eWarningsInView(), rdrDrawWarnings); };
eDrawTropics = function () { rdrVectorLayer('tropics', state.tropics, rdrDrawTropics); };
