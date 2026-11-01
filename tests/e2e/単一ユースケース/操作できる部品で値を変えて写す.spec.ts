import { expect, type Page, test } from "@playwright/test";
import {
  sampleBlock,
  stubClipboard,
  wrapDirective,
  writtenTexts,
} from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** クリップボードの書き込みを `mode` にして、操作できる部品（範囲 0〜10・既定 5 のスライダー）を描いたページを開く（`config` は `mount` に渡す設定） */
async function openParam(
  page: Page,
  mode: "allow" | "deny",
  config?: { labels: { paramCopy: string } },
): Promise<void> {
  await stubClipboard(page, mode);
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapDirective("param", await sampleBlock("strength")),
    ...(config ? { config } : {}),
  });
  await expect(page.locator("#doc .mdmark-param")).toHaveCount(1);
}

/** グラフの読み上げの名前（題名と系列ごとの値） */
function chartLabel(page: Page) {
  return page
    .locator("#doc .mdmark-param svg[role=img]")
    .getAttribute("aria-label");
}

// スライダーで値を変えるとグラフが描き直され、今の値を JSON でクリップボードへ書き、写したことを知らせる（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openParam(page, "allow");
  const slider = page.getByRole("slider", { name: "反応の強さ" });
  await expect(slider).toHaveValue("5");
  expect(await chartLabel(page)).toContain("今の値（5）");
  // 実行: スライダーを 7 に動かし、フォーカスして → を押す
  await slider.fill("7");
  expect(await chartLabel(page)).toContain("今の値（7）");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  // 検証: 今の値 8 でグラフが描き直される。値は画面に出ている
  await expect(slider).toHaveValue("8");
  await expect(page.locator("#doc .mdmark-param-knob output")).toHaveText("8");
  expect(await chartLabel(page)).toContain(
    "今の値（8）: 0・55・80・91・96・98",
  );
  // 実行: 今の値を写すボタンを押す
  await page.getByRole("button", { name: "今の値を写す" }).click();
  // 検証: 写したことがボタンのそばに出て、クリップボードの中身が JSON として読める
  await expect(
    page.locator('#doc .mdmark-param [role="status"]'),
  ).toContainText("クリップボードに写しました");
  const written = await writtenTexts(page);
  expect(written).toHaveLength(1);
  expect(JSON.parse(written[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
});

// 書き込みを拒まれたら、書けなかったことと選んで写せる JSON を出し、スライダーとグラフは操作できる（異常シナリオ（クリップボードへ書けない））
test("test_error_when_clipboard_denied", async ({ page }) => {
  // 準備
  await openParam(page, "deny");
  const slider = page.getByRole("slider", { name: "反応の強さ" });
  await slider.fill("8");
  // 実行
  await page.getByRole("button", { name: "今の値を写す" }).click();
  // 検証: 書けなかったことと、写すはずだった JSON が選んで写せる文字として出る
  await expect(
    page.locator('#doc .mdmark-param [role="status"]'),
  ).toContainText("クリップボードへ書けませんでした");
  const fallback = page.locator("#doc .mdmark-param pre.mdmark-param-fallback");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("tabindex", "0");
  expect(JSON.parse(await fallback.innerText())).toEqual({
    strength: { name: "反応の強さ", value: 8 },
  });
  // スライダーとグラフは操作できるまま
  await slider.fill("3");
  expect(await chartLabel(page)).toContain("今の値（3）");
});

// 設定でボタンの文言を替えると、ボタンの文字と読み上げの名前が設定の文言になり、スライダーで描き直しても変わらない（正常シナリオ（設定でボタンの文言を替えたとき））
test("test_normal_when_label_configured", async ({ page }) => {
  // 準備
  await openParam(page, "allow", { labels: { paramCopy: "コピー" } });
  const button = page.locator("#doc .mdmark-param button.mdmark-param-copy");
  await expect(button).toHaveText("コピー");
  await expect(button).toHaveAccessibleName("コピー");
  const slider = page.getByRole("slider", { name: "反応の強さ" });
  // 実行: スライダーを 7 に動かす
  await slider.fill("7");
  // 検証: グラフが 7 で描き直され、ボタンの文字と読み上げの名前は「コピー」のまま
  expect(await chartLabel(page)).toContain("今の値（7）");
  await expect(button).toHaveText("コピー");
  await expect(button).toHaveAccessibleName("コピー");
  // 実行: 「コピー」のボタンを押す
  await page.getByRole("button", { name: "コピー", exact: true }).click();
  // 検証: 写したことを知らせ、クリップボードの中身がスライダーの名前と今の値 7 の JSON
  await expect(
    page.locator('#doc .mdmark-param [role="status"]'),
  ).toContainText("クリップボードに写しました");
  const written = await writtenTexts(page);
  expect(written).toHaveLength(1);
  expect(JSON.parse(written[0] ?? "{}")).toEqual({
    strength: { name: "反応の強さ", value: 7 },
  });
});
