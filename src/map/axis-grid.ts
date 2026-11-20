import { type MermaidStyles, readMermaidStyles } from "./mermaid-style.ts";
import type { MapProblem } from "./spec.ts";
import { mermaidMainBranchOf } from "./structure.ts";

/** 軸と格子の配置の図の種類 */
export type AxisGridKind =
  | "gantt"
  | "timeline"
  | "gitGraph"
  | "journey"
  | "block";

/** 軸と格子の配置の図の項目の形状 */
export type AxisGridShape =
  | "bar"
  | "milestone"
  | "period"
  | "event"
  | "commit"
  | "highlight"
  | "reverse"
  | "merge"
  | "cherryPick"
  | "face"
  | "square"
  | "rounded"
  | "circle"
  | "cylinder"
  | "stadium"
  | "subroutine"
  | "flag"
  | "rhombus"
  | "hexagon"
  | "lean-right"
  | "lean-left"
  | "trapezoid"
  | "trapezoid-alt"
  | "double-circle"
  | "arrow-right"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "arrow-x"
  | "arrow-y"
  | "space";

/** 種類に固有の項目の値 */
export type AxisGridDetail =
  | {
      kind: "gantt";
      /** 開始日（`YYYY-MM-DD`） */
      start: string;
      /** 終了日（`YYYY-MM-DD`。この日を含まない） */
      end: string;
      tags: string[];
    }
  | { kind: "timeline" }
  | {
      kind: "gitGraph";
      branch: string;
      tag: string | undefined;
      /** cherry-pick の元の commit の ID */
      source: string | undefined;
    }
  | { kind: "journey"; score: number; actors: string[] }
  | { kind: "block"; width: number };

/** 軸と格子の配置の図の項目 1 つ */
export type AxisGridItem = {
  /** 記載の順の番号（1 から） */
  order: number;
  id: string | undefined;
  label: string;
  shape: AxisGridShape;
  /** 属する section・入れ子のブロックの `stateKey` */
  section: string | undefined;
  /** タイムラインの出来事の期間の `order` */
  parent: number | undefined;
  detail: AxisGridDetail;
  /** 補足とマーカーの引数の `focus` が指すキー */
  key: string;
  /** 状態の保存と描画が項目を区別するキー */
  stateKey: string;
};

/** section と入れ子のブロック */
export type AxisGridSection = {
  /** 記載の順の番号（1 から） */
  order: number;
  label: string;
  stateKey: string;
  /** 中の項目の `order`（タイムラインは期間だけ） */
  members: number[];
  /** 入れ子のブロックの中の `columns` */
  columns: number | undefined;
  /** 外の入れ子のブロックの `stateKey` */
  parent: string | undefined;
  /** ブロック図の入れ子のブロックの、外の格子での幅（列の数） */
  width: number;
  /** ブロック図の入れ子のブロックの前に記載した項目の `order`（無ければ 0）。外の格子の並びの位置になる */
  after: number;
};

/** 項目の間のつながり 1 つ。両端は項目か入れ子のブロックの `stateKey` */
export type AxisGridLink = {
  from: string;
  to: string;
  kind: "after" | "parent" | "merge" | "cherryPick" | "arrow";
  label: string | undefined;
};

/** 選んだ項目・ブランチ・人 */
export type AxisGridSelection = {
  kind: "item" | "branch" | "actor";
  key: string;
};

/** `parseAxisGrid` の戻り値 */
export type AxisGrid = {
  kind: AxisGridKind;
  title: string | undefined;
  items: AxisGridItem[];
  sections: AxisGridSection[];
  branches: string[];
  actors: string[];
  links: AxisGridLink[];
  options: {
    dateFormat?: string;
    axisFormat?: string;
    excludesWeekends: boolean;
    todayMarker: boolean;
    columns?: number;
  };
  /** ID を持たない 2 つ以上の項目が使う表示する文字と、2 つ以上の section が使う名前 */
  ambiguous: ReadonlySet<string>;
  problems: MapProblem[];
  /** Mermaid の 1 行目の最初の単語 */
  firstWord: string;
  /** `readMermaidStyles` が読み取った項目の色（ブロック図の `classDef`・`class`・`style`） */
  styles: MermaidStyles;
};

/** 読み取りの途中の項目（`key`・`stateKey` は最後に決める） */
type DraftItem = Omit<AxisGridItem, "key" | "stateKey" | "section"> & {
  /** 属する section・入れ子のブロックの `order` */
  sectionOrder: number | undefined;
};

/** 読み取りの途中の section */
type DraftSection = Omit<AxisGridSection, "stateKey" | "parent"> & {
  parentOrder: number | undefined;
};

/** 読み取りの途中のつながり（両端は項目の `order`。ブロック図は ID） */
type DraftLink = {
  from: number | string;
  to: number | string;
  kind: AxisGridLink["kind"];
  label: string | undefined;
};

/** 種類ごとの読み取りが書き込む値 */
type ParseState = {
  grid: Omit<
    AxisGrid,
    | "items"
    | "sections"
    | "links"
    | "ambiguous"
    | "kind"
    | "firstWord"
    | "styles"
  >;
  items: DraftItem[];
  sections: DraftSection[];
  links: DraftLink[];
};

