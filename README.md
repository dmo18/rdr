# RDR Weather Display

RDR is a purpose-built, unattended 640 x 480 weather instrument for a HUD, embedded panel, Raspberry Pi, or small fixed display. It rotates automatically between single-purpose weather views and increases screen time for rain, lightning, warnings, and tropical threats.

## What is implemented

- 640 x 480 Pygame application with large type, high contrast, and no interactive UI chrome.
- Current weather view with a plain-English weather intelligence headline.
- Animated local radar-style view with storm motion.
- Rain-arrival takeover view with a simple NOW / +30M / +1H / +2H intensity timeline.
- Lightning map with strike aging, distance calculation, and safety-range takeover logic.
- Hourly forecast timeline with 4 to 6 readable forecast points.
- Moving cloud view.
- Severe-weather takeover screen with a warning polygon and immediate-use summary.
- Tropical-system view with track, closest approach, watches/warnings, and an explicit forecast-cone disclaimer.
- Priority-based rotation that changes according to conditions instead of using a fixed slideshow.
- Night palette, stale-data indication, last-valid snapshot caching, refresh handling, logging, and source timestamp tracking.
- Nine simulation scenarios, including network failure, so the display works immediately without credentials.

## Architecture

```text
Provider adapters -> WeatherSnapshot -> interpretation layer -> priority scorer
       |                    |                    |                 |
       +---- refresh/cache --+                    +---- rotation ---+
                                                                   |
                                                              Pygame views
```

The GUI consumes normalized domain models only. Provider implementations own external API details. This keeps display logic independent from any weather vendor.

### Recommended production data sources

| Need | Recommended source | Notes |
| --- | --- | --- |
| Current/hourly | National Weather Service for US deployments, Open-Meteo as a general fallback | Normalize into `Observation` and `HourlyPoint`. |
| Alerts | NWS API | Preserve the original alert source and polygon internally. |
| Radar | RainViewer tiles or a licensed radar tile feed | Cache tiles when permitted and animate recent frames. |
| Clouds | NOAA GOES imagery for US coverage or a satellite tile vendor | Preprocess to a low-resolution layer suitable for 640 x 480. |
| Lightning | Licensed lightning provider such as Xweather, Vaisala, or Tomorrow.io | Exact availability and licensing vary. Keep behind the provider interface. |
| Tropical | NOAA National Hurricane Center advisories and GIS products | Use official track/cone data and never represent the cone as storm size. |

## 640 x 480 layout

Every screen reserves only a 42 px persistent strip:

```text
+----------------------------------------------------------------+
| 72°  HOME                              [ALERT]        4:35 PM    | 42
+----------------------------------------------------------------+
|                                                                |
|             ONE DOMINANT WEATHER QUESTION / VISUAL             |
|                                                                |
|   Current: huge temp + intelligence headline                   |
|   Radar:   map dominates, user marker centered                 |
|   Rain:    arrival time dominates, tiny timeline below         |
|   Storm:   strike map + nearest distance                       |
|   Severe:  alert name + distance/motion + warning polygon      |
|   Tropical: storm facts left, official-style track right       |
|                                                                |
+----------------------------------------------------------------+
```

## Directory structure

```text
rdr/
  app.py                 Application loop, refresh, fallback
  cache.py               Last-valid snapshot cache
  config.py              TOML configuration
  interpretation.py      Raw-data to concise weather statements
  models.py              Provider-neutral domain model
  priority.py            Priority scoring and weighted rotation
  rotation.py            Screen timing controller
  providers/
    base.py               Provider interface
    mock.py               Complete simulation provider
  ui/
    components.py         Persistent header and common primitives
    screens.py            Eight purpose-built views
    theme.py              Day/night palettes
```

## Data models

The central `WeatherSnapshot` contains normalized observations, hourly forecast points, radar cells, cloud bands, lightning strikes, official alerts, tropical systems, and derived/estimated arrival metadata. Estimated fields such as rain ETA and storm ETA are separate from official alerts and observations so the interpretation layer can label them appropriately.

## Priority and rotation logic

Base priority favors Current, Radar, Forecast, then Clouds. Conditions modify the plan:

- Rain within the configured approach window promotes Rain Arrival and Radar.
- Lightning inside 25 miles adds the Lightning screen. Inside 10 miles it becomes a high-priority view. Inside 5 miles it can repeat in the rotation.
- Severe warnings promote the Severe view. Extreme alerts repeat to temporarily dominate rotation.
- Tropical systems are omitted unless they fall within the configured relevance radius.
- High-priority views may appear more than once per cycle. Each screen still keeps its own configured duration.

## Run locally

Python 3.11 or newer is recommended.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e .
python -m rdr --scenario clear
```

Copy the example configuration if you want to change location, timing, thresholds, fullscreen behavior, or refresh intervals:

```bash
cp config.example.toml config.toml
python -m rdr --config config.toml --scenario approaching-rain
```

During development only, `Space` or the right arrow advances to the next view and `Esc` exits. The deployed display requires no input.

## Simulation scenarios

```text
clear
approaching-rain
heavy-rain
nearby-thunderstorms
frequent-lightning
severe-thunderstorm-warning
tornado-warning
hurricane-approaching
network-failure
```

Example:

```bash
python -m rdr --scenario tornado-warning
```

## Configuration and credentials

`config.example.toml` documents every current setting. API credentials belong outside source control. The default placeholder environment variable is:

```bash
export RDR_WEATHER_API_KEY="..."
```

The current release uses the mock provider exclusively, so no key is needed to run it. Production provider adapters should read credential names from configuration and values from environment variables.

## Reliability behavior

The application refreshes snapshots on a timer. Valid snapshots are cached in memory. If a provider later fails, the previous valid snapshot remains on-screen, is marked stale, and the rest of the display continues operating instead of replacing the screen with an error page.

For a production deployment, run the process under `systemd` with restart-on-failure, write logs to journald, and configure networking independently of the app.

## Validation

```bash
pip install -e ".[dev]"
pytest -q
```

The tests cover weather intelligence wording and priority/rotation behavior for clear, rain, tornado, and tropical scenarios.

## Next provider milestone

The provider boundary is intentionally ready for live adapters. A practical first production increment is:

1. Add a current/hourly adapter.
2. Add NWS alerts and polygons for US deployments.
3. Add radar frames and tile caching.
4. Add lightning from the selected licensed provider.
5. Add NHC tropical advisories and GIS geometry.
6. Persist the last valid snapshot to disk so stale data survives process restarts.
