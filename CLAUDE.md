# CLAUDE.md

Guidance for working in this repo. The product vision is in [key_features.md](key_features.md); setup and content conventions for humans are in [README.md](README.md).

## Commands

```sh
npm run dev        # dev server at http://localhost:5173
npm test           # vitest: date math + data integrity
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
```

- Windows, PowerShell 5.1. Node is installed at `C:\Program Files\nodejs`; shells started before the install may not have it on PATH. In Git Bash, prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Before committing, gate on `npm test`'s exit code, not on grepping its output.
- Known flake: now and then every suite fails at collection with `TypeError: Cannot read properties of undefined (reading 'config')` at the first `describe`, "no tests" run, and the timing shows `worker 96%` with no import time. It hit 4 times on 2026-10-27, always on the first run after browser screenshots, and cleared within a minute. Prime suspect: Vitest 5's on-disk module cache (`fsModuleCache`, default on, in `node_modules/.vitest-cache`), now turned off in vite.config.ts; unconfirmed, since it never reproduced on demand. If it recurs anyway, that rules the cache out: keep the full log (gate with `npm test > <scratchpad>/test.log 2>&1`) and look at worker startup. With exactly that signature, a rerun is acceptable; any other failure blocks the commit.
- On Windows, stopping a background task doesn't kill the Node process behind it. Free a port with `Get-NetTCPConnection -LocalPort 5173` + `Stop-Process`.

## Architecture

- Static React 19 + TypeScript + Vite + Tailwind v4 site. No backend; all content is JSON in `src/data/`, validated with zod (`schema.ts`) and checked for broken links by `validate.ts`.
- `src/state/store.ts` (zustand) is the single source of truth: `currentYear` (fractional astronomical year), `pxPerYear` (time zoom), `selection`, `mode`, `chronologyId`. Timeline and map only read and write the store; they never talk to each other.
- `src/lib/`: `dates.ts` (year math and formatting), `entities.ts` (cross-entity queries), `journeys.ts`, `activeEvents.ts` (which events the map shows), `timeScale.ts`.
- The timeline is virtual: no native scrolling. Gestures change `currentYear` directly, and the cursor is fixed at the vertical center. Native scrolling can't reach day-level zoom across thousands of years.
- Map: MapLibre GL 6 via `react-map-gl/maplibre`, on OpenFreeMap tiles stripped down to relief and water (`baseStyle.ts`). Terrain is a MapLibre hillshade from AWS open-data Terrarium elevation tiles (no key; the `elevation-tiles-prod.s3.amazonaws.com` host sends CORS headers on GET, not HEAD), over a faint Natural Earth colour wash that's only sharp to zoom 6. Modern roads, labels and OSM land cover are left out; land cover is today's land use, mapped unevenly by country. Its worker URL must be set explicitly (`setWorkerUrl` in MapView), and `mapLib` must be passed so only one MapLibre instance exists.

## Data conventions

- Years are astronomical: 1 BC = `0`, 1446 BC = `-1445`. Never display a year 0.
- Optional `month`/`day` are approximate Julian placement; `label` keeps the biblical form ("14 Nisan"). Precision comes from which fields are present; there is no separate precision field.
- Dates are keyed by chronology id (`early` is the default, `late` holds alternates); a missing entry falls back to the default. Which default to use is still an open decision.
- Region outlines in `regions.json` are the shapes of places: each feature id must match a location id.
- Don't invent precision Scripture doesn't give. Leave journey stops untimed rather than guessing days, and mark uncertain dates and sites as such, with a note.
- Coordinates and outlines are hand-entered approximations, not yet checked against a dataset like OpenBible.info.

## Design decisions (agreed with the user)

- **Selecting moves time only when needed.** Events jump to their moment. People and eras move the cursor only if it's outside their span, to the nearest edge. Places never move time. Selection never changes zoom.
- **No "Show on…" buttons.** Each view shows a "Show ‹name›" chip, with an arrow toward the selection, only while the selection is out of frame; clicking it centers and fits (timeline) or re-frames (map). The details panel offers "Open on map/timeline" only when that view is hidden, and "Replay journey" for events with journeys.
- **Event popup on the map** for the focus event when it isn't the selection (the details panel covers that case). It never moves the map: it sits beside the visible part of the event, avoiding the event's own places, labels and route and the map's controls (`data-map-obstacle`), or at the nearest edge with an arrow when it's all off screen. Events with no places get no popup.
- **One focus event on the map:** the selected event, or else the nearest event to the cursor. Only it draws a journey and region outlines; other nearby events show as place dots.
- **Journeys:** direction arrows, retraced legs drawn side by side (line-offset), a moving head dot while drawing, merged stop numbers ("4·6").
- **Play** steps through events one by one, resting longer while a journey draws. It doesn't sweep time linearly.
- **The map shows the 5 nearest events** to the cursor (`NEAREST_COUNT` in `activeEvents.ts`), whatever the time zoom. Time zoom affects only the timeline, so the map has no time-zoom controls. The panel is titled "Nearest events" and lists dates, because in quiet stretches the nearest event can be years away. Distance is the gap to the event plus 1/20 of its length, so a specific event beats a long span that covers the cursor (Moses flees over a century of slavery), while the span wins when nothing specific is within a few years.
- **Phone details sheet** opens as a short peek (kind, title, date, start of summary); tap or swipe up to expand, swipe down or tap the handle to shrink. It keeps its size as the selection changes (so play doesn't cover the map), and it always stops above the bottom controls: mark any control it must not cover with `data-sheet-floor`.
- Hover cards are custom and instant; never rely on the browser's `title` tooltip.
- Approachable for lay readers and small groups; honest about uncertainty without being academic.

## Working style

- Commit each logical change with a clear message, and push after committing (the user has OK'd pushing without asking).
- Small fixes and single-commit changes go straight to `main`. Larger or experimental features that take several commits get a short-lived branch (`feature/<name>`), which is merged into `main` and deleted when done. Revisit this once `main` deploys somewhere automatically.
- Verify UI changes in a real browser (screenshots at desktop and phone widths, light and dark), not just by type-checking.
- Ask before making product or design calls the user hasn't decided; recommend an option.
- Keep this file current: when a decision is made, a convention changes or a new gotcha turns up, update CLAUDE.md in the same commit as the change.
