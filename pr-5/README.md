# RDR Weather

RDR is a fixed 456 x 257 enterprise weather radar display for Yodeck, centered on 26.06197904865014, -80.18787062578414.

RDR renders weather in the browser from live machine-readable NOAA data. It lists current NOAA MRMS objects, downloads the latest quality-controlled composite reflectivity GRIB2 fields, decompresses and decodes Data Representation Template 5.41 PNG packing, reconstructs the numeric grid, resamples it to each display scale and renders the radar locally. It does not display finished third-party radar imagery and it does not use a scheduled current-weather snapshot pipeline.

## Enterprise v8

Version 8 replaces the rejected broadcast-v7 presentation with one stable information hierarchy designed specifically for a 456 x 257 always-on display.

- one dominant radar map, not a miniature dashboard
- full-width header for scale, MRMS scan time/freshness, current temperature, wind, humidity and next-hour precipitation probability
- full-width decision footer for HOME IMPACT, RADAR LOOP and HAZARDS
- native 456 x 257 reflectivity rendering with restrained smoothing that preserves storm cores
- state and county geography loaded before a view is exposed
- small collision-aware city labels
- NWS TOR, SVR and FFW polygons only
- selective MRMS lightning-probability and MESH hail indicators
- NHC tropical geometry on Gulf and Caribbean views
- HOME rain state, nearest rain and ETA only when local-cluster motion supports a defensible arrival estimate
- no synthetic cloud visualization
- no station-model clutter
- no floating glass cards
- no map motion arrow or long nearest-rain connector
- no legacy v7 presentation code in the production page

The four automatic scales are NEIGHBORHOOD, SOUTH FLORIDA, FLORIDA and GULF + CARIBBEAN. Each scale has a task: HOME impact, metro approach, statewide context, and Gulf/Caribbean context respectively.

## Live inputs

- NOAA MRMS composite reflectivity
- NOAA MRMS lightning probability
- NOAA MRMS MESH hail analysis
- NWS state and county reference geometry
- NWS active warning geometry
- NHC tropical geometry
- NWS/MADIS surface observations
- api.weather.gov current observations and hourly forecast context

The screen exposes the actual MRMS observation time and classifies the feed as live, delayed or stale. If current MRMS data cannot be acquired, RDR reports the live feed as unavailable rather than silently substituting an old radar frame.

## Rendering modules

- `enterprise-core.js`: presentation utility primitives and unavailable-state renderer
- `enterprise-map.js`: base geography, radar, warning/tropical geometry and radar analysis
- `enterprise-overlays.js`: HOME, labels, hazards and selective storm annotations
- `enterprise-ui.js`: header, decision footer, loop rail and final composition

Data acquisition and numeric decoding remain isolated in `core.js`, `radar.js` and `context.js`.

## QA and release gates

Visual work is developed on an isolated QA branch and must pass deterministic replay plus live Chromium verification at exactly 456 x 257 before promotion. The v8 gate checks:

- exact viewport and panel geometry
- current MRMS age under 15 minutes
- state geography present for every scale before capture
- surface context present for every scale
- startup, cold-preparation and warm-animation performance separately
- four-frame radar loop plus live lightning and MESH
- browser/runtime errors
- image color/occupancy checks
- a land-pixel check that explicitly rejects the blank-ocean geography regression
- native and 4x manual visual inspection
- the same gates again against the public GitHub Pages deployment after promotion

See `docs/UX-REVIEW-V8.md`, `docs/STATUS.md` and `qa/README.md`.

## Test views

- `?view=home`
- `?view=metro`
- `?view=florida`
- `?view=regional`

Production: `https://dmo18.github.io/rdr/`
