import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 画像の代役の SVG（画面より高い）
const IMAGE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect width="200" height="400" fill="#999"/></svg>';

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

test.beforeEach(async ({ page }) => {
  await page.route("https://img.example.test/*", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: IMAGE_SVG }),
  );
});

// 図と表に種類ごとの番号を付け、参照のリンクの文字を番号にして図へ移る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 300 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- fig: arch -->",
      "![構成](https://img.example.test/arch.svg)",
      "",
      "<!-- fig: flow -->",
      "![流れ](https://img.example.test/flow.svg)",
      "",
      "<!-- fig: list -->",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "",
      "流れは [図](#fig-flow)、一覧は [表](#fig-list) を見る。",
      "",
    ].join("\n"),
  });
  // 検証: 番号と ID
  await expect(page.locator("#doc .mdmark-figure-caption")).toHaveText([
    "図 1",
    "図 2",
    "表 1",
  ]);
  for (const id of ["fig-arch", "fig-flow", "fig-list"]) {
    await expect(page.locator(`#doc figure[id="${id}"]`)).toHaveCount(1);
  }
  await expect(page.locator("#doc p a")).toHaveText(["図 2", "表 1"]);
  // 実行: 参照を押す
  await page.locator("#doc p a", { hasText: "図 2" }).click();
  // 検証: 2 つ目の図へ移る
  expect(new URL(page.url()).hash).toBe("#fig-flow");
  await expect(page.locator('#doc figure[id="fig-flow"] img')).toBeInViewport();
});

// 無い ID を指す参照は、リンクの文字をそのままにして書き方の警告を出す（異常シナリオ（切れた参照））
test("test_error_when_reference_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      "<!-- fig: arch -->\n![構成](https://img.example.test/arch.svg)\n\n本文の [図](#fig-missing) を見る。\n",
  });
  // 検証
  await expect(page.locator("#doc p a")).toHaveText("図");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "fig-missing",
  );
  await expect(page.locator("#doc .mdmark-figure-caption")).toHaveText("図 1");
});

// 同じ ID を 2 回書くと、1 つ目にだけ ID を付け、両方に番号を付けて警告を出す（異常シナリオ（同じ ID を 2 回書く））
test("test_error_when_id_duplicated", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      "<!-- fig: arch -->\n![一](https://img.example.test/one.svg)\n\n<!-- fig: arch -->\n![二](https://img.example.test/two.svg)\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-figure-caption")).toHaveText([
    "図 1",
    "図 2",
  ]);
  const withId = page.locator('#doc [id="fig-arch"]');
  await expect(withId).toHaveCount(1);
  await expect(withId.locator("img")).toHaveAttribute("alt", "一");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "arch",
  );
});