/** 1 日のミリ秒 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 読めない行の項目 */
const unreadable = (line: number, text: string, fix: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${text}\` を読めないため、この行を読み飛ばしました。${fix}`,
});

/** UTC の日付を `YYYY-MM-DD` にする */
export const dateText = (date: Date): string => date.toISOString().slice(0, 10);

/** 土日か */
export const isWeekend = (date: Date): boolean =>
  date.getUTCDay() === 0 || date.getUTCDay() === 6;

/** 開始日から期間の日数を足した終了日（`excludesWeekends` のときは土日を数えない） */
const addDays = (
  start: Date,
  days: number,
  excludesWeekends: boolean,
): Date => {
  let date = start;
  let left = days;
  while (left > 0) {
    if (!(excludesWeekends && isWeekend(date))) left -= 1;
    date = new Date(date.getTime() + DAY_MS);
  }
  return date;
};

/** `key: "値"` の形の属性の値（無ければ undefined） */
const attributeOf = (text: string, name: string): string | undefined =>
  new RegExp(`\\b${name}:\\s*"([^"]*)"`).exec(text)?.[1];

/** 空の読み取りの状態 */
const emptyState = (): ParseState => ({
  grid: {
    title: undefined,
    branches: [],
    actors: [],
    options: { excludesWeekends: false, todayMarker: true },
    problems: [],
  },
  items: [],
  sections: [],
  links: [],
});

/** section を足し、その `order` を返却する */
const addSection = (
  state: ParseState,
  section: { label: string; parentOrder?: number; width?: number },
): number => {
  const order = state.sections.length + 1;
  state.sections.push({
    order,
    label: section.label,
    members: [],
    columns: undefined,
    parentOrder: section.parentOrder,
    width: section.width ?? 1,
    after: state.items.length,
  });
  return order;
};

/** 項目を足し、属する section の `members` にも入れる */
const addItem = (
  state: ParseState,
  item: Omit<DraftItem, "order">,
  member = true,
): DraftItem => {
  const draft = { ...item, order: state.items.length + 1 };
  state.items.push(draft);
  const section = state.sections[(item.sectionOrder ?? 0) - 1];
  if (member && section) section.members.push(draft.order);
  return draft;
};

/* ---------- ガントチャート ---------- */

/** ガントチャートのタスクのタグ */
const GANTT_TAG_NAMES = new Set([
  "done",
  "active",
  "crit",
  "milestone",
  "vert",
]);

/** 期間（`{数}{単位}`）の正規表現 */
const GANTT_DURATION_RE = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$/;

/** 期間の単位のミリ秒（`M` は 30 日、`y` は 365 日） */
const DURATION_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: DAY_MS,
  w: 7 * DAY_MS,
  M: 30 * DAY_MS,
  y: 365 * DAY_MS,
};

/** `dateFormat` の記号（dayjs の書式）から、読み取る正規表現の部品と値の入れ先 */
const DATE_TOKENS: ReadonlyArray<readonly [string, string, string]> = [
  ["YYYY", "(\\d{4})", "year"],
  ["YY", "(\\d{2})", "year2"],
  ["MM", "(\\d{2})", "month"],
  ["M", "(\\d{1,2})", "month"],
  ["DD", "(\\d{2})", "day"],
  ["D", "(\\d{1,2})", "day"],
  ["HH", "(\\d{2})", "hour"],
  ["H", "(\\d{1,2})", "hour"],
  ["hh", "(\\d{2})", "hour"],
  ["h", "(\\d{1,2})", "hour"],
  ["mm", "(\\d{2})", "minute"],
  ["m", "(\\d{1,2})", "minute"],
  ["ss", "(\\d{2})", "second"],
  ["s", "(\\d{1,2})", "second"],
  ["SSS", "(\\d{3})", "ms"],
  ["X", "(-?\\d+(?:\\.\\d+)?)", "unix"],
  ["x", "(-?\\d+)", "unixMs"],
];

