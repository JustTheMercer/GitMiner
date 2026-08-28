import { DOMParser } from "@xmldom/xmldom";
import { describe, expect, it } from "vitest";
import { createFixtureContributions } from "../src/fixture.js";
import { generateGitMinerFromContributions } from "../src/generate.js";

const contributions = createFixtureContributions({
  name: "svg",
  seed: 9,
  density: 0.22,
  maxCount: 30,
});
const { svg } = generateGitMinerFromContributions(contributions, {
  username: "octocat",
  theme: "github-dark",
  speed: "normal",
  showStats: true,
});

describe("SVG generation", () => {
  it("produces valid standalone XML with explicit dimensions", () => {
    const errors: string[] = [];
    const document = new DOMParser({
      errorHandler: {
        error: (message: unknown) => errors.push(String(message)),
        fatalError: (message: unknown) => errors.push(String(message)),
      },
    }).parseFromString(svg, "image/svg+xml");
    expect(errors).toEqual([]);
    expect(document.documentElement.tagName).toBe("svg");
    expect(document.documentElement.getAttribute("width")).toMatch(/^\d+$/);
    expect(document.documentElement.getAttribute("height")).toMatch(/^\d+$/);
    expect(document.documentElement.getAttribute("viewBox")).toMatch(
      /^0 0 \d+ \d+$/,
    );
  });

  it("contains the full mining story and no unsafe/external assets", () => {
    expect(svg).toContain("pixel miner");
    expect(svg).toContain("MINING COMPLETE");
    expect(svg).toContain("@keyframes miner-action");
    expect(svg).toContain("@keyframes walk-a");
    expect(svg).toContain("@keyframes face-route");
    expect(svg).toContain("@keyframes impact-flash");
    expect(svg).toMatch(/class="fragments f\d+ /);
    expect(svg).toMatch(/class="particles p\d+ /);
    expect(svg).toContain("stroke-dashoffset");
    expect(svg).not.toMatch(/<script|javascript:/i);
    expect(svg).not.toMatch(/<image\b|(?:href|src)=["']https?:\/\//i);
    expect(svg).toContain("@media (prefers-reduced-motion:reduce)");
  });

  it("fully removes the completion scene when stats are disabled", () => {
    const result = generateGitMinerFromContributions(contributions, {
      username: "octocat",
      theme: "github-dark",
      speed: 1.4,
      effects: "high",
      showStats: false,
    });
    expect(result.svg).toContain('class="effects-high"');
    expect(result.svg).not.toContain("MINING COMPLETE");
    expect(result.svg).not.toContain("opacity:.08");
    expect(result.svg).not.toContain("NaN");
  });

  it("uses event-specific absolute particle timing", () => {
    expect(svg).toMatch(/@keyframes p\d+\{/);
    expect(svg).not.toContain("@keyframes particle{");
    expect(svg).not.toContain("animation-delay");
  });

  it("keeps cracks intact until their matching pickaxe impact", () => {
    const crackAnimations = [
      ...svg.matchAll(
        /\.k(\d+)\{animation:k\1 [\d.]+s steps\(1,end\) infinite\}/g,
      ),
    ];
    expect(crackAnimations.length).toBeGreaterThan(0);
    expect(crackAnimations).toHaveLength(
      [...svg.matchAll(/<path class="crack k\d+"/g)].length,
    );
  });

  it("holds the final miner position while the completion screen appears", () => {
    const route = svg.match(
      /@keyframes miner-route\{(.*?)\}@keyframes face-route/s,
    )?.[1];
    expect(route).toBeDefined();
    const finalTransform = route?.match(
      /([^{}]+)%\{transform:(translate\([^}]+\));opacity:1\}([^{}]+)%\{transform:\2;opacity:0\}100%\{transform:\2;opacity:0\}$/,
    );
    expect(finalTransform).not.toBeNull();
    expect(svg).toContain(
      ".miner-facing,.walk-a,.walk-b{animation-timing-function:steps(1,end)}",
    );

    const facing = svg.match(
      /@keyframes face-route\{(.*?)\}@keyframes pick-swing/s,
    )?.[1];
    const finalFacing = facing?.match(
      /transform:scaleX\((-?1)\).*transform:scaleX\(\1\).*100%\{transform:scaleX\(\1\)\}$/,
    );
    expect(finalFacing).not.toBeNull();
  });

  it("keeps duration and output size reasonable", () => {
    const duration = Number(svg.match(/loops every ([\d.]+) seconds/)?.[1]);
    expect(duration).toBeGreaterThanOrEqual(10);
    expect(duration).toBeLessThanOrEqual(60);
    expect(Buffer.byteLength(svg)).toBeLessThan(900_000);
  });

  it("keeps a worst-case fixture below a conservative standalone SVG limit", () => {
    const dense = createFixtureContributions({
      name: "dense",
      seed: 8675309,
      density: 0.78,
      maxCount: 80,
    });
    const result = generateGitMinerFromContributions(dense, {
      username: "fixture/dense",
      theme: "github-dark",
      speed: "normal",
      showStats: true,
    });
    expect(Buffer.byteLength(result.svg)).toBeLessThan(1_500_000);
  });

  it("emits monotonically ordered block and particle keyframes", () => {
    const animations = [
      ...svg.matchAll(/@keyframes [bkp]\d+\{(.*?)\}(?=\s*@keyframes|\s*\.)/gs),
    ];
    expect(animations.length).toBeGreaterThan(0);
    for (const animation of animations) {
      const percentages = [...animation[1]!.matchAll(/([\d.]+)%/g)].map(
        (match) => Number(match[1]),
      );
      expect(percentages).toEqual([...percentages].sort((a, b) => a - b));
    }
  });
});
