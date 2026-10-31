import { entityBounds, eventOrderKey, eventsInOrder } from "../lib/entities";
import { eventShown } from "../lib/filters";
import { formatLink, parseLink } from "../lib/shareLink";
import { useStore } from "./store";

/**
 * The link to what's on screen now. It keeps the year only while the selection is in view on
 * the timeline: scrolled away from it, the link goes where selecting it would, so whoever opens
 * it sees what was shared. Places have no moment, so they keep the year.
 */
export function currentLink(): string {
  const s = useStore.getState();
  const half = s.viewportPx / 2 / s.pxPerYear;
  const b = s.selection && s.selection.kind !== "location" && entityBounds(s.selection, s.chronologyId);
  const inView = !b || (b[1] > s.currentYear - half && b[0] < s.currentYear + half);
  const query = formatLink({
    mode: s.mode, selection: s.selection, year: inView ? s.currentYear : undefined, pxPerYear: s.pxPerYear, filters: s.filters,
  });
  return `${location.origin}${location.pathname}?${query}`;
}

/**
 * Opens the link the page was loaded with, then keeps the address bar on what's shown, so it
 * can be copied or bookmarked at any time. It's replaced, not pushed: Back leaves the app
 * rather than stepping through every move of the cursor.
 */
export function startUrlSync() {
  const link = parseLink(location.search);
  const store = useStore.getState();
  if (link.mode) store.setMode(link.mode);
  if (link.pxPerYear) store.setZoom(link.pxPerYear);
  if (link.selection) store.select(link.selection, { instant: true });
  // After the selection, so filtering doesn't glide away from it; any glide is overridden below.
  if (link.filters) store.setFilters(link.filters);
  // A link's own year wins over where selecting would put the cursor. A filtered link with
  // neither (a reading plan's `?passage=Exod.12-14`) starts at the first event it shows.
  if (link.year !== undefined) store.setYear(link.year);
  else if (link.filters && !link.selection) {
    const first = eventsInOrder(store.chronologyId).find((ev) => eventShown(ev, link.filters!));
    if (first) store.stepTo(first.id, eventOrderKey(first, store.chronologyId));
  }

  let timer = 0;
  useStore.subscribe((s, prev) => {
    const same = s.mode === prev.mode && s.selection === prev.selection && s.currentYear === prev.currentYear
      && s.pxPerYear === prev.pxPerYear && s.viewportPx === prev.viewportPx && s.filters === prev.filters;
    if (same) return;
    // Only once things settle: gliding and dragging change the year every frame.
    clearTimeout(timer);
    timer = window.setTimeout(() => history.replaceState(history.state, "", currentLink()), 300);
  });
}
