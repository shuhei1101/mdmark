import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 3 行の表。行の詳細の印を後ろに足して使う
const TABLE = "| 名前 | 数 |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n| c | 3 |\n";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 閉じた節を閉じて始め、見出しの開閉のボタンを押すたびに開閉する（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "## 概要\n\n概要の段落\n\n## 補足\n<!-- section: closed -->\n\n補足の段落\n",
  });
  const overview = page.getByRole("button", { name: "概要" });
  const note = page.getByRole("button", { name: "補足" });
  // 検証: 描いた直後
  await expect(page.getByText("概要の段落")).toBeVisible();
  await expect(page.getByText("補足の段落")).toBeHidden();
  // 実行・検証: 補足を開く
  await note.click();
  await expect(page.getByText("補足の段落")).toBeVisible();
  await expect(note).toHaveAttribute("aria-expanded", "true");
  // 実行・検証: 概要を閉じる
  await overview.click();
  await expect(page.getByText("概要の段落")).toBeHidden();
  await expect(overview).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#doc")).not.toContainText("section:");
  expect(await page.locator("#doc").innerHTML()).not.toContain("<!--");
});

// URL の ID が閉じた節の中の見出しを指すと、その節を開いて移る（正常シナリオ（閉じた節の中へ移る））
test("test_normal_when_fragment_in_closed_section", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 300 });
  await openPage(page, builtRoot, { hash: "#注意" });
  // 実行
  await mountDocument(page, {
    markdown:
      "## 補足\n<!-- section: closed -->\n\n### 注意\n\n注意の段落\n\n" +
      "余白\n\n".repeat(30),
  });
  // 検証
  await expect(page.getByRole("button", { name: "補足" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.locator("#doc h3", { hasText: "注意" })).toBeInViewport();
});

// 表の後の行の詳細の印で、指定した行に開閉のボタンを置き、押すと行の下に詳細を出す（正常シナリオ（行の詳細））
test("test_normal_when_row_detail", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: 2 -->\n\n詳細の段落\n\n- 詳細の項目\n\n<!-- /row-detail -->\n`,
  });
  const toggle = page.locator("#doc button.mdmark-row-toggle");
  // 検証: 描いた直後
  await expect(toggle).toHaveCount(1);
  await expect(
    page.locator("#doc tbody tr:nth-child(2) button.mdmark-row-toggle"),
  ).toHaveCount(1);
  await expect(page.getByText("詳細の段落")).toBeHidden();
  // 実行
  await toggle.click();
  // 検証
  const detail = page.locator(
    "#doc tbody tr:nth-child(2) + tr.mdmark-row-detail",
  );
  await expect(detail.locator("p")).toHaveText("詳細の段落");
  await expect(detail.locator("li")).toHaveText("詳細の項目");
  await expect(detail).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#doc > p")).toHaveCount(0);
});

// 知らない開閉の指定は、開いた節として描き、書き方の警告を出す（異常シナリオ（知らない開閉の指定））
test("test_error_when_unknown_section_value", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "## 補足\n<!-- section: hidden -->\n\n補足の段落\n",
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("hidden");
  await expect(warning).toContainText("closed");
  await expect(warning).toContainText("open");
  await expect(page.getByText("補足の段落")).toBeVisible();
});

// 表に無い行を指す行の詳細は、表の後に本文として描き、書き方の警告を出す（異常シナリオ（行の位置が表に無い））
test("test_error_when_row_out_of_range", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `${TABLE}\n<!-- row-detail: 5 -->\n\n詳細の段落\n\n<!-- /row-detail -->\n`,
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("3");
  await expect(warning).toContainText("5");
  await expect(page.getByText("詳細の段落")).toBeVisible();
  await expect(page.locator("#doc button.mdmark-row-toggle")).toHaveCount(0);
});
