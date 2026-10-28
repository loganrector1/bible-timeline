# Roadmap

Where the build stands and what could come next. The full feature vision is in [key_features.md](key_features.md); the design decisions made while building are in [CLAUDE.md](CLAUDE.md).

## Milestone 1: vertical slice (done)

Goal: prove the core idea from start to finish, with one shared dataset and one shared "current moment" driving a vertical timeline and a time-aware map, on a small hand-curated dataset (Creation to the death of Moses).

Built:

- **Stack:** static React + TypeScript + Vite + Tailwind site, MapLibre GL with free OpenFreeMap tiles and terrain, no backend. All content is JSON in `src/data/`, checked by zod schemas and link validation in `npm test`.
- **Dates:** astronomical years with no year 0, month and day precision where Scripture gives it, confidence levels, and alternate dates per chronology (early vs late Exodus) with notes.
- **Timeline:** vertical, zooming from millennia to days; era bands, events as dots and bars, a people lane, an overview strip, a fixed time cursor. Crowded moments fold into "+N" badges, key events are flagged `major`, and events within a larger event fold into it until you zoom in.
- **Map:** relief-and-water base map; the 5 nearest events to the cursor; region outlines; animated journeys with numbered stops; a popup for the event in focus; play, step and scrub controls.
- **Linking:** one selection shared by both views, side by side or one at a time; detail panels for events, people, places and eras, linked to each other and to Scripture (Bible Gateway links).
- **Polish:** phone layout with a peeking details sheet, light and dark themes, keyboard focus, a first-run hint, and a Browse panel with search.

What changed from the original plan, as it was built: the map shows a fixed number of nearest events rather than a time window, there are no "Show on map/timeline" buttons (chips appear only when the selection is out of view), and events can be part of a larger event (`partOf`). CLAUDE.md has the reasons.

## Next candidates

Not yet ordered. Each is a milestone of its own, drawn from key_features.md.

- **More content:** extend the dataset past Moses (Conquest, Judges, Kings, Exile, Return, Gospels, Acts). Check coordinates against a dataset such as OpenBible.info first.
- **Chronology switcher:** the data and store already hold alternate chronologies; this needs the UI, and a decision on which one is the default. A BC/AD vs BCE/CE toggle fits here too (the store already has `eraStyle`).
- **Search and filters:** the Browse panel has search; filters by person, book, type, era and theme, applied to both views, are still to come.
- **Shareable links:** encode the mode, time, selection and filters in the URL, so a teacher can send a class straight to a moment.
- **Guided tours:** step-by-step stories that drive both views, such as "The Exodus" or "The Life of Abraham".
- **World-history context:** a lane for surrounding empires and rulers, and empire extents on the map.
- **Scripture in the app:** read passages in a public-domain translation instead of linking out.
- **Deployment:** host the static site somewhere. Once `main` deploys automatically, revisit the branching rule in CLAUDE.md.

## Open questions

Kept current in the "Open questions and known issues" section of [CLAUDE.md](CLAUDE.md).
