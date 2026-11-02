/** 使う側が `opts.config` に渡す設定。他のキーを持っていても読まない */
export type MdmarkConfig = {
  /** 機能のオン・オフの既定 */
  features?: Record<string, boolean>;
  /** 印の名前からモジュールの URL を引く対応表 */
  libraries?: Record<string, string>;
  /** ツールチップの設定。`placement` は持ち主の上と下のどちらに先に出すか（`top` / `bottom`）。知らない値も受けて `resolveConfig` が `top` にするため、型は `string` */
  tooltips?: { placement?: string };
  /** 色分けのライブラリの設定。`url` は highlight.js の `es/` フォルダの URL（末尾 `/`） */
  syntax?: { url?: string };
  /** 文書が指すファイルの探し方（CLI と VS Code 拡張機能だけが読む） */
  assets?: { root?: string };
  /** 右側の目次の設定。`mode` は出し方（`hover` / `fixed`）。知らない値も受けて `resolveConfig` が `hover` にするため、型は `string` */
  "side-toc"?: { mode?: string };
  /** 配色のテーマの名前（`COLOR_THEMES` のどれか）。知らない値も受けて `resolveConfig` が `DEFAULT_COLOR_THEME` にするため、型は `string` */
  colorTheme?: string;
  /** 部品の文言の設定。`paramCopy` は操作できる部品の今の値をコピーするボタンの文言。空文字も受けて `resolveConfig` が `DEFAULT_LABELS.paramCopy` にする */
  labels?: { paramCopy?: string };
};

/** ツールチップを持ち主の上と下のどちらに先に出すか。`top` は上に出し、上に収まらないときだけ下に出す。`bottom` は下に出し、下に収まらず上に収まるときだけ上に出す */
export type TooltipPlacement = "top" | "bottom";

/** 右側の目次の出し方。`hover` は右端の線を出し、指すかフォーカスで目次を重ねて出す。`fixed` は目次を出すボタンでサイドバーを開閉する */
export type SideTocMode = "hover" | "fixed";

/** mdmark に入れた配色のテーマの名前 */
export type ColorTheme =
  | "dev-swiss"
  | "theme-paper"
  | "theme-slate"
  | "theme-contrast";

/** 対応表の行: 印 1 つのモジュールの URL と、図の印か */
export type LibraryEntry = {
  /** モジュールの URL */
  url: string;
  /** 図の印か。知らせの枠の題を分ける */
  figure: boolean;
};

/** 全てのキーに値を持つ、内部で使う設定 */
export type ResolvedConfig = {
  /** 機能のオン・オフ（キーはこの版が知っている機能だけ） */
  features: Record<string, boolean>;
  /** 既定の対応表に設定の `libraries` を重ねたもの */
  libraries: Record<string, LibraryEntry>;
  /** 設定の `tooltips.placement` が `bottom` のときだけ `bottom`、それ以外は `top` */
  tooltips: { placement: TooltipPlacement };
  /** 設定の `syntax.url` が文字列ならその値、それ以外は `DEFAULT_SYNTAX_URL` */
  syntax: { url: string };
  /** 設定の `side-toc.mode` が `fixed` のときだけ `fixed`、それ以外は `hover` */
  sideToc: { mode: SideTocMode };
  /** 設定の `colorTheme` が `COLOR_THEMES` にあればその値、それ以外は `DEFAULT_COLOR_THEME` */
  colorTheme: ColorTheme;
  /** 設定の `labels.paramCopy` が空でない文字列ならその値、それ以外は `DEFAULT_LABELS.paramCopy` */
  labels: { paramCopy: string };
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

/** 設定の `labels.paramCopy` が空でない文字列でないときの部品の文言 */
export const DEFAULT_LABELS: { paramCopy: string } = {
  paramCopy: "今の値を写す",
};

/** この版が知っている機能とその既定 */
export const DEFAULT_FEATURES: Record<string, boolean> = {
  print: true,
  table: true,
  callout: true,
  tabs: true,
  steps: true,
  tree: true,
  badge: true,
  code: true,
  syntax: true,
  toc: true,
  anchors: true,
  sections: true,
  "row-details": true,
  figures: true,
  diagrams: true,
  glossary: true,
  backlinks: true,
  html: true,
  hints: true,
  views: true,
  comments: false,
  "side-toc": true,
  "text-color": true,
  images: true,
  gallery: true,
  lightbox: true,
  media: true,
  gif: true,
  cards: true,
};

/** 設定の `syntax.url` が無いときに読む highlight.js の `es/` フォルダの URL。バージョンを固定する */
export const DEFAULT_SYNTAX_URL =
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";

/** 印の名前から `LibraryEntry` を引く既定の対応表 */
export const DEFAULT_LIBRARIES: Record<string, LibraryEntry> = {};

/** 印の名前と設定の `libraries` のキーが合うべき書式 */
export const MARK_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** 使う側の設定に既定を当て、型の合わない値を落とした設定を返す */
export function resolveConfig(options: {
  /** 使う側の設定 */
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
  // 対応表は、既定の行を写してから設定の行を重ねる
  const libraries: Record<string, LibraryEntry> = {};
  for (const [name, entry] of Object.entries(defaultLibraries)) {
    libraries[name] = { ...entry };
  }
  for (const [name, url] of Object.entries(config?.libraries ?? {})) {
    if (!MARK_NAME_PATTERN.test(name) || typeof url !== "string") {
      continue;
    }
    // 既定にある名前は URL だけを置き換え、無い名前は図の印として足す
    const existing = Object.hasOwn(libraries, name)
      ? libraries[name]
      : undefined;
    libraries[name] = existing ? { ...existing, url } : { url, figure: true };
  }
  // 出す場所は、bottom だけを受け、他の値は top にする
  const placement: TooltipPlacement =
    config?.tooltips?.placement === "bottom" ? "bottom" : "top";
  // 色分けのライブラリの読み込み先は、文字列のときだけ受け、他の値は既定にする
  const url = config?.syntax?.url;
  const syntax = { url: typeof url === "string" ? url : DEFAULT_SYNTAX_URL };
  // 右側の目次の出し方は、fixed だけを受け、他の値は hover にする
  const mode: SideTocMode =
    config?.["side-toc"]?.mode === "fixed" ? "fixed" : "hover";
  // テーマは、COLOR_THEMES にある名前だけを受け、他の値は既定にする
  const colorTheme =
    COLOR_THEMES.find((name) => name === config?.colorTheme) ??
    DEFAULT_COLOR_THEME;
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
    tooltips: { placement },
    syntax,
    sideToc: { mode },
    colorTheme,
    labels,
  };
}
