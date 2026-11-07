import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, type Page, test } from "@playwright/test";
import {
  CARD_MARKDOWN,
  CARD_SOURCE,
  flowMarkdown,
  HOST_CSS,
} from "../diagram.ts";
import { guideMarkdown, replaceFirstLine, useVscodeE2E } from "../vscode.ts";

const e2e = useVscodeE2E();

/** 1 x 1 の PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** 見出し・表・注意書き・流れ図と画像、本文の `</script>` を持つ見本の Markdown */
async function sampleMarkdown(): Promise<string> {
  return [
    await guideMarkdown(),
    "![図](./images/figure.png)",
    "",
    "```html",
    "<script>alert(1)</script>",
    "```",
    "",
  ].join("\n");
}

/** 見本のワークスペースのファイル */
async function files(): Promise<Record<string, string | Buffer>> {
  return {
    "docs/guide.md": await sampleMarkdown(),
    "docs/images/figure.png": PNG,
  };
}

/** 書き出した HTML を、ブラウザで開いたときと同じように `file:` で開く */
async function openExported(
  browser: import("@playwright/test").Browser,
  path: string,
): Promise<Page> {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path).href);
  return page;
}

// 開いている Markdown を同じフォルダに HTML として書き出し、通知の「ブラウザで開く」から開く（正常シナリオ）
test("test_normal", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({ files: await files() });
  await session.openFile("docs/guide.md");
  const path = join(session.workspaceDir, "docs", "guide.html");
  // 実行
  await session.runCommand("mdmark: HTML に書き出す");
  // 検証
  await expect
    .poll(() => session.notifications())
    .toContain(`HTML を書き出しました: ${path}`);
  expect(
    (await readdir(join(session.workspaceDir, "docs"))).filter((name) =>
      name.endsWith(".html"),
    ),
  ).toEqual(["guide.html"]);
  await session.win.getByRole("button", { name: "ブラウザで開く" }).click();
  await expect
    .poll(() => session.openedUrls())
    .toEqual([pathToFileURL(path).href]);
  const page = await openExported(browser, path);
  await expect(page.locator("h1")).toContainText("見出し");
  await expect(page.locator(".mdmark-table")).toHaveCount(1);
  await expect(page.locator(".markdown-alert")).toHaveCount(1);
  await expect(page.locator(".mdmark-diagram-frame")).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator("img")
        .first()
        .evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.locator("pre").last()).toContainText(
    "<script>alert(1)</script>",
  );
  await page.close();
});

// 書き出した HTML が無くても、1 回のコマンドで書き出してブラウザで開き、保存していない書き換えも出る（正常シナリオ（ブラウザで開く））
test("test_normal_when_open_in_browser", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({ files: await files() });
  await session.openFile("docs/guide.md");
  await replaceFirstLine(session, "# 保存していない見出し");
  const path = join(session.workspaceDir, "docs", "guide.html");
  expect(existsSync(path)).toBe(false);
  // 実行
  await session.runCommand("mdmark: ブラウザで開く");
  // 検証
  await expect
    .poll(() => session.openedUrls())
    .toEqual([pathToFileURL(path).href]);
  expect(existsSync(path)).toBe(true);
  expect(await session.notifications()).not.toContain(
    `HTML を書き出しました: ${path}`,
  );
  const page = await openExported(browser, path);
  await expect(page.locator("h1").first()).toContainText(
    "保存していない見出し",
  );
  await page.close();
});

// 書き出し先に書けないとき、理由を通知し、HTML を残さず、ブラウザを開かない（異常シナリオ（書き出せない））
test("test_error_when_output_unwritable", async () => {
  // 準備
  const session = await e2e.launch({
    files: await files(),
    settings: { "mdmark.export.outputDir": "locked/out" },
    readOnlyDirs: ["locked"],
  });
  await session.openFile("docs/guide.md");
  // 実行
  await session.runCommand("mdmark: HTML に書き出す");
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

// 設定ファイルのテーマを VS Code の設定のテーマで上書きして書き出し、開いたブラウザで同じテーマの明るい配色になる（正常シナリオ（選んだテーマで書き出す））
test("test_normal_when_theme_selected", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({
    files: {
      ...(await files()),
      "mdmark.config.yaml": "colorTheme: theme-paper\n",
    },
    settings: { "mdmark.colorTheme": "theme-slate" },
  });
  await session.openFile("docs/guide.md");
  const path = join(session.workspaceDir, "docs", "guide.html");
  // 実行
  await session.runCommand("mdmark: HTML に書き出す");
  // 検証
  await expect
    .poll(() => session.notifications())
    .toContain(`HTML を書き出しました: ${path}`);
  const page = await browser.newPage();
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto(pathToFileURL(path).href);
  await expect(page.locator(".mdmark").first()).toHaveCSS(
    "background-color",
    "rgb(248, 250, 252)",
  );
  await page.close();
});

// 固有の部品の色（固有の CSS が変えた値）
const HOST_CARD_COLOR = "rgb(0, 0, 255)";

// theme の CSS と extensions の部品を、プレビューと書き出した HTML の両方に当てる（正常シナリオ（theme と extensions を当てる））
test("test_normal_when_theme_and_extensions", async ({ browser }) => {
  // 準備
  const session = await e2e.launch({
    files: {
      "mdmark.config.yaml":
        "theme: theme.css\nextensions: [extensions/card.js]\n",
      "theme.css": `${HOST_CSS}\n`,
      "extensions/card.js": CARD_SOURCE,
      "doc.md": `${CARD_MARKDOWN}\n${await flowMarkdown()}\n本文の段落\n`,
    },
  });
  await session.openFile("doc.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith(".host-card");
  const previewColor = await frame
    .locator(".host-card")
    .evaluate((element) => getComputedStyle(element).color);
  const path = join(session.workspaceDir, "doc.html");
  // 実行
  await session.focusEditor();
  await session.runCommand("mdmark: HTML に書き出す");
  // 検証
  await expect
    .poll(() => session.notifications())
    .toContain(`HTML を書き出しました: ${path}`);
  const page = await openExported(browser, path);
  const card = page.locator(".host-card");
  await expect(card).toHaveText("固有の題");
  await expect(card).toHaveCSS("color", HOST_CARD_COLOR);
  expect(previewColor).toBe(HOST_CARD_COLOR);
  await page.close();
});
