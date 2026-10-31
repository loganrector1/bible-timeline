import { formatLink, parseLink } from "../lib/shareLink";
import { useStore } from "./store";

/** The link to what's on screen now. */
export function currentLink(): string {
  const s = useStore.getState();
  const query = formatLink({ mode: s.mode, selection: s.selection, year: s.currentYear, pxPerYear: s.pxPerYear });
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
  // A link's own year wins over where selecting would put the cursor.
  if (link.year !== undefined) store.setYear(link.year);

  let timer = 0;
  useStore.subscribe((s, prev) => {
    if (s.mode === prev.mode && s.selection === prev.selection && s.currentYear === prev.currentYear && s.pxPerYear === prev.pxPerYear) return;
    // Only once things settle: gliding and dragging change the year every frame.
    clearTimeout(timer);
    timer = window.setTimeout(() => history.replaceState(history.state, "", currentLink()), 300);
  });
}
