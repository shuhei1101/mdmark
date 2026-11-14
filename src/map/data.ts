import type { MapProblem } from "./spec.ts";

/** 案内の 1 手順 */
export type MapStep = {
  title: string | undefined;
  text: string;
  nodes: string[];
  edges: string[] | undefined;
  enter: string | undefined;
};

/** データの印の色と形状 */
export type MapPacket = {
  color?: string | undefined;
  shape?: "circle" | "square" | "diamond" | undefined;
};

/** 線の端をつなぐノードの辺 */
export type MapSide = "top" | "right" | "bottom" | "left";

/** ID ごとの配置と見た目の上書き */
export type MapLayoutEntry = {
  align?: string | undefined;
  order?: number | undefined;
  justify?: "start" | "center" | "end" | undefined;
  pos?: { x: number; y: number } | undefined;
  width?: number | undefined;
  color?: string | undefined;
  line?: string | undefined;
  packet?: MapPacket | undefined;
  ends?: { from?: MapSide; to?: MapSide } | undefined;
  via?: Array<{ x: number; y: number }> | undefined;
  collapsed?: boolean | undefined;
};

/** ノード・線の説明と、参照する注記の ID の並び（どちらか一方だけでもよい） */
export type MapNote = {
  text?: string | undefined;
  annotations?: string[] | undefined;
};

/** 補足の `notes` のうち説明を持つものを、ID ごとの説明の文にする */
export const noteTexts = (
  notes: Record<string, MapNote>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(notes).flatMap(([id, note]) =>
      note.text === undefined ? [] : [[id, note.text]],
    ),
  );

/** ER 図の分類（テーブルをまとめるグループ） */
export type MapGroup = {
  title: string;
  tables: string[];
  parent: string | undefined;
};

/** 補足 */
export type MapData = {
  version: 1;
  notes: Record<string, MapNote>;
  walkthroughs: MapStep[];
  layout: Record<string, MapLayoutEntry>;
  plays_over: number | undefined;
  /** ER 図の分類（分類の ID ごと） */
  groups: Record<string, MapGroup>;
};

/** 補足のトップレベルのキー */
export const MAP_DATA_KEYS = [
  "version",
  "notes",
  "walkthroughs",
  "layout",
  "plays_over",
  "groups",
] as const;
const GROUP_KEYS = ["title", "tables", "parent"];
const STEP_KEYS = ["title", "text", "nodes", "edges", "enter"];
const LAYOUT_KEYS = [
  "align",
  "order",
  "justify",
  "pos",
  "width",
  "color",
  "line",
  "packet",
  "ends",
  "via",
  "collapsed",
];
const PACKET_SHAPES = ["circle", "square", "diamond"];
const SIDES = ["top", "right", "bottom", "left"];
const JUSTIFIES = ["start", "center", "end"];

/** 空の補足 */
export const emptyMapData = (): MapData => ({
  version: 1,
  notes: {},
  walkthroughs: [],
  layout: {},
  plays_over: undefined,
  groups: {},
});

/**
 * JSON の文字を走査し、オブジェクトのキーと配列の要素のパス（`notes.ghost`・`walkthroughs[0]`）ごとに、
 * 始まる行（0 から）を返す。JSON.parse で読めた文字だけを渡す
 */
