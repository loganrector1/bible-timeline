import { useEffect, useState } from "react";
import { datesFor, empiresById } from "../../data";
import type { Location } from "../../data/schema";
import { loadBorders, rulersOver, type Ruler } from "../../lib/borders";
import { formatDateSpec, formatYear, specBounds } from "../../lib/dates";
import { useStore } from "../../state/store";
import { Section } from "./parts";

/**
 * The powers that held a place, from their borders on the map: a place (Egypt the land,
 * Canaan, Jerusalem) is timeless, the powers over it change. The empires and Israel's own
 * states, each opening what its outline belongs to.
 */
export function RuledBy({ loc }: { loc: Location }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const select = useStore((s) => s.select);
  const [rulers, setRulers] = useState<Ruler[]>([]);
  useEffect(() => {
    let live = true;
    loadBorders()
      .then((all) => live && setRulers(rulersOver(all, loc.coords, chron)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [loc.coords, chron]);
  if (rulers.length === 0) return null;
  // Held when the outlines stop, though the empire went on (Rome's are drawn only to AD 200).
  const stillHeld = (r: Ruler) => {
    const spec = r.open && r.target?.kind === "empire" && datesFor(empiresById.get(r.target.id) ?? {}, chron);
    return !!spec && r.to < specBounds(spec)[1];
  };

  return (
    <Section title="Ruled by">
      <ol className="space-y-0.5">
        {rulers.map((r) => {
          const row = (
            <>
              <span className={r.target ? "hover:text-accent" : undefined}>{r.name}</span>
              <span className="shrink-0 text-xs text-ink-muted tabular-nums">
                {stillHeld(r) ? `from ${formatYear(r.from, eraStyle)}` : formatDateSpec({ start: { year: r.from }, end: { year: r.to - 1 }, confidence: "approx" }, eraStyle, { yearsOnly: true })}
              </span>
            </>
          );
          const cls = "flex w-full items-baseline justify-between gap-3 rounded px-1.5 py-1 text-left text-sm";
          return (
            <li key={`${r.name}@${r.from}`}>
              {r.target ? (
                <button onClick={() => select(r.target!)} className={`${cls} hover:bg-paper-2`}>
                  {row}
                </button>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-1 text-xs text-ink-muted">From the borders on the map, which are approximate.</p>
    </Section>
  );
}
