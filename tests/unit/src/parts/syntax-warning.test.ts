import { expect, test } from "vitest";
import { matches } from "../../helpers/html.ts";

/** 記載の警告の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadSyntaxWarning = () =>
  import("../../../../src/parts/syntax-warning.ts");

// タイトル・マーカー・本文・項目を出し、マーカーをエスケープする（正常系）
test("test_render_syntax_warning", async () => {
  // 準備
  const { renderSyntaxWarning } = await loadSyntaxWarning();
  // 実行
  const html = renderSyntaxWarning({
    mark: '<!-- table: {"kind": "x"} -->',
    message: "の読み込めない指定を当てずに描いています。",
    items: [{ label: "kind", message: "`x` は選べる値にありません" }],
  });
  // 検証
  expect(
    html.startsWith('<div class="mdmark-syntax-warning" role="note">'),
  ).toBe(true);
  expect(html).toContain("記載の警告");
  expect(html).toContain(
    "<code>&lt;!-- table: {&quot;kind&quot;: &quot;x&quot;} --&gt;</code>",
  );
  expect(matches(html, /<li>/g)).toHaveLength(1);
  expect(html).toContain("<code>kind</code>");
});

// マーカーと項目が無ければ本文だけを出す（正常系）
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
