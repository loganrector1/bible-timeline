import { useMemo } from "react";
import { data, datesFor } from "../../data";
import { formatDateSpec, specExtent } from "../../lib/dates";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { hoverProps, type OnHover } from "./hover";
import { packIntervals } from "./pack";

const COLUMN = 15;
const BAR = 12;

/**
 * The great powers around Israel as square-ended bars, at the left of the World history lane:
 * Egypt's line in one column, Mesopotamia's in the next, Rome's in the next (`column`), the
 * rest wherever there's room. Their rulers' reigns stand beside them (PeopleLane).
 */
export default function EmpireBars({ scale, onHover }: { scale: TimeScale; onHover: OnHover }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  const bars = useMemo(() => {
    const items = data.empires.flatMap((empire) => {
      const spec = datesFor(empire, chron);
      return spec ? [{ empire, spec, bounds: specExtent(spec) }] : [];
    });
    const columns = packIntervals(items.map((i) => i.bounds), items.map((i) => i.empire.column));
    return items.map((item, i) => ({ ...item, column: columns[i] }));
  }, [chron]);

  const width = (Math.max(0, ...bars.map((b) => b.column)) + 1) * COLUMN + 4;

  return (
    <div className="relative shrink-0" style={{ width }}>
      {bars.map(({ empire, spec, bounds, column }) => {
        const top = yearToPx(scale, bounds[0]);
        const bottom = yearToPx(scale, bounds[1]);
        if (bottom < 0 || top > scale.height) return null;
        const height = bottom - top;
        const selected = selection?.kind === "empire" && selection.id === empire.id;
        // With a ruler selected, their empire stays lit.
        const lit = !highlight || selected || data.people.some((p) => p.empire === empire.id && highlight.people.has(p.id));
        const labelOffset = Math.max(0, Math.min(-top, height - 120)) + 6;
        return (
          <button
            key={empire.id}
            onClick={() => select({ kind: "empire", id: empire.id })}
            {...hoverProps({ kind: "empire", id: empire.id }, onHover)}
            aria-label={`${empire.name}, ${formatDateSpec(spec, eraStyle)}`}
            aria-pressed={selected}
            className={`absolute overflow-hidden rounded-[3px] border transition-opacity ${
              selected ? "border-accent bg-accent text-paper" : "border-stone-500/50 bg-stone-500/25 text-ink hover:border-accent"
            } ${lit ? "" : "opacity-35"}`}
            style={{
              left: column * COLUMN + 4,
              width: BAR,
              top,
              height: Math.max(height, 6),
              maskImage: "linear-gradient(transparent, black 10px, black calc(100% - 10px), transparent)",
            }}
          >
            {height > 60 && (
              <span
                className="absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-medium whitespace-nowrap italic [writing-mode:vertical-rl]"
                style={{ top: labelOffset }}
              >
                {empire.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
