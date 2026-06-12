/**
 * Shared pagination math for /gallery.
 * Page 1: 1 hero + GRID_FIRST grid cells. Pages 2+: PER_PAGE cells (4×4).
 * (Underscore prefix: Astro skips this file as a route.)
 */
export const GRID_FIRST = 8;   // 4 columns × 2 rows
export const PER_PAGE = 16;    // 4 columns × 4 rows

export function pageCount(total: number): number {
  const rest = total - 1 - GRID_FIRST;        // items beyond page 1
  return rest > 0 ? 1 + Math.ceil(rest / PER_PAGE) : 1;
}

/** Slice of items shown on page n (n >= 2). */
export function pageSlice<T>(items: T[], n: number): T[] {
  const start = 1 + GRID_FIRST + (n - 2) * PER_PAGE;
  return items.slice(start, start + PER_PAGE);
}
