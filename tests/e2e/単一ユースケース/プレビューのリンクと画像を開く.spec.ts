import { expect, type Frame, test } from "@playwright/test";
import { useVscodeE2E, type VscodeSession } from "../vscode.ts";

const e2e = useVscodeE2E();

/** 1 x 1 の PNG */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/** 外部の URL。拡張機能のテストの VS Code は、信頼していないドメインを開くときの確認のダイアログを出せないため、VS Code が既定で信頼しているドメインにする */
const EXTERNAL_URL = "https://aka.ms/mdmark";

/** リンクと画像を持つ Markdown: 外部の URL・同じフォルダの `other.md`・同じ文書の見出しへの `#` のリンクと、画面の外にある見出し */
const LINK_GUIDE = [
  "# 案内",
  "",
  `[外部](${EXTERNAL_URL})`,
  "",
  "[別の文書](./other.md)",
  "",
  "[ページ内](#末尾)",
  "",
  "![図](./images/figure.png)",
  "",
  ...Array.from({ length: 150 }, (_, index) => [
    `段落 ${index + 1}`,
    "",
  ]).flat(),
  "## 末尾",
  "",
  ...Array.from({ length: 80 }, (_, index) => [
    `後の段落 ${index + 1}`,
    "",
  ]).flat(),
].join("\n");

/** ワークスペースの外を指す画像を持つ Markdown（`docs/` からの `../../` はワークスペースの 1 つ上のフォルダ） */
const OUTSIDE_GUIDE = [
  "# 外の画像",
  "",
  "![外の画像](../../outside.png)",
  "",
].join("\n");

/** リンクを持つ文書のプレビューを開く */
async function openLinkGuide(session: VscodeSession): Promise<Frame> {
  await session.openFile("docs/guide.md");
  await session.openPreviewWithShortcut();
  const frame = await session.frameWith("h1");
  await expect(frame.locator("img")).toHaveCount(1);
  return frame;
}

/** 見本のワークスペースのファイル */
function files(): Record<string, string | Buffer> {
  return {
    "docs/guide.md": LINK_GUIDE,
    "docs/other.md": "# 別の文書\n",
    "docs/images/figure.png": PNG,
    "docs/outside.md": OUTSIDE_GUIDE,
    "../outside.png": PNG,
  };
}

// 外部の URL のリンクを押すと、既定のブラウザで 1 回だけ開き、プレビューは変わらない（正常シナリオ（外部の URL））
test("test_normal_when_external_link", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  const frame = await openLinkGuide(session);
  const scrollTop = await frame.evaluate(() => window.scrollY);
  // 実行
  await frame.locator(`a[href="${EXTERNAL_URL}"]`).click();
  // 検証
  await expect.poll(() => session.openedUrls()).toEqual([EXTERNAL_URL]);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([EXTERNAL_URL]);
  expect(await frame.evaluate(() => window.scrollY)).toBe(scrollTop);
  await expect(frame.locator("h1")).toContainText("案内");
});

// Markdown へのリンクを押すと、VS Code のエディタで開き、ブラウザでは開かない（正常シナリオ（Markdown へのリンク））
test("test_normal_when_markdown_link", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  const frame = await openLinkGuide(session);
  // 実行
  await frame.locator('a[href="./other.md"]').click();
  // 検証
  await expect(
    session.win.getByRole("tab", { name: /^other\.md/ }),
  ).toHaveCount(1);
  await session.win.waitForTimeout(1000);
  expect(await session.openedUrls()).toEqual([]);
});

// ページの中へのリンクを押すと、プレビューの中で見出しへ移り、エディタを開き直さず、ブラウザでも開かない（正常シナリオ（ページの中へのリンク））
test("test_normal_when_anchor_link", async () => {
  // 準備
  const session = await e2e.launch({
    files: files(),
    settings: {
      "mdmark.preview.scrollPreviewWithEditor": false,
      "mdmark.preview.scrollEditorWithPreview": false,
    },
  });
  const frame = await openLinkGuide(session);
  const viewport = await frame.evaluate(() => window.innerHeight);
  const heading = frame.locator("h2", { hasText: "末尾" });
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeGreaterThan(viewport);
  const tabs = await session.win.locator(".tab").count();
  // 実行
  await frame.locator('a[href="#末尾"]').click();
  // 検証
  await expect
    .poll(() =>
      heading.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBeLessThan(viewport);
  expect(
    await heading.evaluate((element) => element.getBoundingClientRect().top),
  ).toBeGreaterThanOrEqual(-2);
  expect(await session.win.locator(".tab").count()).toBe(tabs);
  expect(await session.openedUrls()).toEqual([]);
});

// Markdown からの相対パスの画像が、プレビューに読み込まれる（正常シナリオ（相対パスの画像））
test("test_normal_when_relative_image", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  // 実行
  const frame = await openLinkGuide(session);
  // 検証
  const image = frame.locator('img[alt="図"]');
  await expect
    .poll(() =>
      image.evaluate((element: HTMLImageElement) => [
        element.naturalWidth,
        element.naturalHeight,
      ]),
    )
    .toEqual([1, 1]);
});

// ワークスペースの外の画像は読み込まず、代わりの文字を出し、他の本文は描く（異常シナリオ（ワークスペースの外の画像））
test("test_error_when_image_outside_workspace", async () => {
  // 準備
  const session = await e2e.launch({ files: files() });
  await session.openFile("docs/outside.md");
  // 実行
  await session.openPreviewWithShortcut();
  // 検証
  const frame = await session.frameWith("img");
  const image = frame.locator('img[alt="外の画像"]');
  await expect(image).toHaveCount(1);
  await session.win.waitForTimeout(1000);
  expect(
    await image.evaluate((element: HTMLImageElement) => element.naturalWidth),
  ).toBe(0);
  await expect(frame.locator("h1")).toContainText("外の画像");
});
