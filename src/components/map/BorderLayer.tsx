import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { Layer, Source, useMap } from "react-map-gl/maplibre";
import { data, regionsById, type EntityRef } from "../../data";
import type { BorderFeature } from "../../data/schema";
import { borderOf, borderPower, borderTarget, borderYears, bordersAt, loadBorders } from "../../lib/borders";
import { REGION_ANCHOR } from "./RegionLayer";

export const BORDER_LABEL_LAYER = "borders-label";
/** The fills a resting pointer can ask about: those shown, not those fading out. Invisible. */
export const BORDER_FILL_LAYERS = ["borders-hit"];
/** The base map's sea: outlines go beneath it, so Cliopatria's rough coasts are trimmed by the real one. */
const BENEATH = "water";
/** How long outlines take to fade in or out when the cursor crosses into another snapshot. */
const FADE_MS = 350;

/**
 * Each line of powers keeps one hue, so Egypt reads as Egypt from kingdom to kingdom and
 * neighbors (Ptolemies and Seleucids) differ. Israel's own states take the Kings lane's tints:
 * Judah warm, Israel cool, the united kingdom plain. Israel's neighbors (Moab, Philistia…) share
 * one slate, so they read as the neighbors rather than as powers.
 */
const HUES: Record<string, string> = {
  "egypt-middle": "#b07d1a", hyksos: "#8c6a3c", "egypt-new": "#b07d1a", "egypt-divided": "#b07d1a",
  "egypt-late": "#b07d1a", ptolemies: "#b07d1a", thebes: "#b07d1a",
  "ur-iii": "#5a7d8c", "old-babylon": "#2e7d6f", babylon: "#2e7d6f",
  hittites: "#6b8a2a", assyria: "#87569b", persia: "#3d6aa0",
  "alexander-empire": "#4c8a44", seleucids: "#2f8a8a",
  "roman-republic": "#a23a5f", rome: "#a23a5f",
  hasmoneans: "#c47f17", judah: "#c47f17", israel: "#2b7bb9", united: "#7a6a55",
  neighbor: "#6b7686",
};
const FALLBACK = "#7a6a55";

