import { data, datesFor } from "../../data";
import type { Era } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { entityBounds, eventsInEra } from "../../lib/entities";
import { useStore } from "../../state/store";
import { Chips, EventList, Note, Section } from "./parts";

export default function EraDetail({ era }: { era: Era }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const spec = datesFor(era, chron);
  const events = eventsInEra(era.id, chron);
  const bounds = entityBounds({ kind: "era", id: era.id }, chron);

  // People whose lives overlap the era.
  const people = bounds
    ? data.people.filter((p) => {
        const b = entityBounds({ kind: "person", id: p.id }, chron);
        return b && b[0] < bounds[1] && b[1] > bounds[0];
      })
    : [];

  return (
    <>
      <p className="flex items-center gap-2 text-sm font-medium text-accent">
        <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: era.color }} />
        {spec ? formatDateSpec(spec, eraStyle) : "Dates unknown"}
      </p>
      {era.dateNote && <Note>{era.dateNote}</Note>}

      <p className="mt-4 leading-relaxed">{era.summary}</p>

      {people.length > 0 && (
        <Section title="People">
          <Chips refs={people.map((p) => ({ kind: "person", id: p.id }))} />
        </Section>
      )}

      <Section title={`Events (${events.length})`}>
        <EventList events={events} />
      </Section>
    </>
  );
}
