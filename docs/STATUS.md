# RDR Status

## Product target

- Display: Yodeck
- Fixed viewport: 456 x 257
- Primary location: 26.06197904865014, -80.18787062578414
- Product type: always-on live radar status display
- UX direction: enterprise-v8

## Live data engine

| Capability | Source | Production path | Status |
|---|---|---|---|
| Reflectivity | NOAA MRMS | S3 GRIB2, browser decoded | retained |
| Radar loop | NOAA MRMS | recent GRIB2 objects | retained |
| Lightning probability | NOAA MRMS | GRIB2 numeric grid | retained |
| Hail / MESH | NOAA MRMS | GRIB2 numeric grid | retained |
| State/county geography | NWS | ArcGIS GeoJSON | retained |
| Severe warnings | NWS | ArcGIS GeoJSON | retained |
| Tropical geometry | NHC/NWS | ArcGIS GeoJSON | retained |
| Current weather | api.weather.gov | JSON quantitative values | retained, unit handling corrected |
| Hourly precipitation probability | api.weather.gov | JSON | promoted in v8 header |
| Surface observations | NWS/MADIS | ArcGIS GeoJSON | retained as context, removed from visual clutter |

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

## Final isolated QA acceptance

Branch: `qa/enterprise-v8`

Final full live Chromium QA passed at exact 456 x 257 on all four views and the full production-style runtime.

Latest accepted single-view measurements:

- NEIGHBORHOOD: startup preparation 96.7 ms, visible startup paint max 19.8 ms, warm p95 0.8 ms.
- SOUTH FLORIDA: startup preparation 96.1 ms, visible startup paint max 20.7 ms, warm p95 0.8 ms.
- FLORIDA: startup preparation 102.8 ms, visible startup paint max 40.9 ms, warm p95 0.9 ms.
- GULF + CARIBBEAN: startup preparation 106.8 ms, visible startup paint max 41.6 ms, warm p95 1.0 ms.

Latest accepted full runtime:

- 4 decoded radar frames
- MRMS lightning probability loaded
- MRMS MESH loaded
- startup preparation 118.3 ms
- visible startup paint max 43.4 ms
- warm paint p95 4.3 ms
- warm paint max 10.6 ms
- no browser errors
- no runtime/decoder errors

The live current-weather conversion test reported 9 mph at KFLL after the unit fix, instead of the erroneous 41 mph produced by the old conversion.

Automated visual QA verified state geography in every view, exact geometry, sufficient map occupancy/color, stable structural header/footer bands and nonblank land. HOME, SOUTH FLORIDA, FLORIDA, GULF + CARIBBEAN and full-runtime captures were manually inspected at native size and 4x enlargement after the cleaned build.

## Rollout state

Enterprise v8 has completed isolated design, implementation, correctness, live-data, performance and visual QA. The next action is atomic promotion of the exact tested branch head to `main`, followed by the same local and public GitHub Pages verification and a final manual review of the public captures before delivery is reported.
