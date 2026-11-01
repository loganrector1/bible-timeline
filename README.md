# Bible Timeline

An interactive, visual Bible timeline for personal and church study. Explore the whole biblical story from Creation to Revelation: when things happened, who was involved, and where. Two linked views, a **Timeline** and a **Map**, share the same data and the same "current moment in time."

See [key_features.md](key_features.md) for the full feature vision and [ROADMAP.md](ROADMAP.md) for what's built and what's next.

## Status

Milestone 1 is a working vertical slice covering **Creation through the death of Moses**:

- A vertical timeline (earliest at the top) that zooms from millennia down to individual days. It has era bands, events, lifespans, and an overview strip.
- A time-aware map: places light up as their events come into range, regions are highlighted, and journeys animate stop by stop.
- One shared "current moment" and selection drive both views, shown side by side or one at a time.
- Detail panels for events, people, places and eras, linked to each other and to Scripture.
- Disputed dates (early vs. late Exodus) and disputed sites (Mount Sinai, the Red Sea crossing) carry alternates and notes.

## Getting started

Built with React, TypeScript, Vite, Tailwind CSS and MapLibre GL. It's a static site: all content lives as JSON/GeoJSON in `src/data/`.

Requires [Node.js](https://nodejs.org/) 22 or later.

```sh
npm install      # once
npm run dev      # start the dev server at http://localhost:5173
npm test         # run tests (date math + data integrity)
npm run build    # type-check and build static files into dist/
```

## Deployment

Cloudflare Workers serves the built `dist` folder as static files (`wrangler.jsonc`), building from GitHub on every push: build command `npm test && npm run build`, deploy command `npx wrangler deploy`, Node version from `.node-version`. A failing test blocks the deploy. `main` is the public site at [bible.rector.app](https://bible.rector.app). Every other pushed branch gets its own preview URL, which Cloudflare Access keeps private (the account-wide Access switch for Workers).

## Content

| File | Holds |
| --- | --- |
| `src/data/eras.json` | Eras with colors and date ranges |
| `src/data/events.json` | Events with dates, people, places, regions, journey and Scripture |
| `src/data/people.json` | People with lifespans and family links |
| `src/data/locations.json` | Places with coordinates, modern names and alternate sites |
| `src/data/journeys.json` | Ordered routes between places, with optional stop dates |
| `src/data/regions.json` | GeoJSON outlines (approximate) |
| `src/data/tours.json` | Guided tours: steps that each select an event, with narration |

Conventions:

- **Years are astronomical:** 1 BC is `0`, 1446 BC is `-1445`, and AD 30 is `30`. Add `month` and `day` (approximate Julian placement) when Scripture gives them, plus a `label` for the biblical form, e.g. `"14 Nisan"`.
- **Mark key events `"major": true`.** When the timeline is crowded, their labels and dots show first. Keep it to what a reader would look for: the turning points, and the stories lay readers know best even when history weighs them less (Daniel in the lions' den beside Cyrus's decree). About one event in three at most.
- **Events within a larger event** (the Red Sea crossing during the Exodus) get `"partOf": "<parent id>"`. Keep them as their own events, with their own type, people and Scripture. Their date must fall within the parent's, and if the parent has a journey, one of their places must be a stop on it. Only one level deep.
- **Add a person** when they appear in two or more events, or a book is named after them or written by them. Give them `dates` only when Scripture supports a lifespan, or for a reign or ministry it places (say which in `dateNote`); otherwise their bar spans their events. Put kings and rulers, prophets, and apostles and church figures in their `lane` (`kings`, `prophets`, `church`); the main figures stay in the default People lane, and list any other lane they fit in `alsoIn` (Peter is also `church`, David also `kings`). Someone in two lanes shows once, in the first that's on, except that kings always show in the Kings lane too, as their reign. Every king of Israel and Judah has an entry with its `kingdom`, and, when it differs from `dates` (a lifespan, or a reign counted from a coregency), its sole reign in `reign` (Thiele). Foreign rulers who act on Israel or the church get an entry too, dated by their reign.
- **Births and deaths** list the person they're about first, and must match that person's lifespan (`npm test` checks). Mark the ones the story dwells on `"major": true`; the rest are drawn as marks on the person's bar.
- **Dates are keyed by chronology:** `early` is the default and `late` holds late-Exodus alternates (readers choose in Settings). Anything without its own entry falls back to the default.
- **Tours** step through events in date order (`npm test` checks, in both chronologies). Each step's `text` is one or two sentences that tie the event to the story, rather than repeating its summary, which the details panel shows just below; quote Scripture with a reference where it helps.
- `npm test` checks that every file matches its schema and that every id it references exists.

Dates follow the early-Exodus chronology (1 Kings 6:1; Exodus 12:40) and the ages given in Genesis. Kings follow Thiele's chronology (the kingdom divides in 931 BC, Jerusalem falls in 586), and the crucifixion is dated AD 30, with AD 33 noted as the alternative. Prophets are dated by their ministry (event type `ministry`), letters by when and where they were written (`writing`). Genesis 1–11 is placed using the Masoretic genealogies but marked as "date unknown." Place coordinates follow [OpenBible.info's Bible geocoding data](https://www.openbible.info/geo/). Each location's `openbible` field names its OpenBible place (`"Bethel 1"`), with `#n` when we follow a candidate site other than OpenBible's first choice (`"Rephidim#2"`, the traditional site). `node scripts/openbible.mjs` reports places that drift from it or that OpenBible is unsure of; `--write` moves drifted points, and `find`/`show` search its places. Region outlines are still hand-drawn approximations.

## Credits

Base map tiles: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://www.openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, with Natural Earth relief. Place coordinates: [OpenBible.info](https://www.openbible.info/geo/) Bible geocoding data, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Scripture text: the [Berean Standard Bible](https://bereanbible.com/) (public domain), built into `src/data/bible/` by `node scripts/bsb.mjs`; links out open the ESV on Bible Gateway.
