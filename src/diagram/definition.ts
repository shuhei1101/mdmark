import { COLOR_NAMES, type ColorName, isColorName } from "../parts/colors.ts";

/** map の構成図のノード */
export type MdmarkDiagramNode = {
  /** 線が端に指す id */
  id: string;
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
  /** 補足 */
  sub?: string;
  /** ノードの右上のマーカーに出す説明（補足の `notes`） */
  hint?: string;
  /** 許可したリンク先 */
  href?: string;
  /** 設定の map.kinds の種類（種類の行の名前・アイコン・構造・色） */
  style: MdmarkNodeStyle;
};

/** map の構成図のノードの種類（種類の行の名前・Lucide のアイコンの名前・構造・色の名前） */
export type MdmarkNodeStyle = {
  label?: string | undefined;
  icon?: string | undefined;
  shape?: "rounded" | "rect" | "pill" | "double" | undefined;
  color?: string | undefined;
};

/** map の構成図の線の種類（模様・太さ・矢じり・色の名前） */
export type MdmarkWireStyle = {
  dash?: "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash" | undefined;
  width?: "thin" | "normal" | "thick" | undefined;
  head?: "filled" | "open" | "none" | undefined;
  color?: string | undefined;
  /** 両端に矢じりを付けるか（`<-->`） */
  both?: boolean | undefined;
};

/** map の構成図の線 */
export type MdmarkDiagramWire = {
  /** 線の id */
  id: string;
  /** 元のノードの id */
  from: string;
  /** 先のノードの id */
  to: string;
  /** 縦横だけの折れ線の点 */
  points: Array<[number, number]>;
  /** 線のラベル */
  label?: string;
  /** ラベルの中心 */
  labelAt?: [number, number];
  /** ラベルの詳細。持つラベルにツールチップを付ける */
  tip?: string;
  /** 設定の map.lines の線の種類（模様・太さ・矢じり・色） */
  style: MdmarkWireStyle;
};

/** map の構成図のノードと線（自動配置の結果から作り、`renderFlow` に渡す） */
export type MdmarkFlowDefinition = {
  /** 図の幅（px） */
  width: number;
  /** 図の高さ（px） */
  height: number;
  /** ノード */
  nodes: MdmarkDiagramNode[];
  /** 線 */
  wires: MdmarkDiagramWire[];
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
  /** `combo` の系列が使用する縦の軸。省くと `y` */
  axis?: "y" | "y2";
};

/** 縦の軸。`min`・`max`・`step` は 3 つとも記載するか 3 つとも省き、省くとデータから切る */
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
  /** 部品のタイトル */
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
  /** グラフのタイトルと軸（折れ線） */
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

/** 読み込めた定義の種類 */
export type MdmarkDefinition =
  | MdmarkChartDefinition
  | MdmarkParamDefinition
  | MdmarkErDefinition;

/** 定義を読み込んだ結果 */
export type DefinitionResult = {
  /** 読み込めたか */
  ok: boolean;
  /** 読み込めた定義 */
  definition?: MdmarkDefinition | undefined;
  /** 読み込めない箇所と修正方法の文。読み込めたときは空 */
  problems: string[];
};

/** 図の部品のマーカーの名前 */
export type DiagramDirective = "chart" | "param" | "er";

/** 廃止した図の部品のマーカーの名前 */
export type RetiredDiagramDirective = "flow" | "sequence";

/** 廃止した図の部品のマーカー。同じ名前の拡張が無い範囲を、描く処理・点検・参照の取り出し・移行の手順が廃止した図として扱う */
export const RETIRED_DIAGRAM_DIRECTIVES: readonly RetiredDiagramDirective[] = [
  "flow",
  "sequence",
];

/** 図の部品のマーカーの名前と、記載の警告に出す図の種類の名前・呼び名 */
export const DIAGRAM_DIRECTIVES: Readonly<
  Record<DiagramDirective, { name: string; call: string }>
> = {
  chart: { name: "グラフ", call: "このグラフ" },
  param: { name: "操作できる部品", call: "この部品" },
  er: { name: "ER 図", call: "この ER 図" },
};

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

/** 横の目盛りの数の下限（記載していない種類は 1） */
const MIN_TICKS: Readonly<Record<string, number>> = {
  line: 2,
  area: 2,
  "stacked-area": 2,
  radar: 3,
};

/** 小数のスライダーの値を統一する桁 */
const KNOB_DIGITS = 10;

/** JSON として読み込めないことを記載の警告の文に入れる頭 */
const JSON_PROBLEM_HEAD = "JSON として読み込めません";

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

/** `JSON.parse` の例外の文から、読み込めなかった位置を取り出す。位置が無ければ終わりを返却する */
function errorPosition(error: unknown, length: number): number {
  const message = error instanceof Error ? error.message : "";
  const position = /position (\d+)/.exec(message)?.[1];
  return position === undefined ? length : Math.min(Number(position), length);
}

