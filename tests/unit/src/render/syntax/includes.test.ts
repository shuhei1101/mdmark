import MarkdownIt from "markdown-it";
import { expect, test } from "vitest";
import { findTags, innerHtml } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 取り込みの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadIncludes = () =>
  import("../../../../../src/render/syntax/includes.ts");

/** 1〜12 行目に `line N` を持つ本文 */
const TWELVE_LINES = Array.from(
  { length: 12 },
  (_, index) => `line ${index + 1}`,
).join("\n");

// 取り込んだ文書のフォルダを基準に解き、Markdown の `#L` は見出しにする（正常系）
test("test_resolve_include_path", async () => {
  // 準備
  const { resolveIncludePath } = await loadIncludes();
  // 実行
  const results = [
    resolveIncludePath("", "./共通/手順.md#実行"),
    resolveIncludePath("共通/手順.md", "../src/app.ts#L3-L5"),
    resolveIncludePath("", "src/app.ts#L5"),
    resolveIncludePath("", "a.md#L3-L5"),
  ];
  // 検証
  expect(results).toEqual([
    { key: "共通/手順.md", target: { kind: "heading", id: "実行" } },
    { key: "src/app.ts", target: { kind: "lines", from: 3, to: 5 } },
    { key: "src/app.ts", target: { kind: "lines", from: 5, to: 5 } },
    { key: "a.md", target: { kind: "heading", id: "L3-L5" } },
  ]);
});

// 全体・見出しの中・行の範囲を差し込む（正常系）
test("test_expand_includes", () => {
  // 準備
  const includes = {
    "共通/手順.md": "## 準備\n\n準備の本文\n\n## 実行\n\n実行の本文\n",
    "src/app.ts": TWELVE_LINES,
  };
  const markdown = [
    "<!-- include: 共通/手順.md -->",
    "",
    "<!-- include: 共通/手順.md#実行 -->",
    "",
    "<!-- include: src/app.ts#L3-L5 -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { includes });
  // 検証
  const wrappers = findTags(html, 'class="mdmark-include"');
  expect(wrappers).toHaveLength(3);
  const parts = html.split('class="mdmark-include"').slice(1);
  expect(findTags(parts[0] ?? "", "<h2")).toHaveLength(2);
  expect(findTags(parts[1] ?? "", "<h2")).toHaveLength(1);
  expect(parts[1]).toContain("実行の本文");
  expect(parts[1]).not.toContain("準備の本文");
  expect(parts[2]).toContain("language-ts");
  expect(parts[2]).toContain("line 3");
  expect(parts[2]).toContain("line 5");
  expect(parts[2]).not.toContain("line 6");
  const ids = [...html.matchAll(/<h2[^>]* id="([^"]+)"/g)].map((m) => m[1]);
  expect(new Set(ids).size).toBe(ids.length);
});

// 取り込めないと警告する（異常系）
test("test_expand_includes_when_missing", () => {
  // 準備
  const includes = { "a.md": "## 準備\n\n本文\n", "src/app.ts": TWELVE_LINES };
  const markdown = [
    "<!-- include: missing.md -->",
    "",
    "<!-- include: a.md#無い見出し -->",
    "",
    "<!-- include: src/app.ts#L20-L22 -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown, {}, { includes });
  // 検証
  const warnings = html.split("mdmark-syntax-warning").slice(1);
  expect(warnings).toHaveLength(3);
  expect(html).toContain("missing.md");
  expect(html).toContain("無い見出し");
  expect(html).toContain("12 行");
});

// 循環を止める（異常系）
test("test_expand_includes_when_circular", () => {
  // 準備
  const includes = {
    "a.md": "a の段落\n\n<!-- include: b.md -->\n",
    "b.md": "b の段落\n\n<!-- include: a.md -->\n",
  };
  const markdown = "<!-- include: a.md -->\n";
  // 実行
  const { html } = renderDoc(markdown, {}, { includes });
  // 検証
  expect(html.split("a の段落")).toHaveLength(2);
  expect(html.split("b の段落")).toHaveLength(2);
  expect(findTags(html, "mdmark-syntax-warning")).toHaveLength(1);
  expect(innerHtml(html, "mdmark-syntax-warning")).toContain(
    "a.md → b.md → a.md",
  );
});

// 同じか上の階層の見出しの前までを選ぶ（正常系）
test("test_select_heading_section", async () => {
  // 準備
  const { selectHeadingSection } = await loadIncludes();
  const tokens = new MarkdownIt().parse(
    "## 準備\n\nA\n\n## 実行\n\nB\n\n### 手順\n\nC\n\n## 片付け\n\nD\n",
    {},
  );
  // 実行
  const found = selectHeadingSection(tokens, "実行");
  const missing = selectHeadingSection(tokens, "無い");
  // 検証
  const contents = (found ?? []).map((token) => token.content);
  expect(contents[1]).toBe("実行");
  expect(contents).toContain("手順");
  expect(contents).toContain("C");
  expect(contents).not.toContain("片付け");
  expect(contents).not.toContain("A");
  expect(missing).toBeNull();
});

// 範囲の行を返し、越えたら行の数を返す（正常系）
test("test_select_lines", async () => {
  // 準備
  const { selectLines } = await loadIncludes();
  // 実行
  const inside = selectLines(TWELVE_LINES.replaceAll("\n", "\r\n"), 3, 5);
  const outside = selectLines(TWELVE_LINES, 20, 22);
  // 検証
  expect(inside).toEqual({ text: "line 3\nline 4\nline 5" });
  expect(outside).toEqual({ lineCount: 12 });
});
