import { join } from "node:path";
import type { Page } from "@playwright/test";
import { hintFlowMarkdown, NODE_HINT, sampleHtml, wrapHtml } from "../chart.ts";
import { expect, openStandalone, runCli, test, writeFiles } from "../cli.ts";
import { TERM_INDEX } from "../diagram.ts";
import { mountDocument, openPage } from "../dist-page.ts";

// 範囲の外に置く `html` のコードブロック
const OUTSIDE = ["```html", "<p>範囲の外</p>", "```", ""].join("\n");

// 箱の `data-hint` の文
const BLOCK_HINT = "返信の種類を 1 つ選ぶ";

// 用語 `意思決定モデル` の意味
const TERM_MEANING = "選択肢から選ぶだけの、速く安い判断用の AI";

// ツールチップを離れたポインターが、ツールチップの上へ移る間に閉じるのを待つ時間（ミリ秒）より長く待つ
const CLOSE_WAIT_MS = 500;

// 拡大のボタンを押す回数（チャートが表示する枠より広くなる回数）
const ZOOM_CLICKS = 3;

// 文書を縦にスクロールできるようにする、末尾の段落の数
const TAIL_PARAGRAPHS = 40;

/** 書き出しの索引: 描く文書 `guide.md` と、見本の用語 */
const EXPORT_INDEX = [
  "schema: 1",
  "docs:",
  "  - id: guide",
  "    path: guide.md",
  "    title: ガイド",
  "terms:",
  "  - id: dm",
  "    term: 意思決定モデル",
  `    meaning: ${TERM_MEANING}`,
  "",
].join("\n");

/** 埋め込んだ HTML の中のチャートの図 */
function chartOf(page: Page) {
  return page.locator(
    '.mdmark-html figure.mdmark-diagram[data-diagram="chart"]',
  );
}

/** 図の表示する枠 */
function viewportOf(page: Page) {
  return chartOf(page).locator('[role="group"][aria-roledescription="図"]');
}

/** 倍率の表示（`67%` など）を数にする */
async function percentOf(page: Page): Promise<number> {
  const text = await chartOf(page).locator(".mdmark-diagram-zoom").innerText();
  return Number.parseInt(text, 10);
}

