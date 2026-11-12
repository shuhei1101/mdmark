import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を配置した作業ツリー
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
      '<!-- fig: {"id": "arch"} -->',
      "![構成](https://img.example.test/arch.svg)",
      "",
      '<!-- fig: {"id": "flow"} -->',
      "![流れ](https://img.example.test/flow.svg)",
      "",
      '<!-- fig: {"id": "list"} -->',
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

// 無い ID を指す参照は、リンクの文字をそのままにして記載の警告を出す（異常シナリオ（切れた参照））
test("test_error_when_reference_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      '<!-- fig: {"id": "arch"} -->\n![構成](https://img.example.test/arch.svg)\n\n本文の [図](#fig-missing) を見る。\n',
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
      '<!-- fig: {"id": "arch"} -->\n![一](https://img.example.test/one.svg)\n\n<!-- fig: {"id": "arch"} -->\n![二](https://img.example.test/two.svg)\n',
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

// マーカーのある図だけを数えてギャラリーの画像にサブ図の番号を付け、title をキャプションにする（正常シナリオ（ギャラリーのサブ図とキャプション））
test("test_normal_when_gallery_and_caption", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      '<!-- fig: {"id": "shots"} -->',
      '<!-- gallery: {"columns": 2} -->',
      "![一](https://img.example.test/one.svg)",
      "![二](https://img.example.test/two.svg)",
      "<!-- /gallery -->",
      "",
      '<!-- fig: {"id": "arch"} -->',
      '![構成図](https://img.example.test/arch.svg "構成")',
      "",
      '![写真の画像](https://img.example.test/photo.svg "写真")',
      "",
      "本文の [図](#fig-shots) を見る。",
      "",
    ].join("\n"),
  });
  // 検証: ギャラリーの図 1 と、サブ図の図 1a・図 1b
  await expect(
    page.locator('#doc figure[id="fig-shots"] > figcaption'),
  ).toHaveText("図 1");
  await expect(
    page.locator('#doc figure[id="fig-shots"] .mdmark-gallery figcaption b'),
  ).toHaveText(["図 1a", "図 1b"]);
  // 検証: マーカーのある画像は、番号と title のキャプション
  const arch = page.locator('#doc figure[id="fig-arch"] figcaption');
  await expect(arch.locator("b")).toHaveText("図 2");
  await expect(arch).toHaveText("図 2構成");
  // 検証: マーカーの無い画像は、title だけのキャプション
  const photo = page.locator(
    '#doc figure:has(img[alt="写真の画像"]) figcaption',
  );
  await expect(photo).toHaveText("写真");
  await expect(photo.locator("b")).toHaveCount(0);
  // 検証: 参照のリンクの文字
  await expect(page.locator('#doc p a[href="#fig-shots"]')).toHaveText("図 1");
});
