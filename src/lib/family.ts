import { data, genealogyById, peopleById } from "../data";
import type { GenealogyName, Person } from "../data/schema";

/**
 * The family tree: people and the names from the genealogies (`genealogy.json`) as one graph.
 * Parents link through a union (a couple, or a lone parent), so siblings hang from one point.
 * The tree is descent: a marriage with no children here (David and Michal) isn't drawn, since an
 * empty junction read as a mistake; the details panel lists spouses. `altParents`
 * (where Matthew and Luke name different fathers) link straight to the child, drawn dashed.
 */
export type Kin = { id: string; name: string; person?: Person; genealogy?: GenealogyName };

export function kinById(id: string): Kin | undefined {
  const person = peopleById.get(id);
  if (person) return { id, name: person.name, person };
  const genealogy = genealogyById.get(id);
  return genealogy && { id, name: genealogy.name, genealogy };
}

type Entry = { id: string; parents: string[]; altParents: string[] };
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
  return { unions, alt, links };
}

export const familyGraph = buildGraph();

/** Everyone related to `id` by any chain of parents and children (just `id` when it has none). */
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

/** Spouses, whichever side lists the marriage (Michal names David; David doesn't name her). */
export function spousesOf(id: string): string[] {
  const own = (peopleById.get(id) ?? genealogyById.get(id))?.spouses ?? [];
  const theirs = [...data.people, ...data.genealogy].filter((e) => e.spouses.includes(id)).map((e) => e.id);
  return [...new Set([...own, ...theirs])];
}

/** Children of a person or genealogy name, people and names alike. */
export function childrenOfKin(id: string): string[] {
  return entries.filter((e) => e.parents.includes(id)).map((e) => e.id);
}
