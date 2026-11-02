import dagre from "@dagrejs/dagre";
import { data, datesFor } from "../data";
import { specBounds } from "./dates";
import { familyGraph, familyOf, kinById, type FamilyGraph } from "./family";

/** Card size for a name: wide enough for its text at the tree's font size. */
export const CARD_H = 30;
/** Wide enough for the name, and a woman's ♀. */
const cardWidth = (name: string, female: boolean) => Math.max(56, Math.round(name.length * 7.4 + 22 + (female ? 12 : 0)));

export type LaidCard = { id: string; x: number; y: number; w: number; h: number };
export type LaidUnion = { id: string; x: number; y: number; parents: string[]; children: string[] };
export type LaidEdge = { from: string; to: string; points: { x: number; y: number }[]; alt?: boolean };
export type FamilyLayout = {
  cards: Map<string, LaidCard>;
  unions: LaidUnion[];
  edges: LaidEdge[];
  width: number;
  height: number;
};

/** Space between cards side by side, in a household or between neighbors in a row. */
const GAP = 14;

/**
 * Lays out the family `id` belongs to, top to bottom like the timeline: parents above their
 * union, children below it. Dagre ranks by edges, so a generation isn't a row: Luke's longer line
 * from David to Joseph stretches Matthew's beside it.
 *
 * Dagre doesn't know spouses belong together, and left to itself put Jochebed far from Amram,
 * across Judah's line, with lines crossing both ways. So each household (a couple, or Jacob with his
 * four wives: everyone joined by having children together) is one node, its cards side by side,
 * and families can't interleave. Within one, each person stands toward their parents and children.
 */
export function layoutFamily(id: string, g: FamilyGraph = familyGraph): FamilyLayout {
  const members = familyOf(id, g);
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: GAP, ranksep: 18, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  const unions = [...g.unions.values()].filter((u) => u.parents.every((p) => members.has(p)));
  // Households: people joined by a union's parents.
  const home = new Map<string, string>([...members].map((m) => [m, m]));
  const find = (m: string): string => (home.get(m) === m ? m : find(home.get(m)!));
  for (const u of unions) for (const p of u.parents.slice(1)) home.set(find(p), find(u.parents[0]));
  // In the data's order, whoever the tree was opened from: dagre's result depends on it.
  const order = [...data.people, ...data.genealogy].map((e) => e.id).filter((m) => members.has(m));
  const households = new Map<string, string[]>();
  for (const m of order) households.set(`h:${find(m)}`, [...(households.get(`h:${find(m)}`) ?? []), m]);
  const householdOf = (m: string) => `h:${find(m)}`;

  const width = new Map(order.map((m) => {
    const kin = kinById(m);
    return [m, cardWidth(kin?.name ?? m, !!kin?.female)];
  }));
  for (const [h, people] of households) {
    graph.setNode(h, { width: people.reduce((w, m) => w + width.get(m)!, 0) + GAP * (people.length - 1), height: CARD_H });
  }
  for (const u of unions) {
    graph.setNode(u.id, { width: 4, height: 4 });
    graph.setEdge(householdOf(u.parents[0]), u.id, { weight: 4 });
    for (const c of u.children) graph.setEdge(u.id, householdOf(c), { weight: 2 });
  }
  const alt = g.alt.filter(([p, c]) => members.has(p) && members.has(c));
  for (const [p, c] of alt) graph.setEdge(householdOf(p), householdOf(c), { weight: 1 });

  dagre.layout(graph);

  const laidUnions = unions.map((u) => ({ ...u, x: graph.node(u.id).x, y: graph.node(u.id).y }));
  const unionX = new Map(laidUnions.map((u) => [u.id, u.x]));
  // Each person's pull: where their parents' union and their own unions sit.
  const pull = (m: string) => {
    const xs = laidUnions.filter((u) => u.children.includes(m) || u.parents.includes(m)).map((u) => unionX.get(u.id)!);
    return xs.reduce((a, b) => a + b, 0) / xs.length;
  };
  const cards = new Map<string, LaidCard>();
  for (const [h, people] of households) {
    const n = graph.node(h);
    let x = n.x - n.width / 2;
    for (const m of [...people].sort((a, b) => pull(a) - pull(b))) {
      cards.set(m, { id: m, x: x + width.get(m)! / 2, y: n.y, w: width.get(m)!, h: CARD_H });
      x += width.get(m)! + GAP;
    }
  }

  // The lines drawn: each parent's card to its union, the union to each child's card, and the
  // other Gospel's fathers straight to the child. A long one keeps dagre's bends for its household.
  const bends = (v: string, w: string) => graph.edge(v, w)?.points ?? [];
  const edges: LaidEdge[] = [
    ...unions.flatMap((u) => [
      ...u.parents.map((p) => ({ from: p, to: u.id, points: bends(householdOf(p), u.id) })),
      ...u.children.map((c) => ({ from: u.id, to: c, points: bends(u.id, householdOf(c)) })),
    ]),
    ...alt.map(([p, c]) => ({ from: p, to: c, points: bends(householdOf(p), householdOf(c)), alt: true })),
  ];
  // A link to the next row is drawn without dagre's bend (`edgePath`), card edge to card edge, so
  // the untangling below measures it that way; a longer one runs from its own card's edge.
  const end = (id: string, side: 1 | -1) => {
    const c = cards.get(id);
    return c ? { x: c.x, y: c.y + (side * c.h) / 2 } : { x: unionX.get(id)!, y: graph.node(id).y };
  };
  for (const e of edges) {
    e.points = e.points.length <= 3 ? [end(e.from, 1), end(e.to, -1)] : [end(e.from, 1), ...e.points.slice(1, -1), end(e.to, -1)];
  }
  untangleLeaves(cards, laidUnions, edges);
  const size = graph.graph();
  const right = Math.max(size.width ?? 0, ...[...cards.values()].map((c) => c.x + c.w / 2 + 24));
  return { cards, unions: laidUnions, edges, width: right, height: size.height ?? 0 };
}

