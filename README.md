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

Cloudflare Pages builds the site from GitHub on every push, with build command `npm test && npm run build` and output directory `dist` (Node version from `.node-version`), so a failing test blocks the deploy. `main` is the public site at [bible.rector.app](https://bible.rector.app). Every other pushed branch gets its own preview URL, which Cloudflare Access keeps private.

## Content

| File | Holds |
| --- | --- |
| `src/data/eras.json` | Eras with colors and date ranges |
| `src/data/events.json` | Events with dates, people, places, regions, journey and Scripture |
| `src/data/people.json` | People with lifespans and family links |
| `src/data/locations.json` | Places with coordinates, modern names and alternate sites |
| `src/data/journeys.json` | Ordered routes between places, with optional stop dates |
| `src/data/regions.json` | GeoJSON outlines (approximate) |

Conventions:

- **Years are astronomical:** 1 BC is `0`, 1446 BC is `-1445`, and AD 30 is `30`. Add `month` and `day` (approximate Julian placement) when Scripture gives them, plus a `label` for the biblical form, e.g. `"14 Nisan"`.
- **Mark key events `"major": true`.** When the timeline is crowded, their labels and dots show first. Keep it to the turning points a reader would look for (about one event in three at most).
- **Events within a larger event** (the Red Sea crossing during the Exodus) get `"partOf": "<parent id>"`. Keep them as their own events, with their own type, people and Scripture. Their date must fall within the parent's, and if the parent has a journey, one of their places must be a stop on it. Only one level deep.
- **Dates are keyed by chronology:** `early` is the working default and `late` holds late-Exodus alternates. Anything without its own entry falls back to the default.
- `npm test` checks that every file matches its schema and that every id it references exists.

Dates follow the early-Exodus chronology (1 Kings 6:1; Exodus 12:40) and the ages given in Genesis. Genesis 1–11 is placed using the Masoretic genealogies but marked as "date unknown." Coordinates and region outlines are hand-entered approximations and should be checked against a dataset such as [OpenBible.info's Bible geocoding](https://www.openbible.info/geo/) before being relied on.

## Credits

Base map tiles: [OpenFreeMap](https://openfreemap.org/), © [OpenMapTiles](https://www.openmaptiles.org/), data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, with Natural Earth relief. Scripture links open the World English Bible (public domain) on Bible Gateway.
