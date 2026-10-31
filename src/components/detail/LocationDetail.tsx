import type { Location } from "../../data/schema";
import { eventsAtLocation } from "../../lib/entities";
import { useStore } from "../../state/store";
import { EventList, Note, Section } from "./parts";

const TYPE_LABEL: Record<Location["type"], string> = {
  city: "City", region: "Region", mountain: "Mountain", river: "River",
  sea: "Sea", wilderness: "Wilderness", site: "Site", island: "Island",
};

export default function LocationDetail({ loc }: { loc: Location }) {
  const chron = useStore((s) => s.chronologyId);
  const events = eventsAtLocation(loc.id, chron);

  return (
    <>
      <p className="text-sm font-medium text-accent">
        {TYPE_LABEL[loc.type]}
        {loc.modernName && <span className="text-ink-muted"> · today: {loc.modernName}</span>}
      </p>
      {loc.uncertain && (
        <p className="mt-2 inline-block rounded bg-accent-soft px-2 py-0.5 text-xs font-medium">Location uncertain</p>
      )}
      {loc.note && <Note>{loc.note}</Note>}

      <p className="mt-4 leading-relaxed">{loc.summary}</p>

      {loc.alternateSites.length > 0 && (
        <Section title="Other proposed sites">
          <ul className="list-inside list-disc text-sm">
            {loc.alternateSites.map((alt) => <li key={alt.name}>{alt.name}</li>)}
          </ul>
          <p className="mt-1 text-xs text-ink-muted">Shown on the map as hollow circles.</p>
        </Section>
      )}

      <Section title={`Events here (${events.length})`}>
        <EventList events={events} />
      </Section>
    </>
  );
}
