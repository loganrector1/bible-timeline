import { kinById, childrenOfKin, hasFamily } from "../../lib/family";
import type { Person } from "../../data/schema";
import { eventsForPerson, personDatesText } from "../../lib/entities";
import { useStore } from "../../state/store";
import { FilterShortcut } from "../Filters";
import { Chip, EventList, Note, ScriptureList, Section } from "./parts";
import { Prose } from "../ScriptureText";
import { MapBorders } from "./MapBorders";

export default function PersonDetail({ person }: { person: Person }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const datesText = personDatesText(person, chron, eraStyle);
  const setFamilyTree = useStore((s) => s.setFamilyTree);
  const treeOnThem = useStore((s) => s.familyTree === person.id);
  const events = eventsForPerson(person.id, chron);

  const family = [
    { label: "Parents", ids: [...person.parents, ...person.altParents] },
    { label: "Spouses", ids: person.spouses },
    { label: "Children", ids: childrenOfKin(person.id) },
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

      <p className="mt-4 leading-relaxed"><Prose text={person.summary} /></p>

      {family.length > 0 && (
        <Section title="Family">
          <dl className="space-y-1.5">
            {family.map((g) => (
              <div key={g.label} className="flex items-baseline gap-2">
                <dt className="w-16 shrink-0 text-sm text-ink-muted">{g.label}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {/* Names known only from the genealogies open the tree on them. */}
                  {g.ids.map((id) => kinById(id)?.person
                    ? <Chip key={id} to={{ kind: "person", id }} />
                    : (
                      <button
                        key={id}
                        onClick={() => setFamilyTree(id)}
                        className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-sm text-ink-muted hover:border-accent hover:text-accent"
                      >
                        {kinById(id)?.name ?? id}
                      </button>
                    ))}
                </dd>
              </div>
            ))}
          </dl>
          {person.familyNote && <Note>{person.familyNote}</Note>}
          {hasFamily(person.id) && !treeOnThem && (
            <button onClick={() => setFamilyTree(person.id)} className="mt-2 text-sm text-accent hover:underline">
              Show in the family tree
            </button>
          )}
        </Section>
      )}

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
