#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateGitMiner,
  generateGitMinerFromContributions,
} from "./generate.js";
import { createFixtureContributions, type FixtureSpec } from "./fixture.js";
import { parseEffects, parseSpeed, parseTheme } from "./options.js";

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
      `Git Miner\n\nUsage:\n  pnpm generate --fixture [medium] [--theme github-dark]\n  pnpm generate --username octocat --token TOKEN\n\nOptions:\n  --output PATH       default: dist/git-miner.svg\n  --theme THEME       github-light | github-dark\n  --speed SPEED       slow | normal | fast | 0.4..3\n  --effects LEVEL     low | normal | high\n  --no-stats          hide the completion phase\n`,
    );
    return;
  }

  const knownFlags = new Set([
    "--fixture",
    "--username",
    "--token",
    "--output",
    "--theme",
    "--speed",
    "--effects",
    "--no-stats",
  ]);
  const unknownFlag = args.find(
    (argument) => argument.startsWith("--") && !knownFlags.has(argument),
  );
  if (unknownFlag) throw new Error(`Unknown option: ${unknownFlag}`);

  for (const flag of [
    "--username",
    "--token",
    "--output",
    "--theme",
    "--speed",
    "--effects",
  ]) {
    if (args.includes(flag) && valueAfter(args, flag) === undefined) {
      throw new Error(`Option ${flag} requires a value`);
    }
  }

  const fixtureFlag = args.indexOf("--fixture");
  const fixture =
    fixtureFlag === -1
      ? undefined
      : (valueAfter(args, "--fixture") ?? "medium");
  const username =
    valueAfter(args, "--username") ?? (fixture ? `fixture/${fixture}` : "");
  const theme = parseTheme(valueAfter(args, "--theme"));
  const speed = parseSpeed(valueAfter(args, "--speed"));
  const effects = parseEffects(valueAfter(args, "--effects"));
  const output = resolve(valueAfter(args, "--output") ?? "dist/git-miner.svg");
  const showStats = !args.includes("--no-stats");
  const token = valueAfter(args, "--token");

  const result = fixture
    ? generateGitMinerFromContributions(await loadFixture(fixture), {
        username,
        theme,
        speed,
        effects,
        showStats,
      })
    : await generateGitMiner({
        username,
        ...(token ? { githubToken: token } : {}),
        theme,
        speed,
        effects,
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
