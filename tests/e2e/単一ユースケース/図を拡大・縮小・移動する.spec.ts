import { expect, type Locator, type Page, test } from "@playwright/test";
import { BAR_TEXT, chartElement, monthlyChart, wrapHtml } from "../chart.ts";
import {
  FRAME_HINT,
  flowMarkdown,
  groupFlowText,
  linkedFlowText,
  routeLinkTargets,
  tabToViewport,
  wrapDirective,
  zoomPercent,
} from "../diagram.ts";
import {
  buildDistRoot,
  destroyDocument,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";
import { ER_DEFINITION, erMarkdown, FOLD_DEFINITION } from "../er.ts";
import { MERMAID_SVG, MERMAID_WAIT_MS, routeMermaid } from "../mermaid.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 拡大のボタンを押す回数
const ZOOM_CLICKS = 2;
// 横にはみ出すまで拡大するときに、拡大のボタンを押す回数の上限（上限の 300% に届く回数）
const ZOOM_MAX_CLICKS = 6;

// 文書を縦にスクロールできるようにする、末尾の段落の数
const TAIL_PARAGRAPHS = 40;

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 図を描いたページを開く。`paragraphs` を渡すと、図の下に段落を続けて文書を縦にスクロールできるようにする */
async function openFlow(page: Page, paragraphs = 0): Promise<void> {
  await openPage(page, builtRoot);
  const tail = Array.from({ length: paragraphs }, (_, i) => `段落 ${i + 1}\n`);
  await mountDocument(page, {
    markdown: `${await flowMarkdown()}\n${tail.join("\n")}`,
  });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

/** 図の表示する枠 */
function viewportOf(page: Page) {
  return page.locator('#doc [role="group"][aria-roledescription="図"]');
}

/** 拡大のボタンを `ZOOM_CLICKS` 回押して、表示する枠の中央へ動いた拡大した図にする */
async function zoomIn(page: Page): Promise<void> {
  for (let count = 0; count < ZOOM_CLICKS; count += 1) {
    await page.getByRole("button", { name: "拡大" }).click();
  }
}

// 全体が収まる倍率で開き、ボタンとキーで拡大・縮小し、0 で戻す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備・実行
  await openFlow(page);
  // 検証: 開いたとき、図の全体が表示する枠の中に収まっている
  const viewport = viewportOf(page);
  const fit = await zoomPercent(page);
  expect(fit).toBe(100);
  const sizer = page.locator("#doc .mdmark-diagram-sizer");
  const frameWidth = await viewport.evaluate((element) => element.clientWidth);
  const sizerWidth = await sizer.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(sizerWidth).toBeLessThanOrEqual(frameWidth + 1);
  // ボタンは右上にあり、それぞれ読み上げの名前を持つ。縮小は押せない。戻すための別のボタンは無く、倍率の表示がその役目を持つ
  for (const name of [
    "縮小",
    "拡大",
    "全体が収まる倍率に戻す",
    "全画面で開く",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "縮小" })).toBeDisabled();
  const fitButton = page.getByRole("button", {
    name: "全体が収まる倍率に戻す",
  });
  await expect(fitButton).toHaveCount(1);
  await expect(fitButton).toHaveClass(/mdmark-diagram-zoom/);
  await expect(fitButton).toHaveText(`${fit}%`);
  await expect(fitButton).toBeEnabled();
  await expect(page.locator("#doc .mdmark-diagram-tools output")).toHaveCount(
    0,
  );
  // 拡大のボタンで倍率が上がり、縮小のボタンで下がる
  await page.getByRole("button", { name: "拡大" }).click();
  const larger = await zoomPercent(page);
  expect(larger).toBeGreaterThan(fit);
  await page.getByRole("button", { name: "縮小" }).click();
  expect(await zoomPercent(page)).toBe(fit);
  // 図にフォーカスして + で上がり、- で下がる
  await viewport.focus();
  await page.keyboard.press("+");
  expect(await zoomPercent(page)).toBe(larger);
  await page.keyboard.press("-");
  expect(await zoomPercent(page)).toBe(fit);
  // 0 で、開いたときの倍率と位置に戻る
  await zoomIn(page);
  await viewport.focus();
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
  // 拡大のボタンを押してから倍率の表示を押すと、開いたときの倍率と位置に戻る
  await zoomIn(page);
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  expect(await zoomPercent(page)).toBeGreaterThan(fit);
  await fitButton.click();
  expect(await zoomPercent(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
});

// 図の上のホイールは倍率を変えず文書を縦にスクロールし、Shift とホイールで図が横に動く（正常シナリオ（ホイール））
test("test_normal_when_wheel", async ({ page }) => {
  // 準備
  await openFlow(page, TAIL_PARAGRAPHS);
  await zoomIn(page);
  const viewport = viewportOf(page);
  const zoom = await zoomPercent(page);
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  // 実行: 図の上でホイールを回す
  await page.mouse.move(center.x, center.y);
  await page.mouse.wheel(0, 300);
  // 検証: 倍率が変わらず、文書が縦にスクロールする
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(await zoomPercent(page)).toBe(zoom);
  // 実行: 文書を先頭へ戻し、Shift を押しながらホイールを回す
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const box2 = (await viewport.boundingBox()) ?? box;
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 200);
  await page.keyboard.up("Shift");
  // 検証: 図が横に動く
  await expect
    .poll(() => viewport.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
});

// 余白のドラッグで図が動き、文字の上のドラッグでは図が動かず文字が選ばれる（正常シナリオ（ドラッグと文字の選択））
test("test_normal_when_drag", async ({ page }) => {
  // 準備
  await openFlow(page);
  await zoomIn(page);
  const viewport = viewportOf(page);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
  });
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  // 余白（図の上の端で、何も置いていない所）を 100px 左へドラッグする
  const start = await viewport.evaluate((element) => element.scrollLeft);
  const margin = { x: box.x + box.width / 2, y: box.y + 4 };
  await expect(viewport).toHaveCSS("cursor", "grab");
  await page.mouse.move(margin.x, margin.y);
  await page.mouse.down();
  await page.mouse.move(margin.x - 100, margin.y, { steps: 5 });
  // 検証: ドラッグ中は文字が選ばれない。ドラッグした分だけ図が動く
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await page.mouse.up();
  const moved = await viewport.evaluate((element) => element.scrollLeft);
  expect(moved - start).toBeGreaterThan(95);
  expect(moved - start).toBeLessThan(105);
  // 実行: 箱の名前の上で押したまま動かす
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
  });
  const name = page.locator(
    '#doc [data-node="recv"] .mdmark-diagram-node-name',
  );
  await expect(name).toHaveCSS("cursor", "text");
  const nameBox = await name.boundingBox();
  if (!nameBox) {
    throw new Error("箱の名前の範囲を取れない");
  }
  const y = nameBox.y + nameBox.height / 2;
  await page.mouse.move(nameBox.x + 1, y);
  await page.mouse.down();
  await page.mouse.move(nameBox.x + nameBox.width - 1, y, { steps: 5 });
  await page.mouse.up();
  // 検証: 図は動かず、名前の文字が選ばれる
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  expect(await page.evaluate(() => getSelection()?.toString())).toContain(
    "受け",
  );
});

