import { describe, expect, it } from "vitest";
import { createContributionGrid } from "../src/core/grid.js";
import { contributionLevelToOre } from "../src/core/ore.js";
import {
  createTimeline,
  mineEvents,
  pointDistance,
} from "../src/core/timeline.js";
import { createMiningPath } from "../src/core/traversal.js";
import { createFixtureContributions } from "../src/fixture.js";
import type {
  AnimationEvent,
  ContributionCell,
  ContributionLevel,
  Speed,
  Timeline,
} from "../src/types.js";

const FIXTURES = {
  sparse: { name: "sparse", seed: 1107, density: 0.08, maxCount: 8 },
  medium: { name: "medium", seed: 202503, density: 0.32, maxCount: 24 },
  dense: { name: "dense", seed: 8675309, density: 0.78, maxCount: 80 },
} as const;

const fixture = createFixtureContributions({
  name: "test",
  seed: 42,
  density: 0.3,
  maxCount: 20,
});
const fixtureTimeline = (
  name: keyof typeof FIXTURES,
  speed: Speed = "normal",
) =>
  createTimeline(
    createContributionGrid(createFixtureContributions(FIXTURES[name])),
    speed,
  );
const eventsOfType = <T extends AnimationEvent["type"]>(
  timeline: Timeline,
  type: T,
) =>
  timeline.events.filter(
    (event): event is Extract<AnimationEvent, { type: T }> =>
      event.type === type,
  );

describe("ore mapping", () => {
  it("maps contribution levels to distinct ore types", () => {
    expect(
      [0, 1, 2, 3, 4].map((level) =>
        contributionLevelToOre(level as ContributionLevel),
      ),
    ).toEqual(["empty", "stone", "copper", "gold", "diamond"]);
  });
});

describe("grid conversion", () => {
  it("creates a deterministic 53 by 7 renderer-independent grid", () => {
    const grid = createContributionGrid(fixture);
    expect(grid).toMatchObject({ width: 53, height: 7 });
    expect(grid.cells).toHaveLength(371);
    expect(grid.cells[0]).toHaveProperty("ore");
  });
});

describe("traversal", () => {
  it("visits every active cell exactly once with a stable local route", () => {
    const grid = createContributionGrid(fixture);
    const path = createMiningPath(grid);
    const active = grid.cells.filter((cell) => cell.level > 0);
    expect(path).toHaveLength(active.length);
    expect(new Set(path.map((cell) => `${cell.x}:${cell.y}`)).size).toBe(
      active.length,
    );
    expect(createMiningPath(grid)).toEqual(path);
    const travel = path.reduce(
      (sum, cell, index) =>
        sum +
        pointDistance(index === 0 ? { x: -1, y: 6 } : path[index - 1]!, cell),
      0,
    );
    expect(travel).toBeLessThan(active.length * 2.5);
  });
});

