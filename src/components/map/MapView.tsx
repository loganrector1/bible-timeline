import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { datesFor, eventsById, journeysById, locationsById, regionsById } from "../../data";
import type { Event } from "../../data/schema";
import { activeEvents } from "../../lib/activeEvents";
import { formatDateSpec } from "../../lib/dates";
import { entityLocations, eventLocations } from "../../lib/entities";
import { eventForJourney } from "../../lib/journeys";
import { usePrefersDark } from "../../lib/usePrefersDark";
import { computeHighlight, useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { addArrowImage } from "./arrowImage";
import { BORDER_LAYER, loadBaseStyle } from "./baseStyle";
import EventLayer, { LOCATION_LAYER, REGION_LABEL_LAYER } from "./EventLayer";
import JourneyLayer, { JOURNEY_HIT_LAYER } from "./JourneyLayer";
import { DARK, LIGHT } from "./mapColors";
import NowPanel from "./NowPanel";
import RegionLayer, { REGION_FILL_LAYER } from "./RegionLayer";
import TimeStrip from "./TimeStrip";

// MapLibre finds its worker relative to its own module, which breaks once Vite bundles it.
setWorkerUrl(workerUrl);

/** Egypt to Mesopotamia. */
const INITIAL_BOUNDS: [[number, number], [number, number]] = [[29, 24], [47.5, 38]];
/** Keep the map on the biblical world; never the whole globe. */
const MAX_BOUNDS: [number, number, number, number] = [-15, 5, 75, 55];
const MIN_ZOOM = 2.5;
const FRAME_MIN_ZOOM = 3.5;
const FRAME_MAX_ZOOM = 7.5;

/** Listed top-most first: when layers overlap, the first one under the pointer wins. */
const INTERACTIVE = [LOCATION_LAYER, JOURNEY_HIT_LAYER, REGION_LABEL_LAYER, REGION_FILL_LAYER];

type Hover = { layer: string; id: string; x: number; y: number };

/** Fly to fit the given places, leaving room for the "Happening now" panel when it's open. */
function frame(map: MapRef, coords: [number, number][], panelOpen: boolean) {
  if (coords.length === 0) return;
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  if (w < 80 || h < 80) return; // Not laid out yet; fitting now would zoom out to the whole world.
  const pad = Math.min(70, w / 6, h / 6);
  const left = panelOpen && w > 640 ? pad + 230 : pad;
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const camera = map.cameraForBounds(
    [[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]],
    { padding: { top: pad, bottom: pad, right: pad, left }, maxZoom: FRAME_MAX_ZOOM },
  );
  if (!camera) return;
  const zoom = Math.max(FRAME_MIN_ZOOM, coords.length === 1 ? Math.max(map.getZoom(), 6.5) : camera.zoom ?? FRAME_MIN_ZOOM);
  map.flyTo({ center: camera.center, zoom, duration: 1200 });
}

function HoverCard({ hover, chron }: { hover: Hover; chron: string }) {
  const eraStyle = useStore((s) => s.eraStyle);
  let title = "";
  let lines: string[] = [];
  if (hover.layer === JOURNEY_HIT_LAYER) {
    const journey = journeysById.get(hover.id);
    const ev = eventForJourney(hover.id);
    const spec = ev && datesFor(ev, chron);
    title = journey?.name ?? "";
    lines = [spec ? formatDateSpec(spec, eraStyle) : "", "Click for details"].filter(Boolean);
  } else {
    const loc = locationsById.get(hover.id);
    if (!loc) return null;
    title = loc.name;
    const kind = loc.type[0].toUpperCase() + loc.type.slice(1);
    lines = [loc.modernName ? `${kind} · today: ${loc.modernName}` : kind];
    if (loc.uncertain) lines.push("Location uncertain");
  }
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-64 rounded-lg border border-line bg-paper px-3 py-2 text-sm shadow-lg"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      <div className="font-semibold">{title}</div>
      {lines.map((l) => <div key={l} className="text-xs text-ink-muted">{l}</div>)}
    </div>
  );
}

