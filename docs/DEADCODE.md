# Dead-code removal design (PLAN tasks 11 and 12)

Design only. Line numbers are at commit `83c10ee`; they shift after every step, so delete by function name, bottom-up within a file. Recommendation: do steps 1-5, ask the owner before step 6, do not do step 7 in this milestone.

## Three facts that shape the plan

1. **Strict mode pins declarations.** Every file except `enterprise-overlays.js` and `enterprise-ui.js` starts with `'use strict'`. A bare `X = function` there throws `ReferenceError` unless an earlier script declared `X`. So an earlier `function X` cannot simply be deleted while a later strict file assigns `X`. `render` has no declaration at all: the sloppy `enterprise-ui.js:233` creates it.
2. **The first seven scripts are a test target on their own.** `qa/hang-regression.html` loads only core, radar, context and the four `enterprise-*` files, and `radar.js` calls `render()` there, so `enterprise-ui.js:233` is live on that page (it returns early, `data-ready="false"`). `qa/continuous-regression.mjs` runs core, radar, enterprise-core, enterprise-map and the head of `app.js` in a VM.
3. **Workflows grep names.** `verify.yml`: `function eRadarCanvas` (enterprise-map), `function eWarmCurrentView` (enterprise-ui). `alert-overlays.yml`: `function eAlertSummaryBox`, `function eDrawWarnings`, `function invalidateAlertCache` (alerts.js), and it calls `warningCode(localAlert())`. `qa-v8.yml` (branch `qa/enterprise-v8` only): `function eHeader`, `function eFooter` (enterprise-ui). `qa-v8.yml` already fails on `main` (`! grep eMotion enterprise-*.js` finds `eMotionOverlay`).

## 1. Overridden globals

"Live" is the definition that runs in `index.html`. "Base" = needed by fact 1 or 2.

| Global | Definitions (file:line) | Live | Earlier definitions |
|---|---|---|---|
| `render` | enterprise-ui:233, alerts:441, hidpi:295, vnext:679 (`= vRender`) | vnext:679 | alerts:441 and hidpi:295 **REMOVABLE** (no page loads them without vnext; nothing saves them). enterprise-ui:233 **KEEP**: creates the binding, live in hang-regression.html |
| `eHeader` | enterprise-ui:1, alerts:378, vnext:672, alert-copy:148, clarity:55 (aliases of `vHeader`) | clarity:55, called by nobody live | alerts:378 **REMOVABLE**. enterprise-ui:1 **KEEP** (base, `qa-v8.yml`). Aliases KEEP (one line each) |
| `eFooter` | enterprise-ui:115, vnext:673, clarity:56 | clarity:56, uncalled | enterprise-ui:115 **KEEP** (base, `qa-v8.yml`) |
| `eHazardText` | enterprise-ui:83, alerts:341, vnext:674 (alias) | vnext:674, uncalled | alerts:341 **REMOVABLE**. enterprise-ui:83 **KEEP** (base; called by enterprise-ui `eFooter`) |
| `eWarningLabels` | enterprise-overlays:179, alerts:242, vnext:671 (alias) | vnext:671, uncalled | alerts:242 **REMOVABLE**. overlays:179 **KEEP** (base) |
| `eCityLabels` | enterprise-overlays:79, vnext:669 (alias) | vnext:669, uncalled | **KEEP** (base) |
| `eStormFocus` | enterprise-overlays:108, vnext:670, vnext-motion:130 (aliases) | vnext-motion:130, uncalled | **KEEP** (base) |
| `eAlertSummaryBox` | alerts:296, vnext:676, alert-copy:168 | alert-copy:168; only callers are the old renders (alerts:471, hidpi:326) | alert-copy:167-222 and vnext:676-678 **REMOVABLE after the old renders go**. alerts:296 **KEEP** (`alert-overlays.yml` grep) |
| `eAlertSummarySpec` | alerts:277, vnext:675 (`= vAlertSummary`) | vnext:675 | alerts:277 **KEEP**: binding for vnext:675 and default argument of alerts:296 |
| `eBase`, `eLines`, `eRadar` | enterprise-map:121, 176, 284; hidpi:84, 139, 275 | hidpi | **KEEP**: strict assignment needs the declaration; base |
| `eRadarCanvas` | enterprise-map:212, hidpi:216 | hidpi | **KEEP**: `verify.yml` grep, strict assignment |
| `eDrawWarnings` | enterprise-map:451, alerts:226, clarity:83 | clarity:83, which calls alerts:226 through `rdrDrawWarnings` (clarity:82) | alerts:226 **KEEP** (live through saved reference, workflow grep). enterprise-map:451 **KEEP** (base) |
| `eDrawTropics` | enterprise-map:461, clarity:84 | clarity:84, calls enterprise-map:461 through `rdrDrawTropics` | **KEEP** (live through saved reference) |
| `eWarningsInView`, `eHazardColor` | enterprise-map:431, 448; alerts:197, 223 | alerts | enterprise-map **KEEP** (base) |
| `warningCode`, `localAlert` | enterprise-core:28, 51; alerts:122, 138 | alerts | enterprise-core **KEEP** (base) |
| `loadWarnings` | context:93, alerts:173 | alerts:173 | **KEEP** (base) |
| `fitPanel` | core:160, hidpi:56 | hidpi:56 | **KEEP**: strict assignment, base |
| `loadFieldKey` | radar:213, background:63 | background:63 | **KEEP**: strict assignment; replay.html and both base tests use radar:213 |
| `vHeader` | vnext:481, alert-copy:81, clarity:15 | clarity:15 | alert-copy:80-149 **REMOVABLE** (replaced without being saved). vnext:481 **REMOVABLE with a `var` left behind** (step 6) |
| `vFooter`, `vExpiry` | vnext:544, 339; clarity:29, 59 | clarity | vnext bodies **REMOVABLE with `var`** (step 6) |
| `vStormTracks`, `vStormFocus` | vnext:202, 301; vnext-motion:43, 92 | vnext-motion | vnext bodies **REMOVABLE with `var`** (step 6) |
| `vAlertSummary`, `vHazardText`, `vAlertSummaryState` | vnext:366, 443, 617; alert-copy:43, 58, 152 | alert-copy, wrapping the vnext version (`baseV...`) | **KEEP**: live through saved reference |
| `ownKeys`, `_objectSpread`, `_defineProperty`, `_toPropertyKey`, `_toPrimitive` | core, radar, alerts, vnext, alert-copy (identical compiler helpers) | last loaded | **KEEP**: each file must stand alone for the base tests |

