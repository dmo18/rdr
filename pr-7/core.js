'use strict';

/* Yodeck's deployed Chromium predates these ES2019+/ES2022 helpers. Keep the
 * compatibility surface in the first parsed runtime file so every later module
 * can start, including after a cold cache refresh. */
if (!Promise.allSettled) Promise.allSettled = function (jobs) {
  return Promise.all(Array.prototype.map.call(jobs, function (job) {
    return Promise.resolve(job).then(function (value) {
      return { status: 'fulfilled', value: value };
    }, function (reason) {
      return { status: 'rejected', reason: reason };
    });
  }));
};
if (!Array.prototype.at) Array.prototype.at = function (index) {
  var i = Number(index) || 0;
  if (i < 0) i += this.length;
  return this[i];
};
if (!Array.prototype.flat) Array.prototype.flat = function () {
  return Array.prototype.concat.apply([], this);
};
if (!Object.fromEntries) Object.fromEntries = function (entries) {
  var out = {}, i, entry;
  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    out[entry[0]] = entry[1];
  }
  return out;
};

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const CFG = {
  width: 456,
  height: 257,
  top: 0,
  bottom: 0,
  mapHeight: 257,
  home: {
    lat: 26.06197904865014,
    lon: -80.18787062578414
  },
  pollMs: 120000,
  vectorMs: 300000,
  severeMs: 180000,
  radarFrameMs: 1100,
  radarBlendMs: 420,
  radarObservedFrames: 5,
  motionExtrapolationMinutes: 45,
  motionMaxAgeMs: 480000,
  animFps: 15,
  views: [{
    id: 'home',
    name: 'NEIGHBORHOOD',
    duration: 11000,
    bbox: [-80.46, 25.84, -79.96, 26.30],
    scaleMi: 10,
    labels: [['DAVIE', 26.0765, -80.2521], ['HOLLYWOOD', 26.0112, -80.1495], ['DANIA BEACH', 26.0523, -80.1439], ['FORT LAUDERDALE', 26.1224, -80.1373], ['HALLANDALE', 25.9812, -80.1484], ['MIRAMAR', 25.9861, -80.3036]]
  }, {
    id: 'metro',
    name: 'SOUTH FLORIDA',
    duration: 11000,
    bbox: [-81.10, 25.00, -79.45, 27.02],
    scaleMi: 25,
    labels: [['WEST PALM', 26.7153, -80.0534], ['BOCA RATON', 26.3683, -80.1289], ['FORT LAUDERDALE', 26.1224, -80.1373], ['HOLLYWOOD', 26.0112, -80.1495], ['MIAMI', 25.7617, -80.1918], ['HOMESTEAD', 25.4687, -80.4776], ['KEY LARGO', 25.0865, -80.4473]]
  }, {
    id: 'florida',
    name: 'FLORIDA',
    duration: 11000,
    bbox: [-87.80, 24.00, -79.20, 31.25],
    scaleMi: 100,
    labels: [['JACKSONVILLE', 30.3322, -81.6557], ['ORLANDO', 28.5383, -81.3792], ['TAMPA', 27.9506, -82.4572], ['WEST PALM', 26.7153, -80.0534], ['FORT MYERS', 26.6406, -81.8723], ['NAPLES', 26.1423, -81.7948], ['MIAMI', 25.7617, -80.1918], ['KEY WEST', 24.5551, -81.7800]]
  }, {
    id: 'regional',
    name: 'GULF + CARIBBEAN',
    duration: 12000,
    bbox: [-98.00, 18.00, -72.00, 32.80],
    scaleMi: 250,
    labels: [['GULF OF MEXICO', 25.9, -90.0], ['FLORIDA', 27.4, -81.7], ['MIAMI', 25.7617, -80.1918], ['KEY WEST', 24.5551, -81.7800], ['HAVANA', 23.1136, -82.3666], ['CUBA', 22.25, -79.7], ['BAHAMAS', 24.4, -76.7], ['YUCATAN', 21.0, -87.1]]
  }],
  mrmsBucket: 'https://noaa-mrms-pds.s3.amazonaws.com',
  radarProduct: 'MergedReflectivityQCComposite_00.50',
  severeProducts: {
    lightning: 'LightningProbabilityNext30minGrid_scale_1',
    mesh: 'MESH_00.50'
  },
  reference: 'https://mapservices.weather.noaa.gov/static/rest/services/nws_reference_maps/nws_reference_map/MapServer',
  warnings: 'https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer',
  tropics: 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer',
  surfaceObs: 'https://mapservices.weather.noaa.gov/vector/rest/services/obs/surface_obs/MapServer',
  nws: 'https://api.weather.gov'
};
const panel = document.getElementById('panel'),
  canvas = document.getElementById('display'),
  ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true
  }),
  boot = document.getElementById('boot'),
  query = new URLSearchParams(location.search),
  forcedView = query.get('view'),
  verifyMode = query.has('verify');
