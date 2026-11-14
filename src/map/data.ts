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

/** ノード・線の説明 */
export type MapNote = { text: string };

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
  const value = (path: string): void => {
    skip();
    const char = source[at];
    if (char === "{" || char === "[") {
      const close = char === "{" ? "}" : "]";
      at += 1;
      skip();
      let index = 0;
      while (at < source.length && source[at] !== close) {
        let child: string;
        if (char === "{") {
          const keyLine = line;
          const key = readString();
          child = path === "" ? key : `${path}.${key}`;
          lines.set(child, keyLine);
          skip();
          at += 1;
        } else {
          child = `${path}[${index}]`;
          lines.set(child, line);
          index += 1;
        }
        value(child);
        skip();
        if (source[at] === ",") at += 1;
        skip();
      }
      at += 1;
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
  const invalid = (path: string, expected: string) =>
    problems.push({
      kind: "map_invalid_value",
      line: lines.get(path),
      message: `補足の \`${path}\` は${expected}で記載してください。`,
    });
  const unknown = (path: string, key: string, keys: readonly string[]) =>
    problems.push({
      kind: "map_unknown_key",
      line: lines.get(path === "" ? key : `${path}.${key}`),
      message: `補足${path === "" ? "" : `の \`${path}\``}に知らないキー \`${key}\` があります。使用できるキーは ${keys.map((name) => `\`${name}\``).join("・")} です。`,
    });
  /** 文字の値。`--` を含めば項目にする */
  const text = (value: unknown, path: string): string | undefined => {
    if (typeof value !== "string") {
      invalid(path, "文字");
      return undefined;
    }
    if (value.includes("--")) {
      problems.push({
        kind: "map_invalid_value",
        line: lines.get(path),
        message: `補足の \`${path}\` に \`--\` があります。HTML コメントを閉じてしまうため、\`--\` を含めずに記載してください。`,
      });
      return undefined;
    }
    return value;
  };
  const ids = (value: unknown, path: string): string[] | undefined => {
    if (!Array.isArray(value)) {
      invalid(path, "ID の配列");
      return undefined;
    }
    const out: string[] = [];
    for (const [i, item] of value.entries()) {
      const id = text(item, `${path}[${i}]`);
      if (id !== undefined) out.push(id);
    }
    return out;
  };
  const number = (value: unknown, path: string): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    invalid(path, "数");
    return undefined;
  };
  const point = (
    value: unknown,
    path: string,
  ): { x: number; y: number } | undefined => {
    if (!isObject(value)) {
      invalid(path, ' `{"x", "y"}` ');
      return undefined;
    }
    const x = number(value.x, `${path}.x`);
    const y = number(value.y, `${path}.y`);
    return x === undefined || y === undefined ? undefined : { x, y };
  };
  const choice = <T extends string>(
    value: unknown,
    path: string,
    choices: readonly string[],
  ): T | undefined => {
    if (typeof value === "string" && choices.includes(value)) return value as T;
    invalid(path, ` ${choices.map((name) => `\`${name}\``).join("・")} `);
    return undefined;
  };
  const ends = (
    value: unknown,
    path: string,
  ): MapLayoutEntry["ends"] | undefined => {
    if (!isObject(value)) {
      invalid(path, ' `{"from": {"side"}, "to": {"side"}}` ');
      return undefined;
    }
    const out: { from?: MapSide; to?: MapSide } = {};
    for (const end of ["from", "to"] as const) {
      const item = value[end];
      if (item === undefined) continue;
      if (!isObject(item)) {
        invalid(`${path}.${end}`, ' `{"side"}` ');
        return undefined;
      }
      const side = choice<MapSide>(item.side, `${path}.${end}.side`, SIDES);
      if (side === undefined) return undefined;
      out[end] = side;
    }
    return out;
  };
  const packet = (value: unknown, path: string): MapPacket | undefined => {
    if (!isObject(value)) {
      invalid(path, ' `{"color", "shape"}` ');
      return undefined;
    }
    const out: MapPacket = {};
    if (value.color !== undefined)
      out.color = text(value.color, `${path}.color`);
    if (value.shape !== undefined)
      out.shape = choice(value.shape, `${path}.shape`, PACKET_SHAPES);
    return out;
  };
  const via = (
    value: unknown,
    path: string,
  ): Array<{ x: number; y: number }> | undefined => {
    if (!Array.isArray(value)) {
      invalid(path, ' `[{"x", "y"}]` ');
      return undefined;
    }
    const points = value.map((item, i) => point(item, `${path}[${i}]`));
    return points.every((item) => item !== undefined)
      ? (points as Array<{ x: number; y: number }>)
      : undefined;
  };
  const layoutEntry = (
    value: Record<string, unknown>,
    path: string,
  ): MapLayoutEntry => {
    const entry: MapLayoutEntry = {};
    for (const [name, field] of Object.entries(value)) {
      const at = `${path}.${name}`;
      if (name === "align" || name === "color" || name === "line")
        entry[name] = text(field, at);
      else if (name === "order" || name === "width")
        entry[name] = number(field, at);
      else if (name === "justify") entry.justify = choice(field, at, JUSTIFIES);
      else if (name === "pos") entry.pos = point(field, at);
      else if (name === "packet") entry.packet = packet(field, at);
      else if (name === "ends") entry.ends = ends(field, at);
      else if (name === "via") entry.via = via(field, at);
      else if (name === "collapsed") {
        if (typeof field === "boolean") entry.collapsed = field;
        else invalid(at, "真偽値");
      } else unknown(path, name, LAYOUT_KEYS);
    }
    for (const key of Object.keys(entry) as Array<keyof MapLayoutEntry>)
      if (entry[key] === undefined) delete entry[key];
    return entry;
  };
  const step = (value: unknown, path: string): MapStep | undefined => {
    if (!isObject(value)) {
      invalid(path, " JSON のオブジェクト ");
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
      if (name === "title") out.title = text(field, `${path}.title`);
      else if (name === "text") {
        const body = text(field, `${path}.text`);
        if (body === undefined) ok = false;
        else out.text = body;
      } else if (name === "nodes")
        out.nodes = ids(field, `${path}.nodes`) ?? [];
      else if (name === "edges") out.edges = ids(field, `${path}.edges`);
      else if (name === "enter") out.enter = text(field, `${path}.enter`);
      else unknown(path, name, STEP_KEYS);
    }
    return ok ? out : undefined;
  };
  for (const [key, value] of Object.entries(root)) {
    switch (key) {
      case "version":
        if (value !== 1) invalid("version", " `1` ");
        break;
      case "notes":
        if (!isObject(value)) {
          invalid("notes", ' ID ごとの `{"text"}` ');
          break;
        }
        for (const [id, note] of Object.entries(value)) {
          const path = `notes.${id}`;
          if (!isObject(note)) {
            invalid(path, ' `{"text": 説明の文}` ');
            continue;
          }
          const body = text(note.text, `${path}.text`);
          if (body !== undefined) data.notes[id] = { text: body };
        }
        break;
      case "walkthroughs":
        if (!Array.isArray(value)) {
          invalid("walkthroughs", "手順の配列");
          break;
        }
        for (const [i, item] of value.entries()) {
          const parsed = step(item, `walkthroughs[${i}]`);
          if (parsed) data.walkthroughs.push(parsed);
        }
        break;
      case "layout":
        if (!isObject(value)) {
          invalid("layout", " ID ごとの上書き ");
          break;
        }
        for (const [id, entry] of Object.entries(value)) {
          const path = `layout.${id}`;
          if (isObject(entry)) data.layout[id] = layoutEntry(entry, path);
          else invalid(path, " JSON のオブジェクト ");
        }
        break;
      case "plays_over": {
        const target = number(value, "plays_over");
        if (target !== undefined) data.plays_over = target;
        break;
      }
      case "groups":
        if (!isObject(value)) {
          invalid("groups", ' 分類の ID ごとの `{"title", "tables"}` ');
          break;
        }
        for (const [id, group] of Object.entries(value)) {
          const path = `groups.${id}`;
          if (!isObject(group)) {
            invalid(path, ' `{"title", "tables"}` ');
            continue;
          }
          let title: string | undefined;
          let tables: string[] | undefined;
          let parent: string | undefined;
          for (const [name, field] of Object.entries(group)) {
            if (name === "title") title = text(field, `${path}.title`);
            else if (name === "tables") tables = ids(field, `${path}.tables`);
            else if (name === "parent") parent = text(field, `${path}.parent`);
            else unknown(path, name, GROUP_KEYS);
          }
          if (title === undefined && group.title === undefined)
            invalid(`${path}.title`, "文字");
          if (tables === undefined && group.tables === undefined)
            invalid(`${path}.tables`, "テーブル名の配列");
          if (title !== undefined && tables !== undefined)
            data.groups[id] = { title, tables, parent };
        }
        break;
      default:
        unknown("", key, MAP_DATA_KEYS);
    }
  }
  return { data, problems, lines };
};
