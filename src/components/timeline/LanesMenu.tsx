import { useEffect, useRef, useState } from "react";
import { Lane } from "../../data/schema";
import { useStore } from "../../state/store";
import { LANE_NAMES } from "./PeopleLane";

const LANES: Lane[] = Lane.options;

/** The "People" button: a small menu of the people lanes to show. */
export default function LanesMenu() {
  const lanes = useStore((s) => s.lanes);
  const setLaneShown = useStore((s) => s.setLaneShown);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on a press outside the menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    return () => window.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`rounded-md border border-line px-2 py-1 shadow-sm ${lanes.length ? "bg-ink text-paper" : "bg-paper text-ink-muted"}`}
      >
        People {lanes.length > 1 && <span className="text-xs opacity-75">{lanes.length}</span>} <span aria-hidden className="text-xs">▴</span>
      </button>
      {open && (
        <div className="absolute right-0 bottom-full z-20 mb-1.5 w-48 rounded-lg border border-line bg-paper p-1.5 shadow-lg">
          <p className="px-1.5 pt-0.5 pb-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Lanes</p>
          {LANES.map((lane) => (
            <label key={lane} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-paper-2">
              <input
                type="checkbox"
                checked={lanes.includes(lane)}
                onChange={(e) => setLaneShown(lane, e.target.checked)}
                className="accent-accent"
              />
              {LANE_NAMES[lane]}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