`background.js:27 inflate` is text inside the worker source, not an override. Never referenced anywhere (runtime, `qa/`, workflows), not overrides: `compactTime` core:199, `utcTime` core:205, `keyTime` core:243, `vLightningAtHome` vnext:75.

## 2. Removal plan

One commit per step. Each commit bumps the `?v=` token and `data-version`/`data-release`/`data-build` in `index.html`, and passes the gate in section 3. No workflow or test file changes in steps 1-6.

| Step | Delete | Lines | Why it is dead |
|---|---|---|---|
| 1 | `compactTime`, `utcTime`, `keyTime` (core.js); `vLightningAtHome` (vnext.js) | 37 | zero references in the repository |
| 2 | `render = function` in alerts.js:441-473 and hidpi.js:295-328 | 67 | overwritten by vnext.js:679 before `app.js` runs; binding stays from enterprise-ui.js |
| 3 | `eHeader` alerts:378-440, `eHazardText` alerts:341-377, `eWarningLabels` alerts:242-276 | 135 | overwritten by vnext.js:671-674; earlier declarations keep the bindings |
| 4 | alert-copy.js:80-149, the whole `if (typeof vHeader ...)` block | 70 | its `vHeader` is replaced by clarity.js:15, `eHeader` by clarity.js:55 |
| 5 | alert-copy.js:166-222 (comment and legacy card block), vnext.js:676-678 | 60 | after step 2 nothing calls `eAlertSummaryBox`; alerts.js:296 stays for the workflow grep |
| 6 | vnext.js bodies of `vStormTracks`, `vStormFocus`, `vExpiry`, `vHeader`, `vFooter`; add one line `var vStormTracks, vStormFocus, vExpiry, vHeader, vFooter; // assigned in vnext-motion.js and clarity.js` | 232, +1 | replaced without being saved. Needs step 4 first. **Owner decision A** |

Steps 1-5: 13 definitions, about 370 lines. With step 6: 18 definitions, about 600 of 4,399 lines. `render` is then assigned twice (enterprise-ui.js, vnext.js), not once.

**Step 7, not recommended now (owner decision B).** Reaching "`render` assigned once" means changing `qa/hang-regression.html` to load the production script list (as `qa/replay.html` does), changing vnext.js:679 to `var render = vRender;`, then deleting the enterprise-layer `render`, `eHeader`, `eFooter`, `eHomeText`, `eHazardText`, `eSevereSymbols`, `eCityLabels`, `eStormFocus`, `eWarningLabels` and their alias lines, plus retiring or repairing `qa-v8.yml`. About 350 more lines, but it changes what two regression tests exercise and edits workflows. It needs its own design.

## 3. Proof of no visible change

No deterministic path exists today. `qa/replay.html` + `qa/replay.js` render the real stack from `qa/fixture.json` without network, and accept both the `qa-capture.yml` fixture and `fixture-compact.json` from `qa/office-playback.cjs`, but they use the real clock. Clock-dependent pixels: `ageMs()`/`freshness()` (core.js:193), the 6 s footer alternation (clarity.js:37), alert expiry (alerts.js:40), and animation driven by `performance.now()` (lightning symbols, `eRadar` transition).

**New script `qa/pixel-freeze.mjs`** (puppeteer-core, same server code as `qa/view-capture.mjs`). Not a runtime file, so no token bump for it.