/** `dateFormat` の書式から、読み取る正規表現と、組ごとの値の入れ先 */
const datePattern = (format: string): { re: RegExp; fields: string[] } => {
  const fields: string[] = [];
  let pattern = "";
  for (let at = 0; at < format.length; ) {
    const token = DATE_TOKENS.find(([name]) => format.startsWith(name, at));
    pattern += token
      ? token[1]
      : (format[at] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (token) fields.push(token[2]);
    at += token ? token[0].length : 1;
  }
  return { re: new RegExp(`^${pattern}$`), fields };
};

/** 読み取った値の年（4 桁が無ければ 2 桁の年を 2000 年代、どちらも無ければ 1970） */
const yearOf = (value: Record<string, number>): number => {
  if (value.year !== undefined) return value.year;
  return value.year2 === undefined ? 1970 : 2000 + value.year2;
};

/** 読み取った値から UTC の日時を作る（読み取れなければ undefined） */
const dateOfFields = (value: Record<string, number>): Date | undefined => {
  if (value.unix !== undefined) return new Date(value.unix * 1000);
  if (value.unixMs !== undefined) return new Date(value.unixMs);
  const year = yearOf(value);
  const v = {
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
    ms: 0,
    ...value,
  };
  const date = new Date(
    Date.UTC(year, v.month - 1, v.day, v.hour, v.minute, v.second, v.ms),
  );
  // 2 桁の年（0〜99）を 1900 年代にしない
  date.setUTCFullYear(year);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** `dateFormat` の書式で日時を読み取る（読み取れなければ undefined） */
const parseGanttDate = (text: string, format: string): Date | undefined => {
  const { re, fields } = datePattern(format);
  const match = re.exec(text.trim());
  if (!match) return undefined;
  const value: Record<string, number> = {};
  fields.forEach((field, index) => {
    value[field] = Number(match[index + 1]);
  });
  return dateOfFields(value);
};

/** 期間の文字のミリ秒（期間でなければ undefined） */
const durationMs = (text: string): number | undefined => {
  const match = GANTT_DURATION_RE.exec(text.trim());
  return match
    ? Number(match[1]) * (DURATION_MS[match[2] ?? "d"] ?? DAY_MS)
    : undefined;
};

/** ガントチャートのタスクの行の読み取り結果 */
type GanttTask = {
  label: string;
  id: string | undefined;
  tags: string[];
  /** 開始（省くと直前のタスクの終了） */
  start: string | undefined;
  end: string;
  /** 行番号と行の文字 */
  line: { text: string; index: number };
  sectionOrder: number | undefined;
};

/** タスクの `:` の後ろを、前に並べたタグと残りの値に分ける（値が 1 つだけならタグにしない） */
const splitGanttTags = (text: string): { tags: string[]; parts: string[] } => {
  const parts = text.split(",").map((part) => part.trim());
  const tags: string[] = [];
  while (parts.length > 1 && GANTT_TAG_NAMES.has(parts[0] ?? ""))
    tags.push(parts.shift() ?? "");
  return { tags, parts };
};

/** タグを除いた値が、`{ID,}{開始,}{終了}` の 1〜3 個の空でない値か */
const isGanttParts = (parts: string[]): boolean =>
  parts.length >= 1 &&
  parts.length <= 3 &&
  parts.every((part) => part !== "") &&
  !(parts.length === 1 && GANTT_TAG_NAMES.has(parts[0] ?? ""));

/** タスクの行を、名前・タグ・ID・開始・終了に分ける（読めなければ undefined） */
const readGanttTask = (
  text: string,
): Omit<GanttTask, "line" | "sectionOrder"> | undefined => {
  const match = /^(.+?)\s*:(.*)$/.exec(text);
  if (!match) return undefined;
  const { tags, parts } = splitGanttTags(match[2] ?? "");
  if (!isGanttParts(parts)) return undefined;
  return {
    label: (match[1] ?? "").trim(),
    id: parts.length === 3 ? parts[0] : undefined,
    tags,
    start: parts.length >= 2 ? parts.at(-2) : undefined,
    end: parts.at(-1) ?? "",
  };
};

/** ガントチャートの読み取りの途中の値 */
type GanttContext = {
  state: ParseState;
  section: number | undefined;
  tasks: GanttTask[];
};

/** タスクの開始と終了を、前のタスクと `after`・`until` の ID から決める（決まらないタスクは undefined） */
const ganttSpans = (
  tasks: GanttTask[],
  options: { format: string; excludesWeekends: boolean },
): Array<{ from: Date; to: Date } | undefined> => {
  const spans: Array<{ from: Date; to: Date } | undefined> = tasks.map(
    () => undefined,
  );
  const byId = new Map<string, number>();
  tasks.forEach((task, index) => {
    if (task.id !== undefined) byId.set(task.id, index);
  });
  const refs = (
    text: string,
    word: string,
  ): Array<{ from: Date; to: Date } | undefined> =>
    text
      .slice(word.length)
      .trim()
      .split(/\s+/)
      .map((id) => spans[byId.get(id) ?? -1]);
  const startOf = (task: GanttTask, index: number): Date | undefined => {
    if (task.start === undefined) return spans[index - 1]?.to;
    if (task.start.startsWith("after ")) {
      const found = refs(task.start, "after ");
      if (found.some((span) => span === undefined)) return undefined;
      return new Date(
        Math.max(...found.map((span) => span?.to.getTime() ?? 0)),
      );
    }
    return parseGanttDate(task.start, options.format);
  };
  const endOf = (task: GanttTask, from: Date): Date | undefined => {
    if (task.end.startsWith("until ")) {
      const found = refs(task.end, "until ");
      if (found.some((span) => span === undefined)) return undefined;
      return new Date(
        Math.min(...found.map((span) => span?.from.getTime() ?? 0)),
      );
    }
    const ms = durationMs(task.end);
    if (ms !== undefined)
      return ms % DAY_MS === 0 && ms > 0
        ? addDays(from, ms / DAY_MS, options.excludesWeekends)
        : new Date(from.getTime() + ms);
    const date = parseGanttDate(task.end, options.format);
    // 日付だけの書式の終了日はその日を含める
    return date === undefined
      ? undefined
      : /[Hhms]/.test(options.format)
        ? date
        : new Date(date.getTime() + DAY_MS);
  };
  // 後ろのタスクを指す `after`・`until` のため、決まるまで繰り返す
  for (let pass = 0; pass <= tasks.length; pass++) {
    let changed = false;
    tasks.forEach((task, index) => {
      if (spans[index] !== undefined) return;
      const from = startOf(task, index);
      const to = from === undefined ? undefined : endOf(task, from);
      if (from !== undefined && to !== undefined) {
        spans[index] = { from, to };
        changed = true;
      }
    });
    if (!changed) break;
  }
  return spans;
};

/** 開始と終了の日付の文字（同じ日に収まるタスクは翌日までの 1 日にする） */
const ganttDays = (span: {
  from: Date;
  to: Date;
}): { start: string; end: string } => {
  const start = dateText(span.from);
  const end = dateText(span.to);
  return {
    start,
    end: end <= start ? dateText(new Date(span.from.getTime() + DAY_MS)) : end,
  };
};

/** 集めたタスクを項目にする（開始と終了が決まらないタスクは読めない行の項目にする） */
const addGanttTasks = (context: GanttContext): void => {
  const { state, tasks } = context;
  const spans = ganttSpans(tasks, {
    format: state.grid.options.dateFormat ?? "YYYY-MM-DD",
    excludesWeekends: state.grid.options.excludesWeekends,
  });
  const orders = new Map<string, number>();
  tasks.forEach((task, index) => {
    const span = spans[index];
    if (span === undefined) {
      state.grid.problems.push(
        unreadable(
          task.line.index,
          task.line.text,
          "タスクは `{名前} :{タグ,}{ID,}{開始,}{終了か期間}` で記載し、開始は `dateFormat` の日時か `after {ID}`、終了は日時か期間（`3d`・`20h` など）か `until {ID}` にしてください。",
        ),
      );
      return;
    }
    const item = addItem(state, {
      id: task.id,
      label: task.label,
      shape: task.tags.includes("milestone") ? "milestone" : "bar",
      sectionOrder: task.sectionOrder,
      parent: undefined,
      detail: { kind: "gantt", ...ganttDays(span), tags: task.tags },
    });
    if (task.id !== undefined) orders.set(task.id, item.order);
    if (task.start?.startsWith("after ")) {
      for (const id of task.start.slice(6).trim().split(/\s+/)) {
        const target = orders.get(id);
        if (target !== undefined)
          state.links.push({
            from: target,
            to: item.order,
            kind: "after",
            label: undefined,
          });
      }
    }
  });
};

/** ガントチャートの 1 行 */
const readGanttLine = (
  context: GanttContext,
  line: { text: string; index: number },
): void => {
  const text = line.text.replace(/\s+%%.*$/, "").replace(/\s+/g, " ");
  const options = context.state.grid.options;
  if (text.startsWith("dateFormat "))
    options.dateFormat = text.slice(11).trim();
  else if (text.startsWith("axisFormat "))
    options.axisFormat = text.slice(11).trim();
  else if (text === "excludes weekends") options.excludesWeekends = true;
  else if (text === "todayMarker off") options.todayMarker = false;
  else if (
    /^(excludes|includes|todayMarker|tickInterval|weekday|weekend|topAxis|inclusiveEndDates|displayMode|click)\b/.test(
      text,
    )
  )
    return;
  else if (text.startsWith("section "))
    context.section = addSection(context.state, {
      label: text.slice(8).trim(),
    });
  else {
    const task = readGanttTask(text);
    if (task === undefined)
      context.state.grid.problems.push(
        unreadable(
          line.index,
          line.text,
          "タスクは `{名前} :{タグ,}{ID,}{開始,}{終了か期間}` で記載してください。",
        ),
      );
    else
      context.tasks.push({
        ...task,
        line: { text: line.text, index: line.index },
        sectionOrder: context.section,
      });
  }
};

/* ---------- タイムライン ---------- */

/** タイムラインの読み取りの途中の値 */
type TimelineContext = {
  state: ParseState;
  section: number | undefined;
  /** 直前の期間 */
  period: DraftItem | undefined;
};

/** 出来事を期間の下に足す */
const addEvents = (context: TimelineContext, labels: string[]): void => {
  const period = context.period;
  if (!period) return;
  for (const label of labels.filter((text) => text !== "")) {
    addItem(
      context.state,
      {
        id: undefined,
        label,
        shape: "event",
        sectionOrder: context.section,
        parent: period.order,
        detail: { kind: "timeline" },
      },
      false,
    );
  }
};

/** タイムラインの 1 行 */
const readTimelineLine = (
  context: TimelineContext,
  line: { text: string; index: number },
): void => {
  const { text } = line;
  if (text.startsWith("section ")) {
    context.section = addSection(context.state, {
      label: text.slice(8).trim(),
    });
    context.period = undefined;
    return;
  }
  const parts = text.split(/\s*:(?:\s+|$)/).map((part) => part.trim());
  if (text.startsWith(":")) {
    if (context.period === undefined)
      context.state.grid.problems.push(
        unreadable(
          line.index,
          text,
          "出来事の前に期間の行を記載してください。",
        ),
      );
    addEvents(
      context,
      text
        .slice(1)
        .split(/\s*:(?:\s+|$)/)
        .map((part) => part.trim()),
    );
    return;
  }
  context.period = addItem(context.state, {
    id: undefined,
    label: parts[0] ?? text,
    shape: "period",
    sectionOrder: context.section,
    parent: undefined,
    detail: { kind: "timeline" },
  });
  addEvents(context, parts.slice(1));
};

/* ---------- Git グラフ ---------- */

/** Git グラフの読み取りの途中の値 */
type GitContext = {
  state: ParseState;
  current: string;
  /** 最初のブランチの名前を指定されていない（最初の知らない `checkout` の名前を最初のブランチの名前にする） */
  inferMain: boolean;
  /** ブランチ名から先頭の commit の `order` */
  heads: Map<string, number | undefined>;
  /** commit の `id:` から `order` */
  ids: Map<string, number>;
};

/** commit の形状 */
const commitShape = (
  command: string,
  type: string | undefined,
): AxisGridShape => {
  if (command === "merge") return "merge";
  if (command === "cherry-pick") return "cherryPick";
  if (type === "HIGHLIGHT") return "highlight";
  if (type === "REVERSE") return "reverse";
  return "commit";
};

/** 今のブランチの先頭に commit を足し、親と取り込みのつながりを入れる */
const addCommit = (
  context: GitContext,
  commit: { command: string; text: string; from?: number; source?: string },
): void => {
  const { state, current, text } = { ...context, text: commit.text };
  const id =
    commit.command === "cherry-pick"
      ? attributeOf(text, "commit")
      : attributeOf(text, "id");
  const type = /\btype:\s*(\w+)/.exec(text)?.[1];
  const item = addItem(state, {
    id,
    label: attributeOf(text, "msg") ?? "",
    shape: commitShape(commit.command, type),
    sectionOrder: undefined,
    parent: undefined,
    detail: {
      kind: "gitGraph",
      branch: current,
      tag: attributeOf(text, "tag"),
      source: commit.source,
    },
  });
  const parent = context.heads.get(current);
  if (parent !== undefined)
    state.links.push({
      from: parent,
      to: item.order,
      kind: "parent",
      label: undefined,
    });
  if (commit.from !== undefined)
    state.links.push({
      from: commit.from,
      to: item.order,
      kind: commit.command === "merge" ? "merge" : "cherryPick",
      label: undefined,
    });
  context.heads.set(current, item.order);
  if (id !== undefined) context.ids.set(id, item.order);
};

/** ブランチを作る・移る行（読んだら true） */
const readGitBranchLine = (
  context: GitContext,
  words: { command: string; name: string },
): boolean => {
  const { command, name } = words;
  if (command === "branch" && name !== "") {
    context.state.grid.branches.push(name);
    context.heads.set(name, context.heads.get(context.current));
    context.current = name;
    return true;
  }
  if (command !== "checkout" && command !== "switch") return false;
  if (!context.heads.has(name) && context.inferMain) renameMain(context, name);
  if (!context.heads.has(name)) return false;
  context.current = name;
  return true;
};

/** 最初のブランチの名前を、front matter などで指定した名前に付け替える */
const renameMain = (context: GitContext, name: string): void => {
  context.inferMain = false;
  const branches = context.state.grid.branches;
  const old = branches[0];
  if (old === undefined || name === "") return;
  branches[0] = name;
  context.heads.set(name, context.heads.get(old));
  context.heads.delete(old);
  if (context.current === old) context.current = name;
  for (const item of context.state.items)
    if (item.detail.kind === "gitGraph" && item.detail.branch === old)
      item.detail.branch = name;
};

/** commit・merge・cherry-pick の行（読んだら true） */
const readGitCommitLine = (
  context: GitContext,
  words: { command: string; name: string; text: string },
): boolean => {
  const { command, name, text } = words;
  if (command === "commit") {
    addCommit(context, { command, text });
    return true;
  }
  if (command === "merge" && context.heads.has(name)) {
    addCommit(context, { command, text, from: context.heads.get(name) });
    return true;
  }
  const source = attributeOf(text, "id") ?? "";
  if (command !== "cherry-pick" || !context.ids.has(source)) return false;
  addCommit(context, { command, text, from: context.ids.get(source), source });
  return true;
};

/** Git グラフの 1 行 */
const readGitLine = (
  context: GitContext,
  line: { text: string; index: number },
): void => {
  const { text } = line;
  const [command = "", name = ""] = text.split(/\s+/);
  if (
    readGitBranchLine(context, { command, name }) ||
    readGitCommitLine(context, { command, name, text })
  )
    return;
  context.state.grid.problems.push(
    unreadable(
      line.index,
      text,
      '`commit`・`branch`・`checkout`・`merge {ブランチ}`・`cherry-pick id: "{ID}"` の行にし、ブランチと ID は前の行で作ったものにしてください。',
    ),
  );
};

/* ---------- ジャーニー ---------- */

/** ジャーニーの 1 行 */
const readJourneyLine = (
  context: { state: ParseState; section: number | undefined },
  line: { text: string; index: number },
): void => {
  const { text } = line;
  const { state } = context;
  if (text.startsWith("section ")) {
    context.section = addSection(state, { label: text.slice(8).trim() });
    return;
  }
  const match = /^(.+?)\s*:\s*([1-5])\s*(?::\s*(.*))?$/.exec(text);
  if (!match) {
    state.grid.problems.push(
      unreadable(
        line.index,
        text,
        "タスクは `{タスク名}: {点数 1〜5}: {人}, {人}` で記載してください。",
      ),
    );
    return;
  }
  const actors = (match[3] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
  for (const name of actors)
    if (!state.grid.actors.includes(name)) state.grid.actors.push(name);
  addItem(state, {
    id: undefined,
    label: (match[1] ?? "").trim(),
    shape: "face",
    sectionOrder: context.section,
    parent: undefined,
    detail: { kind: "journey", score: Number(match[2]), actors },
  });
};

/* ---------- ブロック図 ---------- */

/** ブロックの形状の開きと閉じ（長い開きから順に照らす） */
const BLOCK_SHAPES: ReadonlyArray<readonly [AxisGridShape, string, string]> = [
  ["double-circle", "(((", ")))"],
  ["stadium", "([", "])"],
  ["subroutine", "[[", "]]"],
  ["cylinder", "[(", ")]"],
  ["circle", "((", "))"],
  ["hexagon", "{{", "}}"],
  ["lean-right", "[/", "/]"],
  ["lean-left", "[\\", "\\]"],
  ["trapezoid", "[/", "\\]"],
  ["trapezoid-alt", "[\\", "/]"],
  ["flag", ">", "]"],
  ["rhombus", "{", "}"],
  ["square", "[", "]"],
  ["rounded", "(", ")"],
];

/** ブロックの矢印の向きから形状 */
const ARROW_SHAPES: Record<string, AxisGridShape> = {
  right: "arrow-right",
  left: "arrow-left",
  up: "arrow-up",
  down: "arrow-down",
  x: "arrow-x",
  y: "arrow-y",
};

/** ブロックの ID */
const BLOCK_ID_RE = /^[\w\u0080-\uffff]+(?:-(?!-)[\w\u0080-\uffff]+)*/u;

/** ブロックの間の線（`-->`・`---`・`-- "{ラベル}" -->`） */
const BLOCK_ARROW_RE = /^(?:--\s*"([^"]*)"\s*-->|-->|---)/;

/** 1 つのブロックの記載の読み取り結果 */
type BlockToken = {
  id: string;
  label: string;
  shape: AxisGridShape;
  width: number;
  consumed: number;
};

/** 形状の中の文字（引用符で囲んだ文字は閉じの記号を含んでよい） */
const shapeLabel = (
  body: string,
  close: string,
): { label: string; length: number } | undefined => {
  const quoted = /^"([^"]*)"/.exec(body);
  if (quoted) {
    return body.startsWith(close, quoted[0].length)
      ? { label: quoted[1] ?? "", length: quoted[0].length + close.length }
      : undefined;
  }
  const end = body.indexOf(close);
  return end < 0
    ? undefined
    : { label: body.slice(0, end).trim(), length: end + close.length };
};

