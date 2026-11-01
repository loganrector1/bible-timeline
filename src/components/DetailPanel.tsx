import { useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { empiresById, erasById, eventsById, locationsById, peopleById } from "../data";
import { entityTitle } from "../lib/entities";
import { useIsPhone } from "../lib/useMediaQuery";
import { useStore } from "../state/store";
import { currentLink } from "../state/urlSync";
import EmpireDetail from "./detail/EmpireDetail";
import EraDetail from "./detail/EraDetail";
import EventDetail from "./detail/EventDetail";
import LocationDetail from "./detail/LocationDetail";
import PersonDetail from "./detail/PersonDetail";
import TourBox from "./TourBox";

const KIND_LABEL = { event: "Event", person: "Person", location: "Place", era: "Era", empire: "Empire" } as const;

/** Height of the phone sheet's collapsed peek. */
export const PEEK_HEIGHT = "9.5rem";

/** Swipes shorter than this count as taps. */
const SWIPE_PX = 24;

/**
 * How far above the container's bottom edge the phone sheet must stop so it never
 * covers the controls there: anything marked `data-sheet-floor` that sits at the
 * bottom (the map's time strip, the timeline's toolbar), plus that control's own margin.
 */
function useSheetFloor(ref: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [floor, setFloor] = useState(0);
  useEffect(() => {
    const container = ref.current?.parentElement;
    if (!enabled || !container) return setFloor(0);
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bottom = container.getBoundingClientRect().bottom;
      let f = 0;
      for (const el of container.querySelectorAll("[data-sheet-floor]")) {
        const r = el.getBoundingClientRect();
        const margin = bottom - r.bottom;
        if (r.height > 0 && margin < SWIPE_PX) f = Math.max(f, bottom - r.top + margin);
      }
      setFloor(f);
    };
    const schedule = () => (frame ||= requestAnimationFrame(measure));
    // Controls appear late (the map loads lazily) and change with the view mode.
    const mutations = new MutationObserver(schedule);
    mutations.observe(container, { childList: true, subtree: true });
    const resizes = new ResizeObserver(schedule);
    resizes.observe(container);
    measure();
    return () => {
      mutations.disconnect();
      resizes.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref, enabled]);
  return floor;
}

/**
 * Shares a link to what's on screen: the phone's share sheet on touch screens, otherwise
 * copied to the clipboard (desktop share dialogs are clumsier than a paste).
 */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    const url = currentLink();
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Cancelled.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access (an insecure page); the address bar still holds the link.
    }
  };

  return (
    <button
      data-sheet-close
      onClick={share}
      aria-label="Share a link to this"
      className="flex items-center gap-1 rounded p-1.5 text-sm text-ink-muted hover:bg-paper-2 hover:text-ink"
    >
      {copied ? (
        <span role="status">Link copied</span>
      ) : (
        <svg aria-hidden viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {/* Android's share mark: three dots joined by two lines. */}
          <circle cx="14.5" cy="4.5" r="2.25" />
          <circle cx="5.5" cy="10" r="2.25" />
          <circle cx="14.5" cy="15.5" r="2.25" />
          <path d="m7.5 8.8 5-3.1M7.5 11.2l5 3.1" />
        </svg>
      )}
    </button>
  );
}

