import { eventsForCell, mineEvents } from "./core/timeline.js";
import { getTheme } from "./themes.js";
import type {
  BreakEvent,
  ContributionGrid,
  Facing,
  MineEvent,
  MoveEvent,
  OreCell,
  ParticleEvent,
  RenderOptions,
  StatsEvent,
  Timeline,
} from "./types.js";

const CELL = 13;
const BLOCK = 10;
const LEFT = 26;
const TOP = 38;
const FOOTER = 49;

const n = (value: number) => Number(value.toFixed(3));
const pct = (time: number, duration: number) => n((time / duration) * 100);
const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function blockPosition(cell: OreCell) {
  return { x: LEFT + cell.x * CELL, y: TOP + cell.y * CELL };
}

function blockAnimationCss(
  cell: OreCell,
  index: number,
  timeline: Timeline,
): string {
  const events = eventsForCell(timeline, cell);
  const hits = events.filter(
    (event): event is MineEvent => event.type === "mine",
  );
  const broken = events.find(
    (event): event is BreakEvent => event.type === "break",
  )!;
  const particles = events.find(
    (event): event is ParticleEvent => event.type === "particles",
  )!;
  const { x, y } = blockPosition(cell);
  const cx = x + BLOCK / 2;
  const cy = y + BLOCK / 2;
  const blockFrames: string[] = [
    "0%{opacity:1;transform:translate(0,0) scale(1);filter:brightness(1)}",
  ];
  const crackFrames: string[] = ["0%{opacity:0;stroke-dashoffset:24}"];

  for (const hit of hits) {
    const damage = n(1 - hit.hit * 0.075);
    const dash = n(24 * (1 - hit.hit / hit.hits));
    const shake = hit.isFinal ? 1.7 : 1;
    blockFrames.push(
      `${pct(hit.windupEnd, timeline.duration)}%{transform:translate(0,0) scale(1);filter:brightness(${n(damage + 0.04)})}`,
      `${pct(hit.impactAt, timeline.duration)}%{transform:translate(${shake}px,-.5px) scale(${hit.isFinal ? 1.045 : 1.025});filter:brightness(1.35)}`,
      `${pct(hit.impactEnd, timeline.duration)}%{transform:translate(${-shake * 0.55}px,.5px) scale(.985);filter:brightness(${damage})}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:translate(0,0) scale(1);filter:brightness(${damage})}`,
    );
    crackFrames.push(
      `${pct(hit.impactAt, timeline.duration)}%{opacity:1;stroke-dashoffset:${dash}}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{opacity:1;stroke-dashoffset:${dash}}`,
    );
  }

  blockFrames.push(
    `${pct(broken.start, timeline.duration)}%{opacity:1;transform:translate(0,0) scale(1)}`,
    `${pct(broken.fragmentAt, timeline.duration)}%{opacity:.45;transform:translate(0,1px) scale(.88)}`,
    `${pct(broken.start + broken.duration, timeline.duration)}%{opacity:0;transform:translate(0,2px) scale(.64)}`,
    "100%{opacity:0;transform:translate(0,2px) scale(.64)}",
  );
  crackFrames.push(
    `${pct(broken.start, timeline.duration)}%{opacity:1;stroke-dashoffset:0}`,
    `${pct(broken.fragmentAt, timeline.duration)}%{opacity:1;stroke-dashoffset:0}`,
    `${pct(broken.start + broken.duration, timeline.duration)}%{opacity:0;stroke-dashoffset:0}`,
    "100%{opacity:0;stroke-dashoffset:0}",
  );

  const breakStart = pct(broken.start, timeline.duration);
  const fragmentAt = pct(broken.fragmentAt, timeline.duration);
  const breakEnd = pct(broken.start + broken.duration, timeline.duration);
  const particleStart = pct(particles.start, timeline.duration);
  const particlePeak = pct(particles.peakAt, timeline.duration);
  const particleFade = pct(particles.fadeAt, timeline.duration);
  const particleEnd = pct(
    particles.start + particles.duration,
    timeline.duration,
  );

  return `@keyframes b${index}{${blockFrames.join("")}}
@keyframes k${index}{${crackFrames.join("")}}
@keyframes f${index}{0%,${breakStart}%{opacity:0;transform:translate(0,0) rotate(0)}${fragmentAt}%{opacity:1;transform:translate(0,0) rotate(0)}${breakEnd}%{opacity:0;transform:translate(var(--fx),var(--fy)) rotate(var(--fr))}100%{opacity:0;transform:translate(var(--fx),var(--fy)) rotate(var(--fr))}}
@keyframes p${index}{0%,${particleStart}%{opacity:0;transform:translate(0,0)}${particlePeak}%{opacity:1;transform:translate(0,0)}${particleFade}%{opacity:.8}${particleEnd}%{opacity:0;transform:translate(var(--dx),var(--dy))}100%{opacity:0;transform:translate(var(--dx),var(--dy))}}
.b${index}{animation:b${index} ${n(timeline.duration)}s linear infinite;transform-origin:${cx}px ${cy}px}.k${index}{animation:k${index} ${n(timeline.duration)}s linear infinite}.f${index}>rect{animation:f${index} ${n(timeline.duration)}s cubic-bezier(.2,.7,.3,1) infinite;transform-origin:${cx}px ${cy}px}.p${index}>rect{animation:p${index} ${n(timeline.duration)}s cubic-bezier(.15,.65,.3,1) infinite}`;
}

