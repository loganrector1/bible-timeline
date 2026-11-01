import { useEffect, useMemo, useState } from "react";
import { data, datesFor, type EntityKind, type EntityRef } from "../data";
import { formatDateSpec } from "../lib/dates";
import { eventsInOrder } from "../lib/entities";
import { eventShown, FILTER_TYPES } from "../lib/filters";
import { formatPassage, formatPassageParam, parsePassage } from "../lib/passages";
import { useStore } from "../state/store";

type Tab = "all" | EntityKind | "tour";

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: "Events" },
  { id: "person", label: "People" },
  { id: "location", label: "Places" },
  { id: "era", label: "Eras" },
  { id: "tour", label: "Tours" },
];

const GROUP_TITLE: Record<EntityKind, string> = { era: "Eras", event: "Events", person: "People", location: "Places" };

/** `hidden`: an event the filters hide. It's still listed (dimmed), and picking it shows it. */
type Item = { ref: EntityRef; name: string; detail: string; search: string; hidden?: boolean };

type Suggestion = { label: string; apply: () => void };

/**
 * Filters the search names, not yet on: an event type ("battle") or one person ("David"), and a
 * book or passage ("Exodus 12-14"). "Job" and "Ruth" are both a person and a book, so both show.
 */
function useSuggestions(query: string): Suggestion[] {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const out: Suggestion[] = [];
  const type = FILTER_TYPES.find(({ type, label }) => label.toLowerCase().startsWith(q) || q.startsWith(type));
  // A person only when the search picks out one: their whole name, or the only name it starts.
  const names = (p: (typeof data.people)[number]) => [p.name, ...p.altNames].map((n) => n.toLowerCase());
  const exact = data.people.filter((p) => names(p).includes(q));
  const starts = data.people.filter((p) => names(p).some((n) => n.startsWith(q)));
  const person = exact.length === 1 ? exact[0] : starts.length === 1 ? starts[0] : undefined;
  if (type && !filters.types.includes(type.type)) {
    out.push({ label: type.label, apply: () => setFilters({ types: [...filters.types, type.type] }) });
  } else if (person && !filters.people.includes(person.id)) {
    out.push({ label: `${person.name}’s events`, apply: () => setFilters({ people: [...filters.people, person.id] }) });
  }
  const passage = parsePassage(q);
  const passageOn = passage && filters.passages.some((p) => formatPassageParam(p) === formatPassageParam(passage));
  if (passage && !passageOn) {
    out.push({ label: `events in ${formatPassage(passage)}`, apply: () => setFilters({ passages: [...filters.passages, passage] }) });
  }
  return out;
}

