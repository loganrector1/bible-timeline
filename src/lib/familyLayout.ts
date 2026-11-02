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
  const size = graph.graph();
  return { cards, unions: laidUnions, edges, width: size.width ?? 0, height: size.height ?? 0 };
}
