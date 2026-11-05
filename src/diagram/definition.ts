import { COLOR_NAMES, type ColorName, isColorName } from "../parts/colors.ts";
import { isAllowedUrl } from "../render/sanitize.ts";
import { layoutFlowchart } from "./layout.ts";

/** ノードの種類（`start`・`question`・`action`・`result` は判定フローチャートの開始・質問・アクション・結果） */
export type MdmarkDiagramKind =
  | "llm"
  | "dm"
  | "script"
  | "mcp"
  | "data"
  | "external"
  | "start"
  | "question"
  | "action"
  | "result";

/** 線の種類 */
export type MdmarkDiagramLine = "flow" | "read" | "write" | "reply" | "loop";

/** ノードの入力・処理・出力 */
export type MdmarkDiagramIo = {
  /** 入力 */
  in: string;
  /** 処理 */
  do: string;
  /** 出力 */
  out: string;
};

/** フロー図のノード */
export type MdmarkDiagramNode = {
  /** 線が端に指す id */
  id: string;
  /** ノードの種類 */
  kind: MdmarkDiagramKind;
  /** 左上の x（px） */
  x: number;
  /** 左上の y（px） */
  y: number;
  /** 幅（px） */
  w: number;
  /** 高さ（px） */
  h: number;
  /** 名前 */
  name: string;
  /** 種類の行に出す名前。省くと種類の既定の名前 */
  tag?: string;
  /** 補足 */
  sub?: string;
  /** 入力・処理・出力。持つノードに印を付ける */
  io?: MdmarkDiagramIo;
  /** ノードの右上の印に出す文。`io` と一緒に持つと、入力・処理・出力の後に出す */
  hint?: string;
  /** リンク先。`http`・`https`・`mailto` の URL か相対パス */
  href?: string;
};

/** フロー図の線 */
export type MdmarkDiagramWire = {
  /** 線の id */
  id: string;
  /** 元のノードの id */
  from: string;
  /** 先のノードの id */
  to: string;
  /** 線の種類 */
  line: MdmarkDiagramLine;
  /** 縦横だけの折れ線の点 */
  points: Array<[number, number]>;
  /** 線のラベル */
  label?: string;
  /** ラベルの中心 */
  labelAt?: [number, number];
  /** ラベルの詳細。持つラベルにツールチップを付ける */
  tip?: string;
};

/** フロー図の定義 */
export type MdmarkFlowDefinition = {
  /** 題名 */
  title: string;
  /** 範囲 */
  scope: string;
  /** 更新日（`YYYY-MM-DD`） */
  updated: string;
  /** 図の幅（px） */
  width: number;
  /** 図の高さ（px） */
  height: number;
  /** システムの枠。`hint` はタイトルの右のマーカーに出す文 */
  frame?: {
    title: string;
    x: number;
    y: number;
    w: number;
    h: number;
    hint?: string;
  };
  /** 枠の中の層。層のノードの色をうっすら敷く。`hint` はタイトルの右のマーカーに出す文 */
  lanes?: Array<{
    label: string;
    kind: "llm" | "mcp" | "data";
    y: number;
    h: number;
    hint?: string;
  }>;
  /** 拡大して動かしたときに、見えている枠と層のタイトルを表示する枠の上端に留めるか（省いたとき `true`） */
  stickyTitles?: boolean;
  /** ノード */
  nodes: MdmarkDiagramNode[];
  /** 線 */
  wires: MdmarkDiagramWire[];
};

/** シーケンス図の定義 */
export type MdmarkSequenceDefinition = {
  /** 題名 */
  title: string;
  /** 範囲 */
  scope: string;
  /** 更新日 */
  updated: string;
  /** 相手。左から右へ並べる順 */
  participants: Array<{
    id: string;
    kind: MdmarkDiagramNode["kind"];
    name: string;
    tag?: string;
  }>;
  /** メッセージ。時刻の順 */
  steps: Array<{
    from: string;
    to: string;
    label: string;
    reply?: boolean;
    tip?: string;
  }>;
  /** 最後のメッセージから最初へ戻る繰り返し */
  loop?: { label: string };
};

/** グラフの種類 */
export type MdmarkChartType =
  | "line"
  | "bar"
  | "pie"
  | "scatter"
  | "area"
  | "stacked-bar"
  | "stacked-area"
  | "horizontal-bar"
  | "donut"
  | "radar"
  | "bubble"
  | "combo";

/** グラフの系列 */
export type MdmarkChartSeries = {
  name: string;
  points: number[] | Array<[number, number]> | Array<[number, number, number]>;
  /** `combo` の系列の描き方。省くと `line` */
  as?: "line" | "bar";
  /** `combo` の系列が使う縦の軸。省くと `y` */
  axis?: "y" | "y2";
};

/** 縦の軸。`min`・`max`・`step` は 3 つとも書くか 3 つとも省き、省くとデータから切る */
export type MdmarkChartYAxis = {
  label: string;
  min?: number;
  max?: number;
  step?: number;
};

/** グラフの定義 */
export type MdmarkChartDefinition = {
  /** グラフの種類。省くと `line` */
  type?: MdmarkChartType;
  /** 題名 */
  title: string;
  /** 範囲 */
  scope: string;
  /** 更新日 */
  updated: string;
  /** 横の軸。`scatter`・`bubble` は数値の軸で `ticks` を持たず、`radar` は `ticks` を軸の名前にする。それ以外は `ticks` が必須（`horizontal-bar` は縦に並ぶ項目）。`pie`・`donut` は持たない */
  x?: { label: string; ticks?: string[] };
  /** 縦の軸。`pie`・`donut` は持たない */
  y?: MdmarkChartYAxis;
  /** `combo` の右の縦の軸 */
  y2?: MdmarkChartYAxis;
  /** `bubble` の円の面積が表す値の名前 */
  size?: { label: string };
  /** 系列。`pie`・`donut` 以外で 1〜6 つ。`points` の数は `x.ticks` と同じ、`scatter` は `[x, y]`、`bubble` は `[x, y, size]` の組 */
  series?: MdmarkChartSeries[];
  /** `pie`・`donut` の項目。1〜6 つで、`value` は 0 より大きい */
  items?: Array<{ name: string; value: number }>;
  /** `pie`・`donut` の凡例の値と `donut` の中央の合計に付ける単位 */
  unit?: string;
};

