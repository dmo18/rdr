# RDR Status

## Product target

- Display: Yodeck
- Fixed viewport: 456 x 257
- Primary location: 26.06197904865014, -80.18787062578414
- Product type: always-on live radar status display
- Production UX: enterprise-v8
- Public version marker: 2026.08.12.8

## Live data engine

| Capability | Source | Production path | Status |
|---|---|---|---|
| Reflectivity | NOAA MRMS | S3 GRIB2, browser decoded | live production |
| Radar loop | NOAA MRMS | recent GRIB2 objects | live production |
| Lightning probability | NOAA MRMS | GRIB2 numeric grid | live production |
| Hail / MESH | NOAA MRMS | GRIB2 numeric grid | live production |
| State/county geography | NWS | ArcGIS GeoJSON | live production |
| Severe warnings | NWS | ArcGIS GeoJSON | live production |
| Tropical geometry | NHC/NWS | ArcGIS GeoJSON | live production |
| Current weather | api.weather.gov | JSON quantitative values | live production, unit handling corrected |
| Hourly precipitation probability | api.weather.gov | JSON | live production |
| Surface observations | NWS/MADIS | ArcGIS GeoJSON | live context input |

## Enterprise v8 implementation

- Replaced the floating-card broadcast-v7 presentation.
- Added one full-width structural header and one decision footer.
- Kept the radar map as the dominant visual surface.
- Promoted next-hour precipitation probability when available.
- Removed synthetic cloud rendering and station-model clutter from presentation.
- Removed map motion arrows and long nearest-rain connectors.
- Limited warning rendering to TOR, SVR and FFW.
- Limited strong-cell callouts and made labels collision-aware.
- Fixed geography readiness before scale changes.
- Fixed initial readiness so boot cannot disappear on radar-only success.
- Added background geography prefetch for upcoming scales.
- Separated critical radar/geography readiness from optional enrichment feeds.
- Added bounded network request timeouts so a slow upstream subservice cannot freeze the display.
- Parallelized NHC tropical layer requests instead of waiting for ten serial requests.
- Changed HOME motion/ETA to try a local precipitation cluster before global-field fallback.
- Added a closing-speed and direction test before ETA is emitted.
- Corrected NWS observation wind conversion by honoring `unitCode`; the old code treated km/h values as m/s.
- Added blank-geography automated release checks.
- Split presentation into `enterprise-core.js`, `enterprise-map.js`, `enterprise-overlays.js` and `enterprise-ui.js`.
- Removed the rejected `broadcast.js` renderer and legacy `render.js` presentation path.

## Isolated QA acceptance

The isolated `qa/enterprise-v8` branch passed full live Chromium QA at exact 456 x 257 on all four views and the full production-style runtime before promotion.

Accepted single-view measurements from the final design QA:

- NEIGHBORHOOD: startup preparation 96.7 ms, visible startup paint max 19.8 ms, warm p95 0.8 ms.
- SOUTH FLORIDA: startup preparation 96.1 ms, visible startup paint max 20.7 ms, warm p95 0.8 ms.
- FLORIDA: startup preparation 102.8 ms, visible startup paint max 40.9 ms, warm p95 0.9 ms.
- GULF + CARIBBEAN: startup preparation 106.8 ms, visible startup paint max 41.6 ms, warm p95 1.0 ms.

The isolated full runtime loaded four radar frames, lightning probability and MESH with no browser or decoder errors.

## Public production verification

The exact tested v8 branch was fast-forwarded to `main`. GitHub Pages published version 2026.08.12.8 and the public deployment passed the same live Chromium, geometry, geography, performance and severe-runtime gates.

Public production measurements from the accepted deployment:

- NEIGHBORHOOD: ready 4.59 s, startup preparation 125.9 ms, startup paint max 25.5 ms, warm p95 1.0 ms.
- SOUTH FLORIDA: ready 4.72 s, startup preparation 117.0 ms, startup paint max 25.8 ms, warm p95 1.1 ms.
- FLORIDA: ready 4.51 s, startup preparation 143.2 ms, startup paint max 57.4 ms, warm p95 1.1 ms.
- GULF + CARIBBEAN: ready 5.57 s, startup preparation 138.2 ms, startup paint max 59.0 ms, warm p95 1.1 ms.
- Full four-frame runtime: ready 8.50 s, startup preparation 141.4 ms, startup paint max 60.3 ms, warm p95 3.4 ms, warm max 4.3 ms.

Production verification confirmed:

- exact 456 x 257 viewport and panel
- current MRMS data under the freshness limit
- state geography present in every view
- surface context present in every view
- four decoded radar frames in full runtime
- MRMS lightning probability loaded
- MRMS MESH loaded
- corrected NWS observation wind conversion
- no browser errors
- no runtime or GRIB decoder errors
- blank-geography regression gate passed
- automated visual occupancy/color gates passed
- public HOME, SOUTH FLORIDA, FLORIDA, GULF + CARIBBEAN and full-runtime captures manually inspected at native size and 4x enlargement

## Rollout state

Enterprise v8 is the verified public production build on `main` and GitHub Pages.
