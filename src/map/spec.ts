/** map の書き方の誤りの項目の種類（点検のずれの種類と同じ名前） */
export type MapProblemKind =
  | "map_invalid"
  | "map_unknown_ref"
  | "map_unknown_key"
  | "map_invalid_value"
  | "map_unknown_icon"
  | "map_unknown_class"
  | "map_unknown_line"
  | "annotation_undefined";

/** 読み取りと点検が返す、書き方の誤り 1 件 */
export type MapProblem = {
  kind: MapProblemKind;
  /** 範囲の中の行（読み取ったソースの 0 から）。範囲の全体を指すときは無い */
  line?: number | undefined;
  /** 書き方の警告と点検の内容に出す 1 文（直し方を含む） */
  message: string;
};

/** ノードの形状 */
export type MapShape = "rounded" | "rect" | "pill" | "double";

/** 設定の map.kinds の 1 つの値 */
export type MapKind = {
  label?: string | undefined;
  icon?: string | undefined;
  shape?: MapShape | undefined;
  color?: string | undefined;
};

/** 設定の map.lines の 1 つの値 */
export type MapLine = {
  dash?: "solid" | "dashed" | "dotted" | "dash-dot" | "long-dash" | undefined;
  width?: "thin" | "normal" | "thick" | undefined;
  head?: "filled" | "open" | "none" | undefined;
  color?: string | undefined;
};

/** 既定を当てた設定の map */
export type ResolvedMapConfig = {
  node_fit: "height" | "width";
  url_state: boolean;
  kinds: Record<string, MapKind>;
  lines: Record<string, MapLine>;
};

/** マーカーの引数（A-128 の構成の JSON のオブジェクト） */
export type MapArgs = {
  title?: string | undefined;
  focus?: string | undefined;
  play?: "autoplay" | undefined;
  interval: number;
  collapse?: { open: boolean; title: string | undefined } | undefined;
};

/** マーカーの JSON のオブジェクトで読むキー */
export const MAP_ARG_KEYS = [
  "title",
  "focus",
  "play",
  "interval",
  "collapse",
] as const;

/** マーカーに interval が無いか型が合わないときの、自動で進める間隔（秒） */
export const DEFAULT_MAP_INTERVAL = 2;

/** 値の型が合わないときの項目 */
const invalidArg = (key: string, expected: string): MapProblem => ({
  kind: "map_invalid_value",
  message: `マーカーの引数 \`${key}\` は${expected}で記載してください。既定の値で描いています。`,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** JSON を読む（読めなければ `undefined`） */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/** マーカーの引数のキー 1 つの読み方。読めたら `args` に入れて `true` を返却する */
type MapArgReader = {
  /** 読めないときの項目に出す、記載できる値 */
  expected: string;
  read: (item: unknown, args: MapArgs) => boolean;
};

/** 空でない文字か */
const isNonEmptyText = (item: unknown): item is string =>
  typeof item === "string" && item !== "";

/** `collapse` の引数の構造か */
const isCollapseArg = (
  item: unknown,
): item is { open?: boolean; title?: string } =>
  isRecord(item) &&
  (item.open === undefined || typeof item.open === "boolean") &&
  (item.title === undefined || typeof item.title === "string");

/** キーごとのマーカーの引数の読み方 */
const MAP_ARG_READERS = {
  title: {
    expected: "空でない文字",
    read: (item, args) => {
      if (!isNonEmptyText(item)) return false;
      args.title = item;
      return true;
    },
  },
  focus: {
    expected: "空でない文字",
    read: (item, args) => {
      if (!isNonEmptyText(item)) return false;
      args.focus = item;
      return true;
    },
  },
  play: {
    expected: ' `"autoplay"` ',
    read: (item, args) => {
      if (item !== "autoplay") return false;
      args.play = "autoplay";
      return true;
    },
  },
  interval: {
    expected: "正の数（秒）",
    read: (item, args) => {
      if (typeof item !== "number" || !Number.isFinite(item) || item <= 0)
        return false;
      args.interval = item;
      return true;
    },
  },
  collapse: {
    expected: ' `{"open": false, "title": "見出し"}` の構造',
    read: (item, args) => {
      if (!isCollapseArg(item)) return false;
      args.collapse = {
        open: item.open === true,
        title: typeof item.title === "string" ? item.title : undefined,
      };
      return true;
    },
  },
} satisfies Record<string, MapArgReader>;

/** マーカーの引数の文字を JSON のオブジェクトとして読み、知っているキーだけを MapArgs にする */
export const parseMapArgs = (
  source: string,
): {
  args: MapArgs;
  normalized: string;
  problems: MapProblem[];
  unknownKeys: string[];
} => {
  const args: MapArgs = { interval: DEFAULT_MAP_INTERVAL };
  const problems: MapProblem[] = [];
  const unknownKeys: string[] = [];
  const known: Record<string, unknown> = {};
  const text = source.trim();
  if (text === "") {
    return { args, normalized: "{}", problems, unknownKeys };
  }
  const value = parseJson(text);
  if (!isRecord(value)) {
    problems.push({
      kind: "map_invalid_value",
      message: `マーカーの引数 \`${text}\` を JSON のオブジェクトとして読めません。\`{"title": "全体の構成"}\` のように、キーと文字を二重引用符で囲んで記載してください。`,
    });
    return { args, normalized: "{}", problems, unknownKeys };
  }
  for (const [key, item] of Object.entries(value)) {
    if (!Object.hasOwn(MAP_ARG_READERS, key)) {
      unknownKeys.push(key);
      continue;
    }
    const reader = MAP_ARG_READERS[key as keyof typeof MAP_ARG_READERS];
    if (reader.read(item, args)) known[key] = item;
    else problems.push(invalidArg(key, reader.expected));
  }
  return { args, normalized: JSON.stringify(known), problems, unknownKeys };
};
