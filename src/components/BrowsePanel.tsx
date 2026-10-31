import { useEffect, useMemo, useState } from "react";
import { data, datesFor, type EntityKind, type EntityRef } from "../data";
import { formatDateSpec } from "../lib/dates";
import { eventsInOrder } from "../lib/entities";
import { useStore } from "../state/store";
import { FilterControls, MOCK, useFilterCount } from "./Filters";

type Tab = "all" | EntityKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "event", label: "Events" },
  { id: "person", label: "People" },
  { id: "location", label: "Places" },
  { id: "era", label: "Eras" },
];

const GROUP_TITLE: Record<EntityKind, string> = { era: "Eras", event: "Events", person: "People", location: "Places" };

type Item = { ref: EntityRef; name: string; detail: string; search: string };

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
  const filterCount = useFilterCount();
  const [filtersOpen, setFiltersOpen] = useState(false);

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
        ref: { kind: "event", id: e.id }, name: e.title, detail: dateOf(e), search: e.title,
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
    const kinds: EntityKind[] = tab === "all" ? ["era", "event", "person", "location"] : [tab];
    return kinds
      .map((kind) => ({ kind, items: all[kind].filter((i) => !q || i.search.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [query, tab, chron, eraStyle]);

  if (!open) return null;

  const pick = (ref: EntityRef) => {
    select(ref);
    if (window.innerWidth < 768) setOpen(false); // On phones the panel covers everything.
  };

  return (
    <aside
      aria-label="Browse"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
        }
      }}
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

      {MOCK === "b" && (
        <div className="border-b border-line">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-paper-2"
          >
            <span className="font-semibold">
              Filter events {filterCount > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-xs font-normal text-paper">{filterCount}</span>}
            </span>
            <span aria-hidden className="text-xs text-ink-muted">{filtersOpen ? "▴" : "▾"}</span>
          </button>
          {filtersOpen && (
            <div className="px-3 pb-3">
              <FilterControls />
            </div>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {groups.length === 0 && <p className="px-2 py-4 text-sm text-ink-muted">Nothing matches “{query}”.</p>}
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
                      <span className="min-w-0 truncate">{item.name}</span>
                      <span className={`shrink-0 truncate text-xs ${selected ? "text-paper/80" : "text-ink-muted"}`}>{item.detail}</span>
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
