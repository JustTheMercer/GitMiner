import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("CLI", () => {
  it("rejects invalid speed values instead of writing broken SVG", async () => {
    await expect(
      execFileAsync(process.execPath, [
        "--import",
        "tsx",
        "src/cli.ts",
        "--fixture",
        "sparse",
        "--speed",
        "warp",
      ]),
    ).rejects.toMatchObject({ code: 1 });
  });

  it("generates a finite SVG with custom speed and no stats", async () => {
    const directory = await mkdtemp(join(tmpdir(), "git-miner-cli-"));
    const output = join(directory, "profile.svg");
    await execFileAsync(process.execPath, [
      "--import",
      "tsx",
      "src/cli.ts",
      "--fixture",
      "sparse",
      "--speed",
      "1.35",
      "--effects",
      "high",
      "--no-stats",
      "--output",
      output,
    ]);
    const svg = await readFile(output, "utf8");
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("MINING COMPLETE");
    expect(svg).toContain('class="effects-high"');
  });
});
