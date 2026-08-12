# RDR South Florida Weather HUD

A fixed **456 x 257** unattended Yodeck weather instrument centered on `26.06197904865014, -80.18787062578414`.

The 456 x 257 geometry is intentional and must remain hardcoded for the target Yodeck region. The application scales that exact canvas uniformly when previewed elsewhere.

## Product model

RDR is one automatic weather HUD. It uses the full canvas and rotates through weather views without touch, mouse, keyboard, or other user interaction.

1. **HOME**: neighborhood radar plus exact home precipitation state, nearest rain, and a four-hour forecast strip.
2. **BROWARD / MIAMI**: metro radar with the same home and short-range weather context.
3. **FLORIDA**: peninsula-scale quality-controlled radar and active warning polygons.
4. **GULF / CUBA**: regional radar across the Gulf, Florida, Cuba, the Keys, and the Bahamas.
5. **SATELLITE**: live GOES East Southeast geocolor imagery for clouds.
6. **LIGHTNING**: live GOES East GLM flash-extent-density imagery.
7. **TROPICS**: NHC seven-day development outlook plus active tropical cyclone forecast tracks, cones, watches, warnings, and wind fields on an Atlantic basemap.

Views rotate automatically in about one minute. `?view=home`, `?view=metro`, `?view=florida`, `?view=regional`, `?view=satellite`, `?view=lightning`, and `?view=tropics` force a view for testing. `?demo=1` supplies deterministic local data for layout testing when public data services are unavailable.

## Always-visible intelligence

- HOME precipitation classification: `DRY`, `SPRINKLE`, `RAIN`, `HEAVY`, or `INTENSE`.
- Estimated nearest-rain distance and bearing when HOME is dry.
- Current hourly temperature and compact weather code.
- Next four hourly temperature, precipitation probability, and weather state on local views.
- NWS grid sky-cover percentage.
- Thunderstorm presence in the next four NWS hourly periods.
- Active NWS alert summary for the home point.
- Radar-loop range and latest frame time.

## Public resources

No paid service, account, API key, token, or registration is required.

- NOAA/NWS OpenGeo WMS quality-controlled radar and warning services.
- NWS API hourly forecast, grid data, and point alerts.
- NOAA/NESDIS GOES East imagery for cloud and lightning views.
- NOAA/NWS/NHC tropical ArcGIS service for seven-day development outlooks, active tracks, cones, watches, warnings, and wind fields.
- CARTO dark no-label basemap tiles with OpenStreetMap geographic data.

## Deployment

GitHub Pages publishes `main` at `https://dmo18.github.io/rdr/`.
