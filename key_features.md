# Bible Timeline — Key Features

## Vision
An interactive, visual Bible timeline for personal and church study. Users can explore the whole biblical story from Creation to Revelation: when things happened, who was involved, and where. There are two linked views, a **Timeline** and a **Map**, and both share the same data and the same "current moment in time."

**Audience:** lay readers, small groups, Sunday school teachers, and anyone studying the Bible personally. The tool should feel approachable and clear without becoming academic, while still being accurate and honest about uncertainty.

---

## 1. Core Data Model (shared by every view)
Everything in the app is built from a single set of linked entities. Both modes read from this same data, so nothing is duplicated.

- **Eras / Periods.** Large spans of time, e.g. Primeval History, Patriarchs, Egypt & Exodus, Wilderness, Conquest, Judges, United Kingdom, Divided Kingdom, Exile, Return, Intertestamental, Life of Christ, Early Church. Each has a start/end, color, and summary.
- **Events.** A point or a span in time, e.g. "The Exodus," "Fall of Jerusalem." Each event has:
  - Title, short summary, longer description
  - Date (or date range) plus a confidence level
  - Linked people, locations, and Scripture references
  - Event type/category (birth, death, battle, covenant, miracle, journey, reign, prophecy, etc.)
  - Optional geographic data: locations, routes/movements, regions to highlight
- **People.** Name, alternate names, role (patriarch, judge, king, prophet, apostle…), lifespan or active years, family relationships (parent/child/spouse), linked events, key Scripture.
- **Locations.** Name (ancient and modern), coordinates, type (city, region, mountain, river, sea), linked events and people, and a short description.
- **Movements / Journeys.** Ordered paths between locations with timing, e.g. the Exodus route, Abraham's journey from Ur, Paul's missionary journeys, the deportation to Babylon.
- **Regions / Territories.** Polygons that change over time: tribal allotments, kingdoms of Israel and Judah, and empire boundaries (Egypt, Assyria, Babylon, Persia, Greece, Rome).
- **Scripture References.** Book/chapter/verse ranges attached to any entity.

### Chronology & Date Uncertainty
- One **default chronology** drives positions on the timeline and map.
- Disputed events store **alternate dates** with a short note on each view (e.g. Exodus: c. 1446 BC "early date" vs c. 1260 BC "late date").
- Users can **switch chronology** and watch the timeline and map update.
- Dates show **confidence** visually (exact, approximate "c.", range, or unknown), e.g. fuzzy edges or a "~" marker.
- BC/AD handling is correct (no year 0), with an option to show BC/AD or BCE/CE.

---

## 2. Timeline Mode
A classic linear timeline where **time flows top to bottom, vertically**.

- **Vertical scrolling timeline**, with the earliest events at the top.
- **Eras as background bands** with labels and colors.
- **Events** as markers or cards placed at their date; spans show as bars.
- **Lanes / tracks** that can be toggled (e.g. People lifespans, Kings of Israel, Kings of Judah, Prophets, Events, World History).
- **Zoom:** a continuous zoom from the whole Bible down to a single decade or year. More detail appears as you zoom in (semantic zoom).
- **Time cursor:** a visible "current moment" line. Moving it updates the map in sync.
- **Click an event, person, or place** to open a detail panel (see §5).
- **Overlapping lifespans** let you see at a glance who was alive at the same time (e.g. which prophets ministered during which kings).
- **Minimap / overview scrubber** on the side for quick jumps between eras.

---

## 3. Map Mode
A geographic map of the ancient Near East and Mediterranean world, **linked to the same timeline and time cursor**.

- **Time-aware map:** the map shows the world *as of the current moment*:
  - Active events appear as markers at their locations
  - Political boundaries and territories change over time (kingdoms, empires, tribal lands)
  - Relevant regions are highlighted for the selected event
- **Animated movements:** journeys play out as animated paths along their routes (e.g. the Exodus from Egypt through the wilderness to Sinai and Canaan), with stops marked in order.
- **Time controls:**
  - Scrubber/slider to move backward and forward through time
  - Play/pause to animate history forward, with speed control
  - Step forward/back by event
- **Event focus:** selecting an event (from either mode) flies or zooms the map to the area, highlights the locations and regions, and plays any movement.
- **Ancient and modern place names**, with a toggle for modern borders as reference.
- **Layers to toggle:** events, journeys, territories, cities, terrain/geography, labels.
- **Compact timeline strip** at the bottom of the map showing eras and the cursor, so context is never lost.