export const jsonPathLines = (source: string): Map<string, number> => {
  const lines = new Map<string, number>();
  let at = 0;
  let line = 0;
  const skip = () => {
    while (at < source.length && /\s/.test(source[at] as string)) {
      if (source[at] === "\n") line += 1;
      at += 1;
    }
  };
  const readString = (): string => {
    const start = at;
    at += 1;
    while (at < source.length && source[at] !== '"')
      at += source[at] === "\\" ? 2 : 1;
    at += 1;
    return JSON.parse(source.slice(start, at)) as string;
  };
  /** オブジェクトのキーか配列の要素のパスを、始まる行とともに記録する */
  const childPath = (
    char: string,
    context: { path: string; index: number },
  ): string => {
    const { path, index } = context;
    if (char !== "{") {
      const child = `${path}[${index}]`;
      lines.set(child, line);
      return child;
    }
    const keyLine = line;
    const key = readString();
    const child = path === "" ? key : `${path}.${key}`;
    lines.set(child, keyLine);
    skip();
    at += 1;
    return child;
  };
  /** オブジェクトか配列の中を走査する */
  const container = (char: string, path: string): void => {
    const close = char === "{" ? "}" : "]";
    at += 1;
    skip();
    let index = 0;
    while (at < source.length && source[at] !== close) {
      value(childPath(char, { path, index }));
      index += 1;
      skip();
      if (source[at] === ",") at += 1;
      skip();
    }
    at += 1;
  };
  const value = (path: string): void => {
    skip();
    const char = source[at];
    if (char === "{" || char === "[") {
      container(char, path);
    } else if (char === '"') {
      readString();
    } else {
      while (at < source.length && !/[,\]}\s]/.test(source[at] as string))
        at += 1;
    }
  };
  value("");
  return lines;
};

/** JSON.parse のエラーの文から、補足の中の行（0 から）を求める */
const errorLine = (source: string, error: unknown): number | undefined => {
  const message = error instanceof Error ? error.message : "";
  const lineMatch = /line (\d+)/.exec(message);
  if (lineMatch) return Number(lineMatch[1]) - 1;
  const position = /position (\d+)/.exec(message);
  if (!position) return undefined;
  return source.slice(0, Number(position[1])).split("\n").length - 1;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 補足を読むときに、項目とパスごとの行を持つ読み手 */
type DataReader = { problems: MapProblem[]; lines: Map<string, number> };

/** 値の型が合わない項目を足す */
const invalid = (reader: DataReader, path: string, expected: string): void => {
  reader.problems.push({
    kind: "map_invalid_value",
    line: reader.lines.get(path),
    message: `補足の \`${path}\` は${expected}で記載してください。`,
  });
};

/** 知らないキーの項目を足す */
const unknownKey = (
  reader: DataReader,
  item: { path: string; key: string; keys: readonly string[] },
): void => {
  const { path, key, keys } = item;
  reader.problems.push({
    kind: "map_unknown_key",
    line: reader.lines.get(path === "" ? key : `${path}.${key}`),
    message: `補足${path === "" ? "" : `の \`${path}\``}に知らないキー \`${key}\` があります。使用できるキーは ${keys.map((name) => `\`${name}\``).join("・")} です。`,
  });
};

/** 文字の値。`--` を含めば項目にする */
const readText = (
  reader: DataReader,
  value: unknown,
  path: string,
): string | undefined => {
  if (typeof value !== "string") {
    invalid(reader, path, "文字");
    return undefined;
  }
  if (value.includes("--")) {
    reader.problems.push({
      kind: "map_invalid_value",
      line: reader.lines.get(path),
      message: `補足の \`${path}\` に \`--\` があります。HTML コメントを閉じてしまうため、\`--\` を含めずに記載してください。`,
    });
    return undefined;
  }
  return value;
};

/** ID の配列（読めない ID は除く） */
const readIds = (
  reader: DataReader,
  value: unknown,
  path: string,
): string[] | undefined => {
  if (!Array.isArray(value)) {
    invalid(reader, path, "ID の配列");
    return undefined;
  }
  const out: string[] = [];
  for (const [i, item] of value.entries()) {
    const id = readText(reader, item, `${path}[${i}]`);
    if (id !== undefined) out.push(id);
  }
  return out;
};

/** 数の値 */
const readNumber = (
  reader: DataReader,
  value: unknown,
  path: string,
): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  invalid(reader, path, "数");
  return undefined;
};

/** `{"x", "y"}` の値 */
const readPoint = (
  reader: DataReader,
  value: unknown,
  path: string,
): { x: number; y: number } | undefined => {
  if (!isObject(value)) {
    invalid(reader, path, ' `{"x", "y"}` ');
    return undefined;
  }
  const x = readNumber(reader, value.x, `${path}.x`);
  const y = readNumber(reader, value.y, `${path}.y`);
  return x === undefined || y === undefined ? undefined : { x, y };
};

