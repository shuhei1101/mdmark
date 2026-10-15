import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 画面より長い文書（目次の印と 3 つの見出し）
const LONG_MARKDOWN = [
  "<!-- toc -->",
  "",
  "## 導入",
  "",
  "導入の段落",
  "",
  "余白\n\n".repeat(30),
  "### 前提",
  "",
  "前提の段落",
  "",
  "余白\n\n".repeat(30),
  "## 使い方",
  "",
  "使い方の段落",
  "",
  "余白\n\n".repeat(30),
].join("\n");

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

// 見出しに ID とリンクを付け、目次を置き、目次を押すと節へ移る（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 400 });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: LONG_MARKDOWN });
  // 検証: 目次
  const toc = page.locator("#doc nav.mdmark-toc");
  await expect(toc.locator("a")).toHaveText(["導入", "前提", "使い方"]);
  expect(
    await toc
      .locator("a")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href"))),
  ).toEqual(["#導入", "#前提", "#使い方"]);
  await expect(toc.locator("li li a")).toHaveText("前提");
  // 検証: 見出しのリンク
  for (const [id, label] of [
    ["導入", "導入"],
    ["前提", "前提"],
    ["使い方", "使い方"],
  ]) {
    const heading = page.locator(`#doc [id="${id}"]`);
    await expect(heading).toHaveText(label);
    await expect(heading.locator("a.mdmark-anchor")).toHaveAttribute(
      "href",
      `#${id}`,
    );
  }
  // 実行: 目次の「使い方」を押す
  await toc.locator("a", { hasText: "使い方" }).click();
  // 検証
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#使い方");
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
});

// 見出しの ID を、記号を除き小文字にして、同じ文字には通し番号を付ける GitHub と同じ規則で付ける（正常シナリオ（GitHub と同じ規則の ID））
test("test_normal_when_github_ids", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "## Hello, World!\n\n## 使い方\n\n## 使い方\n",
  });
  // 検証
  const ids = await page
    .locator("#doc h2")
    .evaluateAll((headings) => headings.map((heading) => heading.id));
  expect(ids).toEqual(["hello-world", "使い方", "使い方-1"]);
});

// URL に節の ID を付けて開くと、描いた後にその見出しへ移る（正常シナリオ（URL に節の ID を付けて開く））
test("test_normal_when_opened_with_fragment", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 800, height: 400 });
  await openPage(page, builtRoot, { hash: "#使い方" });
  // 実行
  await mountDocument(page, { markdown: LONG_MARKDOWN });
  // 検証
  await expect(page.locator('#doc [id="使い方"]')).toBeInViewport();
});
