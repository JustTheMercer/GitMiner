import type { OreType, ThemeName } from "./types.js";

export type Theme = {
  background: string;
  panel: string;
  gridLine: string;
  empty: string;
  ore: Record<Exclude<OreType, "empty">, string>;
  oreHighlight: Record<Exclude<OreType, "empty">, string>;
  miner: {
    skin: string;
    helmet: string;
    helmetLight: string;
    clothes: string;
    boots: string;
    tool: string;
  };
  text: string;
  mutedText: string;
  crack: string;
};

export const themes: Record<ThemeName, Theme> = {
  "github-light": {
    background: "#ffffff",
    panel: "#f6f8fa",
    gridLine: "#d0d7de",
    empty: "#ebedf0",
    ore: {
      stone: "#8c959f",
      copper: "#c76f3c",
      gold: "#d4a72c",
      diamond: "#218bff",
    },
    oreHighlight: {
      stone: "#afb8c1",
      copper: "#e09b69",
      gold: "#f2cc60",
      diamond: "#80ccff",
    },
    miner: {
      skin: "#d8a47f",
      helmet: "#f2cc60",
      helmetLight: "#fff8c5",
      clothes: "#0969da",
      boots: "#24292f",
      tool: "#57606a",
    },
    text: "#24292f",
    mutedText: "#57606a",
    crack: "#24292f",
  },
  "github-dark": {
    background: "#0d1117",
    panel: "#161b22",
    gridLine: "#30363d",
    empty: "#21262d",
    ore: {
      stone: "#6e7681",
      copper: "#b85c38",
      gold: "#d29922",
      diamond: "#39c5cf",
    },
    oreHighlight: {
      stone: "#b1bac4",
      copper: "#e08261",
      gold: "#f2cc60",
      diamond: "#79e2e8",
    },
    miner: {
      skin: "#d8a47f",
      helmet: "#e3b341",
      helmetLight: "#fff8c5",
      clothes: "#58a6ff",
      boots: "#c9d1d9",
      tool: "#b1bac4",
    },
    text: "#f0f6fc",
    mutedText: "#8b949e",
    crack: "#0d1117",
  },
};

export function getTheme(name: ThemeName = "github-light"): Theme {
  const theme = themes[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}
