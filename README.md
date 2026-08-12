# RDR South Florida

RDR is a fixed 456 x 257 Yodeck weather instrument built around an ingestion pipeline, not external weather-map embeds.

## Architecture

1. `.github/workflows/ingest.yml` runs every five minutes.
2. `scripts/ingest.py` downloads NOAA/NCEP MRMS compressed GeoTIFF radar grids and NOAA/NWS/NHC machine-readable vector/forecast feeds.
3. The ingest script decodes numeric reflectivity, crops/resamples it to RDR's geographic views, applies RDR's own radar palette, computes HOME precipitation state, nearest rain and motion, and normalizes warnings/tropical/forecast objects.
4. The normalized output is published under `data/` with the site.
5. `app.js` renders only those same-origin RDR data products onto the 456 x 257 canvas.

The display does not use WMS map images, ArcGIS export images, satellite JPEG wrappers, CARTO map tiles, RainViewer images or external radar screens.

## Current ingested data

- MRMS quality-controlled base reflectivity for HOME and BROWARD / MIAMI.
- MRMS composite reflectivity for FLORIDA and GULF / CUBA.
- NWS warning polygons.
- NWS state and county reference vectors.
- NHC tropical outlook, track, cone, wind-field and watch/warning vectors.
- NWS hourly forecast data.

The renderer computes and shows HOME rain classification, nearest rain and storm motion from the ingested MRMS data.
