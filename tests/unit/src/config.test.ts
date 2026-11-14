import { expect, test } from "vitest";
import type { MdmarkConfig } from "../../../src/config.ts";

/** 設定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConfig = () => import("../../../src/config.ts");

/** 色分けのライブラリの既定の読み込み先 */
const DEFAULT_SYNTAX_URL =
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";

/** mermaid の既定の読み込み先 */
const DEFAULT_MERMAID_URL =
  "https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.esm.min.mjs";

/** 範囲のスクリプトの変換のライブラリの既定の読み込み先 */
const DEFAULT_HTML_SCRIPTS_URL =
  "https://cdn.jsdelivr.net/npm/@babel/standalone@8.1.1/+esm";

/** このバージョンが知っている機能の既定（`comments`・`html-scripts`・`frontmatter` を除いて全てオン） */
const DEFAULT_FEATURES = {
  print: true,
  table: true,
  callout: true,
  tabs: true,
  steps: true,
  tree: true,
  badge: true,
  footnotes: true,
  annotations: true,
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

// 設定が無ければ既定を返却する（正常系）
test("test_resolve_config", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  // 実行
  const resolved = resolveConfig({});
  // 検証
  expect(resolved).toEqual({
    features: DEFAULT_FEATURES,
    libraries: {},
    tooltips: { placement: "top", diagramPlacement: "bottom" },
    syntax: { url: DEFAULT_SYNTAX_URL },
    htmlScripts: { url: DEFAULT_HTML_SCRIPTS_URL },
    mermaid: { url: DEFAULT_MERMAID_URL, theme: "mdmark", themeVariables: {} },
    sideToc: { mode: "hover" },
    table: { pin: "each", longColumnMin: 45 },
    colorTheme: "dev-swiss",
    colorScheme: "auto",
    labels: { paramCopy: "今の値をコピーする" },
    map: { node_fit: "height", url_state: true, kinds: {}, lines: {} },
  });
});

// mermaid の url・theme・themeVariables の型の合う値だけを受ける（正常系）
test("test_resolve_config_when_mermaid_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const given = {
    mermaid: {
      url: "/vendor/mermaid.mjs",
      theme: "neutral",
      themeVariables: {
        primaryColor: "#e0f2f1",
        useGradient: "true",
        dropShadow: "x",
        fontSize: 14,
      },
    },
  } as unknown as MdmarkConfig;
  const invalid = {
    mermaid: { url: 1, theme: "no-such-theme", themeVariables: "x" },
  } as unknown as MdmarkConfig;
  // 実行
  const results = [given, invalid, {}].map((config) =>
    resolveConfig({ config }),
  );
  // 検証
  expect(results[0]?.mermaid).toEqual({
    url: "/vendor/mermaid.mjs",
    theme: "neutral",
    themeVariables: { primaryColor: "#e0f2f1" },
  });
  const fallback = {
    url: DEFAULT_MERMAID_URL,
    theme: "mdmark",
    themeVariables: {},
  };
  expect(results[1]?.mermaid).toEqual(fallback);
  expect(results[2]?.mermaid).toEqual(fallback);
  expect(results[2]?.features.mermaid).toBe(true);
});

// 知っている機能の真偽値だけを置き換える（正常系）
test("test_resolve_config_when_features_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const config = {
    features: { print: false, unknown: true, other: "yes" },
  } as unknown as MdmarkConfig;
  // 実行
  const resolved = resolveConfig({ config });
  // 検証
  expect(resolved.features).toEqual({ ...DEFAULT_FEATURES, print: false });
});

// 書式に合う名前と文字列の URL だけを追加する（正常系）
test("test_resolve_config_when_libraries_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const config = {
    libraries: {
      "test-lib": "/fixtures/test-lib.js",
      "Bad Name": "/x.js",
      num: 1,
      constructor: "/c.js",
    },
  } as unknown as MdmarkConfig;
  // 実行
  const resolved = resolveConfig({ config });
  // 検証
  expect(resolved.libraries).toEqual({
    "test-lib": { url: "/fixtures/test-lib.js", figure: true },
    constructor: { url: "/c.js", figure: true },
  });
});

// 既定の行は URL だけを置き換え、figure は既定のままにする（正常系）
test("test_resolve_config_when_default_library_overridden", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const defaultLibraries = { block: { url: "https://a/x.js", figure: false } };
  const config: MdmarkConfig = { libraries: { block: "/y.js" } };
  // 実行
  const resolved = resolveConfig({ config, defaultLibraries });
  // 検証
  expect(resolved.libraries.block).toEqual({ url: "/y.js", figure: false });
});

