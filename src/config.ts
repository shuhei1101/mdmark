import type { MapKind, MapLine, ResolvedMapConfig } from "./map/spec.ts";
import { DEFAULT_LONG_COLUMN_MIN_EM } from "./table-logic.ts";

/** 利用側が `opts.config` に指定する設定。他のキーを持っていても読み込まない */
export type MdmarkConfig = {
  /** 機能のオン・オフの既定 */
  features?: Record<string, boolean>;
  /** マーカーの名前からモジュールの URL を参照する対応表 */
  libraries?: Record<string, string>;
  /** ツールチップの設定。`placement` は本文の用語などのツールチップ、`diagramPlacement` は図・ヒント・グラフの項目のツールチップを、持ち主の上と下のどちらに先に出すか（`top` / `bottom`）。知らない値も受けて `resolveConfig` が既定にするため、型は `string` */
  tooltips?: { placement?: string; diagramPlacement?: string };
  /** 色分けのライブラリの設定。`url` は highlight.js の `es/` フォルダの URL（末尾 `/`） */
  syntax?: { url?: string };
  /** 文書が指すファイルの探し方（CLI と VS Code 拡張機能だけが読み込む） */
  assets?: { root?: string };
  /** 右側の目次の設定。`mode` は出し方（`hover` / `fixed`）。知らない値も受けて `resolveConfig` が `hover` にするため、型は `string` */
  "side-toc"?: { mode?: string };
  /** 表の設定。`pin` はピン止めの動き（`each` / `through`）。知らない値も受けて `resolveConfig` が `each` にするため、型は `string` */
  table?: { pin?: string; long_column_min?: unknown };
  /** 配色のテーマの名前（`COLOR_THEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_THEME` にするため、型は `string` */
  colorTheme?: string;
  /** 配色の明暗（`COLOR_SCHEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_SCHEME` にするため、型は `string` */
  colorScheme?: string;
  /** 部品の文言の設定。`paramCopy` は操作できる部品の今の値をコピーするボタンの文言。空文字も受けて `resolveConfig` が `DEFAULT_LABELS.paramCopy` にする */
  labels?: { paramCopy?: string };
  /** 範囲のスクリプトの設定。`url` は範囲の `ts`・`js` を変換する @babel/standalone の ES モジュールの URL */
  "html-scripts"?: { url?: string };
  /** mermaid の設定。`url` は mermaid の ES モジュールの URL、`theme` はテーマの名前（知らない値も受けて `resolveConfig` が `mdmark` にするため、型は `string`）、`themeVariables` はテーマの変数の上書き */
  mermaid?: {
    url?: string;
    theme?: string;
    themeVariables?: Record<string, unknown>;
  };
  /** map の図の設定。`node_fit` は名前の長いノードの広げ方、`url_state` は状態をクエリ文字列に保つか、`kinds` はクラス名ごとのノードの種類、`lines` は矢印と名前ごとの線の種類。知らない値も受けて `resolveConfig` が既定にする */
  map?: {
    node_fit?: string;
    url_state?: unknown;
    kinds?: Record<string, MapKind>;
    lines?: Record<string, MapLine>;
  };
};

/** mermaid の図のテーマの名前。`mdmark` は描く先の要素の CSS 変数から作る mdmark の外観のテーマ、ほかは mermaid のテーマの名前 */
export type MermaidTheme =
  | "mdmark"
  | "default"
  | "neutral"
  | "dark"
  | "forest"
  | "base";

/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";

/** 右側の目次の出し方。`hover` は右端の線を出し、指すかフォーカスで目次を重ねて出す。`fixed` は目次を出すボタンでサイドバーを開閉する */
export type SideTocMode = "hover" | "fixed";

/** 表のピン止めの動き。`each` は押した列だけを留め、留めた列より左を表示している間は右端に、過ぎた後は左端に留める。`through` は押した列までを左端に留める */
export type TablePinMode = "each" | "through";

/** mdmark に入れた配色のテーマの名前 */
export type ColorTheme =
  | "dev-swiss"
  | "theme-paper"
  | "theme-slate"
  | "theme-contrast";

/** 描いた文書の配色の明暗。`light`・`dark` は描く先の要素の class で祖先の class と OS の設定に勝たせ、`auto` は class を付けずに任せる */
export type ColorScheme = "light" | "dark" | "auto";

/** 文書の page のマーカーから読み込んだ、設定より優先する値。記載しなかったキーは持たない */
export type PageSettings = {
  /** `scheme=` の値 */
  scheme?: ColorScheme;
  /** `theme=` の値 */
  theme?: ColorTheme;
  /** `toc=` の値 */
  toc?: SideTocMode;
};

