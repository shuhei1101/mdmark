import { afterEach, expect, inject, test, vi } from "vitest";
import { STRENGTH_TEXT, wrapDirective } from "../../unit/helpers/diagrams.ts";

type Built = typeof import("../../../src/index.ts");

let built: Promise<Built> | undefined;
const elements: HTMLElement[] = [];

/** ビルドした配布物のファイルを、テスト用の開発サーバーが配る URL にする */
function distUrl(file: string): string {
  return `/@fs${inject("builtRoot")}/dist/${file}`;
}

/** ビルドした配布物の JS を 1 度だけ読み込む */
function loadBuilt(): Promise<Built> {
  built ??= import(/* @vite-ignore */ distUrl("index.js"));
  return built;
}

/** 描く先の要素を作り、ページに配置する */
function createElement(): HTMLElement {
  const el = document.createElement("div");
  document.body.append(el);
  elements.push(el);
  return el;
}

afterEach(() => {
  for (const el of elements.splice(0)) el.remove();
});

/** 原本だけの目印・機能のマーカー・表のマーカー・param の範囲を持つ文書 */
const MARKDOWN = [
  "# 文書",
  "",
  "<!-- 原本だけの目印 -->",
  "",
  '<!-- features: {"print": false} -->',
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| a | b |",
  "| --- | --- |",
  "| 1 | 2 |",
  "",
  "<!-- /table -->",
  "",
  wrapDirective("param", STRENGTH_TEXT),
  "",
].join("\n");

/** 描いた要素の本文（操作の部品が付けた要素を除いた、文字と見出し・表の構造） */
const bodyOf = (el: Element): string =>
  [...el.querySelectorAll("h1, table, .mdmark-param")]
    .map((node) => `${node.tagName}:${node.textContent?.trim() ?? ""}`)
    .join("\n");

// 描いた結果と純粋な Markdown を返却し、元の Markdown のマーカーをどちらにも残さない（正常系）
test("test_normal", async () => {
  // 準備
  const { renderForMount, mount } = await loadBuilt();
  // 実行
  const { rendered, pureMarkdown } = await renderForMount(MARKDOWN);
  // 検証
  for (const text of [rendered.html, pureMarkdown]) {
    expect(text).not.toContain("原本だけの目印");
    expect(text).not.toContain("<!-- table");
  }
  expect(rendered.features.print).toBe(false);
  expect(rendered.paramDefinitions).toHaveLength(1);
  const fromRendered = createElement();
  const fromMarkdown = createElement();
  const first = mount(fromRendered, { rendered, pureMarkdown });
  const second = mount(fromMarkdown, { markdown: MARKDOWN });
  await vi.waitFor(() => {
    expect(fromRendered.querySelector("table")).not.toBeNull();
    expect(fromMarkdown.querySelector("table")).not.toBeNull();
  });
  expect(bodyOf(fromRendered)).toBe(bodyOf(fromMarkdown));
  first.destroy();
  second.destroy();
});

// markdown が文字列でなければ描かずに TypeError を送出する（異常系）
test("test_error_when_markdown_not_string", async () => {
  // 準備
  const { renderForMount } = await loadBuilt();
  // 実行・検証
  await expect(
    renderForMount(null as unknown as string),
  ).rejects.toBeInstanceOf(TypeError);
});
