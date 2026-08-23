import { describe, expect, it } from "vitest";
import { parseOutputOption, parseOutputOptions } from "../src/options.js";
import { getTheme } from "../src/themes.js";

describe("output options", () => {
  it("parses filename and query options", () => {
    expect(
      parseOutputOption(
        "dist/dark.svg?theme=github-dark&speed=fast&show_stats=false",
      ),
    ).toEqual({
      filename: "dist/dark.svg",
      theme: "github-dark",
      speed: "fast",
      showStats: false,
    });
  });

  it("parses multiple outputs and rejects GIF", () => {
    expect(parseOutputOptions("a.svg\nb.svg?theme=github-dark")).toHaveLength(
      2,
    );
    expect(() => parseOutputOption("a.gif")).toThrow(/Only .svg/);
  });
});

describe("theme selection", () => {
  it("selects both required palettes", () => {
    expect(getTheme("github-light").background).toBe("#ffffff");
    expect(getTheme("github-dark").background).toBe("#0d1117");
  });
});
