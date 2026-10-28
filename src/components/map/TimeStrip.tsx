import { useEffect, type PointerEvent } from "react";
import { data, datesFor } from "../../data";
import { formatTimePoint, fromFractional, specBounds } from "../../lib/dates";
import { datasetRange, eventMidpoint, eventsInOrder } from "../../lib/entities";
import { cursorPrecision } from "../../lib/timeScale";
import { useStore } from "../../state/store";

const SPEEDS = [1, 4, 16];
/** At 1×, play moves the cursor this many timeline pixels per second, so speed follows the zoom. */
const PX_PER_SECOND = 40;

/** A compact timeline under the map: eras, the cursor, play/pause and step by event. */
export default function TimeStrip({ speed, setSpeed }: { speed: number; setSpeed: (s: number) => void }) {
  const chron = useStore((s) => s.chronologyId);
  const currentYear = useStore((s) => s.currentYear);
  const pxPerYear = useStore((s) => s.pxPerYear);
  const eraStyle = useStore((s) => s.eraStyle);
  const playing = useStore((s) => s.playing);
  const setPlaying = useStore((s) => s.setPlaying);
  const setYear = useStore((s) => s.setYear);
  const select = useStore((s) => s.select);
  const [lo, hi] = datasetRange(chron);
  const frac = (y: number) => ((y - lo) / (hi - lo)) * 100;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      const s = useStore.getState();
      const next = s.currentYear + ((now - last) / 1000) * (PX_PER_SECOND / s.pxPerYear) * speed;
      last = now;
      s.setYear(next);
      if (next >= hi) s.setPlaying(false);
      else frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, hi]);

  const stepEvent = (dir: 1 | -1) => {
    const events = eventsInOrder(chron);
    const eps = 1e-6;
    const target = dir === 1
      ? events.find((ev) => eventMidpoint(ev, chron)! > currentYear + eps)
      : events.findLast((ev) => eventMidpoint(ev, chron)! < currentYear - eps);
    if (target) select({ kind: "event", id: target.id });
  };

  const scrub = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setYear(lo + f * (hi - lo));
  };

  const label = formatTimePoint(fromFractional(currentYear, cursorPrecision(pxPerYear)), eraStyle);
  const btn = "flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-paper hover:bg-paper-2";

  return (
    <div className="flex items-center gap-2 border-t border-line bg-paper-2 px-3 py-2 text-sm">
      <button onClick={() => stepEvent(-1)} aria-label="Previous event" className={btn}>⏮</button>
      <button onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Play"} className={`${btn} ${playing ? "bg-accent text-paper hover:bg-accent" : ""}`}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button onClick={() => stepEvent(1)} aria-label="Next event" className={btn}>⏭</button>
      <button
        onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
        aria-label={`Playback speed ${speed}×`}
        className={`${btn} w-10 text-xs font-semibold tabular-nums`}
      >
        {speed}×
      </button>

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
        className="relative mx-1 h-7 min-w-0 flex-1 cursor-pointer touch-none"
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

      <span className="hidden w-32 shrink-0 text-right text-xs font-semibold tabular-nums sm:block">{label}</span>
    </div>
  );
}
