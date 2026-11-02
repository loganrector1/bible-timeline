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

/**
 * Lays out the family `id` belongs to, top to bottom like the timeline: parents above their
 * union, children below it. Dagre ranks by edges, so a generation isn't a row: Luke's longer line
 * from David to Joseph stretches Matthew's beside it.
 */
export function layoutFamily(id: string, g: FamilyGraph = familyGraph): FamilyLayout {
  const members = familyOf(id, g);
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "TB", nodesep: 14, ranksep: 18, marginx: 24, marginy: 24 });
  graph.setDefaultEdgeLabel(() => ({}));

  // In the data's order, whoever the tree was opened from: dagre's result depends on it.
  const order = [...data.people, ...data.genealogy].map((e) => e.id).filter((m) => members.has(m));
  for (const m of order) {
    const kin = kinById(m);
    graph.setNode(m, { width: cardWidth(kin?.name ?? m, !!kin?.female), height: CARD_H });
  }
  const unions = [...g.unions.values()].filter((u) => u.parents.every((p) => members.has(p)));
  for (const u of unions) {
    graph.setNode(u.id, { width: 4, height: 4 });
    for (const p of u.parents) graph.setEdge(p, u.id, { weight: 4 });
    for (const c of u.children) graph.setEdge(u.id, c, { weight: 2 });
  }
  const alt = g.alt.filter(([p, c]) => members.has(p) && members.has(c));
  for (const [p, c] of alt) graph.setEdge(p, c, { weight: 1 });

  dagre.layout(graph);

  const cards = new Map<string, LaidCard>();
  for (const m of members) {
    const n = graph.node(m);
    cards.set(m, { id: m, x: n.x, y: n.y, w: n.width, h: n.height });
  }
  const laidUnions = unions.map((u) => ({ ...u, x: graph.node(u.id).x, y: graph.node(u.id).y }));
  const edges: LaidEdge[] = graph.edges().map((e) => ({
    from: e.v,
    to: e.w,
    points: graph.edge(e).points ?? [],
    alt: !e.v.startsWith("u:") && !e.w.startsWith("u:"),
  }));
  // A link to the next row is drawn without dagre's bend (`edgePath`), card edge to card edge, so
  // the untangling below measures it that way.
  const end = (id: string, side: 1 | -1) => {
    const c = cards.get(id);
    return c ? { x: c.x, y: c.y + (side * c.h) / 2 } : laidUnions.find((u) => u.id === id)!;
  };
  for (const e of edges) {
    if (e.points.length <= 3) e.points = [end(e.from, 1), end(e.to, -1)].map(({ x, y }) => ({ x, y }));
  }
  untangleSpouses(cards, laidUnions, edges);
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

/**
 * The same for a spouse who is only that (no parents here, no other marriage: Hagar) with a union
 * whose children have no line below them (Ishmael): the group moves to the other side of the other
 * parent (Abraham), mirrored and then drawn in beside them, when the spots are free and it crosses
 * fewer lines there.
 */
function untangleSpouses(cards: Map<string, LaidCard>, unions: LaidUnion[], edges: LaidEdge[]) {
  const hasLineBelow = new Set(edges.filter((e) => cards.has(e.from)).map((e) => e.from));
  const hasLineAbove = new Set(edges.filter((e) => cards.has(e.to) || e.alt).map((e) => e.to));
  for (const u of unions) {
    if (u.parents.length !== 2 || u.children.some((c) => hasLineBelow.has(c))) continue;
    for (const [spouse, other] of [u.parents, [...u.parents].reverse()]) {
      const marriages = unions.filter((v) => v.parents.includes(spouse)).length;
      if (hasLineAbove.has(spouse) || marriages !== 1) continue;
      const axis = cards.get(other)!.x;
      const group = [spouse, u.id, ...u.children];
      // Mirrored across the other parent, then shifted in so the spouse stands right beside them.
      const near = (cards.get(other)!.w + cards.get(spouse)!.w) / 2 + 14;
      const side = Math.sign(axis - cards.get(spouse)!.x);
      const shift = 2 * axis - cards.get(spouse)!.x - (axis + side * near);
      const flipX = (x: number) => 2 * axis - x - shift;
      const mine = edges.filter((e) => group.includes(e.from) || group.includes(e.to));
      const rest = edges.filter((e) => !mine.includes(e)).flatMap((e) => segments(e.points));
      const tangles = (es: P[][]) => es.flatMap(segments).filter((s) => rest.some((o) => crosses(s, o))).length;
      // Each moved card and the union, mirrored; the lines between them redrawn straight.
      // A card's line leaves its bottom edge and arrives at its top.
      const at = (id: string, flip: boolean, side: 1 | -1) => {
        const card = cards.get(id);
        const c = card ?? unions.find((v) => v.id === id)!;
        return { x: flip && group.includes(id) ? flipX(c.x) : c.x, y: c.y + (card ? (side * card.h) / 2 : 0) };
      };
      const lines = (flip: boolean) => mine.map((e) => {
        const a = at(e.from, flip, 1);
        const b = at(e.to, flip, -1);
        return [a, b];
      });
      const before = tangles(mine.map((e) => e.points));
      if (before === 0 || tangles(lines(true)) >= before) continue;
      const free = group.filter((id) => cards.has(id)).every((id) => {
        const card = cards.get(id)!;
        const x = flipX(card.x);
        return x - card.w / 2 >= 0 && [...cards.values()].every((c) =>
          group.includes(c.id) || Math.abs(c.y - card.y) > 1 || Math.abs(c.x - x) >= (c.w + card.w) / 2 + 14 - 0.5);
      });
      if (!free) continue;
      const moved = lines(true);
      mine.forEach((e, i) => (e.points = moved[i]));
      for (const id of group) {
        const c = cards.get(id) ?? u;
        c.x = flipX(c.x);
      }
      break;
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