// 矢印キーと移動のボタンで、押した向きの先が見えるように図が動き、キーボードだけで図へフォーカスできる（正常シナリオ（矢印キーとボタンで動かす））
test("test_normal_when_keyboard", async ({ page }) => {
  // 準備
  await openFlow(page);
  await zoomIn(page);
  const viewport = viewportOf(page);
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
    element.scrollTop = 0;
  });
  // 実行・検証: Tab だけで図の表示する枠へフォーカスでき、フォーカスの枠が見える
  await tabToViewport(page);
  await expect(viewport).toBeFocused();
  await expect(viewport).not.toHaveCSS("outline-style", "none");
  // → で 80px 動き、右側が見える
  await page.keyboard.press("ArrowRight");
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(80);
  // 移動のボタンでも同じだけ動き、ボタンは読み上げの名前を持つ
  const down = page.getByRole("button", { name: "下へ動かす" });
  await expect(down).toBeVisible();
  const top = await viewport.evaluate((element) => element.scrollTop);
  await down.click();
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(
    top + 80,
  );
});

// 埋め込んだ HTML の中のチャートを、ボタンとキーで拡大・縮小し、ドラッグで動かし、ホイールは文書のスクロールに使う。段落には拡大・縮小のボタンが無い（正常シナリオ（埋め込んだ HTML の中のチャート））
test("test_normal_when_embedded_chart", async ({ page }) => {
  // 準備: チャートを同じ HTML の段落と一緒に描き、文書が縦にスクロールできるようにする
  await openPage(page, builtRoot);
  const tail = Array.from(
    { length: TAIL_PARAGRAPHS },
    (_, i) => `段落 ${i + 1}\n`,
  );
  await mountDocument(page, {
    markdown: `${wrapHtml(`<p>チャートの前の段落</p>\n${chartElement(BAR_TEXT)}\n<p>チャートの後の段落</p>`)}\n${tail.join("\n")}`,
  });
  const figure = page.locator("#doc .mdmark-html figure.mdmark-diagram");
  await expect(figure).toHaveCount(1);
  const viewport = viewportOf(page);
  const fit = await zoomPercent(page);
  // 検証: 拡大のボタンで倍率が上がる
  await page.getByRole("button", { name: "拡大" }).click();
  const larger = await zoomPercent(page);
  expect(larger).toBeGreaterThan(fit);
  // 実行・検証: チャートにフォーカスして - で下がり、0 で開いたときの倍率と位置に戻る
  await zoomIn(page);
  await viewport.focus();
  const zoomed = await zoomPercent(page);
  await page.keyboard.press("-");
  expect(await zoomPercent(page)).toBeLessThan(zoomed);
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  // 実行・検証: 横にはみ出すまで拡大してからドラッグすると、チャートの位置が動く
  await zoomIn(page);
  for (let count = 0; count < ZOOM_MAX_CLICKS; count += 1) {
    if (
      await viewport.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      )
    ) {
      break;
    }
    await page.getByRole("button", { name: "拡大" }).click();
  }
  expect(
    await viewport.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBe(true);
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
  // 検証: 拡大しても線と文字は SVG のまま描かれ、画像に置き換わらない
  await expect(figure.locator("svg[role=img]")).toHaveCount(1);
  await expect(figure.locator("svg[role=img] text").first()).toBeVisible();
  await expect(figure.locator("canvas, img")).toHaveCount(0);
  // 実行・検証: チャートの上のホイールは、倍率を変えず文書をスクロールする
  const zoom = await zoomPercent(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const box2 = (await viewport.boundingBox()) ?? box;
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.wheel(0, 300);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0);
  expect(await zoomPercent(page)).toBe(zoom);
  // 検証: 同じ HTML の段落には、拡大・縮小のボタンが無い
  await expect(page.locator("#doc .mdmark-html p button")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-html button[data-tool]")).toHaveCount(
    await figure.locator("button[data-tool]").count(),
  );
});

