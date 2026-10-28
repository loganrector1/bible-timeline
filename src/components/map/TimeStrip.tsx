import { useEffect, useState, type PointerEvent } from "react";
import { data, datesFor } from "../../data";
import { formatWindow } from "../../lib/activeEvents";
import { formatTimePoint, fromFractional, specBounds } from "../../lib/dates";
import { adjacentEvent, datasetRange } from "../../lib/entities";
import { JOURNEY_DELAY_MS, journeyDuration } from "../../lib/journeys";
import { cursorPrecision } from "../../lib/timeScale";
import { useStore } from "../../state/store";
import { zoomBy } from "../timeline/useTimelineGestures";

const SPEEDS = [1, 2, 4];
/** At 1×, how long play rests on each event before moving to the next. */
const DWELL_MS = 3000;

/** Under the map: eras and the cursor, play/step through events, and the time window ("now" = ± this much). */
export default function TimeStrip() {
  const chron = useStore((s) => s.chronologyId);
  const currentYear = useStore((s) => s.currentYear);
  const pxPerYear = useStore((s) => s.pxPerYear);
  const eraStyle = useStore((s) => s.eraStyle);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const setYear = useStore((s) => s.setYear);
  const [speed, setSpeed] = useState(1);
  const [lo, hi] = datasetRange(chron);
  const frac = (y: number) => ((y - lo) / (hi - lo)) * 100;

  const step = (dir: 1 | -1, keepPlaying = false) => {
    const s = useStore.getState();
    const selectedId = s.selection?.kind === "event" ? s.selection.id : undefined;
    const target = adjacentEvent(dir, chron, s.currentYear, selectedId);
    if (target) s.select({ kind: "event", id: target.id }, { keepPlaying });
    return target;
  };

  // Play visits events one by one, resting on each (longer while a journey draws).
  useEffect(() => {
    if (!playing) return;
    let timer = 0;
    const next = () => {
      const ev = step(1, true);
      if (!ev) {
        setPlaying(false);
        return;
      }
      const journey = ev.journeyId ? JOURNEY_DELAY_MS + journeyDuration(ev.journeyId) : 0;
      timer = window.setTimeout(next, DWELL_MS / speed + journey);
    };
    next();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setYear(lo + f * (hi - lo));
  };

  const label = formatTimePoint(fromFractional(currentYear, cursorPrecision(pxPerYear)), eraStyle);
  const btn = "flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper hover:bg-paper-2";

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line bg-paper-2 px-3 py-2 text-sm">
      <div className="flex items-center gap-1.5">
        <button onClick={() => step(-1)} aria-label="Previous event" className={btn}>⏮</button>
        <button
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Play through events"}
          className={`${btn} ${playing ? "bg-accent text-paper hover:bg-accent" : ""}`}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button onClick={() => step(1)} aria-label="Next event" className={btn}>⏭</button>
        <button
          onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
          aria-label={`Playback speed ${speed}×`}
          className={`${btn} w-10 text-xs font-semibold tabular-nums`}
        >
          {speed}×
        </button>
      </div>

      <div
        role="slider"
        aria-label="Time"
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuenow={currentYear}
        aria-valuetext={label}
        tabIndex={0}
        onKeyDown={(e) => {
          const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
          if (delta) setYear(currentYear + (delta * 20) / pxPerYear);
        }}
        className="relative mx-1 h-7 min-w-32 flex-1 cursor-pointer touch-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          scrub(e);
        }}
        onPointerMove={(e) => e.buttons && scrub(e)}
      >
        {data.eras.map((era) => {
          const spec = datesFor(era, chron);
          if (!spec) return null;
          const [a, b] = specBounds(spec);
          return (
            <div
              key={era.id}
              title={era.name}
              className="absolute top-2.5 h-2 rounded-sm"
              style={{ left: `${frac(a)}%`, width: `${frac(b) - frac(a)}%`, backgroundColor: era.color }}
            />
          );
        })}
        <div className="absolute top-0 h-7 w-0.5 -translate-x-1/2 rounded bg-accent" style={{ left: `${frac(currentYear)}%` }} />
      </div>

      <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums">{label}</span>

      {/* Time zoom, which also sets how far from the cursor counts as "now" on the map. */}
      <div className="flex shrink-0 items-center gap-1" title="How far from the current moment counts as “now”">
        <button onClick={() => zoomBy(0.6)} aria-label="Widen time window" className={`${btn} size-7`}>−</button>
        <span className="w-20 text-center text-xs text-ink-muted tabular-nums">{formatWindow(pxPerYear)}</span>
        <button onClick={() => zoomBy(1 / 0.6)} aria-label="Narrow time window" className={`${btn} size-7`}>+</button>
      </div>
    </div>
  );
}
