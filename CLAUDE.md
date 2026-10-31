# CLAUDE.md

Guidance for working in this repo. The product vision is in [key_features.md](key_features.md), what's built and what could come next in [ROADMAP.md](ROADMAP.md) (update it when a milestone finishes); setup and content conventions for humans are in [README.md](README.md).

## Commands

```sh
npm run dev        # dev server at http://localhost:5173
npm test           # vitest: date math + data integrity
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build to dist/
node scripts/shot.mjs out.png [w] [h] [actions] [light|dark]   # screenshot the dev server in Edge
node scripts/openbible.mjs [--write | find <text> | show <name>]  # check places against OpenBible.info
```

- Windows, PowerShell 5.1. Node is installed at `C:\Program Files\nodejs`; shells started before the install may not have it on PATH. In Git Bash, prefix commands with `export PATH="/c/Program Files/nodejs:$PATH" &&`.
- Before committing, gate on `npm test`'s exit code, not on grepping its output. Any failure blocks the commit.
- `npm test` runs Vitest through `scripts/vitest.mjs`, which restarts it from an upper-case drive letter. When the working directory is `c:\...` (VS Code terminals and Claude Code's shell often are), plain `vitest` loads itself twice and every suite fails at its first `describe` with `TypeError: Cannot read properties of undefined (reading 'config')`. Call `npm test`, not `npx vitest`. This was the "flake" of 2026-10-27/28: it came and went with the shell's drive-letter case, not with screenshots or caches.
- Map labels: MapLibre places symbols from the top layer down, so the layer that must win collisions (the focus event's places) goes last in `EventLayer`.
- `scripts/shot.mjs` (playwright-core driving the installed Edge; the dev server must be running) is how UI changes get checked; its header lists the actions (`mode`, `select` via Browse, `zoomIn`, click, hover, drag, eval…). Save screenshots outside the repo. Driving the app: don't `import()` app modules in `eval` (that loads a second store, which the app ignores); use the UI. At phone width, `select` via Browse can fail to select; pick from the Nearest events list instead.
- On Windows, stopping a background task doesn't kill the Node process behind it. Free a port with `Get-NetTCPConnection -LocalPort 5173` + `Stop-Process`.

## Architecture

- Static React 19 + TypeScript + Vite + Tailwind v4 site. No backend; all content is JSON in `src/data/`, validated with zod (`schema.ts`) and checked for broken links by `validate.ts`.
- `src/state/store.ts` (zustand) is the single source of truth: `currentYear` (fractional astronomical year), `pxPerYear` (time zoom), `selection`, `mode`, `chronologyId`. Timeline and map only read and write the store; they never talk to each other.
- `src/lib/`: `dates.ts` (year math and formatting), `entities.ts` (cross-entity queries), `journeys.ts`, `activeEvents.ts` (which events the map shows), `timeScale.ts`. Event order and parent/child links live in `entities.ts` (`eventsInOrder`, `eventOrderKey`, `adjacentEvent`, `parentEvent`, `childEvents`, `journeyOf`).
- The timeline is virtual: no native scrolling. Gestures change `currentYear` directly, and the cursor is fixed at the vertical center. Native scrolling can't reach day-level zoom across thousands of years.
- Map: MapLibre GL 6 via `react-map-gl/maplibre`, on OpenFreeMap tiles stripped down to relief and water (`baseStyle.ts`). Terrain is a MapLibre hillshade from AWS open-data Terrarium elevation tiles (no key; the `elevation-tiles-prod.s3.amazonaws.com` host sends CORS headers on GET, not HEAD), over a faint Natural Earth colour wash that's only sharp to zoom 6. Modern roads, labels and OSM land cover are left out; land cover is today's land use, mapped unevenly by country. Its worker URL must be set explicitly (`setWorkerUrl` in MapView), and `mapLib` must be passed so only one MapLibre instance exists.

## Data conventions

- Years are astronomical: 1 BC = `0`, 1446 BC = `-1445`. Never display a year 0.
- Optional `month`/`day` are approximate Julian placement; `label` keeps the biblical form ("14 Nisan"). Precision comes from which fields are present; there is no separate precision field.
- Dates are keyed by chronology id (`early` is the default, `late` holds alternates); a missing entry falls back to the default. Which default to use is still an open decision. The chronologies differ only on the Exodus, so only dates before Saul need a `late` entry.
- Kings follow Thiele's chronology (division 931 BC, Samaria 722, Jerusalem 586). Jesus is born c. 6–4 BC and crucified in AD 30; mention AD 33 in a `dateNote` where it matters.
- Non-narrative books are events of their writing or ministry, not of their contents: Revelation is John's vision on Patmos (c. AD 95), prophets are dated by their ministry, letters by when and where they were written. Don't date prophetic visions as history.
- Region outlines in `regions.json` are the shapes of places: each feature id must match a location id.
- Don't invent precision Scripture doesn't give. Leave journey stops untimed rather than guessing days, and mark uncertain dates and sites as such, with a note.
- `partOf` links an event to the larger event it happens within (Red Sea → Exodus). Children stay full events (type, people, Scripture); one level deep; the date's midpoint falls within the parent's, and a parent's journey must have a stop at one of the child's places (`validate.ts`, `data.test.ts`).
- Coordinates follow OpenBible.info (CC BY 4.0, credited on the map and in the README). Each location records its OpenBible place in `openbible` (`"Rephidim#2"` when we keep a candidate other than OpenBible's first, usually the traditional site, and say so in a note). Run `node scripts/openbible.mjs` after adding places; it should print nothing. Region, sea and wilderness points are map label positions and aren't checked. Region outlines are still hand-drawn.

## Design decisions (agreed with the user)

- **Selecting moves time only when needed.** Events jump to their moment. People and eras move the cursor only if it's outside their span, to the nearest edge. Places never move time. Selection never changes zoom.
- **No "Show on…" buttons.** Each view shows a "Show ‹name›" chip, with an arrow toward the selection, only while the selection is out of frame; clicking it centers and fits (timeline) or re-frames (map). The details panel offers "Open on map/timeline" only when that view is hidden, and "Replay journey" for events with journeys.
- **Event popup on the map** for the focus event when it isn't the selection (the details panel covers that case). It never moves the map: it sits beside the visible part of the event, avoiding the event's own places, labels and route and the map's controls (`data-map-obstacle`), or at the nearest edge with an arrow when it's all off screen. Events with no places get no popup.
- **One focus event on the map:** the selected event, or else the nearest event to the cursor. Only it draws a journey and region outlines; other nearby events show as place dots.
- **Events within events** (`partOf`), chosen over merging them into journey stops so each keeps its type, people and Scripture: they fold into the parent on the timeline until it draws as a bar, sort right after it, label their stop on its route, nest under it in Nearest events, and the details panel shows "Part of" (child) and "Along the way" (parent).
- **Journeys:** direction arrows, retraced legs drawn side by side (line-offset), a moving head dot while drawing, merged stop numbers ("4·6"). Events along a journey (`partOf`) label their stop once the route reaches it; selecting one draws its parent's route up to its stop, with that stop ringed.
- **Dates stand at the middle of their precision** (`specExtent`): "1446 BC" is mid-1446 and "4th month" is mid-month, for moments and for both ends of spans and lifespans, on the timeline and in date order. So a span "from 1446 BC" starts level with a moment that year, and a death "in 1405 BC" sits at the end of that person's bar. Date bounds for "is the cursor within it" (`specBounds`, eras) still cover the whole year.
- **Date order** (`eventsInOrder`, used by lists, step buttons and play): by where the event starts (`specExtent`). On ties a parent comes before the events within it, then the file's order stands, so put events sharing a date in the order Scripture tells them. So the burning bush comes before the plagues (both 1446 BC), and a long span like the wandering comes right after it begins, not among the events in its middle.
- **Births and deaths:** a birth or death event is about its first listed person, and its date must match that person's lifespan (`data.test.ts`). Routine ones (not `major`) are drawn as small marks at the ends of the person's bar instead of event dots, unless the people lane is hidden or the event is selected (`lifeMarkPerson`); the ones the story dwells on (Moses' death, Jesus' birth) are `major` and stay dots.
- **Play** steps through events one by one, resting longer while a journey draws. It doesn't sweep time linearly.
- **The map shows the 5 nearest events** to the cursor (`NEAREST_COUNT` in `activeEvents.ts`), whatever the time zoom. Time zoom affects only the timeline, so the map has no time-zoom controls. The panel is titled "Nearest events" and lists dates, because in quiet stretches the nearest event can be years away. Distance is the gap to the event plus 1/20 of its length, so a specific event beats a long span that covers the cursor (Moses flees over a century of slavery), while the span wins when nothing specific is within a few years. The list always holds the selected event (or else the nearest) with the events just before and after it (`adjacentEvent`, the same order as the step buttons), so it doubles as a way to step through events; the nearest fill the rest.
- **Phone details sheet** opens as a short peek (kind, title, date, start of summary); tap or swipe up to expand, swipe down or tap the handle to shrink. It keeps its size as the selection changes (so play doesn't cover the map), and it always stops above the bottom controls: mark any control it must not cover with `data-sheet-floor`.
- **Crowded timeline:** spans shorter than 14px draw as dots (a shorter bar is hard to click). Dots too close to stack sit side by side in time order, at most 5; the rest fold into a "+N" badge that zooms in until they spread out. Which dots stay and which labels win is ranked: selected, then highlighted, then `major` events (a flag in `events.json`), then earliest. All labels, span labels included, sit in one column after the dots, so a label never covers a dot. A span's label slides down its bar when its start is taken. Events with `partOf` fold into their parent (hidden) until the parent is long enough to draw as a bar, unless selected. Hovering a span's bar or its label highlights both (`group/event`), as hovering a dot's label highlights the dot.
- Hover cards are custom and instant; never rely on the browser's `title` tooltip.
- Approachable for lay readers and small groups; honest about uncertainty without being academic.

## Open questions and known issues

- Which chronology is the default (early vs late Exodus) is undecided.
- On the map, a child event's stop label can nearly repeat the place name ("Crossing the Red Sea" beside "Red Sea crossing (Yam Suph)?").
- "The twelve spies" isn't `partOf` anything: "Israel leaves Sinai" is a single date, not a span covering the journey to Kadesh.
- The wandering (from mid-1445 BC) still sorts before the twelve spies, which Scripture places before it; its start date may need revisiting.
- In Both view on a phone, the details peek covers much of the small map.
- Three events have no places, so they get no map popup or dots: Creation, Birth of Ishmael, Birth of Jacob and Esau.
- Some events between the Testaments (Alexander, the Septuagint, the Maccabees, Pompey, Herod) are history, not Scripture; for now only their `dateNote` says so. key_features.md's world-history lane would set them apart visually.
- At the map's closest framing (zoom 7.5), places a few hundred metres apart in Jerusalem (Golgotha, Gethsemane, Moriah) hide each other's labels.

## Working style

- Commit each logical change with a clear message, and push after committing (the user has OK'd pushing without asking).
- Small fixes and single-commit changes go straight to `main`. Larger or experimental features that take several commits get a short-lived branch (`feature/<name>`), which is merged into `main` and deleted when done. Since `main` deploys publicly, the user reviews a branch on its preview URL before it's merged; send them the link.
- Deployment: a Cloudflare Worker that only serves static files (`wrangler.jsonc`; Cloudflare calls Pages legacy, so we chose Workers) builds every push (`npm test && npm run build`, then `npx wrangler deploy`; Node from `.node-version`). `main` is public at bible.rector.app, so anything pushed to `main` goes live; other pushed branches get private preview URLs behind Cloudflare Access (see README), at `https://<branch, with / as ->-bible-timeline.logan-rector.workers.dev` (e.g. `feature-journeys-bible-timeline…`); `gh api repos/loganrector1/bible-timeline/commits/<sha>/check-runs` shows whether a build passed. Branch builds run `wrangler preview`, which fails unless `wrangler.jsonc` has a `previews` block. Tests run on Linux there, so don't make them depend on Windows paths or on the network.
- Verify UI changes in a real browser (screenshots at desktop and phone widths, light and dark), not just by type-checking.
- Ask before making product or design calls the user hasn't decided; recommend an option.
- Keep this file current: when a decision is made, a convention changes or a new gotcha turns up, update CLAUDE.md in the same commit as the change.
