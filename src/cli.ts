#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateGitMiner,
  generateGitMinerFromContributions,
} from "./generate.js";
import { createFixtureContributions, type FixtureSpec } from "./fixture.js";
import type { Speed, ThemeName } from "./types.js";

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1) return undefined;
  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

async function loadFixture(name: string) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");
  const raw = await readFile(resolve(root, `${name}.json`), "utf8");
  return createFixtureContributions(JSON.parse(raw) as FixtureSpec);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    process.stdout.write(
      `Git Miner\n\nUsage:\n  pnpm generate --fixture [medium] [--theme github-dark]\n  pnpm generate --username octocat --token TOKEN\n\nOptions:\n  --output PATH       default: dist/git-miner.svg\n  --theme THEME       github-light | github-dark\n  --speed SPEED       slow | normal | fast\n  --no-stats          hide completion statistics\n`,
    );
    return;
  }

  const fixtureFlag = args.indexOf("--fixture");
  const fixture =
    fixtureFlag === -1
      ? undefined
      : (valueAfter(args, "--fixture") ?? "medium");
  const username =
    valueAfter(args, "--username") ?? (fixture ? `fixture/${fixture}` : "");
  const theme = (valueAfter(args, "--theme") ?? "github-light") as ThemeName;
  const speed = (valueAfter(args, "--speed") ?? "normal") as Speed;
  const output = resolve(valueAfter(args, "--output") ?? "dist/git-miner.svg");
  const showStats = !args.includes("--no-stats");
  const token = valueAfter(args, "--token");

  const result = fixture
    ? generateGitMinerFromContributions(await loadFixture(fixture), {
        username,
        theme,
        speed,
        showStats,
      })
    : await generateGitMiner({
        username,
        ...(token ? { githubToken: token } : {}),
        theme,
        speed,
        showStats,
      });

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, result.svg, "utf8");
  process.stdout.write(
    `Generated ${output} (${Buffer.byteLength(result.svg)} bytes)\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Git Miner failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
