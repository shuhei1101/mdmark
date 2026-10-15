import { expect, test } from "vitest";
import { matches } from "../../helpers/html.ts";

/** 書き方の警告の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSyntaxWarning = () =>
  import("../../../../src/parts/syntax-warning.ts");

// 題・印・本文・項目を出し、印をエスケープする（正常系）
test("test_render_syntax_warning", async () => {
  // 準備
  const { renderSyntaxWarning } = await loadSyntaxWarning();
  // 実行
  const html = renderSyntaxWarning({
    mark: "<!-- table: data +x -->",
    message: "の読めない指定を当てずに描いています。",
    items: [{ label: "+x", message: "使えない機能です" }],
  });
  // 検証
  expect(
    html.startsWith('<div class="mdmark-syntax-warning" role="note">'),
  ).toBe(true);
  expect(html).toContain("書き方の警告");
  expect(html).toContain("<code>&lt;!-- table: data +x --&gt;</code>");
  expect(matches(html, /<li>/g)).toHaveLength(1);
  expect(html).toContain("<code>+x</code>");
});

// 印と項目が無ければ本文だけを出す（正常系）
test("test_render_syntax_warning_without_mark", async () => {
  // 準備
  const { renderSyntaxWarning } = await loadSyntaxWarning();
  // 実行
  const html = renderSyntaxWarning({ message: "本文だけ" });
  // 検証
  expect(html).toContain("<p>本文だけ</p>");
  expect(html).not.toContain("<code>");
  expect(html).not.toContain("<ul>");
});
