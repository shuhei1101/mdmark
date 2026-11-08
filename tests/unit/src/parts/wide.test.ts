import { expect, test } from "vitest";
import { findTag } from "../../helpers/html.ts";

/** wide の範囲の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadWide = () => import("../../../../src/parts/wide.ts");

// ボタンの有無と状態を描く（正常系）
test("test_render_wide", async () => {
  // 準備
  const { renderWide } = await loadWide();
  // 実行
  const withToggle = renderWide({
    body: "<table></table>",
    state: "wide",
    toggle: true,
  });
  const withoutToggle = renderWide({
    body: "<table></table>",
    state: "narrow",
    toggle: false,
  });
  // 検証
  expect(findTag(withToggle, "mdmark-wide-bar")).toContain("<div");
  const button = findTag(withToggle, "mdmark-wide-toggle");
  expect(button).toContain('aria-pressed="true"');
  expect(button).toContain('aria-label="広げて表示"');
  expect(withToggle).toContain(
    '<div class="mdmark-wide-range" data-state="wide">',
  );
  expect(withToggle.indexOf("mdmark-wide-bar")).toBeLessThan(
    withToggle.indexOf("mdmark-wide-range"),
  );
  expect(withoutToggle).not.toContain("mdmark-wide-bar");
  expect(withoutToggle).toContain(
    '<div class="mdmark-wide-range" data-state="narrow"><table></table></div>',
  );
});
