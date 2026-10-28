import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { datasetRange } from "../../lib/entities";
import type { TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";
import Axis from "./Axis";
import EraBands from "./EraBands";
import EventLane from "./EventLane";
import { HoverCard, type TimelineHover } from "./hover";
import Overview from "./Overview";
import PeopleLane from "./PeopleLane";
import TimeCursor from "./TimeCursor";
import { useTimelineGestures, zoomBy } from "./useTimelineGestures";

export const AXIS_WIDTH = 76;

export default function Timeline() {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  const [showPeople, setShowPeople] = useState(true);
  const currentYear = useStore((s) => s.currentYear);
  const pxPerYear = useStore((s) => s.pxPerYear);
  const setViewportPx = useStore((s) => s.setViewportPx);
  const [hover, setHover] = useState<TimelineHover | null>(null);

  useTimelineGestures(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const h = entry.contentRect.height;
      setHeight(h);
      setViewportPx(h);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [setViewportPx]);

  const scale: TimeScale = { currentYear, pxPerYear, height };

  const onKeyDown = (e: KeyboardEvent) => {
    const s = useStore.getState();
    const move = (px: number) => s.setYear(s.currentYear + px / s.pxPerYear);
    const [lo, hi] = datasetRange(s.chronologyId);
    const actions: Record<string, () => void> = {
      ArrowDown: () => move(40),
      ArrowUp: () => move(-40),
      PageDown: () => move(height * 0.8),
      PageUp: () => move(-height * 0.8),
      Home: () => s.goTo(lo),
      End: () => s.goTo(hi),
      "+": () => zoomBy(1.25),
      "=": () => zoomBy(1.25),
      "-": () => zoomBy(0.8),
    };
    // Let keys reach the buttons inside the timeline, except for moving through time.
    if (e.target !== e.currentTarget && !e.key.startsWith("Arrow") && !e.key.startsWith("Page")) return;
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  return (
    <div
      ref={ref}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => setHover(null)}
      onWheel={() => setHover(null)}
      aria-label="Timeline. Arrow keys and Page Up/Down move through time; plus and minus zoom."
      className="relative h-full touch-none overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
    >
      <EraBands scale={scale} onHover={setHover} />
      <Axis scale={scale} />
      <div className="absolute inset-y-0 right-12 flex" style={{ left: AXIS_WIDTH }}>
        {showPeople && <PeopleLane scale={scale} onHover={setHover} />}
        <EventLane scale={scale} onHover={setHover} />
      </div>
      <TimeCursor scale={scale} />
      <Overview scale={scale} />
      {hover && ref.current && <HoverCard hover={hover} container={ref.current} />}

      <div data-no-pan className="absolute right-12 bottom-3 z-10 flex gap-1 text-sm">
        <button
          onClick={() => setShowPeople(!showPeople)}
          aria-pressed={showPeople}
          className={`rounded-md border border-line px-2 py-1 shadow-sm ${showPeople ? "bg-ink text-paper" : "bg-paper text-ink-muted"}`}
        >
          People
        </button>
        <button onClick={() => zoomBy(0.6)} aria-label="Zoom out" className="w-8 rounded-md border border-line bg-paper py-1 shadow-sm hover:bg-paper-2">−</button>
        <button onClick={() => zoomBy(1 / 0.6)} aria-label="Zoom in" className="w-8 rounded-md border border-line bg-paper py-1 shadow-sm hover:bg-paper-2">+</button>
      </div>
    </div>
  );
}