// bottom だけを受け、他の値は top にする（正常系）
test("test_resolve_config_when_tooltip_placement_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const bottom: MdmarkConfig = { tooltips: { placement: "bottom" } };
  const unknown = {
    tooltips: { placement: "left" },
  } as unknown as MdmarkConfig;
  // 実行
  const resolvedBottom = resolveConfig({ config: bottom });
  const resolvedUnknown = resolveConfig({ config: unknown });
  // 検証
  expect(resolvedBottom.tooltips.placement).toBe("bottom");
  expect(resolvedUnknown.tooltips.placement).toBe("top");
});

// 文字列の syntax.url だけを受け、他の型は既定にする（正常系）
test("test_resolve_config_when_syntax_url_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const given: MdmarkConfig = { syntax: { url: "/vendor/highlightjs/es/" } };
  const invalid = { syntax: { url: 1 } } as unknown as MdmarkConfig;
  // 実行
  const resolvedGiven = resolveConfig({ config: given });
  const resolvedInvalid = resolveConfig({ config: invalid });
  // 検証
  expect(resolvedGiven.syntax.url).toBe("/vendor/highlightjs/es/");
  expect(resolvedInvalid.syntax.url).toBe(DEFAULT_SYNTAX_URL);
});

// fixed だけを受け、他の値と無いときは hover にする（正常系）
test("test_resolve_config_when_side_toc_mode_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const fixed: MdmarkConfig = { "side-toc": { mode: "fixed" } };
  const unknown: MdmarkConfig = { "side-toc": { mode: "left" } };
  // 実行
  const resolvedFixed = resolveConfig({ config: fixed });
  const resolvedUnknown = resolveConfig({ config: unknown });
  const resolvedEmpty = resolveConfig({ config: {} });
  // 検証
  expect(resolvedFixed.sideToc.mode).toBe("fixed");
  expect(resolvedUnknown.sideToc.mode).toBe("hover");
  expect(resolvedEmpty.sideToc.mode).toBe("hover");
  expect(resolvedEmpty.features["side-toc"]).toBe(true);
  expect(resolvedEmpty.features["back-to-top"]).toBe(true);
});

// through だけを受け、他の値と無いときは each にする（正常系）
test("test_resolve_config_when_table_pin_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const through: MdmarkConfig = { table: { pin: "through" } };
  const unknown: MdmarkConfig = { table: { pin: "left" } };
  const notString = { table: { pin: 1 } } as unknown as MdmarkConfig;
  // 実行
  const resolvedThrough = resolveConfig({ config: through });
  const resolvedUnknown = resolveConfig({ config: unknown });
  const resolvedNotString = resolveConfig({ config: notString });
  const resolvedEmpty = resolveConfig({ config: {} });
  // 検証
  expect(resolvedThrough.table.pin).toBe("through");
  expect(resolvedUnknown.table.pin).toBe("each");
  expect(resolvedNotString.table.pin).toBe("each");
  expect(resolvedEmpty.table.pin).toBe("each");
});

// 0 より大きい数だけを長文の列の最小の幅にし、ほかは既定の 45 にする（正常系）
test("test_resolve_config_when_long_column_min_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const configs = [
    { table: { long_column_min: 30 } },
    { table: { long_column_min: 0 } },
    { table: { long_column_min: "wide" } },
    { table: { long_column_min: -5 } },
    {},
  ] as unknown as MdmarkConfig[];
  // 実行
  const result = configs.map(
    (config) => resolveConfig({ config }).table.longColumnMin,
  );
  // 検証
  expect(result).toEqual([30, 45, 45, 45, 45]);
});

// COLOR_THEMES の名前だけを受け、他の値と無いときは dev-swiss にする（正常系）
test("test_resolve_config_when_color_theme_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const configs = [
    { colorTheme: "theme-slate" },
    { colorTheme: "sepia" },
    { colorTheme: 1 },
    {},
  ] as MdmarkConfig[];
  // 実行
  const themes = configs.map((config) => resolveConfig({ config }).colorTheme);
  // 検証
  expect(themes).toEqual([
    "theme-slate",
    "dev-swiss",
    "dev-swiss",
    "dev-swiss",
  ]);
});

