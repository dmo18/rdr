# RDR Enterprise v8 UX Review and Product Specification

## Purpose

RDR is a fixed 456 x 257 live weather radar display for Yodeck. It is not a general weather website and it is not a miniature desktop dashboard. The screen has one job: answer the weather questions that matter at a glance while preserving enough regional context to understand what is approaching South Florida.

The v8 redesign keeps the live data engine and replaces the v7 presentation layer and several readiness/motion assumptions.

## What failed in v7

The v7 build was technically live, but its visual hierarchy was weak.

- Independent floating cards competed with the map instead of supporting it.
- Large city labels and ad hoc callouts occupied too much map area.
- A view could switch before its geography finished loading, temporarily producing radar and labels over a blank ocean.
- The boot layer could disappear as soon as radar arrived even while geographic and observation context was still loading.
- A global South Florida reflectivity centroid was used for motion and ETA. That can describe the overall radar field rather than the rain cluster relevant to HOME.
- Auxiliary values such as cloud coverage could consume prime screen space while the more useful next-hour precipitation probability was available.
- The screen attempted to show too many meteorological ideas simultaneously instead of ranking them.

## Competitive radar research

The redesign reviewed current patterns from RadarScope, Apple Weather, MyRadar, The Weather Channel / Storm Radar, Windy, RainViewer, Zoom Earth, Weather & Radar, and the National Weather Service radar interface.

Useful patterns retained:

- RadarScope: radar first, high information density, product time and legend remain obvious, warnings are overlays rather than a competing dashboard.
- Apple Weather: a full-screen map with a simple time/animation treatment and direct next-hour precipitation context.
- MyRadar: local impact and rain-arrival information is more useful than generic meteorological decoration.
- The Weather Channel / Storm Radar: full-screen radar, hazard layers, local precipitation timing, and selected storm-detail callouts.
- Windy and Zoom Earth: combine large-scale weather context with focused hazard/tropical overlays, while the map remains the primary visual object.
- RainViewer: make freshness obvious and keep rain intensity and location impact easy to read.
- NWS Radar: organize views around a task or goal, display product time, legend, loop control, and warnings directly with the radar.
- Weather & Radar: concise presentation and hazard notification are more valuable than an overloaded map.

Research references:

- https://www.radarscope.app/
- https://support.apple.com/guide/iphone/check-the-weather-iph1ac0b35f/ios
- https://www.myradar.com/
- https://weather.com/
- https://www.windy.com/
- https://www.rainviewer.com/
- https://zoom.earth/maps/radar/
- https://www.weatherandradar.com/apps/
- https://radar.weather.gov/
- https://www.weather.gov/radarfaq/

## V8 information hierarchy

The 456 x 257 screen is divided into three permanent zones.

### 1. Header, 29 px

The header answers identity, freshness, and current conditions.

- RDR and active geographic scale
- MRMS reflectivity product identity
- live/delayed/stale state
- exact latest MRMS scan time and age
- HOME warning emphasis only when applicable
- current temperature and clock
- current wind and humidity
- next-hour precipitation probability when available

No floating cards are used.

### 2. Radar map, 191 px

The map remains the dominant object.

- dark low-noise geographic base
- state and county boundaries
- live MRMS composite reflectivity
- HOME marker
- small collision-aware city labels
- TOR, SVR, and FFW warning polygons
- restrained lightning and MESH indicators
- no generic advisory clutter
- no station-model clutter
- no synthetic cloud visualization
- NHC tropical vectors only when useful in the Gulf and Caribbean view
- at most two high-value strong-cell callouts
- a subtle nearest-rain marker on the local views, without a long connector or motion arrow

### 3. Decision footer, 37 px

The footer contains three stable questions.

- HOME IMPACT: dry/raining state, local dBZ, nearest rain direction/distance, ETA only when defensible
- RADAR LOOP: frame position, displayed UTC time, and a compact dBZ legend
- HAZARDS: highest-priority warning, lightning probability, MESH hail, or tropical context for the active view

## View purposes

Each automatic scale is a task, not just a zoom level.

### NEIGHBORHOOD

Answer: Is it raining at HOME, and what is the closest rain?

### SOUTH FLORIDA

Answer: What is moving through the metro and from which direction can weather approach HOME?

### FLORIDA

Answer: What is happening across the state that may matter later today?

### GULF + CARIBBEAN

Answer: What larger weather or tropical system could influence Florida?

## Data and rendering architecture

The production page continues to render from live machine-readable data.

- NOAA MRMS S3 GRIB2 reflectivity is requested by the display at runtime.
- GRIB2 Data Representation Template 5.41 PNG packing is decoded in the browser.
- MRMS lightning probability and MESH are decoded as numeric grids.
- NWS state/county reference features are requested as GeoJSON.
- NWS warning polygons are requested as GeoJSON.
- NHC tropical geometry is requested as GeoJSON.
- NWS/MADIS surface observations and api.weather.gov current/hourly context remain live inputs.
- No finished radar image, scheduled weather snapshot, or republished stale current data is part of the production path.

## Correctness changes in v8

### Readiness barrier

A scale is not shown until its geography and observations have been requested. Initial boot is not dismissed until both the radar request and context refresh have settled. Remaining geographic scales are prefetched in the background.

This eliminates the blank-geography transition seen in v7.

### Local motion and ETA

The previous motion estimate used the weighted centroid of the entire metro radar field. V8 first attempts to track the local precipitation cluster near the latest nearest-rain point, then falls back to the broader centroid only when the local cluster cannot be resolved.

ETA is only emitted when nearest rain exists, tracked motion has a meaningful closing component toward HOME, the direction difference is less than 55 degrees, closing speed exceeds 3 mph, range is under 150 miles, and the estimate is under three hours.

The map no longer draws a motion vector. Motion is used for the decision answer, not decoration.

## Visual rules

- Exact output size: 456 x 257.
- One map, no multi-panel dashboard.
- Header and footer are full-width structural bands, not floating glass cards.
- No text outline spikes.
- No heavy glow around labels.
- No fake cloud/satellite treatment.
- No generic WX boxes.
- No map UI that looks clickable on a non-interactive Yodeck display.
- Keep decorative contrast lower than radar and warnings.
- Reserve saturated color for radar, active warnings, HOME, and meaningful hazards.
- Labels are clipped by collision rules and may disappear rather than overlap a hazard.

## Release gates

A candidate does not reach `main` until all of the following pass on the isolated QA branch.

- JavaScript syntax checks.
- Exact 456 x 257 Chromium viewport and panel dimensions.
- Live MRMS frame loaded and less than 15 minutes old.
- State geography is present for every view before capture.
- Surface observation context is present for every view.
- No browser errors.
- Startup paint max remains bounded.
- Explicit cold cache preparation remains bounded.
- Warm paint p95 remains inside the 15 fps animation budget.
- Full runtime loads at least four radar frames plus lightning and MESH.
- Automated visual checks reject blank geography and mostly empty images.
- Native-size and enlarged screenshots are manually inspected.
- Production Pages must then pass the same gates after deployment.

## V8 completion definition

V8 is complete only when the isolated branch, public Pages deployment, live four-view captures, full severe runtime, performance diagnostics, and manual visual review all pass. A successful source commit by itself is not completion.
