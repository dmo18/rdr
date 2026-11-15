'use strict';

/*
 * Human-readable alert copy policy.
 * Counts must always say exactly what they count. Never use a bare +N suffix.
 */
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const ALERT_COPY_BUILD = 'alert-copy-2026.10.23.2';
function rdrAlertNoun(meta, count = 1) {
  if (meta !== null && meta !== void 0 && meta.isWarning) return count === 1 ? 'WARNING' : 'WARNINGS';
  if (meta !== null && meta !== void 0 && meta.isWatch) return count === 1 ? 'WATCH' : 'WATCHES';
  if (meta !== null && meta !== void 0 && meta.isAdvisory) return count === 1 ? 'ADVISORY' : 'ADVISORIES';
  return count === 1 ? 'ALERT' : 'ALERTS';
}
function rdrTypedAlertLabel(meta, count = 1) {
  const n = Math.max(1, Math.round(Number(count) || 1)),
    code = (meta === null || meta === void 0 ? void 0 : meta.code) || 'WX',
    noun = rdrAlertNoun(meta, n);
  return n === 1 ? `${code} ${noun}` : `${n} ${code} ${noun}`;
}
function rdrAlertDisplayName(meta) {
  if (!meta) return 'WEATHER ALERT';
  if (meta.code === 'SVR') return 'SEVERE T-STORM WARNING';
  if (meta.code === 'TOR') return 'TORNADO WARNING';
  if (meta.code === 'FFW') return 'FLASH FLOOD WARNING';
  if (meta.code === 'HUR') return 'HURRICANE WARNING';
  if (meta.code === 'TRP') return 'TROPICAL STORM WARNING';
  return String(meta.name || 'WEATHER ALERT').toUpperCase();
}
function rdrCopyState() {
  if (!state.ux) state.ux = {};
  state.ux.alertCopyBuild = ALERT_COPY_BUILD;
  state.ux.alertCounterPolicy = 'typed-counts-only';
  state.ux.ambiguousPlusCounter = false;
  return state.ux;
}
if (typeof vAlertSummary === 'function') {
  const baseVAlertSummary = vAlertSummary;
  vAlertSummary = function () {
    const sum = baseVAlertSummary();
    if (!sum) return null;
    const same = Math.max(1, Number(sum.same) || 1),
      count = Math.max(same, Number(sum.count) || same);
    return _objectSpread(_objectSpread({}, sum), {}, {
      same,
      count,
      typedLabel: rdrTypedAlertLabel(sum.meta, same),
      otherCount: Math.max(0, count - same)
    });
  };
}
if (typeof vHazardText === 'function') {
  const baseVHazardText = vHazardText;
  vHazardText = function () {
    const sum = typeof vAlertSummary === 'function' ? vAlertSummary() : null;
    if (sum) {
      const main = sum.typedLabel || rdrTypedAlertLabel(sum.meta, sum.same),
        name = rdrAlertDisplayName(sum.meta),
        sub = [sum.same === 1 ? name : null, sum.place || 'IN VIEW', sum.expires ? `UNTIL ${sum.expires}` : null].filter(Boolean).join('  •  '),
        ux = rdrCopyState();
      ux.alertHazardMain = main;
      ux.alertHazardSub = sub;
      return {
        main,
        sub,
        accent: sum.meta.color
      };
    }
    const out = baseVHazardText();
    const ux = rdrCopyState();
    ux.alertHazardMain = out.main;
    ux.alertHazardSub = out.sub;
    return out;
  };
}
if (typeof vAlertSummaryState === 'function') {
  const baseVAlertSummaryState = vAlertSummaryState;
  vAlertSummaryState = function () {
    baseVAlertSummaryState();
    const sum = typeof vAlertSummary === 'function' ? vAlertSummary() : null,
      ux = rdrCopyState();
    state.alertUi = _objectSpread(_objectSpread({}, state.alertUi || {}), {}, {
      copyBuild: ALERT_COPY_BUILD,
      copyLabel: sum ? sum.typedLabel || rdrTypedAlertLabel(sum.meta, sum.same) : null,
      otherAlerts: (sum === null || sum === void 0 ? void 0 : sum.otherCount) || 0,
      ambiguousPlusCounter: false
    });
    ux.alertCopyLabel = state.alertUi.copyLabel;
  };
}
rdrCopyState();
panel.dataset.copy = ALERT_COPY_BUILD;
