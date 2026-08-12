# RDR South Florida

RDR is a fixed 456 x 257 Yodeck weather instrument centered on 26.06197904865014, -80.18787062578414.

The production radar is generated in the browser from NOAA MRMS GRIB2 data. The page lists the current public MRMS objects from the NOAA Open Data S3 bucket, downloads the newest quality-controlled composite reflectivity field, expands the GRIB2 gzip stream, decodes GRIB2 Data Representation Template 41 PNG packing, reconstructs the numeric grid values, resamples them into the four display scales, and applies the RDR color table locally. The application does not depend on a finished third-party radar image or a scheduled snapshot pipeline.

## Display model

The screen is one radar-first instrument with four automatic scales:

- HOME, immediate neighborhood and home rain state
- BROWARD / MIAMI, South Florida metro
- FLORIDA, peninsula scale
- GULF / CUBA, Gulf, Florida, Cuba, Bahamas and Yucatan context

Radar history backfills after the newest frame is visible, then loops automatically. The current home classification, nearest rain, derived storm motion and a conservative radar-based ETA are calculated from the numeric MRMS fields. Live severe-weather context can include MRMS 30-minute lightning probability and MESH hail estimates. NWS warning polygons, NWS reference boundaries, NHC tropical forecast vectors and the latest nearby NWS surface observation are fetched as vector or observation data and rendered by the page.

## Freshness behavior

The HUD exposes the actual MRMS observation timestamp and classifies the feed as live, delayed or stale. There is no stale-radar fallback. If the live MRMS source cannot be acquired, the screen explicitly reports that the live feed is unavailable.

## Test views

Append one of these query parameters to hold a scale for verification:

- `?view=home`
- `?view=metro`
- `?view=florida`
- `?view=regional`

The deployed GitHub Pages URL is `https://dmo18.github.io/rdr/`.
