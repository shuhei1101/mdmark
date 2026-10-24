import hljs from "highlight.js/lib/core";
import yaml from "highlight.js/lib/languages/yaml";
import { expect, test } from "vitest";

/** 色分けした HTML を行に分ける処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLines = () => import("../../../src/highlight-lines.ts");

/** タグを外してエスケープを戻した文字にする */
function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

// 行をまたぐ文字列を色分けし、行の数と文字を変えない（正常系）
test("test_highlight_lines", async () => {
  // 準備
  const { highlightLines } = await loadLines();
  const instance = hljs.newInstance();
  instance.registerLanguage("yaml", yaml);
  const lines = ["key: |", "  a < b", "  c"];
  // 実行
  const result = highlightLines({ hljs: instance, language: "yaml", lines });
  // 検証
  expect(result).toHaveLength(3);
  for (const html of result.slice(1)) {
    expect(html.startsWith('<span class="hljs-string">')).toBe(true);
    expect(html.endsWith("</span>")).toBe(true);
  }
  expect(result.map(plainText)).toEqual(lines);
});

// 行をまたぐ span を行末で閉じ、次の行で開き直す（正常系）
test("test_split_highlighted_lines", async () => {
  // 準備
  const { splitHighlightedLines } = await loadLines();
  const html = '<span class="hljs-comment">/*\n * a\n */</span>\nx';
  // 実行
  const result = splitHighlightedLines(html);
  // 検証
  expect(result).toEqual([
    '<span class="hljs-comment">/*</span>',
    '<span class="hljs-comment"> * a</span>',
    '<span class="hljs-comment"> */</span>',
    "x",
  ]);
});

// 入れ子の span を内側から閉じ、外側から開き直す（正常系）
test("test_split_highlighted_lines_when_nested", async () => {
  // 準備
  const { splitHighlightedLines } = await loadLines();
  const html =
    '<span class="hljs-string">`a<span class="hljs-subst">$' +
    "{b\nc}</span>`</span>";
  // 実行
  const result = splitHighlightedLines(html);
  // 検証
  expect(result).toHaveLength(2);
  expect(result[0]?.endsWith("</span></span>")).toBe(true);
  expect(
    result[1]?.startsWith(
      '<span class="hljs-string"><span class="hljs-subst">c}',
    ),
  ).toBe(true);
});

// 改行が無ければそのまま 1 要素で返す（正常系）
test("test_split_highlighted_lines_when_single_line", async () => {
  // 準備
  const { splitHighlightedLines } = await loadLines();
  const html = '<span class="hljs-number">1</span> &lt; 2';
  // 実行
  const result = splitHighlightedLines(html);
  // 検証
  expect(result).toEqual([html]);
});
