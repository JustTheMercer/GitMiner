import type { EffectsLevel, Speed, SpeedPreset, ThemeName } from "./types.js";

export type OutputOptions = {
  filename: string;
  theme: ThemeName;
  speed: Speed;
  effects: EffectsLevel;
  showStats: boolean;
};

const themes = new Set<ThemeName>(["github-light", "github-dark"]);
const speedPresets = new Set<SpeedPreset>(["slow", "normal", "fast"]);
const effectsLevels = new Set<EffectsLevel>(["low", "normal", "high"]);
export const MIN_SPEED = 0.4;
export const MAX_SPEED = 3;

export function parseBooleanOption(
  value: string | null | undefined,
  fallback: boolean,
): boolean {
  if (value === null || value === undefined || value === "") return fallback;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}

export function parseTheme(
  value: string | null | undefined,
  fallback: ThemeName = "github-light",
): ThemeName {
  const theme = value?.trim() || fallback;
  if (!themes.has(theme as ThemeName))
    throw new Error(`Unknown theme: ${theme}`);
  return theme as ThemeName;
}

export function parseSpeed(
  value: string | number | null | undefined,
  fallback: Speed = "normal",
): Speed {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (speedPresets.has(normalized as SpeedPreset)) {
      return normalized as SpeedPreset;
    }
    value = Number(normalized);
  }
  if (!Number.isFinite(value) || value < MIN_SPEED || value > MAX_SPEED) {
    throw new Error(
      `Speed must be slow, normal, fast, or a number from ${MIN_SPEED} to ${MAX_SPEED}: ${String(value)}`,
    );
  }
  return value;
}

export function parseEffects(
  value: string | null | undefined,
  fallback: EffectsLevel = "normal",
): EffectsLevel {
  const effects = value?.trim().toLowerCase() || fallback;
  if (!effectsLevels.has(effects as EffectsLevel)) {
    throw new Error(`Unknown effects level: ${effects}`);
  }
  return effects as EffectsLevel;
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
  const allowed = new Set(["theme", "speed", "effects", "show_stats"]);
  for (const key of params.keys()) {
    if (!allowed.has(key)) throw new Error(`Unknown output option: ${key}`);
    if (params.getAll(key).length > 1) {
      throw new Error(`Output option may only be specified once: ${key}`);
    }
  }
  const theme = parseTheme(params.get("theme"), defaults.theme);
  const speed = parseSpeed(params.get("speed"), defaults.speed);
  const effects = parseEffects(params.get("effects"), defaults.effects);

  return {
    filename,
    theme,
    speed,
    effects,
    showStats: parseBooleanOption(
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
