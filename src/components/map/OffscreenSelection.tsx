import type { Map as MapLibreMap } from "maplibre-gl";
import { entityLocations, entityTitle } from "../../lib/entities";
import { useStore } from "../../state/store";
import { arrowToward, centroid, inView, useMapRedraw } from "./useMapView";

/**
 * When none of the selection's places is on the map, a chip points toward them;
 * clicking it frames them again. Hidden while the map is moving.
 */
export default function OffscreenSelection({ map, onShow }: { map: MapLibreMap | null; onShow: () => void }) {
  useMapRedraw(map);
  const selection = useStore((s) => s.selection);
  const chron = useStore((s) => s.chronologyId);
  if (!map || !selection || map.isMoving()) return null;

  const points = entityLocations(selection, chron).map((l) => map.project(l.coords as [number, number]));
  if (points.length === 0 || points.some((p) => inView(map, p))) return null;

  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const c = centroid(points);
  const title = entityTitle(selection);

  return (
    <button
      data-map-obstacle
      onClick={onShow}
      aria-label={`Show ${title} on the map`}
      className="absolute top-3 right-14 z-10 flex max-w-[calc(100%-12rem)] animate-appear-late items-center gap-1.5 rounded-full border border-accent bg-paper px-3 py-1 text-sm shadow-md hover:bg-accent-soft"
    >
      <span aria-hidden className="text-accent">{arrowToward(c.x - w / 2, c.y - h / 2)}</span>
      <span className="truncate">Show {title}</span>
    </button>
  );
}
