import{createRequire as __cr}from'module';const require=__cr(import.meta.url);

// src/action.ts
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// src/core/ore.ts
var ORE_BY_LEVEL = {
  0: "empty",
  1: "stone",
  2: "copper",
  3: "gold",
  4: "diamond"
};
function contributionLevelToOre(level) {
  return ORE_BY_LEVEL[level];
}
function contributionToOre(cell) {
  return {
    ...cell,
    ore: contributionLevelToOre(cell.level),
    hits: cell.level
  };
}

// src/core/grid.ts
var DAY_MS = 864e5;
function createContributionGrid(contributions, width = 53) {
  if (!Number.isInteger(width) || width < 1)
    throw new Error("Grid width must be a positive integer");
  const byPosition = new Map(
    contributions.map((cell) => [`${cell.x}:${cell.y}`, cell])
  );
  const firstDate = contributions.map((cell) => cell.date).filter(Boolean).sort()[0];
  const origin = firstDate ? /* @__PURE__ */ new Date(`${firstDate}T00:00:00Z`) : /* @__PURE__ */ new Date("1970-01-04T00:00:00Z");
  const cells = Array.from({ length: width * 7 }, (_, index) => {
    const x = Math.floor(index / 7);
    const y = index % 7;
    const existing = byPosition.get(`${x}:${y}`);
    if (existing) return contributionToOre(existing);
    return contributionToOre({
      x,
      y,
      date: new Date(origin.getTime() + (x * 7 + y) * DAY_MS).toISOString().slice(0, 10),
      count: 0,
      level: 0
    });
  });
  return { width, height: 7, cells };
}

// src/core/traversal.ts
var distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
var direction = (from, to) => ({
  x: Math.sign(to.x - from.x),
  y: Math.sign(to.y - from.y)
});
function createMiningPath(grid) {
  const remaining = grid.cells.filter((cell) => cell.level > 0).sort((a, b) => a.x - b.x || (a.x % 2 === 0 ? a.y - b.y : b.y - a.y));
  if (remaining.length < 2) return remaining;
  const path = [];
  let cursor = { x: -1, y: 6 };
  let heading = { x: 1, y: 0 };
  while (remaining.length) {
    const frontierX = remaining[0].x;
    const candidates = remaining.map((cell, index) => ({ cell, index })).filter(({ cell }) => cell.x <= frontierX + 2);
    candidates.sort((a, b) => {
      const changesDirection = (cell) => {
        const next2 = direction(cursor, cell);
        return heading.x !== 0 && next2.x !== 0 && heading.x !== next2.x || heading.y !== 0 && next2.y !== 0 && heading.y !== next2.y;
      };
      return distance(cursor, a.cell) - distance(cursor, b.cell) || a.cell.x - b.cell.x || Number(changesDirection(a.cell)) - Number(changesDirection(b.cell)) || a.cell.y - b.cell.y;
    });
    const next = candidates[0];
    const nextHeading = direction(cursor, next.cell);
    if (nextHeading.x !== 0 || nextHeading.y !== 0) heading = nextHeading;
    path.push(next.cell);
    cursor = next.cell;
    remaining.splice(next.index, 1);
  }
  return path;
}

