# RDR South Florida Radar

A single-screen **456 x 257** radar instrument for Yodeck.

Default home point: `26.06197904865014, -80.18787062578414`.

## Product design

The page is one continuous radar display, not a carousel of external graphics.

- Main map: clean MRMS quality-controlled base reflectivity centered on the home point so precipitation is visually separated from non-weather clutter.
- Local fallback: KAMX super-resolution base reflectivity if the MRMS mosaic is unavailable.
- Recent-frame animation: uses the WMS time dimension when the radar service exposes it.
- Home context: fixed HOME reticle plus 10-mile and 25-mile range rings. The HOME readout classifies the radar value at the house as DRY, SPRINKLE, RAIN, HEAVY, or INTENSE.
- Hazard context: short-fuse NWS warning polygons are drawn on the same radar map.
- Regional context: an integrated Florida / Gulf / Cuba / Bahamas inset combines CONUS and Caribbean MRMS radar mosaics so upstream rain is visible without leaving the local map.
- Basemap: aggressively darkened OpenStreetMap tiles for city, road, coastline, and place context without overpowering precipitation.
- Telemetry: one 18-pixel status line with radar mode, source state, warnings, and latest frame time.

## Public data

No account, token, key, registration, or paid service is required.

The app uses public NOAA/NWS OGC WMS services for radar and warnings and public OpenStreetMap tiles for geographic context.

## Deployment

GitHub Pages publishes `main` at `https://dmo18.github.io/rdr/`.

The verification workflow checks the WMS products directly, renders the application locally at exactly 456 x 257, waits for the matching Pages deployment, then renders and validates the deployed public page at exactly 456 x 257.