/** 対応表の行: マーカー 1 つのモジュールの URL と、図のマーカーか */
export type LibraryEntry = {
  /** モジュールの URL */
  url: string;
  /** 図のマーカーか。通知ブロックのタイトルを分ける */
  figure: boolean;
};

/** 全てのキーに値を持つ、内部で使用する設定 */
export type ResolvedConfig = {
  /** 機能のオン・オフ（キーはこのバージョンが知っている機能だけ） */
  features: Record<string, boolean>;
  /** 既定の対応表に設定の `libraries` を重ねたもの */
  libraries: Record<string, LibraryEntry>;
  /** `placement` は設定の `tooltips.placement` が `bottom` のときだけ `bottom`、それ以外は `top`。`diagramPlacement` は設定の `tooltips.diagramPlacement` が `top` のときだけ `top`、それ以外は `bottom` */
  tooltips: { placement: TooltipPlacement; diagramPlacement: TooltipPlacement };
  /** 設定の `syntax.url` が文字列ならその値、それ以外は `DEFAULT_SYNTAX_URL` */
  syntax: { url: string };
  /** 設定の `side-toc.mode` が `fixed` のときだけ `fixed`、それ以外は `hover` */
  sideToc: { mode: SideTocMode };
  /** `pin` は設定の `table.pin` が `through` のときだけ `through`、それ以外は `each`。`longColumnMin` は設定の `table.long_column_min` が 0 より大きい有限の数ならその値、それ以外は `DEFAULT_LONG_COLUMN_MIN_EM` */
  table: { pin: TablePinMode; longColumnMin: number };
  /** 設定の `colorTheme` が `COLOR_THEMES` にあればその値、それ以外は `DEFAULT_COLOR_THEME` */
  colorTheme: ColorTheme;
  /** 設定の `colorScheme` が `COLOR_SCHEMES` にあればその値、それ以外は `DEFAULT_COLOR_SCHEME` */
  colorScheme: ColorScheme;
  /** 設定の `labels.paramCopy` が空でない文字列ならその値、それ以外は `DEFAULT_LABELS.paramCopy` */
  labels: { paramCopy: string };
  /** 範囲のスクリプトの変換のライブラリの URL（既定 `DEFAULT_HTML_SCRIPTS_URL`） */
  htmlScripts: { url: string };
  /** mermaid の読み込み先・テーマ・値が文字列のテーマの変数の上書き */
  mermaid: {
    url: string;
    theme: MermaidTheme;
    themeVariables: Record<string, string>;
  };
  /** `resolveMapConfig` で既定を当てた設定の `map` */
  map: ResolvedMapConfig;
};

/** mdmark に入れた配色のテーマの名前の並び。`resolveConfig`・CLI の点検と書き出しの警告が照らす */
export const COLOR_THEMES: readonly ColorTheme[] = [
  "dev-swiss",
  "theme-paper",
  "theme-slate",
  "theme-contrast",
];

/** 設定に `colorTheme` が無いか知らない名前のときのテーマ。配色の値は `src/index.css` の `:root` の既定のまま */
export const DEFAULT_COLOR_THEME: ColorTheme = "dev-swiss";

/** 配色の明暗の値の並び。`resolveConfig`・page のマーカーの読み取り・CLI の点検が照らす */
export const COLOR_SCHEMES: readonly ColorScheme[] = ["light", "dark", "auto"];

/** 設定に `colorScheme` が無いか知らない値のときの明暗 */
export const DEFAULT_COLOR_SCHEME: ColorScheme = "auto";

/** 設定の `labels.paramCopy` が空でない文字列でないときの部品の文言 */
export const DEFAULT_LABELS: { paramCopy: string } = {
  paramCopy: "今の値をコピーする",
};

/** このバージョンが知っている機能とその既定 */
export const DEFAULT_FEATURES: Record<string, boolean> = {
  print: true,
  table: true,
  callout: true,
  tabs: true,
  steps: true,
  tree: true,
  badge: true,
  footnotes: true,
  code: true,
  syntax: true,
  toc: true,
  anchors: true,
  sections: true,
  "row-details": true,
  figures: true,
  diagrams: true,
  "diagram-resize": true,
  glossary: true,
  backlinks: true,
  html: true,
  hints: true,
  mermaid: true,
  views: true,
  comments: false,
  "html-scripts": false,
  "side-toc": true,
  "back-to-top": true,
  "text-color": true,
  images: true,
  gallery: true,
  lightbox: true,
  media: true,
  gif: true,
  cards: true,
  icon: true,
  columns: true,
  highlight: true,
  kbd: true,
  details: true,
  pagebreak: true,
  include: true,
  wide: true,
  csv: true,
  "card-grid": true,
  frontmatter: false,
  map: true,
};