const state = {
  view: 0,
  cursor: 0,
  frames: [],
  // Observed MRMS frames only. Forecast motion is deliberately kept separate
  // so no extrapolation can be mistaken for an observation.
  lastGoodFrames: [],
  motionOverlay: {
    kind: 'extrapolated',
    suppressed: true,
    confidence: 0,
    reason: 'awaiting-observed-frames'
  },
  radarLoading: false,
  radarBackfilling: false,
  pendingRadarKeys: [],
  lastListError: null,
  boundaries: new Map(),
  surface: new Map(),
  warnings: new Map(),
  tropics: [],
  weather: null,
  severe: {
    lightning: null,
    mesh: null
  },
  home: {
    dbz: null,
    status: 'LOADING',
    nearest: null,
    eta: null
  },
  motion: null,
  transition: null,
  raf: null,
  lastPaint: 0,
  rotateTimer: null,
  animTimer: null,
  pollTimer: null,
  radarRetryTimer: null,
  radarBackfillRetryTimer: null,
  vectorTimer: null,
  severeTimer: null,
  errors: [],
  runtime: {
    deviceMemory: Number(navigator.deviceMemory) || null,
    hardwareConcurrency: Number(navigator.hardwareConcurrency) || null,
    decompressionStream: typeof DecompressionStream === 'function',
    yodeckHint: query.has('yodeck')
  }
};
const MISSING = -32768;
const radarStops = [[5, [0, 104, 232]], [10, [0, 162, 242]], [15, [0, 194, 142]], [20, [0, 222, 72]], [25, [74, 232, 53]], [30, [188, 230, 36]], [35, [246, 221, 34]], [40, [255, 163, 30]], [45, [255, 92, 28]], [50, [238, 38, 43]], [55, [244, 34, 104]], [60, [211, 38, 190]], [65, [151, 55, 226]], [70, [247, 247, 255]]];
function fitPanel() {
  const s = Math.min(innerWidth / CFG.width, innerHeight / CFG.height);
  panel.style.transform = `translate(-50%,-50%) scale(${Math.max(.2, s)})`;
}
function view() {
  return CFG.views[state.view];
}
function lon360(lon) {
  return lon < 0 ? lon + 360 : lon;
}
function mapXY(lat, lon, def = view()) {
  const [w, s, e, n] = def.bbox;
  return {
    x: (lon - w) / (e - w) * CFG.width,
    y: CFG.top + (n - lat) / (n - s) * CFG.mapHeight
  };
}
function within(lat, lon, def = view()) {
  const b = def.bbox;
  return lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3];
}
function pixelLatLon(x, y, def = CFG.views[0]) {
  const [w, s, e, n] = def.bbox;
  return {
    lon: w + x / (CFG.width - 1) * (e - w),
    lat: n - y / (CFG.mapHeight - 1) * (n - s)
  };
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function ageMs() {
  const f = state.frames.length ? state.frames[state.frames.length - 1] : null;
  return f ? Date.now() - f.time.getTime() : Infinity;
}
function freshness() {
  const a = ageMs();
  return a < 270000 ? 'live' : a < 480000 ? 'delayed' : 'stale';
}
function compactTime(d) {
  return d && Number.isFinite(d.getTime()) ? d.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  }).replace(' ', '').replace('AM', 'a').replace('PM', 'p') : '--:--';
}
function utcTime(d) {
  return d && Number.isFinite(d.getTime()) ? d.toLocaleTimeString('en-US', {
    timeZone: 'UTC',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }) + 'Z' : '--:--Z';
}
function dayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}
function keyTime(key) {
  const m = key.match(/(\d{8})-(\d{6})/);
  if (!m) return null;
  return new Date(Date.UTC(+m[1].slice(0, 4), +m[1].slice(4, 6) - 1, +m[1].slice(6, 8), +m[2].slice(0, 2), +m[2].slice(2, 4), +m[2].slice(4, 6)));
}
function requestTimeout(ms) {
  const qa = Number(state.runtime && state.runtime.requestTimeoutMs);
  return Number.isFinite(qa) && qa >= 10 ? qa : ms;
}
async function fetchWithTimeout(url, options = {}, ms = 15000, read = r => r) {
  const timeout = requestTimeout(ms),
    controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timer = null;
  const expired = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error(`request timeout after ${timeout}ms: ${url}`));
    }, timeout);
  });
  try {
    const request = _objectSpread({}, options);
    if (controller) request.signal = controller.signal;
    const r = await Promise.race([Promise.resolve().then(() => fetch(url, request)), expired]);
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return await Promise.race([Promise.resolve().then(() => read(r)), expired]);
  } finally {
    clearTimeout(timer);
  }
}
function fetchText(url) {
  return fetchWithTimeout(url, {
    cache: 'no-store'
  }, 20000, r => r.text());
}
function fetchJson(url, headers = {}) {
  return fetchWithTimeout(url, {
    cache: 'no-store',
    headers
  }, 15000, r => r.json());
}
let compatInflaterPromise = null;
function loadCompatInflater() {
  if (window.fflate) return Promise.resolve(window.fflate);
  if (compatInflaterPromise) return compatInflaterPromise;
  let promise;
  promise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
    s.async = true;
    s.crossOrigin = 'anonymous';
    let settled = false,
      timer;
    const finish = (error, lib) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      s.onload = s.onerror = null;
      if (s.parentNode) s.parentNode.removeChild(s);
      if (error) {
        if (compatInflaterPromise === promise) compatInflaterPromise = null;
        reject(error);
      } else resolve(lib);
    };
    s.onload = () => window.fflate ? finish(null, window.fflate) : finish(new Error('fflate unavailable after load'));
    s.onerror = () => finish(new Error('unable to load decompression fallback'));
    timer = setTimeout(() => finish(new Error(`decompression fallback timeout after ${requestTimeout(15000)}ms`)), requestTimeout(15000));
    document.head.appendChild(s);
  });
  compatInflaterPromise = promise;
  return compatInflaterPromise;
}
async function inflate(buf, kind) {
  if (typeof DecompressionStream === 'function') return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream(kind))).arrayBuffer();
  const lib = await loadCompatInflater(),
    input = new Uint8Array(buf),
    decode = kind === 'gzip' ? lib.gunzip : kind === 'deflate' ? lib.unzlib : null;
  if (typeof decode !== 'function') throw new Error(`unsupported asynchronous compression ${kind}`);
  const timeout = requestTimeout(30000);
  return new Promise((resolve, reject) => {
    let settled = false,
      cancel = null,
      timer;
    const finish = (error, out) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);else if (out) resolve(out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength));else reject(new Error(`empty ${kind} output`));
    };
    timer = setTimeout(() => {
      try {
        if (typeof cancel === 'function') cancel();
      } catch (_unused) {}
      finish(new Error(`decompression timeout after ${timeout}ms (${kind})`));
    }, timeout);
    try {
      cancel = decode(input, finish);
    } catch (e) {
      finish(e);
    }
  });
}
async function listProductDay(product, stamp) {
  const prefix = `CONUS/${product}/${stamp}/`,
    url = `${CFG.mrmsBucket}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`,
    xml = await fetchText(url),
    keys = [],
    re = /<Key>([^<]+)<\/Key>/g;
  let m;
  while ((m = re.exec(xml)) !== null) if (m[1].endsWith('.grib2.gz')) keys.push(m[1]);
  return keys;
}
async function recentKeys(product, count = 5) {
  const now = new Date();
  let keys = await listProductDay(product, dayStamp(now));
  if (keys.length < count) {
    const y = new Date(now.getTime() - 86400000);
    keys = (await listProductDay(product, dayStamp(y))).concat(keys);
  }
  return [...new Set(keys)].sort().slice(-count);
}
function haversineMiles(a, b) {
  const R = 3958.7613,
    p1 = a.lat * Math.PI / 180,
    p2 = b.lat * Math.PI / 180,
    dp = (b.lat - a.lat) * Math.PI / 180,
    dl = (b.lon - a.lon) * Math.PI / 180,
    h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const p1 = a.lat * Math.PI / 180,
    p2 = b.lat * Math.PI / 180,
    dl = (b.lon - a.lon) * Math.PI / 180;
  return (Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) * 180 / Math.PI + 360) % 360;
}
function dir8(deg) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round((deg % 360 + 360) % 360 / 45) % 8];
}
function angleDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
