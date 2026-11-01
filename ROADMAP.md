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

## Deployment (done)

Live at [bible.rector.app](https://bible.rector.app): a Cloudflare Worker serving the static build (Cloudflare calls Pages legacy), built from GitHub on every push with `npm test` gating the deploy. `main` is the public site; every other pushed branch gets a preview URL behind Cloudflare Access (scope "Previews only"), for checking a feature on a phone. The repo is `loganrector1/bible-timeline`. Still to do: decide whether to revisit the branching rule in CLAUDE.md now that `main` deploys automatically; if the local folder is renamed to match, copy Claude Code's memory folder to the new path.

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
   - ~~Journeys~~ (branch `feature/journeys`): Paul's three journeys and voyage to Rome, with seven events along them; the deportations to Assyria and Babylon; Zerubbabel's and Ezra's returns; Bethlehem and the flight to Egypt. Stops can now have `via` points, so sea legs go round islands. Stop numbers, hidden under place dots since the first map version, show again.
   - ~~Kings and prophets~~ (branches `feature/people`, `feature/prophets`): people lanes (Important people, Kings & rulers, Prophets, Church) chosen in a People menu; every king of the united kingdom, Israel and Judah, by sole reign, with Judah and Israel in their own tinted columns; the foreign rulers who act on Israel and the church, from Tiglath-pileser to Nero; and all twelve minor prophets, so you can see which prophets spoke under which kings. The dataset now has 148 people.
   - ~~More of the Gospels and Acts, and the letters~~ (branch `feature/nt-content`): fourteen more Gospel events, four more from Acts, and the letters and Gospels dated by their writing. Later (branch `feature/wisdom`): Jude, David's psalms, Solomon's wisdom books, and Job's story.
   - ~~Region outlines~~: tribal allotments, the two kingdoms and the empires moved to Empires on the map.

## Shareable links (done)

The view, time, zoom and selection are in the URL, kept current as you move, and the details panel has a Share button (the share sheet on phones, the clipboard on desktop), so a teacher can send a class straight to a moment. A link leaves out the year when the selection has been scrolled off screen, so the reader lands on what was shared. Passage links were moved to Search and filters.

## Filters and settings (done)

Filters by event type and person, applied to both views (timeline, map, Nearest events, step and play) and carried in links, with a Filter button and a chip bar under the header, dimmed hidden events and a filter suggestion in Browse, and shortcuts in the event and person panels. A selected event always shows. Births and deaths filtered to become event dots, and people not in a shown event dim. Books and passages filter too, and `?passage=Exod.12-14` links (OSIS) are live, the contract the reading-plans app links through. Adding a filter glides to the nearest match when none is on screen and nothing is selected. A Settings menu (the gear) holds the theme (System, Light or Dark), BC/AD or BCE/CE, and the date of the Exodus: early (c. 1446 BC, the default) or late (c. 1260 BC), also chosen from an event's "Use this date" and carried in links.

## Guided tours (done)

Eight tours (the life of Abraham, the Exodus, David, the Divided Kingdom, Exile and return, the life of Jesus, the early church, Paul's journeys), narrated step by step at the top of the details panel, listed in Browse, shared by link (`tour=exodus&step=3`), with progress remembered. Filters by era and place came with them.

## Scripture in the app (done)

Each Scripture reference opens its passage inline in the details panel, in the Berean Standard Bible (public domain), bundled one chunk per book so it needs no API and works offline; passages over 6 verses start cut short with "Read more", and each links out to the ESV on Bible Gateway. Quotes in summaries, notes and tours now follow the BSB word for word.

## World history (done)

An optional World history lane: the great powers from Ur's Third Dynasty to Rome as bars, their rulers' reigns beside them (foreign rulers moved out of the Kings lane, which is now Israel and Judah), and world events from outside Scripture (Hammurabi's laws to the Jewish revolt) as squares in the event lane. Off by default; while it's off, world history stays out of the map and of stepping and play. Empires have their own panels and links (`?empire=assyria`). The "People" menu became "Lanes".

## Empires on the map (done)

The great powers and Israel's own states drawn on the map as they stood at the cursor's time, so scrubbing through the Divided Kingdom shows Assyria swallowing Samaria, Babylon taking Judah, then Persia overtaking Babylon.

Decided: outlines change in steps at each dated snapshot with a quick cross-fade (no morphing, which would invent borders); an Empires toggle beside Modern borders, on by default; the great powers from [Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) (CC BY 4.0), cut to the dates in `empires.json`; Israel drawn by hand (Cliopatria's Israel and Judah end in 701 BC): the tribal allotments, Saul's kingdom, David and Solomon's with the lands subject to them, Israel and Judah, Yehud, Herod's kingdom and his sons' tetrarchies, and Roman Judea. Selecting an empire shows its extent strongly and frames it. Takes over Milestone 2's "Region outlines" step.

Also built: Israel's neighbours (Philistia, Phoenicia, Aram, Ammon, Moab, Edom, the Nabataeans), opening their lands as places; "Ruled by" on every place, listing the empires and Israel's own states over it; the map shows rule, not overlordship (Egypt's in Canaan is told in words); Egypt's and Canaan's regions redrawn to follow the Nile and Scripture's borders; unused places hidden when zoomed out.

## Next candidates

Not yet ordered. Each is a milestone of its own, drawn from key_features.md.

- **Theme filter:** covenants, prophecy fulfilled, women of the Bible and the like; needs tags on every event first.

## Last: a full content audit

When the app is close to finished, review all of its data in one pass rather than era by era:

- **Events:** do we have the right ones? Are any missing that shouldn't be? Are any unnecessary and cluttering the app? Are they in the right order with the right dates, and are their types right?
- **People, places, eras, empires, journeys and tours:** check each for accuracy, order and whether it earns its place.

## Later: reading plans (separate app)

Customized daily Bible reading plans with accounts, saved progress and statistics (current streak, percent of days read, and more), for me and a few others. It will be its own repo, not part of this public app.

- **Hosting:** a Home Assistant local add-on on the Raspberry Pi (HAOS), reached at `reading.rector.app` through the existing Cloudflare Tunnel. Cloudflare Access in front of it handles login (email, free for up to 50 users), and its authenticated-user header can identify the reader, so the app doesn't need its own passwords.
- **Data:** SQLite in WAL mode, backed up by Home Assistant's backups.
- **Link to the timeline:** each reading links to `bible.rector.app/?passage=…` (live; the format is in the timeline's CLAUDE.md). If the reading app wants to know which readings have events, the timeline can publish a small passage-to-event index as JSON.
- **Shared code:** copy the Scripture-reference parsing from this repo instead of writing a second one; make it a shared package only if keeping copies in sync becomes a chore.
- **Working on both:** open each repo in its own VS Code window with its own Claude sessions. Use `/add-dir` when one session needs to read the other repo. Document the link format in both CLAUDE.md files.

## Open questions

Kept current in the "Open questions and known issues" section of [CLAUDE.md](CLAUDE.md).
