import {
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node as YamlNode,
} from "yaml";
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

/** ID ごとの配置と見た目の上書き */
export type MapLayoutEntry = {
  align?: string | undefined;
  order?: number | undefined;
  pos?: { x: number; y: number } | undefined;
  width?: number | undefined;
  color?: string | undefined;
  line?: string | undefined;
  packet?: MapPacket | undefined;
};

/** 補足 */
export type MapData = {
  version: 1;
  notes: Record<string, string>;
  walkthroughs: MapStep[];
  layout: Record<string, MapLayoutEntry>;
  plays_over: number | undefined;
};

/** 補足のトップレベルのキー */
export const MAP_DATA_KEYS = [
  "version",
  "notes",
  "walkthroughs",
  "layout",
  "plays_over",
] as const;
const STEP_KEYS = ["title", "text", "nodes", "edges", "enter"];
const LAYOUT_KEYS = [
  "align",
  "order",
  "pos",
  "width",
  "color",
  "line",
  "packet",
];
const PACKET_SHAPES = ["circle", "square", "diamond"];

/** 空の補足 */
export const emptyMapData = (): MapData => ({
  version: 1,
  notes: {},
  walkthroughs: [],
  layout: {},
  plays_over: undefined,
});

/** 補足の YAML を読み込み、スキーマに合う部分を MapData にし、合わない箇所を項目にする（line は補足の中の 0 からの行） */
export const parseMapData = (
  source: string | undefined,
): { data: MapData; problems: MapProblem[] } => {
  const data = emptyMapData();
  const problems: MapProblem[] = [];
  if (source === undefined || source.trim() === "") return { data, problems };
  const counter = new LineCounter();
  const doc = parseDocument(source, {
    lineCounter: counter,
    prettyErrors: false,
  });
  const lineOf = (node: YamlNode | null | undefined): number | undefined => {
    const offset = node?.range?.[0];
    return offset === undefined ? undefined : counter.linePos(offset).line - 1;
  };
  const error = doc.errors[0];
  if (error) {
    const line = error.linePos?.[0]?.line;
    problems.push({
      kind: "map_invalid_value",
      line: line === undefined ? undefined : line - 1,
      message: `補足を YAML として読めません（${error.message.split("\n")[0]}）。`,
    });
    return { data, problems };
  }
  const root = doc.contents;
  if (!isMap(root)) {
    problems.push({
      kind: "map_invalid_value",
      line: lineOf(root),
      message: "補足はキーと値の YAML で記載してください。",
    });
    return { data, problems };
  }
  const invalid = (
    node: YamlNode | null | undefined,
    path: string,
    expected: string,
  ) =>
    problems.push({
      kind: "map_invalid_value",
      line: lineOf(node),
      message: `補足の \`${path}\` は${expected}で記載してください。`,
    });
  const unknown = (
    node: YamlNode | null | undefined,
    path: string,
    key: string,
    keys: readonly string[],
  ) =>
    problems.push({
      kind: "map_unknown_key",
      line: lineOf(node),
      message: `補足${path === "" ? "" : `の \`${path}\``}に知らないキー \`${key}\` があります。使用できるキーは ${keys.map((name) => `\`${name}\``).join("・")} です。`,
    });
  /** 文字の値。`--` を含めば項目にする */
  const text = (
    node: YamlNode | null | undefined,
    path: string,
  ): string | undefined => {
    if (!isScalar(node) || typeof node.value !== "string") {
      invalid(node, path, "文字");
      return undefined;
    }
    if (node.value.includes("--")) {
      problems.push({
        kind: "map_invalid_value",
        line: lineOf(node),
        message: `補足の \`${path}\` に \`--\` があります。HTML コメントを閉じてしまうため、\`--\` を含めずに記載してください。`,
      });
      return undefined;
    }
    return node.value;
  };
  const ids = (
    node: YamlNode | null | undefined,
    path: string,
  ): string[] | undefined => {
    if (!isSeq(node)) {
      invalid(node, path, "ID の配列");
      return undefined;
    }
    const out: string[] = [];
    node.items.forEach((item, i) => {
      const value = text(item as YamlNode, `${path}[${i}]`);
      if (value !== undefined) out.push(value);
    });
    return out;
  };
  const number = (
    node: YamlNode | null | undefined,
    path: string,
  ): number | undefined => {
    if (
      isScalar(node) &&
      typeof node.value === "number" &&
      Number.isFinite(node.value)
    )
      return node.value;
    invalid(node, path, "数");
    return undefined;
  };
  for (const pair of root.items) {
    const key = isScalar(pair.key) ? String(pair.key.value) : "";
    const value = pair.value as YamlNode | null;
    switch (key) {
      case "version":
        if (!isScalar(value) || value.value !== 1)
          invalid(value, "version", " `1` ");
        break;
      case "notes":
        if (!isMap(value)) {
          invalid(value, "notes", "ID ごとの文字");
          break;
        }
        for (const item of value.items) {
          const id = isScalar(item.key) ? String(item.key.value) : "";
          const note = text(item.value as YamlNode, `notes.${id}`);
          if (note !== undefined) data.notes[id] = note;
        }
        break;
      case "walkthroughs":
        if (!isSeq(value)) {
          invalid(value, "walkthroughs", "手順の配列");
          break;
        }
        value.items.forEach((item, i) => {
          const path = `walkthroughs[${i}]`;
          if (!isMap(item)) {
            invalid(item as YamlNode, path, "キーと値");
            return;
          }
          const step: MapStep = {
            title: undefined,
            text: "",
            nodes: [],
            edges: undefined,
            enter: undefined,
          };
          let ok = true;
          for (const field of item.items) {
            const name = isScalar(field.key) ? String(field.key.value) : "";
            const node = field.value as YamlNode;
            if (name === "title") step.title = text(node, `${path}.title`);
            else if (name === "text") {
              const value = text(node, `${path}.text`);
              if (value === undefined) ok = false;
              else step.text = value;
            } else if (name === "nodes")
              step.nodes = ids(node, `${path}.nodes`) ?? [];
            else if (name === "edges") step.edges = ids(node, `${path}.edges`);
            else if (name === "enter") step.enter = text(node, `${path}.enter`);
            else unknown(field.key as YamlNode, path, name, STEP_KEYS);
          }
          if (ok) data.walkthroughs.push(step);
        });
        break;
      case "layout":
        if (!isMap(value)) {
          invalid(value, "layout", "ID ごとの上書き");
          break;
        }
        for (const item of value.items) {
          const id = isScalar(item.key) ? String(item.key.value) : "";
          const path = `layout.${id}`;
          if (!isMap(item.value)) {
            invalid(item.value as YamlNode, path, "キーと値");
            continue;
          }
          const entry: MapLayoutEntry = {};
          for (const field of item.value.items) {
            const name = isScalar(field.key) ? String(field.key.value) : "";
            const node = field.value as YamlNode;
            const at = `${path}.${name}`;
            if (name === "align" || name === "color" || name === "line")
              entry[name] = text(node, at);
            else if (name === "order" || name === "width")
              entry[name] = number(node, at);
            else if (name === "pos") {
              if (isMap(node)) {
                const x = number(node.get("x", true) as YamlNode, `${at}.x`);
                const y = number(node.get("y", true) as YamlNode, `${at}.y`);
                if (x !== undefined && y !== undefined) entry.pos = { x, y };
              } else invalid(node, at, " `{x, y}` ");
            } else if (name === "packet") {
              if (isMap(node)) {
                const color = node.get("color", true) as YamlNode | undefined;
                const shape = node.get("shape", true) as YamlNode | undefined;
                const packet: MapPacket = {};
                if (color !== undefined)
                  packet.color = text(color, `${at}.color`);
                if (shape !== undefined) {
                  const value = text(shape, `${at}.shape`);
                  if (value !== undefined && PACKET_SHAPES.includes(value))
                    packet.shape = value as MapPacket["shape"];
                  else if (value !== undefined)
                    invalid(
                      shape,
                      `${at}.shape`,
                      " `circle`・`square`・`diamond` ",
                    );
                }
                entry.packet = packet;
              } else invalid(node, at, " `{color, shape}` ");
            } else unknown(field.key as YamlNode, path, name, LAYOUT_KEYS);
          }
          data.layout[id] = entry;
        }
        break;
      case "plays_over": {
        const value2 = number(value, "plays_over");
        if (value2 !== undefined) data.plays_over = value2;
        break;
      }
      default:
        unknown(pair.key as YamlNode, "", key, MAP_DATA_KEYS);
    }
  }
  return { data, problems };
};
