import type { Event } from "../../data/schema";
import { useStore } from "../../state/store";

/** A short, collapsible list of what's happening around the current moment, overlaid on the map. */
export default function NowPanel({
  events, open, setOpen,
}: { events: Event[]; open: boolean; setOpen: (open: boolean) => void }) {
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);

  return (
    <div className="absolute top-3 left-3 z-10 w-56 max-w-[calc(100%-5rem)] rounded-lg border border-line bg-paper/90 text-sm shadow-md backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase"
      >
        Happening now{!open && events.length > 0 ? ` (${events.length})` : ""}
        <span aria-hidden>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="px-2 pb-2">
          {events.length === 0 ? (
            <p className="px-1 text-ink-muted">No recorded events near this moment.</p>
          ) : (
            <ul>
              {events.slice(0, 5).map((ev) => {
                const selected = selection?.kind === "event" && selection.id === ev.id;
                return (
                  <li key={ev.id}>
                    <button
                      onClick={() => select({ kind: "event", id: ev.id })}
                      aria-pressed={selected}
                      className={`w-full truncate rounded px-1 py-0.5 text-left ${selected ? "bg-accent text-paper" : "hover:bg-paper-2"}`}
                    >
                      {ev.title}
                    </button>
                  </li>
                );
              })}
              {events.length > 5 && <li className="px-1 text-xs text-ink-muted">+{events.length - 5} more</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
