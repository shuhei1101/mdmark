import { expect, test } from "vitest";
import { findTag, matches } from "../../helpers/html.ts";

/** 関連文書の一覧の部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBacklinks = () => import("../../../../src/parts/backlinks.ts");

// 題「関連文書」と項目を並びのとおりに返す（正常系）
test("test_render_backlinks", async () => {
  // 準備
  const { renderBacklinks } = await loadBacklinks();
  // 実行
  const html = renderBacklinks({
    id: "backlinks-two",
    docs: [
      { title: "API", href: "../api.md" },
      { title: "使い方", href: "../使い方/guide.md" },
    ],
  });
  // 検証
  expect(findTag(html, 'id="backlinks-two"')).toContain(
    'class="mdmark-backlinks-title"',
  );
  expect(html).toContain(">関連文書<");
  expect(findTag(html, "<nav")).toContain('aria-labelledby="backlinks-two"');
  expect(matches(html, /<a href="[^"]*">[^<]*<\/a>/g)).toEqual([
    '<a href="../api.md">API</a>',
    '<a href="../使い方/guide.md">使い方</a>',
  ]);
});

// 文書が無ければ空文字を返す（正常系）
test("test_render_backlinks_when_empty", async () => {
  // 準備
  const { renderBacklinks } = await loadBacklinks();
  // 実行
  const html = renderBacklinks({ id: "backlinks-empty", docs: [] });
  // 検証
  expect(html).toBe("");
});