// src/core/timeline.ts
var SPEED_FACTOR = {
  slow: 1.2,
  normal: 1,
  fast: 0.82
};
var HARD_MAX = {
  slow: 64,
  normal: 60,
  fast: 54
};
var clamp = (value, min, max) => Math.min(max, Math.max(min, value));
var pointDistance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
var detailFactor = (activeCells) => clamp(1.46 - activeCells * 42e-4, 0.84, 1.35);
var facingFor = (from, to, fallback) => {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  return fallback;
};
function createNaturalTimeline(grid, path, speed, compression, naturalDuration) {
  const factor = SPEED_FACTOR[speed];
  const detail = detailFactor(path.length);
  const isCompressed = compression < 0.995;
  const hitFloor = isCompressed ? 0.045 : speed === "fast" ? 0.05 : 0.055;
  const moveFloor = isCompressed ? 0.035 : speed === "fast" ? 0.045 : 0.05;
  const naturalHit = 0.06 * detail * factor * compression;
  const hitCeiling = speed === "slow" ? 0.09 : speed === "fast" ? 0.075 : 0.078;
  const breakDuration = clamp(
    0.075 * detail * factor * Math.sqrt(compression),
    0.05,
    0.11
  );
  const particleLifetime = clamp(0.18 * factor, 0.145, 0.22);
  const intro = clamp(0.55 * factor, 0.44, 0.7);
  const statsDuration = clamp(1.7 * factor, 1.35, 2.1);
  const resetPause = clamp(0.42 * factor, 0.34, 0.52);
  const events = [];
  let cursor = { x: -1, y: 6 };
  let facing = "right";
  let time = intro;
  let travelDistance = 0;
  let totalHits = 0;
  let lastBreakEnd = time;
  path.forEach((cell) => {
    const distance2 = pointDistance(cursor, cell);
    const nextFacing = facingFor(cursor, cell, facing);
    const moveDuration = clamp(
      (0.032 + distance2 * 0.015) * detail * factor * compression,
      moveFloor,
      isCompressed ? 0.22 : 0.3
    );
    events.push({
      type: "move",
      from: cursor,
      to: cell,
      fromFacing: facing,
      facing: nextFacing,
      easing: "ease-in-out",
      start: time,
      duration: moveDuration,
      turnEnd: time + Math.min(0.025, moveDuration * 0.25)
    });
    time += moveDuration;
    travelDistance += distance2;
    facing = nextFacing;
    for (let hit = 1; hit <= cell.hits; hit += 1) {
      const isFinal = hit === cell.hits;
      const rhythm = isFinal ? 1.08 : hit % 2 === 0 ? 0.97 : 1.02;
      const duration2 = clamp(naturalHit * rhythm, hitFloor, hitCeiling);
      const windupEnd = time + duration2 * 0.55;
      const impactAt = time + duration2 * 0.7;
      const impactEnd = time + duration2 * (isFinal ? 0.84 : 0.8);
      events.push({
        type: "mine",
        cell,
        hit,
        hits: cell.hits,
        isFinal,
        start: time,
        duration: duration2,
        windupEnd,
        impactAt,
        impactEnd,
        recoveryEnd: time + duration2
      });
      time += duration2;
      totalHits += 1;
    }
    const fragmentAt = time + Math.min(0.025, breakDuration * 0.3);
    events.push({
      type: "break",
      cell,
      start: time,
      duration: breakDuration,
      fragmentAt
    });
    events.push({
      type: "particles",
      cell,
      start: fragmentAt,
      duration: particleLifetime,
      peakAt: fragmentAt + Math.min(0.012, particleLifetime * 0.08),
      fadeAt: fragmentAt + particleLifetime * 0.58
    });
    lastBreakEnd = Math.max(lastBreakEnd, time + breakDuration);
    cursor = cell;
  });
  const statsStart = Math.max(time, lastBreakEnd);
  const statsEvent = {
    type: "stats",
    start: statsStart,
    duration: statsDuration,
    enterDuration: clamp(0.12 * factor, 0.1, 0.15),
    exitStart: statsStart + statsDuration - clamp(0.22 * factor, 0.18, 0.28)
  };
  events.push(statsEvent);
  const duration = statsEvent.start + statsEvent.duration + resetPause;
  return {
    duration,
    events,
    path,
    stats: {
      totalContributions: grid.cells.reduce((sum, cell) => sum + cell.count, 0),
      activeDays: path.length,
      blocksMined: path.length,
      totalHits,
      travelDistance
    },
    timing: {
      speed,
      naturalDuration,
      compression,
      particleLifetime
    }
  };
}
function createTimeline(grid, speed = "normal") {
  const path = createMiningPath(grid);
  let timeline = createNaturalTimeline(grid, path, speed, 1, 0);
  const naturalDuration = timeline.duration;
  const hardMax = HARD_MAX[speed];
  let compression = 1;
  for (let attempt = 0; attempt < 5 && timeline.duration > hardMax; attempt += 1) {
    const fixedTime = 3.1 * SPEED_FACTOR[speed];
    compression *= clamp(
      (hardMax - fixedTime) / Math.max(1e-3, timeline.duration - fixedTime),
      0.55,
      0.98
    );
    timeline = createNaturalTimeline(
      grid,
      path,
      speed,
      compression,
      naturalDuration
    );
  }
  timeline.timing.naturalDuration = naturalDuration;
  return timeline;
}
function eventsForCell(timeline, cell) {
  return timeline.events.filter(
    (event) => "cell" in event && event.cell.x === cell.x && event.cell.y === cell.y
  );
}
function mineEvents(timeline) {
  return timeline.events.filter(
    (event) => event.type === "mine"
  );
}

