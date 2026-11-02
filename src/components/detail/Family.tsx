import { childrenOfKin, hasFamily, kinById, spousesOf } from "../../lib/family";
import { useStore } from "../../state/store";
import { Chip, Note, Section } from "./parts";

/**
 * A person's or genealogy name's parents (both Gospels' fathers, where they differ), spouses and
 * children, people and names alike, with a way into the family tree.
 */
export function Family({ id }: { id: string }) {
  const setFamilyTree = useStore((s) => s.setFamilyTree);
  const treeOnThem = useStore((s) => s.familyTree === id);
  const kin = kinById(id);
  const entry = kin?.person ?? kin?.genealogy;
  if (!entry) return null;
  const groups = [
    { label: "Parents", ids: [...entry.parents, ...entry.altParents] },
    { label: "Spouses", ids: spousesOf(id) },
    { label: "Children", ids: childrenOfKin(id) },
  ].filter((g) => g.ids.length > 0);
  const note = kin?.person?.familyNote;
  if (groups.length === 0 && !note) return null;

  return (
    <Section title="Family">
      <dl className="space-y-1.5">
        {groups.map((g) => (
          <div key={g.label} className="flex items-baseline gap-2">
            <dt className="w-16 shrink-0 text-sm text-ink-muted">{g.label}</dt>
            <dd className="flex flex-wrap gap-1.5">
              {g.ids.map((k) => <Chip key={k} to={{ kind: kinById(k)?.person ? "person" : "name", id: k }} />)}
            </dd>
          </div>
        ))}
      </dl>
      {note && <Note>{note}</Note>}
      {hasFamily(id) && !treeOnThem && (
        <button onClick={() => setFamilyTree(id)} className="mt-2 text-sm text-accent hover:underline">
          Show in the family tree
        </button>
      )}
    </Section>
  );
}
