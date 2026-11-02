import type { Person } from "../../data/schema";
import { eventsForPerson, personDatesText } from "../../lib/entities";
import { useStore } from "../../state/store";
import { FilterShortcut } from "../Filters";
import { Family } from "./Family";
import { EventList, Note, ScriptureList, Section } from "./parts";
import { Prose } from "../ScriptureText";
import { MapBorders } from "./MapBorders";

export default function PersonDetail({ person }: { person: Person }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const datesText = personDatesText(person, chron, eraStyle);
  const events = eventsForPerson(person.id, chron);

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

      <p className="mt-4 leading-relaxed"><Prose text={person.summary} /></p>

      <Family id={person.id} />

      <Section title={`Life events (${events.length})`}>
        <p className="mb-1 text-xs text-ink-muted">Highlighted on the timeline and map.</p>
        <EventList events={events} />
      </Section>

      <ScriptureList refs={person.scripture} />

      <MapBorders of={{ kind: "person", id: person.id }} />

      <FilterShortcut person={person} />
    </>
  );
}
