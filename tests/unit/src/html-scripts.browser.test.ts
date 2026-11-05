import { afterEach, expect, test, vi } from "vitest";
import { createRootFromHtml, removeRoots } from "../helpers/dom.ts";
import { renderDoc } from "../helpers/render.ts";

/** 範囲のスクリプトの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHtmlScripts = () => import("../../../src/html-scripts.ts");

/** 手元の @babel/standalone を読む `importModule` */
const importBabel = () => import("@babel/standalone");

afterEach(async () => {
  const { setEmbeddedHtmlScripts } = await loadHtmlScripts();
  setEmbeddedHtmlScripts(undefined);
  removeRoots();
  vi.restoreAllMocks();
});

/** 範囲に `html` と、言語 `lang` のコードブロックを置いた Markdown */
function range(lang: "ts" | "js", code: string): string {
  return [
    "<!-- html -->",
    "",
    "```html",
    "<p>範囲</p>",
    "```",
    "",
    `\`\`\`${lang}`,
    code,
    "```",
    "",
    "<!-- /html -->",
    "",
  ].join("\n");
}

/** `html-scripts` をオンにして範囲を描いた要素と、範囲の根の要素を返す */
function mountRanges(ranges: string[]): {
  root: HTMLElement;
  scopes: HTMLElement[];
} {
  const { html } = renderDoc(ranges.join("\n"), { "html-scripts": true });
  const root = createRootFromHtml(html);
  const scopes = [...root.querySelectorAll<HTMLElement>("div.mdmark-html")];
  return { root, scopes };
}

/** 型の注釈と enum を持ち、根の要素に `data-ran` を付け、`destroy` で `data-destroyed` を付ける `ts` */
const TYPED_TS = [
  'enum Mark { Ran = "1" }',
  "export default (root: HTMLElement): (() => void) => {",
  "  root.dataset.ran = Mark.Ran;",
  '  return () => { root.dataset.destroyed = "1"; };',
  "};",
].join("\n");

// `ts` を変換して根の要素で呼び、`destroy` を返す（正常系）
test("test_run_html_scripts", async () => {
  // 準備
  const { runHtmlScripts, HTML_SCRIPTS_REGISTRY } = await loadHtmlScripts();
  const { root, scopes } = mountRanges([range("ts", TYPED_TS)]);
  const scriptsBefore = document.head.querySelectorAll("script").length;
  // 実行
  const destroy = await runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => true,
    cache: new Map(),
    importModule: importBabel,
  });
  // 検証
  expect(scopes[0]?.dataset.ran).toBe("1");
  expect(scopes[0]?.dataset.destroyed).toBeUndefined();
  destroy();
  expect(scopes[0]?.dataset.destroyed).toBe("1");
  expect(document.head.querySelectorAll("script")).toHaveLength(scriptsBefore);
  expect(HTML_SCRIPTS_REGISTRY in window).toBe(false);
});

// `js` も `export` の文を変えて動かす（正常系）
test("test_run_html_scripts_when_js", async () => {
  // 準備
  const { runHtmlScripts } = await loadHtmlScripts();
  const { root, scopes } = mountRanges([
    range(
      "js",
      "export const x = 1; export default (root) => { root.dataset.x = String(x) }",
    ),
  ]);
  // 実行
  await runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => true,
    cache: new Map(),
    importModule: importBabel,
  });
  // 検証
  expect(scopes[0]?.dataset.x).toBe("1");
});

// 関数でない既定のエクスポート・例外・構文エラーの範囲の前に書き方の警告を置き、次の範囲を動かす（異常系）
test("test_run_html_scripts_when_invalid", async () => {
  // 準備
  const { runHtmlScripts } = await loadHtmlScripts();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { root, scopes } = mountRanges([
    range("ts", "export default 1 as number;"),
    range("js", 'export default () => { throw new Error("失敗"); };'),
    range("js", "export default (root) => {"),
    range("js", 'export default (root) => { root.dataset.ran = "1"; };'),
  ]);
  // 実行
  await runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => true,
    cache: new Map(),
    importModule: importBabel,
  });
  // 検証
  for (const scope of scopes.slice(0, 3)) {
    expect(
      scope.previousElementSibling?.classList.contains("mdmark-syntax-warning"),
    ).toBe(true);
  }
  expect(
    scopes[3]?.previousElementSibling?.classList.contains(
      "mdmark-syntax-warning",
    ),
  ).toBe(false);
  expect(root.querySelectorAll(".mdmark-syntax-warning")).toHaveLength(3);
  expect(scopes[3]?.dataset.ran).toBe("1");
  expect(consoleError).toHaveBeenCalledTimes(3);
});

