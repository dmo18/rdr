# Legibility audit at 456 x 257 (2026-11-15)

Method: live renders of all four views from `qa/view-capture.mjs`, plus a probe
that wraps `fillText` on `#display` and records the on-screen CSS pixel size of
every string drawn during a full playback loop. Target from `docs/PLAN.md`:
no text under 9 CSS px, readable contrast against what is behind it, nothing
clipped on any frame. Settled v8 layout choices (`docs/UX-REVIEW-V8.md`) stay.

Already at or above target: header title 11 px, clock/frame counter 10 px,
current conditions 10 px, freshness 9 px, HOME status 11 px, nearest rain 9 px,
alert summary 10 px, neighborhood city labels 9 px.

## Ranked issues

| # | Batch | Issue (measured) | Views | Fix |
|---|---|---|---|---|
| 1 | B | City labels 8.5 px; white coastline cuts through letters (FORT MYERS, NAPLES, MIAMI, TAMPA), thin 0.72 px halo | metro, florida, regional | 9 px everywhere, halo 1.1 px at higher opacity |
| 2 | A | Loop rail text ("N min history", time range) 8 px | all | 9 px |
| 3 | B | Storm callouts ("58 dBZ") 8 px | regional, florida | 9 px |
| 4 | B | Warning tags ("FLD") 8 px | florida, regional | 9 px |
| 5 | A | Scale bar label 8 px at 72% opacity | all | 9 px, 88% opacity |
| 6 | A | No-data message "WAITING FOR CURRENT NOAA MRMS DATA" 6 px | all (outage only) | 9 px |

Not in this batch (needs a decision): on GULF + CARIBBEAN the footer reads
"FLORIDA · 121 other alerts", where FLORIDA is an alert area name that reads
like a place label. Changing alert wording changes the `data-copy` marker and
`alert-copy-qa.yml` together, so it is listed for a later decision.

Crops: `legibility-crops.png` (posted in chat; local QA artifact, not committed).

## Result

Filled in after tasks 7 and 8.
