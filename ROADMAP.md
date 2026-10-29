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

## Milestone 2: the whole Bible (in progress)

Goal: extend the dataset from Genesis to Revelation, so the timeline and map cover the whole biblical story, not just Creation to Moses. Work happens on the `feature/whole-bible` branch.

Decided:

- **Skeleton first.** One pass across every era with its key events (about 5–10 each), people and places, so the whole Bible is on screen early and the UI is tested at full scale (AD years, the map out to Rome, crowding). Then deepen era by era.
- **Places from OpenBible.info.** Coordinates follow OpenBible.info's Bible geocoding data (CC BY 4.0), checked by `scripts/openbible.mjs`. The existing places were checked and corrected first.
- **Dating:** kings by Thiele's chronology (the one most study Bibles use); Jesus born c. 6–4 BC, crucifixion AD 30 with AD 33 noted as the alternative. Early vs late Exodus stays an open question.
- **Non-narrative books** appear as events of their writing or ministry: Revelation is John's vision on Patmos (c. AD 95), with the seven churches as places, and its visions aren't dated as history. Prophets show when and where they ministered, letters when and where they were written.

Steps:

1. ~~Check places against OpenBible.info.~~
2. ~~Eras from the Conquest to the Early Church.~~
3. ~~Skeleton events, people and places, era by era, from the Conquest to Revelation.~~ The dataset now has 123 events (about a third `major`), 87 people and 92 places. Two event types were added for it: `ministry` (prophets, Jesus) and `writing` (letters, the Septuagint); and an `island` place type.
4. ~~Check the UI at full scale.~~ Crowding, play, the overview strip and the map's framing out to Rome and the seven churches all hold up. Fixed along the way: eras overlapping at their boundaries (now tested), the event's own place labels losing to background labels in crowded Jerusalem, and the map credits covering the Modern borders button.
5. Deepen era by era. Candidates, roughly in order of value:
   - Journeys: Paul's three journeys and voyage to Rome, the deportations to Assyria and Babylon, the returns, the flight to Egypt.
   - Kings and prophets: the remaining kings of Israel and Judah and the minor prophets, probably with the kings and prophets lanes from key_features.md, so you can see which prophets spoke under which kings.
   - More of the Gospels and Acts, the remaining letters (dated by their writing), and the wisdom books.
   - Region outlines: tribal allotments, the two kingdoms, and the empires (key_features.md's empire layer may be the better home for these).

## Next candidates

Not yet ordered. Each is a milestone of its own, drawn from key_features.md.

- **Chronology switcher:** the data and store already hold alternate chronologies; this needs the UI, and a decision on which one is the default. A BC/AD vs BCE/CE toggle fits here too (the store already has `eraStyle`).
- **Search and filters:** the Browse panel has search; filters by person, book, type, era and theme, applied to both views, are still to come.
- **Shareable links:** encode the mode, time, selection and filters in the URL, so a teacher can send a class straight to a moment. Include a passage link (`?passage=Exod.12-14`) that selects the events whose Scripture covers it; this is the contract the reading-plans app will link through, so keep it stable once published.
- **Guided tours:** step-by-step stories that drive both views, such as "The Exodus" or "The Life of Abraham".
- **World-history context:** a lane for surrounding empires and rulers, and empire extents on the map.
- **Scripture in the app:** read passages in a public-domain translation instead of linking out.
- **Deployment:** public, free static hosting on Cloudflare Workers (static assets; Pages is now legacy) connected to the GitHub repo (build `npm run build`, output `dist`, run `npm test` first so failures block a deploy). Only `main` is public. Pushed branches get preview URLs behind Cloudflare Access (the account-wide Access setting for Workers previews), so only I can open them, for example to check a feature on a phone; branches kept local aren't deployed. Serve it at `bible.rector.app` (rector.app's DNS is already on Cloudflare). First rename the repo to `bible-timeline` and name the app "Bible Timeline" in `package.json`, README, CLAUDE.md and the page title, and if the local folder is renamed too, copy Claude Code's memory folder to the new path. Credit OpenFreeMap, OpenStreetMap and Natural Earth on the map, and check OpenFreeMap's fair-use terms. Once `main` deploys automatically, revisit the branching rule in CLAUDE.md.

## Later: reading plans (separate app)

Customized daily Bible reading plans with accounts, saved progress and statistics (current streak, percent of days read, and more), for me and a few others. It will be its own repo, not part of this public app.

- **Hosting:** a Home Assistant local add-on on the Raspberry Pi (HAOS), reached at `reading.rector.app` through the existing Cloudflare Tunnel. Cloudflare Access in front of it handles login (email, free for up to 50 users), and its authenticated-user header can identify the reader, so the app doesn't need its own passwords.
- **Data:** SQLite in WAL mode, backed up by Home Assistant's backups.
- **Link to the timeline:** each reading links to `bible.rector.app/?passage=…` (see Shareable links), so the timeline must ship passage links first. If the reading app wants to know which readings have events, the timeline can publish a small passage-to-event index as JSON.
- **Shared code:** copy the Scripture-reference parsing from this repo instead of writing a second one; make it a shared package only if keeping copies in sync becomes a chore.
- **Working on both:** open each repo in its own VS Code window with its own Claude sessions. Use `/add-dir` when one session needs to read the other repo. Document the link format in both CLAUDE.md files.

## Open questions

Kept current in the "Open questions and known issues" section of [CLAUDE.md](CLAUDE.md).
