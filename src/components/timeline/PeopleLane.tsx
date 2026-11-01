import { useMemo } from "react";
import { data, datesFor } from "../../data";
import type { Lane } from "../../data/schema";
import { formatDateSpec, specMidpoint } from "../../lib/dates";
import { hasLifeMarks, lifeMarkPerson, personDatesText, personSpan, shownLanes } from "../../lib/entities";
import { drawnAsLifeMark, eventShown, filteredPeople } from "../../lib/filters";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { hoverProps, type OnHover } from "./hover";
import { packIntervals } from "./pack";

const COLUMN = 15;
const BAR = 12;
const MARK = 10;

/** Judah warm, Israel cool; the united kingdom plain. */
const KINGDOM_TINT = {
  united: "border-ink/25 bg-ink/10",
  judah: "border-amber-700/40 bg-amber-500/25",
  israel: "border-sky-700/40 bg-sky-500/25",
};

export const LANE_NAMES: Record<Lane, string> = {
  people: "Important people", kings: "Kings & rulers", prophets: "Prophets", church: "Apostles & church",
};

/**
 * One lane of people (the main figures, or a group like the prophets) as vertical bars,
 * packed into columns so overlapping lives sit side by side. Someone in two lanes (Peter) shows
 * in the first that's on, except that kings always show in the Kings lane (`shownLanes`). A bar is the person's dates, or,
 * lighter and dashed, the span of their events when Scripture gives no dates (`personSpan`).
 * Routine births and deaths are small marks on the bar rather than dots in the event lane.
 */
export default function PeopleLane({ scale, onHover, lane }: { scale: TimeScale; onHover: OnHover; lane: Lane }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const shown = useStore((s) => s.lanes);
  const highlight = useHighlight();
  const filters = useStore((s) => s.filters);

  const lives = useMemo(() => {
    const items = data.people.filter((p) => shownLanes(p, shown).includes(lane)).flatMap((person) => {
      const span = personSpan(person, chron, lane === "kings");
      return span ? [{ person, ...span }] : [];
    });
    // Kings: Judah (after the united kingdom) on the left, Israel beside it; other rulers fill in.
    const preset = items.map(({ person: p }) => (lane !== "kings" || !p.kingdom ? undefined : p.kingdom === "israel" ? 1 : 0));
    const columns = packIntervals(items.map((i) => i.bounds), preset);
    return items.map((item, i) => ({ ...item, column: columns[i] }));
  }, [chron, lane, shown]);

  const marks = useMemo(() => {
    const columnOf = new Map(lives.filter((l) => hasLifeMarks(l.person, lane)).map((l) => [l.person.id, l.column]));
    return data.events.flatMap((ev) => {
      const personId = lifeMarkPerson(ev, chron);
      const spec = datesFor(ev, chron);
      const column = personId ? columnOf.get(personId) : undefined;
      return column !== undefined && spec ? [{ ev, spec, year: specMidpoint(spec), column }] : [];
    });
  }, [lives, chron, lane]);
  const selectedId = selection?.kind === "event" ? selection.id : undefined;
  const shownMarks = marks.filter((m) => drawnAsLifeMark(m.ev, filters) && (m.ev.id === selectedId || eventShown(m.ev, filters, chron)));
  const standOut = useMemo(() => filteredPeople(data.events, filters, chron), [filters, chron]);

  const width = (Math.max(0, ...lives.map((l) => l.column)) + 1) * COLUMN + 8;

  return (
    <div className="relative shrink-0 border-r border-line/60" style={{ width }}>
      {lives.map(({ person, spec, bounds, column, derived }) => {
        const top = yearToPx(scale, bounds[0]);
        const bottom = yearToPx(scale, bounds[1]);
        if (bottom < 0 || top > scale.height) return null;
        const height = bottom - top;
        const selected = selection?.kind === "person" && selection.id === person.id;
        // With nothing selected, the people filtered to (or in the events shown) stand out.
        const lit = highlight ? highlight.people.has(person.id) : !standOut || standOut.has(person.id);
        // Keep the name in view while any part of the bar is on screen.
        const labelOffset = Math.max(0, Math.min(-top, height - 80)) + 6;
        const dateText = personDatesText(person, chron, eraStyle) ?? "";

        return (
          <button
            key={person.id}
            onClick={() => select({ kind: "person", id: person.id })}
            {...hoverProps({ kind: "person", id: person.id }, onHover)}
            aria-label={`${person.name}, ${dateText}`}
            aria-pressed={selected}
            className={`absolute overflow-hidden rounded-full border transition-opacity ${
              selected ? "border-accent bg-accent text-paper"
              : lit && (highlight || standOut) ? "border-accent bg-accent-soft text-ink"
              : derived ? "border-ink/30 bg-ink/5 text-ink hover:border-accent"
              : lane === "kings" && person.kingdom ? `${KINGDOM_TINT[person.kingdom]} text-ink hover:border-accent`
              : "border-ink/25 bg-ink/10 text-ink hover:border-accent"
            } ${derived && !selected ? "border-dashed" : ""} ${lit ? "" : "opacity-35"}`}
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
      {shownMarks.map(({ ev, spec, year, column }) => {
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