type P = { x: number; y: number };
const crosses = ([p1, p2]: [P, P], [p3, p4]: [P, P]) => {
  const d = (p: P, q: P, r: P) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return d(p3, p4, p1) * d(p3, p4, p2) < 0 && d(p1, p2, p3) * d(p1, p2, p4) < 0;
};
const segments = (pts: P[]) => pts.slice(1).map((p, i) => [pts[i], p] as [P, P]);

/**
 * Dagre's ordering is a heuristic, and sometimes leaves a child with no line below it on the side
 * where its link crosses another line (Josiah's son Jehoahaz across Luke's line). Such a child
 * moves to the mirror spot across its parents' union when that's free and crosses nothing.
 */
function untangleLeaves(cards: Map<string, LaidCard>, unions: LaidUnion[], edges: LaidEdge[]) {
  const hasLineBelow = new Set(edges.filter((e) => cards.has(e.from)).map((e) => e.from));
  for (const u of unions) {
    for (const id of u.children) {
      const card = cards.get(id)!;
      const edge = edges.find((e) => e.from === u.id && e.to === id);
      if (hasLineBelow.has(id) || !edge || edge.points.length > 3) continue;
      const others = edges.filter((e) => e !== edge).flatMap((e) => segments(e.points));
      const tangled = (x: number) => segments([{ x: u.x, y: u.y }, { x, y: card.y - card.h / 2 }]).some((s) => others.some((o) => crosses(s, o)));
      if (!tangled(card.x)) continue;
      const x = 2 * u.x - card.x;
      const free = [...cards.values()].every((c) => c === card || Math.abs(c.y - card.y) > 1 || Math.abs(c.x - x) > (c.w + card.w) / 2 + 14);
      if (!free || x - card.w / 2 < 0 || tangled(x)) continue;
      card.x = x;
      edge.points = [{ x: u.x, y: u.y }, { x, y: card.y - card.h / 2 }];
    }
  }
}

export type TreeTime = { yearAt: (y: number) => number; yAt: (year: number) => number };

/**
 * How the tree's rows line up with time, so it can follow the timeline: each dated person's row is
 * the year their dates start, and rows between are interpolated (for scrolling only; no date is
 * shown for them). Rows are generations, not years (Adam to Abraham is 20 rows over 2,000 years,
 * David to Jesus 28 or 43 over 1,000), so the scale changes as you go. Anchors that would run
 * backwards (a row placed above an earlier person) are skipped. Undefined with under two anchors:
 * such a tree (Peter's family) moves on its own.
 */
export function treeTime(layout: FamilyLayout, chron: string): TreeTime | undefined {
  const dated = [...layout.cards.values()]
    .flatMap((c) => {
      const person = kinById(c.id)?.person;
      const spec = person && datesFor(person, chron);
      return spec ? [{ y: c.y, year: specBounds(spec)[0] }] : [];
    })
    .sort((a, b) => a.y - b.y || a.year - b.year);
  const anchors: { y: number; year: number }[] = [];
  for (const a of dated) {
    const last = anchors.at(-1);
    if (!last || (a.y > last.y && a.year > last.year)) anchors.push(a);
  }
  if (anchors.length < 2) return undefined;
  const lerp = (from: "y" | "year", to: "y" | "year") => (v: number) => {
    // Past either end, the nearest segment's slope carries on.
    let i = anchors.findIndex((a) => a[from] >= v);
    i = i === -1 ? anchors.length - 1 : Math.max(1, i);
    const a = anchors[i - 1];
    const b = anchors[i];
    return a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  };
  return { yearAt: lerp("y", "year"), yAt: lerp("year", "y") };
}