/** ID の後ろの形状（矢印のブロックか、形状の開きと閉じ）。形状が無ければ undefined */
const blockShapeAt = (
  rest: string,
): { label: string; shape: AxisGridShape; length: number } | undefined => {
  const arrow = /^<\["([^"]*)"\]>\(([\w\s,]+)\)/.exec(rest);
  if (arrow)
    return {
      label: (arrow[1] ?? "").replaceAll("&nbsp;", " "),
      shape:
        ARROW_SHAPES[(arrow[2] ?? "").split(",")[0]?.trim() ?? ""] ??
        "arrow-right",
      length: arrow[0].length,
    };
  for (const [name, open, close] of BLOCK_SHAPES) {
    if (!rest.startsWith(open)) continue;
    const found = shapeLabel(rest.slice(open.length), close);
    if (found)
      return {
        label: found.label,
        shape: name,
        length: open.length + found.length,
      };
  }
  return undefined;
};

/** 行の先頭の 1 つのブロック（`{ID}{形状}:{幅}`・`space:{幅}`・矢印のブロック）を読む */
const readBlockAt = (text: string): BlockToken | undefined => {
  const id = BLOCK_ID_RE.exec(text)?.[0];
  if (id === undefined) return undefined;
  const space = id === "space";
  const shaped = blockShapeAt(text.slice(id.length)) ?? {
    label: id,
    shape: space ? "space" : "square",
    length: 0,
  };
  const consumed = id.length + shaped.length;
  const width = /^:(\d+)/.exec(text.slice(consumed)) ?? ["", "1"];
  return {
    id,
    label: space ? "" : shaped.label,
    shape: shaped.shape,
    width: Number(width[1]),
    consumed: consumed + width[0].length,
  };
};

