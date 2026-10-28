import { Layer, Source } from "react-map-gl/maplibre";
import { data } from "../../data";
import type { MapColors } from "./mapColors";

export const REGION_FILL_LAYER = "regions-fill";

/**
 * Region outlines, shown only when relevant: strong for the selection or the region
 * under the pointer, lighter for the focus event's regions. Hidden outlines still have
 * their label (see EventLayer), which can be hovered or clicked.
 */
export default function RegionLayer({
  selected, focus, hovered, colors,
}: { selected: Set<string>; focus: Set<string>; hovered?: string; colors: MapColors }) {
  const strength = ["case",
    ["any", ["in", ["get", "id"], ["literal", [...selected]]], ["==", ["get", "id"], hovered ?? ""]], 2,
    ["in", ["get", "id"], ["literal", [...focus]]], 1,
    0,
  ];

  return (
    <Source id="regions" type="geojson" data={data.regions as GeoJSON.FeatureCollection}>
      <Layer
        id={REGION_FILL_LAYER}
        type="fill"
        filter={[">", strength, 0] as never}
        paint={{
          "fill-color": colors.accent,
          "fill-opacity": ["match", strength, 2, 0.16, 0.08] as never,
        }}
      />
      <Layer
        id="regions-line"
        type="line"
        filter={[">", strength, 0] as never}
        paint={{
          "line-color": colors.accent,
          "line-width": ["match", strength, 2, 2, 1.25] as never,
          "line-opacity": ["match", strength, 2, 0.85, 0.45] as never,
          "line-dasharray": [3, 2],
        }}
      />
    </Source>
  );
}
