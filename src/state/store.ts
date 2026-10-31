import { create } from "zustand";
import { datesFor, eventsById, type EntityRef } from "../data";
import { DEFAULT_CHRONOLOGY } from "../data/chronologies";
import { specExtent, specMidpoint, type EraStyle } from "../lib/dates";
import { datasetRange, entityBounds } from "../lib/entities";

export type ViewMode = "timeline" | "map" | "split";

/** Zoom is pixels per year on the timeline: from the whole Bible on one screen down to about a week. */
export const MIN_ZOOM = 0.15;
export const MAX_ZOOM = 365 * 40;

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

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

  setYear: (year: number) => void;
  setZoom: (pxPerYear: number) => void;
  setMode: (mode: ViewMode) => void;
  setPlaying: (playing: boolean) => void;
  setViewportPx: (px: number) => void;
  setTimeStripPx: (px: number) => void;
  /** Animate the cursor (and optionally zoom) to a target. */
  goTo: (year: number, pxPerYear?: number) => void;
  /** Select an entity, moving the cursor only if needed (see the implementation). Stops playback unless asked not to. */
  select: (ref: EntityRef | null, opts?: { keepPlaying?: boolean }) => void;
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
        selectionNonce: get().selectionNonce + 1,
        playing: opts?.keepPlaying ? get().playing : false,
      });
      if (!ref || ref.kind === "location") return; // Places have no single moment; time stays put.
      const b = entityBounds(ref, get().chronologyId);
      if (!b) return;
      const cur = get().currentYear;
      const ev = ref.kind === "event" ? eventsById.get(ref.id) : undefined;
      const spec = ev && datesFor(ev, get().chronologyId);

      // Point events are moments: go there. Spans (long events, lifespans, eras) only
      // move the cursor if it's outside them: to the start of an event, or the nearest
      // edge of a life or era. The zoom never changes here.
      if (spec && !spec.end) get().goTo(specMidpoint(spec));
      else if (cur < b[0] || cur >= b[1]) {
        // An event starts where it's drawn (mid-year for "from 1446 BC").
        const edge = ev && spec ? specExtent(spec)[0] : cur < b[0] ? b[0] : b[1] - 1e-3;
        get().goTo(edge);
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
