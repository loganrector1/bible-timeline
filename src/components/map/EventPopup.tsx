import type { Map as MapLibreMap } from "maplibre-gl";
import { useLayoutEffect, useRef, useState } from "react";
import { datesFor, locationsById } from "../../data";
import type { Event } from "../../data/schema";
import { formatDateSpec } from "../../lib/dates";
import { eventLocations } from "../../lib/entities";
import { routePath } from "../../lib/journeys";
import { useStore } from "../../state/store";
import { arrowToward, centroid, inView, useMapRedraw, type Point } from "./useMapView";
import { Prose } from "../ScriptureText";

const MARGIN = 12;
/** Space between the popup and the place it describes. */
const GAP = 16;
/** Journeys are sampled about this often (px) so a route crossing the view counts as visible. */
const SAMPLE_PX = 16;

/** Everything the event draws, in screen space: its places, regions, and points along its route. */
function eventPoints(map: MapLibreMap, ev: Event): Point[] {
  const project = (c: number[]) => map.project(c as [number, number]);
  const points: Point[] = [...eventLocations(ev), ...ev.regions.map((id) => locationsById.get(id)!)].map((l) => project(l.coords));
  if (ev.journeyId) {
    const route = routePath(ev.journeyId).map(project);
    for (let i = 1; i < route.length; i++) {
      const [a, b] = [route[i - 1], route[i]];
      const n = Math.min(100, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / SAMPLE_PX));
      for (let k = 1; k < n; k++) points.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return points;
}

/** Map panels and controls the popup shouldn't cover. */
const OBSTACLES = "[data-map-obstacle], .maplibregl-ctrl-top-right, .maplibregl-ctrl-bottom-right";

type Box = { left: number; top: number; right: number; bottom: number };

/** Whether two boxes overlap, counting anything within `slack` px as touching. */
const hits = (a: Box, b: Box, slack = 0) =>
  a.left < b.right + slack && a.right > b.left - slack && a.top < b.bottom + slack && a.bottom > b.top - slack;

/**
 * A card for the map's focus event, placed beside what it describes without moving the
 * map: next to the visible part nearest its middle, or, when it's all off screen, at the
 * edge nearest it with an arrow pointing the way. Clicking it selects the event; its close
 * button hides it.
 */
export default function EventPopup({ map, ev, onClose }: { map: MapLibreMap | null; ev: Event; onClose: () => void }) {
  useMapRedraw(map);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const select = useStore((s) => s.select);
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 240, h: 100 });

  // The card's height depends on its text; measure it after each render.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.offsetWidth !== size.w || el.offsetHeight !== size.h)) setSize({ w: el.offsetWidth, h: el.offsetHeight });
  });

  if (!map) return null;
  const points = eventPoints(map, ev);
  if (points.length === 0) return null;

  const container = map.getContainer();
  const { clientWidth: W, clientHeight: H } = container;
  const { w, h } = size;
  const place = (x: number, y: number): Box => {
    const left = Math.min(Math.max(x, MARGIN), W - w - MARGIN);
    const top = Math.min(Math.max(y, MARGIN), H - h - MARGIN);
    return { left, top, right: left + w, bottom: top + h };
  };

  // The map's own panels and controls, in the map's coordinates.
  const origin = container.getBoundingClientRect();
  const obstacles: Box[] = [...(container.parentElement?.querySelectorAll(OBSTACLES) ?? [])]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > 0)
    .map((r) => ({ left: r.left - origin.left, top: r.top - origin.top, right: r.right - origin.left, bottom: r.bottom - origin.top }));
  // Place labels hang below their dots.
  const labels: Box[] = eventLocations(ev).map((l) => {
    const p = map.project(l.coords as [number, number]);
    return { left: p.x - 45, right: p.x + 45, top: p.y - 8, bottom: p.y + 24 };
  });
  // Lower is better: covering a control is worst, then the event's places and their
  // labels, then its route; staying near the middle of what's visible breaks ties.
  const covered = (b: Box) =>
    obstacles.filter((o) => hits(o, b)).length * 1000 +
    labels.filter((l) => hits(l, b)).length * 10 +
    points.filter((p) => hits(b, { left: p.x, right: p.x, top: p.y, bottom: p.y }, 6)).length;

  const visible = points.filter((p) => inView(map, p, MARGIN));
  let candidates: Box[];
  let cost = covered;
  if (visible.length > 0) {
    // Beside some visible part (right, left, below or above), preferring parts near the
    // middle of what's visible.
    const c = centroid(visible);
    const step = Math.max(1, Math.floor(visible.length / 24));
    const anchors = visible.filter((_, i) => i % step === 0);
    candidates = anchors.flatMap((a) => [
      place(a.x + GAP, a.y - h / 2),
      place(a.x - GAP - w, a.y - h / 2),
      place(a.x - w / 2, a.y + GAP),
      place(a.x - w / 2, a.y - GAP - h),
    ]);
    const spread = Math.hypot(W, H);
    cost = (b) => covered(b) + Math.hypot((b.left + b.right) / 2 - c.x, (b.top + b.bottom) / 2 - c.y) / spread;
  } else {
    // All off screen: at the edge nearest it.
    const c = centroid(points);
    candidates = [place(c.x - w / 2, c.y - h / 2)];
  }
  // Variants that step out from under any control a candidate covers.
  for (const b of [...candidates]) {
    for (const o of obstacles.filter((o) => hits(o, b))) {
      candidates.push(place(b.left, o.bottom + 8), place(b.left, o.top - h - 8), place(o.right + 8, b.top), place(o.left - w - 8, b.top));
    }
  }
  const best = candidates.reduce((x, y) => (cost(y) < cost(x) ? y : x));
  const { left, top } = best;
  let arrow: string | undefined;
  if (visible.length === 0) {
    const c = centroid(points);
    arrow = arrowToward(c.x - (left + w / 2), c.y - (top + h / 2));
  }

  const spec = datesFor(ev, chron);
  return (
    <div ref={ref} className="absolute z-10 w-60 max-w-[60%]" style={{ left, top }}>
      <button
        onClick={() => select({ kind: "event", id: ev.id })}
        className="block w-full rounded-lg border border-line bg-paper/95 px-3 py-2 text-left text-sm shadow-lg backdrop-blur hover:border-accent"
      >
        <span className="flex items-start justify-between gap-2 pr-5">
          <span className="font-serif text-base leading-tight font-semibold">{ev.title}</span>
          {arrow && (
            <span className="shrink-0 text-accent" aria-label="Off screen in this direction">
              {arrow}
            </span>
          )}
        </span>
        {spec && <span className="mt-0.5 block text-xs font-medium text-accent">{formatDateSpec(spec, eraStyle)}</span>}
        <span className="mt-1 line-clamp-2 text-ink-muted"><Prose text={ev.summary} /></span>
        <span className="mt-1 block text-xs font-medium text-accent">Details →</span>
      </button>
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-1 right-1 flex size-6 items-center justify-center rounded text-base leading-none text-ink-muted hover:bg-paper-2 hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
