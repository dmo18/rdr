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

## V8 changes

- Replaces floating-card broadcast-v7 presentation.
- Adds a full-width structural header and decision footer.
- Keeps the radar map as the dominant visual surface.
- Adds next-hour precipitation probability when available.
- Removes synthetic cloud rendering and station-model clutter from production presentation.
- Removes map motion arrows and long nearest-rain connectors.
- Limits warning rendering to TOR, SVR, and FFW.
- Limits strong-cell callouts.
- Fixes geography readiness before scale changes.
- Fixes initial readiness so boot does not disappear on radar-only success.
- Uses local-cluster motion before global-field fallback for HOME ETA.
- Adds blank-geography automated release checks.

## Rollout state

The current public build remains v7 until enterprise-v8 passes the isolated QA workflow and manual capture review. Promotion to `main` must be atomic with the production verifier update.