/** 選べる値のどれか */
const readChoice = <T extends string>(
  reader: DataReader,
  value: unknown,
  place: { path: string; choices: readonly string[] },
): T | undefined => {
  const { path, choices } = place;
  if (typeof value === "string" && choices.includes(value)) return value as T;
  invalid(reader, path, ` ${choices.map((name) => `\`${name}\``).join("・")} `);
  return undefined;
};

/** 線の両端の辺 */
const readEnds = (
  reader: DataReader,
  value: unknown,
  path: string,
): MapLayoutEntry["ends"] | undefined => {
  if (!isObject(value)) {
    invalid(reader, path, ' `{"from": {"side"}, "to": {"side"}}` ');
    return undefined;
  }
  const out: { from?: MapSide; to?: MapSide } = {};
  for (const end of ["from", "to"] as const) {
    const item = value[end];
    if (item === undefined) continue;
    if (!isObject(item)) {
      invalid(reader, `${path}.${end}`, ' `{"side"}` ');
      return undefined;
    }
    const side = readChoice<MapSide>(reader, item.side, {
      path: `${path}.${end}.side`,
      choices: SIDES,
    });
    if (side === undefined) return undefined;
    out[end] = side;
  }
  return out;
};

/** データの印の色と形状 */
const readPacket = (
  reader: DataReader,
  value: unknown,
  path: string,
): MapPacket | undefined => {
  if (!isObject(value)) {
    invalid(reader, path, ' `{"color", "shape"}` ');
    return undefined;
  }
  const out: MapPacket = {};
  if (value.color !== undefined)
    out.color = readText(reader, value.color, `${path}.color`);
  if (value.shape !== undefined)
    out.shape = readChoice(reader, value.shape, {
      path: `${path}.shape`,
      choices: PACKET_SHAPES,
    });
  return out;
};

/** 線が通る点の並び */
const readVia = (
  reader: DataReader,
  value: unknown,
  path: string,
): Array<{ x: number; y: number }> | undefined => {
  if (!Array.isArray(value)) {
    invalid(reader, path, ' `[{"x", "y"}]` ');
    return undefined;
  }
  const points = value.map((item, i) =>
    readPoint(reader, item, `${path}[${i}]`),
  );
  return points.every((item) => item !== undefined)
    ? (points as Array<{ x: number; y: number }>)
    : undefined;
};

/** layout のキーごとの値の読み方 */
const LAYOUT_FIELD_READERS: Record<
  string,
  (reader: DataReader, field: unknown, at: string) => MapLayoutEntry
> = {
  align: (reader, field, at) => ({ align: readText(reader, field, at) }),
  color: (reader, field, at) => ({ color: readText(reader, field, at) }),
  line: (reader, field, at) => ({ line: readText(reader, field, at) }),
  order: (reader, field, at) => ({ order: readNumber(reader, field, at) }),
  width: (reader, field, at) => ({ width: readNumber(reader, field, at) }),
  justify: (reader, field, at) => ({
    justify: readChoice(reader, field, { path: at, choices: JUSTIFIES }),
  }),
  pos: (reader, field, at) => ({ pos: readPoint(reader, field, at) }),
  packet: (reader, field, at) => ({ packet: readPacket(reader, field, at) }),
  ends: (reader, field, at) => ({ ends: readEnds(reader, field, at) }),
  via: (reader, field, at) => ({ via: readVia(reader, field, at) }),
  collapsed: (reader, field, at) => {
    if (typeof field === "boolean") return { collapsed: field };
    invalid(reader, at, "真偽値");
    return {};
  },
};

/** layout の ID ごとの上書き（読めない値のキーは持たない） */
const readLayoutEntry = (
  reader: DataReader,
  value: Record<string, unknown>,
  path: string,
): MapLayoutEntry => {
  const entry: MapLayoutEntry = {};
  for (const [name, field] of Object.entries(value)) {
    if (Object.hasOwn(LAYOUT_FIELD_READERS, name)) {
      const read = LAYOUT_FIELD_READERS[
        name
      ] as (typeof LAYOUT_FIELD_READERS)[string];
      Object.assign(entry, read(reader, field, `${path}.${name}`));
    } else unknownKey(reader, { path, key: name, keys: LAYOUT_KEYS });
  }
  for (const key of Object.keys(entry) as Array<keyof MapLayoutEntry>)
    if (entry[key] === undefined) delete entry[key];
  return entry;
};

/** 手順のキー 1 つを読んで `out` に入れる。本文が読めなければ `false` を返却する */
const applyStepField = (
  reader: DataReader,
  out: MapStep,
  item: { name: string; field: unknown; path: string },
): boolean => {
  const { name, field, path } = item;
  if (name === "title") out.title = readText(reader, field, `${path}.title`);
  else if (name === "text") {
    const body = readText(reader, field, `${path}.text`);
    if (body === undefined) return false;
    out.text = body;
  } else if (name === "nodes")
    out.nodes = readIds(reader, field, `${path}.nodes`) ?? [];
  else if (name === "edges")
    out.edges = readIds(reader, field, `${path}.edges`);
  else if (name === "enter")
    out.enter = readText(reader, field, `${path}.enter`);
  else unknownKey(reader, { path, key: name, keys: STEP_KEYS });
  return true;
};

/** 案内の 1 手順（本文が読めなければ `undefined`） */
const readStep = (
  reader: DataReader,
  value: unknown,
  path: string,
): MapStep | undefined => {
  if (!isObject(value)) {
    invalid(reader, path, " JSON のオブジェクト ");
    return undefined;
  }
  const out: MapStep = {
    title: undefined,
    text: "",
    nodes: [],
    edges: undefined,
    enter: undefined,
  };
  let ok = true;
  for (const [name, field] of Object.entries(value)) {
    if (!applyStepField(reader, out, { name, field, path })) ok = false;
  }
  return ok ? out : undefined;
};

/** 説明か注記の ID の並びの、少なくとも一方を持つ notes の 1 件（読めなければ `undefined`） */
const readNote = (
  reader: DataReader,
  note: unknown,
  path: string,
): MapNote | undefined => {
  if (!isObject(note)) {
    invalid(reader, path, ' `{"text": 説明の文}` ');
    return undefined;
  }
  if (note.text === undefined && note.annotations === undefined) {
    invalid(
      reader,
      path,
      ' `{"text": 説明の文}` か `{"annotations": [注記の ID]}` ',
    );
    return undefined;
  }
  const parsed: MapNote = {};
  if (note.text !== undefined) {
    const body = readText(reader, note.text, `${path}.text`);
    if (body === undefined) return undefined;
    parsed.text = body;
  }
  if (note.annotations === undefined) return parsed;
  const ids = note.annotations;
  if (!Array.isArray(ids) || !ids.every((item) => typeof item === "string")) {
    invalid(reader, `${path}.annotations`, " 注記の ID の配列 ");
    return undefined;
  }
  parsed.annotations = ids;
  return parsed;
};

/** notes を読んで `data` に入れる */
const readNotes = (reader: DataReader, value: unknown, data: MapData): void => {
  if (!isObject(value)) {
    invalid(reader, "notes", ' ID ごとの `{"text"}` ');
    return;
  }
  for (const [id, note] of Object.entries(value)) {
    const parsed = readNote(reader, note, `notes.${id}`);
    if (parsed !== undefined) data.notes[id] = parsed;
  }
};

/** walkthroughs を読んで `data` に入れる */
const readWalkthroughs = (
  reader: DataReader,
  value: unknown,
  data: MapData,
): void => {
  if (!Array.isArray(value)) {
    invalid(reader, "walkthroughs", "手順の配列");
    return;
  }
  for (const [i, item] of value.entries()) {
    const parsed = readStep(reader, item, `walkthroughs[${i}]`);
    if (parsed) data.walkthroughs.push(parsed);
  }
};

/** layout を読んで `data` に入れる */
const readLayout = (
  reader: DataReader,
  value: unknown,
  data: MapData,
): void => {
  if (!isObject(value)) {
    invalid(reader, "layout", " ID ごとの上書き ");
    return;
  }
  for (const [id, entry] of Object.entries(value)) {
    const path = `layout.${id}`;
    if (isObject(entry)) data.layout[id] = readLayoutEntry(reader, entry, path);
    else invalid(reader, path, " JSON のオブジェクト ");
  }
};

/** 分類の 1 件のキー（知らないキーは項目にする） */
const readGroupFields = (
  reader: DataReader,
  group: Record<string, unknown>,
  path: string,
): Partial<MapGroup> => {
  const out: Partial<MapGroup> = {};
  for (const [name, field] of Object.entries(group)) {
    if (name === "title") out.title = readText(reader, field, `${path}.title`);
    else if (name === "tables")
      out.tables = readIds(reader, field, `${path}.tables`);
    else if (name === "parent")
      out.parent = readText(reader, field, `${path}.parent`);
    else unknownKey(reader, { path, key: name, keys: GROUP_KEYS });
  }
  return out;
};

/** 分類の 1 件（名前とテーブルが読めなければ `undefined`） */
const readGroup = (
  reader: DataReader,
  group: unknown,
  path: string,
): MapGroup | undefined => {
  if (!isObject(group)) {
    invalid(reader, path, ' `{"title", "tables"}` ');
    return undefined;
  }
  const { title, tables, parent } = readGroupFields(reader, group, path);
  if (title === undefined && group.title === undefined)
    invalid(reader, `${path}.title`, "文字");
  if (tables === undefined && group.tables === undefined)
    invalid(reader, `${path}.tables`, "テーブル名の配列");
  if (title === undefined || tables === undefined) return undefined;
  return { title, tables, parent };
};

/** groups を読んで `data` に入れる */
const readGroups = (
  reader: DataReader,
  value: unknown,
  data: MapData,
): void => {
  if (!isObject(value)) {
    invalid(reader, "groups", ' 分類の ID ごとの `{"title", "tables"}` ');
    return;
  }
  for (const [id, group] of Object.entries(value)) {
    const parsed = readGroup(reader, group, `groups.${id}`);
    if (parsed !== undefined) data.groups[id] = parsed;
  }
};

/** トップレベルのキー 1 つを読んで `data` に入れる */
const readRootKey = (
  reader: DataReader,
  data: MapData,
  item: { key: string; value: unknown },
): void => {
  const { key, value } = item;
  switch (key) {
    case "version":
      if (value !== 1) invalid(reader, "version", " `1` ");
      return;
    case "notes":
      return readNotes(reader, value, data);
    case "walkthroughs":
      return readWalkthroughs(reader, value, data);
    case "layout":
      return readLayout(reader, value, data);
    case "plays_over": {
      const target = readNumber(reader, value, "plays_over");
      if (target !== undefined) data.plays_over = target;
      return;
    }
    case "groups":
      return readGroups(reader, value, data);
    default:
      unknownKey(reader, { path: "", key, keys: MAP_DATA_KEYS });
  }
};

/** 補足の JSON のオブジェクトを読み込み、スキーマに合う部分を MapData にし、合わない箇所を項目にする（line は補足の中の 0 からの行。lines はパスごとの行） */
export const parseMapData = (
  source: string | undefined,
): { data: MapData; problems: MapProblem[]; lines: Map<string, number> } => {
  const data = emptyMapData();
  const problems: MapProblem[] = [];
  if (source === undefined || source.trim() === "")
    return { data, problems, lines: new Map() };
  let root: unknown;
  try {
    root = JSON.parse(source);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    problems.push({
      kind: "map_invalid_value",
      line: errorLine(source, error),
      message: `補足を JSON のオブジェクトとして読めません（${reason}）。\`<!-- map-data: {"version": 1} -->\` のように JSON のオブジェクトで記載してください。`,
    });
    return { data, problems, lines: new Map() };
  }
  if (!isObject(root)) {
    problems.push({
      kind: "map_invalid_value",
      line: 0,
      message:
        '補足は JSON のオブジェクト（`{"version": 1}` など）で記載してください。',
    });
    return { data, problems, lines: new Map() };
  }
  const lines = jsonPathLines(source);
  const reader: DataReader = { problems, lines };
  for (const [key, value] of Object.entries(root))
    readRootKey(reader, data, { key, value });
  return { data, problems, lines };
};
