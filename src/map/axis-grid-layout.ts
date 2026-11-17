import {
  type AxisGrid,
  type AxisGridItem,
  type AxisGridLink,
  type AxisGridSection,
  type AxisGridSelection,
  type AxisGridShape,
  dateText,
  isWeekend,
} from "./axis-grid.ts";
import { MINDMAP_BRANCH_COLORS } from "./mindmap-layout.ts";

/** 軸と格子の配置の寸法（px）。タスク名の列の幅・記載順の軸の 1 歩・1 日の幅・行の高さ・格子のセルの幅・行の間・外周の余白・項目の間 */
export const AXIS_GRID_LAYOUT = {
  nameColumn: 200,
  step: 104,
  day: 28,
  row: 32,
  cellWidth: 156,
  rowGap: 36,
  margin: 24,
  gap: 16,
} as const;

/** 項目 1 つの位置と描き方 */
export type AxisGridPlacement = {
  /** 項目の `stateKey`（閉じた section は section の `stateKey`） */
  stateKey: string;
  shape: AxisGridShape | "collapsed";
  x: number;
  y: number;
  width: number;
  height: number;
  /** section・ブランチの色の名前 */
  color: string | undefined;
  /** 閉じた section・入れ子のブロックの中の項目の数 */
  count: number | undefined;
};

/** 軸の目盛り 1 つ（ガントチャートの日付・ジャーニーの点数） */
export type AxisGridTick = {
  /** ガントチャートは `YYYY-MM-DD`、ジャーニーは点数 */
  value: string;
  x: number;
  y: number;
  /** ガントチャートで土日を数えないときの土日 */
  weekend: boolean;
};

/** section の見出しの行・枠と入れ子のブロックの枠 */
export type AxisGridFrame = {
  /** section の `stateKey` */
  key: string;
  label: string;
  /** ガントチャートの行・タイムラインの枠・ジャーニーの帯・ブロック図の入れ子 */
  kind: "row" | "box" | "band" | "block";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string | undefined;
  collapsed: boolean;
};

/** Git グラフのブランチの線と、ジャーニーの人のタスクをつなぐ線 */
export type AxisGridLane = {
  kind: "branch" | "actor";
  /** ブランチ名か人の名前 */
  key: string;
  /** ブランチの線の y 座標（人の線は 0） */
  y: number;
  d: string;
  color: string | undefined;
  /** 線の上の項目の `stateKey` */
  members: string[];
};

/** つながりの線 */
export type AxisGridWire = {
  from: string;
  to: string;
  /** つながりの種類。期間から出来事への線は `stem`、ジャーニーの隣のタスクの線は `step` */
  kind: AxisGridLink["kind"] | "stem" | "step";
  d: string;
  color: string | undefined;
  /** ブロック図の線のラベル */
  label: { text: string; x: number; y: number } | undefined;
};

/** `layoutAxisGrid` の戻り値 */
export type AxisGridLayout = {
  items: AxisGridPlacement[];
  ticks: AxisGridTick[];
  frames: AxisGridFrame[];
  lanes: AxisGridLane[];
  links: AxisGridWire[];
  /** ガントチャートの今日の線の x 座標 */
  today: number | undefined;
  /** ガントチャートのタスク名の列・ジャーニーのタスク名の行の上端 */
  baseline: number;
  width: number;
  height: number;
};

/** `layoutAxisGrid` の引数 */
type LayoutOptions = {
  grid: AxisGrid;
  entered: string | undefined;
  collapsed: ReadonlySet<string>;
  today: string;
  selected: AxisGridSelection | undefined;
};

const { nameColumn, step, day, row, cellWidth, rowGap, margin, gap } =
  AXIS_GRID_LAYOUT;

/** 1 日のミリ秒 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Git グラフの commit の丸の大きさ */
const DOT = (row * 3) / 4;

/** 空の配置 */
const emptyLayout = (): AxisGridLayout => ({
  items: [],
  ticks: [],
  frames: [],
  lanes: [],
  links: [],
  today: undefined,
  baseline: margin,
  width: margin * 2,
  height: margin * 2,
});

/** section の記載順の色の名前 */
const sectionColor = (section: AxisGridSection | undefined): string =>
  section === undefined
    ? "gray"
    : (MINDMAP_BRANCH_COLORS[
        (section.order - 1) % MINDMAP_BRANCH_COLORS.length
      ] ?? "blue");

