import { expect, test } from "vitest";
import { findTags } from "../../../helpers/html.ts";
import { renderDoc } from "../../../helpers/render.ts";

/** カードの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCards = () => import("../../../../../src/render/syntax/cards.ts");

// リンクと添付を見分ける（正常系）
test("test_card_of", async () => {
  // 準備
  const { cardOf } = await loadCards();
  // 実行
  const bare = cardOf(
    "https://example.com/docs/guide",
    "https://example.com/docs/guide",
    true,
  );
  const link = cardOf("https://example.com/design", "設計の資料", false);
  const file = cardOf("files/spec.pdf?v=1", "仕様書", false);
  // 検証
  expect(bare).toMatchObject({ kind: "link", title: "example.com/docs/guide" });
  expect(link).toMatchObject({ kind: "link", title: "設計の資料" });
  expect(file).toMatchObject({
    kind: "file",
    title: "仕様書",
    fileKind: "pdf",
  });
});

// カードにしないリンクは undefined（正常系）
test("test_card_of_when_not_card", async () => {
  // 準備
  const { cardOf } = await loadCards();
  const hrefs = [
    "#導入",
    "mailto:a@example.com",
    "guide.md",
    "ftp://example.com/a",
  ];
  // 実行
  const results = hrefs.map((href) => cardOf(href, "文字", false));
  // 検証
  expect(results).toEqual([undefined, undefined, undefined, undefined]);
});

// リンク 1 つだけの段落をカードにする（正常系）
test("test_build_cards", () => {
  // 準備
  const markdown = [
    "https://example.com/docs/guide",
    "",
    "[仕様書](files/spec.pdf)",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<a class="mdmark-card" data-card="link" href="https://example.com/docs/guide">',
  );
  expect(html).toContain(
    '<a class="mdmark-card" data-card="file" data-file-kind="pdf" href="files/spec.pdf">',
  );
});

// 文の中のリンクはカードにしない（正常系）
test("test_build_cards_when_inline", () => {
  // 準備
  const markdown = "詳しくは https://example.com/docs を見る。\n";
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-card");
});

// cards がオフならリンクのまま（正常系）
test("test_build_cards_when_feature_off", () => {
  // 準備
  const markdown = "https://example.com/docs/guide\n";
  // 実行
  const { html } = renderDoc(markdown, { cards: false });
  // 検証
  expect(html).not.toContain("mdmark-card");
  expect(findTags(html, "<a ")).toHaveLength(1);
});
