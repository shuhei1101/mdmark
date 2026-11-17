import type { MapProblem } from "./spec.ts";

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
    "items" | "sections" | "links" | "ambiguous" | "kind" | "firstWord"
  >;
  items: DraftItem[];
  sections: DraftSection[];
  links: DraftLink[];
};

/** 1 日のミリ秒 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** 日付（`YYYY-MM-DD`）の正規表現 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 期間（`{数}d`）の正規表現 */
const DURATION_RE = /^(\d+)d$/;

/** ガントチャートのタスクのタグ */
const GANTT_TAGS = new Set(["done", "active", "crit", "milestone"]);

/** 読めない行の項目 */
const unreadable = (line: number, text: string, fix: string): MapProblem => ({
  kind: "map_invalid",
  line,
  message: `${line + 1} 行目 \`${text}\` を読めないため、この行を読み飛ばしました。${fix}`,
});

/** 日付の文字を UTC の日付にする（読めなければ undefined） */
const toDate = (text: string): Date | undefined => {
  if (!DATE_RE.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

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

/** ガントチャートのタスクの行の読み取り結果 */
type GanttTask = {
  label: string;
  id: string | undefined;
  tags: string[];
  start: string;
  end: string;
};

/** タスクの行を、名前・タグ・ID・開始・終了に分ける（読めなければ undefined） */
const readGanttTask = (text: string): GanttTask | undefined => {
  const match = /^(.+?)\s*:(.+)$/.exec(text);
  if (!match) return undefined;
  const parts = (match[2] ?? "").split(",").map((part) => part.trim());
  const tags = parts.filter((part) => GANTT_TAGS.has(part));
  const rest = parts.filter((part) => !GANTT_TAGS.has(part));
  if (rest.length < 2 || rest.length > 3) return undefined;
  return {
    label: (match[1] ?? "").trim(),
    id: rest.length === 3 ? rest[0] : undefined,
    tags,
    start: rest.at(-2) ?? "",
    end: rest.at(-1) ?? "",
  };
};

/** タスクの開始日（`after {ID}` はそのタスクの終了日。読めなければ undefined） */
const ganttStart = (
  start: string,
  ends: ReadonlyMap<string, Date>,
): Date | undefined =>
  start.startsWith("after ")
    ? ends.get(start.slice("after ".length).trim())
    : toDate(start);

/** タスクの終了日（この日を含まない。読めなければ undefined） */
const ganttEnd = (
  from: Date,
  end: string,
  excludesWeekends: boolean,
): Date | undefined => {
  const duration = DURATION_RE.exec(end);
  if (duration) return addDays(from, Number(duration[1]), excludesWeekends);
  const date = toDate(end);
  return date === undefined ? undefined : new Date(date.getTime() + DAY_MS);
};

/** ガントチャートの読み取りの途中の値 */
type GanttContext = {
  state: ParseState;
  section: number | undefined;
  /** タスクの ID から終了日と `order` */
  ends: Map<string, Date>;
  orders: Map<string, number>;
};

/** タスクの開始日と終了日（読めなければ undefined） */
const ganttSpan = (
  context: GanttContext,
  task: GanttTask,
): { from: Date; to: Date } | undefined => {
  const from = ganttStart(task.start, context.ends);
  if (from === undefined) return undefined;
  const to = ganttEnd(
    from,
    task.end,
    context.state.grid.options.excludesWeekends,
  );
  return to === undefined ? undefined : { from, to };
};

/** `after {ID}` のつながりを入れる */
const addAfterLink = (
  context: GanttContext,
  link: { start: string; order: number },
): void => {
  if (!link.start.startsWith("after ")) return;
  const target = context.orders.get(link.start.slice("after ".length).trim());
  if (target !== undefined)
    context.state.links.push({
      from: target,
      to: link.order,
      kind: "after",
      label: undefined,
    });
};

/** タスクの行を項目にする（読めなければ項目を足す） */
const readGanttTaskLine = (
  context: GanttContext,
  line: { text: string; index: number },
): void => {
  const { state } = context;
  const task = readGanttTask(line.text);
  const span = task === undefined ? undefined : ganttSpan(context, task);
  if (task === undefined || span === undefined) {
    state.grid.problems.push(
      unreadable(
        line.index,
        line.text,
        "タスクは `{名前} :{タグ,}{ID,}{開始},{終了か期間}` で記載し、開始は `YYYY-MM-DD` か `after {ID}`、終了は `YYYY-MM-DD` か `{数}d` にしてください。",
      ),
    );
    return;
  }
  const item = addItem(state, {
    id: task.id,
    label: task.label,
    shape: task.tags.includes("milestone") ? "milestone" : "bar",
    sectionOrder: context.section,
    parent: undefined,
    detail: {
      kind: "gantt",
      start: dateText(span.from),
      end: dateText(span.to),
      tags: task.tags,
    },
  });
  if (task.id !== undefined) {
    context.ends.set(task.id, span.to);
    context.orders.set(task.id, item.order);
  }
  addAfterLink(context, { start: task.start, order: item.order });
};

/** ガントチャートの 1 行 */
const readGanttLine = (
  context: GanttContext,
  line: { text: string; index: number },
): void => {
  const { text } = line;
  const options = context.state.grid.options;
  if (text.startsWith("dateFormat "))
    options.dateFormat = text.slice(11).trim();
  else if (text.startsWith("axisFormat "))
    options.axisFormat = text.slice(11).trim();
  else if (text === "excludes weekends") options.excludesWeekends = true;
  else if (text === "todayMarker off") options.todayMarker = false;
  else if (/^(excludes|includes|todayMarker|tickInterval|weekday)\b/.test(text))
    return;
  else if (text.startsWith("section "))
    context.section = addSection(context.state, {
      label: text.slice(8).trim(),
    });
  else readGanttTaskLine(context, line);
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
  if (
    (command === "checkout" || command === "switch") &&
    context.heads.has(name)
  ) {
    context.current = name;
    return true;
  }
  return false;
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

/** ブロックの形状の記号（外側の記号から順に照らす） */
const BLOCK_SHAPES: ReadonlyArray<readonly [AxisGridShape, RegExp]> = [
  ["cylinder", /^([\w-]+)\[\("(.*)"\)\]$/],
  ["circle", /^([\w-]+)\(\("(.*)"\)\)$/],
  ["square", /^([\w-]+)\["(.*)"\]$/],
  ["rounded", /^([\w-]+)\("(.*)"\)$/],
  ["square", /^([\w-]+)$/],
];

/** 1 行の中のブロックの記載 */
const BLOCK_TOKEN_RE =
  /[\w-]+(?:\[\(".*?"\)\]|\(\(".*?"\)\)|\[".*?"\]|\(".*?"\))?(?::\d+)?/g;

/** ブロックの線の行 */
const BLOCK_LINK_RE = /^([\w-]+)\s*(?:--\s*"([^"]*)"\s*)?-->\s*([\w-]+)$/;

/** ブロック図の読み取りの途中の値 */
type BlockContext = {
  state: ParseState;
  /** 開いている入れ子のブロックの `order` の並び */
  stack: number[];
};

/** 1 つのブロックの記載を項目にする（読めなければ false） */
const readBlockToken = (context: BlockContext, token: string): boolean => {
  const [body = "", widthText] = token.split(/:(?=\d+$)/);
  const width = Number(widthText ?? "1");
  const section = context.stack.at(-1);
  if (body === "space") {
    addItem(context.state, {
      id: undefined,
      label: "",
      shape: "space",
      sectionOrder: section,
      parent: undefined,
      detail: { kind: "block", width },
    });
    return true;
  }
  for (const [shape, pattern] of BLOCK_SHAPES) {
    const match = pattern.exec(body);
    if (!match) continue;
    addItem(context.state, {
      id: match[1],
      label: match[2] ?? match[1] ?? "",
      shape,
      sectionOrder: section,
      parent: undefined,
      detail: { kind: "block", width },
    });
    return true;
  }
  return false;
};

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
  const { text } = line;
  const link = BLOCK_LINK_RE.exec(text);
  if (readBlockStructureLine(context, text)) return;
  if (link) {
    context.state.links.push({
      from: link[1] ?? "",
      to: link[3] ?? "",
      kind: "arrow",
      label: link[2],
    });
  } else if (!readBlockTokens(context, text)) {
    context.state.grid.problems.push(
      unreadable(
        line.index,
        text,
        '`columns {数}`・`{ID}["名前"]` などのブロック・`space`・`block:{ID}` と `end`・`{ID} --> {ID}` の行にしてください。',
      ),
    );
  }
};

/** 1 行の全てのブロックの記載を項目にする（読めないものがあれば false） */
const readBlockTokens = (context: BlockContext, text: string): boolean => {
  const tokens = text.match(BLOCK_TOKEN_RE) ?? [];
  if (tokens.join(" ").replace(/\s+/g, "") !== text.replace(/\s+/g, ""))
    return false;
  return tokens.every((token) => readBlockToken(context, token));
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
  kind: AxisGridKind,
  source: string,
  state: ParseState,
): string => {
  switch (kind) {
    case "gantt": {
      const context = {
        state,
        section: undefined,
        ends: new Map(),
        orders: new Map(),
      };
      return eachLine(source, (line) => readGanttLine(context, line), state);
    }
    case "timeline": {
      const context = { state, section: undefined, period: undefined };
      return eachLine(source, (line) => readTimelineLine(context, line), state);
    }
    case "gitGraph": {
      state.grid.branches.push("main");
      const context = {
        state,
        current: "main",
        heads: new Map([["main", undefined]]),
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
  const context: BlockContext = { state, stack: [] };
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
): AxisGrid => {
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
}): AxisGrid => {
  const state = emptyState();
  const firstWord = readKind(options.kind, options.source, state);
  return finish(options.kind, state, firstWord);
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