/** 項目を記載順に、属する section ごとのまとまりに分ける（section を持たない項目は 1 つずつのまとまり） */
const groupsOf = (
  grid: AxisGrid,
  items: AxisGridItem[],
): Array<{ section: AxisGridSection | undefined; items: AxisGridItem[] }> => {
  const groups: Array<{
    section: AxisGridSection | undefined;
    items: AxisGridItem[];
  }> = [];
  for (const item of items) {
    const section = grid.sections.find(
      (entry) => entry.stateKey === item.section,
    );
    const last = groups.at(-1);
    if (section !== undefined && last?.section === section)
      last.items.push(item);
    else groups.push({ section, items: [item] });
  }
  return groups;
};

/** 中へ入ったときはその section の項目だけ、ほかは全ての項目 */
const visibleItems = (options: LayoutOptions): AxisGridItem[] =>
  options.entered === undefined
    ? options.grid.items
    : options.grid.items.filter((item) => item.section === options.entered);

/** 閉じた section として描くなら、その section（中へ入った section は閉じない） */
const closedSection = (
  options: LayoutOptions,
  section: AxisGridSection | undefined,
): AxisGridSection | undefined =>
  section !== undefined &&
  section.stateKey !== options.entered &&
  options.collapsed.has(section.stateKey)
    ? section
    : undefined;

/** 閉じた section・入れ子のブロックの項目 */
const collapsedItem = (
  section: AxisGridSection,
  box: { x: number; y: number; width: number; height: number },
  color: string | undefined,
): AxisGridPlacement => ({
  stateKey: section.stateKey,
  shape: "collapsed",
  ...box,
  color,
  count: section.members.length,
});

/* ---------- ガントチャート ---------- */

/** タスクの開始日と終了日（終了日は含まない） */
const spanOf = (item: AxisGridItem): { start: Date; end: Date } => {
  const detail =
    item.detail.kind === "gantt"
      ? item.detail
      : { start: "1970-01-01", end: "1970-01-01" };
  return {
    start: new Date(`${detail.start}T00:00:00Z`),
    end: new Date(`${detail.end}T00:00:00Z`),
  };
};

/** ガントチャートの日付の軸 */
type GanttAxis = { from: Date; days: number; xOf: (date: Date) => number };

/** 対象のタスクの最初の開始日から最後の終了日の前日までの日付の軸 */
const ganttAxis = (items: AxisGridItem[]): GanttAxis => {
  const spans = items.map(spanOf);
  const from = new Date(Math.min(...spans.map((span) => span.start.getTime())));
  const last = Math.max(
    from.getTime(),
    Math.max(...spans.map((span) => span.end.getTime())) - DAY_MS,
  );
  const days =
    items.length === 0 ? 0 : Math.round((last - from.getTime()) / DAY_MS) + 1;
  return {
    from,
    days,
    xOf: (date) =>
      margin +
      nameColumn +
      Math.round((date.getTime() - from.getTime()) / DAY_MS) * day,
  };
};

/** タスク 1 つの棒（`milestone` はひし形） */
const ganttBar = (
  axis: GanttAxis,
  item: AxisGridItem,
  place: { top: number; color: string },
): AxisGridPlacement => {
  const span = spanOf(item);
  const x = axis.xOf(span.start);
  const milestone = item.shape === "milestone";
  const height = milestone ? row / 2 : (row * 5) / 8;
  return {
    stateKey: item.stateKey,
    shape: item.shape,
    x: milestone ? x - row / 4 : x,
    y: place.top + (row - height) / 2,
    width: milestone ? row / 2 : Math.max(axis.xOf(span.end) - x, 2),
    height,
    color: place.color,
    count: undefined,
  };
};

