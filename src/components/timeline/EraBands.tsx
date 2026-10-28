import { data, datesFor } from "../../data";
import { specBounds } from "../../lib/dates";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { hoverProps, type OnHover } from "./hover";

/**
 * Eras as colored background bands. Each also has a strip in a narrow column on the
 * right that can be hovered or clicked; its vertical name shows only when the strip
 * is tall enough to hold it.
 */
export default function EraBands({ scale, onHover }: { scale: TimeScale; onHover: OnHover }) {
  const chron = useStore((s) => s.chronologyId);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  return (
    <>
      {data.eras.map((era) => {
        const spec = datesFor(era, chron);
        if (!spec) return null;
        const [lo, hi] = specBounds(spec);
        const top = yearToPx(scale, lo);
        const bottom = yearToPx(scale, hi);
        if (bottom < 0 || top > scale.height) return null;
        const selected = highlight?.eraId === era.id;

        // The visible part of the strip, and where the name fits inside it.
        const stripTop = Math.max(top, 0);
        const stripBottom = Math.min(bottom, scale.height);
        const labelLength = era.name.length * 7 + 12;
        const fits = stripBottom - stripTop >= labelLength + 8;

        return (
          <div key={era.id}>
            <div
              aria-hidden
              className="absolute inset-x-0 border-t"
              style={{
                top,
                height: bottom - top,
                borderColor: era.color + "66",
                backgroundColor: era.color + (selected ? "33" : "17"),
              }}
            />
            <button
              onClick={() => select({ kind: "era", id: era.id })}
              aria-label={`Era: ${era.name}`}
              {...hoverProps({ kind: "era", id: era.id }, onHover)}
              className="group absolute right-7 z-[1] w-4 overflow-hidden"
              style={{ top: stripTop, height: Math.max(2, stripBottom - stripTop) }}
            >
              <span
                aria-hidden
                className="absolute inset-y-0.5 right-0 w-0.5 rounded-full opacity-60 group-hover:opacity-100"
                style={{ backgroundColor: era.color }}
              />
              {fits && (
                <span
                  className="absolute top-2 left-0 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase [writing-mode:vertical-rl]"
                  style={{ color: era.color }}
                >
                  {era.name}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </>
  );
}
