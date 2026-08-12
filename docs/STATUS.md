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
| Current weather | api.weather.gov | JSON | retained |
| Hourly precipitation probability | api.weather.gov | JSON | promoted in v8 header |
| Surface observations | NWS/MADIS | ArcGIS GeoJSON | retained as context, removed from visual clutter |

## V8 implementation

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
- Changed HOME motion/ETA to try a local precipitation cluster before global-field fallback.
- Added a closing-speed and direction test before ETA is emitted.
- Added blank-geography automated release checks.
- Split the presentation into `enterprise-core.js`, `enterprise-map.js`, `enterprise-overlays.js` and `enterprise-ui.js`.
- Removed the rejected `broadcast.js` renderer and legacy `render.js` presentation path from the v8 branch.

## Isolated live QA result

Branch: `qa/enterprise-v8`

The first complete live Chromium pass succeeded at exact 456 x 257 on all four views, including current NOAA data, geography, surface context and a full four-frame severe-runtime test.

Observed warm paint p95 was about 1.0 to 1.1 ms per single-frame view. The full four-frame runtime was about 2.2 ms p95 with lightning and MESH loaded. The automated visual gate also verified land pixels in every view so the blank-ocean regression cannot pass silently.

Native and 4x HOME, SOUTH FLORIDA, FLORIDA, GULF + CARIBBEAN and full-runtime captures were manually inspected and accepted for the enterprise-v8 direction.

## Rollout state

V8 has passed the first isolated live QA and manual visual review. Code cleanup and production verifier hardening are in progress. Public `main` remains v7 until a final cleaned v8 branch run passes. Promotion must then be atomic, followed by the full public Pages verification and manual production screenshot review.
