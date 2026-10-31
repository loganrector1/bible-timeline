import { useEffect, useMemo, useState } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { journeysById } from "../../data";
import type { Event } from "../../data/schema";
import { childEvents } from "../../lib/entities";
import {
  drawnLegs, eventForJourney, JOURNEY_DELAY_MS, journeyDuration, journeyLegs, routeCoords, stopIndexOf, type Coord, type Leg,
} from "../../lib/journeys";
import { useStore } from "../../state/store";
import { ARROW_IMAGE, BLANK_IMAGE } from "./arrowImage";
import type { MapColors } from "./mapColors";

export const JOURNEY_HIT_LAYER = "journey-hit";
/** The journey's lowest layer, for drawing beneath the route. */
export const JOURNEY_BASE_LAYER = "journey-full";
/** The stop markers' lowest layer: the event's own place labels sit just beneath it. */
export const JOURNEY_STOPS_LAYER = "journey-stops";

const legFeatures = (legs: Leg[], journeyId: string): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: legs.map((l) => ({
    type: "Feature",
    properties: { offset: l.offset, journeyId },
    geometry: { type: "LineString", coordinates: l.path },
  })),
});

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * One journey at a time: the focus event's route. Arrows show direction, legs that
 * retrace earlier ones sit beside them, and stops are numbered in order. When the
 * journey's event is freshly selected (`animateKey` changes) it draws in leg by leg
 * behind a moving dot; otherwise it appears complete. For an event along the way
 * (`along`, e.g. the Red Sea in the Exodus) it's drawn up to that event's stop. Stops
 * where such events happen are labelled with them once the route reaches them.
 */
