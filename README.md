# RDR Weather Operations

A purpose-built unattended weather display for a 640 x 480 HUD or embedded screen.

Default location: `26.06197904865014, -80.18787062578414` (Broward County, Florida).

## Runtime design

The deployed product is plain HTML, CSS, and JavaScript. It has no build step, no framework, no package manager, no CDN JavaScript, no account requirement, no API key, and no secret configuration.

Anonymous public resources used by the browser:

- Open-Meteo free/open-access forecast endpoint for current, hourly, and 15-minute guidance.
- National Weather Service public alert endpoint for official local watches and warnings.
- RainViewer free public radar metadata and radar imagery.
- OpenStreetMap public raster tiles for geographic context.

The UI remains usable when any of those sources fail. Last successful weather and alert data are cached locally, map and radar failures degrade to a readable status panel, and the display never replaces the whole application with an error page.

## Screens

1. Current conditions
2. Local radar
3. Rain arrival
4. Six-hour forecast
5. Cloud trend
6. Thunderstorm outlook
7. Official alerts
8. Tropical weather, included in automatic rotation only for a local tropical alert

Rotation changes based on rain, thunderstorm signals, official warnings, and tropical alerts.

## Verification modes

The application supports deterministic query-string modes for layout and failure testing without changing production behavior:

- `?demo=clear`
- `?demo=rain`
- `?demo=storm`
- `?demo=severe`
- `?demo=hurricane`
- `?offline=1`
- `?screen=radar`
- `?diag=1`

Modes can be combined, for example `?demo=severe&screen=alerts&diag=1`.

## Deployment

GitHub Pages publishes directly from the repository `main` branch root.