/** 定義の JSON を読み込む。読み込めないときは、読み込めた最後の行・その行の文字・足りない記号を返却する */
export function parseDefinitionJson(
  text: string,
):
  | { ok: true; value: unknown }
  | { ok: false; line: number; after: string; missing: string } {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const position = errorPosition(error, text.length);
    // 読み込めた部分は、読み込めなかった位置の手前の空白を除いた終わりまで
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

/** 定義を確認する間に集める読み込めない箇所 */
class Problems {
  readonly list: string[] = [];

  /** 読み込めない箇所を追加する */
  add(message: string): void {
    this.list.push(message);
  }

  /** `value` が型に合うかを確認し、合わなければ読み込めない箇所を追加する。合うときだけ `true` */
  expect(value: unknown, type: ValueType, path: string): boolean {
    if (isType(value, type)) {
      return true;
    }
    this.add(
      value === undefined
        ? `${path} がありません。${type}で記載してください`
        : `${path} が${type}ではありません。${type}で記載してください`,
    );
    return false;
  }
}

/** 値をオブジェクトとして取り出す。オブジェクトでなければ読み込めない箇所を追加して `undefined` を返却する */
function asObject(
  value: unknown,
  path: string,
  problems: Problems,
): Record<string, unknown> | undefined {
  return problems.expect(value, "オブジェクト", path)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** 値を配列として取り出す。配列でなければ読み込めない箇所を追加して `undefined` を返却する */
function asArray(
  value: unknown,
  path: string,
  problems: Problems,
): unknown[] | undefined {
  return problems.expect(value, "配列", path)
    ? (value as unknown[])
    : undefined;
}

/** 題名・範囲・更新日を確認する */
function checkHead(source: Record<string, unknown>, problems: Problems): void {
  for (const key of ["title", "scope", "updated"]) {
    problems.expect(source[key], "文字", key);
  }
}

/** 文字の項目を確認する（省けるものは、あるときだけ） */
function checkOptionalText(
  value: unknown,
  path: string,
  problems: Problems,
): void {
  if (value !== undefined) {
    problems.expect(value, "文字", path);
  }
}

/** 値の並びで重なった `id` を読み込めない箇所にする */
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

/** グラフの軸を確認する。目盛りの数を返却する */
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
          "x.ticks に文字でない目盛りがあります。目盛りは文字で記載してください",
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

/** 点の並びが数だけで、数が目盛りと合うかを確認する */
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
      `${label}の points に数でない点があります。点は数で記載してください`,
    );
  } else if (tickCount !== undefined && list.length !== tickCount) {
    problems.add(
      `${label}の点が ${list.length} つで、横の目盛り（x.ticks）の ${tickCount} つと合いません`,
    );
  }
}

/** 横の軸の名前と目盛り（折れ線・棒）を確認する。目盛りの数を返却する */
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
      "x.ticks に文字でない目盛りがあります。目盛りは文字で記載してください",
    );
    return undefined;
  }
  return ticks.length;
}

/** 散布図の横の軸（数値の軸で、目盛りを持たない）を確認する */
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
      "散布図の x は数値の軸なので、ticks は記載できません。ticks を削除してください",
    );
  }
}

/** 縦の軸（`y`・`y2`）を確認する。`min`・`max`・`step` は 3 つとも記載するか 3 つとも省く */
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
      `${key} の min・max・step は 3 つとも記載するか、3 つとも省いてください。省くとデータから切ります`,
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

/** 散布図の点が `[x, y]`、バブルの点が `[x, y, size]` の数の組だけかを確認する */
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
      `${label}の points に ${shape} でない点があります。点は ${shape} の数の組で記載してください`,
    );
  }
}

/** 組み合わせのグラフの系列の `as`・`axis` を確認する */
function checkComboSeries(
  entry: Record<string, unknown>,
  label: string,
  hasY2: boolean,
  problems: Problems,
): void {
  if (entry.as !== undefined && entry.as !== "line" && entry.as !== "bar") {
    problems.add(
      `${label}の as ${String(entry.as)} は使用できません。as は line・bar のどちらかで記載してください`,
    );
  }
  if (entry.axis !== undefined && entry.axis !== "y" && entry.axis !== "y2") {
    problems.add(
      `${label}の axis ${String(entry.axis)} は使用できません。axis は y・y2 のどちらかで記載してください`,
    );
  } else if (entry.axis === "y2" && !hasY2) {
    problems.add(
      `${label}の axis が y2 ですが、y2 がありません。右の縦の軸を y2 に記載してください`,
    );
  }
}

/** 円の項目を確認する */
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
      `項目が ${items.length} つです。項目は ${SERIES_RANGE.min}〜${SERIES_RANGE.max} つで記載してください`,
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