function renderBlocks(
  grid: ContributionGrid,
  timeline: Timeline,
): { markup: string; css: string } {
  let activeIndex = 0;
  const styles: string[] = [];
  const markup = grid.cells
    .map((cell) => {
      const { x, y } = blockPosition(cell);
      if (cell.ore === "empty") {
        return `<rect class="empty" x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="2"/>`;
      }

      const index = activeIndex++;
      styles.push(blockAnimationCss(cell, index, timeline));
      return `<g class="b b${index} ore-${cell.ore}"><rect x="${x}" y="${y}" width="${BLOCK}" height="${BLOCK}" rx="1.5"/><path class="shine" d="M${x + 2} ${y + 2}h4v2h-4z"/><path class="crack k${index}" d="M${x + 5} ${y}l-2 3 3 2-3 2 4 3m0-8-2 3 4 2m-7-1 3 1"/></g><g class="fragments f${index} ore-${cell.ore}"><rect x="${x}" y="${y}" width="4" height="4" style="--fx:-4px;--fy:-3px;--fr:-12deg"/><rect x="${x + 6}" y="${y}" width="4" height="4" style="--fx:4px;--fy:-4px;--fr:14deg"/><rect x="${x}" y="${y + 6}" width="4" height="4" style="--fx:-3px;--fy:5px;--fr:9deg"/><rect x="${x + 6}" y="${y + 6}" width="4" height="4" style="--fx:4px;--fy:5px;--fr:-10deg"/></g><g class="particles p${index} ore-${cell.ore}"><rect x="${x + 7}" y="${y + 2}" width="2" height="2" style="--dx:-7px;--dy:-7px"/><rect x="${x + 8}" y="${y + 3}" width="2" height="2" style="--dx:6px;--dy:-5px"/><rect x="${x + 6}" y="${y + 4}" width="2" height="2" style="--dx:-5px;--dy:5px"/><rect x="${x + 8}" y="${y + 5}" width="2" height="2" style="--dx:7px;--dy:6px"/><rect x="${x + 7}" y="${y + 3}" width="2" height="2" style="--dx:1px;--dy:-9px"/></g>`;
    })
    .join("");
  return { markup, css: styles.join("\n") };
}

function minerPose(point: { x: number; y: number }, facing: Facing) {
  if (point.x < 0) return { x: 9, y: TOP + point.y * CELL - 5 };
  const targetX = LEFT + point.x * CELL;
  return {
    x: facing === "right" ? targetX - 17 : targetX + 5,
    y: TOP + point.y * CELL - 5,
  };
}

const transformPose = (point: { x: number; y: number }, facing: Facing) => {
  const pose = minerPose(point, facing);
  return `translate(${pose.x}px,${pose.y}px)`;
};

