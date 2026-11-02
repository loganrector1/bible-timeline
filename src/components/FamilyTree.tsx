import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { familyOf, hasFamily, kinById, lineOf } from "../lib/family";
import { CARD_H, layoutFamily, type FamilyLayout, type LaidEdge } from "../lib/familyLayout";
import { useIsPhone } from "../lib/useMediaQuery";
import { useStore } from "../state/store";
import { ScriptureList } from "./detail/parts";

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
/** Moves shorter than this are taps, not drags. */
const DRAG_PX = 5;

type View = { x: number; y: number; k: number };

/**
 * The family tree, over the timeline and map: everyone related to the person or genealogy name
 * it's centred on, top to bottom like the timeline, with that one's line (parents, theirs, back
 * to Adam) drawn strongly. People open their details; names from the genealogies, which have no
 * entry of their own, say where Scripture names them.
 */
export default function FamilyTree() {
  const focus = useStore((s) => s.familyTree);
  const setFocus = useStore((s) => s.setFamilyTree);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const isPhone = useIsPhone();
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const glide = useRef(0);

  // Choosing someone in the tree's family elsewhere (the details panel, Browse) centres the tree on them.
  useEffect(() => {
    if (focus && selection?.kind === "person" && selection.id !== focus && hasFamily(selection.id)) setFocus(selection.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const layout = focus ? layoutFor(focus) : undefined;
  const line = useMemo(() => (focus ? lineOf(focus) : new Set<string>()), [focus]);

  /** Moves the view so the card sits below the middle (its ancestors are above), gliding unless `instant`. */
  const centre = (id: string, k: number, instant: boolean) => {
    const card = layout?.cards.get(id);
    const el = box.current;
    if (!card || !el) return;
    const to = { k, x: el.clientWidth / 2 - card.x * k, y: el.clientHeight * 0.62 - card.y * k };
    cancelAnimationFrame(glide.current);
    if (instant) return setView(to);
    const from = view;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 450);
      const e = 1 - (1 - t) ** 3;
      setView({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, k: from.k + (to.k - from.k) * e });
      if (t < 1) glide.current = requestAnimationFrame(step);
    };
    glide.current = requestAnimationFrame(step);
  };

  // Opening the tree centres it; a new focus moves it only when its card is out of sight (a card
  // just tapped stays where it is).
  const shownFamily = useRef<FamilyLayout>(undefined);
  useLayoutEffect(() => {
    if (!focus || !layout) return;
    const el = box.current!;
    if (shownFamily.current !== layout) {
      shownFamily.current = layout;
      centre(focus, isPhone ? 0.8 : 1, true);
      return;
    }
    const card = layout.cards.get(focus)!;
    const sx = card.x * view.k + view.x;
    const sy = card.y * view.k + view.y;
    const margin = 40;
    if (sx < margin || sx > el.clientWidth - margin || sy < margin || sy > el.clientHeight - margin) centre(focus, view.k, false);
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
        setView((v) => ({ ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y }));
      }
    } else if (pts.length === 2) {
      moved.current = DRAG_PX + 1;
      const other = pts.find((p) => p !== prev)!;
      const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
      const d1 = Math.hypot(next.x - other.x, next.y - other.y);
      const rect = box.current!.getBoundingClientRect();
      zoomAt((next.x + other.x) / 2 - rect.left, (next.y + other.y) / 2 - rect.top, d1 / d0);
    }
    pointers.current.set(e.pointerId, next);
  };
  const onPointerUp = (e: PointerEvent) => pointers.current.delete(e.pointerId);
  const zoomAt = (px: number, py: number, factor: number) =>
    setView((v) => {
      const k = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.k * factor));
      return { k, x: px - ((px - v.x) * k) / v.k, y: py - ((py - v.y) * k) / v.k };
    });
  const onWheel = (e: WheelEvent) => {
    cancelAnimationFrame(glide.current);
    if (e.ctrlKey) {
      const rect = box.current!.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY / 200));
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };
  const zoomBy = (factor: number) => {
    const el = box.current!;
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  if (!focus || !layout) return null;
  const focusKin = kinById(focus);
  const name = focusKin?.genealogy;

  const pick = (id: string) => {
    if (moved.current > DRAG_PX) return; // The end of a drag, not a tap.
    setFocus(id);
    if (kinById(id)?.person) select({ kind: "person", id });
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
    <div className="absolute inset-0 z-10 flex flex-col bg-paper" role="dialog" aria-label="Family tree">
      <div className="flex items-center justify-between gap-2 border-b border-line bg-paper-2 px-3 py-1.5">
        <div className="min-w-0">
          <h2 className="font-serif text-lg leading-tight font-semibold">Family tree</h2>
          <p className="truncate text-xs text-ink-muted">
            {focusKin?.name}’s line in colour. <span className="max-sm:hidden">Faint names are known only from the genealogies.</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out" className="rounded border border-line bg-paper px-2 text-lg leading-7 hover:bg-paper-2">−</button>
          <button onClick={() => zoomBy(1.3)} aria-label="Zoom in" className="rounded border border-line bg-paper px-2 text-lg leading-7 hover:bg-paper-2">+</button>
          <button onClick={() => centre(focus, view.k, false)} className="rounded border border-line bg-paper px-2 text-sm leading-7 hover:bg-paper-2 max-sm:hidden">
            Centre
          </button>
          <button onClick={() => setFocus(null)} aria-label="Close family tree" className="rounded p-1.5 text-ink-muted hover:bg-paper hover:text-ink">✕</button>
        </div>
      </div>

      <div
        ref={box}
        className="relative min-h-0 flex-1 touch-none overflow-hidden select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
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
            const isFocus = c.id === focus;
            const isPerson = !!kin.person;
            const style = isFocus
              ? "border-accent bg-accent text-paper"
              : line.has(c.id)
                ? isPerson ? "border-accent bg-accent-soft text-ink" : "border-accent/70 bg-paper text-ink"
                : isPerson ? "border-line bg-paper-2 text-ink" : "border-line bg-paper text-ink-muted";
            return (
              <button
                key={c.id}
                onClick={() => pick(c.id)}
                aria-current={isFocus || undefined}
                className={`absolute flex items-center justify-center rounded-full border px-2 text-sm whitespace-nowrap hover:border-accent ${isPerson ? "font-medium" : "border-dashed"} ${style}`}
                style={{ left: c.x - c.w / 2, top: c.y - c.h / 2, width: c.w, height: CARD_H }}
              >
                {kin.name}
              </button>
            );
          })}
        </div>

        {name && (
          // A genealogy name has no details panel, so it says what Scripture says of it here; at
          // the top on phones, where the details sheet covers the bottom.
          <div className="absolute inset-x-3 top-3 max-h-[45%] sm:top-auto sm:bottom-3 overflow-y-auto rounded-lg border border-line bg-paper p-3 shadow-lg sm:right-auto sm:w-80">
            <p className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">In the genealogies</p>
            <h3 className="font-serif text-lg leading-tight font-semibold">{name.name}</h3>
            {parentsLine(focus) && <p className="mt-1 text-sm text-ink-muted">{parentsLine(focus)}</p>}
            {name.note && <p className="mt-1.5 text-sm leading-relaxed">{name.note}</p>}
            <ScriptureList refs={name.scripture} />
          </div>
        )}
      </div>
    </div>
  );
}

/** "Child of Judah and Tamar"; "Child of Jehoiachin, or of Neri" where the Gospels' lines differ. */
function parentsLine(id: string) {
  const kin = kinById(id);
  const entry = kin?.genealogy ?? kin?.person;
  const names = (ids: string[]) => ids.map((p) => kinById(p)?.name ?? p).join(" and ");
  if (!entry?.parents.length) return undefined;
  return `Child of ${names(entry.parents)}${entry.altParents.length ? `, or of ${names(entry.altParents)}` : ""}`;
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
  const pts = [start, ...bends, end];
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const dy = (b.y - a.y) / 2;
    d += ` C${a.x},${a.y + dy} ${b.x},${b.y - dy} ${b.x},${b.y}`;
  }
  return d;
}
