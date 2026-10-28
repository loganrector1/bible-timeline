import { entityTitle } from "../lib/entities";
import { useStore } from "../state/store";

export default function DetailPanel() {
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  if (!selection) return null;

  return (
    <aside
      aria-label="Details"
      className="absolute inset-x-0 bottom-0 z-20 max-h-[55%] overflow-y-auto border-t border-line bg-paper shadow-2xl md:static md:max-h-none md:w-96 md:border-t-0 md:border-l md:shadow-none"
    >
      <div className="flex items-start justify-between gap-2 p-4">
        <h2 className="font-serif text-xl font-semibold">{entityTitle(selection)}</h2>
        <button onClick={() => select(null)} aria-label="Close details" className="rounded p-1 text-ink-muted hover:bg-paper-2 hover:text-ink">
          ✕
        </button>
      </div>
    </aside>
  );
}