function minerRouteCss(timeline: Timeline): string {
  const moves = timeline.events.filter(
    (event): event is MoveEvent => event.type === "move",
  );
  const frames = [
    `0%{transform:${transformPose({ x: -1, y: 6 }, "right")};opacity:1}`,
  ];
  for (const move of moves) {
    frames.push(
      `${pct(move.start, timeline.duration)}%{transform:${transformPose(move.from, move.fromFacing)};opacity:1;animation-timing-function:cubic-bezier(.45,0,.2,1)}`,
      `${pct(move.start + move.duration, timeline.duration)}%{transform:${transformPose(move.to, move.facing)};opacity:1}`,
    );
  }
  const stats = timeline.events.find(
    (event): event is StatsEvent => event.type === "stats",
  )!;
  const lastMove = moves.at(-1);
  const finalPose = lastMove
    ? transformPose(lastMove.to, lastMove.facing)
    : transformPose({ x: -1, y: 6 }, "right");
  frames.push(
    `${pct(stats.start, timeline.duration)}%{transform:${finalPose};opacity:1}`,
    `${pct(stats.start + stats.enterDuration, timeline.duration)}%{transform:${finalPose};opacity:0}`,
    `100%{transform:${finalPose};opacity:0}`,
  );
  return `@keyframes miner-route{${frames.join("")}}`;
}

function minerFacingCss(timeline: Timeline): string {
  const moves = timeline.events.filter(
    (event): event is MoveEvent => event.type === "move",
  );
  const scale = (facing: Facing) => (facing === "right" ? 1 : -1);
  const frames = ["0%{transform:scaleX(1)}"];
  for (const move of moves) {
    frames.push(
      `${pct(move.start, timeline.duration)}%{transform:scaleX(${scale(move.fromFacing)})}`,
      `${pct(move.turnEnd, timeline.duration)}%{transform:scaleX(${scale(move.facing)})}`,
      `${pct(move.start + move.duration, timeline.duration)}%{transform:scaleX(${scale(move.facing)})}`,
    );
  }
  const stats = timeline.events.find(
    (event): event is StatsEvent => event.type === "stats",
  )!;
  const finalFacing = moves.at(-1)?.facing ?? "right";
  const finalScale = scale(finalFacing);
  frames.push(
    `${pct(stats.start, timeline.duration)}%{transform:scaleX(${finalScale})}`,
    `${pct(stats.start + stats.enterDuration, timeline.duration)}%{transform:scaleX(${finalScale})}`,
    `100%{transform:scaleX(${finalScale})}`,
  );
  return `@keyframes face-route{${frames.join("")}}`;
}

