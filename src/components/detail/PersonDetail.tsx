import { childrenOf } from "../../data";
import type { Person } from "../../data/schema";
import { eventsForPerson, personDatesText } from "../../lib/entities";
import { useStore } from "../../state/store";
import { FilterShortcut } from "../Filters";
import { Chips, EventList, Note, ScriptureList, Section } from "./parts";

export default function PersonDetail({ person }: { person: Person }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const datesText = personDatesText(person, chron, eraStyle);
  const children = childrenOf(person.id);
  const events = eventsForPerson(person.id, chron);

  const family = [
    { label: "Parents", ids: person.parents },
    { label: "Spouses", ids: person.spouses },
    { label: "Children", ids: children.map((c) => c.id) },
  ].filter((g) => g.ids.length > 0);

  return (
    <>
      <p className="text-sm font-medium text-accent">
        {person.roles.join(", ")}
        {datesText && <span className="text-ink-muted"> · {datesText}</span>}
      </p>
      {person.altNames.length > 0 && (
        <p className="mt-1 text-sm text-ink-muted">Also called {person.altNames.join(", ")}</p>
      )}
      {person.dateNote && <Note>{person.dateNote}</Note>}

      <p className="mt-4 leading-relaxed">{person.summary}</p>

      {family.length > 0 && (
        <Section title="Family">
          <dl className="space-y-1.5">
            {family.map((g) => (
              <div key={g.label} className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-sm text-ink-muted">{g.label}</dt>
                <dd><Chips refs={g.ids.map((id) => ({ kind: "person", id }))} /></dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      <Section title={`Life events (${events.length})`}>
        <p className="mb-1 text-xs text-ink-muted">Highlighted on the timeline and map.</p>
        <EventList events={events} />
      </Section>

      <ScriptureList refs={person.scripture} />

      <FilterShortcut person={person} />
    </>
  );
}
