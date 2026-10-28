import { data, datesFor, journeysById } from "../../data";
import { CHRONOLOGIES } from "../../data/chronologies";
import type { Event } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { eventMidpoint, eventsInOrder, entityBounds } from "../../lib/entities";
import { useStore } from "../../state/store";
import { Chip, Chips, Note, ScriptureList, Section } from "./parts";

export default function EventDetail({ ev }: { ev: Event }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const spec = datesFor(ev, chron);
  const mid = eventMidpoint(ev, chron);

  const era = mid === undefined ? undefined : data.eras.find((e) => {
    const b = entityBounds({ kind: "era", id: e.id }, chron);
    return b && mid >= b[0] && mid < b[1];
  });

  const alternates = CHRONOLOGIES.filter((c) => c.id !== chron && ev.dates[c.id]);
  const ordered = eventsInOrder(chron);
  const index = ordered.findIndex((e) => e.id === ev.id);
  const prev = ordered[index - 1];
  const next = ordered[index + 1];
  const journey = ev.journeyId ? journeysById.get(ev.journeyId) : undefined;
  const mapShown = useStore((s) => s.mode !== "timeline");
  const select = useStore((s) => s.select);

  return (
    <>
      <p className="text-sm font-medium text-accent">
        {spec ? formatDateSpec(spec, eraStyle) : "Date unknown"}
        {era && <span className="text-ink-muted"> · {era.name}</span>}
      </p>
      {alternates.length > 0 && (
        <ul className="mt-1 text-sm text-ink-muted">
          {alternates.map((c) => (
            <li key={c.id}>
              {c.name}: {formatDateSpec(ev.dates[c.id], eraStyle)}
            </li>
          ))}
        </ul>
      )}
      {ev.dateNote && <Note>{ev.dateNote}</Note>}

      <p className="mt-4 leading-relaxed">{ev.summary}</p>
      {ev.description && <p className="mt-2 leading-relaxed text-ink/90">{ev.description}</p>}

      {ev.people.length > 0 && (
        <Section title="People">
          <Chips refs={ev.people.map((id) => ({ kind: "person", id }))} />
        </Section>
      )}
      {ev.locations.length > 0 && (
        <Section title="Places">
          <Chips refs={ev.locations.map((id) => ({ kind: "location", id }))} />
        </Section>
      )}
      {journey && (
        <Section title="Journey">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm">{journey.name}</p>
            {mapShown && (
              // Re-selecting frames the map and draws the journey again.
              <button
                onClick={() => select({ kind: "event", id: ev.id })}
                className="flex shrink-0 items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs hover:border-accent hover:text-accent"
              >
                <span aria-hidden>↻</span> Replay journey
              </button>
            )}
          </div>
          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {journey.stops.map((stop, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="text-ink-muted">→</span>}
                <Chip to={{ kind: "location", id: stop.locationId }} />
              </li>
            ))}
          </ol>
        </Section>
      )}

      <ScriptureList refs={ev.scripture} />

      {(prev || next) && (
        <Section title="Before and after">
          <div className="grid grid-cols-2 gap-2">
            <div>{prev && <Chip to={{ kind: "event", id: prev.id }} label={`← ${prev.title}`} />}</div>
            <div className="text-right">{next && <Chip to={{ kind: "event", id: next.id }} label={`${next.title} →`} />}</div>
          </div>
        </Section>
      )}
    </>
  );
}
