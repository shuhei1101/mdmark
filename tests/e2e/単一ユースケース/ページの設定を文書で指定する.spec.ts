import { expect, type Page, test } from "@playwright/test";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
  sendPrintEvent,
  updateDocument,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 段落とリンクを持つ本文（リンク 1 つだけの段落はカードにするため、文の中にリンクを置く）
const BODY = "段落\n\n詳しくは [リンク](https://example.com/page) を見る。\n";

// h2 を 3 つと段落を持つ本文
const HEADINGS_BODY = [
  "## 概要",
  "",
  "段落",
  "",
  "## 使い方",
  "",
  "段落",
  "",
  "## 補足",
  "",
  "段落",
  "",
].join("\n");

// デザイン方針の `--mdmark-color-bg` の値
const SWISS_LIGHT_BG = "#ffffff";
const SWISS_DARK_BG = "#131316";
const SLATE_LIGHT_BG = "#f8fafc";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 描く先の要素の `--mdmark-color-bg` の計算値 */
function readBackground(page: Page): Promise<string> {
  return page
    .locator("#doc")
    .evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--mdmark-color-bg").trim(),
    );
}

/** 祖先（`body`）の class を決める */
async function setBodyClass(page: Page, name: string): Promise<void> {
  await page.evaluate((value) => {
    document.body.className = value;
  }, name);
}

/** 目次を出すボタンが閉じていて、右端にポインターを置いても右側の目次が表示されないことを確かめる（`side-toc.mode` の `fixed`） */
async function expectFixedSideToc(page: Page): Promise<void> {
  const toggle = page.locator("#doc .mdmark-side-toc-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await page.mouse.move(1278, 400);
  await expect(page.locator("#doc .mdmark-side-toc-panel")).toBeHidden();
}

// 文書の先頭の page のマーカーで、OS の配色がライトでもダークで描く（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `<!-- page: scheme=dark -->\n\n${BODY}`,
    config: {},
  });
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
  await expect(page.locator("#doc")).not.toContainText("page:");
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
});

// 設定の明暗を、OS の配色と祖先の class より優先して全文書の既定にする（正常シナリオ（設定で全文書の既定にする））
test("test_normal_when_config_default", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await setBodyClass(page, "mdmark-theme-light");
  // 実行
  await mountDocument(page, {
    markdown: BODY,
    config: { colorScheme: "dark" },
  });
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
});

// 文書のマーカーの明暗・テーマ・目次の出し方が設定に勝つ（正常シナリオ（文書のマーカーが設定に勝つ））
test("test_normal_when_marker_overrides_config", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `<!-- page: scheme=light theme=theme-slate toc=fixed -->\n\n${HEADINGS_BODY}`,
    config: {
      colorScheme: "dark",
      colorTheme: "theme-paper",
      "side-toc": { mode: "hover" },
    },
  });
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SLATE_LIGHT_BG);
  await expectFixedSideToc(page);
});

// マーカーの scheme=auto は設定の明暗を外し、祖先の class で決める（正常シナリオ（OS の設定に合わせる））
test("test_normal_when_auto", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await setBodyClass(page, "mdmark-theme-dark");
  // 実行
  await mountDocument(page, {
    markdown: `<!-- page: scheme=auto -->\n\n${BODY}`,
    config: { colorScheme: "light" },
  });
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
});

// マーカーを持たない本文に差し替えると、明るい配色に戻す（正常シナリオ（本文を差し替える））
test("test_normal_when_updated", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- page: scheme=dark -->\n\n${BODY}`,
    config: {},
  });
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
  // 実行
  await updateDocument(page, BODY);
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SWISS_LIGHT_BG);
});

// ダークを指定した文書も、印刷では明るい配色にする（正常シナリオ（印刷する））
test("test_normal_when_printed", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: `<!-- page: scheme=dark -->\n\n${BODY}`,
    config: {},
  });
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
  // 実行
  await page.emulateMedia({ colorScheme: "light", media: "print" });
  await sendPrintEvent(page, "beforeprint");
  // 検証
  await expect.poll(() => readBackground(page)).toBe(SWISS_LIGHT_BG);
});

// 知らないキーと値は書き方の警告にして使わず、残りの指定と設定で描く（異常シナリオ（知らないキーと値））
test("test_error_when_unknown_key_or_value", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: `<!-- page: scheme=sepia theme=theme-unknown size=wide toc=fixed -->\n\n${HEADINGS_BODY}`,
    config: { colorScheme: "dark" },
  });
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(1);
  for (const text of [
    "scheme=sepia",
    "theme=theme-unknown",
    "size=wide",
    "light",
    "dark",
    "auto",
    "theme-slate",
    "hover",
    "fixed",
  ]) {
    await expect(warnings).toContainText(text);
  }
  const first = await page
    .locator("#doc")
    .evaluate(
      (el) => el.querySelector("h2, .mdmark-syntax-warning")?.className ?? "",
    );
  expect(first).toContain("mdmark-syntax-warning");
  await expect.poll(() => readBackground(page)).toBe(SWISS_DARK_BG);
  await expectFixedSideToc(page);
});

// 文書の先頭に無い page のマーカーは書き方の警告にして使わない（異常シナリオ（文書の先頭に無いマーカー））
test("test_error_when_not_at_top", async ({ page }) => {
  // 準備
  await page.emulateMedia({ colorScheme: "light" });
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: "最初の段落\n\n<!-- page: scheme=dark -->\n\n後ろの段落\n",
    config: {},
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("先頭");
  const order = await page
    .locator("#doc")
    .evaluate((el) =>
      [...el.querySelectorAll("p, .mdmark-syntax-warning")].map((node) =>
        node.classList.contains("mdmark-syntax-warning")
          ? "warning"
          : (node.textContent ?? ""),
      ),
    );
  expect(order.indexOf("warning")).toBeGreaterThan(order.indexOf("最初の段落"));
  expect(order.indexOf("warning")).toBeLessThan(order.indexOf("後ろの段落"));
  await expect.poll(() => readBackground(page)).toBe(SWISS_LIGHT_BG);
});
