import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, type PointerEvent } from "react";
import { formatYear } from "../lib/dates";
import { familyOf, hasFamily, kinById, lineOf } from "../lib/family";
import { CARD_H, layoutFamily, treeTime, type FamilyLayout, type LaidEdge } from "../lib/familyLayout";
import { useIsPhone } from "../lib/useMediaQuery";
import { useStore } from "../state/store";

/** One layout per family, computed when the tree first shows it. */
const layouts = new Map<string, FamilyLayout>();
function layoutFor(id: string) {
  const family = familyOf(id);
  const key = [...family].sort()[0];
  if (!layouts.has(key)) layouts.set(key, layoutFamily(id));
  return layouts.get(key)!;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
/** The height a line takes to move sideways: most of a row. */
const TURN = 40;
/** Moves shorter than this are taps, not drags. */
const DRAG_PX = 5;
/** How far above and below the cursor's row Center looks for the generations to center on. */
const ROWS_NEAR = 100;

type View = { x: number; y: number; k: number };

/**
 * The family tree, in the map's place while it's open: everyone related to the person or genealogy
 * name it's centered on, top to bottom like the timeline, with that one's line (parents, theirs,
 * back to Adam) drawn strongly. It keeps in step with the timeline: the row at its middle is the
 * generation alive at the cursor's year (`treeTime`), so scrubbing slides the tree and dragging
 * the tree moves the cursor; sideways it's free. Clicking anyone, person or genealogy name,
 * selects them, so both open in the details panel, and colors their line, which stays when the
 * panel closes; clicking them again clears both.
 */
export default function FamilyTree() {
  const focus = useStore((s) => s.familyTree);
  const setFocus = useStore((s) => s.setFamilyTree);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const currentYear = useStore((s) => s.currentYear);
  const isPhone = useIsPhone();
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, k: isPhone ? 0.8 : 1 });
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const glide = useRef(0);

  // Choosing someone with family elsewhere (the details panel, Browse) centers the tree on them,
  // sideways; up and down only if they're out of sight, unless they're a genealogy name, which
  // has no dates of its own to keep time from moving. A tap in the tree leaves the view be.
  const picked = useRef<string | null>(null);
  useEffect(() => {
    const kin = selection?.kind === "person" || selection?.kind === "name";
    if (!focus || !kin || !hasFamily(selection.id)) return;
    if (picked.current === selection.id) return void (picked.current = null);
    if (selection.id !== focus) setFocus(selection.id);
    // Another family's layout centers on them as it opens.
    if (layout?.cards.has(selection.id)) reveal(selection.id, selection.kind === "name" ? true : "x");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const layout = focus ? layoutFor(focus) : undefined;
  const time = useMemo(() => layout && treeTime(layout, chron), [layout, chron]);
  // The line in color: the last person selected, kept while the details panel is closed.
  const familyLine = useStore((s) => s.familyLine);
  const setFamilyLine = useStore((s) => s.setFamilyLine);
  const lit = familyLine && layout?.cards.has(familyLine) ? familyLine : undefined;
  const line = useMemo(() => (lit ? lineOf(lit) : new Set<string>()), [lit]);

  /** Sets the view, kept so the tree always reaches the middle of the box both ways. */
  const show = (to: View) => {
    const el = box.current;
    if (el && layout) {
      const clamp = (pos: number, size: number, extent: number) => Math.min(size / 2, Math.max(size / 2 - extent * to.k, pos));
      to = { k: to.k, x: clamp(to.x, el.clientWidth, layout.width), y: clamp(to.y, el.clientHeight, layout.height) };
    }
    view.current = to;
    redraw();
  };
  /**
   * The cursor's row in the box: level with the timeline's cursor, at the middle of the view.
   */
  const cursorY = () => {
    const el = box.current;
    return el ? (el.parentElement!.clientHeight / 2) - el.offsetTop : 0;
  };
  /** The y that puts a year's row on the cursor's. */
  const yFor = (year: number, k: number) => cursorY() - time!.yAt(year) * k;

  // The timeline leads: a year set anywhere but in the tree slides the tree to it.
  const fromTree = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!time || !box.current) return;
    if (fromTree.current === currentYear) return;
    fromTree.current = null;
    show({ ...view.current, y: yFor(currentYear, view.current.k) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentYear, time]);
  /** A move made in the tree, which takes the cursor to the year now at its middle. */
  const move = (to: View) => {
    cancelAnimationFrame(glide.current);
    show(to);
    if (!time) return;
    const year = time.yearAt((cursorY() - view.current.y) / view.current.k);
    useStore.getState().setYear(year);
    fromTree.current = useStore.getState().currentYear;
  };

  /**
   * Brings a card into view: sideways by gliding, up or down by moving time (or gliding, if
   * untimed). `always` centers it even if it's in sight; "x" centers it only sideways.
   */
  const reveal = (id: string, always: boolean | "x") => {
    const card = layout?.cards.get(id);
    const el = box.current;
    if (!card || !el) return;
    const { x, y, k } = view.current;
    const margin = 40;
    const sx = card.x * k + x;
    const sy = card.y * k + y;
    const offX = !!always || sx < margin || sx > el.clientWidth - margin;
    const offY = always === true || sy < margin || sy > el.clientHeight - margin;
    if (offY && time) useStore.getState().goTo(time.yearAt(card.y));
    if (!offX && (!offY || time)) return;
    glideTo({ x: offX ? el.clientWidth / 2 - card.x * k : x, y: offY && !time ? el.clientHeight / 2 - card.y * k : y });
  };
  const glideTo = (to: { x: number; y: number }) => {
    const { k } = view.current;
    const from = view.current;
    const t0 = performance.now();
    cancelAnimationFrame(glide.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 450);
      const e = 1 - (1 - t) ** 3;
      // While time glides it moves y; only what isn't time's is set here.
      show({ k, x: from.x + (to.x - from.x) * e, y: time ? view.current.y : from.y + (to.y - from.y) * e });
      if (t < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };

  /**
   * Center: on the person whose line is in color, else sideways on the generations at the cursor, which sit
   * in a different part of the tree in each age (Jacob's sons wide, Jesus' line narrow); an
   * untimed family centers as a whole.
   */
  const center = () => {
    const el = box.current;
    if (!layout || !el) return;
    if (lit) return reveal(lit, true);
    const { y, k } = view.current;
    glideTo({ x: rowCenterX(y, k), y });
  };
  /** The x that centers the generations at the cursor's row, for a view at `y` and scale `k`. */
  const rowCenterX = (y: number, k: number) => {
    const cards = [...layout!.cards.values()];
    const rowY = (cursorY() - y) / k;
    const near = cards.filter((c) => Math.abs(c.y - rowY) <= ROWS_NEAR);
    const row = !time ? cards : near.length ? near : [cards.reduce((a, b) => (Math.abs(a.y - rowY) < Math.abs(b.y - rowY) ? a : b))];
    const left = Math.min(...row.map((c) => c.x - c.w / 2));
    const right = Math.max(...row.map((c) => c.x + c.w / 2));
    return box.current!.clientWidth / 2 - ((left + right) / 2) * k;
  };

  // Opening the tree (or a family it wasn't showing) centers the focus sideways at the cursor's
  // year; then, as for any new focus, the view moves only if its card is out of sight. Opened
  // with no line in color (Browse's "Family tree" row with no one selected, a `tree=` link), it
  // stays at the cursor's year and centers on the generations there, as Center does.
  const shownFamily = useRef<FamilyLayout>(undefined);
  const shownFocus = useRef<string>(undefined);
  useLayoutEffect(() => {
    if (!focus || !layout || !box.current) return;
    // Only for a new focus: React runs effects twice in development.
    if (shownFocus.current === focus && shownFamily.current === layout) return;
    shownFocus.current = focus;
    if (shownFamily.current !== layout) {
      shownFamily.current = layout;
      const card = layout.cards.get(focus)!;
      const { k } = view.current;
      const el = box.current;
      const y = time ? yFor(useStore.getState().currentYear, k) : el.clientHeight / 2 - card.y * k;
      if (!lit) return show({ k, x: rowCenterX(y, k), y });
      show({ k, x: el.clientWidth / 2 - card.x * k, y });
    }
    reveal(focus, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, layout]);
  useEffect(() => () => cancelAnimationFrame(glide.current), []);

  // Dragging pans; two fingers pinch; the wheel pans, and zooms with Ctrl (a trackpad's pinch).
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(0);
  const onPointerDown = (e: PointerEvent) => {
    cancelAnimationFrame(glide.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = 0;
  };
  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const pts = [...pointers.current.values()];
    const next = { x: e.clientX, y: e.clientY };
    if (pts.length === 1) {
      moved.current += Math.hypot(next.x - prev.x, next.y - prev.y);
      if (moved.current > DRAG_PX) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        const v = view.current;
        move({ ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y });
      }
    } else if (pts.length === 2) {
      moved.current = DRAG_PX + 1;
      const other = pts.find((p) => p !== prev)!;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(next.x - other.x, next.y - other.y);
      zoomAt((next.x + other.x) / 2 - box.current!.getBoundingClientRect().left, d1 / d0);
    }
    pointers.current.set(e.pointerId, next);
  };
  const onPointerUp = (e: PointerEvent) => pointers.current.delete(e.pointerId);
  // Zooming holds the cursor's row (its year) still, so time doesn't move.
  const zoomAt = (px: number, factor: number) => {
    const v = view.current;
    const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.k * factor));
    const py = cursorY();
    show({ k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k });
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault(); // Or Ctrl+wheel zooms the page too.
    if (e.ctrlKey) zoomAt(e.clientX - box.current!.getBoundingClientRect().left, Math.exp(-e.deltaY / 200));
    else move({ ...view.current, x: view.current.x - e.deltaX, y: view.current.y - e.deltaY });
  };
  // React's wheel listeners are passive, so they can't stop the browser's zoom: a native one can.
  const wheel = useRef(onWheel);
  wheel.current = onWheel;
  const treeShown = !!(focus && layout);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const listen = (e: WheelEvent) => wheel.current(e);
    el.addEventListener("wheel", listen, { passive: false });
    return () => el.removeEventListener("wheel", listen);
  }, [treeShown]);
  const zoomBy = (factor: number) => zoomAt(box.current!.clientWidth / 2, factor);

  if (!focus || !layout) return null;
  const litKin = lit ? kinById(lit) : undefined;
  const { x, y, k } = view.current;

  const pick = (id: string) => {
    if (moved.current > DRAG_PX) return; // The end of a drag, not a tap.
    // Like a filter chip: tapping the selected card again clears it. With the details panel
    // closed, it opens them again first.
    if (id === lit && selection?.id === id) {
      select(null);
      return setFamilyLine(null);
    }
    setFocus(id);
    picked.current = id;
    select({ kind: kinById(id)?.person ? "person" : "name", id });
  };

  // An edge is on the line when both its ends are: a parent's link to its union, the union's to a child.
  const unionOnLine = new Set(layout.unions.filter((u) => u.children.some((c) => line.has(c))).map((u) => u.id));
  const onLine = (e: LaidEdge) => {
    if (e.alt) return line.has(e.from) && line.has(e.to);
    if (e.to.startsWith("u:")) return line.has(e.from) && unionOnLine.has(e.to);
    return unionOnLine.has(e.from) && line.has(e.to);
  };
  const edges = [...layout.edges].sort((a, b) => Number(onLine(a)) - Number(onLine(b)));

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-paper" role="region" aria-label="Family tree">
      <div
        ref={box}
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {time && (
          // The cursor's row: the generation alive at the timeline's year.
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent/50" style={{ top: cursorY() }}>
            <span className="absolute top-0.5 left-2 text-[11px] text-accent">{formatYear(Math.floor(currentYear), eraStyle)}</span>
          </div>
        )}
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${x}px, ${y}px) scale(${k})` }}>
          <svg width={layout.width} height={layout.height} className="absolute top-0 left-0 overflow-visible" aria-hidden>
            {edges.map((e) => (
              <path
                key={`${e.from}>${e.to}`}
                d={edgePath(e, layout)}
                fill="none"
                className={onLine(e) ? "stroke-accent" : "stroke-ink-muted/40"}
                strokeWidth={onLine(e) ? 2 : 1.25}
                strokeDasharray={e.alt ? "4 3" : undefined}
              />
            ))}
            {layout.unions.map((u) => (
              <circle key={u.id} cx={u.x} cy={u.y} r={2.5} className={unionOnLine.has(u.id) ? "fill-accent" : "fill-ink-muted/50"} />
            ))}
          </svg>
          {[...layout.cards.values()].map((c) => {
            const kin = kinById(c.id)!;
            const isFocus = c.id === lit;
            const isPerson = !!kin.person;
            const onTheLine = line.has(c.id);
            // Women are tinted rose and marked ♀, so a mother's line reads apart from a father's.
            const fill = isFocus ? "bg-accent text-paper"
              : kin.female ? "bg-woman-soft text-ink"
              : onTheLine && isPerson ? "bg-accent-soft text-ink"
              : isPerson ? "bg-paper-2 text-ink" : "bg-paper text-ink-muted";
            const border = isFocus || onTheLine ? "border-accent" : kin.female ? "border-woman/50" : "border-line";
            return (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                aria-pressed={isFocus}
                className={`absolute flex items-center justify-center gap-1 rounded-full border px-2 text-sm whitespace-nowrap hover:border-accent ${isPerson ? "font-medium" : "border-dashed"} ${fill} ${border}`}
                style={{ left: c.x - c.w / 2, top: c.y - c.h / 2, width: c.w, height: CARD_H }}
              >
                {kin.female && <span aria-hidden className={isFocus ? "" : "text-woman"}>♀</span>}
                {kin.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating, as on the timeline, so the tree keeps the whole view. */}
      <p aria-live="polite" className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-14rem)] rounded-md bg-paper/85 px-2 py-1 text-xs text-ink-muted max-sm:hidden">
        {litKin ? `${litKin.name}’s line in color` : "Select anyone to see their line"}; dashed names are known only from the genealogies.
      </p>
      {/* Under the phone's details sheet, which covers them rather than standing higher. */}
      <div className="absolute right-3 bottom-3 flex gap-1 text-sm">
        <button onClick={center} className="rounded-md border border-line bg-paper px-2 py-1 shadow-sm hover:bg-paper-2">Center</button>
        <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom the tree out" className="w-8 rounded-md border border-line bg-paper py-1 shadow-sm hover:bg-paper-2">−</button>
        <button onClick={() => zoomBy(1.3)} aria-label="Zoom the tree in" className="w-8 rounded-md border border-line bg-paper py-1 shadow-sm hover:bg-paper-2">+</button>
        <button onClick={() => setFocus(null)} aria-label="Close family tree" className="w-8 rounded-md border border-line bg-paper py-1 shadow-sm hover:bg-paper-2">✕</button>
      </div>
    </div>
  );
}

/**
 * A link drawn top to bottom: from a card's bottom edge (or a union's point) to the next one's top,
 * through dagre's bend points, each leg an S-curve leaving and arriving vertically.
 */
function edgePath(e: LaidEdge, layout: FamilyLayout) {
  const at = (id: string, end: "top" | "bottom") => {
    const card = layout.cards.get(id);
    if (card) return { x: card.x, y: card.y + (end === "top" ? -1 : 1) * (card.h / 2) };
    const u = layout.unions.find((u) => u.id === id)!;
    return { x: u.x, y: u.y };
  };
  const start = at(e.from, "bottom");
  const end = at(e.to, "top");
  // A link to the next row needs no bends: dagre's midpoint there can sit off to one side, so
  // the curve swung out and back. Longer links keep theirs, which steer round the cards between.
  const bends = e.points.length > 3 ? e.points.slice(1, -1).filter((p) => p.y > start.y + 6 && p.y < end.y - 6) : [];
  // Dagre's bends can sit just below the start or just above the end, far to one side, which drew
  // a flat dash and a sharp corner (David to Solomon, Terah to Nahor). A sideways move gets room:
  // the bend after it is pushed down, or before the end, the bend before it pulled up, so each is
  // a gentle S and the runs between are straight.
  const pts = [start, ...bends.map((p) => ({ ...p })), end];
  const last = pts.length - 1;
  for (let i = 1; i < last; i++) {
    if (Math.abs(pts[i].x - pts[i - 1].x) > 1) pts[i].y = Math.min(Math.max(pts[i].y, pts[i - 1].y + TURN), pts[i + 1].y);
  }
  if (last > 1 && Math.abs(pts[last].x - pts[last - 1].x) > 1) {
    pts[last - 1].y = Math.max(Math.min(pts[last - 1].y, pts[last].y - TURN), pts[last - 2].y);
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dy = (b.y - a.y) / 2;
    d += Math.abs(b.x - a.x) <= 1 ? ` L${b.x},${b.y}` : ` C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
  }
  return d;
}
