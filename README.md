# RDR Radar Ops Panel

A radar-first static web panel built for a **456 x 257** Yodeck slot.

## Included views

1. Hyperlocal Radar
2. Metro Radar
3. South Florida Radar
4. Southeast Radar
5. Infrared Satellite
6. Warnings
7. Tropical 2-Day Outlook
8. Tropical 5-Day Outlook

## Default location

- Latitude: `26.06197904865014`
- Longitude: `-80.18787062578414`

## Files

- `index.html`
- `styles.css`
- `app.js`

## Behavior

- Rotates through radar-centric views every 9 seconds
- Uses only a thin status bar at the bottom
- Supports `?view=hyperlocal` or any other view id to force a specific screen
- Uses direct public image resources for radar, tropical graphics, satellite imagery, and hazards
- Falls back to the latest static KAMX frame if the local KAMX loop fails

## Force a view

Examples:

- `index.html?view=hyperlocal`
- `index.html?view=metro`
- `index.html?view=southfl`
- `index.html?view=southeast`
- `index.html?view=satellite`
- `index.html?view=warnings`
- `index.html?view=trop2`
- `index.html?view=trop5`

## Deployment

GitHub Pages publishes from `main` at `https://dmo18.github.io/rdr/`.
