import { datesFor } from "../../data";
import type { Empire } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { eventsForEmpire, rulersOf } from "../../lib/entities";
import { useStore } from "../../state/store";
import { Prose } from "../ScriptureText";
import { MapBorders } from "./MapBorders";
import { Chips, EventList, Note, Section } from "./parts";

export default function EmpireDetail({ empire }: { empire: Empire }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const spec = datesFor(empire, chron);
  const rulers = rulersOf(empire.id, chron);
  const events = eventsForEmpire(empire.id, chron);

  return (
    <>
      <p className="text-sm font-medium text-accent">
        {spec ? formatDateSpec(spec, eraStyle) : "Dates unknown"} · World history
      </p>
      {empire.dateNote && <Note>{empire.dateNote}</Note>}

      <p className="mt-4 leading-relaxed"><Prose text={empire.summary} /></p>

      {empire.capitals.length > 0 && (
        <Section title="Ruled from">
          <Chips refs={empire.capitals.map((id) => ({ kind: "location", id }))} />
        </Section>
      )}

      {rulers.length > 0 && (
        <Section title="Rulers">
          <Chips refs={rulers.map((p) => ({ kind: "person", id: p.id }))} />
        </Section>
      )}

      {events.length > 0 && (
        <Section title={`Events (${events.length})`}>
          <EventList events={events} />
        </Section>
      )}

      <MapBorders of={{ kind: "empire", id: empire.id }} />
    </>
  );
}