/** ブロック図の読み取りの途中の値 */
type BlockContext = {
  state: ParseState;
  /** 開いている入れ子のブロックの `order` の並び */
  stack: number[];
  /** ID から項目（同じ ID の 2 つ目の記載は線の端だけにする） */
  seen: Set<string>;
};

/** 読んだブロックを項目にする（既にある ID は足さない） */
const addBlock = (context: BlockContext, token: BlockToken): void => {
  if (token.shape !== "space") {
    if (context.seen.has(token.id)) return;
    context.seen.add(token.id);
  }
  addItem(context.state, {
    id: token.shape === "space" ? undefined : token.id,
    label: token.label,
    shape: token.shape,
    sectionOrder: context.stack.at(-1),
    parent: undefined,
    detail: { kind: "block", width: token.width },
  });
};

/** 1 行のブロックと線を左から読む（読めない記載があれば undefined） */
const scanBlockLine = (
  text: string,
): { tokens: BlockToken[]; links: DraftLink[] } | undefined => {
  const tokens: BlockToken[] = [];
  const links: DraftLink[] = [];
  let rest = text.trim();
  let pending: { label: string | undefined } | undefined;
  while (rest !== "") {
    const token = readBlockAt(rest);
    if (!token) return undefined;
    const from = tokens.at(-1);
    if (pending && from)
      links.push({
        from: from.id,
        to: token.id,
        kind: "arrow",
        label: pending.label,
      });
    tokens.push(token);
    rest = rest.slice(token.consumed).trimStart();
    const arrow = BLOCK_ARROW_RE.exec(rest);
    pending = arrow ? { label: arrow[1] } : undefined;
    if (arrow) rest = rest.slice(arrow[0].length).trimStart();
  }
  return pending ? undefined : { tokens, links };
};

