// Dates use astronomical year numbering: 1 BC = 0, 2 BC = -1, 1446 BC = -1445.
// That keeps arithmetic simple; conversion to BC/AD happens only for display.
//
// Every TimePoint maps to a fractional-year interval [lo, hi). The timeline
// scale, the cursor and the map's time window all work in fractional years.

export type TimePoint = {
  /** Astronomical year (1 BC = 0). */
  year: number;
  /** Approximate Julian month 1–12, used for placement only. */
  month?: number;
  /** Day of month, used for placement only. */
  day?: number;
  /** How Scripture expresses it, e.g. "14 Nisan" or "3rd month". Shown instead of month/day. */
  label?: string;
};

export type Confidence = "exact" | "approx" | "range" | "unknown";

export type DateSpec = {
  start: TimePoint;
  end?: TimePoint;
  confidence: Confidence;
};

export type Precision = "year" | "month" | "day";

export type EraStyle = "BC" | "BCE";

export const MONTH_START_DAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function precisionOf(tp: TimePoint): Precision {
  if (tp.month === undefined) return "year";
  if (tp.day === undefined) return "month";
  return "day";
}

/** The fractional-year interval [lo, hi) covered by a TimePoint at its own precision. */
export function pointBounds(tp: TimePoint): [number, number] {
  if (tp.month === undefined) return [tp.year, tp.year + 1];
  const monthStart = MONTH_START_DAY[tp.month - 1];
  if (tp.day === undefined) {
    return [tp.year + monthStart / 365, tp.year + MONTH_START_DAY[tp.month] / 365];
  }
  const lo = tp.year + (monthStart + tp.day - 1) / 365;
  return [lo, lo + 1 / 365];
}

/** The TimePoint containing a fractional year, at the given precision. */
export function fromFractional(f: number, precision: Precision): TimePoint {
  const year = Math.floor(f);
  if (precision === "year") return { year };
  const dayOfYear = Math.min(364, Math.floor((f - year) * 365));
  const month = MONTH_START_DAY.findIndex((start) => start > dayOfYear);
  if (precision === "month") return { year, month };
  return { year, month, day: dayOfYear - MONTH_START_DAY[month - 1] + 1 };
}

/** Fractional-year interval covered by a DateSpec, from the start of `start` to the end of `end`. */
export function specBounds(spec: DateSpec): [number, number] {
  return [pointBounds(spec.start)[0], pointBounds(spec.end ?? spec.start)[1]];
}

/** A single representative position, e.g. for placing a point marker. */
export function specMidpoint(spec: DateSpec): number {
  const [lo, hi] = specBounds(spec);
  return (lo + hi) / 2;
}

export function isSpan(spec: DateSpec): boolean {
  return spec.end !== undefined;
}

/** Astronomical year -> historical year number and era. */
export function toHistorical(year: number): { n: number; bc: boolean } {
  return year <= 0 ? { n: 1 - year, bc: true } : { n: year, bc: false };
}

/** Historical year -> astronomical year. `fromHistorical(1446, true)` is -1445. */
export function fromHistorical(n: number, bc: boolean): number {
  return bc ? 1 - n : n;
}

function eraLabel(bc: boolean, style: EraStyle): string {
  if (style === "BCE") return bc ? "BCE" : "CE";
  return bc ? "BC" : "AD";
}

/** "1446 BC", "AD 30", "1446 BCE", "30 CE". AD goes before the number, by convention. */
export function formatYear(year: number, style: EraStyle = "BC"): string {
  const { n, bc } = toHistorical(year);
  if (!bc && style === "BC") return `AD ${n}`;
  return `${n} ${eraLabel(bc, style)}`;
}

/** Month/day part of a TimePoint without its year, or null at year precision. */
function formatSubYear(tp: TimePoint): string | null {
  if (tp.label) return tp.label;
  if (tp.month === undefined) return null;
  const month = MONTH_NAMES[tp.month - 1];
  return tp.day === undefined ? month : `${tp.day} ${month}`;
}

export function formatTimePoint(tp: TimePoint, style: EraStyle = "BC"): string {
  const year = formatYear(tp.year, style);
  if (tp.label) return `${tp.label}, ${year}`;
  const sub = formatSubYear(tp);
  return sub ? `${sub} ${year}` : year;
}

function formatYearRange(a: number, b: number, style: EraStyle): string {
  const ha = toHistorical(a);
  const hb = toHistorical(b);
  if (ha.bc !== hb.bc) return `${formatYear(a, style)} – ${formatYear(b, style)}`;
  if (!ha.bc && style === "BC") return `AD ${ha.n}–${hb.n}`;
  return `${ha.n}–${hb.n} ${eraLabel(ha.bc, style)}`;
}

/** `yearsOnly` drops months and days, for tight spaces ("1407 BC", "1445–1407 BC"). */
export function formatDateSpec(spec: DateSpec, style: EraStyle = "BC", { yearsOnly = false } = {}): string {
  if (spec.confidence === "unknown") return "Date unknown";
  const prefix = spec.confidence === "approx" ? "c. " : "";
  const start = yearsOnly ? { year: spec.start.year } : spec.start;
  const end = spec.end && (yearsOnly ? { year: spec.end.year } : spec.end);

  if (!end) return prefix + formatTimePoint(start, style);

  const subA = formatSubYear(start);
  const subB = formatSubYear(end);
  let body: string;
  if (start.year === end.year) {
    body = subA && subB
      ? `${subA} – ${subB}, ${formatYear(start.year, style)}`
      : formatYear(start.year, style);
  } else if (subA || subB) {
    body = `${formatTimePoint(start, style)} – ${formatTimePoint(end, style)}`;
  } else {
    body = formatYearRange(start.year, end.year, style);
  }
  return prefix + body;
}
