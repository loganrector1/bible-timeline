import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { data, regionsById, type EntityRef } from "../../data";
import type { BorderFeature } from "../../data/schema";
import { borderTarget, borderYears, bordersAt, loadBorders } from "../../lib/borders";
import { REGION_FILL_LAYER } from "./RegionLayer";

export const BORDER_LABEL_LAYER = "borders-label";
/** The base map's sea: outlines go beneath it, so Cliopatria's rough coasts are trimmed by the real one. */
const BENEATH = "water";
/** How long outlines take to fade in or out when the cursor crosses into another snapshot. */
const FADE_MS = 350;

/**
 * Each line of powers keeps one hue, so Egypt reads as Egypt from kingdom to kingdom and
 * neighbours (Ptolemies and Seleucids) differ. Israel's own states take the Kings lane's tints:
 * Judah warm, Israel cool, the united kingdom plain.
 */
const HUES: Record<string, string> = {
  "egypt-middle": "#b07d1a", hyksos: "#8c6a3c", "egypt-new": "#b07d1a", "egypt-divided": "#b07d1a",
  "egypt-late": "#b07d1a", ptolemies: "#b07d1a",
  "ur-iii": "#5a7d8c", "old-babylon": "#2e7d6f", babylon: "#2e7d6f",
  hittites: "#6b8a2a", assyria: "#87569b", persia: "#3d6aa0",
  "alexander-empire": "#4c8a44", seleucids: "#2f8a8a",
  "roman-republic": "#a23a5f", rome: "#a23a5f",
  hasmoneans: "#c47f17", judah: "#c47f17", israel: "#2b7bb9", united: "#7a6a55",
};
const FALLBACK = "#7a6a55";