/** ER 図を描いたページを開く */
async function openEr(page: Page, definition: unknown = ER_DEFINITION) {
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: erMarkdown(definition) });
  const figure = page.locator('#doc figure.mdmark-diagram[data-diagram="er"]');
  await expect(figure).toHaveCount(1);
  return figure;
}

// ER 図を全体が収まる倍率で開き、拡大・ドラッグ・全画面・0 で戻すを、フロー図と同じボタンで操作する（正常シナリオ（ER 図））
test("test_normal_when_er_diagram", async ({ page }) => {
  // 準備・実行
  await openEr(page);
  // 検証: 開いたとき、ER 図の全体が表示する枠の中に収まっている
  const viewport = viewportOf(page);
  const fit = await zoomPercent(page);
  expect(fit).toBe(100);
  const frameWidth = await viewport.evaluate((element) => element.clientWidth);
  const sizerWidth = await page
    .locator("#doc .mdmark-diagram-sizer")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(sizerWidth).toBeLessThanOrEqual(frameWidth + 1);
  // 右上のボタンは、フロー図と同じ並びと読み上げの名前を持つ
  const names = await page
    .locator("#doc .mdmark-diagram-tools button:visible")
    .evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
  expect(names).toEqual([
    "縮小",
    `倍率 ${fit}%。全体が収まる倍率に戻す`,
    "拡大",
    "全画面で開く",
  ]);
  // 拡大のボタンで倍率が上がり、ドラッグで図が動く
  await zoomIn(page);
  expect(await zoomPercent(page)).toBeGreaterThan(fit);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  });
  const box = await viewport.boundingBox();
  if (!box) {
    throw new Error("表示する枠の範囲を取れない");
  }
  const margin = { x: box.x + box.width / 2, y: box.y + 4 };
  await page.mouse.move(margin.x, margin.y);
  await page.mouse.down();
  await page.mouse.move(margin.x - 100, margin.y, { steps: 5 });
  await page.mouse.up();
  expect(
    await viewport.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  // 0 で開いたときの倍率と位置に戻る
  await viewport.focus();
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  // 全画面のボタンで ER 図を全画面で表示する
  await page.getByRole("button", { name: "全画面で開く" }).click();
  const dialog = page.locator("dialog.mdmark-diagram-dialog[open]");
  await expect(dialog).toHaveCount(1);
  await expect(dialog.locator(".mdmark-diagram-er-table")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

// 列の多いテーブルを開閉のボタンで畳み、キーボードで開き直し、関係の線を結び直す（正常シナリオ（列の多いテーブルを畳む））
test("test_normal_when_er_columns_folded", async ({ page }) => {
  // 準備
  const figure = await openEr(page, FOLD_DEFINITION);
  const orders = figure.locator('.mdmark-diagram-er-table[data-node="orders"]');
  const rows = orders.locator(".mdmark-diagram-er-column:visible");
  const button = orders.getByRole("button", {
    name: "「注文」の主キーと外部キー以外の列",
  });
  const line = figure.locator('g[data-er-to="orders"] path[data-line="er"]');
  // 検証: 開いたとき、12 個の列が全て出ている
  await expect(rows).toHaveCount(12);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const before = await line.getAttribute("d");
  // 実行
  await button.click();
  // 検証: 主キーと外部キーの 2 つの列だけが出て、畳んだ列があることが示されている
  await expect(rows).toHaveCount(2);
  await expect(orders.locator(".mdmark-diagram-er-rest")).toHaveText(
    "非表示 10 列",
  );
  await expect(button).toHaveAttribute("aria-expanded", "false");
  expect(await line.getAttribute("d")).not.toBe(before);
  // 実行: キーボードで開き直す
  await button.focus();
  await page.keyboard.press("Enter");
  // 検証
  await expect(rows).toHaveCount(12);
  await expect(button).toHaveAttribute("aria-expanded", "true");
  expect(await line.getAttribute("d")).toBe(before);
});

// リンク先を持つノードの名前の上から始めたドラッグで図を動かし、離してもリンク先を開かない。動かさずに押すと開く（正常シナリオ（リンク先を持つノードの上のドラッグ））
test("test_normal_when_drag_on_linked_node", async ({ page }) => {
  // 準備
  const opened = await routeLinkTargets(page, ["https://example.com/spec"]);
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapDirective(
      "flow",
      linkedFlowText({ hrefs: ["https://example.com/spec", "./other.md"] }),
    ),
  });
  await zoomIn(page);
  const viewport = viewportOf(page);
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
    element.scrollTop = 0;
  });
  const name = page.locator('#doc [data-node="a"] .mdmark-diagram-node-name');
  // 検証: 名前の文字の上も押せる形のカーソル
  await expect(name).toHaveCSS("cursor", "pointer");
  const nameBox = await name.boundingBox();
  if (!nameBox) {
    throw new Error("ノードの名前の範囲を取れない");
  }
  // 実行: 名前の文字の上で押したまま 100px 左へ動かして離す
  const start = await viewport.evaluate((element) => element.scrollLeft);
  const y = nameBox.y + nameBox.height / 2;
  const x = nameBox.x + nameBox.width - 4;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 100, y, { steps: 5 });
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await page.mouse.up();
  // 検証: 動かした分だけ図が動き、リンク先は開かない
  const moved = await viewport.evaluate((element) => element.scrollLeft);
  expect(moved - start).toBeGreaterThan(95);
  expect(moved - start).toBeLessThan(105);
  await page.waitForTimeout(500);
  expect(opened()).toEqual([]);
  // 実行・検証: 動かさずに押して離すと、リンク先が開く
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await name.click();
  await page.waitForURL("https://example.com/spec");
  expect(opened()).toEqual(["https://example.com/spec"]);
});

