import type { CSSProperties } from "react";
import { datesFor } from "../data";
import { formatDateSpec } from "../lib/dates";
import { eraAt } from "../lib/entities";
import { useStore } from "../state/store";

/**
 * The name and dates of the era at a moment, for the overview bars: shown while hovering
 * them with a mouse, and while dragging them by any pointer, so a scrub says where it is.
 */
export default function EraTip({ year, style }: { year: number; style: CSSProperties }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const era = eraAt(year, chron);
  const spec = era && datesFor(era, chron);
  if (!era) return null;
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-line bg-paper px-2.5 py-1.5 text-left whitespace-nowrap shadow-lg"
      style={style}
    >
      <div className="flex items-center gap-1.5 text-sm leading-tight font-semibold">
        <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: era.color }} />
        {era.name}
      </div>
      {spec && <div className="text-xs text-ink-muted">{formatDateSpec(spec, eraStyle)}</div>}
    </div>
  );
}