/** 操作できる部品の定義 */
export type MdmarkParamDefinition = {
  /** 部品の題 */
  title: string;
  /** スライダー。`value` が既定の値 */
  knob: {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
  };
  /** グラフの題と軸（折れ線） */
  chart: {
    title: string;
    scope: string;
    updated: string;
    x: { label: string; ticks: string[] };
    y: { label: string; min: number; max: number; step: number };
  };
  /** スライダーの値（文字にしたもの）ごとの点。`min` から `max` まで `step` ごとの全ての値を持つ */
  table: Record<string, number[]>;
};

/** ER 図のテーブルの種類 */
export type MdmarkErTableKind = "master" | "transaction";

/** ER 図の関係の端の多重度 */
export type MdmarkErCardinality = "1" | "0..1" | "1..n" | "0..n";

/** ER 図の列 */
export type MdmarkErColumn = {
  /** 列の名前 */
  name: string;
  /** 型 */
  type: string;
  /** 主キーか */
  pk?: boolean;
  /** 外部キーか */
  fk?: boolean;
  /** NOT NULL か */
  nn?: boolean;
  /** 説明。テーブルのツールチップに出す */
  desc?: string;
};

/** ER 図のテーブル */
export type MdmarkErTable = {
  /** 関係の `from`・`to` で指す名前 */
  id: string;
  /** 物理名 */
  name: string;
  /** 論理名 */
  label: string;
  /** 種類。見出しの札と既定の色を決める */
  kind?: MdmarkErTableKind;
  /** 色の名前。`kind` の既定の色より優先する */
  color?: ColorName;
  /** 概要。テーブルのツールチップに出す */
  desc?: string;
  /** 左端（px） */
  x: number;
  /** 上端（px） */
  y: number;
  /** 幅（px） */
  w: number;
  /** 主キーと外部キーの列だけを出した状態で開くか */
  folded?: boolean;
  /** 列。定義の順に並べる */
  columns: MdmarkErColumn[];
};

/** ER 図の関係 */
export type MdmarkErRelation = {
  /** 元のテーブルの `id` */
  from: string;
  /** 元のテーブルの列の `name` */
  fromColumn: string;
  /** 元の端の多重度 */
  fromCard: MdmarkErCardinality;
  /** 先のテーブルの `id` */
  to: string;
  /** 先のテーブルの列の `name` */
  toColumn: string;
  /** 先の端の多重度 */
  toCard: MdmarkErCardinality;
  /** 縦の線の中ほどに出すラベル */
  label?: string;
  /** 縦の線の x（px）。省くと両端の中間 */
  midX?: number;
};

/** ER 図の定義 */
export type MdmarkErDefinition = {
  /** 題名 */
  title: string;
  /** 範囲 */
  scope: string;
  /** 更新日 */
  updated: string;
  /** 図の幅（px）。高さはテーブルの位置と列の数から求める */
  width: number;
  /** テーブル */
  tables: MdmarkErTable[];
  /** 関係 */
  relations: MdmarkErRelation[];
};

/** 読めた定義の種類 */
export type MdmarkDefinition =
  | MdmarkFlowDefinition
  | MdmarkSequenceDefinition
  | MdmarkChartDefinition
  | MdmarkParamDefinition
  | MdmarkErDefinition;

/** 定義を読んだ結果 */
export type DefinitionResult = {
  /** 読めたか */
  ok: boolean;
  /** 読めた定義 */
  definition?: MdmarkDefinition | undefined;
  /** 読めない箇所と直し方の文。読めたときは空 */
  problems: string[];
};

/** 図の部品の印の名前 */
export type DiagramDirective = "flow" | "sequence" | "chart" | "param" | "er";

/** 図の部品の印の名前と、書き方の警告に出す図の種類の名前・呼び名 */
export const DIAGRAM_DIRECTIVES: Readonly<
  Record<DiagramDirective, { name: string; call: string }>
> = {
  flow: { name: "フロー図", call: "この図" },
  sequence: { name: "シーケンス図", call: "この図" },
  chart: { name: "グラフ", call: "このグラフ" },
  param: { name: "操作できる部品", call: "この部品" },
  er: { name: "ER 図", call: "この ER 図" },
};

/** ノードの種類の並び（書き方の警告にも出す） */
const NODE_KINDS: readonly MdmarkDiagramKind[] = [
  "llm",
  "dm",
  "script",
  "mcp",
  "data",
  "external",
  "start",
  "question",
  "action",
  "result",
];

/** 層に使える種類 */
const LANE_KINDS = ["llm", "mcp", "data"];

/** 線の種類の並び */
const LINE_KINDS: readonly MdmarkDiagramLine[] = [
  "flow",
  "read",
  "write",
  "reply",
  "loop",
];

/** 系列の数の下限と上限（円の項目の数も同じ） */
const SERIES_RANGE = { min: 1, max: 6 };

/** グラフの種類 */
const CHART_TYPES: readonly MdmarkChartType[] = [
  "line",
  "bar",
  "pie",
  "scatter",
  "area",
  "stacked-bar",
  "stacked-area",
  "horizontal-bar",
  "donut",
  "radar",
  "bubble",
  "combo",
];

/** 項目を持つ（軸を持たない）グラフの種類 */
const ITEM_CHART_TYPES: readonly string[] = ["pie", "donut"];

/** 横の軸が数値のグラフの種類 */
const NUMERIC_X_CHART_TYPES: readonly string[] = ["scatter", "bubble"];

/** 横の目盛りの数の下限（書いていない種類は 1） */
const MIN_TICKS: Readonly<Record<string, number>> = {
  line: 2,
  area: 2,
  "stacked-area": 2,
  radar: 3,
};

/** 小数のスライダーの値を揃える桁 */
const KNOB_DIGITS = 10;

/** JSON として読めないことを書き方の警告の文に入れる頭 */
const JSON_PROBLEM_HEAD = "JSON として読めません";

