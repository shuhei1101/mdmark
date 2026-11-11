import { expect, type Locator, type Page, test } from "@playwright/test";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";
import {
  centerOf,
  isDimmed,
  isSelected,
  MAP_PLAY_SEQUENCE,
  MESSAGE_NOTE,
  mapFigure,
  mapNode,
  mapRange,
  mapTool,
  openMap,
  packetOwners,
  pointOnPath,
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

/** 参加者 5 人・メッセージ 4 つのシーケンス図（2 つ目のメッセージに説明を持つ） */
const MARKDOWN = mapRange({
  args: '{"title": "描くまでの流れ"}',
  mermaid: MAP_PLAY_SEQUENCE,
  data: JSON.stringify({ version: 1, notes: { "2": { text: MESSAGE_NOTE } } }),
});

/** メッセージの線 */
const message = (figure: Locator, n: number) =>
  figure.locator(`path.mdmark-diagram-wire[data-message="${n}"]`);

/** メッセージの線ごとの、薄くしたか */
async function messageDims(figure: Locator): Promise<boolean[]> {
  return Promise.all([0, 1, 2, 3].map((n) => isDimmed(message(figure, n))));
}

/** メッセージの線の押せる帯の真ん中を押す */
async function clickMessage(page: Page, figure: Locator, n: number) {
  const [x, y] = await pointOnPath(
    figure.locator(`.map-wire-hit[data-message="${n}"]`),
  );
  await page.mouse.click(x, y);
}

/** 参加者の並び（左から） */
function order(figure: Locator): Promise<string[]> {
  return figure.locator(".map-participant").evaluateAll((heads) =>
    heads
      .map((head) => ({
        id: head.getAttribute("data-participant") ?? "",
        x: head.getBoundingClientRect().x,
      }))
      .sort((a, b) => a.x - b.x)
      .map((head) => head.id),
  );
}

// 参加者を選ぶと、その参加者のメッセージとライフラインのほかを薄くし、線を押すと送り手と受け手を選ぶ（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: MARKDOWN });
  const figure = mapFigure(page);
  /** 参加者の箱の、名前の文字の外の余白（左上）を押す */
  const press = (id: string) =>
    mapNode(figure, id).click({ position: { x: 6, y: 6 } });
  // 実行: 3 人目の参加者の箱（名前の文字の外の余白）を押す
  await press("marker");
  // 検証
  expect(await isSelected(mapNode(figure, "marker"))).toBe(true);
  expect(await messageDims(figure)).toEqual([true, false, false, true]);
  expect(
    await isDimmed(
      figure.locator('.mdmark-diagram-lifeline[data-lifeline="marker"]'),
    ),
  ).toBe(false);
  expect(
    await isDimmed(
      figure.locator('.mdmark-diagram-lifeline[data-lifeline="user"]'),
    ),
  ).toBe(true);
  expect(await isDimmed(mapNode(figure, "user"))).toBe(true);
  expect((await packetOwners(figure)).sort()).toEqual(["1", "2"]);
  // 実行・検証: 4 人目も選ぶと、2 人のあいだのメッセージだけを強調する
  await press("mermaid");
  expect(await messageDims(figure)).toEqual([true, true, false, true]);
  // 実行・検証: Esc で解ける
  await figure.locator(".mdmark-diagram-viewport").focus();
  await page.keyboard.press("Escape");
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await expect(figure.locator(".map-dim")).toHaveCount(0);
  // 実行・検証: メッセージの線を押すと送り手と受け手を選び、もう一度押すと解ける。片方だけのときは両方を選ぶ
  await clickMessage(page, figure, 1);
  expect(await isSelected(mapNode(figure, "mount"))).toBe(true);
  expect(await isSelected(mapNode(figure, "marker"))).toBe(true);
  await clickMessage(page, figure, 1);
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await press("mount");
  await clickMessage(page, figure, 1);
  expect(await isSelected(mapNode(figure, "marker"))).toBe(true);
  await figure.locator(".mdmark-diagram-viewport").focus();
  await page.keyboard.press("Escape");
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  // 実行・検証: キーボードで選べ、選んでいるかをスクリーンリーダー向けに持つ
  await mapNode(figure, "layout").focus();
  await page.keyboard.press("Enter");
  expect(await isSelected(mapNode(figure, "layout"))).toBe(true);
  await expect(mapNode(figure, "layout")).toHaveAttribute(
    "aria-label",
    "自動配置（選択中）",
  );
  // 実行・検証: 選んだ箱をもう一度押すと解ける
  await press("layout");
  expect(await isSelected(mapNode(figure, "layout"))).toBe(false);
  await expect(mapNode(figure, "layout")).toHaveAttribute(
    "aria-label",
    "自動配置",
  );
  // 検証: 名前の文字の上は選ばず、文字を選べる
  await mapNode(figure, "user").locator(".mdmark-diagram-node-name").click();
  expect(await isSelected(mapNode(figure, "user"))).toBe(false);
  expect(
    await mapNode(figure, "user")
      .locator(".mdmark-diagram-node-name")
      .evaluate((name) => getComputedStyle(name).userSelect),
  ).not.toBe("none");
  // 実行・検証: 説明を持つメッセージの線にポインターを当てると、ほかを薄くして説明を出す
  const [x, y] = await pointOnPath(
    figure.locator('.map-wire-hit[data-message="1"]'),
  );
  await page.mouse.move(x, y);
  await expect.poll(() => packetOwners(figure)).toEqual(["1"]);
  expect(await isDimmed(mapNode(figure, "mount"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "marker"))).toBe(false);
  expect(await isDimmed(mapNode(figure, "user"))).toBe(true);
  expect(await isDimmed(message(figure, 0))).toBe(true);
  await expect(
    page.locator('[role="tooltip"]', { hasText: MESSAGE_NOTE }),
  ).toBeVisible();
  await page.mouse.move(5, 5);
  await expect(figure.locator(".map-packet")).toHaveCount(0);
});

