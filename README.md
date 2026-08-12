# RDR South Florida raw-data renderer

RDR is a fixed 456 x 257 Yodeck weather instrument centered on the home location in South Florida.

## Architecture

The browser is the renderer. Weather services supply raw numeric grids or vector features only. RDR does not embed finished radar maps, satellite JPEGs, exported MapServer images, WMS map images, or third-party radar screens.

### Data ingested

- NOAA/NCEP RIDGE II MRMS compressed GeoTIFF grids for quality-controlled base and composite reflectivity.
- NOAA/NWS warning polygons from the event-driven ArcGIS feature service as GeoJSON.
- NOAA/NWS state and county reference geometry as GeoJSON.
- NOAA/NHC tropical outlook, track, cone, wind and watch/warning objects as GeoJSON.
- NOAA/NWS point/hourly forecast JSON for the home weather readout.

The GeoTIFF files are fetched, gunzipped in the browser, decoded to numeric dBZ values with geotiff.js, resampled to the current viewport, colored with the RDR palette, animated and composited on the 456 x 257 canvas. Home precipitation classification, nearest-rain distance and storm motion are computed locally from the numeric radar arrays.

## Views

- HOME
- BROWARD / MIAMI
- FLORIDA
- GULF / CUBA

All views use the same renderer and data model. They differ only in geographic extent and which raw MRMS domain is needed.