/** チャートを右上のボタンとキーの `+`・`-`・`0` で拡大・縮小し、拡大してからドラッグで動かす */
async function zoomAndDragChart(page: Page): Promise<void> {
  const chart = chartOf(page);
  await expect(chart).toHaveCount(1);
  const viewport = viewportOf(page);
  const fit = await percentOf(page);
  // 拡大のボタンで上がり、キーの + で上がり、- で下がり、0 で開いたときの倍率と位置に戻る
  await chart.getByRole("button", { name: "拡大" }).click();
  const larger = await percentOf(page);
  expect(larger).toBeGreaterThan(fit);
  await viewport.focus();
  await page.keyboard.press("+");
  expect(await percentOf(page)).toBeGreaterThan(larger);
  await page.keyboard.press("-");
  expect(await percentOf(page)).toBe(larger);
  await page.keyboard.press("0");
  expect(await percentOf(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  // 拡大してから、上の端の余白を左へドラッグすると、チャートが動く
  for (let count = 0; count < ZOOM_CLICKS; count += 1) {
    await chart.getByRole("button", { name: "拡大" }).click();
  }
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
    element.scrollTop = 0;
  });
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  const start = await viewport.evaluate((element) => element.scrollLeft);
  const margin = { x: box.x + box.width / 2, y: box.y + 4 };
  await page.mouse.move(margin.x, margin.y);
  await page.mouse.down();
  await page.mouse.move(margin.x - 100, margin.y, { steps: 5 });
  await page.mouse.up();
  expect(
    await viewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(start);
}

/** `data-hint` の箱の右上の印・図の箱の `hint` の印にツールチップが出て、HTML の中の用語にフォーカスすると意味のツールチップが出る */
async function readHintsAndTerm(page: Page): Promise<void> {
  // `data-hint` の箱だけに右上の印があり、ヒントの無い箱には無い
  const block = page.locator(".mdmark-hint-block");
  await expect(block).toHaveCount(1);
  const mark = block.locator(".mdmark-hint-mark");
  await expect(mark).toHaveCount(1);
  await expect(
    page
      .locator(".mdmark-html div", { hasText: "ヒントの無い箱" })
      .locator(".mdmark-hint-mark"),
  ).toHaveCount(0);
  // 印の外ではツールチップが出ず、ポインターの形は変わらない
  const blockTip = page.locator('[role="tooltip"]', { hasText: BLOCK_HINT });
  await block.hover({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(CLOSE_WAIT_MS);
  await expect(blockTip).toBeHidden();
  expect(
    await block.evaluate((element) => getComputedStyle(element).cursor),
  ).not.toBe("help");
  // 印にポインターを乗せるとツールチップが出る
  await mark.hover();
  await expect(blockTip).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(blockTip).toBeHidden();
  // 印にフォーカスすると同じツールチップが出て、Esc で消えてフォーカスは印に残る
  await mark.focus();
  await expect(blockTip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(blockTip).toBeHidden();
  await expect(mark).toBeFocused();
  // 図の箱の hint: 名前の上では出ず、右上の印の上で出る
  const info = page.getByRole("button", { name: "「窓口の MCP」の説明" });
  const nodeTip = page.locator('[role="tooltip"]', { hasText: NODE_HINT });
  await page.locator('[data-node="mcp"] .mdmark-diagram-node-name').hover();
  await page.waitForTimeout(CLOSE_WAIT_MS);
  await expect(nodeTip).toBeHidden();
  await info.hover();
  await expect(nodeTip).toBeVisible();
  await page.mouse.move(0, 0);
  // HTML の中の用語に下線が引かれ、フォーカスすると用語集の意味が出る
  const term = page.locator(".mdmark-html p .mdmark-term");
  await expect(term).toHaveText("意思決定モデル");
  await expect(term).toHaveCSS("text-decoration-style", "dashed");
  await term.focus();
  const tipId = await term.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${tipId}"]`)).toContainText(TERM_MEANING);
}

// 印を付けた html のコードブロックを描き、チャートの拡大・縮小・移動、ヒントと用語のツールチップを読む（正常シナリオ）
test("test_normal", async ({ builtRoot, page }) => {
  // 準備
  await openPage(page, builtRoot);
  const tail = Array.from(
    { length: TAIL_PARAGRAPHS },
    (_, index) => `段落 ${index + 1}\n`,
  ).join("\n");
  const markdown = [
    wrapHtml(sampleHtml()),
    OUTSIDE,
    await hintFlowMarkdown(),
    tail,
  ].join("\n");
  // 実行
  await mountDocument(page, { markdown, index: TERM_INDEX });
  // 検証: 印を付けた HTML はその場の HTML、印の無い html のコードブロックはコードのまま
  const html = page.locator("#doc .mdmark-html");
  await expect(html).toHaveCount(1);
  await expect(html.locator("h2")).toHaveText("問い合わせの集計");
  await expect(html.locator("pre")).toHaveCount(0);
  await expect(page.locator("#doc pre")).toHaveCount(1);
  await expect(page.locator("#doc pre")).toContainText("<p>範囲の外</p>");
  // script 要素は残らず、実行されない
  await expect(page.locator("#doc script")).toHaveCount(0);
  expect(await page.evaluate(() => "__mdmarkScriptRan" in window)).toBe(false);
  // チャートでない HTML の部分には、拡大・縮小のボタンが出ない
  await expect(chartOf(page)).toHaveCount(1);
  await expect(html.locator("button[data-tool]")).toHaveCount(
    await chartOf(page).locator("button[data-tool]").count(),
  );
  await expect(html.locator("p button")).toHaveCount(0);
  // チャートの拡大・縮小・移動
  await zoomAndDragChart(page);
  // 図の上のホイールは、倍率を変えず文書をスクロールする
  const zoom = await percentOf(page);
  const box = await viewportOf(page).boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(await percentOf(page)).toBe(zoom);
  // ヒントと用語のツールチップ
  await page.evaluate(() => window.scrollTo(0, 0));
  await readHintsAndTerm(page);
});

// 文書を 1 枚の HTML に書き出し、外への要求を止めて file:// で開いても、チャートとヒントと用語を読める（正常シナリオ（書き出した HTML で読む））
test("test_normal_when_exported", async ({ builtRoot, tempDir, page }) => {
  // 準備
  const dir = await tempDir();
  await writeFiles(dir, {
    "mdmark.config.yaml": "index: index.yaml\n",
    "index.yaml": EXPORT_INDEX,
    "guide.md": [
      wrapHtml(sampleHtml({ script: false })),
      await hintFlowMarkdown(),
    ].join("\n"),
  });
  // 実行
  const exported = await runCli(
    builtRoot,
    ["export", "guide.md", "--out", "out/guide.html"],
    dir,
  );
  // 検証
  expect(exported.code).toBe(0);
  await page.route(/^https?:\/\//, (route) => route.abort());
  const opened = await openStandalone(page, {
    tempDir,
    htmlFile: join(dir, "out", "guide.html"),
  });
  await expect(page.locator(".mdmark-html h2")).toHaveText("問い合わせの集計");
  await expect(chartOf(page)).toHaveCount(1);
  await expect(
    chartOf(page).locator("svg[role=img] .mdmark-diagram-bar"),
  ).toHaveCount(8);
  await zoomAndDragChart(page);
  await readHintsAndTerm(page);
  expect(opened.externalRequests()).toEqual([]);
  expect(opened.pageErrors()).toEqual([]);
});
