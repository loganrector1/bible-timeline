import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { data, regionsById } from "../../data";
import { JOURNEY_BASE_LAYER, JOURNEY_STOPS_LAYER } from "./JourneyLayer";
import type { MapColors } from "./mapColors";

export const LOCATION_LAYER = "locations-circle";
export const REGION_LABEL_LAYER = "region-labels";

/**
 * Place labels try these positions around their dot, in order, to stay clear of each other,
 * the focus journey's stops and its route.
 */
const LABEL_ANCHORS = ["top", "bottom", "right", "left", "top-right", "bottom-right", "top-left", "bottom-left"] as const satisfies string[];

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
      {/* MapLibre places symbols from the top layer down, and later ones keep clear of those
          already placed. So the journey's stop numbers come first, then the event's own place
          labels (beneath the stops), then the route's invisible clearance marks, then the
          background labels and region names like CANAAN (beneath the whole journey), which
          keep clear of everything. The event's labels may cross the route rather than vanish. */}
      <Layer
        id={REGION_LABEL_LAYER}
        type="symbol"
        beforeId={JOURNEY_BASE_LAYER}
        // Only while something uses the region (an event nearby, the selection or the focus
        // event): a land's name is timeless, but CANAAN shouldn't sit on the map in AD 20.
        filter={["all", ["==", ["get", "kind"], "region"], [">", ["get", "state"], 0]]}
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
      {/* The event labels, above, win collisions with these. */}
      <Layer
        id="locations-label-base"
        type="symbol"
        beforeId={JOURNEY_BASE_LAYER}
        minzoom={5.5}
        filter={["all", ["==", ["get", "kind"], "site"], ["==", ["get", "state"], 0]]}
        layout={{
          "text-field": ["get", "name"], "text-font": ["Noto Sans Italic"], "text-size": 11,
          "text-variable-anchor": LABEL_ANCHORS, "text-radial-offset": 0.8,
        }}
        paint={{ "text-color": colors.muted, "text-halo-color": colors.halo, "text-halo-width": 1.2 }}
      />
      <Layer
        id="locations-label"
        type="symbol"
        beforeId={JOURNEY_STOPS_LAYER}
        filter={["all", ["==", ["get", "kind"], "site"], ["!=", ["get", "state"], 0]]}
        layout={{
          "text-field": ["get", "name"],
          "text-font": ["match", ["get", "state"], 2, ["literal", ["Noto Sans Bold"]], ["literal", ["Noto Sans Regular"]]],
          "text-size": ["match", ["get", "state"], 2, 13, 12],
          "text-variable-anchor": LABEL_ANCHORS,
          // Far enough out to clear a journey stop's marker, which sits on the place's dot.
          "text-radial-offset": 1.3,
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