/** 表示する枠の中で、文字・押せる所・グループのタイトルに当たらない位置（ドラッグを始められる所）を、画面の座標で返す */
async function emptyPointIn(
  viewport: Locator,
): Promise<{ x: number; y: number }> {
  const point = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const avoid =
      ".mdmark-diagram-node, .mdmark-diagram-label, button, a, .mdmark-diagram-frame-title, .mdmark-diagram-lane-label, .mdmark-term";
    for (let y = rect.bottom - 8; y > rect.top + 8; y -= 12) {
      for (let x = rect.left + 8; x < rect.right - 8; x += 12) {
        const hit = document.elementFromPoint(x, y);
        if (hit && element.contains(hit) && !hit.closest(avoid)) {
          return { x, y };
        }
      }
    }
    return undefined;
  });
  if (!point) {
    throw new Error("表示する枠にドラッグを始められる所が無い");
  }
  return point;
}

/** 表示する枠を、押したまま縦に `dy`（上へは負）動かして離す */
async function dragVertically(
  page: Page,
  viewport: Locator,
  dy: number,
): Promise<void> {
  const from = await emptyPointIn(viewport);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, from.y + dy, { steps: 8 });
  await page.mouse.up();
}

/** 図の今の倍率（図の本体に掛けた `scale()`） */
function scaleOf(page: Page): Promise<number> {
  return page
    .locator("#doc .mdmark-diagram-stage")
    .evaluate(
      (stage) => new DOMMatrixReadOnly(getComputedStyle(stage).transform).a,
    );
}

