import { useEffect, useRef } from "react";
import { erasById, eventsById, locationsById, peopleById } from "../data";
import { entityTitle } from "../lib/entities";
import { useStore } from "../state/store";
import EraDetail from "./detail/EraDetail";
import EventDetail from "./detail/EventDetail";
import LocationDetail from "./detail/LocationDetail";
import PersonDetail from "./detail/PersonDetail";

const KIND_LABEL = { event: "Event", person: "Person", location: "Place", era: "Era" } as const;

/** Side panel (desktop) or bottom sheet (phone) describing the selected entity. */
export default function DetailPanel() {
  const selection = useStore((s) => s.selection);
  const selectionNonce = useStore((s) => s.selectionNonce);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const select = useStore((s) => s.select);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);

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
    }
  })();

  // Re-selecting replays the map animation and re-centers the timeline.
  const showOn = (view: "map" | "timeline") => {
    if (mode !== "split" && mode !== view) setMode(view);
    select(selection);
  };

  const btn = "flex-1 rounded-md border border-line px-3 py-1.5 text-sm hover:border-accent hover:text-accent";

  return (
    <aside
      ref={scrollRef}
      aria-label="Details"
      className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto rounded-t-2xl border-t border-line bg-paper shadow-[0_-8px_30px_rgb(0_0_0/0.15)] md:static md:max-h-none md:w-96 md:shrink-0 md:rounded-none md:border-t-0 md:border-l md:shadow-none"
    >
      <div className="sticky top-0 z-[1] flex items-start justify-between gap-2 bg-paper/95 px-5 pt-4 pb-2 backdrop-blur">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{KIND_LABEL[selection.kind]}</p>
          <h2 ref={headingRef} tabIndex={-1} className="font-serif text-2xl leading-tight font-semibold outline-none">
            {entityTitle(selection)}
          </h2>
        </div>
        <button
          onClick={() => select(null)}
          aria-label="Close details"
          className="-mr-1 rounded p-1.5 text-ink-muted hover:bg-paper-2 hover:text-ink"
        >
          ✕
        </button>
      </div>

      <div className="px-5 pb-6">
        {body}
        <div className="mt-6 flex gap-2">
          <button onClick={() => showOn("timeline")} className={btn}>Show on timeline</button>
          <button onClick={() => showOn("map")} className={btn}>Show on map</button>
        </div>
      </div>
    </aside>
  );
}