// src/github.ts
var LEVELS = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4
};
var query = `query GitMinerContributions($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        weeks {
          contributionDays { contributionCount contributionLevel weekday date }
        }
      }
    }
  }
}`;
async function fetchGitHubContributions(username, token, fetcher = fetch) {
  if (!username.trim()) throw new Error("GitHub username is required");
  if (!token.trim())
    throw new Error(
      "A GitHub token is required to query the contribution calendar"
    );
  const response = await fetcher("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "git-miner-action"
    },
    body: JSON.stringify({ query, variables: { login: username } })
  });
  if (!response.ok) {
    const details = await response.text().catch(() => response.statusText);
    throw new Error(
      `GitHub API request failed (${response.status}): ${details}`
    );
  }
  const payload = await response.json();
  if (payload.errors?.length)
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  const user = payload.data?.user;
  if (!user) throw new Error(`GitHub user "${username}" was not found`);
  return user.contributionsCollection.contributionCalendar.weeks.flatMap(
    (week, x) => week.contributionDays.map((day) => ({
      x,
      y: day.weekday,
      date: day.date,
      count: day.contributionCount,
      level: LEVELS[day.contributionLevel]
    }))
  );
}

// src/options.ts
var themes = /* @__PURE__ */ new Set(["github-light", "github-dark"]);
var speeds = /* @__PURE__ */ new Set(["slow", "normal", "fast"]);
function booleanOption(value, fallback) {
  if (value === null) return fallback;
  if (["1", "true", "yes"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no"].includes(value.toLowerCase())) return false;
  throw new Error(`Invalid boolean value: ${value}`);
}
function parseOutputOption(entry, defaults = {}) {
  const trimmed = entry.trim();
  const question = trimmed.indexOf("?");
  const filename = question === -1 ? trimmed : trimmed.slice(0, question);
  const query2 = question === -1 ? "" : trimmed.slice(question + 1);
  if (!filename.toLowerCase().endsWith(".svg"))
    throw new Error(`Only .svg outputs are supported: ${filename}`);
  const params = new URLSearchParams(query2);
  const theme = params.get("theme") ?? defaults.theme ?? "github-light";
  const speed = params.get("speed") ?? defaults.speed ?? "normal";
  if (!themes.has(theme)) throw new Error(`Unknown theme: ${theme}`);
  if (!speeds.has(speed)) throw new Error(`Unknown speed: ${speed}`);
  return {
    filename,
    theme,
    speed,
    showStats: booleanOption(
      params.get("show_stats"),
      defaults.showStats ?? true
    )
  };
}
function parseOutputOptions(input2, defaults = {}) {
  const lines = input2.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("At least one SVG output is required");
  return lines.map((line) => parseOutputOption(line, defaults));
}

// src/themes.ts
var themes2 = {
  "github-light": {
    background: "#ffffff",
    panel: "#f6f8fa",
    gridLine: "#d0d7de",
    empty: "#ebedf0",
    ore: {
      stone: "#8c959f",
      copper: "#c76f3c",
      gold: "#d4a72c",
      diamond: "#218bff"
    },
    oreHighlight: {
      stone: "#afb8c1",
      copper: "#e09b69",
      gold: "#f2cc60",
      diamond: "#80ccff"
    },
    miner: {
      skin: "#d8a47f",
      helmet: "#f2cc60",
      helmetLight: "#fff8c5",
      clothes: "#0969da",
      boots: "#24292f",
      tool: "#57606a"
    },
    text: "#24292f",
    mutedText: "#57606a",
    crack: "#24292f"
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
      diamond: "#39c5cf"
    },
    oreHighlight: {
      stone: "#b1bac4",
      copper: "#e08261",
      gold: "#f2cc60",
      diamond: "#79e2e8"
    },
    miner: {
      skin: "#d8a47f",
      helmet: "#e3b341",
      helmetLight: "#fff8c5",
      clothes: "#58a6ff",
      boots: "#c9d1d9",
      tool: "#b1bac4"
    },
    text: "#f0f6fc",
    mutedText: "#8b949e",
    crack: "#0d1117"
  }
};
function getTheme(name = "github-light") {
  const theme = themes2[name];
  if (!theme) throw new Error(`Unknown theme: ${name}`);
  return theme;
}

// src/svg.ts
var CELL = 13;
var BLOCK = 10;
var LEFT = 26;
var TOP = 38;
var FOOTER = 49;
var n = (value) => Number(value.toFixed(3));
var pct = (time, duration) => n(time / duration * 100);
var escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
function blockPosition(cell) {
  return { x: LEFT + cell.x * CELL, y: TOP + cell.y * CELL };
}
function blockAnimationCss(cell, index, timeline) {
  const events = eventsForCell(timeline, cell);
  const hits = events.filter(
    (event) => event.type === "mine"
  );
  const broken = events.find(
    (event) => event.type === "break"
  );
  const particles = events.find(
    (event) => event.type === "particles"
  );
  const { x, y } = blockPosition(cell);
  const cx = x + BLOCK / 2;
  const cy = y + BLOCK / 2;
  const blockFrames = [
    "0%{opacity:1;transform:translate(0,0) scale(1);filter:brightness(1)}"
  ];
  const crackFrames = ["0%{opacity:0;stroke-dashoffset:24}"];
  for (const hit of hits) {
    const damage = n(1 - hit.hit * 0.075);
    const dash = n(24 * (1 - hit.hit / hit.hits));
    const shake = hit.isFinal ? 1.7 : 1;
    blockFrames.push(
      `${pct(hit.windupEnd, timeline.duration)}%{transform:translate(0,0) scale(1);filter:brightness(${n(damage + 0.04)})}`,
      `${pct(hit.impactAt, timeline.duration)}%{transform:translate(${shake}px,-.5px) scale(${hit.isFinal ? 1.045 : 1.025});filter:brightness(1.35)}`,
      `${pct(hit.impactEnd, timeline.duration)}%{transform:translate(${-shake * 0.55}px,.5px) scale(.985);filter:brightness(${damage})}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:translate(0,0) scale(1);filter:brightness(${damage})}`
    );
    crackFrames.push(
      `${pct(hit.impactAt, timeline.duration)}%{opacity:1;stroke-dashoffset:${dash}}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{opacity:1;stroke-dashoffset:${dash}}`
    );
  }
  blockFrames.push(
    `${pct(broken.start, timeline.duration)}%{opacity:1;transform:translate(0,0) scale(1)}`,
    `${pct(broken.fragmentAt, timeline.duration)}%{opacity:.45;transform:translate(0,1px) scale(.88)}`,
    `${pct(broken.start + broken.duration, timeline.duration)}%{opacity:0;transform:translate(0,2px) scale(.64)}`,
    "100%{opacity:0;transform:translate(0,2px) scale(.64)}"
  );
  crackFrames.push(
    `${pct(broken.start, timeline.duration)}%{opacity:1;stroke-dashoffset:0}`,
    `${pct(broken.fragmentAt, timeline.duration)}%{opacity:1;stroke-dashoffset:0}`,
    `${pct(broken.start + broken.duration, timeline.duration)}%{opacity:0;stroke-dashoffset:0}`,
    "100%{opacity:0;stroke-dashoffset:0}"
  );
  const breakStart = pct(broken.start, timeline.duration);
  const fragmentAt = pct(broken.fragmentAt, timeline.duration);
  const breakEnd = pct(broken.start + broken.duration, timeline.duration);
  const particleStart = pct(particles.start, timeline.duration);
  const particlePeak = pct(particles.peakAt, timeline.duration);
  const particleFade = pct(particles.fadeAt, timeline.duration);
  const particleEnd = pct(
    particles.start + particles.duration,
    timeline.duration
  );
  return `@keyframes b${index}{${blockFrames.join("")}}
@keyframes k${index}{${crackFrames.join("")}}
@keyframes f${index}{0%,${breakStart}%{opacity:0;transform:translate(0,0) rotate(0)}${fragmentAt}%{opacity:1;transform:translate(0,0) rotate(0)}${breakEnd}%{opacity:0;transform:translate(var(--fx),var(--fy)) rotate(var(--fr))}100%{opacity:0;transform:translate(var(--fx),var(--fy)) rotate(var(--fr))}}
@keyframes p${index}{0%,${particleStart}%{opacity:0;transform:translate(0,0)}${particlePeak}%{opacity:1;transform:translate(0,0)}${particleFade}%{opacity:.8}${particleEnd}%{opacity:0;transform:translate(var(--dx),var(--dy))}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
.b${index}{animation:b${index} ${n(timeline.duration)}s linear infinite;transform-origin:${cx}px ${cy}px}.k${index}{animation:k${index} ${n(timeline.duration)}s linear infinite}.f${index}>rect{animation:f${index} ${n(timeline.duration)}s cubic-bezier(.2,.7,.3,1) infinite;transform-origin:${cx}px ${cy}px}.p${index}>rect{animation:p${index} ${n(timeline.duration)}s cubic-bezier(.15,.65,.3,1) infinite}`;
}
function renderBlocks(grid, timeline) {
  let activeIndex = 0;
  const styles = [];
  const markup = grid.cells.map((cell) => {
    const { x, y } = blockPosition(cell);
    if (cell.ore === "empty") {
      return `<rect class="empty" x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="2"/>`;
    }
    const index = activeIndex++;
    styles.push(blockAnimationCss(cell, index, timeline));
    return `<g class="b b${index} ore-${cell.ore}"><rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="1.5"/><path class="shine" d="M${x + 2} ${y + 2}h4v2h-4z"/><path class="crack k${index}" d="M${x + 5} ${y}l-2 3 3 2-3 2 4 3m0-8-2 3 4 2m-7-1 3 1"/></g><g class="fragments f${index} ore-${cell.ore}"><rect x="${x}" y="${y}" width="4" height="4" style="--fx:-4px;--fy:-3px;--fr:-12deg"/><rect x="${x + 6}" y="${y}" width="4" height="4" style="--fx:4px;--fy:-4px;--fr:14deg"/><rect x="${x}" y="${y + 6}" width="4" height="4" style="--fx:-3px;--fy:5px;--fr:9deg"/><rect x="${x + 6}" y="${y + 6}" width="4" height="4" style="--fx:4px;--fy:5px;--fr:-10deg"/></g><g class="particles p${index} ore-${cell.ore}"><rect x="${x + 7}" y="${y + 2}" width="2" height="2" style="--dx:-7px;--dy:-7px"/><rect x="${x + 8}" y="${y + 3}" width="2" height="2" style="--dx:6px;--dy:-5px"/><rect x="${x + 6}" y="${y + 4}" width="2" height="2" style="--dx:-5px;--dy:5px"/><rect x="${x + 8}" y="${y + 5}" width="2" height="2" style="--dx:7px;--dy:6px"/><rect x="${x + 7}" y="${y + 3}" width="2" height="2" style="--dx:1px;--dy:-9px"/></g>`;
  }).join("");
  return { markup, css: styles.join("\n") };
}
function minerPose(point, facing) {
  if (point.x < 0) return { x: 9, y: TOP + point.y * CELL - 5 };
  const targetX = LEFT + point.x * CELL;
  return {
    x: facing === "right" ? targetX - 17 : targetX + 5,
    y: TOP + point.y * CELL - 5
  };
}
var transformPose = (point, facing) => {
  const pose = minerPose(point, facing);
  return `translate(${pose.x}px,${pose.y}px)`;
};
function minerRouteCss(timeline) {
  const moves = timeline.events.filter(
    (event) => event.type === "move"
  );
  const frames = [
    `0%{transform:${transformPose({ x: -1, y: 6 }, "right")};opacity:1}`
  ];
  for (const move of moves) {
    frames.push(
      `${pct(move.start, timeline.duration)}%{transform:${transformPose(move.from, move.fromFacing)};opacity:1;animation-timing-function:cubic-bezier(.45,0,.2,1)}`,
      `${pct(move.start + move.duration, timeline.duration)}%{transform:${transformPose(move.to, move.facing)};opacity:1}`
    );
  }
  const stats = timeline.events.find(
    (event) => event.type === "stats"
  );
  const lastMove = moves.at(-1);
  const finalPose = lastMove ? transformPose(lastMove.to, lastMove.facing) : transformPose({ x: -1, y: 6 }, "right");
  frames.push(
    `${pct(stats.start, timeline.duration)}%{transform:${finalPose};opacity:1}`,
    `${pct(stats.start + stats.enterDuration, timeline.duration)}%{transform:${finalPose};opacity:0}`,
    `100%{transform:${finalPose};opacity:0}`
  );
  return `@keyframes miner-route{${frames.join("")}}`;
}
function minerFacingCss(timeline) {
  const moves = timeline.events.filter(
    (event) => event.type === "move"
  );
  const scale = (facing) => facing === "right" ? 1 : -1;
  const frames = ["0%{transform:scaleX(1)}"];
  for (const move of moves) {
    frames.push(
      `${pct(move.start, timeline.duration)}%{transform:scaleX(${scale(move.fromFacing)})}`,
      `${pct(move.turnEnd, timeline.duration)}%{transform:scaleX(${scale(move.facing)})}`,
      `${pct(move.start + move.duration, timeline.duration)}%{transform:scaleX(${scale(move.facing)})}`
    );
  }
  const stats = timeline.events.find(
    (event) => event.type === "stats"
  );
  const finalFacing = moves.at(-1)?.facing ?? "right";
  const finalScale = scale(finalFacing);
  frames.push(
    `${pct(stats.start, timeline.duration)}%{transform:scaleX(${finalScale})}`,
    `${pct(stats.start + stats.enterDuration, timeline.duration)}%{transform:scaleX(${finalScale})}`,
    `100%{transform:scaleX(${finalScale})}`
  );
  return `@keyframes face-route{${frames.join("")}}`;
}
function minerActionCss(timeline) {
  const hits = mineEvents(timeline);
  const pick = ["0%{transform:rotate(-32deg)}"];
  const recoil = ["0%{transform:translateX(0) rotate(0)}"];
  const impact = ["0%{opacity:0;transform:scale(.4)}"];
  for (const hit of hits) {
    const recoilDistance = hit.isFinal ? -2 : -1.2;
    pick.push(
      `${pct(hit.start, timeline.duration)}%{transform:rotate(-32deg)}`,
      `${pct(hit.windupEnd, timeline.duration)}%{transform:rotate(-72deg)}`,
      `${pct(hit.impactAt, timeline.duration)}%{transform:rotate(${hit.isFinal ? 54 : 48}deg)}`,
      `${pct(hit.impactEnd, timeline.duration)}%{transform:rotate(40deg)}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:rotate(-32deg)}`
    );
    recoil.push(
      `${pct(hit.start, timeline.duration)}%{transform:translateX(0) rotate(0)}`,
      `${pct(hit.windupEnd, timeline.duration)}%{transform:translateX(-.5px) rotate(-2deg)}`,
      `${pct(hit.impactAt, timeline.duration)}%{transform:translateX(${recoilDistance}px) rotate(1.2deg)}`,
      `${pct(hit.impactEnd, timeline.duration)}%{transform:translateX(.45px) rotate(-.8deg)}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:translateX(0) rotate(0)}`
    );
    impact.push(
      `${pct(hit.windupEnd, timeline.duration)}%{opacity:0;transform:scale(.4)}`,
      `${pct(hit.impactAt, timeline.duration)}%{opacity:1;transform:scale(${hit.isFinal ? 1.45 : 1})}`,
      `${pct(hit.impactEnd, timeline.duration)}%{opacity:0;transform:scale(1.7)}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{opacity:0;transform:scale(.4)}`
    );
  }
  pick.push("100%{transform:rotate(-32deg)}");
  recoil.push("100%{transform:translateX(0) rotate(0)}");
  impact.push("100%{opacity:0;transform:scale(.4)}");
  return `@keyframes pick-swing{${pick.join("")}}@keyframes miner-action{${recoil.join("")}}@keyframes impact-flash{${impact.join("")}}`;
}
function walkingCss(timeline) {
  const moves = timeline.events.filter(
    (event) => event.type === "move"
  );
  const first = ["0%{transform:translate(0,0)}"];
  const second = ["0%{transform:translate(0,0)}"];
  const gait = ["0%{transform:translateY(0) rotate(0)}"];
  for (const move of moves) {
    const times = [
      move.start,
      move.start + move.duration * 0.25,
      move.start + move.duration * 0.5,
      move.start + move.duration * 0.75,
      move.start + move.duration
    ].map((time) => pct(time, timeline.duration));
    first.push(
      `${times[0]}%{transform:translate(0,0)}`,
      `${times[1]}%{transform:translate(1px,-1px)}`,
      `${times[2]}%{transform:translate(0,0)}`,
      `${times[3]}%{transform:translate(-1px,1px)}`,
      `${times[4]}%{transform:translate(0,0)}`
    );
    second.push(
      `${times[0]}%{transform:translate(0,0)}`,
      `${times[1]}%{transform:translate(-1px,1px)}`,
      `${times[2]}%{transform:translate(0,0)}`,
      `${times[3]}%{transform:translate(1px,-1px)}`,
      `${times[4]}%{transform:translate(0,0)}`
    );
    gait.push(
      `${times[0]}%{transform:translateY(0) rotate(0)}`,
      `${times[1]}%{transform:translateY(-.8px) rotate(-.7deg)}`,
      `${times[2]}%{transform:translateY(0) rotate(0)}`,
      `${times[3]}%{transform:translateY(-.8px) rotate(.7deg)}`,
      `${times[4]}%{transform:translateY(0) rotate(0)}`
    );
  }
  first.push("100%{transform:translate(0,0)}");
  second.push("100%{transform:translate(0,0)}");
  gait.push("100%{transform:translateY(0) rotate(0)}");
  return `@keyframes walk-a{${first.join("")}}@keyframes walk-b{${second.join("")}}@keyframes gait{${gait.join("")}}`;
}
function renderMiner() {
  return `<g class="miner" aria-label="pixel miner"><g class="miner-facing"><g class="miner-gait"><g class="miner-idle"><g class="miner-action">
  <g class="body" shape-rendering="crispEdges">
    <rect class="helmet" x="1" y="0" width="12" height="4"/><rect class="helmet-light" x="10" y="1" width="3" height="2"/>
    <rect class="skin" x="3" y="4" width="8" height="5"/><rect class="eye" x="9" y="5" width="2" height="2"/>
    <rect class="clothes" x="2" y="9" width="10" height="7"/><rect class="skin arm walk-b" x="12" y="10" width="3" height="3"/>
    <rect class="boots walk-a" x="2" y="16" width="4" height="3"/><rect class="boots walk-b" x="9" y="16" width="4" height="3"/>
  </g>
  <g class="pick" transform-origin="13px 11px"><path class="tool" d="M13 10h2v11h-2z"/><path class="tool" d="M9 8h10v2H9zM8 9h3v2H8zm10 0h3v2h-3z"/></g>
  <g class="impact"><path class="impact-star" d="M20 6h2v2h2v2h-2v2h-2v-2h-2V8h2z"/><rect class="impact-debris" x="17" y="5" width="1.5" height="1.5"/><rect class="impact-debris" x="24" y="12" width="1.5" height="1.5"/></g>
  </g></g></g></g></g>`;
}
function statsCss(timeline, showStats) {
  if (!showStats) return ".stats{display:none}";
  const event = timeline.events.find(
    (item) => item.type === "stats"
  );
  const start = pct(event.start, timeline.duration);
  const enter = pct(event.start + event.enterDuration, timeline.duration);
  const exit = pct(event.exitStart, timeline.duration);
  const end = pct(event.start + event.duration, timeline.duration);
  return `@keyframes stats-in{0%,${start}%{opacity:0;transform:translateY(5px)}${enter}%,${exit}%{opacity:1;transform:translateY(0)}${end}%,100%{opacity:0;transform:translateY(-4px)}}`;
}
function sceneResetCss(timeline) {
  const stats = timeline.events.find(
    (event) => event.type === "stats"
  );
  const start = pct(stats.start, timeline.duration);
  const faded = pct(stats.start + stats.enterDuration, timeline.duration);
  const end = pct(stats.start + stats.duration, timeline.duration);
  return `@keyframes grid-fade{0%,${start}%{opacity:1}${faded}%{opacity:.08}${end}%,99.6%{opacity:0}100%{opacity:1}}`;
}
function renderSvg(grid, timeline, options) {
  const theme = getTheme(options.theme);
  const width = LEFT * 2 + (grid.width - 1) * CELL + BLOCK;
  const height = TOP + 7 * CELL + FOOTER;
  const blocks = renderBlocks(grid, timeline);
  const title = `${options.username}'s GitHub contribution mine`;
  const css = `
svg{background:${theme.background}}.frame{fill:${theme.panel};stroke:${theme.gridLine}}.empty{fill:${theme.empty};stroke:${theme.gridLine};stroke-width:.6}.b{stroke:${theme.gridLine};stroke-width:.5}.ore-stone{fill:${theme.ore.stone}}.ore-copper{fill:${theme.ore.copper}}.ore-gold{fill:${theme.ore.gold}}.ore-diamond{fill:${theme.ore.diamond}}.ore-stone .shine{fill:${theme.oreHighlight.stone}}.ore-copper .shine{fill:${theme.oreHighlight.copper}}.ore-gold .shine{fill:${theme.oreHighlight.gold}}.ore-diamond .shine{fill:${theme.oreHighlight.diamond}}.crack{opacity:0;fill:none;stroke:${theme.crack};stroke-width:1;stroke-linecap:square;stroke-dasharray:24}.fragments>rect,.particles>rect{opacity:0}.grid{animation:grid-fade ${n(timeline.duration)}s linear infinite}.miner{transform:${transformPose({ x: -1, y: 6 }, "right")};animation:miner-route ${n(timeline.duration)}s linear infinite}.miner-facing{transform-origin:8px 10px;animation:face-route ${n(timeline.duration)}s linear infinite}.miner-gait{transform-origin:8px 16px;animation:gait ${n(timeline.duration)}s linear infinite}.miner-idle{animation:idle-bob 1.7s ease-in-out infinite}.miner-action{transform-origin:10px 12px;animation:miner-action ${n(timeline.duration)}s linear infinite}.helmet{fill:${theme.miner.helmet}}.helmet-light{fill:${theme.miner.helmetLight}}.skin{fill:${theme.miner.skin}}.eye{fill:${theme.text};transform-origin:10px 6px;animation:blink 4.8s steps(1) infinite}.clothes{fill:${theme.miner.clothes}}.boots{fill:${theme.miner.boots}}.walk-a{animation:walk-a ${n(timeline.duration)}s linear infinite}.walk-b{animation:walk-b ${n(timeline.duration)}s linear infinite}.tool{fill:${theme.miner.tool}}.pick{animation:pick-swing ${n(timeline.duration)}s linear infinite}.impact{opacity:0;transform-origin:21px 9px;animation:impact-flash ${n(timeline.duration)}s linear infinite}.impact-star{fill:${theme.miner.helmetLight}}.impact-debris{fill:${theme.text}}@keyframes idle-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.45px)}}@keyframes blink{0%,93%,95%,100%{transform:scaleY(1)}94%{transform:scaleY(.15)}}.label{font:600 10px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.text}}.muted{font:7px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.mutedText}}.stats{opacity:0;animation:stats-in ${n(timeline.duration)}s ease-out infinite;transform-origin:center}.stats-title{font:700 16px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.text};letter-spacing:1px}.stats-copy{font:9px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.mutedText}}${blocks.css}${minerRouteCss(timeline)}${minerFacingCss(timeline)}${minerActionCss(timeline)}${walkingCss(timeline)}${statsCss(timeline, options.showStats ?? true)}${sceneResetCss(timeline)}.miner-facing,.walk-a,.walk-b{animation-timing-function:steps(1,end)}`.replace(
    /\s+/g,
    " "
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title><desc id="desc">Animated pixel-art miner extracting ${timeline.stats.blocksMined} GitHub contribution blocks with ${timeline.stats.totalHits} pickaxe hits. The animation loops every ${n(timeline.duration)} seconds.</desc>
<style>${css}</style>
<rect width="${width}" height="${height}" rx="8" fill="${theme.background}"/><rect class="frame" x="8" y="8" width="${width - 16}" height="${height - 16}" rx="6"/>
<text class="label" x="${LEFT}" y="24">GIT MINER \xB7 ${escapeXml(options.username)}</text><text class="muted" x="${width - LEFT}" y="24" text-anchor="end">${timeline.stats.activeDays} ACTIVE DAYS \xB7 ${timeline.stats.totalHits} HITS</text>
<g class="grid">${blocks.markup}<path d="M${LEFT - 5} ${TOP + 7 * CELL + 5}H${width - LEFT + 5}" stroke="${theme.gridLine}" stroke-width="2"/>${renderMiner()}</g>
<g class="stats" text-anchor="middle"><rect x="${width / 2 - 190}" y="${TOP + 4}" width="380" height="76" rx="6" fill="${theme.panel}" stroke="${theme.gridLine}" opacity=".97"/><text class="stats-title" x="${width / 2}" y="${TOP + 33}">MINING COMPLETE</text><text class="stats-copy" x="${width / 2}" y="${TOP + 51}">${timeline.stats.totalContributions} CONTRIBUTIONS \xB7 ${timeline.stats.activeDays} ACTIVE DAYS</text><path d="M${width / 2 - 22} ${TOP + 61}h30v8h-30z m30 3h7v5h-7z" fill="${theme.ore.gold}"/><circle cx="${width / 2 - 14}" cy="${TOP + 72}" r="3" fill="${theme.text}"/><circle cx="${width / 2 + 3}" cy="${TOP + 72}" r="3" fill="${theme.text}"/></g>
</svg>`;
}

// src/action.ts
var input = (name) => process.env[`INPUT_${name.toUpperCase()}`]?.trim() ?? "";
function fail(message) {
  const escaped = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  process.stdout.write(`::error::${escaped}
`);
  process.exitCode = 1;
}
async function main() {
  const username = input("github_user_name");
  const token = input("github_token") || process.env.GITHUB_TOKEN || "";
  const outputs = parseOutputOptions(input("outputs"), {
    theme: input("theme") || "github-light",
    speed: input("speed") || "normal",
    showStats: !["false", "0", "no"].includes(
      (input("show_stats") || "true").toLowerCase()
    )
  });
  process.stdout.write(`\u26CF\uFE0F Fetching contributions for ${username}
`);
  const contributions = await fetchGitHubContributions(username, token);
  const grid = createContributionGrid(contributions);
  for (const output of outputs) {
    const timeline = createTimeline(grid, output.speed);
    const svg = renderSvg(grid, timeline, {
      username,
      theme: output.theme,
      speed: output.speed,
      showStats: output.showStats
    });
    await mkdir(dirname(output.filename), { recursive: true });
    await writeFile(output.filename, svg, "utf8");
    process.stdout.write(
      `\u{1F48E} Wrote ${output.filename} (${Buffer.byteLength(svg)} bytes)
`
    );
  }
}
main().catch(
  (error) => fail(error instanceof Error ? error.message : String(error))
);
