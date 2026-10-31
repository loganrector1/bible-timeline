import { create } from "zustand";
import { datesFor, eventsById, peopleById, type EntityRef } from "../data";
import { Lane } from "../data/schema";
import { DEFAULT_CHRONOLOGY } from "../data/chronologies";
import { specExtent, specMidpoint, type EraStyle } from "../lib/dates";
import { activeEvents } from "../lib/activeEvents";
import { NO_FILTERS, shownBy, type Filters } from "../lib/filters";
import { datasetRange, entityBounds, eventBounds, eventOrderKey, eventsInOrder, shownLane } from "../lib/entities";

export type ViewMode = "timeline" | "map" | "split";

/** Zoom is pixels per year on the timeline: from the whole Bible on one screen down to about a week. */
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 365 * 40;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Which people lanes are shown, remembered per browser (a convenience; it may be unavailable). */
const LANES_KEY = "bible-timeline:lanes";
const LANE_ORDER: Lane[] = Lane.options;
function loadLanes(): Lane[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(LANES_KEY) ?? "null");
    if (Array.isArray(saved)) return LANE_ORDER.filter((l) => saved.includes(l));
  } catch {
    // Private windows and blocked storage fall back to the default.
  }
  return ["people"];
}
function saveLanes(lanes: Lane[]) {
  try {
    localStorage.setItem(LANES_KEY, JSON.stringify(lanes));
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

/** "system" follows the OS; the others override it. Remembered per browser. */
export type Theme = "system" | "light" | "dark";
const THEME_KEY = "bible-timeline:theme";
function loadTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Blocked storage: follow the system.
  }
  return "system";
}
function applyTheme(theme: Theme) {
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not remembered; it still applies now.
  }
}

type State = {
  /** The shared "current moment", as a fractional astronomical year. */
  currentYear: number;
  pxPerYear: number;
  chronologyId: string;
  eraStyle: EraStyle;
  mode: ViewMode;
  selection: EntityRef | null;
  playing: boolean;
  /** Height of the timeline viewport, reported by the timeline; used to fit spans. */
  viewportPx: number;
  /** Height of the map's time strip, reported by it (0 while the map is hidden); used to split a phone screen. */
  timeStripPx: number;
  /** Bumped on every select, so the map can replay an animation even for the same entity. */
  selectionNonce: number;
  /**
   * The event stepped to without selecting it (dragging Nearest events). It's the map's focus
   * while the cursor stays at `year`, since events sharing a moment can't be told apart by the
   * cursor alone.
   */
  focusHint: { id: string; year: number } | null;
  /** Which events are shown (`lib/filters.ts`). A selected event shows whatever they say. */
  filters: Filters;
  /**
   * Change some of the filters. A person filtered to brings their lane into view, as selecting
   * does. Adding a filter with nothing selected and no match on screen glides to the nearest match.
   */
  setFilters: (filters: Partial<Filters>) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** People lanes shown on the timeline, in display order. */
  lanes: Lane[];
  setLaneShown: (lane: Lane, shown: boolean) => void;

  setYear: (year: number) => void;
  setZoom: (pxPerYear: number) => void;
  setMode: (mode: ViewMode) => void;
  setPlaying: (playing: boolean) => void;
  setViewportPx: (px: number) => void;
  setTimeStripPx: (px: number) => void;
  /** Move the cursor to an event without selecting it, making it the focus there. */
  stepTo: (eventId: string, year: number) => void;
  /** Animate the cursor (and optionally zoom) to a target. */
  goTo: (year: number, pxPerYear?: number) => void;
  /**
   * Select an entity, moving the cursor only if needed (see the implementation). Stops playback
   * unless asked not to. `instant` jumps instead of gliding (opening a link).
   */
  select: (ref: EntityRef | null, opts?: { keepPlaying?: boolean; instant?: boolean }) => void;
  /** Center an entity on the timeline and fit its span. */
  showOnTimeline: (ref: EntityRef) => void;
  browseOpen: boolean;
  setBrowseOpen: (open: boolean) => void;
};

let animation = 0;

function cancelAnimation() {
  cancelAnimationFrame(animation);
  animation = 0;
}

