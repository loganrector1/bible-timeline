/**
 * Assigns each interval to the leftmost column where it doesn't overlap the previous
 * interval in that column. Returns a column index per interval, in input order.
 */
export function packIntervals(intervals: [number, number][]): number[] {
  const order = intervals.map((_, i) => i).sort((a, b) => intervals[a][0] - intervals[b][0]);
  const columnEnds: number[] = [];
  const result = new Array<number>(intervals.length);
  for (const i of order) {
    const [lo, hi] = intervals[i];
    let col = columnEnds.findIndex((end) => end <= lo);
    if (col === -1) col = columnEnds.length;
    columnEnds[col] = hi;
    result[i] = col;
  }
  return result;
}
