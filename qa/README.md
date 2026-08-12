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

Do not commit `qa/fixture.json`. It is a generated artifact.