/** 閉じていない括弧と文字列から、足りない記号を閉じる順に並べる */
function missingSymbols(text: string): string {
  const stack: string[] = [];
  let inString = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (char === "\\") {
        index += 1;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === "{") {
      stack.push("}");
    } else if (char === "[") {
      stack.push("]");
    } else if (char === "}" || char === "]") {
      stack.pop();
    }
  }
  return `${inString ? '"' : ""}${stack.reverse().join("")}`;
}

/** `JSON.parse` の例外の文から、読めなかった位置を取り出す。位置が無ければ終わりを返す */
function errorPosition(error: unknown, length: number): number {
  const message = error instanceof Error ? error.message : "";
  const position = /position (\d+)/.exec(message)?.[1];
  return position === undefined ? length : Math.min(Number(position), length);
}

/** 定義の JSON を読む。読めないときは、読めた最後の行・その行の文字・足りない記号を返す */
export function parseDefinitionJson(
  text: string,
):
  | { ok: true; value: unknown }
  | { ok: false; line: number; after: string; missing: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const position = errorPosition(error, text.length);
    // 読めた部分は、読めなかった位置の手前の空白を除いた終わりまで
    const readable = text.slice(0, position).trimEnd();
    const lines = readable.split("\n");
    const atEnd = text.slice(position).trim() === "";
    return {
      ok: false,
      line: lines.length,
      after: (lines.at(-1) ?? "").trim(),
      missing: atEnd ? missingSymbols(readable) : "",
    };
  }
}

/** JSON の値の型の名前 */
type ValueType = "文字" | "数" | "真偽値" | "配列" | "オブジェクト";

/** 値が型の名前に合うか */
function isType(value: unknown, type: ValueType): boolean {
  switch (type) {
    case "文字":
      return typeof value === "string";
    case "数":
      return typeof value === "number" && Number.isFinite(value);
    case "真偽値":
      return typeof value === "boolean";
    case "配列":
      return Array.isArray(value);
    case "オブジェクト":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
  }
}

/** 定義を確かめる間に集める読めない箇所 */
class Problems {
  readonly list: string[] = [];

  /** 読めない箇所を足す */
  add(message: string): void {
    this.list.push(message);
  }

  /** `value` が型に合うかを確かめ、合わなければ読めない箇所を足す。合うときだけ `true` */
  expect(value: unknown, type: ValueType, path: string): boolean {
    if (isType(value, type)) {
      return true;
    }
    this.add(
      value === undefined
        ? `${path} がありません。${type}で書いてください`
        : `${path} が${type}ではありません。${type}で書いてください`,
    );
    return false;
  }
}

