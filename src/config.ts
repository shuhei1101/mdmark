/** 使う側が `opts.config` に渡す設定。他のキーを持っていても読まない */
export type MdmarkConfig = {
  /** 機能のオン・オフの既定 */
  features?: Record<string, boolean>;
  /** 印の名前からモジュールの URL を引く対応表 */
  libraries?: Record<string, string>;
};

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
  toc: true,
  anchors: true,
  sections: true,
  "row-details": true,
  figures: true,
  diagrams: true,
  glossary: true,
  backlinks: true,
};

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
  return { features, libraries };
}
