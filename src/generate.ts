import { createContributionGrid } from "./core/grid.js";
import { createTimeline } from "./core/timeline.js";
import { fetchGitHubContributions } from "./github.js";
import { renderSvg } from "./svg.js";
import type {
  ContributionCell,
  GenerateOptions,
  RenderOptions,
} from "./types.js";

export function generateGitMinerFromContributions(
  contributions: ContributionCell[],
  options: RenderOptions,
): { svg: string } {
  const grid = createContributionGrid(contributions);
  const timeline = createTimeline(grid, options.speed, {
    showStats: options.showStats ?? true,
  });
  return { svg: renderSvg(grid, timeline, options) };
}

export async function generateGitMiner(
  options: GenerateOptions,
): Promise<{ svg: string }> {
  const token = options.githubToken ?? process.env.GITHUB_TOKEN ?? "";
  const contributions = await fetchGitHubContributions(options.username, token);
  const renderOptions: RenderOptions = {
    username: options.username,
    theme: options.theme ?? "github-light",
    speed: options.speed ?? "normal",
    effects: options.effects ?? "normal",
    showStats: options.showStats ?? true,
  };
  return generateGitMinerFromContributions(contributions, renderOptions);
}
