import { useMemo } from "react";
import { data, datesFor } from "../../data";
import { formatDateSpec, specExtent, specMidpoint } from "../../lib/dates";
import { lifeMarkPerson } from "../../lib/entities";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { hoverProps, type OnHover } from "./hover";
import { packIntervals } from "./pack";

const COLUMN = 18;
const BAR = 14;
const MARK = 10;

/**
 * Lifespans as vertical bars, packed into columns so overlapping lives sit side by side.
 * Routine births and deaths are small marks on the bar rather than dots in the event lane.
 */
export default function PeopleLane({ scale, onHover }: { scale: TimeScale; onHover: OnHover }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  const lives = useMemo(() => {
    const items = data.people.flatMap((person) => {
      const spec = datesFor(person, chron);
      return spec ? [{ person, spec, bounds: specExtent(spec) }] : [];
    });
    const columns = packIntervals(items.map((i) => i.bounds));
    return items.map((item, i) => ({ ...item, column: columns[i] }));
  }, [chron]);

  const marks = useMemo(() => {
    const columnOf = new Map(lives.map((l) => [l.person.id, l.column]));
    return data.events.flatMap((ev) => {
      const personId = lifeMarkPerson(ev, chron);
      const spec = datesFor(ev, chron);
      return personId && spec ? [{ ev, spec, year: specMidpoint(spec), column: columnOf.get(personId)! }] : [];
    });
  }, [lives, chron]);

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
            {...hoverProps({ kind: "person", id: person.id }, onHover)}
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
      {marks.map(({ ev, spec, year, column }) => {
        const y = yearToPx(scale, year);
        if (y < -MARK || y > scale.height + MARK) return null;
        const selected = selection?.kind === "event" && selection.id === ev.id;
        const lit = !highlight || highlight.events.has(ev.id);
        return (
          <button
            key={ev.id}
            onClick={() => select({ kind: "event", id: ev.id })}
            {...hoverProps({ kind: "event", id: ev.id }, onHover)}
            aria-label={`${ev.title}, ${formatDateSpec(spec, eraStyle)}`}
            aria-pressed={selected}
            className={`absolute -translate-y-1/2 rounded-full border-2 ${
              selected ? "border-accent bg-accent ring-4 ring-accent/25" : "border-ink/70 bg-paper hover:border-accent"
            } ${lit ? "" : "opacity-35"}`}
            style={{ left: column * COLUMN + 4 + (BAR - MARK) / 2, top: y, width: MARK, height: MARK }}
          />
        );
      })}
    </div>
  );
}
