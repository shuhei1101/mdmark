import { expect, test } from "vitest";
import { findTag } from "../../../../helpers/html.ts";

/** 再生できない動画・音声の知らせを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPart = () =>
  import("../../../../../../vscode/src/webview/parts/media-error.ts");

// 形式とパスをエスケープして出す（正常系）
test("test_render_media_error", async () => {
  // 準備
  const { renderMediaError } = await loadPart();
  // 実行
  const html = renderMediaError({
    kind: "audio",
    format: "m4a",
    path: "media/<voice>.m4a",
  });
  // 検証
  expect(html).toContain("<code>m4a</code>");
  expect(html).toContain("<code>media/&lt;voice&gt;.m4a</code>");
  expect(html).not.toContain("<voice>");
  const link = findTag(html, 'data-action="openAsset"');
  expect(link.startsWith("<a")).toBe(true);
  expect(link).toContain('data-path="media/&lt;voice&gt;.m4a"');
});