/** 線の両端だけに出た、既にあるブロック・入れ子のブロックを指す ID か */
const isLinkEndOnly = (
  context: BlockContext,
  token: BlockToken,
  sections: Set<string>,
): boolean =>
  token.label === token.id &&
  token.shape === "square" &&
  (context.seen.has(token.id) || sections.has(token.id));

/** 1 行のブロックと線を項目と線にする（読めない記載があれば false） */
const readBlockTokens = (context: BlockContext, text: string): boolean => {
  const scanned = scanBlockLine(text);
  if (!scanned) return false;
  const sections = new Set(context.state.sections.map((one) => one.label));
  const linked = scanned.links.length > 0;
  for (const token of scanned.tokens)
    if (!(linked && isLinkEndOnly(context, token, sections)))
      addBlock(context, token);
  context.state.links.push(...scanned.links);
  return true;
};

/** 色を指定する行（`readMermaidStyles` が読む） */
const BLOCK_STYLE_RE = /^(classDef|class|style)\s/;

/** `columns`・入れ子の開きと閉じ・線の行（読んだら true） */
const readBlockStructureLine = (
  context: BlockContext,
  text: string,
): boolean => {
  const { state } = context;
  const parent = context.stack.at(-1);
  const columns = /^columns\s+(\d+)$/.exec(text);
  if (columns) {
    const section = state.sections[(parent ?? 0) - 1];
    if (section) section.columns = Number(columns[1]);
    else state.grid.options.columns = Number(columns[1]);
    return true;
  }
  const nested = /^block:([\w-]+)(?::(\d+))?$/.exec(text);
  if (nested) {
    context.stack.push(
      addSection(state, {
        label: nested[1] ?? "",
        parentOrder: parent,
        width: Number(nested[2] ?? "1"),
      }),
    );
    return true;
  }
  if (text === "end" && parent !== undefined) {
    context.stack.pop();
    return true;
  }
  return false;
};

