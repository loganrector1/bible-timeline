import { useEffect, useMemo, useState } from "react";
import { Layer, Source } from "react-map-gl/maplibre";
import { journeysById, locationsById } from "../../data";
import type { MapColors } from "./mapColors";

type Coord = [number, number];

function routeCoords(journeyId: string): Coord[] {
  return journeysById.get(journeyId)!.stops.map((s) => locationsById.get(s.locationId)!.coords as Coord);
}

/** The first `progress` (0–1) of a route by length, ending at an interpolated point. */
function partialRoute(coords: Coord[], progress: number): Coord[] {
  const lengths = coords.slice(1).map((c, i) => Math.hypot(c[0] - coords[i][0], c[1] - coords[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  if (total === 0 || progress >= 1) return coords;
  let remaining = progress * total;
  const out: Coord[] = [coords[0]];
  for (let i = 0; i < lengths.length; i++) {
    if (remaining >= lengths[i]) {
      out.push(coords[i + 1]);
      remaining -= lengths[i];
      continue;
    }
    const f = remaining / lengths[i];
    const [a, b] = [coords[i], coords[i + 1]];
    out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    break;
  }
  return out;
}

const line = (coords: Coord[][]): GeoJSON.FeatureCollection => ({
  type: "FeatureCollection",
  features: coords.filter((c) => c.length > 1).map((c) => ({
    type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: c },
  })),
});

/**
 * Journeys: routes of events happening now are drawn faintly; the selected
 * event's route is drawn in, leg by leg, each time it is selected.
 */
export default function JourneyLayer({
  selectedJourney, activeJourneys, replayKey, colors,
}: {
  selectedJourney?: string;
  activeJourneys: string[];
  replayKey: number;
  colors: MapColors;
}) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!selectedJourney) return;
    const legs = journeysById.get(selectedJourney)!.stops.length - 1;
    const duration = Math.min(6000, Math.max(2000, legs * 700));
    let frame = 0;
    // Start after the map's fly-to has mostly finished.
    const t0 = performance.now() + 900;
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - t0) / duration));
      setProgress(t);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [selectedJourney, replayKey]);

  const ghosts = useMemo(
    () => line(activeJourneys.filter((id) => id !== selectedJourney).map(routeCoords)),
    [activeJourneys, selectedJourney],
  );

  const selectedCoords = selectedJourney ? routeCoords(selectedJourney) : [];
  const drawn = line([partialRoute(selectedCoords, progress)]);
  const full = line([selectedCoords]);
  const stopsReached = Math.floor(progress * (selectedCoords.length - 1) + 1e-9) + 1;
  const stops: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: selectedCoords.slice(0, stopsReached).map((c, i) => ({
      type: "Feature", properties: { n: i + 1 }, geometry: { type: "Point", coordinates: c },
    })),
  };

  return (
    <>
      <Source id="journey-ghosts" type="geojson" data={ghosts}>
        <Layer id="journey-ghosts" type="line" layout={{ "line-cap": "round" }}
          paint={{ "line-color": colors.accent, "line-width": 2, "line-opacity": 0.45, "line-dasharray": [1, 2] }} />
      </Source>
      <Source id="journey-full" type="geojson" data={full}>
        <Layer id="journey-full" type="line" layout={{ "line-cap": "round" }}
          paint={{ "line-color": colors.accent, "line-width": 2, "line-opacity": 0.3, "line-dasharray": [1, 2] }} />
      </Source>
      <Source id="journey-drawn" type="geojson" data={drawn}>
        <Layer id="journey-drawn" type="line" layout={{ "line-cap": "round", "line-join": "round" }}
          paint={{ "line-color": colors.accent, "line-width": 4 }} />
      </Source>
      <Source id="journey-stops" type="geojson" data={stops}>
        <Layer id="journey-stops" type="circle"
          paint={{ "circle-radius": 9, "circle-color": colors.accent, "circle-stroke-color": colors.halo, "circle-stroke-width": 2 }} />
        <Layer id="journey-stop-numbers" type="symbol"
          layout={{ "text-field": ["to-string", ["get", "n"]], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-allow-overlap": true }}
          paint={{ "text-color": colors.halo }} />
      </Source>
    </>
  );
}