/** A searchable index of everything in the dataset; picking an item opens its details. */
export default function BrowsePanel() {
  const open = useStore((s) => s.browseOpen);
  const setOpen = useStore((s) => s.setBrowseOpen);
  const select = useStore((s) => s.select);
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const filters = useStore((s) => s.filters);
  const suggestions = useSuggestions(query);

  // "/" opens the panel from anywhere (except while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest("input, textarea");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const groups = useMemo(() => {
    const dateOf = (e: { dates?: Parameters<typeof datesFor>[0]["dates"] }) => {
      const spec = datesFor(e, chron);
      return spec ? formatDateSpec(spec, eraStyle) : "";
    };
    const byName = (a: Item, b: Item) => a.name.localeCompare(b.name);
    const all: Record<EntityKind, Item[]> = {
      era: data.eras.map((e) => ({
        ref: { kind: "era", id: e.id }, name: e.name, detail: dateOf(e), search: e.name,
      })),
      event: eventsInOrder(chron).map((e) => ({
        ref: { kind: "event", id: e.id }, name: e.title, detail: dateOf(e), search: e.title, hidden: !eventShown(e, filters),
      })),
      person: data.people.map((p) => ({
        ref: { kind: "person", id: p.id } as EntityRef,
        name: p.name,
        detail: [p.roles[0], dateOf(p)].filter(Boolean).join(" · "),
        search: [p.name, ...p.altNames].join(" "),
      })).sort(byName),
      location: data.locations.map((l) => ({
        ref: { kind: "location", id: l.id } as EntityRef,
        name: l.name,
        detail: l.modernName ?? l.type,
        search: [l.name, l.modernName ?? ""].join(" "),
      })).sort(byName),
    };
    const q = query.trim().toLowerCase();
    const kinds: EntityKind[] = tab === "all" ? ["era", "event", "person", "location"] : tab === "tour" ? [] : [tab];
    return kinds
      .map((kind) => ({ kind, items: all[kind].filter((i) => !q || i.search.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, tab, chron, eraStyle, filters]);

  // Tours come first in All, since they're a way in for someone who doesn't know where to start.
  const q = query.trim().toLowerCase();
  const tours = tab === "all" || tab === "tour"
    ? data.tours.filter((t) => !q || `${t.title} ${t.summary}`.toLowerCase().includes(q))
    : [];
  const activeTour = useStore((s) => s.tour?.id);
  const progress = useStore((s) => s.tourProgress);

  if (!open) return null;

  const closeOnPhone = () => window.innerWidth < 768 && setOpen(false);
  const pick = (ref: EntityRef) => {
    select(ref);
    closeOnPhone(); // On phones the panel covers everything.
  };

  return (
    <aside
      aria-label="Browse"
      className="absolute inset-y-0 left-0 z-30 flex w-80 max-w-full flex-col border-r border-line bg-paper shadow-2xl"
    >
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex items-center gap-2">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people, places, events…"
            aria-label="Search"
            className="min-w-0 flex-1 rounded-md border border-line bg-paper-2 px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <button onClick={() => setOpen(false)} aria-label="Close browse" className="rounded p-1.5 text-ink-muted hover:bg-paper-2 hover:text-ink">✕</button>
        </div>
        <div role="tablist" className="flex gap-1 text-xs">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full px-2.5 py-1 ${tab === t.id ? "bg-ink text-paper" : "text-ink-muted hover:bg-paper-2"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {suggestions.map((sg) => (
          <button
            key={sg.label}
            onClick={sg.apply}
            className="mb-2 flex w-full items-center gap-2 rounded-md border border-dashed border-accent/60 px-2 py-1.5 text-left text-sm hover:bg-accent/10"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 4.5h14l-5.5 6.5v5l-3 -1.5v-3.5z" />
            </svg>
            <span>Filter: show only <strong className="font-semibold">{sg.label}</strong></span>
          </button>
        ))}
        {tours.length > 0 && (
          <section className="mb-3">
            {tab === "all" && (
              <h3 className="px-2 py-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                Guided tours <span className="font-normal">({tours.length})</span>
              </h3>
            )}
            <ul>
              {tours.map((t) => {
                // A tour left part-way continues where it stopped; "Start over" is beside it.
                const at = progress[t.id];
                const resumable = at !== undefined && at > 0 && activeTour !== t.id;
                const start = (step: number) => {
                  useStore.getState().startTour(t.id, step);
                  closeOnPhone();
                };
                return (
                  <li key={t.id} className={`rounded ${activeTour === t.id ? "bg-accent-soft" : "hover:bg-paper-2"}`}>
                    <button onClick={() => start(resumable ? at : 0)} className="w-full px-2 pt-1.5 text-left text-sm">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate font-medium">{t.title}</span>
                        <span className={`shrink-0 text-xs ${resumable ? "text-accent" : "text-ink-muted"}`}>
                          {resumable ? `Continue · step ${at + 1} of ${t.steps.length}` : `${t.steps.length} steps`}
                        </span>
                      </span>
                      <span className={`mt-0.5 block text-xs leading-snug text-ink-muted ${tab === "all" ? "line-clamp-1" : ""}`}>{t.summary}</span>
                    </button>
                    <div className="flex justify-end px-2 pb-1.5">
                      {resumable && (
                        <button onClick={() => start(0)} className="text-xs text-accent hover:underline">
                          Start over
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {groups.length === 0 && tours.length === 0 && <p className="px-2 py-4 text-sm text-ink-muted">Nothing matches “{query}”.</p>}
        {groups.map((g) => (
          <section key={g.kind} className="mb-3">
            {tab === "all" && (
              <h3 className="px-2 py-1 text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
                {GROUP_TITLE[g.kind]} <span className="font-normal">({g.items.length})</span>
              </h3>
            )}
            <ul>
              {g.items.map((item) => {
                const selected = selection?.kind === item.ref.kind && selection.id === item.ref.id;
                return (
                  <li key={item.ref.id}>
                    <button
                      onClick={() => pick(item.ref)}
                      aria-pressed={selected}
                      className={`flex w-full items-baseline justify-between gap-3 rounded px-2 py-1 text-left text-sm ${
                        selected ? "bg-accent text-paper" : "hover:bg-paper-2"
                      }`}
                    >
                      <span className={`min-w-0 truncate ${item.hidden && !selected ? "text-ink-muted/70" : ""}`}>{item.name}</span>
                      <span className={`shrink-0 truncate text-xs ${selected ? "text-paper/80" : item.hidden ? "text-ink-muted/70" : "text-ink-muted"}`}>
                        {item.hidden ? `Hidden · ${item.detail}` : item.detail}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
