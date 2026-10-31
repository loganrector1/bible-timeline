import { useRef, useState, type PointerEvent } from "react";
import { data, datesFor } from "../../data";
import { specBounds } from "../../lib/dates";
import { datasetRange } from "../../lib/entities";
import { visibleRange, type TimeScale } from "../../lib/timeScale";
import { useStore } from "../../state/store";
import EraTip from "../EraTip";

const PAD = 8;
const MIN_BOX_PX = 10;

type Drag =
  | { mode: "move"; grabOffset: number } // pointer's distance from the box center, in px
  | { mode: "resize"; edge: "top" | "bottom" };

/**
 * A slim overview of the whole timeline down the right edge, with a box showing the
 * visible range. Drag the box to scroll (it stays where you grabbed it), click outside
 * it to jump there, or drag its top/bottom handles to zoom. Hovering or dragging names the
 * era under the pointer.
 */
export default function Overview({ scale }: { scale: TimeScale }) {
  const chron = useStore((s) => s.chronologyId);
  const setYear = useStore((s) => s.setYear);
  const setZoom = useStore((s) => s.setZoom);
  const drag = useRef<Drag | null>(null);
  const [tipY, setTipY] = useState<number | null>(null);
  const [lo, hi] = datasetRange(chron);
  const usable = scale.height - PAD * 2;
  const toPx = (y: number) => PAD + ((y - lo) / (hi - lo)) * usable;
  const toYear = (px: number) => lo + ((px - PAD) / usable) * (hi - lo);

  const [vLo, vHi] = visibleRange(scale);
  const boxTop = toPx(vLo);
  const boxHeight = Math.max(MIN_BOX_PX, toPx(vHi) - boxTop);
  const center = toPx(scale.currentYear);

  const localY = (e: PointerEvent) => e.clientY - e.currentTarget.getBoundingClientRect().top;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const y = localY(e);
    const edge = (e.target as HTMLElement).dataset.edge as "top" | "bottom" | undefined;
    if (edge) {
      drag.current = { mode: "resize", edge };
      return;
    }
    const insideBox = y >= center - boxHeight / 2 && y <= center + boxHeight / 2;
    if (!insideBox) setYear(toYear(y)); // Jump, then keep dragging from the box's center.
    drag.current = { mode: "move", grabOffset: insideBox ? y - center : 0 };
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const y = localY(e);
    setTipY(y);
    const d = drag.current;
    if (!d || !e.buttons) return;
    if (d.mode === "move") {
      setYear(toYear(y - d.grabOffset));
    } else {
      // The cursor stays centered, so the box grows or shrinks symmetrically.
      const half = Math.max(MIN_BOX_PX / 2, d.edge === "bottom" ? y - center : center - y);
      const visibleYears = ((half * 2) / usable) * (hi - lo);
      setZoom(scale.height / visibleYears);
    }
  };

  const handle = "absolute inset-x-0 h-2.5 cursor-ns-resize";

  return (
    <div
      aria-hidden
      data-no-pan
      className="absolute inset-y-0 right-0 z-[3] w-6 cursor-pointer touch-none border-l border-line bg-paper-2"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        drag.current = null;
        if (e.pointerType === "touch") setTipY(null);
      }}
      onPointerLeave={() => !drag.current && setTipY(null)}
    >
      {data.eras.map((era) => {
        const spec = datesFor(era, chron);
        if (!spec) return null;
        const [a, b] = specBounds(spec);
        return (
          <div
            key={era.id}
            className="pointer-events-none absolute inset-x-1.5 rounded-sm"
            style={{ top: toPx(a), height: toPx(b) - toPx(a), backgroundColor: era.color }}
          />
        );
      })}
      <div
        className="group absolute inset-x-0.5 cursor-grab rounded border-2 border-ink/70 active:cursor-grabbing"
        style={{ top: center - boxHeight / 2, height: boxHeight }}
      >
        <div data-edge="top" className={`${handle} -top-1.5`}>
          <div className="pointer-events-none mx-auto mt-1 h-1 w-3 rounded-full bg-ink/70 opacity-0 group-hover:opacity-100" />
        </div>
        <div data-edge="bottom" className={`${handle} -bottom-1.5`}>
          <div className="pointer-events-none mx-auto mt-0.5 h-1 w-3 rounded-full bg-ink/70 opacity-0 group-hover:opacity-100" />
        </div>
      </div>
      {tipY !== null && (
        <EraTip year={toYear(tipY)} style={{ right: "calc(100% + 6px)", top: Math.min(Math.max(tipY, 24), scale.height - 24), transform: "translateY(-50%)" }} />
      )}
    </div>
  );
}