/** ブロック図の 1 行 */
const readBlockLine = (
  context: BlockContext,
  line: { text: string; index: number },
): void => {
  const text = line.text.replace(/;\s*$/, "");
  if (BLOCK_STYLE_RE.test(text)) return;
  if (readBlockStructureLine(context, text)) return;
  if (!readBlockTokens(context, text)) {
    context.state.grid.problems.push(
      unreadable(
        line.index,
        line.text,
        '`columns {数}`・`{ID}["名前"]` などのブロック・`space`・`block:{ID}` と `end`・`{ID} --> {ID}` の行にしてください。',
      ),
    );
  }
};

/* ---------- 共通 ---------- */

/** 1 行目の後ろの行を、空の行と `%%` の行を飛ばして種類ごとの読み取りに渡す */
const eachLine = (
  source: string,
  read: (line: { text: string; index: number }) => void,
  state: ParseState,
): string => {
  const lines = source.split(/\r?\n/);
  const firstIndex = lines.findIndex(
    (raw) => raw.trim() !== "" && !raw.trim().startsWith("%%"),
  );
  const firstWord = (lines[firstIndex] ?? "").trim().split(/\s+/, 1)[0] ?? "";
  lines.forEach((raw, index) => {
    const text = raw.trim();
    if (index <= firstIndex || text === "" || text.startsWith("%%")) return;
    if (text.startsWith("title ")) state.grid.title = text.slice(6).trim();
    else if (/^(accTitle|accDescr)\b/.test(text)) return;
    else read({ text, index });
  });
  return firstWord;
};

/** 種類ごとの読み取りを、読み取りの状態に書き込む */
const readKind = (
  input: {
    kind: AxisGridKind;
    source: string;
    mainBranchName: string | undefined;
  },
  state: ParseState,
): string => {
  const { kind, source, mainBranchName } = input;
  switch (kind) {
    case "gantt": {
      const context: GanttContext = { state, section: undefined, tasks: [] };
      const firstWord = eachLine(
        source,
        (line) => readGanttLine(context, line),
        state,
      );
      addGanttTasks(context);
      return firstWord;
    }
    case "timeline": {
      const context = { state, section: undefined, period: undefined };
      return eachLine(source, (line) => readTimelineLine(context, line), state);
    }
    case "gitGraph": {
      const given = mainBranchName ?? mermaidMainBranchOf(source);
      const main = given ?? "main";
      state.grid.branches.push(main);
      const context: GitContext = {
        state,
        current: main,
        inferMain: given === undefined,
        heads: new Map([[main, undefined]]),
        ids: new Map(),
      };
      return eachLine(source, (line) => readGitLine(context, line), state);
    }
    case "journey": {
      const context = { state, section: undefined };
      return eachLine(source, (line) => readJourneyLine(context, line), state);
    }
    case "block":
      return readBlock(source, state);
    default:
      return assertNever(kind);
  }
};