describe("timeline", () => {
  it("contains movement, level-dependent hits, breakage, particles and stats", () => {
    const timeline = createTimeline(createContributionGrid(fixture));
    expect(eventsOfType(timeline, "move").length).toBeGreaterThan(0);
    expect(eventsOfType(timeline, "break").length).toBeGreaterThan(0);
    expect(eventsOfType(timeline, "particles").length).toBeGreaterThan(0);
    expect(timeline.events.at(-1)?.type).toBe("stats");
    for (const cell of timeline.path) {
      expect(
        mineEvents(timeline).filter((event) => event.cell === cell),
      ).toHaveLength(cell.level);
    }
  });

  it("makes harder ores take progressively longer to mine", () => {
    const cells: ContributionCell[] = [1, 2, 3, 4].map((level, x) => ({
      x,
      y: 3,
      date: `2025-01-0${x + 1}`,
      count: level,
      level: level as ContributionLevel,
    }));
    const timeline = createTimeline(createContributionGrid(cells, 4));
    const miningTime = cells.map((cell) =>
      mineEvents(timeline)
        .filter((event) => event.cell.x === cell.x && event.cell.y === cell.y)
        .reduce((sum, event) => sum + event.duration, 0),
    );
    expect(miningTime[1]).toBeGreaterThan(miningTime[0]!);
    expect(miningTime[2]).toBeGreaterThan(miningTime[1]!);
    expect(miningTime[3]).toBeGreaterThan(miningTime[2]!);
  });

  it("scales naturally with activity, hits and travel", () => {
    const sparse = fixtureTimeline("sparse");
    const medium = fixtureTimeline("medium");
    const dense = fixtureTimeline("dense");
    expect(sparse.duration).toBeGreaterThanOrEqual(10);
    expect(sparse.duration).toBeLessThanOrEqual(17);
    expect(medium.duration).toBeGreaterThanOrEqual(22);
    expect(medium.duration).toBeLessThanOrEqual(34);
    expect(dense.duration).toBeGreaterThanOrEqual(40);
    expect(dense.duration).toBeLessThanOrEqual(60);
    expect(sparse.stats.totalHits).toBeLessThan(medium.stats.totalHits);
    expect(medium.stats.totalHits).toBeLessThan(dense.stats.totalHits);
    expect(sparse.stats.travelDistance).toBeLessThan(
      medium.stats.travelDistance,
    );
    expect(medium.stats.travelDistance).toBeLessThan(
      dense.stats.travelDistance,
    );
  });

  it("preserves readable minimums and explicit mining phases", () => {
    for (const name of Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]) {
      const timeline = fixtureTimeline(name);
      for (const event of mineEvents(timeline)) {
        expect(event.duration).toBeGreaterThanOrEqual(0.055);
        expect(event.duration).toBeLessThanOrEqual(0.078);
        expect(event.start).toBeLessThan(event.windupEnd);
        expect(event.windupEnd - event.start).toBeGreaterThanOrEqual(0.03);
        expect(event.windupEnd).toBeLessThan(event.impactAt);
        expect(event.impactAt).toBeLessThan(event.impactEnd);
        expect(event.impactEnd).toBeLessThanOrEqual(event.recoveryEnd);
      }
      for (const event of eventsOfType(timeline, "break")) {
        expect(event.duration).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it("makes distant moves longer and labels them ease-in-out", () => {
    const cells: ContributionCell[] = [
      { x: 0, y: 6, date: "2025-01-01", count: 1, level: 1 },
      { x: 1, y: 6, date: "2025-01-02", count: 1, level: 1 },
      { x: 6, y: 6, date: "2025-01-03", count: 1, level: 1 },
    ];
    const moves = eventsOfType(
      createTimeline(createContributionGrid(cells, 7)),
      "move",
    );
    expect(moves).toHaveLength(3);
    expect(moves.every((event) => event.easing === "ease-in-out")).toBe(true);
    expect(moves[2]!.duration).toBeGreaterThan(moves[1]!.duration);
  });

  it("keeps absolute particle lifetimes independent of total density", () => {
    const lifetimes = (Object.keys(FIXTURES) as (keyof typeof FIXTURES)[]).map(
      (name) => fixtureTimeline(name).timing.particleLifetime,
    );
    expect(lifetimes).toEqual([0.18, 0.18, 0.18]);
    expect(lifetimes[0]).toBeGreaterThanOrEqual(0.12);
    expect(lifetimes[0]).toBeLessThanOrEqual(0.22);
  });

  it("supports slow, normal and fast without erasing important actions", () => {
    const slow = fixtureTimeline("medium", "slow");
    const normal = fixtureTimeline("medium", "normal");
    const fast = fixtureTimeline("medium", "fast");
    expect(slow.duration).toBeGreaterThan(normal.duration);
    expect(normal.duration).toBeGreaterThan(fast.duration);
    expect(Math.min(...mineEvents(fast).map((event) => event.duration))).toBe(
      0.05,
    );
    expect(
      Math.min(...eventsOfType(fast, "break").map((event) => event.duration)),
    ).toBeGreaterThanOrEqual(0.05);
    expect(fast.timing.particleLifetime).toBeGreaterThanOrEqual(0.12);
  });

  it("compresses an extreme calendar close to the hard cap", () => {
    const extreme: ContributionCell[] = Array.from(
      { length: 53 * 7 },
      (_, index) => ({
        x: Math.floor(index / 7),
        y: index % 7,
        date: new Date(Date.UTC(2025, 0, 1) + index * 86_400_000)
          .toISOString()
          .slice(0, 10),
        count: 10,
        level: ((index % 4) + 1) as ContributionLevel,
      }),
    );
    const timeline = createTimeline(createContributionGrid(extreme));
    expect(timeline.path).toHaveLength(371);
    expect(timeline.duration).toBeLessThanOrEqual(60);
    expect(timeline.timing.compression).toBeLessThan(1);
    expect(
      Math.min(...mineEvents(timeline).map((event) => event.duration)),
    ).toBe(0.045);
    expect(
      Math.min(
        ...eventsOfType(timeline, "particles").map((event) => event.duration),
      ),
    ).toBeGreaterThanOrEqual(0.12);
  });

  it("shows stats immediately after the final block finishes breaking", () => {
    const timeline = fixtureTimeline("dense");
    const stats = eventsOfType(timeline, "stats")[0]!;
    const finalBreakEnd = Math.max(
      ...timeline.events
        .filter((event) => event.type === "break")
        .map((event) => event.start + event.duration),
    );
    expect(stats.start).toBeCloseTo(finalBreakEnd, 8);
    expect(stats.enterDuration).toBeLessThanOrEqual(0.15);
    expect(stats.exitStart).toBeLessThan(stats.start + stats.duration);
  });
});
