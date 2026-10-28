import { useEffect, useRef } from "react";
import { datesFor } from "../../data";
import type { Event } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { eventsInOrder } from "../../lib/entities";
import { useStore } from "../../state/store";

/**
 * The events nearest the current moment, in date order (as `eventsInOrder` sorts them). The list scrolls when
 * long, keeping the focus event (the one drawn on the map) in view.
 */
export default function NowPanel({
  events, focusId, open, setOpen,
}: { events: Event[]; focusId?: string; open: boolean; setOpen: (open: boolean) => void }) {
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const listRef = useRef<HTMLUListElement>(null);

  const ordered = eventsInOrder(chron).filter((ev) => events.includes(ev));

  useEffect(() => {
    listRef.current?.querySelector("[data-focus]")?.scrollIntoView({ block: "nearest" });
  }, [focusId, open]);

  return (
    <div data-map-obstacle className={`absolute top-3 left-3 z-10 max-w-[calc(100%-5rem)] rounded-lg border border-line bg-paper/90 text-sm shadow-md backdrop-blur ${open ? "w-64" : ""}`}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
      >
        Nearest events
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="px-2 pb-2">
          {ordered.length === 0 ? (
            <p className="px-1 text-ink-muted">No recorded events near this moment.</p>
          ) : (
            <ul ref={listRef} className="max-h-52 overflow-y-auto overscroll-contain">
              {ordered.map((ev) => {
                const selected = selection?.kind === "event" && selection.id === ev.id;
                const isFocus = ev.id === focusId;
                const spec = datesFor(ev, chron);
                return (
                  <li key={ev.id} data-focus={isFocus || undefined}>
                    <button
                      onClick={() => select({ kind: "event", id: ev.id })}
                      aria-pressed={selected}
                      className={`flex w-full items-baseline gap-2 rounded px-1 py-0.5 text-left ${
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
