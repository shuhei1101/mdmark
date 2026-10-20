import { expect, test } from "vitest";

/** ヒントの印と中身を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadHint = () => import("../../../../src/parts/hint.ts");

// ブロックの要素には印、行内の要素には tabindex を付ける（正常系）
test("test_render_hint_markup", async () => {
  // 準備
  const { renderHintMarkup } = await loadHint();
  // 実行
  const block = renderHintMarkup({
    tag: "div",
    text: "説明",
    id: "mdmark-hint-1",
  });
  const inline = renderHintMarkup({
    tag: "span",
    text: "分類の説明",
    id: "mdmark-hint-2",
  });
  // 検証
  expect(block.placement).toBe("block");
  expect(block.attributes.class).toContain("mdmark-hint-block");
  expect(block.inside).toContain("mdmark-hint-mark");
  expect(block.inside).toContain('aria-label="説明"');
  expect(block.inside).toContain('aria-describedby="mdmark-hint-1"');
  expect(block.after).toContain('role="tooltip"');
  expect(block.after).toMatch(/\bhidden\b/);
  expect(block.after).toContain('id="mdmark-hint-1"');
  expect(inline.placement).toBe("inline");
  expect(inline.attributes.class).toContain("mdmark-hint-inline");
  expect(inline.attributes.tabindex).toBe("0");
  expect(inline.attributes["aria-describedby"]).toBe("mdmark-hint-2");
  expect(inline.inside).toBe("");
  expect(inline.after).toContain('role="tooltip"');
  expect(inline.after).toMatch(/\bhidden\b/);
});
