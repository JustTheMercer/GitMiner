import type {
  AnimationEvent,
  ContributionGrid,
  Facing,
  MineEvent,
  OreCell,
  Point,
  Speed,
  Timeline,
} from "../types.js";
import { parseSpeed } from "../options.js";
import { createMiningPath } from "./traversal.js";

const PRESET_MULTIPLIER = {
  slow: 0.75,
  normal: 1,
  fast: 1.5,
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const pointDistance = (a: Point, b: Point) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const detailFactor = (activeCells: number) =>
  clamp(1.46 - activeCells * 0.0042, 0.84, 1.35);

export function speedMultiplier(speed: Speed = "normal"): number {
  const parsed = parseSpeed(speed);
  return typeof parsed === "number" ? parsed : PRESET_MULTIPLIER[parsed];
}

const hardMaxFor = (multiplier: number) =>
  clamp(60 / Math.sqrt(multiplier), 38, 90);

const facingFor = (from: Point, to: Point, fallback: Facing): Facing => {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  return fallback;
};

export function targetDuration(
  activeCells: number,
  speed: Speed = "normal",
): number {
  const parsedSpeed = parseSpeed(speed);
  const multiplier = speedMultiplier(parsedSpeed);
  const detail = detailFactor(activeCells);
  const factor = 1 / multiplier;
  const assumedHits = activeCells * 2.5;
  const assumedDistance = activeCells * 1.35;
  const hit = clamp(
    0.06 * detail * factor,
    multiplier > 1.25 ? 0.05 : 0.055,
    0.08,
  );
  const move = clamp((0.032 + 1.35 * 0.015) * detail * factor, 0.05, 0.3);
  return Math.min(
    hardMaxFor(multiplier),
    3.1 * factor + assumedHits * hit + assumedDistance * (move / 1.35),
  );
}

function createNaturalTimeline(
  grid: ContributionGrid,
  path: OreCell[],
  speed: Speed,
  showStats: boolean,
  compression: number,
  naturalDuration: number,
): Timeline {
  const multiplier = speedMultiplier(speed);
  const factor = 1 / multiplier;
  const detail = detailFactor(path.length);
  const isCompressed = compression < 0.995;
  const hitFloor = isCompressed ? 0.045 : multiplier > 1.25 ? 0.05 : 0.055;
  const moveFloor = isCompressed ? 0.035 : multiplier > 1.25 ? 0.045 : 0.05;
  const naturalHit = 0.06 * detail * factor * compression;
  const hitCeiling =
    multiplier < 0.9 ? 0.09 : multiplier > 1.25 ? 0.075 : 0.078;
  const breakDuration = clamp(
    0.075 * detail * factor * Math.sqrt(compression),
    0.05,
    0.11,
  );
  const particleLifetime = clamp(0.18 * factor, 0.145, 0.22);
  const intro = clamp(0.55 * factor, 0.44, 0.7);
  const statsDuration = clamp(1.7 * factor, 1.35, 2.1);
  const resetPause = clamp(0.42 * factor, 0.34, 0.52);

  const events: AnimationEvent[] = [];
  let cursor: Point = { x: -1, y: 6 };
  let facing: Facing = "right";
  let time = intro;
  let travelDistance = 0;
  let totalHits = 0;
  let lastBreakEnd = time;
  let lastEffectEnd = time;

  path.forEach((cell) => {
    const distance = pointDistance(cursor, cell);
    const nextFacing = facingFor(cursor, cell, facing);
    const horizontalDistance = Math.abs(cell.x - cursor.x);
    const via =
      horizontalDistance > 0 && cell.y !== cursor.y
        ? { x: cell.x, y: cursor.y }
        : undefined;
    const moveDuration = clamp(
      (0.032 + distance * 0.015) * detail * factor * compression,
      moveFloor,
      isCompressed ? 0.22 : 0.3,
    );
    const moveStart = time;
    const viaAt = via
      ? moveStart + moveDuration * (horizontalDistance / distance)
      : undefined;
    events.push({
      type: "move",
      from: cursor,
      to: cell,
      ...(via && viaAt !== undefined ? { via, viaAt } : {}),
      fromFacing: facing,
      facing: nextFacing,
      easing: "ease-in-out",
      start: time,
      duration: moveDuration,
      turnEnd: time + Math.min(0.025, moveDuration * 0.25),
    });
    time += moveDuration;
    travelDistance += distance;
    facing = nextFacing;

    for (let hit = 1; hit <= cell.hits; hit += 1) {
      const isFinal = hit === cell.hits;
      const rhythm = isFinal ? 1.08 : hit % 2 === 0 ? 0.97 : 1.02;
      const duration = clamp(naturalHit * rhythm, hitFloor, hitCeiling);
      const windupEnd = time + duration * 0.55;
      const impactAt = time + duration * 0.7;
      const impactEnd = time + duration * (isFinal ? 0.84 : 0.8);
      events.push({
        type: "mine",
        cell,
        hit,
        hits: cell.hits,
        isFinal,
        start: time,
        duration,
        windupEnd,
        impactAt,
        impactEnd,
        recoveryEnd: time + duration,
      });
      time += duration;
      totalHits += 1;
    }

    const fragmentAt = time + Math.min(0.025, breakDuration * 0.3);
    events.push({
      type: "break",
      cell,
      start: time,
      duration: breakDuration,
      fragmentAt,
    });
    events.push({
      type: "particles",
      cell,
      start: fragmentAt,
      duration: particleLifetime,
      peakAt: fragmentAt + Math.min(0.012, particleLifetime * 0.08),
      fadeAt: fragmentAt + particleLifetime * 0.58,
    });
    lastBreakEnd = Math.max(lastBreakEnd, time + breakDuration);
    lastEffectEnd = Math.max(lastEffectEnd, fragmentAt + particleLifetime);

    // Destruction continues while the miner starts walking to the next target.
    // This preserves readable fragments without serializing every decorative
    // effect into an excessively long cycle.
    cursor = cell;
  });

  // Replace the scene as soon as the final block has finished breaking.
  // Particles may finish beneath the short cross-fade, but the miner never
  // travels or changes stance after the final block.
  const statsStart = Math.max(time, lastBreakEnd);
  let duration: number;
  if (showStats) {
    const statsEvent = {
      type: "stats" as const,
      start: statsStart,
      duration: statsDuration,
      enterDuration: clamp(0.12 * factor, 0.1, 0.15),
      exitStart: statsStart + statsDuration - clamp(0.22 * factor, 0.18, 0.28),
    };
    events.push(statsEvent);
    duration = statsEvent.start + statsEvent.duration + resetPause;
  } else {
    duration = Math.max(statsStart, lastEffectEnd) + resetPause;
  }

  return {
    duration,
    events,
    path,
    stats: {
      totalContributions: grid.cells.reduce((sum, cell) => sum + cell.count, 0),
      activeDays: path.length,
      blocksMined: path.length,
      totalHits,
      travelDistance,
    },
    timing: {
      speed,
      speedMultiplier: multiplier,
      naturalDuration,
      compression,
      particleLifetime,
    },
  };
}

export function createTimeline(
  grid: ContributionGrid,
  speed: Speed = "normal",
  options: { showStats?: boolean } = {},
): Timeline {
  const parsedSpeed = parseSpeed(speed);
  const showStats = options.showStats ?? true;
  const path = createMiningPath(grid);
  let timeline = createNaturalTimeline(
    grid,
    path,
    parsedSpeed,
    showStats,
    1,
    0,
  );
  const naturalDuration = timeline.duration;
  const multiplier = speedMultiplier(parsedSpeed);
  const hardMax = hardMaxFor(multiplier);
  let compression = 1;

  for (
    let attempt = 0;
    attempt < 5 && timeline.duration > hardMax;
    attempt += 1
  ) {
    const fixedTime = (showStats ? 3.1 : 1.1) / multiplier;
    compression *= clamp(
      (hardMax - fixedTime) / Math.max(0.001, timeline.duration - fixedTime),
      0.55,
      0.98,
    );
    timeline = createNaturalTimeline(
      grid,
      path,
      parsedSpeed,
      showStats,
      compression,
      naturalDuration,
    );
  }

  timeline.timing.naturalDuration = naturalDuration;
  return timeline;
}

export function eventsForCell(
  timeline: Timeline,
  cell: OreCell,
): AnimationEvent[] {
  return timeline.events.filter(
    (event) =>
      "cell" in event && event.cell.x === cell.x && event.cell.y === cell.y,
  );
}

export function mineEvents(timeline: Timeline): MineEvent[] {
  return timeline.events.filter(
    (event): event is MineEvent => event.type === "mine",
  );
}