/** ガントチャートのまとまり 1 つ（section は見出しの行と枠）を配置し、次の行の上端を返却する */
const placeGanttGroup = (
  context: { options: LayoutOptions; layout: AxisGridLayout; axis: GanttAxis },
  group: { section: AxisGridSection | undefined; items: AxisGridItem[] },
  top: number,
): number => {
  const { options, layout, axis } = context;
  const color = sectionColor(group.section);
  let y = group.section === undefined ? top : top + row;
  const closed = closedSection(options, group.section);
  if (closed) {
    const spans = group.items.map(spanOf);
    const start = axis.xOf(
      new Date(Math.min(...spans.map((s) => s.start.getTime()))),
    );
    const end = axis.xOf(
      new Date(Math.max(...spans.map((s) => s.end.getTime()))),
    );
    layout.items.push(
      collapsedItem(
        closed,
        {
          x: start,
          y: top + row / 8,
          width: Math.max(end - start, 2),
          height: (row * 3) / 4,
        },
        color,
      ),
    );
    y = top + row;
  } else {
    for (const item of group.items) {
      layout.items.push(ganttBar(axis, item, { top: y, color }));
      y += row;
    }
  }
  if (group.section)
    layout.frames.push({
      key: group.section.stateKey,
      label: group.section.label,
      kind: "row",
      x: margin,
      y: top,
      width: nameColumn + axis.days * day,
      height: y - top,
      color,
      collapsed: closed !== undefined,
    });
  return y;
};

/** 選んだタスクと `after` でつながる前と後ろのタスクへの矢じりの線 */
const ganttAfterWires = (
  options: LayoutOptions,
  layout: AxisGridLayout,
): AxisGridWire[] => {
  const selected = options.selected;
  if (selected?.kind !== "item") return [];
  const placed = (key: string) =>
    layout.items.find(
      (item) => item.stateKey === key && item.shape !== "collapsed",
    );
  return options.grid.links.flatMap((link) => {
    if (
      link.kind !== "after" ||
      (link.from !== selected.key && link.to !== selected.key)
    )
      return [];
    const a = placed(link.from);
    const b = placed(link.to);
    if (!a || !b) return [];
    const x1 = a.x + a.width;
    const y1 = a.y + a.height / 2;
    const y2 = b.y + b.height / 2;
    return [
      {
        from: link.from,
        to: link.to,
        kind: "after",
        d: `M${x1} ${y1} H${x1 + 8} V${y2} H${b.x - 2}`,
        color: undefined,
        label: undefined,
      },
    ];
  });
};

/** ガントチャート: 上に日付の軸、左にタスク名の列を置き、タスクを記載順に 1 行ずつ開始日から終了日までの棒にする */
const layoutGantt = (options: LayoutOptions): AxisGridLayout => {
  const layout = emptyLayout();
  const items = visibleItems(options);
  const axis = ganttAxis(items);
  for (let index = 0; index < axis.days; index += 1) {
    const date = new Date(axis.from.getTime() + index * DAY_MS);
    layout.ticks.push({
      value: dateText(date),
      x: axis.xOf(date) + day / 2,
      y: margin + row / 2,
      weekend: options.grid.options.excludesWeekends && isWeekend(date),
    });
  }
  let y = margin + row;
  layout.baseline = y;
  for (const group of groupsOf(options.grid, items))
    y = placeGanttGroup({ options, layout, axis }, group, y);
  const today = layout.ticks.find((tick) => tick.value === options.today);
  layout.today = options.grid.options.todayMarker ? today?.x : undefined;
  layout.links = ganttAfterWires(options, layout);
  layout.width = margin * 2 + nameColumn + axis.days * day;
  layout.height = y + margin + row / 2;
  return layout;
};

/* ---------- タイムライン ---------- */

/** タイムラインの期間 1 つと、その下の出来事を配置し、出来事の下端を返却する */
const placePeriod = (
  context: { grid: AxisGrid; layout: AxisGridLayout },
  period: AxisGridItem,
  place: { x: number; color: string },
): number => {
  const { grid, layout } = context;
  const top = margin + row;
  const width = step - gap;
  layout.items.push({
    stateKey: period.stateKey,
    shape: "period",
    x: place.x,
    y: top,
    width,
    height: row,
    color: place.color,
    count: undefined,
  });
  let y = top + row + gap;
  for (const event of grid.items.filter(
    (item) => item.parent === period.order,
  )) {
    layout.items.push({
      stateKey: event.stateKey,
      shape: "event",
      x: place.x,
      y,
      width,
      height: row * 1.5,
      color: place.color,
      count: undefined,
    });
    const cx = place.x + width / 2;
    layout.links.push({
      from: period.stateKey,
      to: event.stateKey,
      kind: "stem",
      d: `M${cx} ${top + row} V${y}`,
      color: place.color,
      label: undefined,
    });
    y += row * 1.5 + gap / 2;
  }
  return y;
};

