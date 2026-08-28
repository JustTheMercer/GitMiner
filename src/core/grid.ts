import { contributionToOre } from "./ore.js";
import type {
  ContributionCell,
  ContributionGrid,
  ContributionLevel,
} from "../types.js";

const DAY_MS = 86_400_000;

export function createContributionGrid(
  contributions: ContributionCell[],
  width = Math.max(53, ...contributions.map((cell) => cell.x + 1)),
): ContributionGrid {
  if (!Number.isInteger(width) || width < 1)
    throw new Error("Grid width must be a positive integer");

  const byPosition = new Map<string, ContributionCell>();
  for (const cell of contributions) {
    if (!Number.isInteger(cell.x) || cell.x < 0) {
      throw new Error(
        `Contribution x must be a non-negative integer: ${cell.x}`,
      );
    }
    if (!Number.isInteger(cell.y) || cell.y < 0 || cell.y > 6) {
      throw new Error(
        `Contribution y must be an integer from 0 to 6: ${cell.y}`,
      );
    }
    if (!Number.isInteger(cell.count) || cell.count < 0) {
      throw new Error(`Contribution count must be a non-negative integer`);
    }
    if (![0, 1, 2, 3, 4].includes(cell.level)) {
      throw new Error(`Contribution level must be an integer from 0 to 4`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cell.date)) {
      throw new Error(`Invalid contribution date: ${cell.date}`);
    }
    const key = `${cell.x}:${cell.y}`;
    if (byPosition.has(key)) {
      throw new Error(`Duplicate contribution position: ${key}`);
    }
    byPosition.set(key, cell);
  }
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
