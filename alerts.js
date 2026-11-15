'use strict';

function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const E_ALERT_COLORS = {
  TOR: '#ff4b4b',
  SVR: '#ffe044',
  FFW: '#46d46b',
  FLD: '#45c978',
  SMW: '#f0a000',
  SQW: '#c71585',
  HUR: '#ff4fa3',
  TRP: '#ff7b62',
  SUR: '#ff6b6b',
  WRN: '#ff8a4c',
  WCH: '#aa91ff',
  ADV: '#62c9ff',
  ALERT: '#9eb1ba'
};
const E_ALERT_VIEW_CACHE = new Map();
let E_LOCAL_ALERT_CACHE = {
  key: '',
  value: null
};
function alertSig(f) {
  var _f$properties;
  return String((f === null || f === void 0 || (_f$properties = f.properties) === null || _f$properties === void 0 ? void 0 : _f$properties.sig) || '').trim().toUpperCase();
}
function alertName(f) {
  const p = (f === null || f === void 0 ? void 0 : f.properties) || {};
  return String(p.prod_type || p.event || 'Weather Alert').trim() || 'Weather Alert';
}
function alertExpired(f) {
  const p = (f === null || f === void 0 ? void 0 : f.properties) || {};
  for (const k of ['ends', 'expiration']) {
    const t = Date.parse(p[k] || '');
    if (Number.isFinite(t) && t < Date.now() - 60000) return true;
  }
  return false;
}
function alertMeta(f) {
  const p = (f === null || f === void 0 ? void 0 : f.properties) || {},
    sig = alertSig(f),
    ph = String(p.phenom || '').toUpperCase(),
    name = alertName(f),
    u = name.toUpperCase();
  let code = 'ALERT',
    priority = 10;
  if (ph === 'TO' || u.includes('TORNADO')) {
    code = 'TOR';
    priority = 100;
  } else if (ph === 'SV' || u.includes('SEVERE THUNDERSTORM')) {
    code = 'SVR';
    priority = 92;
  } else if (ph === 'FF' || u.includes('FLASH FLOOD')) {
    code = 'FFW';
    priority = 90;
  } else if (ph === 'HU' || u.includes('HURRICANE')) {
    code = 'HUR';
    priority = 88;
  } else if (u.includes('STORM SURGE')) {
    code = 'SUR';
    priority = 87;
  } else if (ph === 'TR' || u.includes('TROPICAL STORM')) {
    code = 'TRP';
    priority = 84;
  } else if (ph === 'MA' || u.includes('SPECIAL MARINE')) {
    code = 'SMW';
    priority = 82;
  } else if (ph === 'SQ' || u.includes('SNOW SQUALL')) {
    code = 'SQW';
    priority = 80;
  } else if (ph === 'FL' || u.includes('FLOOD WARNING')) {
    code = 'FLD';
    priority = 76;
  } else if (sig === 'W' || u.includes(' WARNING')) {
    code = 'WRN';
    priority = 70;
  } else if (sig === 'A' || u.includes(' WATCH')) {
    code = 'WCH';
    priority = 50;
  } else if (sig === 'Y' || u.includes(' ADVISORY')) {
    code = 'ADV';
    priority = 30;
  } else if (u.includes(' ALERT')) {
    code = 'ALERT';
    priority = 20;
  }
  const color = E_ALERT_COLORS[code] || E_ALERT_COLORS.ALERT,
    isWarning = sig === 'W' || priority >= 70,
    isWatch = sig === 'A' || code === 'WCH',
    isAdvisory = sig === 'Y' || code === 'ADV';
  return {
    code,
    name,
    sig,
    priority,
    color,
    isWarning,
    isWatch,
    isAdvisory,
    width: isWarning ? priority >= 88 ? 2.2 : 1.55 : isWatch ? 1.15 : .8,
    dash: isWarning ? [] : isWatch ? [4, 2] : [2, 2],
    fill: isWarning ? priority >= 88 ? '.050' : '.032' : isWatch ? '.016' : '.008'
  };
}
function alertDisplayable(f) {
  if (!(f !== null && f !== void 0 && f.geometry) || alertExpired(f)) return false;
  const m = alertMeta(f),
    u = m.name.toUpperCase();
  return ['W', 'A', 'Y'].includes(m.sig) || /WARNING|WATCH|ADVISORY|ALERT/.test(u);
}
function alertVisibleInView(f, def = view()) {
  if (!alertDisplayable(f)) return false;
  const m = alertMeta(f);
  if (m.isAdvisory && ['florida', 'regional'].includes(def.id) && !containsPoint(f.geometry, CFG.home)) return false;
  return true;
}
function warningCode(f) {
  return alertMeta(f).code;
}
function alertPriority(f) {
  return alertMeta(f).priority;
}
function alertCacheKey() {
  return `${state.alertRevision || 0}|${state.warnings.size}`;
}
function invalidateAlertCache() {
  E_ALERT_VIEW_CACHE.clear();
  E_LOCAL_ALERT_CACHE = {
    key: '',
    value: null
  };
}
function localAlert() {
  const key = alertCacheKey();
  if (E_LOCAL_ALERT_CACHE.key === key) return E_LOCAL_ALERT_CACHE.value;
  const a = [];
  for (const f of state.warnings.values()) if (alertDisplayable(f) && containsPoint(f.geometry, CFG.home)) a.push(f);
  a.sort((x, y) => alertPriority(y) - alertPriority(x));
  const value = a[0] || null;
  E_LOCAL_ALERT_CACHE = {
    key,
    value
  };
  return value;
}
async function alertArcQuery(layer, bbox) {
  const [w, s, e, n] = bbox,
    p = new URLSearchParams({
      where: "sig IN ('W','A','Y')",
      geometry: `${w},${s},${e},${n}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'objectid,prod_type,msg_type,phenom,url,expiration,onset,ends,issuance,sig,wfo,event,cap_id',
      returnGeometry: 'true',
      f: 'geojson'
    }),
    j = await fetchJson(`${CFG.warnings}/${layer}/query?${p}`);
  return (j === null || j === void 0 ? void 0 : j.features) || [];
}
function alertFeatureKey(f, i = 0) {
  const p = (f === null || f === void 0 ? void 0 : f.properties) || {},
    b = eGeomBounds(f.geometry),
    g = b ? `${b.w.toFixed(3)},${b.s.toFixed(3)},${b.e.toFixed(3)},${b.n.toFixed(3)}` : String(i);
  return `${p.cap_id || p.event || p.objectid || i}|${p.phenom || ''}|${p.sig || ''}|${g}`;
}
async function loadWarnings() {
  const settled = await Promise.allSettled([alertArcQuery(0, CFG.views[3].bbox), alertArcQuery(1, CFG.views[3].bbox)]),
    success = settled.some(x => x.status === 'fulfilled');
  if (!success) {
    state.errors.push(`alerts: ${settled.map(x => x.reason || 'unavailable').join(' | ')}`);
    panel.dataset.alerts = 'unavailable';
    render();
    return;
  }
  const urgent = settled[0].status === 'fulfilled' ? settled[0].value : [],
    broad = settled[1].status === 'fulfilled' ? settled[1].value : [],
    merged = new Map();
  let i = 0;
  for (const f of broad.concat(urgent)) {
    if (!alertDisplayable(f)) continue;
    merged.set(alertFeatureKey(f, i++), f);
  }
  state.warnings.clear();
  for (const [k, f] of merged) state.warnings.set(k, f);
  state.alertRevision = (state.alertRevision || 0) + 1;
  invalidateAlertCache();
  panel.dataset.alerts = String(state.warnings.size);
  render();
}
function eWarningsInView() {
  const def = view(),
    key = `${alertCacheKey()}|${def.id}`;
  if (E_ALERT_VIEW_CACHE.has(key)) return E_ALERT_VIEW_CACHE.get(key);
  const out = [];
  for (const f of state.warnings.values()) {
    if (!alertVisibleInView(f, def)) continue;
    const box = eGeomBounds(f.geometry);
    if (!eBoxIntersects(box, def.bbox)) continue;
    const c = geometryCenter(f.geometry) || {
        lon: (box.w + box.e) / 2,
        lat: (box.s + box.n) / 2
      },
      meta = alertMeta(f);
    out.push({
      f,
      c,
      code: meta.code,
      meta
    });
  }
  out.sort((a, b) => b.meta.priority - a.meta.priority || a.meta.name.localeCompare(b.meta.name));
  E_ALERT_VIEW_CACHE.set(key, out);
  while (E_ALERT_VIEW_CACHE.size > 12) E_ALERT_VIEW_CACHE.delete(E_ALERT_VIEW_CACHE.keys().next().value);
  return out;
}
function eHazardColor(code) {
  return E_ALERT_COLORS[code] || E_ALERT_COLORS.ALERT;
}
function eDrawWarnings(target = ctx) {
  let drawn = 0;
  const local = localAlert();
  for (const {
    f,
    meta
  } of eWarningsInView()) {
    const fill = `rgba(${meta.code === 'TOR' ? '255,75,75' : meta.code === 'SVR' ? '255,224,68' : meta.code === 'FFW' || meta.code === 'FLD' ? '70,212,107' : meta.code === 'HUR' ? '255,79,163' : meta.code === 'TRP' ? '255,123,98' : meta.code === 'SMW' ? '240,160,0' : meta.code === 'WCH' ? '170,145,255' : meta.code === 'ADV' ? '98,201,255' : '255,138,76'},${meta.fill})`;
    eGeometry(target, view(), f.geometry, meta.color, fill, meta.width, meta.dash);
    if (local === f) eGeometry(target, view(), f.geometry, 'rgba(255,255,255,.55)', null, meta.width + 1.1, []);
    drawn++;
  }
  state.alertUi = _objectSpread(_objectSpread({}, state.alertUi || {}), {}, {
    boundaries: drawn
  });
}
function eAlertSummarySpec() {
  const alerts = eWarningsInView();
  if (!alerts.length) return null;
  const local = localAlert(),
    urgent = alerts.find(x => x.meta.priority >= 70),
    localInView = local ? alerts.find(x => x.f === local) : null,
    primary = urgent || localInView || alerts[0],
    meta = primary.meta;
  return {
    x: 306,
    y: E_MAP_TOP + 5,
    w: 144,
    h: 27,
    alerts,
    primary,
    meta,
    local: primary.f === local
  };
}
function eAlertSummaryBox(spec = eAlertSummarySpec()) {
  if (!spec) {
    state.alertUi = _objectSpread(_objectSpread({}, state.alertUi || {}), {}, {
      summary: false,
      count: 0
    });
    return;
  }
  const {
      x,
      y,
      w,
      h,
      alerts,
      meta,
      local
    } = spec,
    more = Math.max(0, alerts.length - 1),
    title = local ? `${meta.code}  HOME ALERT` : `${meta.code}  ACTIVE ALERT`,
    sub = `${meta.name.toUpperCase()}${more ? `  +${more}` : ''}`;
  ctx.save();
  ctx.fillStyle = 'rgba(2,8,12,.96)';
  eRound(ctx, x, y, w, h, 2);
  ctx.fill();
  ctx.strokeStyle = meta.color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = meta.color;
  ctx.fillRect(x, y, 3, h);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = meta.color;
  ctx.font = '900 5.7px Arial,Helvetica,sans-serif';
  ctx.fillText(title, x + 8, y + 8);
  ctx.fillStyle = '#eef5f7';
  ctx.font = '800 5px Arial,Helvetica,sans-serif';
  ctx.fillText(eFitText(sub, w - 15, '800 5px Arial,Helvetica,sans-serif'), x + 8, y + 18.5);
  ctx.restore();
  state.alertUi = _objectSpread(_objectSpread({}, state.alertUi || {}), {}, {
    summary: true,
    count: alerts.length,
    primary: meta.code,
    local
  });
}
