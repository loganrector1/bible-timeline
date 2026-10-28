import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

// OpenFreeMap: free vector tiles, no API key. Attribution is kept by the map control.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** Base layers that suit an ancient-world map: relief, water and land cover. */
const KEEP = /^(background|natural_earth|water$|waterway_river|landcover_(sand|wood|grass|ice|wetland)|water_name)/;
/** Modern borders are kept but hidden; the map offers a toggle. */
export const BORDER_LAYER = /^boundary_/;

let cached: Promise<StyleSpecification> | undefined;

function fetchStyle(): Promise<StyleSpecification> {
  cached ??= fetch(STYLE_URL).then((r) => {
    if (!r.ok) throw new Error(`Base map style failed to load (${r.status})`);
    return r.json();
  });
  return cached;
}

/** The base style with roads, buildings and modern place labels removed, themed for light or dark. */
export async function loadBaseStyle(dark: boolean): Promise<StyleSpecification> {
  const style = structuredClone(await fetchStyle());
  style.layers = style.layers
    .filter((l) => KEEP.test(l.id) || BORDER_LAYER.test(l.id))
    .map((l): LayerSpecification => {
      if (BORDER_LAYER.test(l.id)) return { ...l, layout: { ...l.layout, visibility: "none" } } as LayerSpecification;
      if (!dark) return l;
      if (l.type === "background") return { ...l, paint: { "background-color": "#27231d" } };
      if (l.type === "raster") {
        return { ...l, paint: { ...l.paint, "raster-brightness-max": 0.5, "raster-saturation": -0.4 } };
      }
      if (l.id === "water") return { ...l, paint: { ...l.paint, "fill-color": "#1d2a33" } } as LayerSpecification;
      if (l.type === "fill") return { ...l, paint: { ...l.paint, "fill-opacity": 0.15 } } as LayerSpecification;
      if (l.type === "symbol") {
        return { ...l, paint: { ...l.paint, "text-color": "#7f97a8", "text-halo-color": "#1d2a33" } } as LayerSpecification;
      }
      return l;
    });
  return style;
}