/** 設定の `syntax.url` が無いときに読み込む highlight.js の `es/` フォルダの URL。バージョンを固定する */
export const DEFAULT_SYNTAX_URL =
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";

/** 設定の `html-scripts.url` が無いときに読み込む @babel/standalone の ES モジュールの URL。バージョンを固定する */
export const DEFAULT_HTML_SCRIPTS_URL =
  "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";

/** 設定の `mermaid.url` が無いときに読み込む mermaid の ES モジュールの URL。バージョンを固定する */
export const DEFAULT_MERMAID_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";

/** `MermaidTheme` の値の並び。`resolveConfig` が照らす */
export const MERMAID_THEMES: readonly MermaidTheme[] = [
  "mdmark",
  "default",
  "neutral",
  "dark",
  "forest",
  "base",
];

/** 設定の `themeVariables` でも変えさせない mermaid のテーマの変数 */
const FIXED_MERMAID_VARIABLES = new Set(["useGradient", "dropShadow"]);

/** 設定の `mermaid` に既定を適用する */
const resolveMermaid = (
  mermaid: MdmarkConfig["mermaid"],
): ResolvedConfig["mermaid"] => {
  const url =
    typeof mermaid?.url === "string" ? mermaid.url : DEFAULT_MERMAID_URL;
  const theme =
    MERMAID_THEMES.find((name) => name === mermaid?.theme) ?? "mdmark";
  // テーマの変数は、マップのときだけ値が文字列のキーを取り、固定の変数は取らない
  const given = mermaid?.themeVariables;
  const themeVariables: Record<string, string> = {};
  if (given !== null && typeof given === "object" && !Array.isArray(given)) {
    for (const [key, value] of Object.entries(given)) {
      if (typeof value === "string" && !FIXED_MERMAID_VARIABLES.has(key)) {
        themeVariables[key] = value;
      }
    }
  }
  return { url, theme, themeVariables };
};

/** マーカーの名前から `LibraryEntry` を参照する既定の対応表 */
export const DEFAULT_LIBRARIES: Record<string, LibraryEntry> = {};

/** マーカーの名前と設定の `libraries` のキーが合うべき書式 */
export const MARK_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** 利用側の設定に既定を当て、型の合わない値を落とした設定を返却する */
export function resolveConfig(options: {
  /** 利用側の設定 */
  config?: MdmarkConfig;
  /** 既定の対応表（単体テストで差し替える） */
  defaultLibraries?: Record<string, LibraryEntry>;
}): ResolvedConfig {
  const { config, defaultLibraries = DEFAULT_LIBRARIES } = options;
  // 機能は、知っているものだけを真偽値で置き換える
  const features = { ...DEFAULT_FEATURES };
  for (const name of Object.keys(DEFAULT_FEATURES)) {
    const value = config?.features?.[name];
    if (typeof value === "boolean") {
      features[name] = value;
    }
  }
  // 対応表は、既定の行をコピーしてから設定の行を重ねる
  const libraries: Record<string, LibraryEntry> = {};
  for (const [name, entry] of Object.entries(defaultLibraries)) {
    libraries[name] = { ...entry };
  }
  for (const [name, url] of Object.entries(config?.libraries ?? {})) {
    if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
      continue;
    }
    // 既定にある名前は URL だけを置き換え、無い名前は図のマーカーとして追加する
    const existing = Object.hasOwn(libraries, name)
      ? libraries[name]
      : undefined;
    libraries[name] = existing ? { ...existing, url } : { url, figure: true };
  }
  // 出す場所は、bottom だけを受け、他の値は top にする
  const placement: TooltipPlacement =
    config?.tooltips?.placement === "bottom" ? "bottom" : "top";
  const diagramPlacement: TooltipPlacement =
    config?.tooltips?.diagramPlacement === "top" ? "top" : "bottom";
  // 色分けのライブラリの読み込み先は、文字列のときだけ受け、他の値は既定にする
  const url = config?.syntax?.url;
  const syntax = { url: typeof url === "string" ? url : DEFAULT_SYNTAX_URL };
  // 範囲のスクリプトの変換のライブラリの読み込み先は、文字列のときだけ受け、他の値は既定にする
  const htmlScriptsUrl = config?.["html-scripts"]?.url;
  const htmlScripts = {
    url:
      typeof htmlScriptsUrl === "string"
        ? htmlScriptsUrl
        : DEFAULT_HTML_SCRIPTS_URL,
  };
  // 右側の目次の出し方は、fixed だけを受け、他の値は hover にする
  const mode: SideTocMode =
    config?.["side-toc"]?.mode === "fixed" ? "fixed" : "hover";
  // 表のピン止めの動きは、through だけを受け、他の値は each にする
  const pin: TablePinMode =
    config?.table?.pin === "through" ? "through" : "each";
  // 長文の列の最小の幅は、0 より大きい有限の数だけを受け、他の値は既定にする
  const requestedMin = config?.table?.long_column_min;
  const longColumnMin =
    typeof requestedMin === "number" &&
    Number.isFinite(requestedMin) &&
    requestedMin > 0
      ? requestedMin
      : DEFAULT_LONG_COLUMN_MIN_EM;
  // テーマは、COLOR_THEMES にある名前だけを受け、他の値は既定にする
  const colorTheme =
    COLOR_THEMES.find((name) => name === config?.colorTheme) ??
    DEFAULT_COLOR_THEME;
  // 明暗は、COLOR_SCHEMES にある値だけを受け、他の値は既定にする
  const colorScheme =
    COLOR_SCHEMES.find((name) => name === config?.colorScheme) ??
    DEFAULT_COLOR_SCHEME;
  // 部品の文言は、空でない文字列だけを受け、他の値は既定にする
  const paramCopy = config?.labels?.paramCopy;
  const labels = {
    paramCopy:
      typeof paramCopy === "string" && paramCopy !== ""
        ? paramCopy
        : DEFAULT_LABELS.paramCopy,
  };
  return {
    features,
    libraries,
    tooltips: { placement, diagramPlacement },
    syntax,
    htmlScripts,
    mermaid: resolveMermaid(config?.mermaid),
    sideToc: { mode },
    table: { pin, longColumnMin },
    colorTheme,
    colorScheme,
    labels,
    map: resolveMapConfig(config?.map),
  };
}

