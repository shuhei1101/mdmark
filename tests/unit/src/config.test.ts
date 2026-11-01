import { expect, test } from "vitest";
import type { MdmarkConfig } from "../../../src/config.ts";

/** 設定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadConfig = () => import("../../../src/config.ts");

/** 色分けのライブラリの既定の読み込み先 */
const DEFAULT_SYNTAX_URL =
  "https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/es/";

/** この版が知っている機能の既定（`comments` を除いて全てオン） */
const DEFAULT_FEATURES = {
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
};

// 設定が無ければ既定を返す（正常系）
test("test_resolve_config", async () => {
  // 準備
  const { resolveConfig } = await loadConfig();
  // 実行
  const resolved = resolveConfig({});
  // 検証
  expect(resolved).toEqual({
    features: DEFAULT_FEATURES,
    libraries: {},
    tooltips: { placement: "top" },
    syntax: { url: DEFAULT_SYNTAX_URL },
    sideToc: { mode: "hover" },
    colorTheme: "dev-swiss",
    labels: { paramCopy: "今の値を写す" },
  });
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

// 書式に合う名前と文字列の URL だけを足す（正常系）
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
    { paramCopy: "今の値を写す" },
    { paramCopy: "今の値を写す" },
    { paramCopy: "今の値を写す" },
  ]);
});