// 参加者の箱をドラッグか Alt + 左右の矢印で並べ替え、元に戻す（正常シナリオ（参加者の並び順を変える））
test("test_normal_when_participants_reordered", async ({ page }) => {
  // 準備
  await openMap(page, builtRoot, { markdown: MARKDOWN });
  const figure = mapFigure(page);
  const reset = mapTool(figure, "reset");
  await expect(reset).toBeDisabled();
  expect(await order(figure)).toEqual([
    "user",
    "mount",
    "marker",
    "mermaid",
    "layout",
  ]);
  const state = await viewState(figure);
  // 検証: 並べ替えのつまみは無く、種類の行の文字は選べず、指で動かしてもページをスクロールしない
  await expect(
    figure.locator(".map-participant [aria-label*='並べ替え']"),
  ).toHaveCount(0);
  const styles = await mapNode(figure, "layout").evaluate((head) => ({
    // 横の指の動きでページを動かさない（図の表示する枠は縦の動きだけをページに渡す）
    touch: getComputedStyle(head.closest(".mdmark-diagram-viewport") ?? head)
      .touchAction,
    kind: getComputedStyle(
      head.querySelector(".mdmark-diagram-node-kind") ?? head,
    ).userSelect,
  }));
  expect(["none", "pan-y"]).toContain(styles.touch);
  expect(styles.kind).toBe("none");
  // 実行: 5 人目の箱を、名前の文字の外を押したまま 2 人目の位置へ動かして離す
  const layoutBox = await mapNode(figure, "layout").boundingBox();
  const from: [number, number] = [
    (layoutBox?.x ?? 0) + 6,
    (layoutBox?.y ?? 0) + 6,
  ];
  const [toX] = await centerOf(mapNode(figure, "mount"));
  await page.mouse.move(from[0], from[1]);
  await page.mouse.down();
  await page.mouse.move(from[0] - 2, from[1], { steps: 2 });
  await page.mouse.move(toX, from[1], { steps: 8 });
  await page.mouse.up();
  // 検証: 2 人目の位置へ移り、離した直後の押した扱いで選ばない
  await expect
    .poll(() => order(figure))
    .toEqual(["user", "layout", "mount", "marker", "mermaid"]);
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await expect(reset).toBeEnabled();
  // 検証: 描き直しても、図の倍率と図の枠の中のスクロール・文書のスクロールが変わらない
  const after = await viewState(figure);
  expect(after.transform).toBe(state.transform);
  expect(after.scroll).toEqual(state.scroll);
  expect(after.page).toEqual(state.page);
  // 実行・検証: 指で動かしても並べ替える
  const userBox = await mapNode(figure, "user").boundingBox();
  const finger: [number, number] = [
    (userBox?.x ?? 0) + 6,
    (userBox?.y ?? 0) + 6,
  ];
  const [fingerTo] = await centerOf(mapNode(figure, "layout"));
  await mapNode(figure, "user").evaluate(
    (head, { start, end }) => {
      const base = {
        bubbles: true,
        pointerId: 7,
        pointerType: "touch",
        isPrimary: true,
        button: 0,
      };
      head.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...base,
          clientX: start[0],
          clientY: start[1],
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          ...base,
          clientX: end,
          clientY: start[1],
        }),
      );
      window.dispatchEvent(
        new PointerEvent("pointerup", {
          ...base,
          clientX: end,
          clientY: start[1],
        }),
      );
    },
    { start: finger, end: fingerTo },
  );
  await expect
    .poll(() => order(figure))
    .toEqual(["layout", "user", "mount", "marker", "mermaid"]);
  expect((await viewState(figure)).page).toEqual(state.page);
  // 実行・検証: Alt + 右の矢印で 1 列ずつ動く
  await mapNode(figure, "layout").focus();
  await page.keyboard.press("Alt+ArrowRight");
  await expect
    .poll(() => order(figure))
    .toEqual(["user", "layout", "mount", "marker", "mermaid"]);
  // 実行・検証: 「参加者の並び順と選択を元に戻す」で記載の順に戻り、選択が解ける
  await mapNode(figure, "marker").click({ position: { x: 6, y: 6 } });
  await reset.click();
  expect(await order(figure)).toEqual([
    "user",
    "mount",
    "marker",
    "mermaid",
    "layout",
  ]);
  await expect(figure.locator("[data-selected]")).toHaveCount(0);
  await expect(reset).toBeDisabled();
});
