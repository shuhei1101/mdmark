import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  expect,
  linesOf,
  openStandalone,
  runCli,
  test,
  writeFiles,
  writeSampleDocs,
} from "../cli.ts";

// 雛形を置いた後に、文書を書く人が手で書き足す見本の文書群を書く
async function writeDocuments(dir: string): Promise<void> {
  await writeSampleDocs(dir);
}

// 雛形を置き、点検し、1 枚にまとめ、読む人が file:// で開いて文書を行き来する（正常シナリオ）
test("test_normal", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  // 実行・検証
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  await writeDocuments(dir);
  const check = await runCli(builtRoot, ["check"], dir);
  expect(check.code).toBe(0);
  expect(linesOf(check.stdout)).toEqual(["ずれ 0 件"]);
  const build = await runCli(builtRoot, ["build"], dir);
  expect(build.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "dist", "docs.html"),
  });
  await expect(page.locator("article.mdmark h1")).toContainText("入口");
  await expect(
    page.locator(".mdmark-bundle-side .mdmark-doc-list a"),
  ).toHaveCount(3);
  await expect(page.locator("article .mdmark-term").first()).toHaveText("印");
  // 文書間のリンクから別の文書へ移る
  await page.locator('article p a[href="#/使い方/guide.md"]').click();
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator("article canvas")).toHaveCount(1);
  expect(
    await page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  await expect(page.locator(".mdmark-backlinks a")).toContainText(["入口"]);
  // 一覧から全ての文書へ移れる
  for (const [path, title] of [
    ["用語集.md", "用語集"],
    ["README.md", "入口"],
  ]) {
    await page
      .locator(`.mdmark-bundle-side a[data-doc-path="${path}"]`)
      .click();
    await expect(page.locator("article.mdmark h1")).toContainText(title ?? "");
  }
  expect(opened.externalRequests()).toEqual([]);
});

// 雛形を置き、1 文書だけを書き出して file:// で開く（正常シナリオ（1 文書だけを書き出す））
test("test_normal_when_single_document", async ({
  builtRoot,
  tempDir,
  page,
}) => {
  // 準備
  const dir = await tempDir();
  const init = await runCli(builtRoot, ["init"], dir);
  expect(init.code).toBe(0);
  await writeDocuments(dir);
  // 実行
  const exported = await runCli(
    builtRoot,
    ["export", "使い方/guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(exported.code).toBe(0);
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "guide.html"),
  });
  await expect(page.locator("article.mdmark h1")).toContainText("使い方");
  await expect(page.locator("article canvas")).toHaveCount(1);
  expect(
    await page
      .locator("article img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  expect(opened.externalRequests()).toEqual([]);
});

// 点検でずれが見つかると一覧を出し、直した索引で 0 件になり、1 枚にまとめられる（異常シナリオ（点検でずれが見つかる））
test("test_error_when_drift", async ({ builtRoot, tempDir }) => {
  // 準備
  const dir = await tempDir();
  await runCli(builtRoot, ["init"], dir);
  await writeDocuments(dir);
  const index = await readFile(join(dir, "index.yaml"), "utf8");
  await writeFiles(dir, {
    "index.yaml": `${index}  - id: old\n    path: old.md\n    title: 古い文書\n`,
  });
  // 実行・検証
  const first = await runCli(builtRoot, ["check"], dir);
  expect(first.code).not.toBe(0);
  expect(
    linesOf(first.stdout).some(
      (line) => line.includes("missing_doc") && line.includes("old.md"),
    ),
  ).toBe(true);
  // ずれを直した索引（消えた文書の行を手で消す）
  await writeFiles(dir, { "index.yaml": index });
  const second = await runCli(builtRoot, ["check"], dir);
  expect(second.code).toBe(0);
  expect(linesOf(second.stdout)).toEqual(["ずれ 0 件"]);
  const build = await runCli(builtRoot, ["build"], dir);
  expect(build.code).toBe(0);
  expect(linesOf(build.stdout)).toEqual([
    "書き出した: dist/docs.html（文書 3 件）",
  ]);
});
