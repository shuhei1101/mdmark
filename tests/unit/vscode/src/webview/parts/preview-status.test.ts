import { expect, test } from "vitest";

/** プレビューの状態の表示を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  import("../../../../../../vscode/src/webview/parts/preview-status.ts");

// 指定したバージョンが無い理由とリロードを出し、バージョンをエスケープする（正常系）
test("test_render_preview_status", async () => {
  // 準備
  const { renderPreviewStatus } = await loadPart();
  // 実行
  const html = renderPreviewStatus({
    state: "versionMissing",
    version: "v9.9.9<b>",
  });
  // 検証
  expect(html).toContain('role="status"');
  expect(html).toContain("プレビューを表示できません");
  expect(html).toContain("<code>v9.9.9&lt;b&gt;</code>");
  expect(html).not.toContain("<b>");
  expect(html).toMatch(/<button\b[^>]*data-action="reload"/);
});

// 読み込み中は題と回る印だけ（正常系）
test("test_render_preview_status_when_loading", async () => {
  // 準備
  const { renderPreviewStatus } = await loadPart();
  // 実行
  const html = renderPreviewStatus({ state: "loading" });
  // 検証
  expect(html).toContain("mdmark を読み込んでいます");
  expect(html).toMatch(/<progress\b[^>]*aria-label="読み込み中"/);
  expect(html).not.toContain("<button");
});

// 差分に対応しないバージョンの理由とリロードを出す（正常系）
test("test_render_preview_status_when_diff_unsupported", async () => {
  // 準備
  const { renderPreviewStatus } = await loadPart();
  // 実行
  const html = renderPreviewStatus({
    state: "diffUnsupported",
    version: "v0.8.0",
  });
  // 検証: 部品設計の状態 DiffUnsupported の文言
  expect(html).toContain('role="status"');
  expect(html).toContain("プレビューを表示できません");
  expect(html).toContain("<code>v0.8.0</code>");
  expect(html).toContain("<code>mdmark.version</code>");
  expect(html).toContain("は差分の表示に対応していません");
  expect(html).toContain("リロードしてください");
  expect(html).toMatch(/<button\b[^>]*data-action="reload"/);
});
