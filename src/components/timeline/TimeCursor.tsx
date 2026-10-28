import { formatTimePoint, fromFractional } from "../../lib/dates";
import { cursorPrecision, type TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";

/** The "current moment" line, fixed at the vertical center of the timeline. */
export default function TimeCursor({ scale }: { scale: TimeScale }) {
  const eraStyle = useStore((s) => s.eraStyle);
  const label = formatTimePoint(
    fromFractional(scale.currentYear, cursorPrecision(scale.pxPerYear)),
    eraStyle,
  );

  return (
    <div className="pointer-events-none absolute inset-x-0 z-[2]" style={{ top: scale.height / 2 }}>
      <div className="h-0.5 bg-accent/80" />
      <div className="absolute left-1 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-paper shadow">
        {label}
      </div>
    </div>
  );
}