/** タイムライン: 期間を記載順に `step` ごとに右へ並べ、出来事を期間の下に縦に並べる */
const layoutTimeline = (options: LayoutOptions): AxisGridLayout => {
  const layout = emptyLayout();
  const periods = visibleItems(options).filter(
    (item) => item.shape === "period",
  );
  let x = margin;
  let bottom = margin + row * 2;
  for (const group of groupsOf(options.grid, periods)) {
    const left = x;
    const color = sectionColor(group.section);
    const closed = closedSection(options, group.section);
    if (closed) {
      layout.items.push(
        collapsedItem(
          closed,
          { x, y: margin + row, width: step - gap, height: row * 1.5 },
          color,
        ),
      );
      x += step;
    } else {
      for (const period of group.items) {
        bottom = Math.max(
          bottom,
          placePeriod({ grid: options.grid, layout }, period, { x, color }),
        );
        x += step;
      }
    }
    if (group.section)
      layout.frames.push({
        key: group.section.stateKey,
        label: group.section.label,
        kind: "box",
        x: left - gap / 4,
        y: margin,
        width: x - left - gap / 2,
        height: 0,
        color,
        collapsed: closed !== undefined,
      });
  }
  for (const frame of layout.frames) frame.height = bottom - margin;
  layout.baseline = margin + row * 1.5;
  layout.width = x - gap + margin;
  layout.height = bottom + margin;
  return layout;
};

/* ---------- Git グラフ ---------- */

/** Git グラフの commit のブランチ名 */
const branchOf = (item: AxisGridItem): string =>
  item.detail.kind === "gitGraph" ? item.detail.branch : "main";

/** ブランチの線の y 座標 */
const laneY = (grid: AxisGrid, branch: string): number =>
  margin + row + Math.max(grid.branches.indexOf(branch), 0) * row * 2;

/** commit の中心の x 座標 */
const commitX = (item: AxisGridItem): number =>
  margin + step + (item.order - 1) * step + step / 2;

/** ブランチの線（分かれる線は元の commit の右から出し、次の commit との中間で曲げる） */
const branchLane = (
  grid: AxisGrid,
  branch: string,
  index: number,
): AxisGridLane | undefined => {
  const commits = grid.items.filter((item) => branchOf(item) === branch);
  const first = commits[0];
  const last = commits.at(-1);
  if (!first || !last) return undefined;
  const y = laneY(grid, branch);
  const color = MINDMAP_BRANCH_COLORS[index % MINDMAP_BRANCH_COLORS.length];
  const fork = grid.links.find(
    (link) => link.kind === "parent" && link.to === first.stateKey,
  );
  const parent = grid.items.find(
    (item) => item.stateKey === fork?.from && branchOf(item) !== branch,
  );
  let d = `M${commitX(first)} ${y} H${commitX(last)}`;
  if (parent) {
    const px = commitX(parent);
    const py = laneY(grid, branchOf(parent));
    const mid = px + step / 2;
    const bend = Math.sign(y - py) * (row / 2);
    d = `M${px + DOT / 2} ${py} H${mid - row / 2} Q${mid} ${py} ${mid} ${py + bend} V${y - bend} Q${mid} ${y} ${mid + row / 2} ${y} H${commitX(last)}`;
  }
  return {
    kind: "branch",
    key: branch,
    y,
    d,
    color,
    members: commits.map((item) => item.stateKey),
  };
};

/** merge と cherry-pick の、取り込む commit からの曲線 */
const gitWires = (
  grid: AxisGrid,
  colors: Map<string, string | undefined>,
): AxisGridWire[] =>
  grid.links.flatMap((link) => {
    if (link.kind !== "merge" && link.kind !== "cherryPick") return [];
    const from = grid.items.find((item) => item.stateKey === link.from);
    const to = grid.items.find((item) => item.stateKey === link.to);
    if (!from || !to) return [];
    const x1 = commitX(from);
    const y1 = laneY(grid, branchOf(from));
    const x2 = commitX(to);
    const y2 = laneY(grid, branchOf(to));
    return [
      {
        from: link.from,
        to: link.to,
        kind: link.kind,
        d: `M${x1} ${y1} C${x2 - step / 2} ${y1} ${x2} ${y2} ${x2} ${y2}`,
        color: colors.get(branchOf(from)),
        label: undefined,
      },
    ];
  });

