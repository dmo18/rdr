'use strict';

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const sm16 = n => n & 0x8000 ? -(n & 0x7fff) : n & 0x7fff;
const sm32 = n => n & 0x80000000 ? -(n & 0x7fffffff) : n & 0x7fffffff;
const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};
const radarYield = () => new Promise(resolve => setTimeout(resolve, 0));
function parseGrib(ab) {
  const d = new DataView(ab),
    u = new Uint8Array(ab),
    u32 = o => d.getUint32(o, false),
    u16 = o => d.getUint16(o, false);
  if (String.fromCharCode(...u.subarray(0, 4)) !== 'GRIB') throw new Error('invalid GRIB2');
  let o = 16,
    s = {};
  while (o < u.length - 4) {
    if (u[o] === 55 && u[o + 1] === 55 && u[o + 2] === 55 && u[o + 3] === 55) break;
    const len = u32(o),
      num = d.getUint8(o + 4);
    if (!len || o + len > u.length) throw new Error('invalid GRIB section');
    s[num] = {
      o,
      len
    };
    o += len;
  }
  const a = s[1],
    g = s[3],
    r = s[5],
    z = s[7];
  if (!a || !g || !r || !z) throw new Error('incomplete GRIB2');
  const template = u16(r.o + 9);
  if (template !== 41) throw new Error(`unsupported GRIB packing ${template}`);
  const png = u.slice(z.o + 5, z.o + z.len),
    pd = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (pd.getUint32(0, false) !== 0x89504e47) throw new Error('missing PNG payload');
  const meta = {
    nx: u32(g.o + 30),
    ny: u32(g.o + 34),
    la1: sm32(u32(g.o + 46)) / 1e6,
    lo1: sm32(u32(g.o + 50)) / 1e6,
    dx: u32(g.o + 63) / 1e6,
    dy: u32(g.o + 67) / 1e6,
    scan: d.getUint8(g.o + 71),
    R: d.getFloat32(r.o + 11, false),
    E: sm16(u16(r.o + 15)),
    D: sm16(u16(r.o + 17)),
    bits: d.getUint8(r.o + 19),
    ref: new Date(Date.UTC(d.getUint16(a.o + 12, false), d.getUint8(a.o + 14) - 1, d.getUint8(a.o + 15), d.getUint8(a.o + 16), d.getUint8(a.o + 17), d.getUint8(a.o + 18))),
    png,
    width: pd.getUint32(16, false),
    height: pd.getUint32(20, false),
    bitDepth: png[24],
    colorType: png[25],
    interlace: png[28]
  };
  const pngPacking = meta.colorType === 0 && meta.bitDepth === meta.bits && [8, 16].includes(meta.bits) || meta.colorType === 2 && meta.bitDepth === 8 && meta.bits === 24 || meta.colorType === 6 && meta.bitDepth === 8 && meta.bits === 32;
  if (meta.interlace !== 0 || !pngPacking) throw new Error(`unsupported PNG ${meta.bitDepth}/${meta.colorType}/${meta.interlace} for ${meta.bits}-bit GRIB`);
  if (meta.width !== meta.nx || meta.height !== meta.ny) throw new Error('grid PNG mismatch');
  return meta;
}
function makeSamplers(meta, defs = CFG.views) {
  return defs.map(def => {
    const x0 = new Int32Array(CFG.width),
      x1 = new Int32Array(CFG.width),
      xf = new Float32Array(CFG.width),
      buckets = new Map();
    for (let x = 0; x < CFG.width; x++) {
      const lon = def.bbox[0] + x / (CFG.width - 1) * (def.bbox[2] - def.bbox[0]),
        sx = (lon360(lon) - meta.lo1) / meta.dx;
      if (sx < 0 || sx > meta.nx - 1) {
        x0[x] = x1[x] = -1;
        continue;
      }
      x0[x] = Math.floor(sx);
      x1[x] = Math.min(meta.nx - 1, x0[x] + 1);
      xf[x] = sx - x0[x];
    }
    for (let y = 0; y < CFG.mapHeight; y++) {
      const lat = def.bbox[3] - y / (CFG.mapHeight - 1) * (def.bbox[3] - def.bbox[1]),
        sy = (meta.la1 - lat) / meta.dy;
      if (sy < 0 || sy > meta.ny - 1) continue;
      const y0 = Math.floor(sy),
        y1 = Math.min(meta.ny - 1, y0 + 1),
        yf = sy - y0;
      if (!buckets.has(y1)) buckets.set(y1, []);
      buckets.get(y1).push({
        target: y,
        y0,
        yf
      });
    }
    const data = new Int16Array(CFG.width * CFG.mapHeight);
    data.fill(MISSING);
    return {
      def,
      x0,
      x1,
      xf,
      buckets,
      data
    };
  });
}
function valueFromX(x, m) {
  return (m.R + x * 2 ** m.E) * 10 ** -m.D;
}
function sampleValue(v, kind) {
  if (!Number.isFinite(v) || v <= -900) return null;
  if (kind === 'radar' && v <= -90) return 0;
  return v;
}
function interpolated(a, b, t) {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  return a + (b - a) * t;
}
function normalizedValue(v, kind) {
  if (!Number.isFinite(v) || v <= -900) return MISSING;
  if (kind === 'radar' && v <= -90) return 0;
  return clamp(Math.round(v * 10), -32767, 32767);
}
async function decodePngToViews(meta, kind = 'radar') {
  const png = meta.png,
    pd = new DataView(png.buffer, png.byteOffset, png.byteLength),
    chunks = [];
  let o = 8;
  while (o < png.length) {
    const n = pd.getUint32(o, false),
      type = String.fromCharCode(...png.subarray(o + 4, o + 8));
    if (type === 'IDAT') chunks.push(png.slice(o + 8, o + 8 + n));
    o += 12 + n;
    if (type === 'IEND') break;
  }
  const total = chunks.reduce((a, b) => a + b.length, 0),
    packed = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    packed.set(c, at);
    at += c.length;
  }
  const raw = new Uint8Array(await inflate(packed, 'deflate')),
    bpp = meta.bits === 24 ? 3 : meta.bits === 32 ? 4 : meta.bitDepth / 8,
    stride = meta.nx * bpp;
  const row = new Uint8Array(stride),
    prev = new Uint8Array(stride),
    samplers = makeSamplers(meta);
  let pos = 0;
  const readBuf = (buf, i) => {
    if (meta.bits === 16) return buf[i * 2] << 8 | buf[i * 2 + 1];
    if (meta.bits === 24) {
      const o = i * 3;
      return buf[o] * 65536 + buf[o + 1] * 256 + buf[o + 2];
    }
    if (meta.bits === 32) {
      const o = i * 4;
      return buf[o] * 16777216 + buf[o + 1] * 65536 + buf[o + 2] * 256 + buf[o + 3];
    }
    return buf[i];
  };
  const yieldEvery = state.runtime && state.runtime.lowPower ? 48 : 192;
  for (let sy = 0; sy < meta.ny; sy++) {
    const filter = raw[pos++];
    for (let i = 0; i < stride; i++) {
      const rb = raw[pos++],
        a = i >= bpp ? row[i - bpp] : 0,
        b = prev[i],
        c = i >= bpp ? prev[i - bpp] : 0;
      row[i] = rb + (filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : filter === 4 ? paeth(a, b, c) : 0) & 255;
    }
    for (const s of samplers) {
      const tasks = s.buckets.get(sy);
      if (!tasks) continue;
      for (const task of tasks) {
        const base = task.target * CFG.width;
        for (let x = 0; x < CFG.width; x++) {
          const ix0 = s.x0[x];
          if (ix0 < 0) continue;
          const ix1 = s.x1[x],
            fx = s.xf[x];
          const topRow = task.y0 === sy ? row : prev;
          const a0 = valueFromX(readBuf(topRow, ix0), meta),
            a1 = valueFromX(readBuf(topRow, ix1), meta),
            b0 = valueFromX(readBuf(row, ix0), meta),
            b1 = valueFromX(readBuf(row, ix1), meta);
          const top = interpolated(sampleValue(a0, kind), sampleValue(a1, kind), fx),
            bottom = interpolated(sampleValue(b0, kind), sampleValue(b1, kind), fx),
            v = interpolated(top, bottom, task.yf);
          s.data[base + x] = normalizedValue(v, kind);
        }
      }
    }
    prev.set(row);
    if (sy > 0 && sy % yieldEvery === 0) await radarYield();
  }
  const views = Object.fromEntries(samplers.map(s => [s.def.id, s.data]));
  return views;
}
async function loadFieldKey(key, kind = 'radar') {
  const bytes = await fetchWithTimeout(`${CFG.mrmsBucket}/${key}`, {
    cache: 'no-store'
  }, 30000, r => r.arrayBuffer());
  const grib = await inflate(bytes, 'gzip');
  const meta = parseGrib(grib);
  const views = await decodePngToViews(meta, kind);
  return {
    key,
    time: meta.ref,
    views,
    meta
  };
}
function classifyDbz(v) {
  return v < 5 ? 'DRY' : v < 20 ? 'LIGHT' : v < 35 ? 'RAIN' : v < 50 ? 'HEAVY' : 'INTENSE';
}
function sampleHome(frame) {
  const def = CFG.views[0],
    p = mapXY(CFG.home.lat, CFG.home.lon, def),
    cx = Math.round(p.x),
    cy = Math.round(p.y - CFG.top),
    a = frame.views.home;
  let best = 0;
  for (let y = Math.max(0, cy - 3); y <= Math.min(CFG.mapHeight - 1, cy + 3); y++) for (let x = Math.max(0, cx - 3); x <= Math.min(CFG.width - 1, cx + 3); x++) {
    const q = a[y * CFG.width + x];
    if (q !== MISSING) best = Math.max(best, q / 10);
  }
  return best;
}
function nearestRain(frame) {
  let best = null,
    bestD2 = Infinity;
  for (const id of ['home', 'metro']) {
    const def = CFG.views.find(v => v.id === id),
      a = frame.views[id],
      step = id === 'home' ? 1 : 2;
    for (let y = 0; y < CFG.mapHeight; y += step) for (let x = 0; x < CFG.width; x += step) {
      const q = a[y * CFG.width + x];
      if (q === MISSING || q < 100) continue;
      const p = pixelLatLon(x, y, def),
        dy = (p.lat - CFG.home.lat) * 69,
        dx = (p.lon - CFG.home.lon) * 62.3,
        d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = {
          lat: p.lat,
          lon: p.lon,
          dbz: q / 10
        };
      }
    }
    if (best) break;
  }
  if (!best) return null;
  const miles = haversineMiles(CFG.home, best),
    brg = bearing(CFG.home, best);
  return _objectSpread(_objectSpread({}, best), {}, {
    miles,
    dir: dir8(brg),
    bearing: brg
  });
}
function centroid(frame, id = 'metro', threshold = 20) {
  const def = CFG.views.find(v => v.id === id),
    a = frame.views[id];
  let sw = 0,
    slat = 0,
    slon = 0,
    count = 0;
  for (let y = 0; y < CFG.mapHeight; y += 2) for (let x = 0; x < CFG.width; x += 2) {
    const q = a[y * CFG.width + x];
    if (q === MISSING || q < threshold * 10) continue;
    const p = pixelLatLon(x, y, def),
      w = Math.max(1, q / 10 - threshold + 1);
    sw += w;
    slat += p.lat * w;
    slon += p.lon * w;
    count++;
  }
  return count > 8 ? {
    lat: slat / sw,
    lon: slon / sw,
    count
  } : null;
}
function localCentroid(frame, center, radius = 65, threshold = 18) {
  if (!frame || !center) return null;
  const def = CFG.views.find(v => v.id === 'metro'),
    a = frame.views.metro;
  let sw = 0,
    slat = 0,
    slon = 0,
    count = 0;
  for (let y = 0; y < CFG.mapHeight; y += 2) for (let x = 0; x < CFG.width; x += 2) {
    const q = a[y * CFG.width + x];
    if (q === MISSING || q < threshold * 10) continue;
    const p = pixelLatLon(x, y, def),
      dy = (p.lat - center.lat) * 69,
      dx = (p.lon - center.lon) * 62.3;
    if (dx * dx + dy * dy > radius * radius) continue;
    const w = Math.max(1, q / 10 - threshold + 1);
    sw += w;
    slat += p.lat * w;
    slon += p.lon * w;
    count++;
  }
  return count > 5 ? {
    lat: slat / sw,
    lon: slon / sw,
    count
  } : null;
}
function deriveMotionBetween(a, b, nearest = null) {
  if (!a || !b) return null;
  let ca = null,
    cb = null;
  if (nearest) {
    ca = localCentroid(a, nearest);
    cb = localCentroid(b, nearest);
  }
  if (!ca || !cb) {
    ca = centroid(a);
    cb = centroid(b);
  }
  if (!ca || !cb) return null;
  const hours = (b.time - a.time) / 3600000;
  if (hours <= 0) return null;
  const miles = haversineMiles(ca, cb),
    mph = miles / hours;
  if (mph < 2 || mph > 90) return null;
  const brg = bearing(ca, cb);
  return {
    from: ca,
    to: cb,
    mph: Math.round(mph),
    bearing: brg,
    dir: dir8(brg)
  };
}
function deriveMotion(nearest = null) {
  if (state.frames.length < 2) return null;
  return deriveMotionBetween(state.frames[state.frames.length - 2], state.frames[state.frames.length - 1], nearest);
}
function destination(point, miles, heading) {
  const angular = miles / 3958.7613,
    brg = heading * Math.PI / 180,
    lat = point.lat * Math.PI / 180,
    lon = point.lon * Math.PI / 180,
    outLat = Math.asin(Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(brg)),
    outLon = lon + Math.atan2(Math.sin(brg) * Math.sin(angular) * Math.cos(lat), Math.cos(angular) - Math.sin(lat) * Math.sin(outLat));
  return {
    lat: outLat * 180 / Math.PI,
    lon: (outLon * 180 / Math.PI + 540) % 360 - 180
  };
}
function deriveMotionOverlay(nearest, motion) {
  const frames = state.frames,
    latest = frames.length ? frames[frames.length - 1] : null,
    base = {
      kind: 'extrapolated',
      minutes: CFG.motionExtrapolationMinutes,
      confidence: 0,
      suppressed: true,
      reason: 'awaiting-observed-frames'
    };
  if (!latest || freshness() === 'stale' || ageMs() > CFG.motionMaxAgeMs) return _objectSpread(_objectSpread({}, base), {}, {
    reason: 'stale-observation'
  });
  if (frames.length < 3) return base;
  if (!motion || !Number.isFinite(motion.mph) || !Number.isFinite(motion.bearing)) return _objectSpread(_objectSpread({}, base), {}, {
    reason: 'no-coherent-motion'
  });
  const older = frames[frames.length - 3],
    middle = frames[frames.length - 2],
    previous = deriveMotionBetween(older, middle, nearest),
    gapA = middle.time - older.time,
    gapB = latest.time - middle.time,
    cadence = gapA >= 120000 && gapA <= 900000 && gapB >= 120000 && gapB <= 900000,
    directionStable = previous && angleDiff(previous.bearing, motion.bearing) <= 45,
    speedStable = previous && Math.abs(previous.mph - motion.mph) <= Math.max(12, motion.mph * .65);
  let confidence = .5;
  if (cadence) confidence += .2;
  if (directionStable) confidence += .18;
  if (speedStable) confidence += .12;
  confidence = Math.round(clamp(confidence, 0, 1) * 100);
  if (!cadence || !directionStable || confidence < 75) return _objectSpread(_objectSpread({}, base), {}, {
    confidence,
    reason: 'low-confidence-motion'
  });
  const miles = motion.mph * CFG.motionExtrapolationMinutes / 60;
  return {
    kind: 'extrapolated',
    minutes: CFG.motionExtrapolationMinutes,
    confidence,
    suppressed: false,
    reason: null,
    observedTime: latest.time,
    from: motion.to,
    to: destination(motion.to, miles, motion.bearing),
    bearing: motion.bearing,
    mph: motion.mph
  };
}
function motionConfidenceLabel(confidence) {
  const n = Number(confidence) || 0;
  return n >= 85 ? 'HIGH' : n >= 75 ? 'MEDIUM' : 'LOW';
}
function deriveHome() {
  const f = state.frames.length ? state.frames[state.frames.length - 1] : null;
  if (!f) return;
  const dbz = sampleHome(f),
    nearest = dbz < 5 ? nearestRain(f) : null,
    motion = deriveMotion(nearest);
  state.motion = motion;
  state.motionOverlay = deriveMotionOverlay(nearest, motion);
  let eta = null;
  if (motion && nearest && state.motionOverlay && !state.motionOverlay.suppressed) {
    const toward = bearing(nearest, CFG.home),
      diff = angleDiff(motion.bearing, toward),
      closing = motion.mph * Math.cos(diff * Math.PI / 180),
      mins = nearest.miles / Math.max(1, closing) * 60;
    if (diff < 55 && closing > 3 && nearest.miles < 150 && mins > 0 && mins < 180) eta = {
      minutes: Math.max(5, Math.round(mins / 5) * 5),
      miles: nearest.miles
    };
  }
  state.home = {
    dbz,
    status: classifyDbz(dbz),
    nearest,
    eta
  };
}
function validObservedFrame(frame) {
  return !!(frame && frame.key && frame.time instanceof Date && Number.isFinite(frame.time.getTime()) && frame.views && frame.views.home && frame.views.metro);
}
function commitObservedFrame(frame) {
  if (!validObservedFrame(frame)) throw new Error('invalid observed radar frame');
  const frames = state.frames.filter(f => f.key !== frame.key);
  frames.push(frame);
  frames.sort((a, b) => a.time - b.time || (String(a.key) < String(b.key) ? -1 : String(a.key) > String(b.key) ? 1 : 0));
  state.frames = frames.slice(-CFG.radarObservedFrames);
  state.lastGoodFrames = state.frames.slice();
  panel.dataset.fallback = 'none';
  state.cursor = state.frames.length - 1;
  panel.dataset.observedFrames = String(state.frames.length);
  panel.dataset.loop = `observed-${state.frames.length}-of-${CFG.radarObservedFrames}`;
  deriveHome();
  return frame;
}
function restoreLastGoodFrames() {
  if (state.frames.length || !state.lastGoodFrames.length) return false;
  state.frames = state.lastGoodFrames.slice(-CFG.radarObservedFrames);
  state.cursor = Math.max(0, state.frames.length - 1);
  panel.dataset.observedFrames = String(state.frames.length);
  panel.dataset.loop = `observed-${state.frames.length}-of-${CFG.radarObservedFrames}`;
  panel.dataset.fallback = 'last-good-observed';
  deriveHome();
  return !!state.frames.length;
}
function queueObservedKeys(keys) {
  const wanted = keys.slice(-CFG.radarObservedFrames),
    known = new Set(state.frames.map(f => f.key));
  state.pendingRadarKeys = wanted.filter(key => !known.has(key));
  return state.pendingRadarKeys;
}
async function backfillRadar() {
  if (state.radarBackfilling || !state.pendingRadarKeys || !state.pendingRadarKeys.length) return;
  state.radarBackfilling = true;
  try {
    const queue = state.pendingRadarKeys.splice(0),
      failed = [];
    for (const key of queue) {
      if (state.frames.some(f => f.key === key)) continue;
      try {
        const f = await loadFieldKey(key, 'radar');
        commitObservedFrame(f);
        render();
        await new Promise(resolve => setTimeout(resolve, state.runtime && state.runtime.lowPower ? 300 : 50));
      } catch (e) {
        state.errors.push(`radar backfill: ${e}`);
        failed.push(key);
      }
    }
    // Keep an incomplete observed window eligible for a measured retry. This
    // is especially important when a just-listed MRMS object is briefly not
    // readable yet; one bad historical object never discards good frames.
    if (failed.length) {
      const retryKeys = failed.concat(state.pendingRadarKeys);
      state.pendingRadarKeys = retryKeys.filter((key, index) => retryKeys.indexOf(key) === index);
    }
  } finally {
    state.radarBackfilling = false;
    if (state.pendingRadarKeys.length && !state.radarBackfillRetryTimer) state.radarBackfillRetryTimer = setTimeout(() => {
      state.radarBackfillRetryTimer = null;
      backfillRadar().catch(e => state.errors.push(`radar backfill retry: ${e}`));
    }, state.runtime && state.runtime.lowPower ? 30000 : 15000);
  }
}
function retryRadarSoon() {
  if (state.frames.length || state.radarRetryTimer) return;
  state.radarRetryTimer = setTimeout(() => {
    state.radarRetryTimer = null;
    pollRadar({
      initial: true
    }).catch(e => state.errors.push(String(e)));
  }, 15000);
}
async function pollRadar({
  initial = false
} = {}) {
  if (state.radarLoading) return;
  state.radarLoading = true;
  try {
    const keys = await recentKeys(CFG.radarProduct, CFG.radarObservedFrames),
      have = new Set(state.frames.map(f => f.key)),
      newest = keys[keys.length - 1];
    if (!newest) throw new Error('no current MRMS radar frames listed');
    if (newest && !have.has(newest)) {
      const f = await loadFieldKey(newest, 'radar');
      commitObservedFrame(f);
      render();
      if (initial) {
        panel.dataset.radar = 'live';
      }
    }
    if (state.frames.length && state.radarRetryTimer) {
      clearTimeout(state.radarRetryTimer);
      state.radarRetryTimer = null;
    }
    state.lastListError = null;
    if (state.frames.length) panel.dataset.radar = freshness() === 'stale' ? 'degraded' : 'live';
    // Always retain a five-frame observed window. Loading remains sequential,
    // with a longer idle gap on low-power players, so it cannot compete with
    // the current observation or create concurrent decoder work.
    queueObservedKeys(keys);
    if (state.pendingRadarKeys.length && !verifyMode) setTimeout(() => backfillRadar().catch(e => state.errors.push(String(e))), state.runtime && state.runtime.lowPower ? 2200 : initial ? 900 : 250);
  } catch (e) {
    state.lastListError = e;
    state.errors.push(String(e));
    if (restoreLastGoodFrames() || state.frames.length) panel.dataset.fallback = 'last-good-observed';
    panel.dataset.radar = state.frames.length ? 'degraded' : 'unavailable';
    if (!state.frames.length) {
      state.home.status = 'UNAVAILABLE';
      state.home.dbz = null;
      state.home.nearest = null;
      state.home.eta = null;
    }
    retryRadarSoon();
    render();
  } finally {
    state.radarLoading = false;
    panel.dataset.freshness = freshness();
  }
}
function fieldMax(field, id = view().id) {
  var _field$views;
  const a = field === null || field === void 0 || (_field$views = field.views) === null || _field$views === void 0 ? void 0 : _field$views[id];
  if (!a) return null;
  let m = null;
  for (let i = 0; i < a.length; i++) {
    const q = a[i];
    if (q !== MISSING && (m === null || q > m)) m = q;
  }
  return m === null ? null : m / 10;
}
async function loadSevere() {
  for (const [name, product] of Object.entries(CFG.severeProducts)) {
    try {
      var _state$severe$name;
      const keys = await recentKeys(product, 1),
        key = keys[keys.length - 1];
      if (!key || ((_state$severe$name = state.severe[name]) === null || _state$severe$name === void 0 ? void 0 : _state$severe$name.key) === key) continue;
      state.severe[name] = await loadFieldKey(key, name);
      await radarYield();
    } catch (e) {
      state.errors.push(`${name}: ${e}`);
    }
  }
  render();
}
