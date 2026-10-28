import { useMemo } from "react";
import { data, datesFor } from "../../data";
import { formatDateSpec, specBounds } from "../../lib/dates";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { packIntervals } from "./pack";

const COLUMN = 18;
const BAR = 14;

/** Lifespans as vertical bars, packed into columns so overlapping lives sit side by side. */
export default function PeopleLane({ scale }: { scale: TimeScale }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  const lives = useMemo(() => {
    const items = data.people.flatMap((person) => {
      const spec = datesFor(person, chron);
      return spec ? [{ person, spec, bounds: specBounds(spec) }] : [];
    });
    const columns = packIntervals(items.map((i) => i.bounds));
    return items.map((item, i) => ({ ...item, column: columns[i] }));
  }, [chron]);

  const width = (Math.max(0, ...lives.map((l) => l.column)) + 1) * COLUMN + 8;

  return (
    <div className="relative shrink-0 border-r border-line/60" style={{ width }}>
      {lives.map(({ person, spec, bounds, column }) => {
        const top = yearToPx(scale, bounds[0]);
        const bottom = yearToPx(scale, bounds[1]);
        if (bottom < 0 || top > scale.height) return null;
        const height = bottom - top;
        const selected = selection?.kind === "person" && selection.id === person.id;
        const lit = !highlight || highlight.people.has(person.id);
        // Keep the name in view while any part of the bar is on screen.
        const labelOffset = Math.max(0, Math.min(-top, height - 80)) + 6;
        const dateText = formatDateSpec(spec, eraStyle);

        return (
          <button
            key={person.id}
            onClick={() => select({ kind: "person", id: person.id })}
            title={`${person.name} · ${dateText}`}
            aria-label={`${person.name}, ${dateText}`}
            aria-pressed={selected}
            className={`absolute overflow-hidden rounded-full border transition-opacity ${
              selected ? "border-accent bg-accent text-paper"
              : lit && highlight ? "border-accent bg-accent-soft text-ink"
              : "border-ink/25 bg-ink/10 text-ink hover:border-accent"
            } ${lit ? "" : "opacity-35"}`}
            style={{
              left: column * COLUMN + 4,
              width: BAR,
              top,
              height: Math.max(height, 6),
              maskImage: spec.confidence !== "exact"
                ? "linear-gradient(transparent, black 10px, black calc(100% - 10px), transparent)"
                : undefined,
            }}
          >
            {height > 40 && (
              <span
                className="absolute left-1/2 -translate-x-1/2 text-[10px] leading-none font-medium whitespace-nowrap [writing-mode:vertical-rl]"
                style={{ top: labelOffset }}
              >
                {person.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
