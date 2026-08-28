import { describe, expect, it } from "vitest";
import {
  parseEffects,
  parseOutputOption,
  parseOutputOptions,
  parseSpeed,
} from "../src/options.js";
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
      effects: "normal",
      showStats: false,
    });
  });

  it("accepts numeric speed multipliers and validates their range", () => {
    expect(parseOutputOption("a.svg?speed=1.35&effects=high")).toMatchObject({
      speed: 1.35,
      effects: "high",
    });
    expect(parseSpeed("0.4")).toBe(0.4);
    expect(parseSpeed("3")).toBe(3);
    expect(() => parseSpeed("warp")).toThrow(/Speed must be/);
    expect(() => parseSpeed("3.1")).toThrow(/Speed must be/);
    expect(() => parseEffects("cinematic")).toThrow(/Unknown effects/);
  });

  it("parses multiple outputs and rejects GIF", () => {
    expect(parseOutputOptions("a.svg\nb.svg?theme=github-dark")).toHaveLength(
      2,
    );
    expect(() => parseOutputOption("a.gif")).toThrow(/Only .svg/);
    expect(() => parseOutputOption("a.svg?sped=2")).toThrow(
      /Unknown output option/,
    );
    expect(() => parseOutputOption("a.svg?speed=1&speed=2")).toThrow(
      /only be specified once/,
    );
  });
});

describe("theme selection", () => {
  it("selects both required palettes", () => {
    expect(getTheme("github-light").background).toBe("#ffffff");
    expect(getTheme("github-dark").background).toBe("#0d1117");
  });
});
