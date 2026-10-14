import { expect, test } from "vitest";

/** エスケープの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadEscape = () => import("../../../../src/parts/escape.ts");

// 特別な文字を全て文字参照にする（正常系）
test("test_escape_html", async () => {
  // 準備
  const { escapeHtml } = await loadEscape();
  // 実行
  const escaped = escapeHtml(`<a href="x">'&'</a>`);
  // 検証
  expect(escaped).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
});
