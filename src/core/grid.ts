import { contributionToOre } from "./ore.js";
import type {
  ContributionCell,
  ContributionGrid,
  ContributionLevel,
} from "../types.js";

const DAY_MS = 86_400_000;

export function createContributionGrid(
  contributions: ContributionCell[],
  width = 53,
): ContributionGrid {
  if (!Number.isInteger(width) || width < 1)
    throw new Error("Grid width must be a positive integer");

  const byPosition = new Map(
    contributions.map((cell) => [`${cell.x}:${cell.y}`, cell]),
  );
  const firstDate = contributions
    .map((cell) => cell.date)
    .filter(Boolean)
    .sort()[0];
  const origin = firstDate
    ? new Date(`${firstDate}T00:00:00Z`)
    : new Date("1970-01-04T00:00:00Z");

  const cells = Array.from({ length: width * 7 }, (_, index) => {
    const x = Math.floor(index / 7);
    const y = index % 7;
    const existing = byPosition.get(`${x}:${y}`);
    if (existing) return contributionToOre(existing);

    return contributionToOre({
      x,
      y,
      date: new Date(origin.getTime() + (x * 7 + y) * DAY_MS)
        .toISOString()
        .slice(0, 10),
      count: 0,
      level: 0 as ContributionLevel,
    });
  });

  return { width, height: 7, cells };
}
