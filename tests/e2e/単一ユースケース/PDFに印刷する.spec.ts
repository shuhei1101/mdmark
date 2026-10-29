import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import {
  guideMarkdown,
  type LibraryServer,
  printCalls,
  recordPrint,
  startLibraryServer,
  useVscodeE2E,
} from "../vscode.ts";

const e2e = useVscodeE2E();

let library: LibraryServer | undefined;

test.afterEach(async () => {
  await library?.close();
  library = undefined;
});

/** 閉じた折り畳みと、外部ライブラリの印を持つ見本の Markdown と、その設定ファイル */
async function printFiles(delayMs: number): Promise<Record<string, string>> {
  library = await startLibraryServer({ delayMs });
  return {
    "docs/guide.md": [
      await guideMarkdown(),
      "<details><summary>概要</summary>本文</details>",
      "",
      "<!-- my-lib -->",
      "",
    ].join("\n"),
    "mdmark.config.yaml": `libraries:\n  my-lib: ${library.url}\n`,
  };
}

// 書き出した HTML をブラウザで開くと、描き終えた後に印刷のダイアログが 1 回呼ばれ、閉じた折り畳みが開き、書き出し直すと呼ばれない（正常シナリオ）
test("test_normal", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({ files: await printFiles(500) });
  await session.openFile("docs/guide.md");
  const path = join(session.workspaceDir, "docs", "guide.html");
  const url = pathToFileURL(path).href;
  // 実行
  await session.runCommand("mdmark: PDF に印刷");
  // 検証
  await expect.poll(() => session.openedUrls()).toEqual([url]);
  const page = await browser.newPage();
  await recordPrint(page);
  await page.goto(url);
  await expect
    .poll(async () => (await printCalls(page)).length)
    .toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const calls = await printCalls(page);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.drawn).toBe(1);
  expect(calls[0]?.details).toEqual([true]);
  await page.close();
  // 続けて「ブラウザで開く」で書き出し直すと、印刷の処理は消える
  await session.runCommand("mdmark: ブラウザで開く");
  await expect.poll(() => session.openedUrls()).toEqual([url, url]);
  const again = await browser.newPage();
  await recordPrint(again);
  await again.goto(url);
  await again.waitForSelector(".mdmark-embed[data-mdmark-drawn]");
  await again.waitForTimeout(1000);
  expect(await printCalls(again)).toEqual([]);
  await again.close();
});

// 書き出せないとき、理由を通知し、ブラウザを開かない（異常シナリオ（書き出せない））
test("test_error_when_output_unwritable", async () => {
  // 準備
  const session = await e2e.launch({
    files: await printFiles(500),
    settings: { "mdmark.export.outputDir": "locked/out" },
    readOnlyDirs: ["locked"],
  });
  await session.openFile("docs/guide.md");
  // 実行
  await session.runCommand("mdmark: PDF に印刷");
  // 検証
  const path = join(session.workspaceDir, "locked", "out", "guide.html");
  await expect
    .poll(async () =>
      (await session.notifications()).some(
        (text) =>
          text.startsWith(`HTML を書き出せませんでした: ${path}（`) &&
          text.includes("EACCES"),
      ),
    )
    .toBe(true);
  expect(await readdir(join(session.workspaceDir, "locked"))).toEqual([]);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([]);
});

// VS Code の設定のテーマで書き出し、ダークのブラウザでも印刷の間はそのテーマの明るい配色になる（正常シナリオ（選んだテーマで印刷する））
test("test_normal_when_theme_selected", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({
    files: {
      "docs/guide.md": [
        await guideMarkdown(),
        "[リンク](https://example.com/)",
        "",
      ].join("\n"),
    },
    settings: { "mdmark.colorTheme": "theme-slate" },
  });
  await session.openFile("docs/guide.md");
  const url = pathToFileURL(
    join(session.workspaceDir, "docs", "guide.html"),
  ).href;
  // 実行
  await session.runCommand("mdmark: PDF に印刷");
  // 検証
  await expect.poll(() => session.openedUrls()).toEqual([url]);
  const page = await browser.newPage();
  await page.emulateMedia({ colorScheme: "dark" });
  await recordPrint(page);
  await page.goto(url);
  await expect
    .poll(async () => (await printCalls(page)).length)
    .toBeGreaterThan(0);
  const link = page.locator('.mdmark a[href^="https://example.com"]');
  // ダークの画面では theme-slate の暗い配色（印刷にする前に確かめる）
  await expect(link).toHaveCSS("color", "rgb(125, 211, 252)");
  // 印刷のメディアでは、ブラウザがダークでも theme-slate の明るい配色
  await page.emulateMedia({ colorScheme: "dark", media: "print" });
  await expect(link).toHaveCSS("color", "rgb(29, 78, 216)");
  await page.close();
});
