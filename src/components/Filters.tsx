import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { data, peopleById } from "../data";
import type { EventType } from "../data/schema";
import { eventShown, FILTER_TYPES, hasFilters, NO_FILTERS, TYPE_FILTER_LABEL } from "../lib/filters";
import { BOOK_LIST, formatPassage, formatPassageParam, parsePassage } from "../lib/passages";
import { useStore } from "../state/store";

export function useFilterCount(): number {
  const { types, people, passages } = useStore((s) => s.filters);
  return types.length + people.length + passages.length;
}

function useMatchCount(): number {
  const filters = useStore((s) => s.filters);
  return useMemo(() => data.events.filter((ev) => eventShown(ev, filters)).length, [filters]);
}

type Option = { id: string; label: string; detail: string };

/**
 * A text field with suggestions below it: the first is highlighted, the arrow keys move the
 * highlight, and Enter (or a click) picks one.
 */
function Picker({ id, label, placeholder, options, onPick }: {
  id: string; label: string; placeholder: string; options: (query: string) => Option[]; onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const shown = useMemo(() => (query.trim() ? options(query.trim()).slice(0, 6) : []), [query, options]);
  const current = shown[Math.min(active, shown.length - 1)];
  const pick = (o: Option) => {
    onPick(o.id);
    setQuery("");
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!shown.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + dir + shown.length) % shown.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(current);
    }
  };
  return (
    <>
      <input
        type="search"
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={id}
        aria-activedescendant={current ? `${id}-${current.id}` : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        className="w-full rounded-md border border-line bg-paper-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      {shown.length > 0 && (
        <ul id={id} role="listbox" aria-label={label} className="mt-1 rounded-md border border-line bg-paper py-1 shadow-sm">
          {shown.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-${o.id}`}
              role="option"
              aria-selected={o === current}
              onClick={() => pick(o)}
              onPointerMove={() => setActive(i)}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1 text-sm ${o === current ? "bg-paper-2" : ""}`}
            >
              <span className="truncate">{o.label}</span>
              <span className="shrink-0 truncate text-xs text-ink-muted">{o.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Heading({ children }: { children: string }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">{children}</h3>;
}

/** The filter choices: event types as toggles, people picked by name, and books or passages. */
export function FilterControls() {
  const filters = useStore((s) => s.filters);
  const { types, people, passages } = filters;
  const setFilters = useStore((s) => s.setFilters);
  const matches = useMatchCount();

  const peopleOptions = useMemo(() => (query: string): Option[] => {
    const q = query.toLowerCase();
    const names = (p: (typeof data.people)[number]) => [p.name, ...p.altNames].map((n) => n.toLowerCase());
    // Names that start with the search come first: "Jo" is Joseph before Ahaziah of Judah.
    const starts = (p: (typeof data.people)[number]) => names(p).some((n) => n.startsWith(q));
    return data.people
      .filter((p) => !people.includes(p.id) && names(p).some((n) => n.includes(q)))
      .sort((a, b) => Number(starts(b)) - Number(starts(a)))
      .map((p) => ({ id: p.id, label: p.name, detail: p.roles[0] ?? "" }));
  }, [people]);

  // What's typed, if it reads as a passage ("Exodus 12-14"), then the books it could be the start of.
  const passageOptions = useMemo(() => (query: string): Option[] => {
    const typed = parsePassage(query);
    const q = query.toLowerCase().replace(/\s+/g, " ");
    const books = BOOK_LIST.filter((b) => b.name.toLowerCase().startsWith(q) && b.id !== typed?.book);
    const on = new Set(passages.map(formatPassageParam));
    return [
      ...(typed ? [{ id: formatPassageParam(typed), label: formatPassage(typed), detail: typed.chapter ? "passage" : "book" }] : []),
      ...books.map((b) => ({ id: b.id, label: b.name, detail: "book" })),
    ].filter((o) => !on.has(o.id));
  }, [passages]);

  const toggleType = (t: EventType) =>
    setFilters({ types: types.includes(t) ? types.filter((x) => x !== t) : [...types, t] });

  return (
    <div className="space-y-4">
      <section>
        <Heading>Event types</Heading>
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
        <Heading>People</Heading>
        {people.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {people.map((id) => (
              <Chip key={id} label={peopleById.get(id)?.name ?? id} onRemove={() => setFilters({ people: people.filter((p) => p !== id) })} />
            ))}
          </div>
        )}
        <Picker
          id="filter-people"
          label="Add a person"
          placeholder="Add a person…"
          options={peopleOptions}
          onPick={(id) => setFilters({ people: [...people, id] })}
        />
      </section>
      <section>
        <Heading>Book or passage</Heading>
        {passages.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {passages.map((p) => (
              <Chip key={formatPassageParam(p)} label={formatPassage(p)} onRemove={() => setFilters({ passages: passages.filter((x) => x !== p) })} />
            ))}
          </div>
        )}
        <Picker
          id="filter-passages"
          label="Add a book or passage"
          placeholder="Exodus, or Exodus 12–14…"
          options={passageOptions}
          onPick={(id) => setFilters({ passages: [...passages, parsePassage(id)!] })}
        />
      </section>
      <p className="flex items-center justify-between text-sm text-ink-muted">
        <span>{matches} of {data.events.length} events</span>
        {hasFilters(filters) && (
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
  const filters = useStore((s) => s.filters);
  const { types, people, passages } = filters;
  const setFilters = useStore((s) => s.setFilters);
  const matches = useMatchCount();
  if (!hasFilters(filters)) return null;
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-line bg-paper-2 px-4 py-1.5 text-sm">
      <span className="shrink-0 text-ink-muted">Showing {matches} events:</span>
      {types.map((t) => (
        <Chip key={t} label={TYPE_FILTER_LABEL.get(t)!} onRemove={() => setFilters({ types: types.filter((x) => x !== t) })} />
      ))}
      {people.map((id) => (
        <Chip key={id} label={peopleById.get(id)?.name ?? id} onRemove={() => setFilters({ people: people.filter((p) => p !== id) })} />
      ))}
      {passages.map((p) => (
        <Chip key={formatPassageParam(p)} label={formatPassage(p)} onRemove={() => setFilters({ passages: passages.filter((x) => x !== p) })} />
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
        className={`flex h-8 items-center gap-1.5 rounded-lg border border-line px-2 text-sm sm:px-2.5 ${
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
          className="absolute top-full z-40 mt-1.5 max-h-[calc(100dvh-4rem)] overflow-y-auto rounded-xl border border-line bg-paper p-4 shadow-2xl max-sm:inset-x-2 sm:left-0 sm:w-96"
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