/** 要素の画面に対する範囲（無ければ例外） */
async function rectOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("要素の範囲を取れない");
  }
  return { ...box, bottom: box.y + box.height };
}

/** グループのタイトルの見る位置: 処理の層とデータの層のタイトルと、システムの枠のタイトル */
function groupTitles(page: Page) {
  return {
    frame: page.locator("#doc .mdmark-diagram-frame-title"),
    process: page.locator("#doc .mdmark-diagram-lane-label", {
      hasText: "処理",
    }),
    data: page.locator("#doc .mdmark-diagram-lane-label", {
      hasText: "データ",
    }),
  };
}

/** システムの枠と 3 層のフロー図を描き、処理の層を表示する枠の上へ出せるまで拡大する */
async function openZoomedGroups(
  page: Page,
  stickyTitles?: boolean,
): Promise<Locator> {
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapDirective(
      "flow",
      await groupFlowText(stickyTitles === undefined ? {} : { stickyTitles }),
    ),
  });
  await zoomIn(page);
  // 処理の層が表示する枠の上へ出るまで縦に動かせるよう、足りなければさらに拡大する
  const viewport = viewportOf(page);
  const lane = page.locator('#doc .mdmark-diagram-lane[data-kind="mcp"]');
  for (let count = 0; count < ZOOM_MAX_CLICKS; count += 1) {
    const room = await viewport.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    const laneBottom = (await rectOf(lane)).bottom - (await rectOf(viewport)).y;
    const button = page.getByRole("button", { name: "拡大" });
    if (room > laneBottom + 40 || (await button.isDisabled())) {
      break;
    }
    await button.click();
  }
  return viewport;
}

// 拡大して動かした間、見えているシステムの枠と層のタイトルを表示する枠の上端に留め、層が上へ出たら次の層のタイトルを留める（正常シナリオ（グループのタイトルを留める））
test("test_normal_when_group_titles_stuck", async ({ page }) => {
  // 準備
  const viewport = await openZoomedGroups(page);
  const { frame, process, data } = groupTitles(page);
  const lane = page.locator('#doc .mdmark-diagram-lane[data-kind="mcp"]');
  const scale = await scaleOf(page);
  // 実行: 図を上へドラッグして、処理の層の途中を見せる
  const top = (await rectOf(viewport)).y;
  const laneRect = await rectOf(lane);
  await dragVertically(
    page,
    viewport,
    -(laneRect.y + laneRect.height / 2 - top),
  );
  // 検証: システムの枠と処理の層のタイトルが、表示する枠の上端に見えている
  const frameRect = await rectOf(frame);
  expect(frameRect.y).toBeGreaterThanOrEqual(top - 1);
  expect(frameRect.y).toBeLessThanOrEqual(top + 8 * scale + 1);
  const processRect = await rectOf(process);
  expect(processRect.y).toBeGreaterThanOrEqual(frameRect.bottom - 1);
  expect(processRect.y).toBeLessThanOrEqual(frameRect.bottom + 8 * scale + 1);
  // 検証: 留めたタイトルは不透明な背景を持ち、ノードと線より手前にある
  for (const title of [frame, process]) {
    await expect(title).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    const front = await title.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + Math.min(rect.width / 2, 24),
        rect.top + rect.height / 2,
      );
      return hit !== null && (hit === element || element.contains(hit));
    });
    expect(front).toBe(true);
  }
  // 実行・検証: 留めたタイトルの hint の印にポインターを乗せると、ツールチップが出る
  await frame.locator(".mdmark-diagram-group-info").hover();
  await expect(
    page.locator('[role="tooltip"]', { hasText: FRAME_HINT }),
  ).toBeVisible();
  await page.mouse.move(0, 0);
  // 実行: 処理の層が表示する枠の上へ出るまで動かす
  const after = await rectOf(lane);
  await dragVertically(page, viewport, -(after.bottom - top + 24));
  // 検証: 処理の層のタイトルは留まらず、データの層のタイトルが上端に見えている
  expect((await rectOf(process)).bottom).toBeLessThanOrEqual(top + 1);
  const dataRect = await rectOf(data);
  const frameAfter = await rectOf(frame);
  expect(dataRect.y).toBeGreaterThanOrEqual(frameAfter.bottom - 1);
  expect(dataRect.y).toBeLessThanOrEqual(frameAfter.bottom + 8 * scale + 1);
});