/** Git グラフ: ブランチを作った順に上から並べ、commit を記載順に `step` ごとに右へ並べる */
const layoutGitGraph = (options: LayoutOptions): AxisGridLayout => {
  const { grid } = options;
  const layout = emptyLayout();
  grid.branches.forEach((branch, index) => {
    const lane = branchLane(grid, branch, index);
    if (lane) layout.lanes.push(lane);
  });
  const colors = new Map(layout.lanes.map((lane) => [lane.key, lane.color]));
  for (const item of grid.items) {
    const y = laneY(grid, branchOf(item));
    layout.items.push({
      stateKey: item.stateKey,
      shape: item.shape,
      x: commitX(item) - DOT / 2,
      y: y - DOT / 2,
      width: DOT,
      height: DOT,
      color: colors.get(branchOf(item)),
      count: undefined,
    });
  }
  layout.links = gitWires(grid, colors);
  layout.baseline = margin + row;
  layout.width = margin * 2 + step + grid.items.length * step;
  layout.height =
    laneY(grid, grid.branches.at(-1) ?? "main") + row * 1.5 + margin;
  return layout;
};

/* ---------- ジャーニー ---------- */

/** ジャーニーの点数の目盛りの列の幅 */
const SCALE_COLUMN = row * 1.5;

/** 点数の中心の y 座標（点数が高いほど上） */
const scoreY = (score: number): number =>
  margin + row * 1.5 + (5 - score) * row;

/** ジャーニーのタスクの点数と人 */
const journeyOf = (item: AxisGridItem): { score: number; actors: string[] } =>
  item.detail.kind === "journey" ? item.detail : { score: 3, actors: [] };

/** 人の線（その人を持つタスクの印を記載順につなぐ） */
const actorLane = (
  layout: AxisGridLayout,
  lane: { items: AxisGridItem[]; actor: string; color: string | undefined },
): AxisGridLane => {
  const { items, actor, color } = lane;
  const members = items
    .filter((item) => journeyOf(item).actors.includes(actor))
    .map((item) => item.stateKey);
  const points = members.flatMap((key) => {
    const placed = layout.items.find((item) => item.stateKey === key);
    return placed
      ? [`${placed.x + placed.width / 2} ${placed.y + placed.height / 2}`]
      : [];
  });
  return {
    kind: "actor",
    key: actor,
    y: 0,
    d: points.length === 0 ? "" : `M${points.join(" L")}`,
    color,
    members,
  };
};

/** ジャーニーの人の記載順の色の名前 */
export const JOURNEY_ACTOR_COLORS = ["blue", "orange", "green"] as const;

/** ジャーニー: タスクを記載順に `step` ごとに右へ、点数 1〜5 の高さに置き、隣のタスクを線でつなぐ */
const layoutJourney = (options: LayoutOptions): AxisGridLayout => {
  const layout = emptyLayout();
  const items = visibleItems(options);
  let x = margin + SCALE_COLUMN;
  for (const group of groupsOf(options.grid, items)) {
    const left = x;
    const color = sectionColor(group.section);
    const closed = closedSection(options, group.section);
    const tasks = closed
      ? [{ section: closed, items: group.items }]
      : group.items.map((item) => ({ section: undefined, items: [item] }));
    for (const task of tasks) {
      const score =
        task.items.reduce((sum, item) => sum + journeyOf(item).score, 0) /
        task.items.length;
      const box = {
        x: x + (step - row) / 2,
        y: scoreY(score) - row / 2,
        width: row,
        height: row,
      };
      const only = task.items[0];
      if (task.section !== undefined)
        layout.items.push(collapsedItem(task.section, box, color));
      else if (only)
        layout.items.push({
          stateKey: only.stateKey,
          shape: "face",
          ...box,
          color,
          count: undefined,
        });
      x += step;
    }
    if (group.section)
      layout.frames.push({
        key: group.section.stateKey,
        label: group.section.label,
        kind: "band",
        x: left,
        y: margin,
        width: x - left,
        height: row,
        color,
        collapsed: closed !== undefined,
      });
  }
  for (let score = 1; score <= 5; score += 1)
    layout.ticks.push({
      value: String(score),
      x: margin,
      y: scoreY(score),
      weekend: false,
    });
  layout.items.slice(1).forEach((item, index) => {
    const before = layout.items[index];
    if (!before) return;
    layout.links.push({
      from: before.stateKey,
      to: item.stateKey,
      kind: "step",
      d: `M${before.x + row / 2} ${before.y + row / 2} L${item.x + row / 2} ${item.y + row / 2}`,
      color: undefined,
      label: undefined,
    });
  });
  const selected = options.selected;
  if (selected?.kind === "actor") {
    const index = options.grid.actors.indexOf(selected.key);
    layout.lanes.push(
      actorLane(layout, {
        items,
        actor: selected.key,
        color: JOURNEY_ACTOR_COLORS[index % JOURNEY_ACTOR_COLORS.length],
      }),
    );
  }
  layout.baseline = scoreY(1) + row / 2 + gap;
  layout.width = x + margin;
  layout.height = layout.baseline + row * 2.5 + margin;
  return layout;
};

