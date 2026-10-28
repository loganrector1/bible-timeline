import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { data, regionsById } from "../../data";
import { JOURNEY_BASE_LAYER } from "./JourneyLayer";
import type { MapColors } from "./mapColors";

export const LOCATION_LAYER = "locations-circle";
export const REGION_LABEL_LAYER = "region-labels";

/**
 * Places, styled by state: 2 = selected or the focus event's, 1 = an event is happening
 * there now, 0 = everything else (small, labelled only when zoomed in). Places drawn as an
 * outline (regions) get a spaced capital label instead of a dot. Alternate candidate
 * sites are shown for selected places whose location is disputed.
 */
export default function EventLayer({
  selected, active, colors,
}: { selected: Set<string>; active: Set<string>; colors: MapColors }) {
  const places = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: data.locations.flatMap((loc) => {
      const state = selected.has(loc.id) ? 2 : active.has(loc.id) ? 1 : 0;
      const kind = regionsById.has(loc.id) ? "region" : "site";
      const site = {
        type: "Feature" as const,
        properties: { id: loc.id, name: loc.uncertain ? `${loc.name} ?` : loc.name, state, kind },
        geometry: { type: "Point" as const, coordinates: loc.coords },
      };
      const alternates = state === 2
        ? loc.alternateSites.map((alt) => ({
            type: "Feature" as const,
            properties: { id: loc.id, name: `${alt.name} (alt.)`, state: -1, kind: "site" },
            geometry: { type: "Point" as const, coordinates: alt.coords },
          }))
        : [];
      return [site, ...alternates];
    }),
  }), [selected, active]);

  return (
    <Source id="locations" type="geojson" data={places}>
      <Layer
        id={REGION_LABEL_LAYER}
        type="symbol"
        filter={["==", ["get", "kind"], "region"]}
        layout={{
          "text-field": ["upcase", ["get", "name"]],
          "text-font": ["Noto Sans Regular"],
          "text-size": ["match", ["get", "state"], 0, 11, 13],
          "text-letter-spacing": 0.18,
          "text-max-width": 8,
        }}
        paint={{
          "text-color": ["match", ["get", "state"], 2, colors.accent, 1, colors.ink, colors.muted],
          "text-halo-color": colors.halo,
          "text-halo-width": 1.5,
        }}
      />
      <Layer
        id={LOCATION_LAYER}
        type="circle"
        // Beneath the journey, so a stop's number isn't hidden by the place's own dot.
        beforeId={JOURNEY_BASE_LAYER}
        filter={["==", ["get", "kind"], "site"]}
        layout={{ "circle-sort-key": ["get", "state"] }}
        paint={{
          "circle-radius": ["match", ["get", "state"], 2, 7, 1, 6, -1, 5, 3.5],
          "circle-color": ["match", ["get", "state"], 2, colors.accent, 1, colors.ink, -1, "rgba(0,0,0,0)", colors.muted],
          "circle-opacity": ["match", ["get", "state"], 0, 0.7, 1],
          "circle-stroke-color": ["match", ["get", "state"], -1, colors.accent, colors.halo],
          "circle-stroke-width": ["match", ["get", "state"], -1, 2, 1.5],
        }}
      />
      {/* MapLibre places labels from the top layer down, so the event labels above win collisions. */}
      <Layer
        id="locations-label-base"
        type="symbol"
        minzoom={5.5}
        filter={["all", ["==", ["get", "kind"], "site"], ["==", ["get", "state"], 0]]}
        layout={{ "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 11, "text-offset": [0, 0.8], "text-anchor": "top" }}
        paint={{ "text-color": colors.muted, "text-halo-color": colors.halo, "text-halo-width": 1.2 }}
      />
      <Layer
        id="locations-label"
        type="symbol"
        filter={["all", ["==", ["get", "kind"], "site"], ["!=", ["get", "state"], 0]]}
        layout={{
          "text-field": ["get", "name"],
          "text-font": ["match", ["get", "state"], 2, ["literal", ["Noto Sans Bold"]], ["literal", ["Noto Sans Regular"]]],
          "text-size": ["match", ["get", "state"], 2, 13, 12],
          "text-offset": [0, 0.9],
          "text-anchor": "top",
          "symbol-sort-key": ["-", 0, ["get", "state"]],
        }}
        paint={{
          "text-color": ["match", ["get", "state"], 2, colors.accent, colors.ink],
          "text-halo-color": colors.halo,
          "text-halo-width": 1.5,
        }}
      />
    </Source>
  );
}
