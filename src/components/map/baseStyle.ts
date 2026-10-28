import type { LayerSpecification, RasterDEMSourceSpecification, StyleSpecification } from "maplibre-gl";

// OpenFreeMap: free vector tiles, no API key. Attribution is kept by the map control.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Base layers that suit an ancient-world map: shaded relief and water. OSM land cover
 * (sand, wood, grass) is left out: it's today's land use, mapped unevenly from country
 * to country, so it showed patches that mean nothing for the ancient world.
 */
const KEEP = /^(background|natural_earth|water$|waterway_river|water_name)/;
/** Modern borders are kept but hidden; the map offers a toggle. */
export const BORDER_LAYER = /^boundary_/;

/**
 * Elevation tiles (Terrarium encoding) from the AWS open-data terrain set: free, no key.
 * MapLibre shades them itself, so terrain stays sharp at every zoom, unlike the Natural
 * Earth relief image, which only exists down to zoom 6 and is stretched beyond that.
 */
const TERRAIN_SOURCE: RasterDEMSourceSpecification = {
  type: "raster-dem",
  tiles: ["https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"],
  encoding: "terrarium",
  tileSize: 256,
  maxzoom: 12,
  attribution: '<a href="https://registry.opendata.aws/terrain-tiles/">Terrain Tiles</a>',
};

/** Hillshade fades in as the Natural Earth image starts to blur. */
function hillshadeLayer(dark: boolean): LayerSpecification {
  return {
    id: "hillshade",
    type: "hillshade",
    source: "terrain",
    paint: {
      "hillshade-exaggeration": ["interpolate", ["linear"], ["zoom"], 4, 0, 6.5, dark ? 0.45 : 0.35],
      "hillshade-shadow-color": dark ? "#0b0906" : "#6b5a45",
      "hillshade-highlight-color": dark ? "#6a604f" : "#ffffff",
      "hillshade-accent-color": dark ? "#0b0906" : "#6b5a45",
    },
  };
}

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
      // The style hides the relief image past zoom 7. Keep it as a faint colour wash
      // (desert vs. green) under the sharp hillshade instead.
      if (l.type === "raster") {
        l = { ...l, maxzoom: 24, paint: { ...l.paint, "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 7, 0.3] } };
      }
      if (!dark) return l;
      if (l.type === "background") return { ...l, paint: { "background-color": "#27231d" } };
      if (l.type === "raster") {
        return { ...l, paint: { ...l.paint, "raster-brightness-max": 0.5, "raster-saturation": -0.4 } };
      }
      if (l.id === "water") return { ...l, paint: { ...l.paint, "fill-color": "#1d2a33" } } as LayerSpecification;
      if (l.type === "symbol") {
        return { ...l, paint: { ...l.paint, "text-color": "#7f97a8", "text-halo-color": "#1d2a33" } } as LayerSpecification;
      }
      return l;
    });
  style.sources.terrain = TERRAIN_SOURCE;
  const relief = style.layers.findIndex((l) => l.id === "natural_earth");
  style.layers.splice(relief + 1, 0, hillshadeLayer(dark));
  return style;
}