/* ---------- ブロック図 ---------- */

/** 格子に並べるもの（項目か入れ子のブロック） */
type BlockChild =
  | { kind: "item"; item: AxisGridItem; width: number }
  | { kind: "section"; section: AxisGridSection; width: number };

/** 入れ子の中（`container` が無ければ最上位）に並べるものを記載順に返却する */
const blockChildren = (
  grid: AxisGrid,
  container: string | undefined,
): BlockChild[] => {
  const children: Array<BlockChild & { at: number }> = [
    ...grid.items
      .filter((item) => item.section === container)
      .map((item) => ({
        kind: "item" as const,
        item,
        width: item.detail.kind === "block" ? item.detail.width : 1,
        at: item.order,
      })),
    ...grid.sections
      .filter((section) => section.parent === container)
      .map((section) => ({
        kind: "section" as const,
        section,
        width: section.width,
        at: section.after + 0.5,
      })),
  ];
  return children.sort((a, b) => a.at - b.at);
};

/** ブロック図の格子を配置するときの値 */
type BlockContext = {
  options: LayoutOptions;
  layout: AxisGridLayout;
  /** 描いた項目と入れ子の `stateKey` から箱 */
  boxes: Map<string, { x: number; y: number; width: number; height: number }>;
};

/** 入れ子の見出しの高さと内側の余白 */
const BLOCK_HEAD = row;
const BLOCK_PAD = gap / 2;

/** 格子に並べるもの 1 つを配置し、その高さを返却する */
const placeBlockChild = (
  context: BlockContext,
  child: BlockChild,
  box: { x: number; y: number; width: number },
): number => {
  const { options, layout, boxes } = context;
  if (child.kind === "item") {
    if (child.item.shape === "space") return 0;
    const placed = { ...box, height: row };
    layout.items.push({
      stateKey: child.item.stateKey,
      shape: child.item.shape,
      ...placed,
      color: undefined,
      count: undefined,
    });
    boxes.set(child.item.stateKey, placed);
    return row;
  }
  const section = child.section;
  if (closedSection(options, section)) {
    const placed = { ...box, height: row };
    layout.items.push({
      ...collapsedItem(section, placed, undefined),
      count: section.members.filter(
        (order) => options.grid.items[order - 1]?.shape !== "space",
      ).length,
    });
    boxes.set(section.stateKey, placed);
    return row;
  }
  const inner = placeBlockGrid(context, {
    container: section,
    left: box.x + BLOCK_PAD,
    top: box.y + BLOCK_HEAD,
    width: box.width - BLOCK_PAD * 2,
  });
  const height = BLOCK_HEAD + inner + BLOCK_PAD;
  layout.frames.push({
    key: section.stateKey,
    label: section.label,
    kind: "block",
    ...box,
    height,
    color: undefined,
    collapsed: false,
  });
  boxes.set(section.stateKey, { ...box, height });
  return height;
};

/** 入れ子の中を `columns` の格子に並べ、占めた高さを返却する */
const placeBlockGrid = (
  context: BlockContext,
  area: {
    container: AxisGridSection | undefined;
    left: number;
    top: number;
    width: number | undefined;
  },
): number => {
  const { grid } = context.options;
  const columns = Math.max(
    area.container?.columns ?? grid.options.columns ?? 1,
    1,
  );
  const columnWidth =
    area.width === undefined
      ? cellWidth
      : (area.width - (columns - 1) * gap) / columns;
  let column = 0;
  let rowTop = area.top;
  let rowHeight = 0;
  for (const child of blockChildren(grid, area.container?.stateKey)) {
    const span = Math.min(Math.max(child.width, 1), columns);
    if (column + span > columns) {
      column = 0;
      rowTop += rowHeight + rowGap;
      rowHeight = 0;
    }
    const x = area.left + column * (columnWidth + gap);
    const width = span * columnWidth + (span - 1) * gap;
    rowHeight = Math.max(
      rowHeight,
      placeBlockChild(context, child, { x, y: rowTop, width }),
    );
    column += span;
  }
  return rowTop + rowHeight - area.top;
};

