# RDR South Florida Radar

A radar-only **456 x 257** Yodeck instrument centered on `26.06197904865014, -80.18787062578414`.

## Product model

RDR is one radar engine with four full-canvas geographic scales. It does not use cards, picture-in-picture, range-ring clutter, or wrapped reference graphics.

1. **HOME**: approximately neighborhood / immediate-area scale, using KAMX super-resolution reflectivity.
2. **BROWARD / MIAMI**: South Florida metro scale, using KAMX super-resolution reflectivity.
3. **FLORIDA**: peninsula-scale MRMS quality-controlled base reflectivity.
4. **GULF / CUBA**: regional MRMS coverage across the Gulf, Florida, Cuba, the Keys and the Bahamas.

Views crossfade automatically and radar frames animate within each scale. `?view=home`, `?view=metro`, `?view=florida`, and `?view=regional` force a scale for testing.

## Information shown

- Exact HOME precipitation classification: `DRY`, `SPRINKLE`, `RAIN`, `HEAVY`, or `INTENSE`.
- When HOME is dry, an estimated nearest-rain distance and bearing derived from the current radar image.
- Active warning polygons over the same radar map.
- Curated geographic labels appropriate to each scale rather than a dense labeled basemap.
- Radar-loop range and latest frame time in a 14-pixel telemetry strip.

## Public resources

No paid service, account, API key, token, or registration is required.

- NOAA/NWS OpenGeo WMS radar and warning services.
- CARTO dark no-label basemap tiles with OpenStreetMap geographic data.

## Deployment

GitHub Pages publishes `main` at `https://dmo18.github.io/rdr/`.
