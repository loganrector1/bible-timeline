import dagre from "@dagrejs/dagre";
import { familyGraph, familyOf, kinById, type FamilyGraph } from "./family";

/** Card size for a name: wide enough for its text at the tree's font size. */
export const CARD_H = 30;
const cardWidth = (name: string) => Math.max(56, Math.round(name.length * 7.4 + 22));

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

  for (const m of members) {
    graph.setNode(m, { width: cardWidth(kinById(m)?.name ?? m), height: CARD_H });
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
      const tangled = (x: number) => segments([{ x: u.x, y: u.y }, { x, y: card.y }]).some((s) => others.some((o) => crosses(s, o)));
      if (!tangled(card.x)) continue;
      const x = 2 * u.x - card.x;
      const free = [...cards.values()].every((c) => c === card || Math.abs(c.y - card.y) > 1 || Math.abs(c.x - x) > (c.w + card.w) / 2 + 14);
      if (!free || x - card.w / 2 < 0 || tangled(x)) continue;
      card.x = x;
      edge.points = [{ x: u.x, y: u.y }, { x, y: (u.y + card.y) / 2 }, { x, y: card.y }];
    }
  }
}