/** グラフの定義を確認する */
function checkChart(source: Record<string, unknown>, problems: Problems): void {
  checkHead(source, problems);
  const type = source.type ?? "line";
  if (
    typeof type !== "string" ||
    !(CHART_TYPES as readonly string[]).includes(type)
  ) {
    problems.add(
      `グラフの種類 ${String(type)} は使用できません。使用できる種類は ${CHART_TYPES.join("・")} です`,
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
      `系列が ${series.length} つです。系列は ${SERIES_RANGE.min}〜${SERIES_RANGE.max} つで記載してください`,
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

/** 操作できる部品の定義を確認する */
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
          `スライダーの値 ${value} の点が table にありません。min から max まで step ごとの全ての値を記載してください`,
        );
      }
    }
    if (!values.includes(knob.value as number)) {
      problems.add(
        `knob.value ${String(knob.value)} が min から step ごとの値に該当しません。既定の値は step ごとの値で記載してください`,
      );
    }
  }
}

/** ER 図のテーブルの種類の並び（記載の警告にも出す） */
const ER_TABLE_KIND_LIST: readonly MdmarkErTableKind[] = [
  "master",
  "transaction",
];

/** ER 図の多重度の並び（記載の警告にも出す） */
const ER_CARDINALITY_LIST: readonly MdmarkErCardinality[] = [
  "1",
  "0..1",
  "1..n",
  "0..n",
];

/** 真偽値の項目を確認する（省けるものは、あるときだけ） */
function checkOptionalBoolean(
  value: unknown,
  path: string,
  problems: Problems,
): void {
  if (value !== undefined) {
    problems.expect(value, "真偽値", path);
  }
}

/** ER 図のテーブル 1 つを確認し、`id` と列の名前を返却する */
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
        `${label}の種類 ${String(table.kind)} は使用できません。使用できる種類は ${ER_TABLE_KIND_LIST.join("・")} です`,
      );
    }
  }
  if (table.color !== undefined && !isColorName(String(table.color))) {
    problems.add(
      `${label}の色 ${String(table.color)} は色の名前ではありません。使用できる色の名前は ${COLOR_NAMES.join("・")} です`,
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

/** ER 図の関係 1 つの多重度を確認する */
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
        ? `${path} がありません。${ER_CARDINALITY_LIST.join("・")} のどれかで記載してください`
        : `${path} の ${String(value)} は使用できません。使用できる多重度は ${ER_CARDINALITY_LIST.join("・")} です`,
    );
  }
}

/** ER 図の関係の端のテーブルと列を確認する */
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
      `${label}の${where}のテーブル ${String(tableId)} がありません。テーブルの id で記載してください`,
    );
  } else if (!columns.includes(column as string)) {
    problems.add(
      `${label}の${where}の列 ${String(tableId)}.${String(column)} がテーブル ${String(tableId)} にありません`,
    );
  }
}

/** ER 図の定義を確認する */
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

/** 種類ごとの構造の確認 */
const CHECKERS: Record<
  DiagramDirective,
  (source: Record<string, unknown>, problems: Problems) => void
> = {
  chart: checkChart,
  param: checkParam,
  er: checkEr,
};

/** マーカーの範囲の `json` のコードブロックを読み込み、種類ごとの構造を確認する。読み込めない箇所は記載の警告の文にして返却する */
export function readDefinition(
  directive: DiagramDirective,
  blocks: string[],
): DefinitionResult {
  const [block] = blocks;
  if (blocks.length !== 1 || block === undefined) {
    return {
      ok: false,
      problems: [
        "マーカーの範囲に json のコードブロックを 1 つだけ配置してください",
      ],
    };
  }
  const parsed = parseDefinitionJson(block);
  if (!parsed.ok) {
    // 記載の警告は逆引用符で行内のコードを囲むので、読み込めた文字の逆引用符は引用符に替える
    const where = `${parsed.line} 行目の ${parsed.after.replaceAll("`", "'")} の後`;
    return {
      ok: false,
      problems: [
        parsed.missing === ""
          ? `${JSON_PROBLEM_HEAD}（${where}が読み込めません）`
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
  return {
    ok: true,
    definition: parsed.value as MdmarkDefinition,
    problems: [],
  };
}

/** 読み込めない定義の記載の警告の本文と項目。読み込めない箇所が 2 つ以上あるときは、1 つ目を本文に記載し、残りを項目に並べる */
export function definitionWarning(
  directive: DiagramDirective,
  problems: string[],
): { message: string; items: Array<{ label: string; message: string }> } {
  const { name, call } = DIAGRAM_DIRECTIVES[directive];
  const [first = "", ...rest] = problems;
  const head = first.startsWith(JSON_PROBLEM_HEAD)
    ? `${name}の部品の定義を ${first}。`
    : `${name}の部品の定義を読み込めません。${first}。`;
  return {
    message: `${head}${call}は描いていません。`,
    items: rest.map((message) => ({ label: "", message })),
  };
}
