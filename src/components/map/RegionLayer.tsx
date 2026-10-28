import { Layer, Source } from "react-map-gl/maplibre";
import { data } from "../../data";
import type { MapColors } from "./mapColors";

/** Region outlines: strong for the selection, faint for whatever is happening now. */
export default function RegionLayer({
  selected, active, colors,
}: { selected: Set<string>; active: Set<string>; colors: MapColors }) {
  const strength = ["case",
    ["in", ["get", "id"], ["literal", [...selected]]], 2,
    ["in", ["get", "id"], ["literal", [...active]]], 1,
    0,
  ];

  return (
    <Source id="regions" type="geojson" data={data.regions as GeoJSON.FeatureCollection} promoteId="id">
      <Layer
        id="regions-fill"
        type="fill"
        filter={[">", strength, 0] as never}
        paint={{
          "fill-color": colors.accent,
          "fill-opacity": ["match", strength, 2, 0.2, 0.07] as never,
        }}
      />
      <Layer
        id="regions-line"
        type="line"
        filter={[">", strength, 0] as never}
        paint={{
          "line-color": colors.accent,
          "line-width": 1.5,
          "line-opacity": ["match", strength, 2, 0.8, 0.3] as never,
          "line-dasharray": [3, 2],
        }}
      />
    </Source>
  );
}
