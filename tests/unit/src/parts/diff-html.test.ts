import { expect, test } from "vitest";
import { findTag, findTags, plainText } from "../../helpers/html.ts";

/** 埋め込んだ HTML の差分の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadDiffHtml = () => import("../../../../src/parts/diff-html.ts");

// 範囲のソースの行の HTML
const LINES =
  '<div class="mdmark-diff-line" data-kind="same"><span class="mdmark-diff-text">&lt;table&gt;</span></div>';

// 前と後の範囲の HTML
const BEFORE = { label: "2026/10/19 16:40 件数を直す", html: "<p>前の表</p>" };
const AFTER = { label: "2026/10/20 11:05 見出しを直す", html: "<p>後の表</p>" };

// 変えた範囲に見方のボタンを付け、既定でソースを出す（正常系）
test("test_render_diff_html", async () => {
  // 準備
  const { renderDiffHtml } = await loadDiffHtml();
  // 実行
  const html = renderDiffHtml({
    changed: true,
    lines: LINES,
    before: BEFORE,
    after: AFTER,
  });
  // 検証
  const group = findTag(html, 'aria-label="HTML の見方"');
  expect(group).toContain('role="group"');
  expect(findTag(html, 'data-view="source"')).toContain('aria-pressed="true"');
  expect(findTag(html, 'data-view="rendered"')).toContain(
    'aria-pressed="false"',
  );
  expect(findTag(html, 'data-pane="rendered"')).toMatch(/\bhidden\b/);
  expect(findTag(html, 'data-pane="source"')).not.toMatch(/\bhidden\b/);
  expect(plainText(html)).toContain("ソース");
  expect(plainText(html)).toContain("プレビュー");
  expect(plainText(html)).toContain("HTML");
});

// 変えていない範囲はラベルだけの見出しにする（正常系）
test("test_render_diff_html_when_unchanged", async () => {
  // 準備
  const { renderDiffHtml } = await loadDiffHtml();
  // 実行
  const html = renderDiffHtml({ changed: false, lines: LINES });
  // 検証
  expect(plainText(html)).toContain("HTML");
  expect(findTags(html, "mdmark-diff-html-label")).toHaveLength(1);
  expect(html).not.toContain("aria-pressed");
  expect(html).not.toContain("HTML の見方");
});

// 片側にしか無い範囲は無い側にそのことを出す（正常系）
test("test_render_diff_html_when_one_side", async () => {
  // 準備
  const { renderDiffHtml } = await loadDiffHtml();
  // 実行
  const html = renderDiffHtml({
    changed: true,
    view: "rendered",
    lines: LINES,
    before: null,
    after: AFTER,
  });
  // 検証
  expect(plainText(html)).toContain("前のリビジョンには、この範囲がありません");
  expect(plainText(html)).not.toContain(
    "後のリビジョンには、この範囲がありません",
  );
  expect(html).toContain("<p>後の表</p>");
});
