import type {
  ContributionCell,
  ContributionLevel,
  OreCell,
  OreType,
} from "../types.js";

const ORE_BY_LEVEL: Record<ContributionLevel, OreType> = {
  0: "empty",
  1: "stone",
  2: "copper",
  3: "gold",
  4: "diamond",
};

export function contributionLevelToOre(level: ContributionLevel): OreType {
  return ORE_BY_LEVEL[level];
}

export function contributionToOre(cell: ContributionCell): OreCell {
  return {
    ...cell,
    ore: contributionLevelToOre(cell.level),
    hits: cell.level,
  };
}
