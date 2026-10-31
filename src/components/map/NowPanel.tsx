import { useEffect, useRef, type PointerEvent } from "react";
import { datesFor } from "../../data";
import type { Event } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { adjacentEvent, eventOrderKey, eventsInOrder } from "../../lib/entities";
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
  events, focusId, open, setOpen,
}: { events: Event[]; focusId?: string; open: boolean; setOpen: (open: boolean) => void }) {
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const listRef = useRef<HTMLUListElement>(null);
  const drag = useRef<{ y: number; id?: string; moved: boolean } | null>(null);

  const ordered = eventsInOrder(chron).filter((ev) => events.includes(ev));
  const shown = open ? ordered : ordered.filter((ev) => ev.id === focusId);

  useEffect(() => {
    listRef.current?.querySelector("[data-focus]")?.scrollIntoView({ block: "nearest" });
  }, [focusId, open]);

  const step = (dir: 1 | -1) => {
    const s = useStore.getState();
    const selectedId = s.selection?.kind === "event" ? s.selection.id : undefined;
    // Step from the last event this drag reached, not the cursor, which is still on its way there.
    const target = adjacentEvent(dir, chron, s.currentYear, selectedId ?? drag.current?.id);
    if (!target) return;
    if (drag.current) drag.current.id = target.id;
    if (selectedId) select({ kind: "event", id: target.id });
    else s.goTo(eventOrderKey(target, chron));
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) drag.current = { y: e.clientY, id: focusId, moved: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLUListElement>) => {
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

  return (
    <div data-map-obstacle className={`absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] rounded-lg border border-line bg-paper/90 text-sm shadow-md backdrop-blur ${open ? "w-64" : "w-56"}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
      >
        Nearest events
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {(open || shown.length > 0) && (
        <div className="px-2 pb-2">
          {shown.length === 0 ? (
            <p className="px-1 text-ink-muted">No recorded events near this moment.</p>
          ) : (
            <ul
              ref={listRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClickCapture={(e) => drag.current?.moved && e.stopPropagation()}
              className="max-h-52 touch-none overflow-y-auto overscroll-contain select-none"
            >
              {shown.map((ev) => {
                const selected = selection?.kind === "event" && selection.id === ev.id;
                const isFocus = ev.id === focusId;
                const spec = datesFor(ev, chron);
                // Events along a journey sit under it when it's listed too.
                const nested = open && ev.partOf !== undefined && ordered.some((p) => p.id === ev.partOf);
                return (
                  <li key={ev.id} data-focus={isFocus || undefined}>
                    <button
                      onClick={() => select({ kind: "event", id: ev.id })}
                      aria-pressed={selected}
                      className={`flex w-full items-baseline gap-2 rounded py-0.5 pr-1 text-left ${nested ? "pl-4" : "pl-1"} ${
                        selected ? "bg-accent text-paper" : isFocus ? "bg-accent-soft" : "hover:bg-paper-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate">{ev.title}</span>
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
