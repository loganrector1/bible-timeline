import { useEffect, useRef, type PointerEvent } from "react";
import { datesFor } from "../../data";
import type { Event } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { adjacentEvent, eventOrderKey, eventsInOrder } from "../../lib/entities";
import { shownBy } from "../../lib/filters";
import { useStore } from "../../state/store";

/** Dragging the list this far steps one event. */
const STEP_PX = 28;
/** Movement under this is still a tap. */
const DRAG_START_PX = 6;

/**
 * The events nearest the current moment, in date order (as `eventsInOrder` sorts them). The list scrolls when
 * long, keeping the focus event (the one drawn on the map) in view. Collapsed, it shows just the focus event.
 *
 * Dragging the list up or down steps through events one at a time, finer than the time strip: with an
 * event selected each step selects the next, otherwise the cursor moves to it and nothing is selected.
 */
export default function NowPanel({
  events, focusId, open, setOpen, onShow,
}: {
  events: Event[];
  focusId?: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Set while the map is quiet (its popup closed): the panel says events are hidden, and this shows them again. */
  onShow?: () => void;
}) {
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id?: string; moved: boolean } | null>(null);

  const ordered = eventsInOrder(chron).filter((ev) => events.includes(ev));
  // With no focus (a person is selected), the collapsed panel still shows the nearest event, unmarked.
  const peekId = focusId ?? events[0]?.id;
  const shown = open ? ordered : ordered.filter((ev) => ev.id === peekId);
  // Events along a journey sit under it when it's listed just above them, or a nested sibling is.
  // Date order wins, so one with another event in between names its parent instead.
  const nestedAt: boolean[] = [];
  shown.forEach((ev, i) => {
    const prev = shown[i - 1];
    nestedAt.push(open && !!ev.partOf && !!prev && (prev.id === ev.partOf || (nestedAt[i - 1] && prev.partOf === ev.partOf)));
  });

  useEffect(() => {
    listRef.current?.querySelector("[data-focus]")?.scrollIntoView({ block: "nearest" });
  }, [focusId, open]);

  const step = (dir: 1 | -1) => {
    const s = useStore.getState();
    const selectedId = s.selection?.kind === "event" ? s.selection.id : undefined;
    // Step from the last event this drag reached, not the cursor, which is still on its way there.
    const target = adjacentEvent(dir, chron, s.currentYear, selectedId ?? drag.current?.id, shownBy(s.filters, chron));
    if (!target) return;
    if (drag.current) drag.current.id = target.id;
    if (selectedId) select({ kind: "event", id: target.id });
    // Jump, not glide: gliding passes other events, which would briefly become the focus.
    else s.stepTo(target.id, eventOrderKey(target, chron));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) drag.current = { y: e.clientY, id: focusId, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.abs(e.clientY - d.y) < DRAG_START_PX) return;
      d.moved = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    // Dragging up moves later, as on the timeline.
    while (e.clientY - d.y <= -STEP_PX) {
      d.y -= STEP_PX;
      step(1);
    }
    while (e.clientY - d.y >= STEP_PX) {
      d.y += STEP_PX;
      step(-1);
    }
  };
  const endDrag = () => {
    // Keep the flag until the click that ends a drag has been swallowed.
    if (drag.current?.moved) setTimeout(() => (drag.current = null));
    else drag.current = null;
  };

  // `touch-none` should stop the browser panning or scrolling the page under a drag, but not
  // every mobile browser honours it, so touch moves are cancelled here too. (React's touch
  // listeners are passive, so this has to be a native one.)
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, []);

  // The whole panel, header included, is the drag surface, so a drag that starts just off the
  // one row of a collapsed panel still steps rather than reaching the page.
  return (
    <div
      ref={panelRef}
      data-map-obstacle
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => drag.current?.moved && e.stopPropagation()}
      className={`absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] touch-none rounded-lg border border-line bg-paper/90 text-sm shadow-md backdrop-blur select-none ${open ? "w-64" : "w-56"}`}
    >
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
      >
        Nearest events
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {onShow && (
        <p className="flex items-baseline gap-1.5 px-3 pb-1.5 text-xs text-ink-muted">
          Events hidden on the map
          <span aria-hidden>·</span>
          <button onClick={onShow} className="font-medium text-accent hover:underline">
            Show
          </button>
        </p>
      )}
      {(open || shown.length > 0) && (
        <div className="px-2 pb-2">
          {shown.length === 0 ? (
            <p className="px-1 text-ink-muted">No recorded events near this moment.</p>
          ) : (
            <ul
              ref={listRef}
              className="max-h-52 overflow-y-auto overscroll-contain"
            >
              {shown.map((ev, i) => {
                const selected = selection?.kind === "event" && selection.id === ev.id;
                const isFocus = ev.id === focusId;
                const spec = datesFor(ev, chron);
                const parent = open && ev.partOf ? ordered.find((p) => p.id === ev.partOf) : undefined;
                const nested = nestedAt[i];
                return (
                  <li key={ev.id} data-focus={isFocus || undefined}>
                    <button
                      onClick={() => select({ kind: "event", id: ev.id })}
                      aria-pressed={selected}
                      className={`flex w-full items-baseline gap-2 rounded py-0.5 pr-1 text-left ${nested ? "pl-4" : "pl-1"} ${
                        selected ? "bg-accent text-paper" : isFocus ? "bg-accent-soft" : "hover:bg-paper-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{ev.title}</span>
                        {parent && !nested && (
                          <span className={`block truncate text-[11px] ${selected ? "text-paper/80" : "text-ink-muted"}`}>
                            in {parent.title}
                          </span>
                        )}
                      </span>
                      {spec && (
                        <span className={`shrink-0 text-[11px] tabular-nums ${selected ? "text-paper/80" : "text-ink-muted"}`}>
                          {formatDateSpec(spec, eraStyle, { yearsOnly: true }).replace(/^c\. /, "")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