/** 網羅を確かめる */
const assertNever = (value: never): never => {
  throw new Error(`知らない種類: ${String(value)}`);
};

/** ブロック図を読み、閉じの無い入れ子を最後の行で閉じる */
const readBlock = (source: string, state: ParseState): string => {
  const context: BlockContext = { state, stack: [], seen: new Set() };
  const firstWord = eachLine(
    source,
    (line) => readBlockLine(context, line),
    state,
  );
  for (const order of context.stack) {
    const section = state.sections[order - 1];
    state.grid.problems.push({
      kind: "map_invalid",
      message: `\`block:${section?.label ?? ""}\` に閉じの \`end\` がありません。最後の行で閉じたものとして描いています。入れ子の最後に \`end\` を記載してください。`,
    });
  }
  return firstWord;
};

/** 2 つ以上あるものを集める */
const duplicatesOf = (values: string[]): Set<string> => {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) twice.add(value);
    seen.add(value);
  }
  return twice;
};

/** 項目のキー（ID、無ければ表示する文字、どちらも空なら `c{order}`） */
const keyOf = (item: DraftItem): string =>
  item.id ?? (item.label === "" ? `c${item.order}` : item.label);

/** 読み取りの途中の値から、`key`・`stateKey` を決めた読み取り結果を作る */
const finish = (
  kind: AxisGridKind,
  state: ParseState,
  firstWord: string,
): Omit<AxisGrid, "styles"> => {
  const unnamed = state.items.filter(
    (item) => item.id === undefined && item.label !== "",
  );
  const sameLabels = duplicatesOf(unnamed.map((item) => item.label));
  const sameSections = duplicatesOf(
    state.sections.map((section) => section.label),
  );
  const sectionKey = (order: number | undefined): string | undefined => {
    const section = state.sections[(order ?? 0) - 1];
    if (!section) return undefined;
    return sameSections.has(section.label)
      ? `s${section.order}`
      : section.label;
  };
  const items: AxisGridItem[] = state.items.map(({ sectionOrder, ...item }) => {
    const key = keyOf({ ...item, sectionOrder });
    const shared = item.id === undefined && sameLabels.has(item.label);
    return {
      ...item,
      section: sectionKey(sectionOrder),
      key,
      stateKey: shared ? `n${item.order}` : key,
    };
  });
  const sections: AxisGridSection[] = state.sections.map(
    ({ parentOrder, ...section }) => ({
      ...section,
      stateKey: sectionKey(section.order) ?? section.label,
      parent: sectionKey(parentOrder),
    }),
  );
  const stateKeyOf = (end: number | string): string =>
    typeof end === "number"
      ? (items[end - 1]?.stateKey ?? "")
      : (items.find((item) => item.id === end)?.stateKey ??
        sections.find((section) => section.label === end)?.stateKey ??
        end);
  return {
    ...state.grid,
    kind,
    firstWord,
    items,
    sections,
    links: state.links.map((link) => ({
      ...link,
      from: stateKeyOf(link.from),
      to: stateKeyOf(link.to),
    })),
    ambiguous: new Set([...sameLabels, ...sameSections]),
  };
};

/** 5 種類の Mermaid を、種類ごとの読み取りで共通の `AxisGrid` に読む */
export const parseAxisGrid = (options: {
  kind: AxisGridKind;
  source: string;
  /** Git グラフの最初のブランチの名前（省くと `source` の front matter と `%%{init}` から読み取り、無ければ `main`） */
  mainBranchName?: string | undefined;
}): AxisGrid => {
  const state = emptyState();
  const firstWord = readKind(
    {
      kind: options.kind,
      source: options.source,
      mainBranchName: options.mainBranchName,
    },
    state,
  );
  const styles = readMermaidStyles({
    lines: options.kind === "block" ? options.source.split(/\r?\n/) : [],
    classTarget: "class",
  });
  return { ...finish(options.kind, state, firstWord), styles };
};

/** `axisGridItemOf` の戻り値 */
export type AxisGridFound =
  | { kind: "item"; item: AxisGridItem }
  | { kind: "section"; section: AxisGridSection }
  | { kind: "branch"; branch: string }
  | { kind: "ambiguous" }
  | { kind: "missing" };

/** 補足とマーカーの引数のキーが指す項目か section を探す */
export const axisGridItemOf = (options: {
  grid: AxisGrid;
  key: string;
}): AxisGridFound => {
  const { grid, key } = options;
  const byId = grid.items.find((item) => item.id === key);
  if (byId) return { kind: "item", item: byId };
  if (grid.ambiguous.has(key)) return { kind: "ambiguous" };
  const byLabel = grid.items.find(
    (item) => item.id === undefined && item.label === key && item.label !== "",
  );
  if (byLabel) return { kind: "item", item: byLabel };
  const byOrder =
    grid.kind === "gitGraph"
      ? grid.items.find((item) => `c${item.order}` === key)
      : undefined;
  if (byOrder) return { kind: "item", item: byOrder };
  const section = grid.sections.find((entry) => entry.label === key);
  if (section) return { kind: "section", section };
  if (grid.branches.includes(key)) return { kind: "branch", branch: key };
  return { kind: "missing" };
};