/** 値をオブジェクトとして取り出す。オブジェクトでなければ読めない箇所を足して `undefined` を返す */
function asObject(
  value: unknown,
  path: string,
  problems: Problems,
): Record<string, unknown> | undefined {
  return problems.expect(value, "オブジェクト", path)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** 値を配列として取り出す。配列でなければ読めない箇所を足して `undefined` を返す */
function asArray(
  value: unknown,
  path: string,
  problems: Problems,
): unknown[] | undefined {
  return problems.expect(value, "配列", path)
    ? (value as unknown[])
    : undefined;
}

/** 題名・範囲・更新日を確かめる */
function checkHead(source: Record<string, unknown>, problems: Problems): void {
  for (const key of ["title", "scope", "updated"]) {
    problems.expect(source[key], "文字", key);
  }
}

/** 文字の項目を確かめる（省けるものは、あるときだけ） */
function checkOptionalText(
  value: unknown,
  path: string,
  problems: Problems,
): void {
  if (value !== undefined) {
    problems.expect(value, "文字", path);
  }
}

/** ノードの種類を確かめる */
function checkKind(value: unknown, label: string, problems: Problems): void {
  if (typeof value !== "string") {
    problems.add(`${label}の種類（kind）がありません。文字で書いてください`);
  } else if (!(NODE_KINDS as readonly string[]).includes(value)) {
    problems.add(
      `${label}の種類 ${value} は使えません。使える種類は ${NODE_KINDS.join("・")} です`,
    );
  }
}

/** 値の並びで重なった `id` を読めない箇所にする */
function checkDuplicates(
  ids: string[],
  noun: string,
  problems: Problems,
): void {
  const seen = new Set<string>();
  const reported = new Set<string>();
  for (const id of ids) {
    if (seen.has(id) && !reported.has(id)) {
      reported.add(id);
      const count = ids.filter((other) => other === id).length;
      problems.add(
        `${noun}の id ${id} が ${count} つあります。別の id にしてください`,
      );
    }
    seen.add(id);
  }
}

/** ノード 1 つを確かめて、`id` を返す */
function checkNode(
  value: unknown,
  index: number,
  problems: Problems,
  omitted = false,
): string | undefined {
  const node = asObject(value, `nodes[${index}]`, problems);
  if (!node) {
    return undefined;
  }
  const name = typeof node.name === "string" ? node.name : `${index + 1} つ目`;
  const label = `ノード「${name}」`;
  problems.expect(node.name, "文字", `nodes[${index}].name`);
  const id = typeof node.id === "string" ? node.id : undefined;
  problems.expect(node.id, "文字", `${label}の id`);
  checkKind(node.kind, label, problems);
  if (!omitted) {
    for (const key of ["x", "y", "w", "h"]) {
      problems.expect(node[key], "数", `${label}の ${key}`);
    }
  }
  checkOptionalText(node.tag, `${label}の tag`, problems);
  checkOptionalText(node.href, `${label}の href`, problems);
  checkOptionalText(node.sub, `${label}の sub`, problems);
  checkOptionalText(node.hint, `${label}の hint`, problems);
  if (node.io !== undefined) {
    const io = asObject(node.io, `${label}の io`, problems);
    if (io) {
      for (const key of ["in", "do", "out"]) {
        problems.expect(io[key], "文字", `${label}の io.${key}`);
      }
    }
  }
  return id;
}

/** 線の点が縦横だけの折れ線かを確かめる */
function checkPoints(value: unknown, label: string, problems: Problems): void {
  const points = asArray(value, `${label}の points`, problems);
  if (!points) {
    return;
  }
  if (points.length < 2) {
    problems.add(
      `${label}の points が ${points.length} つです。2 つ以上の点で書いてください`,
    );
    return;
  }
  const valid: Array<[number, number]> = [];
  for (const point of points) {
    if (
      Array.isArray(point) &&
      point.length === 2 &&
      isType(point[0], "数") &&
      isType(point[1], "数")
    ) {
      valid.push([point[0] as number, point[1] as number]);
    } else {
      problems.add(
        `${label}の points に [x, y] でない点があります。[x, y] の数 2 つで書いてください`,
      );
      return;
    }
  }
  for (let index = 1; index < valid.length; index++) {
    const from = valid[index - 1];
    const to = valid[index];
    if (from && to && from[0] !== to[0] && from[1] !== to[1]) {
      problems.add(
        `${label}の ${index} つ目から ${index + 1} つ目の点が斜めです。縦か横だけの折れ線で書いてください`,
      );
      return;
    }
  }
}

/** 線 1 本を確かめて、`id` を返す */
function checkWire(
  value: unknown,
  index: number,
  nodeIds: Set<string>,
  problems: Problems,
  omitted = false,
): string | undefined {
  const wire = asObject(value, `wires[${index}]`, problems);
  if (!wire) {
    return undefined;
  }
  const id = typeof wire.id === "string" ? wire.id : undefined;
  problems.expect(wire.id, "文字", `wires[${index}].id`);
  // 英数字の id の後ろは、日本語の助詞との間を空ける
  const label = `線 ${id ?? `${index + 1} つ目`} `;
  if (typeof wire.line !== "string") {
    problems.add(`${label}の種類（line）がありません。文字で書いてください`);
  } else if (!(LINE_KINDS as readonly string[]).includes(wire.line)) {
    problems.add(
      `${label}の種類 ${wire.line} は使えません。使える種類は ${LINE_KINDS.join("・")} です`,
    );
  }
  for (const key of ["from", "to"]) {
    const end = wire[key];
    if (typeof end !== "string") {
      problems.add(
        `${label}の ${key} がありません。端のノードの id で書いてください`,
      );
    } else if (!nodeIds.has(end)) {
      problems.add(
        `${label}の端のノード ${end} がありません。ノードの id で書いてください`,
      );
    }
  }
  if (!omitted) {
    checkPoints(wire.points, label, problems);
  }
  checkOptionalText(wire.label, `${label}の label`, problems);
  checkOptionalText(wire.tip, `${label}の tip`, problems);
  if (wire.labelAt !== undefined) {
    const at = wire.labelAt;
    if (
      !Array.isArray(at) ||
      at.length !== 2 ||
      !isType(at[0], "数") ||
      !isType(at[1], "数")
    ) {
      problems.add(
        `${label}の labelAt が [x, y] ではありません。数 2 つで書いてください`,
      );
    }
  }
  return id;
}

/** フロー図の枠と層を確かめる */
function checkFrame(source: Record<string, unknown>, problems: Problems): void {
  if (source.frame !== undefined) {
    const frame = asObject(source.frame, "frame", problems);
    if (frame) {
      problems.expect(frame.title, "文字", "frame.title");
      for (const key of ["x", "y", "w", "h"]) {
        problems.expect(frame[key], "数", `frame.${key}`);
      }
      if (frame.hint !== undefined) {
        problems.expect(frame.hint, "文字", "frame.hint");
      }
    }
  }
  if (source.lanes !== undefined) {
    const lanes = asArray(source.lanes, "lanes", problems);
    lanes?.forEach((value, index) => {
      const lane = asObject(value, `lanes[${index}]`, problems);
      if (!lane) {
        return;
      }
      problems.expect(lane.label, "文字", `lanes[${index}].label`);
      problems.expect(lane.y, "数", `lanes[${index}].y`);
      problems.expect(lane.h, "数", `lanes[${index}].h`);
      if (lane.hint !== undefined) {
        problems.expect(lane.hint, "文字", `lanes[${index}].hint`);
      }
      if (typeof lane.kind !== "string" || !LANE_KINDS.includes(lane.kind)) {
        problems.add(
          `層「${String(lane.label)}」の種類 ${String(lane.kind)} は使えません。使える種類は ${LANE_KINDS.join("・")} です`,
        );
      }
    });
  }
}

/** 座標を省けるノードの種類（判定フローチャート） */
export const JUDGEMENT_KINDS: readonly MdmarkDiagramKind[] = [
  "start",
  "question",
  "action",
  "result",
];

/** フロー図の座標（図の `width`・`height`、ノードの `x`・`y`・`w`・`h`、線の `points`）を全て書いたか・全て省いたか・混ざるか */
function coordinateMode(
  source: Record<string, unknown>,
): "written" | "omitted" | "mixed" {
  const present: boolean[] = [
    source.width !== undefined,
    source.height !== undefined,
  ];
  for (const node of Array.isArray(source.nodes) ? source.nodes : []) {
    if (node !== null && typeof node === "object") {
      for (const key of ["x", "y", "w", "h"]) {
        present.push((node as Record<string, unknown>)[key] !== undefined);
      }
    }
  }
  for (const wire of Array.isArray(source.wires) ? source.wires : []) {
    if (wire !== null && typeof wire === "object") {
      present.push((wire as Record<string, unknown>).points !== undefined);
    }
  }
  if (present.every(Boolean)) {
    return "written";
  }
  return present.some(Boolean) ? "mixed" : "omitted";
}

/** 座標を省いたフロー図の、判定フローチャートでない種類のノード（最初の 1 つ） */
function nodeNotJudgement(
  source: Record<string, unknown>,
): { name: string; kind: string } | undefined {
  for (const node of Array.isArray(source.nodes) ? source.nodes : []) {
    if (node === null || typeof node !== "object") {
      continue;
    }
    const { kind, name } = node as Record<string, unknown>;
    if (
      typeof kind === "string" &&
      (NODE_KINDS as readonly string[]).includes(kind) &&
      !(JUDGEMENT_KINDS as readonly string[]).includes(kind)
    ) {
      return { name: String(name), kind };
    }
  }
  return undefined;
}

/** フロー図の定義を確かめる */
function checkFlow(source: Record<string, unknown>, problems: Problems): void {
  checkHead(source, problems);
  const mode = coordinateMode(source);
  const omitted = mode === "omitted";
  if (mode === "mixed") {
    problems.add(
      "座標（x・y・w・h・points・width・height）を書いたものと省いたものが混ざっています。全て書くか、全て省いてください",
    );
  } else if (omitted) {
    const other = nodeNotJudgement(source);
    if (other) {
      problems.add(
        `ノード「${other.name}」の種類 ${other.kind} では座標を省けません。座標を省けるのは、種類が ${JUDGEMENT_KINDS.join("・")} だけの判定フローチャートです。座標を書くか、種類を変えてください`,
      );
    }
  } else {
    problems.expect(source.width, "数", "width");
    problems.expect(source.height, "数", "height");
  }
  checkFrame(source, problems);
  if (source.stickyTitles !== undefined) {
    problems.expect(source.stickyTitles, "真偽値", "stickyTitles");
  }
  const nodes = asArray(source.nodes, "nodes", problems);
  const nodeIds = (nodes ?? []).map((value, index) =>
    checkNode(value, index, problems, mode !== "written"),
  );
  checkDuplicates(
    nodeIds.filter((id): id is string => id !== undefined),
    "ノード",
    problems,
  );
  const wires = asArray(source.wires, "wires", problems);
  const known = new Set(nodeIds.filter((id): id is string => id !== undefined));
  const wireIds = (wires ?? []).map((value, index) =>
    checkWire(value, index, known, problems, mode !== "written"),
  );
  checkDuplicates(
    wireIds.filter((id): id is string => id !== undefined),
    "線",
    problems,
  );
}

/** シーケンス図の定義を確かめる */
function checkSequence(
  source: Record<string, unknown>,
  problems: Problems,
): void {
  checkHead(source, problems);
  const participants = asArray(source.participants, "participants", problems);
  const ids: string[] = [];
  participants?.forEach((value, index) => {
    const participant = asObject(value, `participants[${index}]`, problems);
    if (!participant) {
      return;
    }
    const name =
      typeof participant.name === "string"
        ? participant.name
        : `${index + 1} つ目`;
    problems.expect(participant.name, "文字", `participants[${index}].name`);
    if (problems.expect(participant.id, "文字", `相手「${name}」の id`)) {
      ids.push(participant.id as string);
    }
    checkKind(participant.kind, `相手「${name}」`, problems);
    checkOptionalText(participant.tag, `相手「${name}」の tag`, problems);
  });
  checkDuplicates(ids, "相手", problems);
  const steps = asArray(source.steps, "steps", problems);
  steps?.forEach((value, index) => {
    const step = asObject(value, `steps[${index}]`, problems);
    if (!step) {
      return;
    }
    const label = `メッセージ ${index + 1} つ目`;
    problems.expect(step.label, "文字", `${label}の label`);
    for (const key of ["from", "to"]) {
      const end = step[key];
      if (typeof end !== "string") {
        problems.add(
          `${label}の ${key} がありません。相手の id で書いてください`,
        );
      } else if (!ids.includes(end)) {
        problems.add(
          `${label}の相手 ${end} がありません。相手の id で書いてください`,
        );
      }
    }
    if (step.reply !== undefined) {
      problems.expect(step.reply, "真偽値", `${label}の reply`);
    }
    checkOptionalText(step.tip, `${label}の tip`, problems);
  });
  if (steps?.length === 0) {
    problems.add("steps が空です。メッセージを 1 つ以上書いてください");
  }
  if (source.loop !== undefined) {
    const loop = asObject(source.loop, "loop", problems);
    if (loop) {
      problems.expect(loop.label, "文字", "loop.label");
    }
  }
}

/** グラフの軸を確かめる。目盛りの数を返す */
function checkAxes(
  source: Record<string, unknown>,
  problems: Problems,
): number | undefined {
  const x = asObject(source.x, "x", problems);
  const y = asObject(source.y, "y", problems);
  let tickCount: number | undefined;
  if (x) {
    problems.expect(x.label, "文字", "x.label");
    const ticks = asArray(x.ticks, "x.ticks", problems);
    if (ticks) {
      if (ticks.length < 2) {
        problems.add(
          "x.ticks が 2 つに満たないです。目盛りを 2 つ以上書いてください",
        );
      }
      if (ticks.every((tick) => typeof tick === "string")) {
        tickCount = ticks.length;
      } else {
        problems.add(
          "x.ticks に文字でない目盛りがあります。目盛りは文字で書いてください",
        );
      }
    }
  }
  if (y) {
    problems.expect(y.label, "文字", "y.label");
    const numbers = ["min", "max", "step"].map((key) =>
      problems.expect(y[key], "数", `y.${key}`),
    );
    if (numbers.every(Boolean)) {
      if ((y.min as number) >= (y.max as number)) {
        problems.add(
          "y.min が y.max 以上です。min は max より小さくしてください",
        );
      }
      if ((y.step as number) <= 0) {
        problems.add("y.step が 0 以下です。step は正の数にしてください");
      }
    }
  }
  return tickCount;
}

/** 点の並びが数だけで、数が目盛りと合うかを確かめる */
function checkPointList(
  points: unknown,
  label: string,
  tickCount: number | undefined,
  problems: Problems,
): void {
  const list = asArray(points, `${label}の points`, problems);
  if (!list) {
    return;
  }
  if (!list.every((point) => isType(point, "数"))) {
    problems.add(
      `${label}の points に数でない点があります。点は数で書いてください`,
    );
  } else if (tickCount !== undefined && list.length !== tickCount) {
    problems.add(
      `${label}の点が ${list.length} つで、横の目盛り（x.ticks）の ${tickCount} つと合いません`,
    );
  }
}

/** 横の軸の名前と目盛り（折れ線・棒）を確かめる。目盛りの数を返す */
function checkTickAxis(
  source: Record<string, unknown>,
  minTicks: number,
  problems: Problems,
): number | undefined {
  const x = asObject(source.x, "x", problems);
  if (!x) {
    return undefined;
  }
  problems.expect(x.label, "文字", "x.label");
  const ticks = asArray(x.ticks, "x.ticks", problems);
  if (!ticks) {
    return undefined;
  }
  if (ticks.length < minTicks) {
    problems.add(
      `x.ticks が ${minTicks} つに満たないです。目盛りを ${minTicks} つ以上書いてください`,
    );
  }
  if (!ticks.every((tick) => typeof tick === "string")) {
    problems.add(
      "x.ticks に文字でない目盛りがあります。目盛りは文字で書いてください",
    );
    return undefined;
  }
  return ticks.length;
}

/** 散布図の横の軸（数値の軸で、目盛りを持たない）を確かめる */
function checkNumericXAxis(
  source: Record<string, unknown>,
  problems: Problems,
): void {
  const x = asObject(source.x, "x", problems);
  if (!x) {
    return;
  }
  problems.expect(x.label, "文字", "x.label");
  if (x.ticks !== undefined) {
    problems.add(
      "散布図の x は数値の軸なので、ticks は書けません。ticks を消してください",
    );
  }
}

/** 縦の軸（`y`・`y2`）を確かめる。`min`・`max`・`step` は 3 つとも書くか 3 つとも省く */
function checkYAxis(
  source: Record<string, unknown>,
  problems: Problems,
  key: "y" | "y2" = "y",
): void {
  const y = asObject(source[key], key, problems);
  if (!y) {
    return;
  }
  problems.expect(y.label, "文字", `${key}.label`);
  const given = ["min", "max", "step"].filter((name) => y[name] !== undefined);
  if (given.length === 0) {
    return;
  }
  if (given.length < 3) {
    problems.add(
      `${key} の min・max・step は 3 つとも書くか、3 つとも省いてください。省くとデータから切ります`,
    );
    return;
  }
  const numbers = ["min", "max", "step"].map((name) =>
    problems.expect(y[name], "数", `${key}.${name}`),
  );
  if (numbers.every(Boolean)) {
    if ((y.min as number) >= (y.max as number)) {
      problems.add(
        `${key}.min が ${key}.max 以上です。min は max より小さくしてください`,
      );
    }
    if ((y.step as number) <= 0) {
      problems.add(`${key}.step が 0 以下です。step は正の数にしてください`);
    }
  }
}

/** 散布図の点が `[x, y]`、バブルの点が `[x, y, size]` の数の組だけかを確かめる */
function checkTupleList(
  points: unknown,
  label: string,
  bubble: boolean,
  problems: Problems,
): void {
  const list = asArray(points, `${label}の points`, problems);
  const shape = bubble ? "[x, y, size]" : "[x, y]";
  if (
    list &&
    !list.every(
      (point) =>
        Array.isArray(point) &&
        point.length === (bubble ? 3 : 2) &&
        point.every((value) => isType(value, "数")),
    )
  ) {
    problems.add(
      `${label}の points に ${shape} でない点があります。点は ${shape} の数の組で書いてください`,
    );
  }
}

/** 組み合わせのグラフの系列の `as`・`axis` を確かめる */
function checkComboSeries(
  entry: Record<string, unknown>,
  label: string,
  hasY2: boolean,
  problems: Problems,
): void {
  if (entry.as !== undefined && entry.as !== "line" && entry.as !== "bar") {
    problems.add(
      `${label}の as ${String(entry.as)} は使えません。as は line・bar のどちらかで書いてください`,
    );
  }
  if (entry.axis !== undefined && entry.axis !== "y" && entry.axis !== "y2") {
    problems.add(
      `${label}の axis ${String(entry.axis)} は使えません。axis は y・y2 のどちらかで書いてください`,
    );
  } else if (entry.axis === "y2" && !hasY2) {
    problems.add(
      `${label}の axis が y2 ですが、y2 がありません。右の縦の軸を y2 に書いてください`,
    );
  }
}

/** 円の項目を確かめる */
function checkPieItems(
  source: Record<string, unknown>,
  problems: Problems,
): void {
  checkOptionalText(source.unit, "unit", problems);
  const items = asArray(source.items, "items", problems);
  if (!items) {
    return;
  }
  if (items.length < SERIES_RANGE.min || items.length > SERIES_RANGE.max) {
    problems.add(
      `項目が ${items.length} つです。項目は ${SERIES_RANGE.min}〜${SERIES_RANGE.max} つで書いてください`,
    );
  }
  items.forEach((value, index) => {
    const item = asObject(value, `items[${index}]`, problems);
    if (!item) {
      return;
    }
    const name =
      typeof item.name === "string" ? item.name : `${index + 1} つ目`;
    problems.expect(item.name, "文字", `items[${index}].name`);
    if (
      problems.expect(item.value, "数", `項目「${name}」の value`) &&
      (item.value as number) <= 0
    ) {
      problems.add(
        `項目「${name}」の value が 0 以下です。value は 0 より大きい数にしてください`,
      );
    }
  });
}

/** グラフの定義を確かめる */
function checkChart(source: Record<string, unknown>, problems: Problems): void {
  checkHead(source, problems);
  const type = source.type ?? "line";
  if (
    typeof type !== "string" ||
    !(CHART_TYPES as readonly string[]).includes(type)
  ) {
    problems.add(
      `グラフの種類 ${String(type)} は使えません。使える種類は ${CHART_TYPES.join("・")} です`,
    );
    return;
  }
  if (ITEM_CHART_TYPES.includes(type)) {
    checkPieItems(source, problems);
    return;
  }
  let tickCount: number | undefined;
  if (NUMERIC_X_CHART_TYPES.includes(type)) {
    checkNumericXAxis(source, problems);
  } else {
    tickCount = checkTickAxis(source, MIN_TICKS[type] ?? 1, problems);
  }
  checkYAxis(source, problems);
  if (type === "combo" && source.y2 !== undefined) {
    checkYAxis(source, problems, "y2");
  }
  if (type === "bubble") {
    const size = asObject(source.size, "size", problems);
    if (size) {
      problems.expect(size.label, "文字", "size.label");
    }
  }
  const series = asArray(source.series, "series", problems);
  if (!series) {
    return;
  }
  if (series.length < SERIES_RANGE.min || series.length > SERIES_RANGE.max) {
    problems.add(
      `系列が ${series.length} つです。系列は ${SERIES_RANGE.min}〜${SERIES_RANGE.max} つで書いてください`,
    );
  }
  series.forEach((value, index) => {
    const entry = asObject(value, `series[${index}]`, problems);
    if (!entry) {
      return;
    }
    const name =
      typeof entry.name === "string" ? entry.name : `${index + 1} つ目`;
    problems.expect(entry.name, "文字", `series[${index}].name`);
    if (NUMERIC_X_CHART_TYPES.includes(type)) {
      checkTupleList(
        entry.points,
        `系列「${name}」`,
        type === "bubble",
        problems,
      );
    } else {
      checkPointList(entry.points, `系列「${name}」`, tickCount, problems);
    }
    if (type === "combo") {
      checkComboSeries(
        entry,
        `系列「${name}」`,
        source.y2 !== undefined,
        problems,
      );
    }
  });
}

/** スライダーの値を `min` から `max` まで `step` ごとに並べる */
function knobValues(knob: {
  min: number;
  max: number;
  step: number;
}): number[] {
  const values: number[] = [];
  const count = Math.floor((knob.max - knob.min) / knob.step + 1e-9);
  for (let index = 0; index <= count; index++) {
    values.push(Number((knob.min + index * knob.step).toFixed(KNOB_DIGITS)));
  }
  return values;
}

/** 操作できる部品の定義を確かめる */
function checkParam(source: Record<string, unknown>, problems: Problems): void {
  problems.expect(source.title, "文字", "title");
  const knob = asObject(source.knob, "knob", problems);
  let knobOk = false;
  if (knob) {
    problems.expect(knob.key, "文字", "knob.key");
    problems.expect(knob.label, "文字", "knob.label");
    const numbers = ["min", "max", "step", "value"].map((key) =>
      problems.expect(knob[key], "数", `knob.${key}`),
    );
    knobOk = numbers.every(Boolean);
    if (knobOk && (knob.min as number) >= (knob.max as number)) {
      problems.add(
        "knob.min が knob.max 以上です。min は max より小さくしてください",
      );
      knobOk = false;
    }
    if (knobOk && (knob.step as number) <= 0) {
      problems.add("knob.step が 0 以下です。step は正の数にしてください");
      knobOk = false;
    }
  }
  const chart = asObject(source.chart, "chart", problems);
  let tickCount: number | undefined;
  if (chart) {
    checkHead(chart, problems);
    tickCount = checkAxes(chart, problems);
  }
  const table = asObject(source.table, "table", problems);
  if (!table) {
    return;
  }
  for (const [key, points] of Object.entries(table)) {
    checkPointList(points, `table の ${key}`, tickCount, problems);
  }
  if (knobOk && knob) {
    const values = knobValues(
      knob as { min: number; max: number; step: number },
    );
    for (const value of values) {
      if (!Object.hasOwn(table, String(value))) {
        problems.add(
          `スライダーの値 ${value} の点が table にありません。min から max まで step ごとの全ての値を書いてください`,
        );
      }
    }
    if (!values.includes(knob.value as number)) {
      problems.add(
        `knob.value ${String(knob.value)} が min から step ごとの値に当たりません。既定の値は step ごとの値で書いてください`,
      );
    }
  }
}

/** ER 図のテーブルの種類の並び（書き方の警告にも出す） */
const ER_TABLE_KIND_LIST: readonly MdmarkErTableKind[] = [
  "master",
  "transaction",
];

/** ER 図の多重度の並び（書き方の警告にも出す） */
const ER_CARDINALITY_LIST: readonly MdmarkErCardinality[] = [
  "1",
  "0..1",
  "1..n",
  "0..n",
];

/** 真偽値の項目を確かめる（省けるものは、あるときだけ） */
function checkOptionalBoolean(
  value: unknown,
  path: string,
  problems: Problems,
): void {
  if (value !== undefined) {
    problems.expect(value, "真偽値", path);
  }
}

/** ER 図のテーブル 1 つを確かめ、`id` と列の名前を返す */
function checkErTable(
  value: unknown,
  index: number,
  problems: Problems,
): { id: string; columns: string[] } | undefined {
  const table = asObject(value, `tables[${index}]`, problems);
  if (!table) {
    return undefined;
  }
  const name =
    typeof table.label === "string" ? table.label : `${index + 1} つ目`;
  const label = `テーブル「${name}」`;
  problems.expect(table.id, "文字", `${label}の id`);
  problems.expect(table.name, "文字", `${label}の name`);
  problems.expect(table.label, "文字", `tables[${index}].label`);
  for (const key of ["x", "y", "w"]) {
    problems.expect(table[key], "数", `${label}の ${key}`);
  }
  checkOptionalText(table.desc, `${label}の desc`, problems);
  checkOptionalBoolean(table.folded, `${label}の folded`, problems);
  if (table.kind !== undefined) {
    if (
      typeof table.kind !== "string" ||
      !(ER_TABLE_KIND_LIST as readonly string[]).includes(table.kind)
    ) {
      problems.add(
        `${label}の種類 ${String(table.kind)} は使えません。使える種類は ${ER_TABLE_KIND_LIST.join("・")} です`,
      );
    }
  }
  if (table.color !== undefined && !isColorName(String(table.color))) {
    problems.add(
      `${label}の色 ${String(table.color)} は色の名前ではありません。使える色の名前は ${COLOR_NAMES.join("・")} です`,
    );
  }
  const columns: string[] = [];
  const list = asArray(table.columns, `${label}の columns`, problems) ?? [];
  list.forEach((item, i) => {
    const column = asObject(item, `${label}の columns[${i}]`, problems);
    if (!column) {
      return;
    }
    if (problems.expect(column.name, "文字", `${label}の columns[${i}].name`)) {
      columns.push(column.name as string);
    }
    problems.expect(column.type, "文字", `${label}の columns[${i}].type`);
    for (const key of ["pk", "fk", "nn"]) {
      checkOptionalBoolean(
        column[key],
        `${label}の columns[${i}].${key}`,
        problems,
      );
    }
    checkOptionalText(column.desc, `${label}の columns[${i}].desc`, problems);
  });
  const seen = new Set<string>();
  for (const column of columns) {
    if (seen.has(column)) {
      problems.add(
        `${label}の列の名前 ${column} が 2 つ以上あります。別の名前にしてください`,
      );
      break;
    }
    seen.add(column);
  }
  return typeof table.id === "string" ? { id: table.id, columns } : undefined;
}

/** ER 図の関係 1 つの多重度を確かめる */
function checkErCardinality(
  value: unknown,
  path: string,
  problems: Problems,
): void {
  if (
    typeof value !== "string" ||
    !(ER_CARDINALITY_LIST as readonly string[]).includes(value)
  ) {
    problems.add(
      value === undefined
        ? `${path} がありません。${ER_CARDINALITY_LIST.join("・")} のどれかで書いてください`
        : `${path} の ${String(value)} は使えません。使える多重度は ${ER_CARDINALITY_LIST.join("・")} です`,
    );
  }
}

/** ER 図の関係の端のテーブルと列を確かめる */
function checkErEnd(
  relation: Record<string, unknown>,
  side: "from" | "to",
  label: string,
  tables: Map<string, string[]>,
  problems: Problems,
): void {
  const tableId = relation[side];
  const column = relation[side === "from" ? "fromColumn" : "toColumn"];
  const where = side === "from" ? "元" : "先";
  if (!problems.expect(tableId, "文字", `${label}の ${side}`)) {
    return;
  }
  if (
    !problems.expect(
      column,
      "文字",
      `${label}の ${side === "from" ? "fromColumn" : "toColumn"}`,
    )
  ) {
    return;
  }
  const columns = tables.get(tableId as string);
  if (columns === undefined) {
    problems.add(
      `${label}の${where}のテーブル ${String(tableId)} がありません。テーブルの id で書いてください`,
    );
  } else if (!columns.includes(column as string)) {
    problems.add(
      `${label}の${where}の列 ${String(tableId)}.${String(column)} がテーブル ${String(tableId)} にありません`,
    );
  }
}

/** ER 図の定義を確かめる */
function checkEr(source: Record<string, unknown>, problems: Problems): void {
  checkHead(source, problems);
  problems.expect(source.width, "数", "width");
  const tables = new Map<string, string[]>();
  const ids: string[] = [];
  const list = asArray(source.tables, "tables", problems) ?? [];
  list.forEach((value, index) => {
    const table = checkErTable(value, index, problems);
    if (table) {
      ids.push(table.id);
      tables.set(table.id, table.columns);
    }
  });
  checkDuplicates(ids, "テーブル", problems);
  const relations = asArray(source.relations, "relations", problems) ?? [];
  relations.forEach((value, index) => {
    const relation = asObject(value, `relations[${index}]`, problems);
    if (!relation) {
      return;
    }
    const label =
      typeof relation.label === "string"
        ? `関係「${relation.label}」`
        : `${index + 1} つ目の関係`;
    checkErEnd(relation, "from", label, tables, problems);
    checkErEnd(relation, "to", label, tables, problems);
    checkErCardinality(relation.fromCard, `${label}の fromCard`, problems);
    checkErCardinality(relation.toCard, `${label}の toCard`, problems);
    checkOptionalText(relation.label, `${label}の label`, problems);
    if (relation.midX !== undefined) {
      problems.expect(relation.midX, "数", `${label}の midX`);
    }
  });
}

/** 種類ごとの形の確かめ */
const CHECKERS: Record<
  DiagramDirective,
  (source: Record<string, unknown>, problems: Problems) => void
> = {
  flow: checkFlow,
  sequence: checkSequence,
  chart: checkChart,
  param: checkParam,
  er: checkEr,
};

/** 印の範囲の `json` のコードブロックを読み、種類ごとの形を確かめる。読めない箇所は書き方の警告の文にして返す */
export function readDefinition(
  directive: DiagramDirective,
  blocks: string[],
): DefinitionResult {
  const [block] = blocks;
  if (blocks.length !== 1 || block === undefined) {
    return {
      ok: false,
      problems: ["印の範囲に json のコードブロックを 1 つだけ置いてください"],
    };
  }
  const parsed = parseDefinitionJson(block);
  if (!parsed.ok) {
    // 書き方の警告は逆引用符で行内のコードを囲むので、読めた文字の逆引用符は引用符に替える
    const where = `${parsed.line} 行目の ${parsed.after.replaceAll("`", "'")} の後`;
    return {
      ok: false,
      problems: [
        parsed.missing === ""
          ? `${JSON_PROBLEM_HEAD}（${where}が読めません）`
          : `${JSON_PROBLEM_HEAD}（${where}に ${parsed.missing} がありません）`,
      ],
    };
  }
  const problems = new Problems();
  const source = asObject(parsed.value, "定義", problems);
  if (source) {
    CHECKERS[directive](source, problems);
  }
  if (problems.list.length > 0) {
    return { ok: false, problems: problems.list };
  }
  const definition = parsed.value as MdmarkDefinition;
  return {
    ok: true,
    definition:
      directive === "flow" &&
      coordinateMode(parsed.value as Record<string, unknown>) === "omitted"
        ? layoutFlowchart(definition as MdmarkFlowDefinition)
        : definition,
    problems: [],
  };
}

/** フロー図の定義の、本文のリンクと同じ許可に当たらないリンク先を持つノードを定義の順に返す */
export function nodeLinkProblems(
  definition: MdmarkFlowDefinition,
): Array<{ id: string; href: string }> {
  return definition.nodes.flatMap((node) =>
    node.href !== undefined && !isAllowedUrl(node.href)
      ? [{ id: node.id, href: node.href }]
      : [],
  );
}

/** 読めない定義の書き方の警告の本文と項目。読めない箇所が 2 つ以上あるときは、1 つ目を本文に書き、残りを項目に並べる */
export function definitionWarning(
  directive: DiagramDirective,
  problems: string[],
): { message: string; items: Array<{ label: string; message: string }> } {
  const { name, call } = DIAGRAM_DIRECTIVES[directive];
  const [first = "", ...rest] = problems;
  const head = first.startsWith(JSON_PROBLEM_HEAD)
    ? `${name}の部品の定義を ${first}。`
    : `${name}の部品の定義を読めません。${first}。`;
  return {
    message: `${head}${call}は描いていません。`,
    items: rest.map((message) => ({ label: "", message })),
  };
}
