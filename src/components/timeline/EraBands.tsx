import { data, datesFor } from "../../data";
import { specBounds } from "../../lib/dates";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";

/** Eras as colored background bands, each with a label that stays in view while its band is on screen. */
export default function EraBands({ scale }: { scale: TimeScale }) {
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
        // Vertical label in its own column; keep it inside the band while the band is on screen.
        const labelLength = era.name.length * 7 + 16;
        const labelTop = Math.min(Math.max(top, 0) + 8, bottom - labelLength);
        const selected = highlight?.eraId === era.id;

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
              className="absolute right-7 z-[1] rounded px-0.5 py-1.5 text-[11px] font-semibold tracking-wider whitespace-nowrap uppercase [writing-mode:vertical-rl] hover:bg-paper/80"
              style={{ top: labelTop, color: era.color }}
            >
              {era.name}
            </button>
          </div>
        );
      })}
    </>
  );
}
