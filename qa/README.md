# RDR visual QA

Production visual changes must not be promoted directly from an untested render.

## Gates

1. `.github/workflows/qa-capture.yml` captures a replayable live fixture from the deployed screen. The artifact contains four MRMS frames, lightning, MESH, boundaries, observations, warnings, tropical vectors, and current HOME/weather state.
2. Visual work happens on a QA branch. `qa/broadcast-v7` is the first branch using this gate.
3. The branch QA workflow renders HOME, SOUTH FLORIDA, FLORIDA, and GULF + CARIBBEAN in Chromium at exactly 456 x 257.
4. Performance is measured separately for startup paints, uncached preparation, and warm animation. Current gates are startup max <= 200 ms per single-frame view, cache preparation <= 250 ms, and warm p95 <= 16 ms. The full four-frame/severe runtime allows startup max <= 250 ms and preparation <= 350 ms.
5. Every artifact is manually inspected at native size and enlarged size before promotion.
6. After promotion, the production verifier repeats the same checks against the public GitHub Pages deployment.

## Local replay

Download the `rdr-local-qa-fixture` artifact from the capture workflow and place its `fixture.json` at `qa/fixture.json`. From the repository root, serve the checkout with any static server, for example:

```sh
python3 -m http.server 8765
```

Then open one of:

```text
http://127.0.0.1:8765/qa/replay.html?view=home
http://127.0.0.1:8765/qa/replay.html?view=metro
http://127.0.0.1:8765/qa/replay.html?view=florida
http://127.0.0.1:8765/qa/replay.html?view=regional
```

The replay page uses the actual application renderer and recorded numeric/vector state, without live network requests. It exposes `window.__RDR__` and `window.__QA__` for inspection.

## Yodeck hang regression

`qa/hang-regression.html` runs at 456 x 257 and deterministically simulates a runtime without `AbortController` or `DecompressionStream`. It returns a valid MRMS listing, stalls the GRIB response body three times and verifies that both `pollRadar` and `backfillRadar` release their mutexes while surfacing unavailable/stale state. It also stalls the fallback `fflate` script once, then verifies its next load succeeds and that decompression uses the asynchronous worker API, including cancellation of a stalled worker task. The `Yodeck polling hang regression` workflow runs this page in Chromium without external NOAA or CDN dependencies.

`node qa/cache-release-regression.mjs` is a release guard: every versioned runtime asset must share one release token, and any changed referenced JavaScript/CSS asset must receive a different token than its parent commit. This is required because an HTML refresh alone can leave a Yodeck Chromium using cached `core.js`/`radar.js` bytes.

## Local Yodeck stress

With `puppeteer-core` available and a local server running, execute `CHROME=/path/to/chrome node qa/yodeck-stress.mjs`. It runs all four live views plus the low-power full runtime under 4x CPU throttling and uncached reloads, and waits for radar/backfill work to drain after each reload. Set `RDR_LEGACY_DECOMPRESSION=1` to remove `DecompressionStream` before app scripts run and exercise the Yodeck-style fflate worker path. It captures native 456 x 257 CSS-panel screenshots. Adaptive HiDPI may use a larger canvas backing store (for example 570 x 321 at render scale 1.25); the verifier intentionally checks the CSS viewport and panel, not that implementation detail.

Do not commit `qa/fixture.json`. It is a generated artifact.
