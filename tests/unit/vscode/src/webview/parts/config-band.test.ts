import { expect, test } from "vitest";

/** 設定ファイルを読めない帯を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  import("../../../../../../vscode/src/webview/parts/config-band.ts");

// 題・パス・行とボタンを出し、パスをエスケープする（正常系）
test("test_render_config_band", async () => {
  // 準備
  const { renderConfigBand } = await loadPart();
  // 実行
  const html = renderConfigBand({ path: "a<b>.yaml", line: 4 });
  // 検証
  expect(html).toContain('role="status"');
  expect(html).toMatch(/<h2\b[^>]*>\s*設定ファイルを読み込めません/);
  expect(html).toContain("<code>a&lt;b&gt;.yaml</code>");
  expect(html).not.toContain("<b>");
  expect(html).toContain("4 行目");
  expect(html).toMatch(/<button\b[^>]*data-action="openConfig"/);
});
