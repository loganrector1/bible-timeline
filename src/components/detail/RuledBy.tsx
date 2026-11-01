import { useEffect, useState } from "react";
import { datesFor, empiresById } from "../../data";
import type { Location } from "../../data/schema";
import { empiresOver, loadBorders } from "../../lib/borders";
import { formatDateSpec, formatYear, specBounds } from "../../lib/dates";
import { useStore } from "../../state/store";
import { Section } from "./parts";

/**
 * The empires that held a place, from their borders on the map: a place (Egypt the land,
 * Canaan, Jerusalem) is timeless, the powers over it change. Each links to its empire.
 */
export function RuledBy({ loc }: { loc: Location }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const select = useStore((s) => s.select);
  const [rulers, setRulers] = useState<ReturnType<typeof empiresOver>>([]);
  useEffect(() => {
    let live = true;
    loadBorders()
      .then((all) => live && setRulers(empiresOver(all, loc.coords, chron)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [loc.coords, chron]);
  if (rulers.length === 0) return null;
  // Held when the outlines stop, though the empire went on (Rome's are drawn only to AD 200).
  const stillHeld = (r: (typeof rulers)[number]) => {
    const spec = r.open && datesFor(empiresById.get(r.empire) ?? {}, chron);
    return !!spec && r.to < specBounds(spec)[1];
  };

  return (
    <Section title="Ruled by">
      <ol className="space-y-0.5">
        {rulers.map((r) => (
          <li key={`${r.empire}@${r.from}`}>
            <button
              onClick={() => select({ kind: "empire", id: r.empire })}
              className="flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-1 text-left text-sm hover:bg-paper-2"
            >
              <span className="hover:text-accent">
                {empiresById.get(r.empire)?.name ?? r.empire}
                {r.overlord && <span className="text-ink-muted"> · overlord</span>}
              </span>
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {stillHeld(r) ? `from ${formatYear(r.from, eraStyle)}` : formatDateSpec({ start: { year: r.from }, end: { year: r.to - 1 }, confidence: "approx" }, eraStyle, { yearsOnly: true })}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-xs text-ink-muted">From the empires&rsquo; borders on the map, which are approximate.</p>
    </Section>
  );
}
