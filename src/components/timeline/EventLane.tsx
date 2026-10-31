import { useMemo } from "react";
import { data, datesFor, peopleById } from "../../data";
import type { Event, Lane } from "../../data/schema";
import { formatDateSpec, specExtent, type DateSpec } from "../../lib/dates";
import { hasLifeMarks, lifeMarkPerson, shownLanes } from "../../lib/entities";
import type { TimeScale } from "../../lib/timeScale";
import { useHighlight } from "../../state/highlight";
import { useStore } from "../../state/store";
import { hoverProps, type OnHover } from "./hover";
import { packIntervals } from "./pack";

const LABEL_HEIGHT = 18;
const SPAN_COLUMN = 10;
const DOT_SIZE = 12;
/** Dots in a cluster sit this far apart. */
const DOT_STEP = DOT_SIZE + 2;
/** At most this many dots side by side; the rest fold into a "+N" badge. */
const MAX_CLUSTER = 5;
const BADGE_WIDTH = 26;
/** Spans shorter than this many pixels are drawn as points. */
const MIN_SPAN_PX = 14;

type Placed = { ev: Event; spec: DateSpec; lo: number; hi: number; column: number };

/** Events as dots (points) and bars (spans), with labels that hide rather than overlap. */
export default function EventLane({ scale, onHover, lanes }: { scale: TimeScale; onHover: OnHover; lanes: Lane[] }) {
  const chron = useStore((s) => s.chronologyId);
  const eraStyle = useStore((s) => s.eraStyle);
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const goTo = useStore((s) => s.goTo);
  const highlight = useHighlight();

  // Span columns depend only on the data, not on scroll position, so bars don't jump around.
  const { placed, spanColumns } = useMemo(() => {
    const items: Placed[] = [];
    for (const ev of data.events) {
      const spec = datesFor(ev, chron);
      if (!spec) continue;
      const [lo, hi] = specExtent(spec);
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
  // Layout happens in fixed coordinates (year × zoom), over every event, not just those on
  // screen, and is shifted into view only when drawn. Then clusters and labels depend only on
  // zoom: in screen pixels, rounding as the cursor moves flipped dots exactly a dot apart in
  // and out of clusters, and starting from the topmost visible dot regrouped them (jitter).
  const shift = scale.currentYear * scale.pxPerYear - scale.height / 2;
  const viewTop = shift;
  const viewBottom = shift + scale.height;
  const all: Row[] = [];
  for (const p of placed) {
    const top = p.lo * scale.pxPerYear;
    const bottom = p.hi * scale.pxPerYear;
    const asSpan = p.spec.end !== undefined && bottom - top >= MIN_SPAN_PX;
    const mid = (top + bottom) / 2;
    // A span's label stays in view while its bar is.
    const labelY = asSpan ? Math.min(Math.max(top, viewTop + 4) + LABEL_HEIGHT / 2, bottom - LABEL_HEIGHT / 2) : mid;
    all.push({ ...p, top, bottom, asSpan, labelY, nudge: 0, labelShift: 0 });
  }

  // Events within a larger event (the Red Sea in the Exodus) fold into it until it's long
  // enough to draw as a bar, and routine births and deaths are marks on their person's lane while
  // it's shown. A selected one always shows.
  const isSelected = (ev: Event) => selection?.kind === "event" && selection.id === ev.id;
  const byId = new Map(all.map((r) => [r.ev.id, r]));
  const rows = all.filter((r) => {
    if (isSelected(r.ev)) return true;
    const markedOn = lifeMarkPerson(r.ev, chron);
    const person = markedOn ? peopleById.get(markedOn)! : undefined;
    if (person && shownLanes(person, lanes).some((l) => hasLifeMarks(person, l))) return false;
    const parent = r.ev.partOf ? byId.get(r.ev.partOf) : undefined;
    return !parent || parent.asSpan;
  });

  // Which events win when space is short: the selection, then highlighted, then major events.
  const isLit = (ev: Event) => !highlight || highlight.events.has(ev.id);
  const rank = (r: Row) => 4 * Number(isSelected(r.ev)) + 2 * Number(isLit(r.ev)) + Number(r.ev.major);
  const byRank = (a: Row, b: Row) => rank(b) - rank(a) || a.labelY - b.labelY;

  // Dots that would overlap are nudged sideways into a small cluster, in time order, so each
  // stays clickable. Past MAX_CLUSTER, the lowest-ranked fold into a "+N" badge that zooms in.
  // Labels then start after the whole cluster.
  type Cluster = { top: number; bottom: number; width: number; folded: Row[] };
  const clusters: Cluster[] = [];
  const hidden = new Set<Row>();
  const dots = rows.filter((r) => !r.asSpan).sort((a, b) => a.labelY - b.labelY);
  for (let start = 0; start < dots.length; ) {
    let end = start + 1;
    while (end < dots.length && dots[end].labelY - dots[start].labelY < DOT_SIZE) end++;
    const group = dots.slice(start, end);
    const keep = new Set(group.length <= MAX_CLUSTER ? group : [...group].sort(byRank).slice(0, MAX_CLUSTER - 1));
    const shown = group.filter((r) => keep.has(r));
    const folded = group.filter((r) => !keep.has(r));
    folded.forEach((r) => hidden.add(r));
    const width = shown.length * DOT_STEP + (folded.length ? BADGE_WIDTH : 0);
    shown.forEach((r, i) => {
      r.nudge = i * DOT_STEP;
      r.labelShift = width - (i + 1) * DOT_STEP;
    });
    clusters.push({ top: group[0].labelY, bottom: group[group.length - 1].labelY, width, folded });
    start = end;
  }

  // Greedy label placement, best-ranked first. A span's label can slide down its bar to
  // find room, so a journey stays labelled beside the events at its start. Labels that
  // follow the scroll (a span whose start is above the view) go last, so they don't knock
  // fixed labels in and out of view as they pass.
  const onScreen = (r: Row) => r.bottom >= viewTop - 40 && r.top <= viewBottom + 40;
  const visible = rows.filter((r) => !hidden.has(r));
  const taken: number[] = [];
  const showLabel = new Set<string>();
  const free = (y: number) => !taken.some((t) => Math.abs(t - y) < LABEL_HEIGHT);
  const follows = (r: Row) => r.asSpan && r.top < viewTop + 4;
  for (const r of [...visible].sort((a, b) => Number(follows(a)) - Number(follows(b)) || byRank(a, b))) {
    let y = r.labelY;
    if (r.asSpan) {
      const last = Math.min(r.bottom, viewBottom) - LABEL_HEIGHT / 2;
      while (!free(y) && y + LABEL_HEIGHT <= last) y += LABEL_HEIGHT;
    }
    if (!free(y)) continue;
    r.labelY = y;
    taken.push(y);
    showLabel.add(r.ev.id);
  }

  // Labels start after every cluster beside them, not just their own, so a label never covers
  // the dots of a wider cluster just above or below. Span labels line up with the dot labels.
  const widthBeside = (y: number) => Math.max(
    DOT_STEP,
    ...clusters
      .filter((c) => c.top - DOT_SIZE / 2 < y + LABEL_HEIGHT / 2 && c.bottom + DOT_SIZE / 2 > y - LABEL_HEIGHT / 2)
      .map((c) => c.width),
  );
  for (const r of rows) {
    if (r.asSpan) r.labelShift = widthBeside(r.labelY) + 4;
    else if (showLabel.has(r.ev.id)) r.labelShift = widthBeside(r.labelY) - r.nudge - DOT_STEP;
  }

  // Zoom in on a folded cluster until its dots spread out.
  const spreadCluster = (c: Cluster) => {
    const n = c.folded.length + MAX_CLUSTER;
    const spreadPx = Math.max(c.bottom - c.top, 1);
    goTo((c.top + c.bottom) / 2 / scale.pxPerYear, scale.pxPerYear * Math.max(2, (n * LABEL_HEIGHT) / spreadPx));
  };

  return (
    <div className="relative min-w-0 flex-1">
      {visible.filter(onScreen).map((r) => {
        const { ev, spec } = r;
        const selected = isSelected(ev);
        const lit = isLit(ev);
        const dateText = formatDateSpec(spec, eraStyle);
        const dim = lit ? "" : "opacity-35";
        const fuzzy = spec.confidence !== "exact";
        const left = r.asSpan ? dotX - 6 + r.labelShift : dotX - 6 + r.nudge;

        return (
          // Hovering the bar or the label highlights both.
          <div key={ev.id} className={`group/event ${dim}`}>
            {r.asSpan && (
              <button
                tabIndex={-1}
                aria-hidden
                onClick={() => select({ kind: "event", id: ev.id })}
                {...hoverProps({ kind: "event", id: ev.id }, onHover)}
                className={`absolute w-1.5 rounded-full ${selected ? "bg-accent" : "bg-ink/60 group-hover/event:bg-accent"}`}
                style={{
                  left: r.column * SPAN_COLUMN + 6,
                  top: r.top - shift,
                  height: r.bottom - r.top,
                  // Approximate spans fade at the ends.
                  maskImage: fuzzy ? "linear-gradient(transparent, black 8px, black calc(100% - 8px), transparent)" : undefined,
                }}
              />
            )}
            <button
              onClick={() => select({ kind: "event", id: ev.id })}
              {...hoverProps({ kind: "event", id: ev.id }, onHover)}
              aria-label={`${ev.title}, ${dateText}`}
              aria-pressed={selected}
              className="absolute flex -translate-y-1/2 items-center gap-1.5 rounded pr-1 text-left"
              style={{ top: r.labelY - shift, left, maxWidth: `calc(100% - ${left}px)` }}
            >
              {!r.asSpan && (
                <span
                  className={`size-3 shrink-0 rounded-full border-2 ${
                    selected ? "border-accent bg-accent ring-4 ring-accent/25"
                    : spec.confidence === "unknown" ? "border-dashed border-ink/60 bg-paper"
                    : "border-ink/70 bg-paper group-hover/event:border-accent"
                  }`}
                />
              )}
              {showLabel.has(ev.id) && (
                <span
                  style={{ marginLeft: r.asSpan ? 0 : r.labelShift }}
                  className={`truncate rounded px-1 text-[13px] leading-[18px] ${
                    selected ? "bg-accent text-paper" : "bg-paper/75 group-hover/event:text-accent"
                  }`}
                >
                  {ev.title}
                </span>
              )}
            </button>
          </div>
        );
      })}
      {/* Last, so the labels of the dots beside them don't cover them. */}
      {clusters.filter((c) => c.folded.length > 0 && c.bottom >= viewTop - 40 && c.top <= viewBottom + 40).map((c) => (
        <button
          key={`more-${c.folded[0].ev.id}`}
          onClick={() => spreadCluster(c)}
          aria-label={`${c.folded.length} more events here; zoom in`}
          className={`absolute flex h-4 -translate-y-1/2 items-center rounded-full border border-ink/50 bg-paper px-1 text-[10px] leading-none font-semibold text-ink-muted hover:border-accent hover:text-accent ${c.folded.some((r) => isLit(r.ev)) ? "" : "opacity-35"}`}
          style={{ top: (c.top + c.bottom) / 2 - shift, left: dotX - 6 + (c.width - BADGE_WIDTH), minWidth: BADGE_WIDTH - 4 }}
        >
          +{c.folded.length}
        </button>
      ))}
    </div>
  );
}
