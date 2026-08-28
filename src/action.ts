import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createContributionGrid } from "./core/grid.js";
import { createTimeline } from "./core/timeline.js";
import { fetchGitHubContributions } from "./github.js";
import {
  parseBooleanOption,
  parseEffects,
  parseOutputOptions,
  parseSpeed,
  parseTheme,
} from "./options.js";
import { renderSvg } from "./svg.js";

const input = (name: string) =>
  process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? "";

function fail(message: string) {
  const escaped = message
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
  process.stdout.write(`::error::${escaped}\n`);
  process.exitCode = 1;
}

async function main() {
  const username = input("github_user_name");
  const token = input("github_token") || process.env.GITHUB_TOKEN || "";
  const outputs = parseOutputOptions(input("outputs"), {
    theme: parseTheme(input("theme")),
    speed: parseSpeed(input("speed")),
    effects: parseEffects(input("effects")),
    showStats: parseBooleanOption(input("show_stats"), true),
  });

  process.stdout.write(`⛏️ Fetching contributions for ${username}\n`);
  const contributions = await fetchGitHubContributions(username, token);
  const grid = createContributionGrid(contributions);

  for (const output of outputs) {
    const timeline = createTimeline(grid, output.speed, {
      showStats: output.showStats,
    });
    const svg = renderSvg(grid, timeline, {
      username,
      theme: output.theme,
      speed: output.speed,
      effects: output.effects,
      showStats: output.showStats,
    });
    await mkdir(dirname(output.filename), { recursive: true });
    await writeFile(output.filename, svg, "utf8");
    process.stdout.write(
      `💎 Wrote ${output.filename} (${Buffer.byteLength(svg)} bytes)\n`,
    );
  }
}

main().catch((error: unknown) =>
  fail(error instanceof Error ? error.message : String(error)),
);