// stickyTitles: false の図では、タイトルも図と同じだけ動いて表示する枠の上へ隠れる（正常シナリオ（グループのタイトルを留めない））
test("test_normal_when_sticky_titles_off", async ({ page }) => {
  // 準備
  const viewport = await openZoomedGroups(page, false);
  const { frame, process } = groupTitles(page);
  const lane = page.locator('#doc .mdmark-diagram-lane[data-kind="mcp"]');
  // 実行: 図を上へドラッグして、処理の層の途中を見せる
  const top = (await rectOf(viewport)).y;
  const laneRect = await rectOf(lane);
  await dragVertically(
    page,
    viewport,
    -(laneRect.y + laneRect.height / 2 - top),
  );
  // 検証: システムの枠と処理の層のタイトルが、表示する枠の上へ隠れる
  expect((await rectOf(frame)).bottom).toBeLessThanOrEqual(top + 1);
  expect((await rectOf(process)).bottom).toBeLessThanOrEqual(top + 1);
});

/** 幅 500・高さ 1600 の縦に長いフロー図の定義 */
const TALL_FLOW = JSON.stringify({
  title: "縦に長い処理の流れ",
  scope: "高さの確認",
  updated: "2026-11-05",
  width: 500,
  height: 1600,
  nodes: [
    { id: "a", kind: "script", x: 40, y: 40, w: 180, h: 72, name: "受け取る" },
    { id: "b", kind: "script", x: 40, y: 760, w: 180, h: 72, name: "分ける" },
    { id: "c", kind: "data", x: 40, y: 1480, w: 180, h: 72, name: "残す" },
  ],
  wires: [
    {
      id: "w1",
      from: "a",
      to: "b",
      line: "flow",
      points: [
        [130, 112],
        [130, 760],
      ],
    },
    {
      id: "w2",
      from: "b",
      to: "c",
      line: "write",
      points: [
        [130, 832],
        [130, 1480],
      ],
    },
  ],
});

/** 縦に長い図を描く（読み直した後も同じ文書を描き直す） */
async function mountTall(page: Page): Promise<void> {
  await mountDocument(page, { markdown: wrapDirective("flow", TALL_FLOW) });
  await expect(page.locator("#doc figure.mdmark-diagram")).toHaveCount(1);
}

/** 表示する枠の高さ（px） */
async function heightOf(page: Page): Promise<number> {
  return (await rectOf(viewportOf(page))).height;
}

