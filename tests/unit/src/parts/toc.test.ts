import { expect, test } from "vitest";

/** 目次の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadToc = () => import("../../../../src/parts/toc.ts");

// h3 を直前の h2 の入れ子にする（正常系）
test("test_render_toc", async () => {
  // 準備
  const { renderToc } = await loadToc();
  // 実行
  const html = renderToc({
    headings: [
      { level: 2, id: "導入", text: "導入" },
      { level: 3, id: "前提", text: "前提" },
      { level: 2, id: "使い方", text: "使い方" },
    ],
  });
  // 検証
  expect(html.startsWith('<nav class="mdmark-toc" aria-label="目次">')).toBe(
    true,
  );
  expect(html).toContain(
    '<li><a href="#導入">導入</a><ul><li><a href="#前提">前提</a></li></ul></li>',
  );
  expect(html).toContain('<li><a href="#使い方">使い方</a></li>');
});