### Example: The Exodus
- **Timeline:** an event bar at c. 1446 BC (alternate: c. 1260 BC) in the "Egypt & Exodus" era, linked to Moses, Aaron, Miriam, and Pharaoh, with Scripture in Exodus 12–14.
- **Map:** Egypt (Goshen) is highlighted. An animated route runs from Rameses through Succoth, the Red Sea crossing, and on to Mount Sinai, with the major stops marked. The detail panel shows the same people, dates, and Scripture.

---

## 4. Linked State Between Modes
- **One shared state:** the current time, selected entity, active filters, and chronology are the same in both modes.
- **Switching modes keeps context.** Selecting the Exodus in the timeline and switching to the map shows the Exodus on the map, and vice versa.
- **Optional split view:** timeline and map side by side (or stacked on mobile), synced live.
- **Deep links / shareable URLs** encode the mode, time, selection, and filters (useful for teachers sharing with a class).

---

## 5. Detail Panels
A consistent side panel or drawer for any entity:
- **Event:** summary, date(s) and alternate views, people involved, locations, Scripture, related events (before/after), "Show on map" / "Show on timeline."
- **Person:** bio, lifespan, family tree snippet, key events in order, Scripture, "Trace this person's life" (highlights all their events and travels).
- **Location:** description, ancient/modern name, every event that happened there across time, photos/illustrations (optional, later).
- **Era:** overview, key people, key events, books of the Bible written or set in it.

---

## 6. Scripture Integration
- Every entity links to its **Scripture references**.
- Click a reference to **read the passage**, either in-app (public-domain translation such as KJV/WEB/BSB) or through an external link (e.g. a Bible website).
- **Reverse lookup:** pick a book/chapter and see where it falls on the timeline and map.
- Show **when each book was written** vs **when its events take place**, where relevant.

---

## 7. Search & Filters
- **Global search** across events, people, places, and Scripture references, with autocomplete.
- **Filters:**
  - By person (show only events involving David)
  - By book of the Bible
  - By event type/category
  - By era / date range
  - By region/location
  - By theme (covenants, miracles, prophecy fulfillment, kings, battles, etc.)
- Filters apply to **both** timeline and map at the same time.

---

## 8. Guided Tours / Stories
Curated, step-by-step walkthroughs that drive both the timeline and the map:
- Examples: "The Life of Abraham," "The Exodus," "The Life of David," "The Divided Kingdom," "The Exile & Return," "The Life of Jesus," "Paul's Missionary Journeys."
- Each step moves the time cursor, selects events, animates the map, and shows short narrative text with Scripture.
- Next/previous controls; a tour can be paused to explore freely and then resumed.
- Good for small groups and Sunday school lessons.

---

## 9. World-History Context
- An optional **World History lane** on the timeline: major contemporary empires, rulers, and events (Egyptian dynasties, Assyrian and Babylonian kings, Persian rulers, Alexander, Roman emperors).
- An **empire layer on the map** showing the extent of surrounding powers at the current time.
- Clear visual distinction between biblical events and outside historical context.

---

## 10. UX & Accessibility
- **Approachable and clean:** readable typography, a warm and inviting design, nothing overly academic.
- **Responsive:** works on desktop, tablet, and phone (vertical timeline suits mobile well).
- **Light/dark mode.**
- **Keyboard navigation** and screen-reader-friendly detail panels; color is never the only signal.
- **Fast:** smooth zoom and scrub even with thousands of entities.
- **Onboarding:** a short first-run intro explaining the timeline, the map, and the time cursor.

---

## 11. Content & Data Management
- Data is stored in a structured, versionable format (e.g. JSON/GeoJSON files or a small database) that is easy to extend.
- Every entity can carry **sources/notes** explaining where its date or location comes from.
- **Uncertain locations** (e.g. the Red Sea crossing site, Mount Sinai) can show multiple candidate sites with notes, the same way dates do.
- A simple way to **add or edit content** (an admin/editor view or plain data files) so coverage can grow over time.

---

## 12. Future / Nice-to-Have
- Personal notes, bookmarks, and highlights on events
- Reading-plan integration (follow along chronologically through a Bible reading plan)
- Printable or exportable timeline segments and maps for lessons
- Family-tree / genealogy view (e.g. Adam to Jesus)
- Illustrations, photos of sites, and short media clips
- Multiple languages
- Offline support

---

## Open Questions for Planning
- Platform: web app (likely), with mobile-friendly responsive design or a dedicated app later?
- Map tech: vector map library and base map style (historical/terrain look vs modern)?
- Data sourcing: which existing open datasets (e.g. OpenBible.info geocoding) to start from vs. hand-curated?
- Which chronology to use as the default?
- Which Bible translation(s) to show in-app, given licensing?
- How much content is needed for a usable v1, given the whole-Bible scope (e.g. ~200 key events, ~150 people, ~250 places)?
