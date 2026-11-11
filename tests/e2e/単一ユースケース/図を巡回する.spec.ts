import { expect, test } from "@playwright/test";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";
import {
  bandButton,
  bandCount,
  isDimmed,
  MAP_DATA,
  MAP_FLOW,
  mapFigure,
  mapNode,
  mapRange,
  openMap,
  packetOwners,
  pauseClock,
  viewState,
} from "../map.ts";

// ビルドした配布物を配置した作業ツリー
let builtRoot = "";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 手順 3 つの案内を持つ構成図（自動で進める間隔は既定の 2 秒） */
const MARKDOWN = mapRange({
  args: '{"title": "全体の構成"}',
  mermaid: MAP_FLOW,
  data: MAP_DATA,
});

// 案内の帯の前へ・次へ・自動で進める・停止で、手順ごとのグループ・強調・説明を出す（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 900, height: 900 });
  await page.clock.install();
  await openMap(page, builtRoot, { markdown: MARKDOWN });
  await pauseClock(page);
  const figure = mapFigure(page);
  const band = figure.locator(".map-band");
  const actions = figure.locator(".map-band-actions");
  // 検証: 始める前の帯
  await expect(band).toHaveAttribute("role", "region");
  await expect(bandCount(figure)).toHaveText("–/3");
  await expect(band.locator("button[data-band]")).toHaveCount(4);
  await expect(bandButton(figure, "stop")).toBeDisabled();
  for (const [name, label] of [
    ["prev", "前の手順"],
    ["stop", "案内をやめる"],
    ["auto", "自動で進める"],
    ["next", "次の手順"],
  ]) {
    await expect(bandButton(figure, name)).toHaveAttribute("aria-label", label);
  }
  await expect(band.locator("input, select")).toHaveCount(0);
  const idle = await actions.boundingBox();
  const start = await viewState(figure);
  // 実行・検証: 手順 1 は指定のノードを強調し、ほかを薄くする
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("1/3");
  await expect(figure.locator(".map-band-title")).toHaveText("mount に渡す");
  await expect(figure.locator(".map-band-text")).toHaveText(
    "利用側のページが、設定と Markdown を mount に渡します。",
  );
  await expect(figure.locator(".map-band-text")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  expect(await isDimmed(mapNode(figure, "mount"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "index"))).toBe(true);
  const stepOne = await actions.boundingBox();
  expect(stepOne?.x).toBeCloseTo(idle?.x ?? -1, 0);
  expect(stepOne?.y).toBeCloseTo(idle?.y ?? -1, 0);
  // 実行・検証: 手順 2 は 3 つのノード
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("2/3");
  for (const id of ["doc", "index", "data"]) {
    expect(await isDimmed(mapNode(figure, id)), id).toBe(false);
  }
  expect(await isDimmed(mapNode(figure, "mount"))).toBe(true);
  // 実行・検証: 手順 3 は配置の中へ入り、2 つのノードの間の線に印が流れ続ける
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("3/3");
  await expect(figure.locator(".map-group-title.is-current")).toHaveText(
    "配置",
  );
  expect(await isDimmed(mapNode(figure, "layout"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "route"))).toBe(false);
  expect(await packetOwners(figure)).toEqual(["layout->route"]);
  // 検証: 前へ・次へで進めても、表示する枠の高さ・倍率・図の枠の中のスクロールが変わらない
  const stepped = await viewState(figure);
  expect(stepped.height).toBeCloseTo(start.height, 0);
  expect(stepped.transform).toBe(start.transform);
  expect(stepped.scroll).toEqual(start.scroll);
  // 実行・検証: 前へで手順 2 に戻り、最後の次へで最初へ回る
  await bandButton(figure, "prev").click();
  await expect(bandCount(figure)).toHaveText("2/3");
  await bandButton(figure, "next").click();
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("1/3");
  await bandButton(figure, "prev").click();
  await expect(bandCount(figure)).toHaveText("3/3");
  // 実行・検証: 帯にフォーカスして左右の矢印キーで進める
  await bandButton(figure, "next").focus();
  await page.keyboard.press("ArrowRight");
  await expect(bandCount(figure)).toHaveText("1/3");
  await page.keyboard.press("ArrowLeft");
  await expect(bandCount(figure)).toHaveText("3/3");
  // 実行・検証: 自動で進めると 2 秒ごとに進み、強調するノードへ図の枠の中がスクロールする
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("1/3");
  await bandButton(figure, "auto").click();
  await expect(bandButton(figure, "auto")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(bandCount(figure)).toHaveText("1/3");
  const pageScroll = (await viewState(figure)).page;
  await page.clock.runFor(1_900);
  await expect(bandCount(figure)).toHaveText("1/3");
  await page.clock.runFor(100);
  await expect(bandCount(figure)).toHaveText("2/3");
  // なめらかなスクロールは止めた時計で動くため、手順が進まない間だけ時計を進める
  await page.clock.runFor(1_000);
  await expect
    .poll(async () => (await viewState(figure)).scroll[0])
    .toBeGreaterThan(0);
  const auto = await viewState(figure);
  expect(auto.page).toEqual(pageScroll);
  expect(auto.transform).toBe(start.transform);
  // 実行・検証: 図の枠をスクロールすると、自動で進め直すまでスクロールしない
  const viewport = figure.locator(".mdmark-diagram-viewport");
  await viewport.evaluate((element) => {
    element.scrollLeft = 0;
    element.dispatchEvent(new WheelEvent("wheel", { deltaX: -40 }));
  });
  await page.clock.runFor(6_000);
  expect((await viewState(figure)).scroll[0]).toBe(0);
  // 実行・検証: 停止で強調が外れ、全体の図と手順の数だけの帯に戻る
  await bandButton(figure, "stop").click();
  await expect(bandCount(figure)).toHaveText("–/3");
  await expect(figure.locator(".map-dim")).toHaveCount(0);
  await expect(figure.locator(".map-group-title.is-current")).toHaveCount(0);
  // 実行・検証: 始める前の前へは最後、次へは最初の手順
  await bandButton(figure, "prev").click();
  await expect(bandCount(figure)).toHaveText("3/3");
  await bandButton(figure, "stop").click();
  await bandButton(figure, "next").click();
  await expect(bandCount(figure)).toHaveText("1/3");
  // 実行・検証: 図にフォーカスしたときの矢印キーは図を動かす
  await viewport.focus();
  const before = (await viewState(figure)).scroll[0];
  await page.keyboard.press("ArrowRight");
  await expect(bandCount(figure)).toHaveText("1/3");
  await expect
    .poll(async () => (await viewState(figure)).scroll[0])
    .toBeGreaterThan(before);
  // 実行・検証: 狭い幅では、タイトルを番号とボタンの下の行に出す
  await page.setViewportSize({ width: 390, height: 844 });
  const title = await figure.locator(".map-band-title").boundingBox();
  const narrow = await actions.boundingBox();
  expect(title?.y ?? 0).toBeGreaterThanOrEqual(
    (narrow?.y ?? 0) + (narrow?.height ?? 0) - 1,
  );
});
