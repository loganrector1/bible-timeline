import type { GenealogyName } from "../../data/schema";
import { Family } from "./Family";
import { ScriptureList } from "./parts";

/**
 * A name from the genealogies: no events, dates or places of its own, just where Scripture names
 * it, how it's related, and a note where the Gospels or the manuscripts differ.
 */
export default function NameDetail({ name }: { name: GenealogyName }) {
  return (
    <>
      <p className="text-sm text-ink-muted">Known only from the genealogies.</p>
      {name.note && <p className="mt-4 leading-relaxed">{name.note}</p>}
      <Family id={name.id} />
      <ScriptureList refs={name.scripture} />
    </>
  );
}
