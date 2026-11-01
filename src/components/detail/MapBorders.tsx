import { useEffect, useState } from "react";
import type { EntityRef } from "../../data";
import type { BorderFeature } from "../../data/schema";
import { borderOf, borderYears, loadBorders } from "../../lib/borders";
import { formatDateSpec } from "../../lib/dates";
import { useStore } from "../../state/store";
import { Section } from "./parts";

/**
 * Where an empire's (or a king's, or an era's) borders on the map come from and how sure they
 * are: one line for Cliopatria's snapshots, and each hand-drawn outline's note.
 */
export function MapBorders({ of }: { of: EntityRef }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const [outlines, setOutlines] = useState<BorderFeature[]>([]);
  useEffect(() => {
    let live = true;
    loadBorders()
      .then((all) => live && setOutlines(all.filter((f) => borderOf(f, of))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [of.kind, of.id]);
  if (outlines.length === 0) return null;

  const years = (from: number, to: number) =>
    formatDateSpec({ start: { year: from }, end: { year: to - 1 }, confidence: "approx" }, eraStyle, { yearsOnly: true });
  const span = (fs: BorderFeature[]) => {
    const ys = fs.map((f) => borderYears(f, chron));
    return years(Math.min(...ys.map((y) => y[0])), Math.max(...ys.map((y) => y[1])));
  };
  const clio = outlines.filter((f) => !f.properties.note);
  // Outlines sharing a note (the tribes' allotments) are named together.
  const byNote = new Map<string, BorderFeature[]>();
  for (const f of outlines) {
    const note = f.properties.note;
    if (note) byNote.set(note, [...(byNote.get(note) ?? []), f]);
  }
  const drawn = [...byNote.values()];

  return (
    <Section title="Borders on the map">
      <div className="space-y-2 text-sm leading-relaxed text-ink-muted">
        {clio.length > 0 && (
          <p>
            {clio.length === 1 ? "One outline" : `${clio.length} outlines`}, {span(clio)}, from{" "}
            <a href="https://github.com/Seshat-Global-History-Databank/cliopatria" target="_blank" rel="noreferrer" className="underline hover:text-accent">
              Cliopatria
            </a>
            . Ancient borders are approximate, and the map shows them changing in steps.
          </p>
        )}
        {drawn.map((fs) => (
          <p key={fs[0].properties.id}>
            <span className="font-medium text-ink">{listNames(fs.map((f) => f.properties.name))}</span>, {span(fs)}: {fs[0].properties.note}
          </p>
        ))}
      </div>
    </Section>
  );
}

/** "Judah, Simeon and Dan". */
function listNames(names: string[]) {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
