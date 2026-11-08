import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** `example.com` への要求を数え始め、件数を返却する関数を返却する */
function countExampleRequests(page: Page): () => number {
  let requests = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("example.com")) {
      requests += 1;
    }
  });
  return () => requests;
}

// リンク 1 つだけの段落を、リンクのカードと添付のカードに描き、外へ要求しない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  const requests = countExampleRequests(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "https://example.com/docs/guide",
      "",
      "[設計の資料](https://example.com/design)",
      "",
      "[仕様書](files/spec.pdf)",
      "",
    ].join("\n"),
  });
  // 検証: 3 つのカード
  const cards = page.locator("#doc a.mdmark-card");
  await expect(cards).toHaveCount(3);
  const [url, titled, file] = [cards.nth(0), cards.nth(1), cards.nth(2)];
  // 1 つ目: URL だけのリンクのカード
  await expect(url).toHaveAttribute("data-card", "link");
  await expect(url).toHaveAttribute("href", "https://example.com/docs/guide");
  await expect(url.locator(".mdmark-card-domain")).toHaveText("example.com");
  await expect(url.locator(".mdmark-card-url")).toHaveText(
    "https://example.com/docs/guide",
  );
  // 2 つ目: 記載した文字のリンクのカード
  await expect(titled).toHaveAttribute("data-card", "link");
  await expect(titled).toHaveAttribute("href", "https://example.com/design");
  await expect(titled.locator(".mdmark-card-title")).toHaveText("設計の資料");
  await expect(titled.locator(".mdmark-card-domain")).toHaveText("example.com");
  await expect(titled.locator(".mdmark-card-url")).toHaveText(
    "https://example.com/design",
  );
  // 3 つ目: PDF のアイコンとファイル名の添付のカード
  await expect(file).toHaveAttribute("data-card", "file");
  await expect(file).toHaveAttribute("data-file-kind", "pdf");
  await expect(file).toHaveAttribute("href", "files/spec.pdf");
  await expect(file.locator(".mdmark-card-title")).toHaveText("仕様書");
  await expect(file.locator(".mdmark-card-url")).toHaveText("spec.pdf");
  const icon = file.locator(".mdmark-card-icon");
  await expect(icon).toBeVisible();
  const [fileIcon, linkIcon] = await Promise.all(
    [icon, url.locator(".mdmark-card-icon")].map((element) =>
      element.evaluate((span) => getComputedStyle(span, "::before").maskImage),
    ),
  );
  // PDF の種類のアイコンは、文書の行を持つファイルの構造で、リンクの構造と違う
  expect(decodeURIComponent(fileIcon ?? "")).toContain("M10 9H8");
  expect(fileIcon).not.toBe(linkIcon);
  // 検証: カードはそれぞれ 1 つのリンクで、Tab で順にフォーカスできる
  for (const card of [url, titled, file]) {
    await expect(card.locator("a")).toHaveCount(0);
  }
  for (const card of [url, titled, file]) {
    await page.keyboard.press("Tab");
    await expect(card).toBeFocused();
  }
  // 検証: カードを描くために外へ要求しない
  expect(requests()).toBe(0);
});

// 文の中のリンクはカードにせず、今のままのリンクで描く（正常シナリオ（文の中のリンク））
test("test_normal_when_link_in_sentence", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "詳しくは https://example.com/docs を見る。",
      "",
      "[仕様書](files/spec.pdf) と [導入の手順](https://example.com/setup)",
      "",
    ].join("\n"),
  });
  // 検証
  await expect(page.locator("#doc .mdmark-card")).toHaveCount(0);
  await expect(page.locator("#doc p a")).toHaveText([
    "https://example.com/docs",
    "仕様書",
    "導入の手順",
  ]);
  await expect(page.locator("#doc p", { hasText: "詳しくは" })).toHaveText(
    "詳しくは https://example.com/docs を見る。",
  );
});