// `COLOR_SCHEMES` の値だけを受け、他の値と無いときは `auto` にする（正常系）
test("test_resolve_config_when_color_scheme_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const configs = [
    { colorScheme: "dark" },
    { colorScheme: "sepia" },
    { colorScheme: 1 },
    {},
  ] as MdmarkConfig[];
  // 実行
  const resolved = configs.map((config) => resolveConfig({ config }));
  // 検証
  expect(resolved.map((config) => config.colorScheme)).toEqual([
    "dark",
    "auto",
    "auto",
    "auto",
  ]);
  expect(resolved[3]?.features["card-grid"]).toBe(true);
});
// 空でない文字列の `labels.paramCopy` だけを受け、空文字・他の型・無いときは既定にする（正常系）
test("test_resolve_config_when_labels_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const configs = [
    { labels: { paramCopy: "コピー" } },
    { labels: { paramCopy: "" } },
    { labels: { paramCopy: 1 } },
    { labels: { other: "x" } },
  ] as unknown as MdmarkConfig[];
  // 実行
  const labels = configs.map((config) => resolveConfig({ config }).labels);
  // 検証
  expect(labels).toEqual([
    { paramCopy: "コピー" },
    { paramCopy: "今の値をコピーする" },
    { paramCopy: "今の値をコピーする" },
    { paramCopy: "今の値をコピーする" },
  ]);
});

// 文字列の `html-scripts.url` だけを受け、他の型と無いときは既定にする（正常系）
test("test_resolve_config_when_html_scripts_url_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const configs = [
    { "html-scripts": { url: "/vendor/babel.mjs" } },
    { "html-scripts": { url: 1 } },
    {},
  ] as unknown as MdmarkConfig[];
  // 実行
  const resolved = configs.map((config) => resolveConfig({ config }));
  // 検証
  expect(resolved.map((config) => config.htmlScripts.url)).toEqual([
    "/vendor/babel.mjs",
    DEFAULT_HTML_SCRIPTS_URL,
    DEFAULT_HTML_SCRIPTS_URL,
  ]);
  expect(resolved[2]?.features["html-scripts"]).toBe(false);
});

// top だけを受け、他の値と無いときは bottom にする（正常系）
test("test_resolve_config_when_diagram_placement_given", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  const top = { tooltips: { diagramPlacement: "top" } } as MdmarkConfig;
  const unknown = {
    tooltips: { diagramPlacement: "left" },
  } as unknown as MdmarkConfig;
  const bodyOnly: MdmarkConfig = { tooltips: { placement: "bottom" } };
  // 実行
  const resolved = [top, unknown, bodyOnly].map((config) =>
    resolveConfig({ config }),
  );
  // 検証
  expect(resolved.map((config) => config.tooltips.diagramPlacement)).toEqual([
    "top",
    "bottom",
    "bottom",
  ]);
  expect(resolved[2]?.tooltips.placement).toBe("bottom");
});

// マーカーに記載したキーだけを置き換える（正常系）
test("test_apply_page_settings", async () => {
  // 準備
  const { resolveConfig, applyPageSettings } = await loadConfig();
  const config = resolveConfig({
    config: {
      colorScheme: "dark",
      colorTheme: "theme-paper",
      "side-toc": { mode: "hover" },
    },
  });
  const before = structuredClone(config);
  // 実行
  const applied = applyPageSettings({
    config,
    page: { scheme: "light", toc: "fixed" },
  });
  const unchanged = applyPageSettings({ config, page: {} });
  // 検証
  expect(applied.colorScheme).toBe("light");
  expect(applied.colorTheme).toBe("theme-paper");
  expect(applied.sideToc.mode).toBe("fixed");
  expect(unchanged).toEqual(before);
  expect(config).toEqual(before);
});

// 既定（正常系）
test("test_resolve_map_config", async () => {
  // 準備
  const { resolveMapConfig } = await loadConfig();
  // 実行
  const map = resolveMapConfig(undefined);
  // 検証
  expect(map).toEqual({
    node_fit: "height",
    url_state: true,
    kinds: {},
    lines: {},
  });
});

// 知らない値（正常系）
test("test_resolve_map_config_when_unknown_values", async () => {
  // 準備
  const { resolveMapConfig } = await loadConfig();
  // 実行
  const map = resolveMapConfig({
    node_fit: "tall",
    url_state: "no",
    kinds: { a: { shape: "hexagon", label: "A" } },
  });
  // 検証
  expect(map.node_fit).toBe("height");
  expect(map.url_state).toBe(true);
  expect(map.kinds.a).toEqual({ label: "A" });
});
