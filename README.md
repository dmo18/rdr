# RDR Weather

RDR is a fixed 456 x 257 broadcast weather radar instrument for Yodeck, centered on 26.06197904865014, -80.18787062578414.

The production radar is rendered in the browser from live NOAA MRMS GRIB2 data. RDR lists the current public MRMS objects, downloads the newest quality-controlled composite reflectivity field, decompresses the GRIB2 stream, decodes Data Representation Template 41 PNG packing, reconstructs the numeric grid, resamples it to each display view and renders the weather locally. It does not display a finished third-party radar image and it does not use a scheduled weather snapshot pipeline.

## Broadcast v7 display

Version 7 uses one full-bleed weather map rather than a dashboard frame. The visual hierarchy is intentionally close to an on-air meteorology product:

- native 456 x 257 reflectivity rendering, with spatial smoothing for continuous precipitation areas while preserving stronger storm cores
- smooth multi-frame radar animation
- state and county geography with restrained broadcast city labels
- collision-aware placement for cities, storm-core values, hail tags and warning labels
- NWS TOR, SVR and FFW polygons only, using distinct broadcast severe-weather colors instead of generic advisory clutter
- live MRMS lightning-probability and MESH hail analysis
- NHC tropical vectors on the regional products
- HOME rain state, nearest rain and ETA when the derived motion is credible
- compact translucent title/current-condition bugs and a minimal reflectivity lower third
- no synthetic cloud texture, no station-model clutter and no half-resolution radar upscale

The four automatic scales are NEIGHBORHOOD, SOUTH FLORIDA, FLORIDA and GULF + CARIBBEAN.

## Freshness

The display exposes the actual MRMS observation time and classifies the feed as live, delayed or stale. If current MRMS data cannot be acquired, the screen explicitly reports that the live feed is unavailable rather than silently substituting an old radar frame.

Surface observations come from NOAA/NWS feature data. Warnings, reference geography, tropical vectors and current conditions are all queried as machine-readable data and rendered by RDR.

## Visual QA

Visual changes are no longer promoted directly from an untested renderer. The repository now has a replayable QA path documented in `qa/README.md`:

- capture a real live state fixture, including radar history, lightning, MESH, geography, observations, warnings and tropical data
- replay the fixture locally without network dependencies
- test candidate visuals on an isolated QA branch
- render every view in Chromium at exactly 456 x 257
- measure startup paint, uncached preparation and steady animation separately
- inspect native and enlarged screenshots before promotion
- repeat the same verification against the public GitHub Pages deployment after promotion

## Test views

- `?view=home`
- `?view=metro`
- `?view=florida`
- `?view=regional`

Production: `https://dmo18.github.io/rdr/`
