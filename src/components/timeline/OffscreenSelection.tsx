import { eventBounds, entityBounds, entityTitle, eventsAtLocation, type Bounds } from "../../lib/entities";
import { visibleRange, type TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";

/**
 * When the selection is out of view, a chip at the top or bottom edge points toward it;
 * clicking it centers and fits the selection. Hidden while any of it is on screen.
 */
export default function OffscreenSelection({ scale, left }: { scale: TimeScale; left: number }) {
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  const showOnTimeline = useStore((s) => s.showOnTimeline);
  if (!selection) return null;

  // A place has no span of its own; it's on screen if any of its events is.
  const spans: Bounds[] = selection.kind === "location"
    ? eventsAtLocation(selection.id, chron).map((ev) => eventBounds(ev, chron)!)
    : [entityBounds(selection, chron)].filter((b): b is Bounds => b !== undefined);
  if (spans.length === 0) return null;

  const [lo, hi] = visibleRange(scale);
  if (spans.some(([a, b]) => b >= lo && a <= hi)) return null;

  // Earlier is up. Point toward the nearest span.
  const gap = ([a, b]: Bounds) => Math.min(Math.abs(a - scale.currentYear), Math.abs(b - scale.currentYear));
  const nearest = spans.reduce((best, s) => (gap(s) < gap(best) ? s : best));
  const up = nearest[1] < lo;
  const title = entityTitle(selection);

  return (
    <button
      data-no-pan
      onClick={() => showOnTimeline(selection)}
      aria-label={`Show ${title} on the timeline`}
      className="absolute z-10 flex animate-appear-late items-center gap-1.5 rounded-full border border-accent bg-paper px-3 py-1 text-sm shadow-md hover:bg-accent-soft"
      // At the bottom it sits above the toolbar; on the right is the overview column.
      style={{ left, maxWidth: `calc(100% - ${left + 56}px)`, ...(up ? { top: 12 } : { bottom: 52 }) }}
    >
      <span aria-hidden className="text-accent">{up ? "↑" : "↓"}</span>
      <span className="truncate">Show {title}</span>
    </button>
  );
}
