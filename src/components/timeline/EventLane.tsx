import { useMemo } from "react";
import { data, datesFor } from "../../data";
import type { Event } from "../../data/schema";
import { formatDateSpec, specBounds, specMidpoint, type DateSpec } from "../../lib/dates";
import { yearToPx, type TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { packIntervals } from "./pack";

const LABEL_HEIGHT = 18;
const SPAN_COLUMN = 10;
const DOT_SIZE = 12;
const MAX_CLUSTER = 6;
/** Spans shorter than this many pixels are drawn as points. */
const MIN_SPAN_PX = 14;

type Placed = { ev: Event; spec: DateSpec; lo: number; hi: number; column: number };

/** Events as dots (points) and bars (spans), with labels that hide rather than overlap. */
export default function EventLane({ scale }: { scale: TimeScale }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const highlight = useHighlight();

  // Span columns depend only on the data, not on scroll position, so bars don't jump around.
  const { placed, spanColumns } = useMemo(() => {
    const items: Placed[] = [];
    for (const ev of data.events) {
      const spec = datesFor(ev, chron);
      if (!spec) continue;
      const [lo, hi] = specBounds(spec);
      items.push({ ev, spec, lo, hi, column: 0 });
    }
    const spans = items.filter((p) => p.spec.end);
    const columns = packIntervals(spans.map((p) => [p.lo, p.hi]));
    spans.forEach((p, i) => (p.column = columns[i]));
    return { placed: items, spanColumns: Math.max(0, ...columns) + 1 };
  }, [chron]);

  const dotX = spanColumns * SPAN_COLUMN + 10;

  type Row = Placed & {
    top: number; bottom: number; asSpan: boolean; labelY: number; nudge: number; labelShift: number;
  };
  const rows: Row[] = [];
  for (const p of placed) {
    const top = yearToPx(scale, p.lo);
    const bottom = yearToPx(scale, p.hi);
    if (bottom < -40 || top > scale.height + 40) continue;
    const asSpan = p.spec.end !== undefined && bottom - top >= MIN_SPAN_PX;
    const mid = yearToPx(scale, specMidpoint(p.spec));
    const labelY = asSpan ? Math.min(Math.max(top, 4) + LABEL_HEIGHT / 2, bottom - LABEL_HEIGHT / 2) : mid;
    rows.push({ ...p, top, bottom, asSpan, labelY, nudge: 0, labelShift: 0 });
  }

  // Dots that would overlap are nudged sideways into a small cluster, so each stays clickable.
  // Labels then start after the whole cluster.
  const dots = rows.filter((r) => !r.asSpan).sort((a, b) => a.labelY - b.labelY);
  for (let start = 0; start < dots.length; ) {
    let end = start + 1;
    while (end < dots.length && dots[end].labelY - dots[start].labelY < DOT_SIZE) end++;
    const size = Math.min(end - start, MAX_CLUSTER);
    for (let k = start; k < end; k++) {
      const i = Math.min(k - start, MAX_CLUSTER - 1);
      dots[k].nudge = i * (DOT_SIZE + 2);
      dots[k].labelShift = (size - 1 - i) * (DOT_SIZE + 2);
    }
    start = end;
  }

  // Greedy label placement, top to bottom. Highlighted events claim space first.
  const isSelected = (ev: Event) => selection?.kind === "event" && selection.id === ev.id;
  const isLit = (ev: Event) => !highlight || highlight.events.has(ev.id);
  const order = [...rows].sort(
    (a, b) => Number(isLit(b.ev)) - Number(isLit(a.ev)) || a.labelY - b.labelY,
  );
  const taken: number[] = [];
  const showLabel = new Set<string>();
  for (const r of order) {
    if (taken.some((y) => Math.abs(y - r.labelY) < LABEL_HEIGHT)) continue;
    taken.push(r.labelY);
    showLabel.add(r.ev.id);
  }

  return (
    <div className="relative min-w-0 flex-1">
      {rows.map((r) => {
        const { ev, spec } = r;
        const selected = isSelected(ev);
        const lit = isLit(ev);
        const dateText = formatDateSpec(spec, eraStyle);
        const dim = lit ? "" : "opacity-35";
        const fuzzy = spec.confidence !== "exact";

        return (
          <div key={ev.id} className={dim}>
            {r.asSpan && (
              <button
                tabIndex={-1}
                aria-hidden
                onClick={() => select({ kind: "event", id: ev.id })}
                className={`absolute w-1.5 rounded-full ${selected ? "bg-accent" : "bg-ink/60 hover:bg-accent"}`}
                style={{
                  left: r.column * SPAN_COLUMN + 6,
                  top: r.top,
                  height: r.bottom - r.top,
                  // Approximate spans fade at the ends.
                  maskImage: fuzzy ? "linear-gradient(transparent, black 8px, black calc(100% - 8px), transparent)" : undefined,
                }}
              />
            )}
            <button
              onClick={() => select({ kind: "event", id: ev.id })}
              title={`${ev.title} · ${dateText}`}
              aria-label={`${ev.title}, ${dateText}`}
              aria-pressed={selected}
              className="group absolute flex max-w-full -translate-y-1/2 items-center gap-1.5 rounded pr-1 text-left"
              style={{ top: r.labelY, left: r.asSpan ? r.column * SPAN_COLUMN + 14 : dotX - 6 + r.nudge }}
            >
              {!r.asSpan && (
                <span
                  className={`size-3 shrink-0 rounded-full border-2 ${
                    selected ? "border-accent bg-accent ring-4 ring-accent/25"
                    : spec.confidence === "unknown" ? "border-dashed border-ink/60 bg-paper"
                    : "border-ink/70 bg-paper group-hover:border-accent"
                  }`}
                />
              )}
              {showLabel.has(ev.id) && (
                <span
                  style={{ marginLeft: r.labelShift }}
                  className={`truncate rounded px-1 text-[13px] leading-[18px] ${
                    selected ? "bg-accent text-paper" : "bg-paper/75 group-hover:text-accent"
                  }`}
                >
                  {ev.title}
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
