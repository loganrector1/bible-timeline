import { ticks, yearToPx, type TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";

/** Tick labels down the left edge, with faint gridlines across the timeline. */
export default function Axis({ scale }: { scale: TimeScale }) {
  const eraStyle = useStore((s) => s.eraStyle);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {ticks(scale, eraStyle).map((t) => {
        const y = yearToPx(scale, t.year);
        return (
          <div key={t.year} className="absolute inset-x-0" style={{ top: y }}>
            <div className={`h-px ${t.major ? "bg-ink/20" : "bg-ink/8"}`} />
            <span
              className={`absolute left-2 -translate-y-1/2 bg-paper/70 px-0.5 text-[11px] tabular-nums ${
                t.major ? "font-semibold text-ink" : "text-ink-muted"
              }`}
            >
              {t.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