- `node qa/pixel-freeze.mjs render <fixture.json> <outDir>`; env `RDR_ROOT` (checkout to serve, default this repo), `CHROME`. `node qa/pixel-freeze.mjs compare <dirA> <dirB>` exits 1 on any difference and lists the differing state names.
- Launch flags: `--no-sandbox --disable-gpu --force-color-profile=srgb --font-render-hinting=none --disable-lcd-text --lang=en-US`; `page.emulateTimezone('America/New_York')`.
- Request interception: `/qa/fixture.json` is answered with the fixture file; any request not to the local server is aborted and makes the run fail.
- `evaluateOnNewDocument`: replace `Date` with a subclass whose no-argument constructor and `Date.now()` return a settable value; `performance.now()` returns a settable value; `Math.random = () => 0.5`; `requestAnimationFrame = () => 0`. Expose `__setNow(ms)` and `__setPerf(ms)`. `T0` = time of the newest fixture frame + 120000.
- For each view (home, metro, florida, regional) and device scale 1 and 2: open `qa/replay.html?view=<id>` at 456 x 257, wait for `__QA__.ready === true`, then for each state: set `state.cursor`, `state.transition = null`, the clocks; when alerts or frames changed also `state.alertRevision++; invalidateAlertCache(); V_MOTION_CACHE.clear(); eCellCache.clear(); ePeakCache.clear()`; call `render(perf)` three times; the 2nd and 3rd results must be equal.
- States (15 per view and scale, 120 total): cursor {0, middle, last} x clock {(T0, 1000), (T0+6000, 1750)} x alerts {as recorded, synthetic}; plus stale (`T0` + 3 h), no frames (`state.frames = []`), degraded (`panel.dataset.radar = 'degraded'`). Synthetic alerts: the two features of `vnext-qa.yml` line 77 (`qa-svr`, `qa-adv`) plus a tornado warning box around `CFG.home`, all expiring at `T0` + 45 min. If the recorded frames are dry, the synthetic states also write a 52 dBZ disc (value 520, radius 14 px, centre moving 3 px per frame from x=150, y=120) into each frame of the view.
- Output per state: SHA-256 of `ctx.getImageData(0, 0, canvas.width, canvas.height).data`, SHA-256 of `JSON.stringify({ux: state.ux, alertUi: state.alertUi, dataset: {...panel.dataset}})`, and the PNG from `canvas.toDataURL()` for inspection. `manifest.json` holds the hashes, the fixture hash, Chromium version, and a coverage line per view (frames, alerts in view, `ux.lightningSymbols`, `ux.motionArrows`, `ux.cityLabels`, `ux.warningLabels`). Fail on any page error, console error or `__QA__.ready !== true`.
- Pass rule: every pixel hash and state hash identical. Tolerance 0.

**Procedure.** Get one fixture before any removal and keep it outside the repository: the `rdr-local-qa-fixture` artifact, or `fixture-compact.json` from `qa/office-playback.cjs`. Then: (a) render the base commit twice from a `git worktree`; the two manifests must match, or the method is invalid; (b) in a scratch worktree change one colour in clarity.js and confirm `compare` fails; (c) after each step render the candidate and compare with (a). Also per step: the checks in CLAUDE.md, `qa/legacy-bootstrap.mjs`, the hang-regression page as run in `yodeck-hang-regression.yml`, and every grep in the "Static integrity" steps of `verify.yml`, `alert-overlays.yml`, `alert-copy-qa.yml`, `vnext-qa.yml`, `hidpi-qa.yml`. One live `qa/view-capture.mjs` run at the end is a smoke test, not proof.

**Not covered by the pixel proof:** `app.js` (animation loop, crossfade, prefetch) and `background.js` (worker decode) are not loaded by replay.html. No step touches them; the live smoke run and `legacy-bootstrap.mjs` cover boot.

## 4. Risks and stop conditions

- **Missing binding.** A deletion that removes the last declaration before a strict assignment throws at load. Caught as a page error by pixel-freeze and legacy-bootstrap.
- **Lost fallback (decision A).** Today, if `clarity.js` or `vnext-motion.js` fails to load, the older vnext.js header, footer and storm tracks still draw. After step 6 that case draws nothing and the boot fail-safe marks the panel unavailable. Steps 2-5 do not change this for vnext.js, because the alerts/hidpi renders only ran when `vnext.js` itself was missing.
- **Fixture coverage.** A quiet-weather fixture leaves storm and alert code unproven; the synthetic states and the coverage line address this. If a coverage counter is 0 in every state, say so in the commit message rather than claim proof.
- **Workflows run only after merge to `main`**, so their greps must be run by hand per step.

Stop and report, without continuing to the next step, if: the base commit does not reproduce its own hashes; any hash differs after a step; any check, grep or QA page fails; a step would need a workflow or test edit; no fixture can be obtained.