// 右下のリサイズハンドルのドラッグと上下キーで表示する枠の高さを変え、読み直しても保ち、ダブルクリックで戻し、全画面には置かない（正常シナリオ（リサイズハンドルで高さを変える））
test("test_normal_when_resized", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountTall(page);
  const handle = page.getByRole("separator", {
    name: "「縦に長い処理の流れ」の表示の高さ",
  });
  // 検証: 右下にリサイズハンドルがあり、読み上げの名前を持ち、キーボードでフォーカスできる
  await expect(handle).toBeVisible();
  const frame = await rectOf(viewportOf(page));
  const handleRect = await rectOf(handle);
  expect(handleRect.x + handleRect.width).toBeGreaterThan(
    frame.x + frame.width - 40,
  );
  expect(handleRect.bottom).toBeGreaterThan(frame.bottom - 40);
  await handle.focus();
  await expect(handle).toBeFocused();
  const opened = await heightOf(page);
  const width = frame.width;
  // 実行: 下へ 200px ドラッグする
  const center = {
    x: handleRect.x + handleRect.width / 2,
    y: handleRect.y + handleRect.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x, center.y + 200, { steps: 8 });
  await page.mouse.up();
  // 検証: ドラッグした分だけ高くなり、幅は変わらず、図の全体が収まる高さを超えない
  const resized = await heightOf(page);
  expect(Math.abs(resized - opened - 200)).toBeLessThanOrEqual(2);
  expect(
    Math.abs((await rectOf(viewportOf(page))).width - width),
  ).toBeLessThanOrEqual(1);
  expect(resized).toBeLessThanOrEqual(1600 * (await scaleOf(page)) + 2);
  // 実行・検証: 0 で、変えた高さで図の全体が収まる倍率になる
  await viewportOf(page).focus();
  await page.keyboard.press("0");
  const fits = await viewportOf(page).evaluate((element) => {
    const sizer = element.querySelector<HTMLElement>(".mdmark-diagram-sizer");
    const rect = sizer?.getBoundingClientRect();
    return rect
      ? rect.width <= element.clientWidth + 1 &&
          rect.height <= element.clientHeight + 1
      : false;
  });
  expect(fits).toBe(true);
  // 実行・検証: ↑ で低く、↓ で高くなる
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  const lowered = await heightOf(page);
  expect(lowered).toBeLessThan(resized);
  await page.keyboard.press("ArrowDown");
  const kept = await heightOf(page);
  expect(kept).toBeGreaterThan(lowered);
  // 実行・検証: 読み直した後も、変えた高さで描く
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mountTall(page);
  expect(Math.abs((await heightOf(page)) - kept)).toBeLessThanOrEqual(2);
  // 実行・検証: ダブルクリックで定義から決まる高さに戻り、読み直しても戻した高さのまま
  await handle.dblclick();
  expect(Math.abs((await heightOf(page)) - opened)).toBeLessThanOrEqual(2);
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mountTall(page);
  expect(Math.abs((await heightOf(page)) - opened)).toBeLessThanOrEqual(2);
  // 実行・検証: 全画面で開いた図にはリサイズハンドルが無い
  await page.getByRole("button", { name: "全画面で開く" }).click();
  const dialog = page.locator("#doc dialog.mdmark-diagram-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".mdmark-diagram-resize")).toHaveCount(0);
});

// 拡大したグラフの点の上で、わずかに動かして離しても図は動かずツールチップが出たまま、大きく動かすと図が動きツールチップが消える（正常シナリオ（グラフの項目の上で動かす））
test("test_normal_when_drag_on_chart_item", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: wrapDirective("chart", JSON.stringify(monthlyChart("line"))),
  });
  await zoomIn(page);
  const viewport = viewportOf(page);
  // 表示する枠の中に見えている点を選ぶ
  const index = await viewport.evaluate((element) => {
    const frame = element.getBoundingClientRect();
    return [...element.querySelectorAll('[data-tip-owner^="item:"]')].findIndex(
      (owner) => {
        const rect = owner.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        return (
          x > frame.left + 160 &&
          x < frame.right - 20 &&
          y > frame.top &&
          y < frame.bottom
        );
      },
    );
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const point = viewport.locator('[data-tip-owner^="item:"]').nth(index);
  const tip = page.locator(
    `[id="${await point.getAttribute("aria-describedby")}"]`,
  );
  // 実行・検証: 点にポインターを乗せると、点のツールチップが出る
  await point.hover();
  await expect(tip).toBeVisible();
  const before = await viewport.evaluate((element) => element.scrollLeft);
  const rect = await rectOf(point);
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  // 実行・検証: 点の上で押し、わずかに動かして離すと、図は動かずツールチップが出たまま
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 2, center.y);
  await page.mouse.up();
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(before);
  await expect(tip).toBeVisible();
  // 実行・検証: 点の上で押したまま大きく動かすと、動かした分だけ図が動き、ツールチップは消える
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x - 120, center.y, { steps: 8 });
  const moved = await viewport.evaluate((element) => element.scrollLeft);
  expect(moved - before).toBeGreaterThan(110);
  await expect(tip).toBeHidden();
  await page.mouse.up();
});

/** 横に並べた 6 つのノードを持つ mermaid の flowchart */
const WIDE_MERMAID = [
  "```mermaid",
  "flowchart LR",
  "  A[問い合わせを受ける] --> B[担当を探す] --> C[担当へ回す]",
  "  C --> D[回答を書く] --> E[回答を確かめる] --> F[回答を送る]",
  "```",
  "",
].join("\n");