function minerActionCss(timeline: Timeline): string {
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
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:rotate(-32deg)}`,
    );
    recoil.push(
      `${pct(hit.start, timeline.duration)}%{transform:translateX(0) rotate(0)}`,
      `${pct(hit.windupEnd, timeline.duration)}%{transform:translateX(-.5px) rotate(-2deg)}`,
      `${pct(hit.impactAt, timeline.duration)}%{transform:translateX(${recoilDistance}px) rotate(1.2deg)}`,
      `${pct(hit.impactEnd, timeline.duration)}%{transform:translateX(.45px) rotate(-.8deg)}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{transform:translateX(0) rotate(0)}`,
    );
    impact.push(
      `${pct(hit.windupEnd, timeline.duration)}%{opacity:0;transform:scale(.4)}`,
      `${pct(hit.impactAt, timeline.duration)}%{opacity:1;transform:scale(${hit.isFinal ? 1.45 : 1})}`,
      `${pct(hit.impactEnd, timeline.duration)}%{opacity:0;transform:scale(1.7)}`,
      `${pct(hit.recoveryEnd, timeline.duration)}%{opacity:0;transform:scale(.4)}`,
    );
  }

  pick.push("100%{transform:rotate(-32deg)}");
  recoil.push("100%{transform:translateX(0) rotate(0)}");
  impact.push("100%{opacity:0;transform:scale(.4)}");
  return `@keyframes pick-swing{${pick.join("")}}@keyframes miner-action{${recoil.join("")}}@keyframes impact-flash{${impact.join("")}}`;
}

function walkingCss(timeline: Timeline): string {
  const moves = timeline.events.filter(
    (event): event is MoveEvent => event.type === "move",
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
      move.start + move.duration,
    ].map((time) => pct(time, timeline.duration));
    first.push(
      `${times[0]}%{transform:translate(0,0)}`,
      `${times[1]}%{transform:translate(1px,-1px)}`,
      `${times[2]}%{transform:translate(0,0)}`,
      `${times[3]}%{transform:translate(-1px,1px)}`,
      `${times[4]}%{transform:translate(0,0)}`,
    );
    second.push(
      `${times[0]}%{transform:translate(0,0)}`,
      `${times[1]}%{transform:translate(-1px,1px)}`,
      `${times[2]}%{transform:translate(0,0)}`,
      `${times[3]}%{transform:translate(1px,-1px)}`,
      `${times[4]}%{transform:translate(0,0)}`,
    );
    gait.push(
      `${times[0]}%{transform:translateY(0) rotate(0)}`,
      `${times[1]}%{transform:translateY(-.8px) rotate(-.7deg)}`,
      `${times[2]}%{transform:translateY(0) rotate(0)}`,
      `${times[3]}%{transform:translateY(-.8px) rotate(.7deg)}`,
      `${times[4]}%{transform:translateY(0) rotate(0)}`,
    );
  }
  first.push("100%{transform:translate(0,0)}");
  second.push("100%{transform:translate(0,0)}");
  gait.push("100%{transform:translateY(0) rotate(0)}");
  return `@keyframes walk-a{${first.join("")}}@keyframes walk-b{${second.join("")}}@keyframes gait{${gait.join("")}}`;
}

function renderMiner(): string {
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

function statsCss(timeline: Timeline, showStats: boolean): string {
  if (!showStats) return ".stats{display:none}";
  const event = timeline.events.find(
    (item): item is StatsEvent => item.type === "stats",
  )!;
  const start = pct(event.start, timeline.duration);
  const enter = pct(event.start + event.enterDuration, timeline.duration);
  const exit = pct(event.exitStart, timeline.duration);
  const end = pct(event.start + event.duration, timeline.duration);
  return `@keyframes stats-in{0%,${start}%{opacity:0;transform:translateY(5px)}${enter}%,${exit}%{opacity:1;transform:translateY(0)}${end}%,100%{opacity:0;transform:translateY(-4px)}}`;
}

function sceneResetCss(timeline: Timeline): string {
  const stats = timeline.events.find(
    (event): event is StatsEvent => event.type === "stats",
  )!;
  const start = pct(stats.start, timeline.duration);
  const faded = pct(stats.start + stats.enterDuration, timeline.duration);
  const end = pct(stats.start + stats.duration, timeline.duration);
  return `@keyframes grid-fade{0%,${start}%{opacity:1}${faded}%{opacity:.08}${end}%,99.6%{opacity:0}100%{opacity:1}}`;
}

export function renderSvg(
  grid: ContributionGrid,
  timeline: Timeline,
  options: RenderOptions,
): string {
  const theme = getTheme(options.theme);
  const width = LEFT * 2 + (grid.width - 1) * CELL + BLOCK;
  const height = TOP + 7 * CELL + FOOTER;
  const blocks = renderBlocks(grid, timeline);
  const title = `${options.username}'s GitHub contribution mine`;

  const css = `
svg{background:${theme.background}}.frame{fill:${theme.panel};stroke:${theme.gridLine}}.empty{fill:${theme.empty};stroke:${theme.gridLine};stroke-width:.6}.b{stroke:${theme.gridLine};stroke-width:.5}.ore-stone{fill:${theme.ore.stone}}.ore-copper{fill:${theme.ore.copper}}.ore-gold{fill:${theme.ore.gold}}.ore-diamond{fill:${theme.ore.diamond}}.ore-stone .shine{fill:${theme.oreHighlight.stone}}.ore-copper .shine{fill:${theme.oreHighlight.copper}}.ore-gold .shine{fill:${theme.oreHighlight.gold}}.ore-diamond .shine{fill:${theme.oreHighlight.diamond}}.crack{opacity:0;fill:none;stroke:${theme.crack};stroke-width:1;stroke-linecap:square;stroke-dasharray:24}.fragments>rect,.particles>rect{opacity:0}.grid{animation:grid-fade ${n(timeline.duration)}s linear infinite}.miner{transform:${transformPose({ x: -1, y: 6 }, "right")};animation:miner-route ${n(timeline.duration)}s linear infinite}.miner-facing{transform-origin:8px 10px;animation:face-route ${n(timeline.duration)}s linear infinite}.miner-gait{transform-origin:8px 16px;animation:gait ${n(timeline.duration)}s linear infinite}.miner-idle{animation:idle-bob 1.7s ease-in-out infinite}.miner-action{transform-origin:10px 12px;animation:miner-action ${n(timeline.duration)}s linear infinite}.helmet{fill:${theme.miner.helmet}}.helmet-light{fill:${theme.miner.helmetLight}}.skin{fill:${theme.miner.skin}}.eye{fill:${theme.text};transform-origin:10px 6px;animation:blink 4.8s steps(1) infinite}.clothes{fill:${theme.miner.clothes}}.boots{fill:${theme.miner.boots}}.walk-a{animation:walk-a ${n(timeline.duration)}s linear infinite}.walk-b{animation:walk-b ${n(timeline.duration)}s linear infinite}.tool{fill:${theme.miner.tool}}.pick{animation:pick-swing ${n(timeline.duration)}s linear infinite}.impact{opacity:0;transform-origin:21px 9px;animation:impact-flash ${n(timeline.duration)}s linear infinite}.impact-star{fill:${theme.miner.helmetLight}}.impact-debris{fill:${theme.text}}@keyframes idle-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-.45px)}}@keyframes blink{0%,93%,95%,100%{transform:scaleY(1)}94%{transform:scaleY(.15)}}.label{font:600 10px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.text}}.muted{font:7px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.mutedText}}.stats{opacity:0;animation:stats-in ${n(timeline.duration)}s ease-out infinite;transform-origin:center}.stats-title{font:700 16px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.text};letter-spacing:1px}.stats-copy{font:9px ui-monospace,SFMono-Regular,Consolas,monospace;fill:${theme.mutedText}}${blocks.css}${minerRouteCss(timeline)}${minerFacingCss(timeline)}${minerActionCss(timeline)}${walkingCss(timeline)}${statsCss(timeline, options.showStats ?? true)}${sceneResetCss(timeline)}.miner-facing,.walk-a,.walk-b{animation-timing-function:steps(1,end)}`.replace(
    /\s+/g,
    " ",
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title><desc id="desc">Animated pixel-art miner extracting ${timeline.stats.blocksMined} GitHub contribution blocks with ${timeline.stats.totalHits} pickaxe hits. The animation loops every ${n(timeline.duration)} seconds.</desc>
<style>${css}</style>
<rect width="${width}" height="${height}" rx="8" fill="${theme.background}"/><rect class="frame" x="8" y="8" width="${width - 16}" height="${height - 16}" rx="6"/>
<text class="label" x="${LEFT}" y="24">GIT MINER · ${escapeXml(options.username)}</text><text class="muted" x="${width - LEFT}" y="24" text-anchor="end">${timeline.stats.activeDays} ACTIVE DAYS · ${timeline.stats.totalHits} HITS</text>
<g class="grid">${blocks.markup}<path d="M${LEFT - 5} ${TOP + 7 * CELL + 5}H${width - LEFT + 5}" stroke="${theme.gridLine}" stroke-width="2"/>${renderMiner()}</g>
<g class="stats" text-anchor="middle"><rect x="${width / 2 - 190}" y="${TOP + 4}" width="380" height="76" rx="6" fill="${theme.panel}" stroke="${theme.gridLine}" opacity=".97"/><text class="stats-title" x="${width / 2}" y="${TOP + 33}">MINING COMPLETE</text><text class="stats-copy" x="${width / 2}" y="${TOP + 51}">${timeline.stats.totalContributions} CONTRIBUTIONS · ${timeline.stats.activeDays} ACTIVE DAYS</text><path d="M${width / 2 - 22} ${TOP + 61}h30v8h-30z m30 3h7v5h-7z" fill="${theme.ore.gold}"/><circle cx="${width / 2 - 14}" cy="${TOP + 72}" r="3" fill="${theme.text}"/><circle cx="${width / 2 + 3}" cy="${TOP + 72}" r="3" fill="${theme.text}"/></g>
</svg>`;
}
