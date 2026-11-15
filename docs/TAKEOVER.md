# Takeover audit (2026-11-15)

## What it is

A static web page (GitHub Pages) shown on a Yodeck signage screen at a fixed
456 x 257 pixels. It downloads public NOAA/NWS weather data in the browser,
decodes the radar itself, and draws everything on one canvas. No server, no
accounts, no secrets, no personal data.

## Main parts

| File | Job |
|---|---|
| `index.html` | Page shell, boot fail-safe, loads scripts in order with one cache token |
| `core.js` | Config, network fetch with timeouts, compatibility shims, inflater fallback |
| `radar.js` | MRMS listing, GRIB2 download and decode, radar history |
| `context.js` | Weather.gov current conditions and forecast |
| `enterprise-*.js` | Base map, radar drawing, overlays, header/footer |
| `alerts.js`, `alert-copy.js` | NWS warnings and their wording |
| `hidpi.js` | Sharper drawing on high-density screens, image cache budgets |
| `vnext.js`, `vnext-motion.js` | Current presentation layer (the active `render`) |
| `background.js` | Background decoder worker |
| `clarity.js` | Readability adjustments |
| `app.js` | Startup, polling, playback loop |

Each later script overrides parts of earlier ones. `render` is reassigned four
times (`enterprise-ui.js`, `alerts.js`, `hidpi.js`, `vnext.js`); only the
`vnext.js` one runs.

## How to run

1. `python3 -m http.server 8765 --bind 127.0.0.1` in the repo folder.
2. Open `http://127.0.0.1:8765/?view=home` (also `metro`, `florida`, `regional`) at 456 x 257.

## Checks (baseline, all passing)

- `node qa/continuous-regression.mjs`
- `node qa/decoder-regression.mjs`
- `node qa/legacy-compat.mjs`
- `node qa/cache-release-regression.mjs` (needs `RDR_RELEASE_BASE=origin/main` locally)
- `CHROME=<chromium path> node qa/legacy-bootstrap.mjs` (needs `puppeteer-core` and the local server on port 8765)
- `node --check` on every runtime script

No package.json, linter or build step. All browser QA lives in GitHub Actions and
runs only on pushes to `main` or by hand, never on pull requests.

## Known issues and risks

- (Fixed 2026-11-15, task 2) Runtime loaded `fflate@0.8.2` from cdn.jsdelivr.net (fallback decompression
  only) with no integrity check. A CDN compromise would run code on the display.
- CI installs `puppeteer-core` unpinned in 7 of 8 browser workflows.
- No checks run on pull requests, so a change is only tested after it reaches `main`.
- Page attribute `data-surface` stayed `loading` on 3 of 4 views during a live render.
- 13 old remote branches; 7 are fully merged into `main`.
- Stacked overrides make it hard to know which code is live.
- Never verified on the physical office Pi (Chromium 92) from this environment.

## Project-supplied tools

None. No `.claude/` folder, hooks, skills, MCP config or CLAUDE.md came with the repo.
