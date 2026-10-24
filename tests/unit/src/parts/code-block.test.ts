import { expect, test } from "vitest";
import { findTag, findTags } from "../../helpers/html.ts";

/** コードブロックの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCodeBlock = () => import("../../../../src/parts/code-block.ts");

// 題・行番号・行の種類を付け、文字をエスケープする（正常系）
test("test_render_code_block", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "a<b>.ts",
    lineNumbers: true,
    lines: [{ text: "x < 1", kind: "add" }, { text: "y" }],
  });
  // 検証
  expect(html).toContain(
    '<figcaption class="mdmark-code-title">a&lt;b&gt;.ts</figcaption>',
  );
  const pre = findTag(html, "<pre");
  expect(pre).toContain("mdmark-code-lines");
  expect(pre).toContain("mdmark-code-numbered");
  expect(pre).toContain("mdmark-code-signs");
  expect(pre).toContain('aria-label="コード: a&lt;b&gt;.ts"');
  const lines = findTags(html, 'class="mdmark-code-line"');
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain('data-line="1"');
  expect(lines[0]).toContain('data-kind="add"');
  expect(lines[1]).toContain('data-line="2"');
  expect(lines[1]).not.toContain("data-kind");
  expect(html).toContain('<span class="mdmark-code-text">x &lt; 1</span>');
});

// 題だけなら行に分けない（正常系）
test("test_render_code_block_when_title_only", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  // 実行
  const html = renderCodeBlock({
    language: "yaml",
    title: "a.yaml",
    lineNumbers: false,
    lines: [{ text: "features:" }, { text: "  code: true" }],
  });
  // 検証
  expect(html.startsWith('<figure class="mdmark-code"')).toBe(true);
  expect(findTag(html, "<pre")).not.toContain("class=");
  expect(html).not.toContain("mdmark-code-line");
});

// 行の数の桁の数を渡す（正常系）
test("test_render_code_block_when_two_digits", async () => {
  // 準備
  const { renderCodeBlock } = await loadCodeBlock();
  const lines = Array.from({ length: 13 }, (_, index) => ({
    text: `line ${index + 1}`,
  }));
  // 実行
  const html = renderCodeBlock({
    language: "ts",
    title: "",
    lineNumbers: true,
    lines,
  });
  // 検証
  expect(findTag(html, "<code")).toContain('style="--mdmark-code-digits: 2"');
  const last = findTags(html, 'class="mdmark-code-line"').at(-1);
  expect(last).toContain('data-line="13"');
});
