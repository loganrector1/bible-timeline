import { useEffect, useMemo, useRef, useState } from "react";
import { data, peopleById } from "../data";
import type { EventType } from "../data/schema";
import { eventShown, FILTER_TYPES, NO_FILTERS, TYPE_FILTER_LABEL } from "../lib/filters";
import { useStore } from "../state/store";

export function useFilterCount(): number {
  const { types, people } = useStore((s) => s.filters);
  return types.length + people.length;
}

function useMatchCount(): number {
  const filters = useStore((s) => s.filters);
  return useMemo(() => data.events.filter((ev) => eventShown(ev, filters)).length, [filters]);
}

/** The filter choices: event types as toggles, and people picked by name. */
export function FilterControls() {
  const { types, people } = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const matches = useMatchCount();
  const [query, setQuery] = useState("");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return data.people
      .filter((p) => !people.includes(p.id) && [p.name, ...p.altNames].some((n) => n.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [query, people]);

  const toggleType = (t: EventType) =>
    setFilters({ types: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] });

  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">Event types</h3>
        <div className="flex flex-wrap gap-1.5">
          {FILTER_TYPES.map(({ type, label }) => {
            const on = types.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-0.5 text-sm ${on ? "border-accent bg-accent text-paper" : "border-line text-ink-muted hover:border-accent hover:text-ink"}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">People</h3>
        {people.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {people.map((id) => (
              <Chip key={id} label={peopleById.get(id)?.name ?? id} onRemove={() => setFilters({ people: people.filter((p) => p !== id) })} />
            ))}
          </div>
        )}
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add a person…"
          aria-label="Add a person"
          className="w-full rounded-md border border-line bg-paper-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        {suggestions.length > 0 && (
          <ul className="mt-1 rounded-md border border-line bg-paper py-1 shadow-sm">
            {suggestions.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => {
                    setFilters({ people: [...people, p.id] });
                    setQuery("");
                  }}
                  className="flex w-full items-baseline justify-between gap-3 px-3 py-1 text-left text-sm hover:bg-paper-2"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 truncate text-xs text-ink-muted">{p.roles[0]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="flex items-center justify-between text-sm text-ink-muted">
        <span>{matches} of {data.events.length} events</span>
        {(types.length > 0 || people.length > 0) && (
          <button onClick={() => setFilters(NO_FILTERS)} className="text-accent hover:underline">
            Clear all
          </button>
        )}
      </p>
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="flex items-center gap-0.5 rounded-full border border-accent/50 bg-accent/10 py-0.5 pr-0.5 pl-2.5 text-sm text-ink">
      {label}
      <button onClick={onRemove} aria-label={`Remove ${label}`} className="rounded-full px-1.5 text-ink-muted hover:text-ink">
        ✕
      </button>
    </span>
  );
}

/** The active filters as removable chips, under the header, so it's clear why events are missing. */
export function FilterBar() {
  const { types, people } = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const matches = useMatchCount();
  if (!types.length && !people.length) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-paper-2 px-4 py-1.5 text-sm">
      <span className="shrink-0 text-ink-muted">Showing {matches} events:</span>
      {types.map((t) => (
        <Chip key={t} label={TYPE_FILTER_LABEL.get(t)!} onRemove={() => setFilters({ types: types.filter((x) => x !== t) })} />
      ))}
      {people.map((id) => (
        <Chip key={id} label={peopleById.get(id)?.name ?? id} onRemove={() => setFilters({ people: people.filter((p) => p !== id) })} />
      ))}
      <button onClick={() => setFilters(NO_FILTERS)} className="ml-auto shrink-0 text-accent hover:underline">
        Clear
      </button>
    </div>
  );
}

/** The Filter button beside Browse, opening the choices in a small panel. */
export function FilterButton() {
  const count = useFilterCount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="sm:relative">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm ${
          open || count ? "bg-ink text-paper" : "bg-paper text-ink-muted hover:text-ink"
        }`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5h14l-5.5 6.5v5l-3 -1.5v-3.5z" />
        </svg>
        <span className="max-sm:sr-only">Filter</span>
        {count > 0 && <span className="text-xs opacity-75">{count}</span>}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Filter events"
          className="absolute top-full z-40 mt-1.5 rounded-xl border border-line bg-paper p-4 shadow-2xl max-sm:inset-x-2 sm:left-0 sm:w-96"
        >
          <FilterControls />
        </div>
      )}
    </div>
  );
}

/**
 * A detail panel's shortcut to filter by what it shows: an event's type, or a person's events.
 * Pressed again, it removes that filter.
 */
export function FilterShortcut({ type, person }: { type?: EventType; person?: { id: string; name: string } }) {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const on = type ? filters.types.includes(type) : person ? filters.people.includes(person.id) : false;
  const label = type ? TYPE_FILTER_LABEL.get(type)!.toLowerCase() : `${person?.name}’s events`;
  const toggle = () => {
    if (type) setFilters({ types: on ? filters.types.filter((t) => t !== type) : [...filters.types, type] });
    else if (person) setFilters({ people: on ? filters.people.filter((p) => p !== person.id) : [...filters.people, person.id] });
  };
  return (
    <button
      onClick={toggle}
      aria-pressed={on}
      className={`mt-6 flex w-full items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm ${
        on ? "border-accent bg-accent/10 text-accent" : "border-line hover:border-accent hover:text-accent"
      }`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4.5h14l-5.5 6.5v5l-3 -1.5v-3.5z" />
      </svg>
      {on ? `Stop filtering to ${label}` : `Show only ${label}`}
    </button>
  );
}
