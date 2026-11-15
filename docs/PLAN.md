# Takeover plan (2026-11-15)

Companion to `docs/TAKEOVER.md` (audit). Nothing here starts until the owner
approves it once. Working branch: `ccr-c3f2d50e-scmpz2` (open PR #8).

## Ground rules for every task

- The display is a fixed **456 x 257** viewport. Every render, screenshot and
  judgment is made at exactly that size. Nothing may overflow or scroll.
- Any change to a runtime `.js` or `.css` bumps the single shared `?v=` token in
  `index.html` (currently `20261113.1`); `qa/cache-release-regression.mjs` enforces it.
- Do not change the `data-ui` marker `vnext-2026.10.23.2` or the `data-copy`
  marker `alert-copy-2026.10.23.2` unless the workflows that pin them are
  updated in the same task.
- Must keep working on the office Pi (Chromium 92): no syntax or APIs newer
  than what `qa/legacy-compat.mjs` allows.
- Baseline gate, run before every commit ("the five checks"):
  `node qa/continuous-regression.mjs`, `node qa/decoder-regression.mjs`,
  `node qa/legacy-compat.mjs`,
  `RDR_RELEASE_BASE=origin/main node qa/cache-release-regression.mjs`,
  `CHROME=<path> node qa/legacy-bootstrap.mjs` (local server on 8765), plus
  `node --check` on every runtime script.
- Phone preview for each milestone: screenshots of all four views (`home`,
  `metro`, `florida`, `regional`) at 456 x 257, posted in chat. No hosted
  preview; Pages deploys only from `main`.
- Nothing merges to `main` (the live screen) without the owner saying so.
- Not in scope without separate approval: rewrites, new dependencies beyond the
  vendored fflate copy, changing data sources, deleting unmerged branches.

## Model ladder

Haiku: mechanical, with a check. Sonnet: standard implementation with tests.
Opus: hard or not auto-checkable (visual judgment counts). Fable: architecture
or ambiguity. Security-sensitive tasks never go to Haiku.

---

## Milestone 1: Runs, safe, and guarded

Order inside the milestone follows: make it run, fix security risks, add
safety tests around what will change.

### 1. Project guide for future sessions
- **Task:** Add `CLAUDE.md` with what the project is, the 456 x 257 rule, how to
  run it, the five checks, the cache-token rule, the pinned CI markers, and the
  Chromium 92 constraint. Add a link to this plan in `docs/STATUS.md`.
- **Files:** `CLAUDE.md` (new), `docs/STATUS.md`.
- **Depends on:** nothing.
- **Decisions made:** facts come from `docs/TAKEOVER.md` and this plan; under 60 lines; no runtime files touched.
- **Acceptance:** a new session can run the site and the checks from `CLAUDE.md` alone.
- **Check:** the five checks pass; `git diff --stat` shows only the two files; every command in `CLAUDE.md` runs as written.
- **Model:** Haiku.

### 2. Stop loading code from a public CDN (security)
- **Task:** Vendor `fflate@0.8.2` (`umd/index.js`) into the repo and load it from
  there in both places. Remove every runtime reference to `cdn.jsdelivr.net`.
- **Files:** `vendor/fflate-0.8.2.min.js` (new), `vendor/fflate-LICENSE.txt` (new, MIT),
  `core.js` (~line 290), `background.js` (~line 28), `index.html` (token bump),
  `qa/continuous-regression.mjs` or a new `qa/vendor-regression.mjs`.
- **Depends on:** nothing.
- **Decisions made:** vendor, not SRI (worker `importScripts` cannot use SRI).
  File must be byte-identical to the npm 0.8.2 tarball's `umd/index.js`; record
  its SHA-256 in the QA script. The blob worker needs an absolute URL: compute
  it on the page with `new URL('vendor/fflate-0.8.2.min.js', location.href).href`
  and pass it into the worker source (a relative path fails inside a blob
  worker). Keep fflate as a fallback only; do not change when it is used. Load
  path carries the shared `?v=` token.
- **Acceptance:** with the native inflater forced off, radar still decodes on
  the page and in the worker; no request goes to jsdelivr.
- **Check:** new QA assertion: `grep` finds no `jsdelivr` in runtime files, the
  vendored file's SHA-256 matches the recorded value, and a headless run with
  the fallback forced shows fflate loaded from the same origin and zero
  third-party script requests. The five checks pass.
- **Model:** Sonnet.

### 3. Harden and widen CI (security + safety net)
- **Task:** (a) Pin `puppeteer-core@25.9.0` in the 7 workflows that install it
  unpinned. (b) Add a `pull_request` trigger to `verify.yml` so the five checks
  run before code reaches `main`. (c) Confirm every workflow has
  `permissions: contents: read` and nothing more.
- **Files:** `.github/workflows/alert-copy-qa.yml`, `alert-overlays.yml`,
  `hidpi-qa.yml`, `qa-capture.yml`, `qa-v8.yml`, `verify.yml`, `vnext-qa.yml`.
- **Depends on:** nothing (can run alongside task 2).
- **Decisions made:** version 25.9.0, matching `yodeck-hang-regression.yml`.
  Use `pull_request`, never `pull_request_target`. Do not touch the pinned
  `data-ui` / `data-copy` markers. Do not restructure the workflows. If the
  live-data steps in `verify.yml` are flaky on PRs, gate only those steps to
  `push`, keep the five checks on PRs.
- **Acceptance:** PR #8 (or its successor) shows a green check from `verify.yml`.
- **Check:** `grep -c 'puppeteer-core@25.9.0'` covers all 8 browser workflows and
  no unpinned install remains; the PR check run is green (read via GitHub).
- **Model:** Sonnet.

### 4. Four-view capture and layout harness (safety net for Milestone 2)
- **Task:** One script that serves the repo locally, opens all four views at
  456 x 257, waits for live data, steps through a full playback loop, saves a
  screenshot per view (plus a frame strip of the loop), and fails on: wrong
  viewport size, any element or canvas overflowing 456 x 257, page scrollbars,
  uncaught errors, or a view that never leaves `data-surface="loading"`.
- **Files:** `qa/view-capture.mjs` (new), `qa/README.md`.
- **Depends on:** task 2 (so captures exercise the vendored path).
- **Decisions made:** reuse the patterns in `qa/legacy-bootstrap.mjs` and
  `qa/office-playback.cjs`; `puppeteer-core` with `CHROME` env var; output to a
  git-ignored folder; device scale factor 1 for assertions, optional 2x for
  readable phone screenshots. The `data-surface` assertion is allowed to fail
  until task 5 (mark it "known failing", do not weaken it).
- **Acceptance:** one command produces 4 labelled screenshots and a pass/fail
  line per view; rerunning gives the same pass/fail result.
- **Check:** run it twice; both runs produce 4 screenshots of exactly 456 x 257
  CSS pixels and identical verdicts. The five checks pass.
- **Model:** Sonnet.

### 5. Fix views stuck on "loading"
- **Task:** Find why `data-surface` stayed `loading` on 3 of 4 views in a live
  render while the header already showed temperature, and fix the cause (or the
  state reporting, if the picture is in fact complete).
- **Files:** likely `app.js`, `vnext.js`; `index.html` (token bump). Confirm by diagnosis.
- **Depends on:** task 4 (it reproduces and then proves the fix).
- **Decisions made:** diagnose first and write the cause in `docs/STATUS.md`
  before changing code. Smallest fix that works; no restructuring of the
  override chain. If the cause is only the sandbox network (NOAA blocked), say
  so with evidence and change nothing but the harness wait logic.
- **Acceptance:** all four views reach a non-loading `data-surface` within the
  harness timeout on live data, and the picture matches the state.
- **Check:** `qa/view-capture.mjs` passes on all four views three runs in a row
  with the "known failing" mark removed. The five checks pass.
- **Model:** Opus (root cause unknown, crosses the stacked overrides).

**Milestone 1 preview:** four screenshots at 456 x 257 in chat, a one-line
"no outside code is loaded any more" confirmation, and the green PR check.

---

## Milestone 2: Easier to read at 456 x 257

The owner's ask: render the live code and improve it, minding the size.

### 6. Legibility audit on real renders
- **Task:** Using task 4's captures of all four views across a full playback
  loop, list every readability problem with a screenshot crop: text too small,
  low contrast against radar colours, labels colliding or clipped, flicker or
  jumping between frames, crowded header/footer, timestamps hard to read.
  Rank by how much it hurts a viewer across a room.
- **Files:** `docs/LEGIBILITY.md` (new: ranked list, before screenshots referenced by name).
- **Depends on:** task 5.
- **Decisions made:** judge only at 456 x 257 on live data, not on mock data
  alone. Targets: no text under 9 CSS px, text contrast at least 4.5:1 against
  what is actually behind it, nothing clipped at any frame of the loop. Read
  `docs/UX-REVIEW-V8.md` first so settled choices are not reopened. No code changes.
- **Acceptance:** a ranked list of at most 10 issues, each with view, frame,
  cause guess, and proposed fix small enough for one commit. Split into batch A
  (header, footer, clock, legend, fixed text) and batch B (map labels, alert
  outlines and text, radar-over-label contrast).
- **Check:** owner sees the top 5 with crops in chat and can veto any before work starts.
- **Model:** Opus (visual judgment).

### 7. Fix batch A: fixed furniture
- **Task:** Implement the batch A fixes from task 6.
- **Files:** `vnext.js`, `clarity.js`, `styles.css`, `index.html` (token bump). Confirm against task 6.
- **Depends on:** task 6.
- **Decisions made:** change the live layer only (`vnext.js` / `clarity.js`),
  never the dead overrides. Keep the look; adjust size, weight, spacing,
  contrast. One commit per issue. PR #8's HOME marker and scale-bar fixes must
  not regress.
- **Acceptance:** each batch A issue is visibly fixed in before/after crops on
  all four views; nothing new collides or clips.
- **Check:** `qa/view-capture.mjs` passes; the five checks pass; before/after
  screenshots of the four views posted.
- **Model:** Opus.

### 8. Fix batch B: map labels and overlays through the loop
- **Task:** Implement the batch B fixes from task 6, checked on every frame of
  a playback loop and with an active alert (replay fixture if none is live).
- **Files:** `vnext.js`, `vnext-motion.js`, `clarity.js`, possibly `alert-copy.js`; `index.html` (token bump).
- **Depends on:** task 7 (same files; do not run in parallel).
- **Decisions made:** same as task 7. If `alert-copy.js` wording changes, the
  `data-copy` marker and `alert-copy-qa.yml` change together or not at all.
  No frame-rate or decode changes.
- **Acceptance:** each batch B issue fixed on every frame of the loop; playback
  remains smooth (`qa/office-playback.cjs` result no worse than baseline).
- **Check:** `qa/view-capture.mjs` frame strip passes; the five checks pass;
  before/after frame strips posted.
- **Model:** Opus.

### 9. Lock in the gains
- **Task:** Turn the measurable targets into harness assertions (minimum text
  size, no overlap between known furniture boxes, nothing outside 456 x 257 on
  any loop frame). Update `docs/STATUS.md` and `docs/LEGIBILITY.md` with the
  result, and update the PR description.
- **Files:** `qa/view-capture.mjs`, `qa/README.md`, `docs/STATUS.md`, `docs/LEGIBILITY.md`.
- **Depends on:** task 8.
- **Decisions made:** assert only what can be measured reliably; anything that
  needs an eye stays a screenshot step. Add the harness to `verify.yml` only if
  it has been stable for three runs.
- **Acceptance:** reverting any one Milestone 2 fix makes the harness fail.
- **Check:** demonstrate one such revert failing, then restore; the five checks pass.
- **Model:** Sonnet.

**Milestone 2 preview:** before/after pairs for all four views at 456 x 257,
plus one loop strip. The owner then decides on merging to `main`, and is asked
to glance at the real office screen afterwards (the Pi cannot be checked from here).

---

## Milestone 3: Tidy up (each task needs its own yes)

### 10. Delete the 7 fully merged old branches
- **Task:** Delete only the remote branches that are fully merged into `main`.
- **Files:** none (remote branches only).
- **Depends on:** owner approval (question 2).
- **Decisions made:** never touch the 6 unmerged ones (`agent/weather-display`,
  `feature/fix/yodeck-pi-hang`, `feature/reliable-radar-loop-motion`,
  `qa/alert-boundaries-v8`, `qa/broadcast-v7`, `qa/enterprise-v8`), `main`, or
  the working branch. Record each deleted branch name and its last commit hash
  in `docs/STATUS.md` first, so any can be restored.
- **Acceptance:** 6 old branches plus `main` and the working branch remain.
- **Check:** before each delete, `git merge-base --is-ancestor <branch> origin/main`
  succeeds; afterwards the branch list matches the expected set.
- **Model:** Haiku (mechanical, checked per branch).

### 11. Design the removal of dead `render` overrides
- **Task:** Map which functions in `enterprise-ui.js`, `alerts.js` and `hidpi.js`
  are truly dead (replaced by `vnext.js`) and which are still called by the live
  layer. Produce a step-by-step removal order where each step is separately
  checkable, or recommend not doing it.
- **Files:** `docs/RENDER-CLEANUP.md` (new). No code changes.
- **Depends on:** task 9; owner approval (question 3).
- **Decisions made:** behaviour and pixels must not change; legacy boot
  fail-safe stays; workflows that load old layers must be accounted for.
- **Acceptance:** every removal step names the lines, the reason they are dead, and the check.
- **Check:** owner reads a five-line summary and says go or stop.
- **Model:** Fable (architecture).

### 12. Carry out the removal
- **Task:** Follow task 11's steps, one commit each.
- **Files:** `enterprise-ui.js`, `alerts.js`, `hidpi.js`, `index.html` (token bump).
- **Depends on:** task 11 and a second owner yes.
- **Decisions made:** stop at the first step that changes a pixel or fails a check.
- **Acceptance:** `render` is assigned once; screenshots match pre-removal ones.
- **Check:** pixel comparison of all four views with data frozen (`qa/replay`
  fixture) before vs after; harness and the five checks pass.
- **Model:** Opus.

---

## Totals and run cap

| Model | Tasks | Which |
|---|---|---|
| Haiku | 2 | 1, 10 |
| Sonnet | 4 | 2, 3, 4, 9 |
| Opus | 5 | 5, 6, 7, 8, 12 |
| Fable | 1 | 11 |

- Planned tasks: 12. **Task limit: 15** (12 + 25%, rounded up).
- **Delegated token limit: 1.5 million.** The main session runs on Opus, so the
  Opus tasks run there and are not delegated. Delegated: Haiku 2, Sonnet 4,
  Fable 1, plus fresh-subagent reviews. The planning subagent used 81k.
- If a cap is hit, stop, push, and report; do not continue.

## Security baseline that applies here

Applies:
- **No third-party code at runtime:** task 2 (vendor fflate, recorded hash).
- **Pinned dependencies in CI:** task 3 (`puppeteer-core@25.9.0`).
- **Least-privilege CI:** `contents: read` only; `pull_request`, never
  `pull_request_target`; no secrets in workflows (there are none, keep it so).
- **Checks before production:** task 3 puts the five checks on pull requests.
- **Untrusted remote data:** NOAA/NWS text is drawn to canvas only. A scan found
  no `innerHTML`, `eval` or `document.write` in runtime files; task 2's QA
  script adds a grep so that stays true.
- **No secrets in the repo:** none found; every commit diff is checked for keys or tokens.
- **Destructive actions need the owner:** branch deletion, merges to `main`, dead-code removal.

Does not apply (no such thing in this project): logins, user data, databases,
server-side input, payment, API keys.

Noted, not planned: a Content-Security-Policy tag would add protection but risks
breaking the blob worker on Chromium 92; revisit only after a test on the real Pi.

## Questions for the owner

1. **Merge PR #8 first, or keep building on it?** Recommend: keep building on
   the same branch and merge once at the end of Milestone 1. Reason: one merge
   means one change to the live screen, and by then checks run on the PR.
2. **Delete the 7 old branches that are already fully merged?** Recommend: yes.
   Reason: nothing is lost (their work is in `main`) and hashes are recorded first.
3. **Remove the dead `render` overrides now or later?** Recommend: later, as
   Milestone 3, and only after seeing the design in task 11. Reason: it changes
   no pixels for viewers and is the riskiest work, so it should wait for the safety net.
4. **Who merges to `main`?** Recommend: I merge only when you say "merge" after
   seeing a milestone's screenshots. Reason: `main` is the live screen.
5. **Can you look at the real office screen after each merge?** Recommend: yes,
   a quick photo. Reason: the Pi's old browser cannot be tested from here.
6. **Which view is on the Yodeck screen?** Recommend: tell me; until then all
   four are treated equally with `home` first. Reason: it sets fix priority.
7. **Run checks on every pull request?** Recommend: yes. Reason: free for a
   public repo and catches breakage before it reaches the screen.