export default function MapView() {
  const dark = usePrefersDark();
  const colors = dark ? DARK : LIGHT;
  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBorders, setShowBorders] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
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
  const activeLocations = useMemo(
    () => new Set(activeKey ? activeKey.split(",").flatMap((id) => eventLocations(eventsById.get(id)!).map((l) => l.id)) : []),
    [activeKey],
  );

  // One focus event gets its journey and regions drawn: the selected event, or the
  // nearest event happening now (among the selection's events, if something else is selected).
  const selectedEvent = selection?.kind === "event" ? eventsById.get(selection.id) : undefined;
  const focus: Event | undefined = selectedEvent
    ?? (highlight ? active.find((ev) => highlight.events.has(ev.id)) : active[0]);
  const focusHighlight = useMemo(
    () => (focus ? computeHighlight({ kind: "event", id: focus.id }, chron) : null),
    [focus, chron],
  );

  // Without a selection, the focus event's places stand out.
  const strongPlaces = highlight?.locations ?? focusHighlight?.locations ?? new Set<string>();
  const strongRegions = highlight?.regions ?? new Set<string>();
  const focusRegions = focusHighlight?.regions ?? new Set<string>();

  // Fly to whatever was just selected, from either view. Wait a frame so the map has
  // its final size (opening the detail panel narrows it).
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

  const featureAt = (e: MapLayerMouseEvent): Hover | null => {
    const f = e.features?.[0];
    if (!f) return null;
    const id = f.layer.id === JOURNEY_HIT_LAYER ? f.properties?.journeyId : f.properties?.id;
    return typeof id === "string" ? { layer: f.layer.id, id, x: e.point.x, y: e.point.y } : null;
  };

  const onClick = (e: MapLayerMouseEvent) => {
    const hit = featureAt(e);
    if (!hit) return;
    if (hit.layer === JOURNEY_HIT_LAYER) {
      const ev = eventForJourney(hit.id);
      if (ev) select({ kind: "event", id: ev.id });
    } else {
      select({ kind: "location", id: hit.id });
    }
  };

  const hoveredRegion = hover && regionsById.has(hover.id) && hover.layer !== JOURNEY_HIT_LAYER ? hover.id : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        {style ? (
          <Map
            ref={mapRef}
            mapLib={maplibregl}
            initialViewState={{ bounds: INITIAL_BOUNDS }}
            minZoom={MIN_ZOOM}
            maxBounds={MAX_BOUNDS}
            mapStyle={style}
            interactiveLayerIds={INTERACTIVE}
            onClick={onClick}
            onMouseMove={(e) => setHover(featureAt(e))}
            onMouseLeave={() => setHover(null)}
            // The arrow image must exist before the journey layer first draws, so add it as
            // soon as style data arrives (and again whenever the style reloads).
            onStyleData={(e) => addArrowImage(e.target)}
            onLoad={applyBorders}
            cursor={hover ? "pointer" : "grab"}
            attributionControl={{ compact: true }}
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <RegionLayer selected={strongRegions} focus={focusRegions} hovered={hoveredRegion} colors={colors} />
            <JourneyLayer
              journeyId={focus?.journeyId}
              animateKey={focus && focus === selectedEvent ? selectionNonce : null}
              hovered={hover?.layer === JOURNEY_HIT_LAYER}
              colors={colors}
            />
            <EventLayer selected={strongPlaces} active={activeLocations} colors={colors} />
          </Map>
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-ink-muted">
            {error ? `Couldn't load the base map. ${error}` : "Loading map…"}
          </div>
        )}
        {hover && <HoverCard hover={hover} chron={chron} />}
        <NowPanel events={active} focusId={focus?.id} open={nowOpen} setOpen={setNowOpen} />
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
      <TimeStrip />
    </div>
  );
}
