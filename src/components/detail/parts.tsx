import type { ReactNode } from "react";
import { datesFor, type EntityRef } from "../../data";
import type { Event, ScriptureRef } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { entityTitle } from "../../lib/entities";
import { formatRef, refUrl } from "../../lib/scripture";
import { useStore } from "../../state/store";

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** A link-like button that selects another entity. */
export function Chip({ to, label }: { to: EntityRef; label?: string }) {
  const select = useStore((s) => s.select);
  return (
    <button
      onClick={() => select(to)}
      className="rounded-full border border-line bg-paper-2 px-2.5 py-0.5 text-sm hover:border-accent hover:text-accent"
    >
      {label ?? entityTitle(to)}
    </button>
  );
}

export function Chips({ refs }: { refs: EntityRef[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {refs.map((r) => <Chip key={`${r.kind}:${r.id}`} to={r} />)}
    </div>
  );
}

/** Events in date order, each with its date, as selectable rows. */
export function EventList({ events }: { events: Event[] }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const select = useStore((s) => s.select);
  if (events.length === 0) return <p className="text-sm text-ink-muted">None recorded yet.</p>;
  return (
    <ol className="space-y-0.5">
      {events.map((ev) => {
        const spec = datesFor(ev, chron);
        return (
          <li key={ev.id}>
            <button
              onClick={() => select({ kind: "event", id: ev.id })}
              className="flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-1 text-left text-sm hover:bg-paper-2"
            >
              <span className="hover:text-accent">{ev.title}</span>
              {spec && <span className="shrink-0 text-xs text-ink-muted tabular-nums">{formatDateSpec(spec, eraStyle)}</span>}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ScriptureList({ refs }: { refs: ScriptureRef[] }) {
  if (refs.length === 0) return null;
  return (
    <Section title="Scripture">
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {refs.map((r) => (
          <li key={formatRef(r)}>
            <a
              href={refUrl(r)}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
            >
              {formatRef(r)}
              <span className="sr-only"> (opens Bible Gateway in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="mt-2 border-l-2 border-line pl-3 text-sm text-ink-muted italic">{children}</p>;
}
