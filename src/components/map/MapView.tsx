import * as maplibregl from "maplibre-gl";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { useEffect, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, useControl, type MapLayerMouseEvent, type MapRef } from "react-map-gl/maplibre";
import { datesFor, eventsById, journeysById, locationsById, regionsById, type EntityKind } from "../../data";
import type { Event } from "../../data/schema";
import { activeEvents } from "../../lib/activeEvents";
import { formatDateSpec } from "../../lib/dates";
import { borderBox, borderOf, bordersAt, loadBorders } from "../../lib/borders";
import { entityBounds, entityLocations, eventLocations, journeyOf } from "../../lib/entities";
import { shownBy } from "../../lib/filters";
import { eventForJourney } from "../../lib/journeys";
import { useIsDark, useIsPhone } from "../../lib/useMediaQuery";
import { computeHighlight, useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { addArrowImage } from "./arrowImage";
import { provideStopImages } from "./stopImage";
import { BORDER_LAYER, loadBaseStyle } from "./baseStyle";
import BorderLayer, { BORDER_FILL_LAYERS, BORDER_LABEL_LAYER } from "./BorderLayer";
import EventLayer, { LOCATION_LAYER, REGION_LABEL_LAYER } from "./EventLayer";
import JourneyLayer, { JOURNEY_HIT_LAYER } from "./JourneyLayer";
import { DARK, LIGHT } from "./mapColors";
import EventPopup from "./EventPopup";
import NowPanel from "./NowPanel";
import OffscreenSelection from "./OffscreenSelection";
import RegionLayer, { REGION_FILL_LAYER } from "./RegionLayer";
import TimeStrip from "./TimeStrip";

/** Maps already drawing journey stop markers on demand. */
const withStopImages = new WeakSet<maplibregl.Map>();

// MapLibre finds its worker relative to its own module, which breaks once Vite bundles it.
setWorkerUrl(workerUrl);

/** Egypt to Mesopotamia. */
const INITIAL_BOUNDS: [[number, number], [number, number]] = [[29, 24], [47.5, 38]];
/** Keep the map on the biblical world; never the whole globe. */
const MAX_BOUNDS: [number, number, number, number] = [-15, 5, 75, 55];
const MIN_ZOOM = 2.5;
/**
 * Places come from OpenBible.info (CC BY 4.0). OpenFreeMap, OpenMapTiles and OpenStreetMap
 * credit themselves through the tile source.
 */
const CREDITS = [
  '<a href="https://www.openbible.info/geo/">Places: OpenBible.info</a> (CC BY 4.0)',
  '<a href="https://github.com/Seshat-Global-History-Databank/cliopatria">Empires: Cliopatria</a> (CC BY 4.0)',
  '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
];
const FRAME_MIN_ZOOM = 3.5;
const FRAME_MAX_ZOOM = 7.5;

/** Listed top-most first: when layers overlap, the first one under the pointer wins. */
const INTERACTIVE = [LOCATION_LAYER, JOURNEY_HIT_LAYER, REGION_LABEL_LAYER, REGION_FILL_LAYER, BORDER_LABEL_LAYER, ...BORDER_FILL_LAYERS];
const isBorder = (layer: string) => layer === BORDER_LABEL_LAYER || BORDER_FILL_LAYERS.includes(layer);
/** How long the pointer rests inside a power's borders before its card shows. */
const REST_MS = 800;

/** A power's label and fill carry what its hover card says and what clicking it opens. */
type Hover = { layer: string; id: string; x: number; y: number; props?: Record<string, unknown> };

const EMPIRES_KEY = "bible-timeline:empires";
function loadShowEmpires(): boolean {
  try {
    return localStorage.getItem(EMPIRES_KEY) !== "off";
  } catch {
    return true;
  }
}
function saveShowEmpires(on: boolean) {
  try {
    if (on) localStorage.removeItem(EMPIRES_KEY);
    else localStorage.setItem(EMPIRES_KEY, "off");
  } catch {
    // Not remembered; it still applies now.
  }
}

/**
 * MapLibre's compact credits, starting folded behind their ⓘ button. Its own control opens them
 * on every new map until the first drag; folding them once the map has loaded left them open
 * for a moment, so they're folded as the control is created.
 */
class FoldedAttribution extends maplibregl.AttributionControl {
  onAdd(map: maplibregl.Map) {
    const el = super.onAdd(map);
    el.classList.remove("maplibregl-compact-show");
    return el;
  }
}

function Credits() {
  useControl(() => new FoldedAttribution({ compact: true, customAttribution: CREDITS }), { position: "bottom-right" });
  return null;
}

/** Fly to fit the given places, leaving room for the "Nearest events" panel when it's open. */
function frame(map: MapRef | maplibregl.Map, coords: [number, number][], panelOpen: boolean) {
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
  if (isBorder(hover.layer)) {
    const p = hover.props ?? {};
    title = String(p.name);
    const from = Number(p.from), to = Number(p.to);
    const years = formatDateSpec({ start: { year: from }, end: { year: to - 1 }, confidence: "approx" }, eraStyle, { yearsOnly: true });
    lines = [`Borders ${years}`, p.targetKind ? "Click for details" : ""].filter(Boolean);
  } else if (hover.layer === JOURNEY_HIT_LAYER) {
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

function MapToggle({ on, onChange, children }: { on: boolean; onChange: (on: boolean) => void; children: string }) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={`rounded-md border border-line px-2 py-1 text-xs shadow-sm ${on ? "bg-ink text-paper" : "bg-paper/90 text-ink-muted"}`}
    >
      {children}
    </button>
  );
}

export default function MapView() {
  const dark = useIsDark();
  const colors = dark ? DARK : LIGHT;
  const mapRef = useRef<MapRef>(null);
  const [style, setStyle] = useState<StyleSpecification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBorders, setShowBorders] = useState(false);
  const [showEmpires, setShowEmpires] = useState(loadShowEmpires);
  const [hover, setHover] = useState<Hover | null>(null);
  /** The map instance once loaded, for overlays positioned in screen space. */
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const isPhone = useIsPhone();
  const mode = useStore((s) => s.mode);
  // On phones, where there's no popup, the panel shows just the focus event (collapsed) beside
  // the timeline, and all of them when the map has the screen.
  const [nowOpen, setNowOpen] = useState(() => !isPhone || mode === "map");
  useEffect(() => {
    if (isPhone) setNowOpen(mode === "map");
  }, [isPhone, mode]);
  /**
   * The popup was closed (× or Escape): no focus event (no popup, journey, outlines or marked
   * row in Nearest events) while the reader scrubs, to watch the empires say, until they do
   * something with an event again. Nearest events says so, with a way back.
   */
  const [quiet, setQuiet] = useState(false);

  const chron = useStore((s) => s.chronologyId);
  const currentYear = useStore((s) => s.currentYear);
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

  const selectedEvent = selection?.kind === "event" ? eventsById.get(selection.id) : undefined;
  const focusHint = useStore((s) => s.focusHint);
  const hinted = !selectedEvent && focusHint?.year === currentYear ? eventsById.get(focusHint.id) : undefined;
  const filters = useStore((s) => s.filters);
  const active = activeEvents(currentYear, chron, selectedEvent ?? hinted, shownBy(filters, chron));
  const activeKey = active.map((e) => e.id).join(",");
  const activeLocations = useMemo(
    () => new Set(activeKey ? activeKey.split(",").flatMap((id) => eventLocations(eventsById.get(id)!).map((l) => l.id)) : []),
    [activeKey],
  );

  // One focus event gets its journey and regions drawn: the selected event, the event just
  // stepped to in Nearest events, or the nearest event happening now (among the place's events,
  // if a place is selected). A selected person, empire or era is what the map shows instead, so
  // a nearby event never reads as the selection (Herod's reign ends beside Jesus' birth).
  const showsSelection = selection !== null && selection.kind !== "event" && selection.kind !== "location";
  const focus: Event | undefined = selectedEvent ?? hinted
    ?? (showsSelection || quiet ? undefined : highlight ? active.find((ev) => highlight.events.has(ev.id)) : active[0]);
  // Escape with nothing else open hides the popup, like its ×.
  const escapeNonce = useStore((s) => s.escapeNonce);
  useEffect(() => {
    if (escapeNonce && focus && focus !== selectedEvent) setQuiet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escapeNonce]);
  // Only events bring them back: selecting one, stepping to one, or playing. Selecting a place
  // (or a person) and closing it leaves the map quiet.
  const playing = useStore((s) => s.playing);
  useEffect(() => {
    if (focusHint) setQuiet(false);
  }, [focusHint]);
  useEffect(() => {
    if (selection?.kind === "event") setQuiet(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionNonce]);
  useEffect(() => {
    if (playing) setQuiet(false);
  }, [playing]);
  const focusHighlight = useMemo(
    () => (focus ? computeHighlight({ kind: "event", id: focus.id }, chron) : null),
    [focus, chron],
  );

  // Without a selection, the focus event's places stand out.
  const strongPlaces = highlight?.locations ?? focusHighlight?.locations ?? new Set<string>();
  const strongRegions = highlight?.regions ?? new Set<string>();
  const focusRegions = focusHighlight?.regions ?? new Set<string>();
  // The regions labelled on the map (EventLayer labels a region only while something uses it).
  const regionLabels = [...new Set([...strongPlaces, ...activeLocations])].filter((id) => regionsById.has(id)).sort().join(",");

  const frameSelection = () => {
    const map = mapRef.current;
    if (!map || !selection) return;
    map.resize();
    const places = entityLocations(selection, chron).map((l) => l.coords as [number, number]);
    // An empire (or a king or era with an outline) is framed by its land as well as its places,
    // at the time selecting it moves to.
    const b = entityBounds(selection, chron);
    const year = b ? Math.min(Math.max(currentYear, b[0]), b[1] - 0.01) : currentYear;
    const target = selection;
    loadBorders()
      .then((all) => {
        if (useStore.getState().selection !== target) return;
        const land = bordersAt(all, year, chron).filter((f) => borderOf(f, target));
        frame(map, [...places, ...land.flatMap(borderBox)], nowOpen);
      })
      .catch(() => frame(map, places, nowOpen));
  };
  // Fly to whatever was just selected, from either view. Wait a frame so the map has
  // its final size (opening the detail panel narrows it). A selection made before the map
  // loaded (from a link, or in Timeline view) is framed once it does.
  useEffect(() => {
    if (!selection) return;
    const id = requestAnimationFrame(frameSelection);
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
    if (typeof id !== "string") return null;
    return { layer: f.layer.id, id, x: e.point.x, y: e.point.y, props: isBorder(f.layer.id) ? f.properties : undefined };
  };

  const onClick = (e: MapLayerMouseEvent) => {
    const hit = featureAt(e);
    if (!hit) return;
    if (hit.layer === JOURNEY_HIT_LAYER) {
      const ev = eventForJourney(hit.id);
      if (ev) select({ kind: "event", id: ev.id });
    } else if (isBorder(hit.layer)) {
      const { targetKind, targetId } = hit.props ?? {};
      if (typeof targetKind === "string" && typeof targetId === "string") select({ kind: targetKind as EntityKind, id: targetId });
    } else {
      select({ kind: "location", id: hit.id });
    }
  };

  // Inside a power's borders the card waits for the pointer to rest, so it doesn't follow every
  // pass across the map; a drag never shows it.
  const restTimer = useRef<number>(undefined);
  const onMouseMove = (e: MapLayerMouseEvent) => {
    window.clearTimeout(restTimer.current);
    const hit = featureAt(e);
    if (!hit || !BORDER_FILL_LAYERS.includes(hit.layer)) return setHover(hit);
    setHover(null);
    if (e.originalEvent.buttons === 0) restTimer.current = window.setTimeout(() => setHover(hit), REST_MS);
  };

  const hoveredRegion = hover && regionsById.has(hover.id) && (hover.layer === REGION_LABEL_LAYER || hover.layer === REGION_FILL_LAYER)
    ? hover.id : undefined;

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
            onMouseMove={onMouseMove}
            onMouseLeave={() => {
              window.clearTimeout(restTimer.current);
              setHover(null);
            }}
            onMoveStart={() => {
              window.clearTimeout(restTimer.current);
              setHover((h) => (h && BORDER_FILL_LAYERS.includes(h.layer) ? null : h));
            }}
            // The arrow image must exist before the journey layer first draws, so add it as
            // soon as style data arrives (and again whenever the style reloads).
            onStyleData={(e) => {
              addArrowImage(e.target);
              if (!withStopImages.has(e.target)) {
                withStopImages.add(e.target);
                provideStopImages(e.target);
              }
            }}
            onLoad={(e) => {
              setMap(e.target);
              applyBorders();
              frameSelection();
            }}
            cursor={hover ? "pointer" : "grab"}
            attributionControl={false}
            style={{ width: "100%", height: "100%" }}
          >
            <NavigationControl position="top-right" showCompass={false} />
            <Credits />
            <RegionLayer selected={strongRegions} focus={focusRegions} hovered={hoveredRegion} colors={colors} />
            {/* After the regions: its labels go beneath theirs. */}
            <BorderLayer
              year={currentYear}
              chron={chron}
              on={showEmpires}
              selection={selection}
              hovered={hover && isBorder(hover.layer) ? hover.id : undefined}
              dark={dark}
              regionLabels={regionLabels}
            />
            <JourneyLayer
              journeyId={focus && journeyOf(focus)}
              along={focus?.partOf ? focus : undefined}
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
        <NowPanel
          events={active}
          focusId={focus?.id}
          open={nowOpen}
          setOpen={setNowOpen}
          onShow={quiet && !selectedEvent && !showsSelection ? () => setQuiet(false) : undefined}
        />
        {/* The details panel already describes a selected event. Phones have no room for it. */}
        {!isPhone && focus && focus !== selectedEvent && (
          <EventPopup map={map} ev={focus} onClose={() => setQuiet(true)} />
        )}
        <OffscreenSelection
          map={map}
          onShow={() => map && selection && frame(map, entityLocations(selection, chron).map((l) => l.coords as [number, number]), nowOpen)}
        />
        <div data-map-obstacle className="absolute bottom-3 left-3 z-10 flex gap-1.5">
          <MapToggle
            on={showEmpires}
            onChange={(on) => {
              setShowEmpires(on);
              saveShowEmpires(on);
            }}
          >
            Empires
          </MapToggle>
          <MapToggle on={showBorders} onChange={setShowBorders}>Modern borders</MapToggle>
        </div>
      </div>
      <TimeStrip />
    </div>
  );
}
