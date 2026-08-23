import type { ContributionCell, ContributionLevel } from "./types.js";

export type FixtureSpec = {
  name: string;
  seed: number;
  density: number;
  maxCount: number;
};

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

export function createFixtureContributions(
  spec: FixtureSpec,
): ContributionCell[] {
  const next = random(spec.seed);
  const origin = Date.UTC(2025, 6, 13);
  return Array.from({ length: 53 * 7 }, (_, index) => {
    const x = Math.floor(index / 7);
    const y = index % 7;
    const wave = 0.72 + 0.28 * Math.sin((x + y * 2) / 4) ** 2;
    const active = next() < spec.density * wave;
    const intensity = active ? next() : 0;
    const level = (
      active ? Math.min(4, 1 + Math.floor(intensity * 4)) : 0
    ) as ContributionLevel;
    const count =
      level === 0
        ? 0
        : Math.max(
            level,
            Math.round((0.25 + intensity * 0.75) * spec.maxCount),
          );
    return {
      x,
      y,
      date: new Date(origin + index * 86_400_000).toISOString().slice(0, 10),
      count,
      level,
    };
  });
}
