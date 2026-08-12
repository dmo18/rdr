# RDR Weather

RDR is a fixed 456 x 257 broadcast-style weather radar instrument for Yodeck, centered on 26.06197904865014, -80.18787062578414.

The production radar is generated in the browser from live NOAA MRMS GRIB2 data. The page lists the current public MRMS objects, downloads the newest quality-controlled composite reflectivity field, decompresses the GRIB2 stream, decodes Data Representation Template 41 PNG packing, reconstructs the numeric grid, resamples it into the active view and applies the local radar color table. It does not display a finished third-party radar image and it does not use a scheduled weather snapshot pipeline.

## Broadcast display model

The interface is designed as a compact broadcast meteorology screen rather than a consumer weather app. Every scale carries one authoritative map with a consistent enterprise information hierarchy:

- classic reflectivity with a high-definition crisp layer and restrained bloom
- state and county geography with broadcast city labels and map scale
- radar core callouts showing local dBZ maxima
- NWS warning polygons with TOR, SVR, FFW and flood tags
- MRMS lightning-probability and MESH hail callouts
- precipitation-motion track vector for the local South Florida views
- NWS/MADIS station-model plots using cloud-cover circles, temperature/dew point and wind barbs
- a HOME IMPACT panel with current rain state, nearest rain and conservative ETA when available
- a CURRENT panel with temperature, condition, wind, humidity and the next-hour NWS precipitation probability
- a live header with MRMS observation time and a bottom radar-loop rail with reflectivity legend, frame position and data freshness
- NHC tropical vectors on the regional products

The four automatic scales are NEIGHBORHOOD, SOUTH FLORIDA, FLORIDA and GULF + CARIBBEAN.

## Freshness

The HUD exposes the actual MRMS observation timestamp and classifies the feed as live, delayed or stale. If current MRMS data cannot be acquired, the display explicitly reports the live feed as unavailable rather than silently substituting an old radar frame.

Surface observations come from NOAA/NWS MADIS map-service feature data. RDR queries the live observation scale bands directly and renders the station models itself.

## Test views

- `?view=home`
- `?view=metro`
- `?view=florida`
- `?view=regional`

Production: `https://dmo18.github.io/rdr/`
