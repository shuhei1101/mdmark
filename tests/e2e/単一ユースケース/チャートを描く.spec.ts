import { expect, type Locator, test } from "@playwright/test";
import { BAR_TEXT, chartElement, wrapHtml } from "../chart.ts";
import { wrapDirective } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 棒のグラフの棒の数（系列 2 つ × 項目 4 つ）
const BAR_COUNT = 8;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 図の題・凡例の項目・棒の数・読み上げの名前 */
async function summaryOf(figure: Locator) {
  return {
    title: await figure.locator(".mdmark-diagram-title").innerText(),
    legend: await figure.locator('ul[aria-label="凡例"] li').allInnerTexts(),
    bars: await figure.locator("svg[role=img] .mdmark-diagram-bar").count(),
    label: await figure.locator("svg[role=img]").getAttribute("aria-label"),
  };
}

// 埋め込んだ HTML の中の mdmark-chart を、印で描いたときと同じ棒のグラフにして図の枠に載せ、定義の JSON は残さない（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const markdown = [
    wrapHtml(`<h2>チャートの前の見出し</h2>\n${chartElement(BAR_TEXT)}`),
    wrapDirective("chart", BAR_TEXT),
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown });
  // 検証: 同じ定義を印で描いたものと、題・凡例・棒の数・読み上げの名前が同じ
  const figures = page.locator(
    '#doc figure.mdmark-diagram[data-diagram="chart"]',
  );
  await expect(figures).toHaveCount(2);
  await expect(
    page.locator(
      '#doc .mdmark-html figure.mdmark-diagram[data-diagram="chart"]',
    ),
  ).toHaveCount(1);
  const embedded = figures.nth(0);
  const marked = figures.nth(1);
  const summary = await summaryOf(embedded);
  expect(summary).toEqual(await summaryOf(marked));
  expect(summary.title).toBe("窓口ごとの問い合わせの件数");
  expect(summary.bars).toBe(BAR_COUNT);
  expect(summary.legend.length).toBeGreaterThan(0);
  // 図の枠の右上に拡大・縮小・戻すのボタンがある
  await expect(embedded.getByRole("button", { name: "縮小" })).toBeVisible();
  await expect(embedded.getByRole("button", { name: "拡大" })).toBeVisible();
  await expect(
    embedded.getByRole("button", { name: "全体が収まる倍率に戻す" }),
  ).toBeVisible();
  // HTML の見出しがチャートの前に描かれ、定義の JSON の文字は残らない
  const heading = await page
    .locator("#doc .mdmark-html h2")
    .evaluate((element) => element.getBoundingClientRect().bottom);
  const figureTop = await embedded.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  expect(heading).toBeLessThanOrEqual(figureTop);
  await expect(page.locator("#doc .mdmark-html h2")).toHaveText(
    "チャートの前の見出し",
  );
  await expect(page.locator("#doc mdmark-chart")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-html")).not.toContainText('"series"');
});

// 読めない定義の場所だけを書き方の警告にし、正しい定義のチャートと HTML の段落は描く（異常シナリオ（定義を読めない））
test("test_error_when_definition_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const markdown = wrapHtml(
    [
      '<mdmark-chart>{"title": "a",</mdmark-chart>',
      chartElement(BAR_TEXT),
      "<p>後ろの段落</p>",
    ].join("\n"),
  );
  // 実行
  await mountDocument(page, { markdown });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText(
    "グラフの部品の定義を JSON として読めません",
  );
  await expect(warning).toContainText("行目");
  await expect(warning).toContainText("}");
  await expect(
    page.locator('#doc figure.mdmark-diagram[data-diagram="chart"]'),
  ).toHaveCount(1);
  await expect(
    page.locator("#doc svg[role=img] .mdmark-diagram-bar"),
  ).toHaveCount(BAR_COUNT);
  await expect(page.locator("#doc .mdmark-html p")).toHaveText("後ろの段落");
});