/** 描いた箱（閉じた入れ子の中の項目は入れ子の箱） */
const visibleBox = (context: BlockContext, key: string) => {
  const { grid, collapsed } = context.options;
  let section =
    grid.items.find((item) => item.stateKey === key)?.section ??
    grid.sections.find((entry) => entry.stateKey === key)?.parent;
  let target = key;
  while (section !== undefined) {
    if (collapsed.has(section)) target = section;
    section = grid.sections.find((entry) => entry.stateKey === section)?.parent;
  }
  const box = context.boxes.get(target);
  return box === undefined ? undefined : { key: target, box };
};

/** 箱の位置と大きさ */
type Box = { x: number; y: number; width: number; height: number };

/** 横に離れた 2 つの箱の左右の辺をつなぐ、縦に折れる線 */
const sideToSide = (a: Box, b: Box): string => {
  const ay = a.y + a.height / 2;
  const by = b.y + b.height / 2;
  const right = a.x < b.x;
  const x1 = right ? a.x + a.width : a.x;
  const x2 = right ? b.x : b.x + b.width;
  return `M${x1} ${ay} H${(x1 + x2) / 2} V${by} H${x2}`;
};

/** 縦に並んだ 2 つの箱の上下の辺をつなぐ、横に折れる線 */
const topToBottom = (a: Box, b: Box): string => {
  const ax = a.x + a.width / 2;
  const bx = b.x + b.width / 2;
  const down = a.y < b.y;
  const y1 = down ? a.y + a.height : a.y;
  const y2 = down ? b.y : b.y + b.height;
  return `M${ax} ${y1} V${(y1 + y2) / 2} H${bx} V${y2}`;
};

/** 2 つの箱の辺から辺へ、横か縦に折れる線 */
const blockWirePath = (a: Box, b: Box): string =>
  b.x >= a.x + a.width || a.x >= b.x + b.width
    ? sideToSide(a, b)
    : topToBottom(a, b);

/** ブロック図の線（両端の箱の辺から辺へ、横か縦に折れる線） */
const blockWire = (
  context: BlockContext,
  link: AxisGridLink,
): AxisGridWire[] => {
  const a = visibleBox(context, link.from);
  const b = visibleBox(context, link.to);
  if (!a || !b || a.key === b.key) return [];
  const ac = { x: a.box.x + a.box.width / 2, y: a.box.y + a.box.height / 2 };
  const bc = { x: b.box.x + b.box.width / 2, y: b.box.y + b.box.height / 2 };
  const d = blockWirePath(a.box, b.box);
  const label =
    link.label === undefined
      ? undefined
      : { text: link.label, x: (ac.x + bc.x) / 2, y: (ac.y + bc.y) / 2 };
  return [
    { from: a.key, to: b.key, kind: "arrow", d, color: undefined, label },
  ];
};

/** ブロック図: `columns` の列の数の格子に記載順に左から右へ並べ、入れ子は中の `columns` で格子を作り直す */
const layoutBlock = (options: LayoutOptions): AxisGridLayout => {
  const layout = emptyLayout();
  const context: BlockContext = { options, layout, boxes: new Map() };
  const entered = options.grid.sections.find(
    (section) => section.stateKey === options.entered,
  );
  const height = placeBlockGrid(context, {
    container: entered,
    left: margin,
    top: margin,
    width: undefined,
  });
  layout.links = options.grid.links.flatMap((link) => blockWire(context, link));
  const right = Math.max(
    margin,
    ...[...context.boxes.values()].map((box) => box.x + box.width),
  );
  layout.baseline = margin;
  layout.width = right + margin;
  layout.height = margin * 2 + height;
  return layout;
};

/** 種類ごとに、日付の軸・記載順の軸・`columns` の格子に項目を配置する */
export const layoutAxisGrid = (options: LayoutOptions): AxisGridLayout => {
  switch (options.grid.kind) {
    case "gantt":
      return layoutGantt(options);
    case "timeline":
      return layoutTimeline(options);
    case "gitGraph":
      return layoutGitGraph(options);
    case "journey":
      return layoutJourney(options);
    case "block":
      return layoutBlock(options);
    default:
      return emptyLayout();
  }
};
