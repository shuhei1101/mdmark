import { join } from "node:path";
import { expect, openStandalone, runCli, test, writeFiles } from "../cli.ts";

// 文書 A（entry）・B・C をまとめる: A は文書間のリンクを持たず、B は C へリンクし、目次の印と h2 を 2 つ持つ
const DOCUMENTS = {
  "mdmark.config.yaml": [
    "build:",
    '  include: ["A.md", "B.md", "C.md"]',
    "  entry: A.md",
    "  out: dist/docs.html",
    "",
  ].join("\n"),
  "A.md": "# 文書A\n\n入口の文書。\n",
  "B.md": [
    "# 文書B",
    "",
    "<!-- toc -->",
    "",
    "## First",
    "",
    "一つ目の節。",
    "",
    "## Second",
    "",
    "二つ目の節。",
    "",
    "[C へ](C.md)",
    "",
  ].join("\n"),
  "C.md": "# 文書C\n\n三つ目の文書。\n",
};

/** 3 つの文書をまとめた HTML を作り、そのパスを返す */
async function buildBundle(
  builtRoot: string,
  tempDir: () => Promise<string>,
): Promise<string> {
  const dir = await tempDir();
  await writeFiles(dir, DOCUMENTS);
  const result = await runCli(builtRoot, ["build"], dir);
  expect(result.code).toBe(0);
  return join(dir, "dist", "docs.html");
}

// 文書の一覧・目次・文書間のリンク・戻る・進むで文書を行き来する（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const htmlFile = await buildBundle(builtRoot, tempDir);
  const h1 = page.locator("article.mdmark h1");
  const current = page.locator('.mdmark-bundle-side a[aria-current="page"]');
  // 実行・検証
  const opened = await openStandalone(page, { tempDir, htmlFile });
  await expect(h1).toContainText("文書A");
  await expect(current).toHaveText("文書A");
  await page.locator('.mdmark-bundle-side a[data-doc-path="B.md"]').click();
  await expect(h1).toContainText("文書B");
  await expect(page).toHaveURL(/#\/B\.md$/);
  // 目次のリンクで B の中の見出しへ移り、開いている文書は B のまま
  await page.locator("article nav.mdmark-toc a", { hasText: "Second" }).click();
  await expect(page).toHaveURL(/#\/B\.md#second$/);
  await expect(h1).toContainText("文書B");
  await expect(current).toHaveText("文書B");
  await page.locator('article p a[data-doc-path="C.md"]').click();
  await expect(h1).toContainText("文書C");
  await page.goBack();
  await expect(h1).toContainText("文書B");
  await page.goBack();
  await expect(h1).toContainText("文書A");
  await page.goForward();
  await expect(h1).toContainText("文書B");
  expect(opened.externalRequests()).toEqual([]);
});

// URL の # が文書と見出しを指すと、その見出しが画面に入る（正常シナリオ（URL が文書と見出しを指す））
test("test_normal_when_url_points_heading", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const htmlFile = await buildBundle(builtRoot, tempDir);
  // 実行
  await openStandalone(page, { tempDir, htmlFile, hash: "#/B.md#second" });
  // 検証
  await expect(page.locator("article.mdmark h1")).toContainText("文書B");
  await expect(page.locator("article #second")).toBeInViewport();
  await expect(
    page.locator('.mdmark-bundle-side a[aria-current="page"]'),
  ).toHaveText("文書B");
});

// 狭い幅では一覧を閉じておき、帯のボタンで開いたパネルから文書を選ぶ（正常シナリオ（狭い幅で文書の一覧を開く））
test("test_normal_when_narrow", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const htmlFile = await buildBundle(builtRoot, tempDir);
  await page.setViewportSize({ width: 390, height: 800 });
  const h1 = page.locator("article.mdmark h1");
  const panel = page.locator("dialog.mdmark-bundle-panel");
  // 実行・検証
  await openStandalone(page, { tempDir, htmlFile });
  await expect(h1).toContainText("文書A");
  await expect(page.locator(".mdmark-bundle-side")).toBeHidden();
  await expect(panel).not.toHaveAttribute("open", "");
  await page.locator("[data-panel-open]").click();
  await expect(panel).toHaveAttribute("open", "");
  await panel.locator('a[data-doc-path="B.md"]').click();
  await expect(h1).toContainText("文書B");
  await expect(panel).not.toHaveAttribute("open", "");
  // 戻るでパネルではなく A が出る（パネルの開閉が履歴に積まれていない）
  await page.goBack();
  await expect(h1).toContainText("文書A");
  await expect(panel).not.toHaveAttribute("open", "");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

// URL が 1 枚に無い文書を指しても、entry の文書を出して例外を出さない（異常シナリオ（URL が 1 枚に無い文書を指す））
test("test_error_when_url_points_missing_document", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const htmlFile = await buildBundle(builtRoot, tempDir);
  // 実行
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile,
    hash: "#/下書き/メモ.md",
  });
  // 検証
  await expect(page.locator("article.mdmark h1")).toContainText("文書A");
  await expect(
    page.locator('.mdmark-bundle-side a[aria-current="page"]'),
  ).toHaveText("文書A");
  expect(opened.pageErrors()).toEqual([]);
});