// 変換のライブラリを読めないとき、全ての範囲の前に知らせの枠を置く（異常系）
test("test_run_html_scripts_when_transpiler_unavailable", async () => {
  // 準備
  const { runHtmlScripts } = await loadHtmlScripts();
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { root, scopes } = mountRanges([
    range(
      "ts",
      'export default (root: HTMLElement) => { root.dataset.ran = "1"; };',
    ),
    range("js", 'export default (root) => { root.dataset.ran = "1"; };'),
  ]);
  // 実行
  const run = runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => true,
    cache: new Map(),
    importModule: () => Promise.reject(new Error("読めない")),
  });
  // 検証
  await expect(run).resolves.toBeTypeOf("function");
  for (const scope of scopes) {
    expect(
      scope.previousElementSibling?.classList.contains("mdmark-notice"),
    ).toBe(true);
    expect(scope.dataset.ran).toBeUndefined();
  }
  expect(root.querySelectorAll(".mdmark-notice")).toHaveLength(2);
});

/** 埋めた関数の表で引く `js` の範囲のコード */
const EMBEDDED_CODE = 'export default (root) => { root.dataset.ran = "1"; };';

// 埋めた関数の表があるときは、変換のライブラリも `script` 要素も使わない（正常系）
test("test_run_html_scripts_when_embedded", async () => {
  // 準備
  const { runHtmlScripts, setEmbeddedHtmlScripts } = await loadHtmlScripts();
  const call = vi.fn((root: HTMLElement) => {
    root.dataset.ran = "1";
  });
  setEmbeddedHtmlScripts(new Map([[`${EMBEDDED_CODE}\n`, () => call]]));
  const importModule = vi.fn(importBabel);
  const append = vi.spyOn(document.head, "append");
  const { root, scopes } = mountRanges([range("js", EMBEDDED_CODE)]);
  // 実行
  await runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => true,
    cache: new Map(),
    importModule,
  });
  // 検証
  expect(call).toHaveBeenCalledTimes(1);
  expect(call).toHaveBeenCalledWith(scopes[0]);
  expect(scopes[0]?.dataset.ran).toBe("1");
  expect(importModule).not.toHaveBeenCalled();
  expect(append).not.toHaveBeenCalled();
});

// 読み終える前に描き直したら動かさない（正常系）
test("test_run_html_scripts_when_stale", async () => {
  // 準備
  const { runHtmlScripts } = await loadHtmlScripts();
  const { root, scopes } = mountRanges([range("js", EMBEDDED_CODE)]);
  // 実行
  await runHtmlScripts({
    root,
    url: "/babel.mjs",
    isCurrent: () => false,
    cache: new Map(),
    importModule: importBabel,
  });
  // 検証
  expect(scopes[0]?.dataset.ran).toBeUndefined();
});

// 1 回だけ読み、`disableScriptTags` を呼ぶ（正常系）
test("test_load_transpiler", async () => {
  // 準備
  const { loadTranspiler } = await loadHtmlScripts();
  const transform = vi.fn(() => ({ code: "" }));
  const disableScriptTags = vi.fn();
  const importModule = vi.fn(async () => ({
    default: { transform, disableScriptTags },
  }));
  const cache = new Map();
  // 実行
  const first = await loadTranspiler({
    url: "/babel.mjs",
    cache,
    importModule,
  });
  const second = await loadTranspiler({
    url: "/babel.mjs",
    cache,
    importModule,
  });
  // 検証
  expect(importModule).toHaveBeenCalledTimes(1);
  expect(disableScriptTags).toHaveBeenCalledTimes(1);
  expect(first.transform).toBe(transform);
  expect(second.transform).toBe(transform);
});

// `transform` を持たないモジュールは拒否する（異常系）
test("test_load_transpiler_when_no_transform", async () => {
  // 準備
  const { loadTranspiler } = await loadHtmlScripts();
  // 実行
  const loaded = loadTranspiler({
    url: "/babel.mjs",
    cache: new Map(),
    importModule: async () => ({}),
  });
  // 検証
  await expect(loaded).rejects.toBeInstanceOf(Error);
});

// 登録の呼び出しで包み、行のコメントと `</script` で壊れない（正常系）
test("test_wrap_range_script", async () => {
  // 準備
  const { wrapRangeScript, HTML_SCRIPTS_REGISTRY } = await loadHtmlScripts();
  const registered: Array<{ index: number; run: unknown }> = [];
  const registry = window as unknown as Record<string, unknown>;
  registry[HTML_SCRIPTS_REGISTRY] = (index: number, run: unknown) => {
    registered.push({ index, run });
  };
  // 実行
  const source = wrapRangeScript({
    code: 'exports.default = () => "</script>" // 末尾',
    index: 2,
  });
  const script = document.createElement("script");
  script.textContent = source;
  document.head.append(script);
  script.remove();
  delete registry[HTML_SCRIPTS_REGISTRY];
  // 検証
  expect(source).toContain(HTML_SCRIPTS_REGISTRY);
  expect(source).toContain("2");
  expect(source).not.toContain("</script");
  expect(registered).toHaveLength(1);
  expect(registered[0]?.index).toBe(2);
  const exports: { default?: () => string } = {};
  const run = registered[0]?.run as (
    m: unknown,
    e: unknown,
    r: unknown,
  ) => void;
  run({ exports }, exports, () => {
    throw new Error("require は使えない");
  });
  expect(exports.default?.()).toBe("</script>");
});
