import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { eventsById } from "../../data";
import { activeEvents } from "../../lib/activeEvents";
import { entityLocations, eventLocations } from "../../lib/entities";
import { usePrefersDark } from "../../lib/usePrefersDark";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { BORDER_LAYER, loadBaseStyle } from "./baseStyle";
import EventLayer, { LOCATION_LAYER } from "./EventLayer";
import JourneyLayer from "./JourneyLayer";
import { DARK, LIGHT } from "./mapColors";
import NowPanel from "./NowPanel";
import RegionLayer from "./RegionLayer";
import TimeStrip from "./TimeStrip";

// MapLibre finds its worker relative to its own module, which breaks once Vite bundles it.
setWorkerUrl(workerUrl);

/** Egypt to Mesopotamia. */
const INITIAL_BOUNDS: [[number, number], [number, number]] = [[29, 24], [47.5, 38]];

/** Fly to fit the given places, leaving room for the "Happening now" panel when it's open. */
function frame(map: MapRef, coords: [number, number][], panelOpen: boolean) {
  if (coords.length === 0) return;
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  const pad = Math.min(70, w / 6, h / 6);
  const padding = { top: pad, bottom: pad, right: pad, left: panelOpen && w > 640 ? pad + 230 : pad };
  if (coords.length === 1) {
    map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 6.5), padding, duration: 1200 });
    return;
  }
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  map.fitBounds(
    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding, maxZoom: 7.5, duration: 1200 },
  );
}

export default function MapView() {
  const dark = usePrefersDark();
  const colors = dark ? DARK : LIGHT;
  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBorders, setShowBorders] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [speed, setSpeed] = useState(1);
  // Start collapsed on phones, where the panel would cover much of the map.
  const [nowOpen, setNowOpen] = useState(() => window.innerWidth >= 768);

  const chron = useStore((s) => s.chronologyId);
  const currentYear = useStore((s) => s.currentYear);
  const pxPerYear = useStore((s) => s.pxPerYear);
  const selection = useStore((s) => s.selection);
  const selectionNonce = useStore((s) => s.selectionNonce);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  useEffect(() => {
    let live = true;
    loadBaseStyle(dark)
      .then((s) => live && setStyle(s))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [dark]);

  const active = activeEvents(currentYear, pxPerYear, chron);
  const activeKey = active.map((e) => e.id).join(",");
  const { activeLocations, activeRegions, activeJourneys } = useMemo(() => {
    const evs = activeKey ? activeKey.split(",").map((id) => eventsById.get(id)!) : [];
    return {
      activeLocations: new Set(evs.flatMap((ev) => eventLocations(ev).map((l) => l.id))),
      activeRegions: new Set(evs.flatMap((ev) => ev.regions)),
      activeJourneys: evs.flatMap((ev) => (ev.journeyId ? [ev.journeyId] : [])),
    };
  }, [activeKey]);

  const selectedEvent = selection?.kind === "event" ? eventsById.get(selection.id) : undefined;

  // Fly to whatever was just selected, from either view.
  // Wait a frame so the map has its final size (opening the detail panel narrows it).
  useEffect(() => {
    if (!selection) return;
    const id = requestAnimationFrame(() => {
      const map = mapRef.current;
      if (!map) return;
      map.resize();
      frame(map, entityLocations(selection, chron).map((l) => l.coords as [number, number]), nowOpen);
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionNonce]);

  const applyBorders = () => {
    const map = mapRef.current?.getMap();
    if (!map?.isStyleLoaded()) return;
    for (const layer of map.getStyle().layers) {
      if (BORDER_LAYER.test(layer.id)) map.setLayoutProperty(layer.id, "visibility", showBorders ? "visible" : "none");
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(applyBorders, [showBorders]);

  const onClick = (e: MapLayerMouseEvent) => {
    const id = e.features?.[0]?.properties?.id;
    if (typeof id === "string") select({ kind: "location", id });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {style ? (
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{ bounds: INITIAL_BOUNDS }}
            mapStyle={style}
            interactiveLayerIds={[LOCATION_LAYER]}
            onClick={onClick}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onLoad={applyBorders}
            cursor={hovering ? "pointer" : "grab"}
            attributionControl={{ compact: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <RegionLayer selected={highlight?.regions ?? new Set()} active={activeRegions} colors={colors} />
            <JourneyLayer
              selectedJourney={selectedEvent?.journeyId}
              activeJourneys={activeJourneys}
              replayKey={selectionNonce}
              colors={colors}
            />
            <EventLayer selected={highlight?.locations ?? new Set()} active={activeLocations} colors={colors} />
          </Map>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-ink-muted">
            {error ? `Couldn't load the base map. ${error}` : "Loading map…"}
          </div>
        )}
        <NowPanel events={active} open={nowOpen} setOpen={setNowOpen} />
        <button
          onClick={() => setShowBorders(!showBorders)}
          aria-pressed={showBorders}
          className={`absolute bottom-3 left-3 z-10 rounded-md border border-line px-2 py-1 text-xs shadow-sm ${
            showBorders ? "bg-ink text-paper" : "bg-paper/90 text-ink-muted"
          }`}
        >
          Modern borders
        </button>
      </div>
      <TimeStrip speed={speed} setSpeed={setSpeed} />
    </div>
  );
}
