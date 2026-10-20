import { expect, type Page, test } from "@playwright/test";
import { flowMarkdown, tabToViewport, zoomPercent } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 拡大のボタンを押す回数
const ZOOM_CLICKS = 2;

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
  expect(fit).toBeLessThan(100);
  const sizer = page.locator("#doc .mdmark-diagram-sizer");
  const frameWidth = await viewport.evaluate((element) => element.clientWidth);
  const sizerWidth = await sizer.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(sizerWidth).toBeLessThanOrEqual(frameWidth + 1);
  // ボタンは右上にあり、それぞれ読み上げの名前を持つ。縮小と戻すは押せない
  for (const name of [
    "縮小",
    "拡大",
    "全体が収まる倍率に戻す",
    "全画面で開く",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "縮小" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "全体が収まる倍率に戻す" }),
  ).toBeDisabled();
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
});

// 図の上のホイールは倍率を変えず文書を縦にスクロールし、Shift とホイールで図が横に動く（正常シナリオ（ホイール））
test("test_normal_when_wheel", async ({ page }) => {
  // 準備
  await openFlow(page, 40);
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