export function hueOf(f: BorderFeature): string {
  return HUES[f.properties.tint ?? f.properties.empire ?? borderPower(f)] ?? FALLBACK;
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

/**
 * A power named like a place drawn as a region (Egypt) leaves the naming to the place's label
 * while that label shows; region labels show only while something uses them.
 */
const regionByName = new Map(data.locations.filter((l) => regionsById.has(l.id)).map((l) => [l.name.toLowerCase(), l.id]));

/** The outlines whose labels are drawn: those shown now and those shown just before, fading out. */
function labelled(beforeKey: string, afterKey: string): string[] {
  const after = afterKey ? afterKey.split(",") : [];
  const before = beforeKey ? beforeKey.split(",") : [];
  return [...before.filter((id) => !after.includes(id)), ...after];
}

/**
 * The places named by the outlines on the map now (Moab's land, while Moab's kingdom stands):
 * their own dot and background label give way to the outline's, so MOAB isn't named twice.
 */
export function useNamedPlaces(year: number, chron: string, on: boolean): Set<string> {
  const [all, setAll] = useState<BorderFeature[] | null>(null);
  useEffect(() => {
    let live = true;
    loadBorders().then((b) => live && setAll(b)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const key = on && all
    ? bordersAt(all, year, chron).flatMap((f) => (f.properties.links ?? []).filter((l) => l.kind === "location").map((l) => l.id)).sort().join(",")
    : "";
  return useMemo(() => new Set(key ? key.split(",") : []), [key]);
}

/**
 * The great powers and Israel's own states as they stood at the cursor's time: faint fills
 * with a line, and a label that gives way to every other label on the map. When the cursor
 * crosses into another snapshot, the outlines that changed cross-fade. `on` is the Empires
 * toggle; the selection's outlines (an empire's, or those of the person or era an outline
 * belongs to) show strongly either way.
 */
export default function BorderLayer({
  year, chron, on, selection, hovered, dark, regionLabels,
}: {
  year: number; chron: string; on: boolean; selection: EntityRef | null; hovered?: string; dark: boolean;
  /** The regions whose labels show on the map now, as a comma-separated key of their ids. */
  regionLabels: string;
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
  // The labels go beneath the regions' anchor, so they wait for it. Layers add themselves on the
  // first render after the style loads, so with the year changing while the map loaded (the family
  // tree gliding the cursor) this one could come first, and MapLibre threw.
  const [anchored, setAnchored] = useState(false);
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || anchored) return;
    const check = () => map.getLayer(REGION_ANCHOR) && setAnchored(true);
    check();
    map.on("styledata", check);
    return () => {
      map.off("styledata", check);
    };
  }, [mapRef, anchored]);

  const isSelected = (f: BorderFeature) => !!selection && borderOf(f, selection);
  const now = useMemo(() => (all ? bordersAt(all, year, chron) : []), [all, year, chron]);
  const shown = now.filter((f) => on || isSelected(f));
  const shownKey = shown.map((f) => f.properties.id).join(",");
  // The selection's outlines and labels stand out; a hovered outline does too, but its label
  // stays as it is: changing it moves it (its anchor is chosen afresh), out from under the pointer.
  const selected = shown.filter(isSelected).map((f) => f.properties.id);
  const strong = hovered && shown.some((f) => f.properties.id === hovered) ? [...selected, hovered] : selected;
  const strongKey = strong.join(",");
  const selectedKey = selected.join(",");

  const [prevKey, setPrevKey] = useState("");
  const [labelIds, setLabelIds] = useState<string[]>([]);
  if (prevKey !== shownKey) {
    setPrevKey(shownKey);
    setLabelIds(labelled(prevKey, shownKey));
  }

  // Each outline's opacity is feature state ("o"), stepped every frame toward 1 if shown, else 0,
  // so what changed cross-fades and the rest stays put. Feature state shows on the next frame.
  // A layer's filter or paint wouldn't: a new filter waits for the tiles to rebuild while the old
  // ones draw with the new opacity (outlines flashed), and paint transitions start from whatever
  // was last drawn.
  const opacity = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !all) return;
    const target = new Set(shownKey ? shownKey.split(",") : []);
    const from = new Map(opacity.current);
    for (const id of target) if (!from.has(id)) from.set(id, 0);
    for (const [id, a] of from) if (a === (target.has(id) ? 1 : 0)) from.delete(id);
    const start = performance.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / FADE_MS);
      for (const [id, a] of from) {
        const o = a + ((target.has(id) ? 1 : 0) - a) * t;
        if (o === 0) opacity.current.delete(id);
        else opacity.current.set(id, o);
        setOpacity(map, id, o);
      }
      if (t < 1) frame = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(frame);
  }, [shownKey, mapRef, all]);
  // Feature state is lost when a source is made afresh (a theme change), and a label's source
  // may not exist yet when its fade starts.
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const onData = (e: { sourceId?: string }) => {
      if (e.sourceId === "borders" || e.sourceId === "border-labels") {
        for (const [id, o] of opacity.current) setOpacity(map, id, o);
      }
    };
    map.on("sourcedata", onData);
    return () => {
      map.off("sourcedata", onData);
    };
  }, [mapRef]);

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
          // What a resting pointer's card says, and what a click opens.
          name: f.properties.name,
          from: borderYears(f, chron)[0],
          to: borderYears(f, chron)[1],
          targetKind: borderTarget(f)?.kind,
          targetId: borderTarget(f)?.id,
          fill: rgba(hue, subject ? fillAlpha * 0.45 : fillAlpha),
          fillStrong: rgba(hue, fillAlpha * 2.2),
          line: rgba(hue, subject ? 0.4 : 0.6),
          lineStrong: rgba(hue, 0.95),
          width: subject ? 0.75 : 1,
        },
      };
    }),
  }), [all, fillAlpha, chron]);

  // Labels fade with their outlines, so those fading out keep theirs until they're gone.
  const byId = useMemo(() => new Map((all ?? []).map((f) => [f.properties.id, f])), [all]);
  const labels = useMemo<GeoJSON.FeatureCollection>(() => ({
    type: "FeatureCollection",
    features: labelIds.map((id) => byId.get(id)!).filter((f) => {
      if (!f || selected.includes(f.properties.id)) return !!f;
      const region = regionByName.get(f.properties.name.toLowerCase());
      return !region || !regionLabels.split(",").includes(region);
    }).map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: f.properties.label },
      properties: {
        id: f.properties.id,
        name: f.properties.name,
        from: borderYears(f, chron)[0],
        to: borderYears(f, chron)[1],
        targetKind: borderTarget(f)?.kind,
        targetId: borderTarget(f)?.id,
        color: dark ? lighten(hueOf(f), 0.45) : hueOf(f),
        small: !!f.properties.small,
        strong: selected.includes(f.properties.id),
      },
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [labelIds, byId, selectedKey, chron, dark, regionLabels]);

  if (!all) return null;
  const isStrong = ["boolean", ["feature-state", "strong"], false];
  const faded = ["number", ["feature-state", "o"], 0] as never;

  return (
    <>
      {/* Every outline is always in the source; those not shown have opacity 0. */}
      <Source id="borders" type="geojson" data={outlines} promoteId="id">
        <Layer
          id="borders-fill"
          type="fill"
          beforeId={BENEATH}
          paint={{
            "fill-color": ["case", isStrong, ["get", "fillStrong"], ["get", "fill"]] as never,
            "fill-opacity": faded,
          }}
        />
        <Layer
          id="borders-line"
          type="line"
          beforeId={BENEATH}
          layout={{ "line-join": "round" }}
          paint={{
            "line-color": ["case", isStrong, ["get", "lineStrong"], ["get", "line"]] as never,
            "line-width": ["case", isStrong, 2.25, ["get", "width"]] as never,
            "line-opacity": faded,
          }}
        />
        <Layer
          id={BORDER_FILL_LAYERS[0]}
          type="fill"
          beforeId={BENEATH}
          filter={["in", ["get", "id"], ["literal", shown.map((f) => f.properties.id)]] as never}
          paint={{ "fill-opacity": 0 }}
        />
      </Source>
      {anchored && (
        <Source id="border-labels" type="geojson" data={labels} promoteId="id">
          {/* Beneath every other label the app draws, so places, regions and journeys win. */}
          <Layer
            id={BORDER_LABEL_LAYER}
            type="symbol"
            beforeId={REGION_ANCHOR}
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
              "text-opacity": faded,
            }}
          />
        </Source>
      )}
    </>
  );
}

function setOpacity(map: MapLibreMap, id: string, o: number) {
  for (const source of ["borders", "border-labels"]) {
    if (map.getSource(source)) map.setFeatureState({ source, id }, { o });
  }
}
