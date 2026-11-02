import { expect, test } from "vitest";
import { findTag, innerHtml, plainText } from "../../helpers/html.ts";

/** カードの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCard = () => import("../../../../src/parts/card.ts");

// リンクのカードにホストと URL を出す（正常系）
test("test_render_card", async () => {
  // 準備
  const { renderCard } = await loadCard();
  // 実行（部品設計の Link）
  const html = renderCard({
    kind: "link",
    href: "https://github.com/shuhei1101/mdmark",
    title: "mdmark のリポジトリ",
  });
  // 検証
  expect(findTag(html, 'class="mdmark-card"')).toContain('data-card="link"');
  expect(plainText(innerHtml(html, 'class="mdmark-card-domain"'))).toBe(
    "github.com",
  );
  expect(plainText(innerHtml(html, 'class="mdmark-card-url"'))).toBe(
    "https://github.com/shuhei1101/mdmark",
  );
  expect(plainText(innerHtml(html, 'class="mdmark-card-title"'))).toBe(
    "mdmark のリポジトリ",
  );
});

// 添付のカードに拡張子とファイル名を出す（正常系）
test("test_render_card_when_file", async () => {
  // 準備
  const { renderCard } = await loadCard();
  // 実行（部品設計の FilePdf）
  const html = renderCard({
    kind: "file",
    href: "./files/design.pdf",
    title: "設計の資料",
    fileKind: "pdf",
  });
  // 検証
  const tag = findTag(html, 'class="mdmark-card"');
  expect(tag).toContain('data-card="file"');
  expect(tag).toContain('data-file-kind="pdf"');
  expect(plainText(innerHtml(html, 'class="mdmark-card-domain"'))).toBe("PDF");
  expect(plainText(innerHtml(html, 'class="mdmark-card-url"'))).toBe(
    "design.pdf",
  );
});

// タイトルと URL をエスケープする（正常系）
test("test_render_card_when_escaped", async () => {
  // 準備
  const { renderCard } = await loadCard();
  // 実行
  const html = renderCard({
    kind: "link",
    href: "https://example.com/?a=1&b=2",
    title: "<b>資料</b>",
  });
  // 検証
  expect(html).toContain("&lt;b&gt;資料&lt;/b&gt;");
  expect(html).not.toContain("<b>資料</b>");
  expect(html).toContain('href="https://example.com/?a=1&amp;b=2"');
});
