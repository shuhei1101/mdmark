import core from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import { afterEach, expect, test, vi } from "vitest";
import type { SyntaxImport } from "../../../src/highlight.ts";
import { renderCodeBlock } from "../../../src/parts/code-block.ts";

/** 色分けの処理を読み込む（実装が無い間は各テストが個別に失敗する。ファイルが無いと Vite の解決が失敗してテストファイルごと落ち、ほかのテストも巻き込むため、URL を組んで読む） */
const loadHighlight = (): Promise<typeof import("../../../src/highlight.ts")> =>
  import(
    /* @vite-ignore */ new URL("../../../src/highlight.ts", import.meta.url)
      .href
  );

/** 色分けのライブラリを置く URL（ページの origin を基準に解決される） */
const BASE_URL = "/hl/";

/** 本体の URL（解決後） */
const CORE_URL = `${location.origin}/hl/core.min.js`;

/** typescript の言語のモジュールの URL（解決後） */
const TYPESCRIPT_URL = `${location.origin}/hl/languages/typescript.min.js`;

/** yaml の言語のモジュールの URL（解決後） */
const YAML_URL = `${location.origin}/hl/languages/yaml.min.js`;

/** 言語のモジュール名から、npm の言語の定義を引く */
const LANGUAGES = { typescript, yaml };

/** 行に分けない typescript のコードブロックと、行番号を付けて 3 行に分けた yaml のコードブロックを持つ要素を作る */
function createRoot(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML =
    renderCodeBlock({
      language: "ts",
      title: "",
      lineNumbers: false,
      lines: [{ text: "const a: number = 1;" }, { text: "// b < c" }],
      syntax: "typescript",
    }) +
    renderCodeBlock({
      language: "yaml",
      title: "",
      lineNumbers: true,
      lines: [{ text: "key: |" }, { text: "  a < b" }, { text: "  c" }],
      syntax: "yaml",
    });
  return root;
}

/** 本体と言語のモジュールを返し、`failing` の URL は拒否する読み込みの関数を作る */
function createImport(failing: Record<string, Error> = {}) {
  const hljs = core.newInstance();
  return vi.fn<SyntaxImport>(async (url) => {
    const error = failing[url];
    if (error) {
      throw error;
    }
    if (url.endsWith("/core.min.js") || url === "blob:core") {
      return { default: hljs };
    }
    const name =
      url.endsWith("typescript.min.js") || url === "blob:ts"
        ? "typescript"
        : "yaml";
    return { default: LANGUAGES[name] };
  });
}

/** 色分けの `span` を持つ `code` を返す */
const coloredCodes = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>("code")].filter(
    (code) => code.querySelector('span[class^="hljs-"]') !== null,
  );

/** 行の数と `data-line` を並べた文字 */
const lineShape = (root: HTMLElement): string[] =>
  [...root.querySelectorAll<HTMLElement>(".mdmark-code-line")].map(
    (line) => line.dataset.line ?? "",
  );

afterEach(() => {
  vi.restoreAllMocks();
});

// 行に分けた形と分けない形の両方を色分けし、文字と行の形を変えない（正常系）
test("test_highlight_code_blocks", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const root = createRoot();
  const text = root.textContent;
  const shape = lineShape(root);
  const importModule = createImport();
  // 実行
  await highlightCodeBlocks({
    root,
    url: BASE_URL,
    isCurrent: () => true,
    modules: new Map(),
    importModule,
  });
  // 検証
  expect(importModule.mock.calls.map(([url]) => url).sort()).toEqual(
    [CORE_URL, TYPESCRIPT_URL, YAML_URL].sort(),
  );
  expect(coloredCodes(root)).toHaveLength(2);
  expect(root.textContent).toBe(text);
  expect(lineShape(root)).toEqual(shape);
});

// 色分けの対象が無ければ何も読まない（正常系）
test("test_highlight_code_blocks_when_no_target", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const root = document.createElement("div");
  root.innerHTML = '<pre><code class="language-ts">const a = 1;</code></pre>';
  const importModule = createImport();
  // 実行
  await highlightCodeBlocks({
    root,
    url: BASE_URL,
    isCurrent: () => true,
    modules: new Map(),
    importModule,
  });
  // 検証
  expect(importModule).not.toHaveBeenCalled();
});

