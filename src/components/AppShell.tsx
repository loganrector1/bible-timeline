import { lazy, Suspense } from "react";
import { useStore, type ViewMode } from "../state/store";
import DetailPanel from "./DetailPanel";
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

  const showTimeline = mode !== "map";
  const showMap = mode !== "timeline";

  return (
    <div className="relative flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-paper-2 px-4 py-2">
        <h1 className="font-serif text-lg font-semibold tracking-tight sm:text-xl">Bible Timeline</h1>
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

      <div className="relative flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
          {showTimeline && (
            <section
              aria-label="Timeline"
              className={`min-h-0 ${mode === "split" ? "h-1/2 border-line max-md:border-b md:h-auto md:w-[44%] md:border-r" : "flex-1"}`}
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
