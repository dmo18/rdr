# RDR South Florida Radar

A single-purpose 456 x 257 radar panel for Yodeck.

Default target location: `26.06197904865014, -80.18787062578414`.

## Product

The deployed page is intentionally radar-only. There are no forecast cards, current-condition widgets, alert rotations, headers, navigation controls, or generic weather dashboard screens.

The visual hierarchy is:

1. Edge-to-edge animated Miami KAMX NEXRAD base reflectivity.
2. A precise target reticle for the configured location.
3. A 17-pixel telemetry strip with live state, radar station, product, and the last successful image-load timestamp.

## Data source

The browser loads NOAA/National Weather Service radar images directly:

- `https://radar.weather.gov/ridge/standard/KAMX_loop.gif`
- fallback frame: `https://radar.weather.gov/ridge/standard/KAMX_0.gif`

No account, API key, token, registration, package dependency, or paid service is required.

## Deployment

GitHub Pages publishes from `main` at `https://dmo18.github.io/rdr/`.

The verification workflow probes the NOAA GIFs, renders the page locally at exactly 456 x 257, waits for the matching Pages deployment, then renders and verifies the public URL at exactly 456 x 257. Render screenshots are saved as a GitHub Actions artifact.