// 本体を読めないときは色分けせずに残し、エラーを出す（異常系）
test("test_highlight_code_blocks_when_core_fails", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const before = root.innerHTML;
  const importModule = createImport({ [CORE_URL]: new Error("404") });
  // 実行
  await highlightCodeBlocks({
    root,
    url: BASE_URL,
    isCurrent: () => true,
    modules: new Map(),
    importModule,
  });
  // 検証
  expect(root.innerHTML).toBe(before);
  expect(importModule.mock.calls.map(([url]) => url)).toEqual([CORE_URL]);
  expect(consoleError).toHaveBeenCalledTimes(1);
  const output = (consoleError.mock.calls[0] ?? []).map(String).join(" ");
  expect(output).toContain(CORE_URL);
  expect(output).toContain("404");
});

// 読めない言語だけ色分けせずに残す（異常系）
test("test_highlight_code_blocks_when_language_fails", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const yamlBefore = root.querySelectorAll("code")[1]?.innerHTML;
  const importModule = createImport({ [YAML_URL]: new Error("404") });
  // 実行
  await highlightCodeBlocks({
    root,
    url: BASE_URL,
    isCurrent: () => true,
    modules: new Map(),
    importModule,
  });
  // 検証
  const codes = root.querySelectorAll("code");
  expect(codes[0]?.querySelector('span[class^="hljs-"]')).not.toBeNull();
  expect(codes[1]?.innerHTML).toBe(yamlBefore);
  expect(consoleError).toHaveBeenCalledTimes(1);
  const output = (consoleError.mock.calls[0] ?? []).map(String).join(" ");
  expect(output).toContain("languages/yaml.min.js");
});

// 読み終えたときに描き直していたら色を当てない（正常系）
test("test_highlight_code_blocks_when_stale", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const root = createRoot();
  const before = root.innerHTML;
  // 実行
  await highlightCodeBlocks({
    root,
    url: BASE_URL,
    isCurrent: () => false,
    modules: new Map(),
    importModule: createImport(),
  });
  // 検証
  expect(root.innerHTML).toBe(before);
});

// 同じモジュールの控えで 2 回呼ぶとモジュールを読み直さない（正常系）
test("test_highlight_code_blocks_when_cached", async () => {
  // 準備
  const { highlightCodeBlocks } = await loadHighlight();
  const first = createRoot();
  const second = createRoot();
  const modules = new Map();
  const importModule = createImport();
  // 実行
  for (const root of [first, second]) {
    await highlightCodeBlocks({
      root,
      url: BASE_URL,
      isCurrent: () => true,
      modules,
      importModule,
    });
  }
  // 検証
  expect(importModule).toHaveBeenCalledTimes(3);
  expect(coloredCodes(first)).toHaveLength(2);
  expect(coloredCodes(second)).toHaveLength(2);
});

// 埋めたモジュールの URL があればそこから読み、埋めていない言語は読まない（正常系）
test("test_highlight_code_blocks_when_module_urls", async () => {
  // 準備
  const { highlightCodeBlocks, setSyntaxModuleUrls } = await loadHighlight();
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const root = createRoot();
  const yamlBefore = root.querySelectorAll("code")[1]?.innerHTML;
  const importModule = createImport();
  setSyntaxModuleUrls({
    core: "blob:core",
    languages: { typescript: "blob:ts" },
  });
  try {
    // 実行
    await highlightCodeBlocks({
      root,
      url: BASE_URL,
      isCurrent: () => true,
      modules: new Map(),
      importModule,
    });
  } finally {
    setSyntaxModuleUrls(undefined);
  }
  // 検証
  expect(importModule.mock.calls.map(([url]) => url).sort()).toEqual([
    "blob:core",
    "blob:ts",
  ]);
  const codes = root.querySelectorAll("code");
  expect(codes[0]?.querySelector('span[class^="hljs-"]')).not.toBeNull();
  expect(codes[1]?.innerHTML).toBe(yamlBefore);
  expect(consoleError).not.toHaveBeenCalled();
});