/** map の図の、ノードの形状に記載できる値 */
export const MAP_SHAPES = ["rounded", "rect", "pill", "double"] as const;
/** map の図の、線の模様に記載できる値 */
export const MAP_DASHES = [
  "solid",
  "dashed",
  "dotted",
  "dash-dot",
  "long-dash",
] as const;
/** map の図の、線の太さに記載できる値 */
export const MAP_WIDTHS = ["thin", "normal", "thick"] as const;
/** map の図の、線の矢じりに記載できる値 */
export const MAP_HEADS = ["filled", "open", "none"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 値が並びにあればその値、無ければ undefined */
const oneOf = <T extends string>(
  list: readonly T[],
  value: unknown,
): T | undefined =>
  typeof value === "string" && (list as readonly string[]).includes(value)
    ? (value as T)
    : undefined;

/** 設定の map に既定を当て、知らない値を既定にする（キーごとの値のうち合わないものは捨てる） */
export const resolveMapConfig = (value: unknown): ResolvedMapConfig => {
  const map = isRecord(value) ? value : {};
  const kinds: Record<string, MapKind> = {};
  for (const [name, kind] of Object.entries(
    isRecord(map.kinds) ? map.kinds : {},
  )) {
    if (!isRecord(kind)) continue;
    const entry: MapKind = {};
    if (typeof kind.label === "string") entry.label = kind.label;
    if (typeof kind.icon === "string") entry.icon = kind.icon;
    const shape = oneOf(MAP_SHAPES, kind.shape);
    if (shape) entry.shape = shape;
    if (typeof kind.color === "string") entry.color = kind.color;
    kinds[name] = entry;
  }
  const lines: Record<string, MapLine> = {};
  for (const [name, line] of Object.entries(
    isRecord(map.lines) ? map.lines : {},
  )) {
    if (!isRecord(line)) continue;
    const entry: MapLine = {};
    const dash = oneOf(MAP_DASHES, line.dash);
    if (dash) entry.dash = dash;
    const width = oneOf(MAP_WIDTHS, line.width);
    if (width) entry.width = width;
    const head = oneOf(MAP_HEADS, line.head);
    if (head) entry.head = head;
    if (typeof line.color === "string") entry.color = line.color;
    lines[name] = entry;
  }
  return {
    node_fit: map.node_fit === "width" ? "width" : "height",
    url_state: typeof map.url_state === "boolean" ? map.url_state : true,
    kinds,
    lines,
  };
};

/** 既定を適用した設定に、文書の page のマーカーの値を重ねた設定を返却する（指定された設定は書き換えない） */
export const applyPageSettings = (options: {
  /** 既定を適用した設定 */
  config: ResolvedConfig;
  /** `renderDocument` が返却したページの設定 */
  page: PageSettings;
}): ResolvedConfig => {
  const { config, page } = options;
  return {
    ...config,
    colorScheme: page.scheme ?? config.colorScheme,
    colorTheme: page.theme ?? config.colorTheme,
    sideToc: { mode: page.toc ?? config.sideToc.mode },
  };
};
