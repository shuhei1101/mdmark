import { expect, test } from "vitest";

/** 注意書きの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCallout = () => import("../../../../src/parts/callout.ts");

// 種類の class と題を出す（正常系）
test("test_render_callout", async () => {
  // 準備
  const { renderCallout } = await loadCallout();
  // 実行
  const html = renderCallout({ kind: "warning", body: "<p>本文</p>" });
  // 検証
  expect(html).toContain(
    '<div class="markdown-alert markdown-alert-warning"><p class="markdown-alert-title">警告</p>',
  );
});

// 折り畳みは details にする（正常系）
test("test_render_callout_when_collapsed", async () => {
  // 準備
  const { renderCallout } = await loadCallout();
  // 実行
  const html = renderCallout({
    kind: "note",
    collapsed: true,
    body: "<p>本文</p>",
  });
  // 検証
  expect(html).toContain(
    '<details class="markdown-alert markdown-alert-note"><summary class="markdown-alert-title">補足</summary>',
  );
});
