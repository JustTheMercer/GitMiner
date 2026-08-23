import type { ContributionGrid, OreCell, Point } from "../types.js";

const distance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const direction = (from: Point, to: Point) => ({
  x: Math.sign(to.x - from.x),
  y: Math.sign(to.y - from.y),
});

/**
 * Local-cluster traversal with a forward calendar frontier. Adjacent blocks
 * win first, then nearby blocks in the forward two-column frontier. Direction
 * is used only as a tie-breaker, so visual stability never creates a longer
 * jump than the nearest available candidate.
 */
export function createMiningPath(grid: ContributionGrid): OreCell[] {
  const remaining = grid.cells
    .filter((cell) => cell.level > 0)
    .sort((a, b) => a.x - b.x || (a.x % 2 === 0 ? a.y - b.y : b.y - a.y));
  if (remaining.length < 2) return remaining;

  const path: OreCell[] = [];
  let cursor: Point = { x: -1, y: 6 };
  let heading = { x: 1, y: 0 };

  while (remaining.length) {
    const frontierX = remaining[0]!.x;
    const candidates = remaining
      .map((cell, index) => ({ cell, index }))
      .filter(({ cell }) => cell.x <= frontierX + 2);

    candidates.sort((a, b) => {
      const changesDirection = (cell: OreCell) => {
        const next = direction(cursor, cell);
        return (
          (heading.x !== 0 && next.x !== 0 && heading.x !== next.x) ||
          (heading.y !== 0 && next.y !== 0 && heading.y !== next.y)
        );
      };
      return (
        distance(cursor, a.cell) - distance(cursor, b.cell) ||
        a.cell.x - b.cell.x ||
        Number(changesDirection(a.cell)) - Number(changesDirection(b.cell)) ||
        a.cell.y - b.cell.y
      );
    });

    const next = candidates[0]!;
    const nextHeading = direction(cursor, next.cell);
    if (nextHeading.x !== 0 || nextHeading.y !== 0) heading = nextHeading;
    path.push(next.cell);
    cursor = next.cell;
    remaining.splice(next.index, 1);
  }

  return path;
}
