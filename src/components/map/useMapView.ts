import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useState } from "react";

export type Point = { x: number; y: number };

/** Re-renders the caller as the map moves or resizes, for overlays placed in screen space. */
export function useMapRedraw(map: MapLibreMap | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!map) return;
    const bump = () => setTick((t) => t + 1);
    for (const e of ["move", "moveend", "resize"] as const) map.on(e, bump);
    return () => {
      for (const e of ["move", "moveend", "resize"] as const) map.off(e, bump);
    };
  }, [map]);
}

export function centroid(points: Point[]): Point {
  const n = points.length;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];

/** The arrow pointing along (dx, dy) in screen space (y grows downward). */
export function arrowToward(dx: number, dy: number): string {
  return ARROWS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}

/** Whether a screen point lies inside the map, at least `margin` from every edge. */
export function inView(map: MapLibreMap, p: Point, margin = 0): boolean {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  return p.x >= margin && p.x <= w - margin && p.y >= margin && p.y <= h - margin;
}