export const useStore = create<State>()((set, get) => {
  const clampYear = (y: number) => {
    const [lo, hi] = datasetRange(get().chronologyId);
    return Math.min(hi, Math.max(lo, y));
  };

  return {
    currentYear: -2090,
    pxPerYear: 0.6,
    chronologyId: DEFAULT_CHRONOLOGY,
    eraStyle: "BC",
    mode: "split",
    selection: null,
    playing: false,
    viewportPx: 700,
    timeStripPx: 0,
    focusHint: null,
    lanes: loadLanes(),
    theme: loadTheme(),
    setTheme: (theme) => {
      applyTheme(theme);
      set({ theme });
    },
    filters: NO_FILTERS,
    setFilters: (f) => {
      const before = get().filters;
      const filters = { ...before, ...f };
      set({ filters });
      for (const id of f.people ?? []) {
        const person = peopleById.get(id);
        if (person && !shownLane(person, get().lanes)) get().setLaneShown(person.lane, true);
      }
      // Narrowing what's shown can leave the screen empty. Not while something is selected (it
      // stays in view, and time shouldn't jump away from it), and never when removing a filter.
      const added = (Object.keys(f) as (keyof Filters)[]).some((k) =>
        filters[k].some((x) => !(before[k] as unknown[]).some((y) => JSON.stringify(y) === JSON.stringify(x))));
      const { selection, currentYear, viewportPx, pxPerYear, chronologyId: chron } = get();
      if (!added || selection) return;
      const shown = shownBy(filters);
      const half = viewportPx / 2 / pxPerYear;
      const onScreen = eventsInOrder(chron).some((ev) => {
        const b = shown?.(ev) && eventBounds(ev, chron);
        return b && b[1] > currentYear - half && b[0] < currentYear + half;
      });
      const nearest = onScreen ? undefined : activeEvents(currentYear, chron, undefined, shown)[0];
      if (nearest) get().goTo(eventOrderKey(nearest, chron));
    },
    setLaneShown: (lane, shown) => {
      const lanes = LANE_ORDER.filter((l) => (l === lane ? shown : get().lanes.includes(l)));
      saveLanes(lanes);
      set({ lanes });
    },
    selectionNonce: 0,
    browseOpen: false,

    setBrowseOpen: (browseOpen) => set({ browseOpen }),
    setYear: (year) => {
      cancelAnimation();
      set({ currentYear: clampYear(year) });
    },
    setZoom: (pxPerYear) => set({ pxPerYear: clampZoom(pxPerYear) }),
    setMode: (mode) => set({ mode }),
    setPlaying: (playing) => set({ playing }),
    setViewportPx: (viewportPx) => set({ viewportPx }),
    setTimeStripPx: (timeStripPx) => set({ timeStripPx }),
    stepTo: (id, year) => {
      cancelAnimation();
      const y = clampYear(year);
      set({ currentYear: y, focusHint: { id, year: y } });
    },

    goTo: (year, pxPerYear) => {
      cancelAnimation();
      const from = { year: get().currentYear, zoom: get().pxPerYear };
      const to = { year: clampYear(year), zoom: clampZoom(pxPerYear ?? from.zoom) };
      const t0 = performance.now();
      const duration = 700;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / duration);
        const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        // Interpolate zoom geometrically so it feels even across orders of magnitude.
        set({
          currentYear: from.year + (to.year - from.year) * e,
          pxPerYear: from.zoom * (to.zoom / from.zoom) ** e,
        });
        animation = t < 1 ? requestAnimationFrame(step) : 0;
      };
      animation = requestAnimationFrame(step);
    },

    select: (ref, opts) => {
      set({
        selection: ref,
        focusHint: null,
        selectionNonce: get().selectionNonce + 1,
        playing: opts?.keepPlaying ? get().playing : false,
      });
      // A person in a hidden lane brings their lane into view.
      const person = ref?.kind === "person" ? peopleById.get(ref.id) : undefined;
      if (person && !shownLane(person, get().lanes)) get().setLaneShown(person.lane, true);
      if (!ref || ref.kind === "location") return; // Places have no single moment; time stays put.
      const b = entityBounds(ref, get().chronologyId);
      if (!b) return;
      const cur = get().currentYear;
      const ev = ref.kind === "event" ? eventsById.get(ref.id) : undefined;
      const spec = ev && datesFor(ev, get().chronologyId);
      const move = (y: number) => (opts?.instant ? get().setYear(y) : get().goTo(y));

      // Point events are moments: go there. Spans (long events, lifespans, eras) only
      // move the cursor if it's outside them: to the start of an event, or the nearest
      // edge of a life or era. The zoom never changes here.
      if (spec && !spec.end) move(specMidpoint(spec));
      else if (cur < b[0] || cur >= b[1]) {
        // An event starts where it's drawn (mid-year for "from 1446 BC").
        const edge = ev && spec ? specExtent(spec)[0] : cur < b[0] ? b[0] : b[1] - 1e-3;
        move(edge);
      }
    },

    showOnTimeline: (ref) => {
      const b = entityBounds(ref, get().chronologyId);
      if (!b) return;
      const { viewportPx, pxPerYear } = get();
      const ev = ref.kind === "event" ? eventsById.get(ref.id) : undefined;
      const isPoint = ev !== undefined && !datesFor(ev, get().chronologyId)?.end;
      // Center it, and fit spans into ~60% of the viewport.
      const zoom = isPoint ? pxPerYear : (viewportPx * 0.6) / (b[1] - b[0]);
      get().goTo((b[0] + b[1]) / 2, zoom);
    },
  };
});
