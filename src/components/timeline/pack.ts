/**
 * Assigns each interval to the leftmost column where it overlaps nothing already there.
 * Intervals with a `preset` column go there first (the kings of Judah and Israel each keep
 * their own). Returns a column index per interval, in input order.
 */
export function packIntervals(intervals: [number, number][], preset: (number | undefined)[] = []): number[] {
  const columns: [number, number][][] = [];
  const result = new Array<number>(intervals.length);
  const place = (i: number, col: number) => {
    (columns[col] ??= []).push(intervals[i]);
    result[i] = col;
  };
  intervals.forEach((_, i) => preset[i] !== undefined && place(i, preset[i]!));
  const order = intervals.map((_, i) => i).filter((i) => preset[i] === undefined).sort((a, b) => intervals[a][0] - intervals[b][0]);
  for (const i of order) {
    const [lo, hi] = intervals[i];
    let col = 0;
    while (columns[col]?.some(([a, b]) => a < hi && lo < b)) col++;
    place(i, col);
  }
  return result;
}
