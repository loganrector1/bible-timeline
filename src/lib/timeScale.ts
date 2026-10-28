import { MONTH_NAMES, MONTH_START_DAY, formatYear, type EraStyle } from "./dates";

/** Maps fractional years to pixels, with `currentYear` at the vertical center of the viewport. */
export type TimeScale = {
  currentYear: number;
  pxPerYear: number;
  height: number;
};

export function yearToPx(s: TimeScale, year: number): number {
  return s.height / 2 + (year - s.currentYear) * s.pxPerYear;
}

export function pxToYear(s: TimeScale, px: number): number {
  return s.currentYear + (px - s.height / 2) / s.pxPerYear;
}

export function visibleRange(s: TimeScale, marginPx = 0): [number, number] {
  return [pxToYear(s, -marginPx), pxToYear(s, s.height + marginPx)];
}

export type Tick = { year: number; label: string; major: boolean };

const MIN_GAP_PX = 56;
const YEAR_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Astronomical year from a signed historical year (-1446 = 1446 BC). There is no historical year 0. */
const astroFromSigned = (h: number) => (h < 0 ? h + 1 : h);
const signedFromAstro = (y: number) => (y <= 0 ? y - 1 : y);

/** Tick marks for the visible range, at round historical years (1500 BC, not 1499 BC) or at months. */
export function ticks(s: TimeScale, style: EraStyle): Tick[] {
  const [lo, hi] = visibleRange(s, 40);
  const daysPx = s.pxPerYear / 365;

  if (s.pxPerYear / 12 >= MIN_GAP_PX) {
    const out: Tick[] = [];
    // Below month spacing, add ticks on days 11 and 21 of each month.
    const days = daysPx * 10 >= MIN_GAP_PX ? [1, 11, 21] : [1];
    for (let y = Math.floor(lo); y <= Math.ceil(hi); y++) {
      for (let m = 0; m < 12; m++) {
        for (const d of days) {
          const year = y + (MONTH_START_DAY[m] + d - 1) / 365;
          if (year < lo || year > hi) continue;
          const month = MONTH_NAMES[m];
          const label = d === 1
            ? (m === 0 ? `${month} ${formatYear(y, style)}` : month)
            : `${d} ${month}`;
          out.push({ year, label, major: d === 1 && m === 0 });
        }
      }
    }
    return out;
  }

  const step = YEAR_STEPS.find((st) => st * s.pxPerYear >= MIN_GAP_PX) ?? YEAR_STEPS.at(-1)!;
  const majorStep = YEAR_STEPS.find((st) => st >= step * 5) ?? step * 5;
  const out: Tick[] = [];
  const hLo = signedFromAstro(Math.floor(lo));
  const hHi = signedFromAstro(Math.ceil(hi));
  for (let k = Math.ceil(hLo / step); k <= Math.floor(hHi / step); k++) {
    const h = k * step;
    if (h === 0) continue;
    const year = astroFromSigned(h);
    out.push({ year, label: formatYear(year, style), major: h % majorStep === 0 });
  }
  return out;
}

/** How precisely to show the cursor's date at the current zoom. */
export function cursorPrecision(pxPerYear: number): "year" | "month" | "day" {
  if (pxPerYear / 365 >= 8) return "day";
  if (pxPerYear / 12 >= 20) return "month";
  return "year";
}
