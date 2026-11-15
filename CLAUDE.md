# RDR Weather

Static GitHub Pages site for a Yodeck signage screen. The browser downloads public
NOAA/NWS data, decodes MRMS radar GRIB2 itself and draws one canvas.
No server, secrets, accounts or personal data. `main` is the live screen.

## Hard rules

- Fixed viewport **456 x 257**. Judge every render at exactly that size; nothing may overflow.
- Must run on the office Pi (Chromium 92). `node qa/legacy-compat.mjs` enforces allowed syntax/APIs.
- Changing any runtime `.js`/`.css` requires bumping the shared `?v=` token (and
  `data-version`/`data-release`/`data-build`) in `index.html`.
- Do not change `data-ui="vnext-2026.10.23.2"` or `data-copy="alert-copy-2026.10.23.2"`
  unless the workflows that pin them change too.
- No runtime code from third-party hosts. Vendored libraries live in `vendor/`.
- Merging to `main` puts changes on the live screen. The owner gave standing
  approval (2026-11-15) for Claude to merge its own PRs once PR checks are green,
  there are no conflicts, and no critical/high review findings are open.

## Run

```
python3 -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/?view=home   (also metro, florida, regional)
```

## Checks (run before every commit)

```
for f in *.js qa/*.js; do node --check "$f"; done
node qa/continuous-regression.mjs
node qa/decoder-regression.mjs
node qa/legacy-compat.mjs
RDR_RELEASE_BASE=origin/main node qa/cache-release-regression.mjs
CHROME=<chromium path> node qa/legacy-bootstrap.mjs   # needs puppeteer-core and the server on 8765
```

Browser QA needs `puppeteer-core@25.9.0` (install outside the repo, `--no-save`).
In the cloud sandbox Chromium is `/opt/pw-browsers/chromium-*/chrome-linux64/chrome`.
`.github/workflows/pr-checks.yml` runs these on every pull request.

## Layout

Scripts load in `index.html` order; later files override earlier ones. Only the
`render` assigned in `vnext.js` runs. Map overlays: `enterprise-overlays.js`;
labels and composition: `vnext.js`; data: `core.js`, `radar.js`, `context.js`.

Docs: `docs/STATUS.md` (state, decisions), `docs/PLAN.md` (current plan),
`docs/TAKEOVER.md` (audit), `qa/README.md` (QA scripts).
