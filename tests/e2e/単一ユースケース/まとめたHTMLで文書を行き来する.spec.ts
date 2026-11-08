import { join } from "node:path";
import { expect, openStandalone, runCli, test, writeFiles } from "../cli.ts";

// 文書 A（entry）・B・C をまとめる: A は文書間のリンクを持たず、B は C へリンクし、目次のマーカーと h2 を 2 つ持つ
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

/** 3 つの文書をまとめた HTML を作り、そのパスを返却する */
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

// 文書の page のマーカーの明暗で開き、マーカーを持たない文書へ移ると明るい配色に、戻ると暗い配色に再描画する（正常シナリオ（文書ごとのページの設定））
test("test_normal_when_page_settings_per_document", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["A.md", "B.md"]',
      "  entry: A.md",
      "  out: dist/docs.html",
      "",
    ].join("\n"),
    "A.md": "<!-- page: scheme=dark -->\n\n# 文書A\n\n入口の文書。\n",
    "B.md": "# 文書B\n\nマーカーを持たない文書。\n",
  });
  const result = await runCli(builtRoot, ["build"], dir);
  expect(result.code).toBe(0);
  await page.emulateMedia({ colorScheme: "light" });
  const h1 = page.locator("article.mdmark h1");
  const background = () =>
    page
      .locator("article.mdmark")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--mdmark-color-bg").trim(),
      );
  // 実行・検証
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await expect(h1).toContainText("文書A");
  await expect.poll(background).toBe("#131316");
  await page.locator('.mdmark-bundle-side a[data-doc-path="B.md"]').click();
  await expect(h1).toContainText("文書B");
  await expect.poll(background).toBe("#ffffff");
  await page.goBack();
  await expect(h1).toContainText("文書A");
  await expect.poll(background).toBe("#131316");
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
  // 戻るでパネルではなく A が出る（パネルの開閉が履歴に追加されていない）
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

// B のフロー図の C を指すノードを押すと C へ移り、戻るで B へ戻る（正常シナリオ（フロー図のノードのリンク））
test("test_normal_when_flow_node_link", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  const flow = {
    title: "行き先",
    scope: "文書の行き来",
    updated: "2026-11-05",
    width: 260,
    height: 152,
    nodes: [
      {
        id: "to-c",
        kind: "script",
        x: 30,
        y: 40,
        w: 200,
        h: 72,
        name: "文書C を開く",
        href: "C.md",
      },
    ],
    wires: [],
  };
  await writeFiles(dir, {
    ...DOCUMENTS,
    "B.md": [
      DOCUMENTS["B.md"],
      "<!-- flow -->",
      "",
      "```json",
      JSON.stringify(flow),
      "```",
      "",
      "<!-- /flow -->",
      "",
    ].join("\n"),
  });
  expect((await runCli(builtRoot, ["build"], dir)).code).toBe(0);
  const h1 = page.locator("article.mdmark h1");
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  // 実行・検証: 文書の一覧で B を選ぶ
  await page.locator('.mdmark-bundle-side a[data-doc-path="B.md"]').click();
  await expect(h1).toContainText("文書B");
  // 実行・検証: B のフロー図の C を指すノードを押すと C が出る
  await page
    .locator('article [data-node="to-c"] a.mdmark-diagram-node-link')
    .click();
  await expect(h1).toContainText("文書C");
  await expect(page).toHaveURL(/#\/C\.md$/);
  // 実行・検証: 戻るで B が出る
  await page.goBack();
  await expect(h1).toContainText("文書B");
  expect(opened.externalRequests()).toEqual([]);
});

// wide の範囲を、左の文書の一覧の列に重ねずに広げる（正常シナリオ（wide の範囲を持つ文書））
test("test_normal_when_wide_range", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  const table = [
    "| 項目 | 1 月 | 2 月 | 3 月 | 4 月 | 5 月 | 6 月 | 備考 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 売上 | 1,200,000 | 1,350,000 | 1,410,000 | 1,280,000 | 1,520,000 | 1,610,000 | 前年比で増加した |",
  ].join("\n");
  await writeFiles(dir, {
    "mdmark.config.yaml": [
      "build:",
      '  include: ["A.md", "B.md"]',
      "  entry: A.md",
      "  out: dist/docs.html",
      "theme: mdmark-theme.css",
      "",
    ].join("\n"),
    "mdmark-theme.css": ".mdmark { --mdmark-content-width: 640px; }\n",
    "A.md": `# 文書A\n\n段落\n\n<!-- wide -->\n\n${table}\n\n<!-- /wide -->\n`,
    "B.md": "# 文書B\n\nB の段落\n",
  });
  expect((await runCli(builtRoot, ["build"], dir)).code).toBe(0);
  await page.setViewportSize({ width: 1280, height: 800 });
  // 実行
  await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  // 検証
  const range = page.locator("article .mdmark-wide-range");
  const paragraph = page.locator("article p").first();
  await expect
    .poll(async () => (await range.boundingBox())?.width ?? 0)
    .toBeGreaterThan((await paragraph.boundingBox())?.width ?? 0);
  const side = await page.locator(".mdmark-bundle-side").boundingBox();
  expect((await range.boundingBox())?.x ?? 0).toBeGreaterThanOrEqual(
    (side?.x ?? 0) + (side?.width ?? 0) - 1,
  );
  await page.locator('.mdmark-bundle-side a[data-doc-path="B.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("文書B");
});
