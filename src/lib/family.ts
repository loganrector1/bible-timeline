import { data, genealogyById, peopleById } from "../data";
import type { GenealogyName, Person } from "../data/schema";

/**
 * The family tree: people and the names from the genealogies (`genealogy.json`) as one graph.
 * Parents link through a union (a couple, or a lone parent), so siblings hang from one point;
 * spouses with no children here still get a union, which ties them together. `altParents`
 * (where Matthew and Luke name different fathers) link straight to the child, drawn dashed.
 */
export type Kin = { id: string; name: string; person?: Person; genealogy?: GenealogyName };

export function kinById(id: string): Kin | undefined {
  const person = peopleById.get(id);
  if (person) return { id, name: person.name, person };
  const genealogy = genealogyById.get(id);
  return genealogy && { id, name: genealogy.name, genealogy };
}

type Entry = { id: string; parents: string[]; altParents: string[]; spouses: string[] };
const entries: Entry[] = [...data.people, ...data.genealogy];

/** The union a child hangs from: its parents, sorted, joined. */
const unionId = (parents: string[]) => `u:${[...parents].sort().join("+")}`;

export type Union = { id: string; parents: string[]; children: string[] };
export type FamilyGraph = {
  unions: Map<string, Union>;
  /** Alternate fathers' links, parent to child. */
  alt: [string, string][];
  /** Each id's neighbours, for finding its family. */
  links: Map<string, Set<string>>;
};

function buildGraph(): FamilyGraph {
  const unions = new Map<string, Union>();
  const alt: [string, string][] = [];
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!links.has(x)) links.set(x, new Set());
      links.get(x)!.add(y);
    }
  };
  const union = (parents: string[]) => {
    const id = unionId(parents);
    if (!unions.has(id)) unions.set(id, { id, parents: [...parents].sort(), children: [] });
    return unions.get(id)!;
  };
  for (const e of entries) {
    if (e.parents.length) union(e.parents).children.push(e.id);
    for (const p of e.parents) link(p, e.id);
    for (const p of e.altParents) {
      alt.push([p, e.id]);
      link(p, e.id);
    }
  }
  // Spouses with no children of their own here (Moses and Zipporah have Gershom; David and
  // Michal have none) still stand together.
  for (const e of entries) {
    for (const s of e.spouses) {
      link(e.id, s);
      const pair = [e.id, s];
      if (!unions.has(unionId(pair))) union(pair);
    }
  }
  return { unions, alt, links };
}

export const familyGraph = buildGraph();

/** Everyone related to `id` by any chain of parents and spouses (just `id` when it has none). */
export function familyOf(id: string, g = familyGraph): Set<string> {
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    for (const next of g.links.get(stack.pop()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

/** Whether a person has a family tree to show. */
export const hasFamily = (id: string) => (familyGraph.links.get(id)?.size ?? 0) > 0;

/** `id` and all its ancestors, through either Gospel's line. */
export function lineOf(id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    const e = peopleById.get(x) ?? genealogyById.get(x);
    if (e) stack.push(...e.parents, ...e.altParents);
  }
  return seen;
}

/** Children of a person or genealogy name, people and names alike. */
export function childrenOfKin(id: string): string[] {
  return entries.filter((e) => e.parents.includes(id)).map((e) => e.id);
}
