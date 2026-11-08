import { expect, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import {
  MERMAID_ENTRY,
  MERMAID_FIGURE,
  MERMAID_FLOWCHART,
  MERMAID_MARKDOWN,
  MERMAID_SVG,
  MERMAID_WAIT_MS,
  mermaidColors,
  routeMermaid,
} from "../mermaid.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

// mermaid を読み込まないことを確認するために待つ時間（ミリ秒）
const SETTLE_MS = 500;

// 設定で上書きするノードの塗り（#e0f2f1）
const OVERRIDDEN_FILL = "rgb(224, 242, 241)";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 受けた要求のうち mermaid の本体への要求の件数 */
const entryCount = (requests: string[]): number =>
  requests.filter((file) => file === MERMAID_ENTRY).length;

// mermaid のコードブロックを、mdmark の外観のテーマで図の枠に入れて描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  const requests = await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MERMAID_MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(MERMAID_SVG)).toHaveCount(2, {
    timeout: MERMAID_WAIT_MS,
  });
  expect(entryCount(requests())).toBe(1);
  await expect(doc.locator(".mdmark-code")).toHaveCount(0);
  await expect(doc.locator(`${MERMAID_FIGURE} figcaption`).first()).toHaveText(
    "問い合わせの受付",
  );
  const colors = await mermaidColors(page, { scope: "#doc" });
  expect(colors.fill).toBe(colors.surface);
  expect(colors.stroke).toBe(colors.border);
  expect(colors.text).toBe(colors.textVar);
  expect(colors.line).toBe(colors.lineVar);
  expect(colors.stroke.startsWith("url(")).toBe(false);
  expect(colors.font).toBe(colors.bodyFont);
  await expect(
    doc.locator(MERMAID_FIGURE).nth(1).locator("svg.mdmark-mermaid-actor"),
  ).not.toHaveCount(0);
  await expect(doc.locator(":scope > p")).toHaveText(["前の段落", "後の段落"]);
});

// mermaid のコードブロックが無い文書では mermaid を読み込まない（正常シナリオ（mermaid のコードブロックが無い））
test("test_normal_when_no_mermaid", async ({ page }) => {
  // 準備
  const requests = await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "段落\n\n```ts\nconst count = 1;\n```\n",
  });
  await expect(page.locator("#doc p")).toHaveText("段落");
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(requests()).toEqual([]);
  await expect(page.locator("#doc pre code")).toContainText("const count");
});

// 暗い配色の CSS 変数で描き、OS の配色を明るいに切り替えると明るい配色で再描画する（正常シナリオ（ダークの配色））
test("test_normal_when_dark", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "dark" });
  const requests = await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MERMAID_MARKDOWN });
  // 検証: 暗い配色
  await expect(page.locator(`#doc ${MERMAID_SVG}`)).toHaveCount(2, {
    timeout: MERMAID_WAIT_MS,
  });
  const dark = await mermaidColors(page, { scope: "#doc" });
  expect(dark.fill).toBe(dark.surface);
  expect(dark.text).toBe(dark.textVar);
  // 実行: OS の配色を明るいにする
  await page.emulateMedia({ colorScheme: "light" });
  // 検証: 明るい配色で再描画する
  await expect
    .poll(
      async () => {
        const light = await mermaidColors(page, { scope: "#doc" });
        return [
          light.fill === light.surface && light.surface !== dark.surface,
          light.text === light.textVar,
        ];
      },
      { timeout: MERMAID_WAIT_MS },
    )
    .toEqual([true, true]);
  expect(entryCount(requests())).toBe(1);
});

// 設定で mermaid のテーマを選び、変数を上書きして描く（正常シナリオ（テーマを設定で変える））
test("test_normal_when_theme_configured", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: MERMAID_MARKDOWN,
    config: {
      mermaid: { theme: "neutral", themeVariables: { mainBkg: "#e0f2f1" } },
    },
  });
  // 検証
  await expect(page.locator(`#doc ${MERMAID_SVG}`)).toHaveCount(2, {
    timeout: MERMAID_WAIT_MS,
  });
  const colors = await mermaidColors(page, { scope: "#doc" });
  expect(colors.fill).toBe(OVERRIDDEN_FILL);
  expect(colors.stroke).not.toBe(colors.border);
});

// 文書のマーカーで機能をオフにすると、mermaid を読み込まずにコードブロックのまま描く（正常シナリオ（機能をオフにする））
test("test_normal_when_disabled", async ({ page }) => {
  // 準備
  const requests = await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `<!-- features: -mermaid -->\n\n${MERMAID_FLOWCHART}`,
  });
  await expect(page.locator("#doc pre code")).toContainText("flowchart LR");
  await page.waitForTimeout(SETTLE_MS);
  // 検証
  expect(requests()).toEqual([]);
  await expect(page.locator(`#doc ${MERMAID_FIGURE}`)).toHaveCount(0);
  await expect(page.locator("#doc")).not.toContainText("features:");
});

// mermaid を読み込めないコードブロックの前に通知ブロックを配置し、コードブロックのまま描く（異常シナリオ（mermaid を読み込めない））
test("test_error_when_mermaid_not_found", async ({ page }) => {
  // 準備
  await routeMermaid(page, 404);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: MERMAID_MARKDOWN });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(".mdmark-notice")).toHaveCount(2, {
    timeout: MERMAID_WAIT_MS,
  });
  await expect(doc.locator(".mdmark-notice").first()).toContainText("mermaid");
  await expect(doc.locator("pre code")).toHaveCount(2);
  await expect(doc.locator("pre code").first()).toContainText("flowchart LR");
  await expect(doc.locator(MERMAID_FIGURE)).toHaveCount(0);
  await expect(doc.locator(":scope > p")).toHaveText(["前の段落", "後の段落"]);
});

// 解釈できないソースは記載の警告とコードブロックにし、解釈できるソースは図にする（異常シナリオ（記法を解釈できない））
test("test_error_when_syntax_invalid", async ({ page }) => {
  // 準備
  await routeMermaid(page);
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `\`\`\`mermaid\nA --> B\n\`\`\`\n\n${MERMAID_FLOWCHART}`,
  });
  // 検証
  const doc = page.locator("#doc");
  await expect(doc.locator(MERMAID_SVG)).toHaveCount(1, {
    timeout: MERMAID_WAIT_MS,
  });
  await expect(doc.locator(".mdmark-syntax-warning")).toHaveCount(1);
  await expect(doc.locator(".mdmark-syntax-warning")).toContainText(
    "mermaid の図を描けません（",
  );
  await expect(doc.locator("pre code")).toHaveCount(1);
  await expect(doc.locator("pre code")).toContainText("A --> B");
  await expect(page.locator('svg[aria-roledescription="error"]')).toHaveCount(
    0,
  );
});