export function hueOf(f: BorderFeature): string {
  return HUES[f.properties.tint ?? f.properties.empire ?? ""] ?? FALLBACK;
}

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The hue mixed toward white, so labels stay readable on the dark map. */
function lighten(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

/** A power named like a place drawn as a region (Egypt) leaves the naming to the place's label. */
const regionNames = new Set(data.locations.filter((l) => regionsById.has(l.id)).map((l) => l.name.toLowerCase()));

/** Outlines unchanged since the last snapshot, fading out, and fading in. */
type Slots = { steady: string[]; out: string[]; in: string[] };
const SLOTS = ["out", "steady", "in"] as const;

function nextSlots(beforeKey: string, afterKey: string): Slots {
  const before = new Set(beforeKey ? beforeKey.split(",") : []);
  const after = afterKey ? afterKey.split(",") : [];
  return {
    steady: after.filter((id) => before.has(id)),
    out: [...before].filter((id) => !after.includes(id)),
    in: after.filter((id) => !before.has(id)),
  };
}

/**
 * The great powers and Israel's own states as they stood at the cursor's time: faint fills
 * with a line, and a label that gives way to every other label on the map. When the cursor
 * crosses into another snapshot, the outlines that changed cross-fade. `on` is the Empires
 * toggle; the selection's outlines (an empire's, or those of the person or era an outline
 * belongs to) show strongly either way.
 */
export default function BorderLayer({
  year, chron, on, selection, hovered, dark,
}: {
  year: number; chron: string; on: boolean; selection: EntityRef | null; hovered?: string; dark: boolean;
}) {
  const { current: mapRef } = useMap();
  const [all, setAll] = useState<BorderFeature[] | null>(null);
  useEffect(() => {
    let live = true;
    loadBorders().then((b) => live && setAll(b)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const isSelected = (f: BorderFeature) => {
    const t = borderTarget(f);
    return !!selection && !!t && t.kind === selection.kind && t.id === selection.id;
  };
  const now = useMemo(() => (all ? bordersAt(all, year, chron) : []), [all, year, chron]);
  const shown = now.filter((f) => on || isSelected(f));
  const shownKey = shown.map((f) => f.properties.id).join(",");
  const strong = shown.filter((f) => isSelected(f) || f.properties.id === hovered).map((f) => f.properties.id);
  const strongKey = strong.join(",");

  // What was shown before and still is stays put; the rest cross-fades.
  const [prevKey, setPrevKey] = useState("");
  const [slots, setSlots] = useState<Slots>({ steady: [], out: [], in: [] });
  if (prevKey !== shownKey) {
    setPrevKey(shownKey);
    setSlots(nextSlots(prevKey, shownKey));
  }

  // Fade by setting the opacity each frame. MapLibre's own paint transitions start from
  // whatever it last drew, which depends on frame timing, so toggling flickered.
  useLayoutEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const set = (slot: "in" | "out", opacity: number) => {
      for (const [layer, prop] of [[`borders-fill-${slot}`, "fill-opacity"], [`borders-line-${slot}`, "line-opacity"]] as const) {
        if (map.getLayer(layer)) map.setPaintProperty(layer, prop, opacity);
      }
    };
    const start = performance.now();
    let id = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS);
      set("in", t);
      set("out", 1 - t);
      if (t < 1) id = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(id);
  }, [slots, mapRef, all]);

  // Strength (the selection's or the hovered outline) is feature state, so it needs no new data.
  // It's set again whenever the source (re)loads: on first load and after a theme change.
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const ids = strongKey ? strongKey.split(",") : [];
    const apply = () => {
      if (!map.getSource("borders")) return;
      for (const id of ids) map.setFeatureState({ source: "borders", id }, { strong: true });
    };
    const onData = (e: { sourceId?: string }) => e.sourceId === "borders" && apply();
    apply();
    map.on("sourcedata", onData);
    return () => {
      map.off("sourcedata", onData);
      if (!map.getSource("borders")) return;
      for (const id of ids) map.removeFeatureState({ source: "borders", id }, "strong");
    };
  }, [strongKey, mapRef, all]);

  const fillAlpha = dark ? 0.15 : 0.1;
  const outlines = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: (all ?? []).map((f) => {
      const hue = hueOf(f);
      const subject = !!f.properties.subject;
      return {
        type: "Feature",
        geometry: f.geometry,
        properties: {
          id: f.properties.id,
          fill: rgba(hue, subject ? fillAlpha * 0.45 : fillAlpha),
          fillStrong: rgba(hue, fillAlpha * 2.2),
          line: rgba(hue, subject ? 0.4 : 0.6),
          lineStrong: rgba(hue, 0.95),
          width: subject ? 0.75 : 1,
        },
      };
    }),
  }), [all, fillAlpha]);

  const labels = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: shown.filter((f) => !regionNames.has(f.properties.name.toLowerCase()) || strong.includes(f.properties.id)).map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.properties.label },
      properties: {
        id: f.properties.id,
        name: f.properties.name,
        from: borderYears(f, chron)[0],
        to: borderYears(f, chron)[1],
        note: f.properties.note,
        targetKind: borderTarget(f)?.kind,
        targetId: borderTarget(f)?.id,
        color: dark ? lighten(hueOf(f), 0.45) : hueOf(f),
        small: !!f.properties.small,
        strong: strong.includes(f.properties.id),
      },
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [shownKey, strongKey, chron, dark]);

  if (!all) return null;
  const isStrong = ["boolean", ["feature-state", "strong"], false];

  return (
    <>
      <Source id="borders" type="geojson" data={outlines} promoteId="id">
        {SLOTS.flatMap((slot) => {
          const filter = ["in", ["get", "id"], ["literal", slots[slot]]] as never;
          return [
            <Layer
              key={`fill-${slot}`}
              id={`borders-fill-${slot}`}
              type="fill"
              beforeId={BENEATH}
              filter={filter}
              paint={{
                "fill-color": ["case", isStrong, ["get", "fillStrong"], ["get", "fill"]] as never,
                "fill-opacity-transition": { duration: 0 },
              }}
            />,
            <Layer
              key={`line-${slot}`}
              id={`borders-line-${slot}`}
              type="line"
              beforeId={BENEATH}
              filter={filter}
              layout={{ "line-join": "round" }}
              paint={{
                "line-color": ["case", isStrong, ["get", "lineStrong"], ["get", "line"]] as never,
                "line-width": ["case", isStrong, 2.25, ["get", "width"]] as never,
                "line-opacity-transition": { duration: 0 },
              }}
            />,
          ];
        })}
      </Source>
      <Source id="border-labels" type="geojson" data={labels}>
        {/* Beneath every other label the app draws, so places, regions and journeys win. */}
        <Layer
          id={BORDER_LABEL_LAYER}
          type="symbol"
          beforeId={REGION_FILL_LAYER}
          layout={{
            // Small labels (tribes, provinces) only once there's room, unless selected.
            "text-field": ["step", ["zoom"],
              ["case", ["get", "small"], ["case", ["get", "strong"], ["get", "name"], ""], ["upcase", ["get", "name"]]],
              6, ["case", ["get", "small"], ["get", "name"], ["upcase", ["get", "name"]]],
            ] as never,
            "text-font": ["case", ["get", "small"], ["literal", ["Noto Sans Italic"]], ["literal", ["Noto Sans Regular"]]] as never,
            "text-size": ["interpolate", ["linear"], ["zoom"], 3, ["case", ["get", "small"], 9, 10], 7, ["case", ["get", "small"], 12, 14]] as never,
            "text-letter-spacing": ["case", ["get", "small"], 0.02, 0.2] as never,
            "text-max-width": 7,
            // Moved off its point rather than hidden when a place (often the capital) is there.
            "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
            "text-radial-offset": 1.6,
            "symbol-sort-key": ["case", ["get", "strong"], 0, ["get", "small"], 2, 1] as never,
          }}
          paint={{
            "text-color": ["get", "color"],
            "text-halo-color": dark ? "#1c1915" : "#faf6ee",
            "text-halo-width": 1.5,
          }}
        />
      </Source>
    </>
  );
}