/** 図の枠の右上のボタンの読み上げの名前を、並んだ順に返す（倍率の数字は除く） */
function toolNames(page: Page): Promise<string[]> {
  return page
    .locator("#doc figure.mdmark-diagram .mdmark-diagram-tools button")
    .evaluateAll((buttons) =>
      buttons.map((button) =>
        (button.getAttribute("aria-label") ?? "").replace(/\d+%/, "N%"),
      ),
    );
}

// mermaid の図も、全体が収まる倍率で開き、ボタン・ドラッグ・リサイズハンドル・全画面・0 で操作できる（正常シナリオ（mermaid の図））
test("test_normal_when_mermaid", async ({ page }) => {
  // 準備: 図を描き、描く先の幅を図の幅より狭くして描き直す
  await routeMermaid(page);
  await openPage(page, builtRoot);
  const svg = page.locator(`#doc ${MERMAID_SVG}`);
  await mountDocument(page, { markdown: WIDE_MERMAID });
  await expect(svg).toHaveCount(1, { timeout: MERMAID_WAIT_MS });
  const natural = await svg.evaluate(
    (element) => (element as SVGSVGElement).viewBox.baseVal.width,
  );
  await destroyDocument(page);
  await page.locator("#doc").evaluate(
    (element, width) => {
      element.style.width = `${width}px`;
    },
    Math.round(natural * 0.85),
  );
  // 実行
  await mountDocument(page, { markdown: WIDE_MERMAID });
  await expect(svg).toHaveCount(1, { timeout: MERMAID_WAIT_MS });
  // 検証: 開いたとき、図の全体が表示する枠の中に収まる
  const viewport = viewportOf(page);
  const fit = await zoomPercent(page);
  expect(fit).toBeLessThan(100);
  const sizer = page.locator("#doc .mdmark-diagram-sizer");
  const frameWidth = await viewport.evaluate((element) => element.clientWidth);
  expect(
    await sizer.evaluate((element) => element.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(frameWidth + 1);
  // 検証: 拡大のボタンで倍率が上がり、ドラッグで図が動く
  await zoomIn(page);
  expect(await zoomPercent(page)).toBeGreaterThan(fit);
  const box = await rectOf(viewport);
  const start = await viewport.evaluate((element) => element.scrollLeft);
  const margin = { x: box.x + box.width / 2, y: box.y + 4 };
  await page.mouse.move(margin.x, margin.y);
  await page.mouse.down();
  await page.mouse.move(margin.x - 100, margin.y, { steps: 5 });
  await page.mouse.up();
  expect(
    (await viewport.evaluate((element) => element.scrollLeft)) - start,
  ).toBeGreaterThan(50);
  // 検証: 拡大しても SVG のまま描かれる
  await expect(svg).toHaveCount(1);
  await expect(
    page.locator("#doc figure.mdmark-diagram").locator("img, canvas"),
  ).toHaveCount(0);
  // 検証: リサイズハンドルのドラッグで表示する枠の高さが変わる
  const handle = page.locator("#doc .mdmark-diagram-resize");
  const opened = await heightOf(page);
  const handleRect = await rectOf(handle);
  const center = {
    x: handleRect.x + handleRect.width / 2,
    y: handleRect.y + handleRect.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x, center.y + 100, { steps: 8 });
  await page.mouse.up();
  expect(await heightOf(page)).toBeGreaterThan(opened);
  // 検証: 0 で開いたときの倍率と位置に戻る
  await viewport.focus();
  await page.keyboard.press("0");
  expect(await zoomPercent(page)).toBe(fit);
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBe(0);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(0);
  // 検証: 全画面のボタンで mermaid の図を全画面で開く
  const mermaidTools = await toolNames(page);
  await page.getByRole("button", { name: "全画面で開く" }).click();
  const dialog = page.locator("#doc dialog.mdmark-diagram-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".mdmark-mermaid > svg")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  // 検証: 右上のボタンが、フロー図と同じ並びと読み上げの名前を持つ（図のタイトルは除く）
  await destroyDocument(page);
  await openFlow(page);
  const flowTools = await toolNames(page);
  expect(
    mermaidTools.map((name) => name.replace(/「[^」]*」/, "「」")),
  ).toEqual(flowTools.map((name) => name.replace(/「[^」]*」/, "「」")));
});
