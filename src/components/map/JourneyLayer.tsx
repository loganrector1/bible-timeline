import { useEffect, useMemo, useState } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { journeysById } from "../../data";
import {
  JOURNEY_DELAY_MS, journeyDuration, journeyLegs, routeCoords, type Coord, type Leg,
} from "../../lib/journeys";
import { ARROW_IMAGE } from "./arrowImage";
import type { MapColors } from "./mapColors";

export const JOURNEY_HIT_LAYER = "journey-hit";

const lengthOf = (l: Leg) => Math.hypot(l.to[0] - l.from[0], l.to[1] - l.from[1]);

/** Legs drawn so far at `progress` (0–1, by length): whole legs, then a partial one. */
function drawnLegs(legs: Leg[], progress: number): { legs: Leg[]; head?: Coord } {
  const total = legs.reduce((a, l) => a + lengthOf(l), 0);
  if (progress >= 1 || total === 0) return { legs };
  let remaining = progress * total;
  const out: Leg[] = [];
  for (const leg of legs) {
    const len = lengthOf(leg);
    if (remaining >= len) {
      out.push(leg);
      remaining -= len;
      continue;
    }
    const f = len === 0 ? 1 : remaining / len;
    const head: Coord = [leg.from[0] + (leg.to[0] - leg.from[0]) * f, leg.from[1] + (leg.to[1] - leg.from[1]) * f];
    if (f > 0) out.push({ ...leg, to: head });
    return { legs: out, head };
  }
  return { legs: out };
}

const legFeatures = (legs: Leg[], journeyId: string): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: legs.map((l) => ({
    type: "Feature",
    properties: { offset: l.offset, journeyId },
    geometry: { type: "LineString", coordinates: [l.from, l.to] },
  })),
});

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * One journey at a time: the focus event's route. Arrows show direction, legs that
 * retrace earlier ones sit beside them, and stops are numbered in order. When the
 * journey's event is freshly selected (`animateKey` changes) it draws in leg by leg
 * behind a moving dot; otherwise it appears complete.
 */
export default function JourneyLayer({
  journeyId, animateKey, hovered, colors,
}: {
  journeyId?: string;
  animateKey: number | null;
  hovered: boolean;
  colors: MapColors;
}) {
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
  const { legs: drawn, head } = drawnLegs(legs, progress);

  // Stop numbers, merged where a journey revisits a place ("2·6").
  const stops = useMemo<GeoJSON.FeatureCollection>(() => {
    if (!journeyId) return EMPTY;
    const coords = routeCoords(journeyId);
    const reached = Math.floor(progress * (coords.length - 1) + 1e-9) + 1;
    const byPlace = new Map<string, { coord: Coord; numbers: number[] }>();
    journeysById.get(journeyId)!.stops.slice(0, reached).forEach((s, i) => {
      const entry = byPlace.get(s.locationId) ?? { coord: coords[i], numbers: [] };
      entry.numbers.push(i + 1);
      byPlace.set(s.locationId, entry);
    });
    return {
      type: "FeatureCollection",
      features: [...byPlace.values()].map(({ coord, numbers }) => ({
        type: "Feature",
        properties: { label: numbers.join("·"), wide: numbers.length > 1 },
        geometry: { type: "Point", coordinates: coord },
      })),
    };
  }, [journeyId, progress]);

  const headPoint: GeoJSON.FeatureCollection = head
    ? { type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: head } }] }
    : EMPTY;

  const width = hovered ? 5 : 3.5;

  return (
    <>
      <Source id="journey-full" type="geojson" data={journeyId ? legFeatures(legs, journeyId) : EMPTY}>
        {/* The whole route, faint, so you can see where it's heading while it draws. */}
        <Layer id="journey-full" type="line" layout={{ "line-cap": "round" }}
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
      <Source id="journey-stops" type="geojson" data={stops}>
        <Layer id="journey-stops" type="circle"
          paint={{
            "circle-radius": ["case", ["get", "wide"], 12, 9],
            "circle-color": colors.accent, "circle-stroke-color": colors.halo, "circle-stroke-width": 2,
          }} />
        <Layer id="journey-stop-numbers" type="symbol"
          layout={{ "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true }}
          paint={{ "text-color": colors.halo }} />
      </Source>
    </>
  );
}
