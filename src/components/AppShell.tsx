import { lazy, Suspense, type CSSProperties } from "react";
import { useStore, type ViewMode } from "../state/store";
import BrowsePanel from "./BrowsePanel";
import DetailPanel, { PEEK_HEIGHT } from "./DetailPanel";
import { FilterBar, FilterButton, MOCK, useFilterCount } from "./Filters";
import Onboarding from "./Onboarding";
import Timeline from "./timeline/Timeline";

// The map library is large; load it only when the map is first shown.
const MapView = lazy(() => import("./map/MapView"));

const MODES: { id: ViewMode; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "split", label: "Both" },
  { id: "map", label: "Map" },
];

export default function AppShell() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const hasSelection = useStore((s) => s.selection !== null);
  const browseOpen = useStore((s) => s.browseOpen);
  const timeStripPx = useStore((s) => s.timeStripPx);
  const setBrowseOpen = useStore((s) => s.setBrowseOpen);
  const filterCount = useFilterCount();

  const showTimeline = mode !== "map";
  const showMap = mode !== "timeline";

  return (
    <div className="relative flex h-full flex-col">
      <header className="relative flex items-center justify-between gap-2 sm:gap-3 border-b border-line bg-paper-2 px-4 py-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="font-serif text-lg font-semibold tracking-tight sm:text-xl">Bible Timeline</h1>
          <button
            onClick={() => setBrowseOpen(!browseOpen)}
            aria-pressed={browseOpen}
            aria-keyshortcuts="/"
            title="Browse and search (/)"
            className={`flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-sm ${
              browseOpen ? "bg-ink text-paper" : "bg-paper text-ink-muted hover:text-ink"
            }`}
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4.5 4.5" />
            </svg>
            <span className="max-sm:sr-only">Browse</span>
            {MOCK === "b" && filterCount > 0 && <span className="rounded-full bg-accent px-1.5 text-xs text-paper">{filterCount}</span>}
          </button>
          {MOCK === "a" && <FilterButton />}
        </div>
        <div role="radiogroup" aria-label="View" className="flex rounded-lg border border-line bg-paper p-0.5 text-sm">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={mode === m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-md px-3 py-1 transition-colors ${
                mode === m.id ? "bg-accent text-paper" : "text-ink-muted hover:text-ink"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>
      {MOCK === "a" && <FilterBar />}

      <div className="relative flex min-h-0 flex-1">
        <BrowsePanel />
        {/* On a phone in Both view, the timeline and the map split the space that's actually
            visible: not counting the map's time strip, or the details peek that covers the
            bottom of the map while something is selected. */}
        <main
          className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row"
          style={{ "--below-map": `calc(${timeStripPx}px + ${hasSelection ? PEEK_HEIGHT : "0px"})` } as CSSProperties}
        >
          {showTimeline && (
            <section
              aria-label="Timeline"
              className={`min-h-0 ${mode === "split" ? "h-[calc((100%-var(--below-map))/2)] border-line transition-[height] duration-200 max-md:border-b md:h-auto md:w-[44%] md:border-r" : "flex-1"}`}
            >
              <Timeline />
            </section>
          )}
          {showMap && (
            <section aria-label="Map" className="min-h-0 min-w-0 flex-1">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-ink-muted">Loading map…</div>}>
                <MapView />
              </Suspense>
            </section>
          )}
        </main>
        {hasSelection && <DetailPanel />}
      </div>
      <Onboarding />
    </div>
  );
}