export default function JourneyLayer({
  journeyId, along, animateKey, hovered, colors,
}: {
  journeyId?: string;
  along?: Event;
  animateKey: number | null;
  hovered: boolean;
  colors: MapColors;
}) {
  const chron = useStore((s) => s.chronologyId);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    setProgress(1);
    if (!journeyId || animateKey === null) return;
    const duration = journeyDuration(journeyId);
    const t0 = performance.now() + JOURNEY_DELAY_MS;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [journeyId, animateKey]);

  const legs = useMemo(() => (journeyId ? journeyLegs(journeyId) : []), [journeyId]);
  const alongStop = journeyId && along ? stopIndexOf(journeyId, along) : -1;
  const { legs: drawn, head, reached } = alongStop >= 0
    ? { legs: legs.slice(0, alongStop), head: undefined, reached: alongStop + 1 }
    : drawnLegs(legs, progress);

  // Events along the way, by the place they happen.
  const eventsAt = useMemo(() => {
    const parent = journeyId ? eventForJourney(journeyId) : undefined;
    const byPlace = new Map<string, Event[]>();
    for (const ev of parent ? childEvents(parent, chron) : []) {
      const i = stopIndexOf(journeyId!, ev);
      if (i < 0) continue;
      const id = journeysById.get(journeyId!)!.stops[i].locationId;
      byPlace.set(id, [...(byPlace.get(id) ?? []), ev]);
    }
    return byPlace;
  }, [journeyId, chron]);

  // Stop numbers, merged where a journey revisits a place ("2·6").
  const stops = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!journeyId) return EMPTY;
    const coords = routeCoords(journeyId);
    const byPlace = new Map<string, { coord: Coord; numbers: number[] }>();
    journeysById.get(journeyId)!.stops.slice(0, reached).forEach((s, i) => {
      const entry = byPlace.get(s.locationId) ?? { coord: coords[i], numbers: [] };
      entry.numbers.push(i + 1);
      byPlace.set(s.locationId, entry);
    });
    return {
      type: "FeatureCollection",
      features: [...byPlace].map(([place, { coord, numbers }]) => ({
        type: "Feature",
        properties: {
          label: numbers.join("·"),
          wide: numbers.length > 1,
          events: (eventsAt.get(place) ?? []).map((ev) => ev.title).join("\n"),
          current: along !== undefined && along.locations.includes(place),
        },
        geometry: { type: "Point", coordinates: coord },
      })),
    };
  }, [journeyId, reached, eventsAt, along]);

  const headPoint: GeoJSON.FeatureCollection = head
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: head } }] }
    : EMPTY;

  const width = hovered ? 5 : 3.5;

  return (
    <>
      <Source id="journey-full" type="geojson" data={journeyId ? legFeatures(legs, journeyId) : EMPTY}>
        {/* The whole route, faint, so you can see where it's heading while it draws. */}
        <Layer id={JOURNEY_BASE_LAYER} type="line" layout={{ "line-cap": "round" }}
          paint={{ "line-color": colors.accent, "line-width": 2, "line-opacity": 0.25, "line-dasharray": [1, 2], "line-offset": ["get", "offset"] }} />
        {/* Wide, invisible line that makes the route easy to hover and click. */}
        <Layer id={JOURNEY_HIT_LAYER} type="line" paint={{ "line-color": "#000", "line-width": 16, "line-opacity": 0 }} />
      </Source>
      <Source id="journey-drawn" type="geojson" data={journeyId ? legFeatures(drawn, journeyId) : EMPTY}>
        <Layer id="journey-drawn-casing" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": colors.halo, "line-width": width + 2.5, "line-opacity": 0.7, "line-offset": ["get", "offset"] }} />
        <Layer id="journey-drawn" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": colors.accent, "line-width": width, "line-offset": ["get", "offset"] }} />
        <Layer id="journey-arrows" type="symbol"
          layout={{
            "symbol-placement": "line",
            "symbol-spacing": 60,
            "icon-image": ARROW_IMAGE,
            "icon-size": 1,
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-offset": ["case", [">", ["get", "offset"], 0], ["literal", [0, 4]], ["literal", [0, 0]]],
          }}
          />
      </Source>
      <Source id="journey-head" type="geojson" data={headPoint}>
        <Layer id="journey-head" type="circle"
          paint={{ "circle-radius": 6, "circle-color": colors.halo, "circle-stroke-color": colors.accent, "circle-stroke-width": 3 }} />
      </Source>
      {/* Invisible marks along the whole route that background labels keep clear of (see
          EventLayer: MapLibre places symbols from the top layer down). */}
      <Source id="journey-clearance" type="geojson" data={journeyId ? legFeatures(legs, journeyId) : EMPTY}>
        <Layer id="journey-clearance" type="symbol"
          layout={{
            "symbol-placement": "line",
            "symbol-spacing": 8,
            "icon-image": BLANK_IMAGE,
            "icon-padding": 3,
            "icon-allow-overlap": true,
          }}
          />
      </Source>
      <Source id="journey-stops" type="geojson" data={stops}>
        <Layer id={JOURNEY_STOPS_LAYER} type="circle"
          paint={{
            "circle-radius": ["case", ["get", "wide"], 12, 9],
            "circle-color": colors.accent, "circle-stroke-color": colors.halo,
            "circle-stroke-width": ["case", ["get", "current"], 4, 2],
          }} />
        {/* Padded to the circle's size, so place labels keep clear of the stop. */}
        <Layer id="journey-stop-numbers" type="symbol"
          layout={{ "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true, "text-padding": 3 }}
          paint={{ "text-color": colors.halo }} />
        {/* What happened at the stop, beside it. */}
        <Layer id="journey-stop-events" type="symbol"
          layout={{
            "text-field": ["get", "events"], "text-font": ["Noto Sans Bold"], "text-size": 12,
            "text-anchor": "left", "text-offset": [1.3, 0], "text-justify": "left", "text-max-width": 10,
          }}
          paint={{ "text-color": colors.accent, "text-halo-color": colors.halo, "text-halo-width": 1.5 }} />
      </Source>
    </>
  );
}
