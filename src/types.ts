export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export type ContributionCell = {
  x: number;
  y: number;
  date: string;
  count: number;
  level: ContributionLevel;
};

export type OreType = "empty" | "stone" | "copper" | "gold" | "diamond";

export type OreCell = ContributionCell & {
  ore: OreType;
  hits: number;
};

export type ContributionGrid = {
  width: number;
  height: 7;
  cells: OreCell[];
};

export type Point = { x: number; y: number };
export type Facing = "left" | "right";

type Timed = { start: number; duration: number };

export type MoveEvent = Timed & {
  type: "move";
  from: Point;
  to: Point;
  via?: Point;
  viaAt?: number;
  fromFacing: Facing;
  facing: Facing;
  easing: "ease-in-out";
  turnEnd: number;
};

export type MineEvent = Timed & {
  type: "mine";
  cell: OreCell;
  hit: number;
  hits: number;
  windupEnd: number;
  impactAt: number;
  impactEnd: number;
  recoveryEnd: number;
  isFinal: boolean;
};

export type BreakEvent = Timed & {
  type: "break";
  cell: OreCell;
  fragmentAt: number;
};

export type ParticleEvent = Timed & {
  type: "particles";
  cell: OreCell;
  peakAt: number;
  fadeAt: number;
};

export type StatsEvent = Timed & {
  type: "stats";
  enterDuration: number;
  exitStart: number;
};

export type AnimationEvent =
  MoveEvent | MineEvent | BreakEvent | ParticleEvent | StatsEvent;

export type Timeline = {
  duration: number;
  events: AnimationEvent[];
  path: OreCell[];
  stats: {
    totalContributions: number;
    activeDays: number;
    blocksMined: number;
    totalHits: number;
    travelDistance: number;
  };
  timing: {
    speed: Speed;
    speedMultiplier: number;
    naturalDuration: number;
    compression: number;
    particleLifetime: number;
  };
};

export type SpeedPreset = "slow" | "normal" | "fast";
export type Speed = SpeedPreset | number;
export type EffectsLevel = "low" | "normal" | "high";
export type ThemeName = "github-light" | "github-dark";

export type GenerateOptions = {
  username: string;
  githubToken?: string;
  theme?: ThemeName;
  speed?: Speed;
  effects?: EffectsLevel;
  showStats?: boolean;
};

export type RenderOptions = Omit<GenerateOptions, "githubToken">;