/** Side panel (desktop) or bottom sheet (phone) describing the selected entity. */
export default function DetailPanel() {
  const selection = useStore((s) => s.selection);
  const selectionNonce = useStore((s) => s.selectionNonce);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const select = useStore((s) => s.select);
  const showOnTimeline = useStore((s) => s.showOnTimeline);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

  // On phones the panel is a bottom sheet that opens as a short peek above the
  // controls; swipe up or tap to expand. It keeps its size as the selection changes,
  // so play can step through events without the sheet covering the map.
  const isPhone = useIsPhone();
  const floor = useSheetFloor(scrollRef, isPhone);
  const [expanded, setExpanded] = useState(false);
  const peek = isPhone && !expanded;
  const drag = useRef<{ y: number; onHandle: boolean } | null>(null);
  const setSheet = (open: boolean) => {
    setExpanded(open);
    if (!open) scrollRef.current?.scrollTo({ top: 0 });
  };
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    const target = e.target as Element;
    // When expanded, only the header drags, so the content can scroll.
    if (!isPhone || target.closest("[data-sheet-close]") || (expanded && !target.closest("[data-sheet-drag]"))) return;
    // Capturing retargets the click to the sheet, so taps are handled here, not by onClick.
    drag.current = { y: e.clientY, onHandle: !!target.closest("[data-sheet-handle]") };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: PointerEvent<HTMLElement>) => {
    if (!drag.current) return;
    const { y, onHandle } = drag.current;
    drag.current = null;
    const dy = e.clientY - y;
    if (dy < -SWIPE_PX) setSheet(true);
    else if (dy > SWIPE_PX) setSheet(false);
    // A tap on the handle toggles; a tap anywhere else on the peek expands it.
    else if (onHandle) setSheet(!expanded);
    else if (peek) setSheet(true);
  };

  // New selection: scroll to the top and move focus to the heading for screen readers.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [selectionNonce]);

  if (!selection) return null;

  const body = (() => {
    switch (selection.kind) {
      case "event": {
        const ev = eventsById.get(selection.id);
        return ev && <EventDetail ev={ev} />;
      }
      case "person": {
        const p = peopleById.get(selection.id);
        return p && <PersonDetail person={p} />;
      }
      case "location": {
        const loc = locationsById.get(selection.id);
        return loc && <LocationDetail loc={loc} />;
      }
      case "era": {
        const era = erasById.get(selection.id);
        return era && <EraDetail era={era} />;
      }
      case "empire": {
        const empire = empiresById.get(selection.id);
        return empire && <EmpireDetail empire={empire} />;
      }
    }
  })();

  // Only offered when that view is hidden. Each view shows its own "Show <name>"
  // chip when the selection is out of frame. Phones get the one view; wider screens
  // get both side by side.
  const hidden = mode === "map" ? "timeline" : mode === "timeline" ? "map" : null;
  const openOn = (view: "map" | "timeline") => {
    setMode(isPhone ? view : "split");
    if (view === "timeline") showOnTimeline(selection);
    else select(selection); // Re-selecting frames the map and replays any journey.
  };

  return (
    <aside
      ref={scrollRef}
      aria-label="Details"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      style={isPhone ? { bottom: floor, maxHeight: peek ? PEEK_HEIGHT : `min(55%, calc(100% - ${floor}px - 3rem))` } : undefined}
      className={`absolute inset-x-0 z-20 rounded-t-2xl border-t border-line bg-paper shadow-[0_-8px_30px_rgb(0_0_0/0.15)] transition-[max-height] duration-200 md:static md:max-h-none md:w-96 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none ${
        peek ? "touch-none overflow-hidden select-none" : "overflow-y-auto"
      }`}
    >
      <div data-sheet-drag className="sticky top-0 z-[1] bg-paper/95 backdrop-blur max-md:touch-none max-md:select-none">
        <button
          data-sheet-handle
          // Keyboard only (detail 0); pointer taps arrive through onPointerUp.
          onClick={(e) => e.detail === 0 && setSheet(!expanded)}
          aria-expanded={expanded}
          aria-label={expanded ? "Show less" : "Show more"}
          className="flex w-full justify-center pt-2 pb-1 md:hidden"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-line" />
        </button>
        <TourBox clamp={peek} />
        <div className="flex items-start justify-between gap-2 px-5 pt-2 pb-2 md:pt-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{KIND_LABEL[selection.kind]}</p>
            <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl leading-tight font-semibold outline-none">
              {entityTitle(selection)}
            </h2>
          </div>
          <div className="-mr-1 flex shrink-0 items-center">
            <ShareButton title={entityTitle(selection)} />
            <button
              data-sheet-close
              onClick={() => select(null)}
              aria-label="Close details"
              className="rounded p-1.5 text-ink-muted hover:bg-paper-2 hover:text-ink"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 pb-6">
        {body}
        {hidden && (
          <button
            onClick={() => openOn(hidden)}
            className="mt-6 w-full rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent"
          >
            Open on {hidden}
          </button>
        )}
      </div>
      {peek && <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-paper" />}
    </aside>
  );
}
