import { expect, test } from "vitest";
import { findTag, outerHtml, plainText } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** 題・状態・担当の列と 3 行を持つ表 */
const TABLE = [
  "| 題 | 状態 | 担当 |",
  "| --- | --- | --- |",
  "| 配色の変数を洗い出す | 未着手 | 佐藤 |",
  "| 余白の変数を決める | 進行中 | 鈴木 |",
  "| 印刷を直す | 完了 | 佐藤 |",
  "",
].join("\n");

/** ビューの印の引数を指定して、表を印で囲んだ文書にする */
function viewMarkdown(args: string): string {
  return `<!-- view: ${args} -->\n\n${TABLE}\n<!-- /view -->\n`;
}

/** `div.mdmark-view` の `data-view` を JSON として読む */
function readViewSpec(html: string): unknown {
  const tag = findTag(html, 'class="mdmark-view"');
  const raw = /data-view="([^"]*)"/.exec(tag)?.[1] ?? "";
  return JSON.parse(
    raw
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  );
}

// 範囲を囲みにし、表を data の種類にする（正常系）
test("test_build_views", () => {
  // 準備
  const markdown = viewMarkdown("group=状態 filter=担当 icons=完了:archive");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(readViewSpec(html)).toEqual({
    group: 1,
    mode: "board",
    boardDisabled: "",
    icons: { 完了: "archive" },
  });
  const table = findTag(html, 'class="mdmark-table"');
  expect(table).toContain('data-kind="data"');
  expect(table).toContain('data-filter="2:select"');
  expect(html).not.toContain("<!--");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 表に無い group の列を警告にし、表で描く（正常系）
test("test_build_views_when_group_missing", () => {
  // 準備
  const markdown = viewMarkdown("group=優先度");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = outerHtml(html, "mdmark-syntax-warning");
  expect(plainText(warning)).toContain("の列 優先度 は表にありません");
  expect(html.indexOf("mdmark-syntax-warning")).toBeLessThan(
    html.indexOf('class="mdmark-view"'),
  );
  const spec = readViewSpec(html) as { mode: string; boardDisabled: string };
  expect(spec.mode).toBe("table");
  expect(spec.boardDisabled).not.toBe("");
  expect(warning).toContain(`id="${spec.boardDisabled}"`);
});

// 範囲に表が無いと警告を出して中身を残す（正常系）
test("test_build_views_when_no_table", () => {
  // 準備
  const markdown =
    "<!-- view: group=状態 -->\n\n範囲の段落\n\n<!-- /view -->\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = outerHtml(html, "mdmark-syntax-warning");
  expect(plainText(warning)).toContain("の範囲に、項目にする表がありません");
  expect(html).toContain("<p>範囲の段落</p>");
  expect(html).not.toContain('class="mdmark-view"');
});

// 使えないアイコンは当てずに警告にする（正常系）
test("test_build_views_when_unknown_icon", () => {
  // 準備
  const markdown = viewMarkdown("group=状態 icons=完了:rocket");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warning = outerHtml(html, "mdmark-syntax-warning");
  expect(plainText(warning)).toContain("のアイコン rocket は使えません");
  expect(readViewSpec(html)).toMatchObject({ icons: {} });
});

// views がオフなら囲まずに表だけを描く（正常系）
test("test_build_views_when_disabled", () => {
  // 準備
  const markdown = `<!-- features: -views -->\n\n${viewMarkdown("group=状態")}`;
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-view");
  expect(findTag(html, 'class="mdmark-table"')).not.toContain(
    'data-kind="data"',
  );
  expect(html).not.toContain("<!--");
  expect(plainText(html)).not.toContain("group=");
});
