import type { PointerEvent } from "react";
import { data, datesFor } from "../../data";
import { specBounds } from "../../lib/dates";
import { datasetRange } from "../../lib/entities";
import { visibleRange, type TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";

/** A slim overview of the whole timeline down the right edge. Click or drag it to jump. */
export default function Overview({ scale }: { scale: TimeScale }) {
  const chron = useStore((s) => s.chronologyId);
  const setYear = useStore((s) => s.setYear);
  const [lo, hi] = datasetRange(chron);
  const pad = 8;
  const usable = scale.height - pad * 2;
  const toPx = (y: number) => pad + ((y - lo) / (hi - lo)) * usable;
  const [vLo, vHi] = visibleRange(scale);

  const jump = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const f = (e.clientY - rect.top - pad) / usable;
    setYear(lo + Math.min(1, Math.max(0, f)) * (hi - lo));
  };

  return (
    <div
      aria-hidden
      data-no-pan
      className="absolute inset-y-0 right-0 z-[3] w-6 cursor-pointer border-l border-line bg-paper-2"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        jump(e);
      }}
      onPointerMove={(e) => e.buttons && jump(e)}
    >
      {data.eras.map((era) => {
        const spec = datesFor(era, chron);
        if (!spec) return null;
        const [a, b] = specBounds(spec);
        return (
          <div
            key={era.id}
            className="absolute inset-x-1.5 rounded-sm"
            style={{ top: toPx(a), height: toPx(b) - toPx(a), backgroundColor: era.color }}
          />
        );
      })}
      <div
        className="absolute inset-x-0.5 rounded border-2 border-ink/70"
        style={{
          top: Math.max(0, toPx(vLo)),
          height: Math.max(4, Math.min(scale.height, toPx(vHi)) - Math.max(0, toPx(vLo))),
        }}
      />
    </div>
  );
}
