import type { Speed, ThemeName } from "./types.js";

export type OutputOptions = {
  filename: string;
  theme: ThemeName;
  speed: Speed;
  showStats: boolean;
};

const themes = new Set<ThemeName>(["github-light", "github-dark"]);
const speeds = new Set<Speed>(["slow", "normal", "fast"]);

function booleanOption(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseOutputOption(
  entry: string,
  defaults: Partial<Omit<OutputOptions, "filename">> = {},
): OutputOptions {
  const trimmed = entry.trim();
  const question = trimmed.indexOf("?");
  const filename = question === -1 ? trimmed : trimmed.slice(0, question);
  const query = question === -1 ? "" : trimmed.slice(question + 1);
  if (!filename.toLowerCase().endsWith(".svg"))
    throw new Error(`Only .svg outputs are supported: ${filename}`);

  const params = new URLSearchParams(query);
  const theme = (params.get("theme") ??
    defaults.theme ??
    "github-light") as ThemeName;
  const speed = (params.get("speed") ?? defaults.speed ?? "normal") as Speed;
  if (!themes.has(theme)) throw new Error(`Unknown theme: ${theme}`);
  if (!speeds.has(speed)) throw new Error(`Unknown speed: ${speed}`);

  return {
    filename,
    theme,
    speed,
    showStats: booleanOption(
      params.get("show_stats"),
      defaults.showStats ?? true,
    ),
  };
}

export function parseOutputOptions(
  input: string,
  defaults: Partial<Omit<OutputOptions, "filename">> = {},
): OutputOptions[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("At least one SVG output is required");
  return lines.map((line) => parseOutputOption(line, defaults));
}
