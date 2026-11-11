import { expect, type Locator, test } from "@playwright/test";
import { buildDistRoot, removeDistRoot } from "../dist-page.ts";
import {
  BOTH_RANGES,
  bandButton,
  bandCount,
  FLOW_RANGE,
  isDimmed,
  MAP_PLAY_DATA,
  MAP_PLAY_SEQUENCE,
  MESSAGE_NOTE,
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

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** 構成図の上で再生するシーケンス図の範囲（印の引数を指定できる） */
function sequenceRange(args?: string, sequence = MAP_PLAY_SEQUENCE): string {
  return mapRange({
    ...(args === undefined ? {} : { args }),
    mermaid: sequence,
    data: MAP_PLAY_DATA,
  });
}

/** シーケンス図のメッセージの線 */
function message(figure: Locator, n: number): Locator {
  return figure.locator(`path.mdmark-diagram-wire[data-message="${n}"]`);
}

// シーケンス図の帯で、メッセージを構成図とシーケンス図の両方で強調しながら進める（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await page.clock.install();
  await openMap(page, builtRoot, { markdown: BOTH_RANGES });
  await pauseClock(page);
  const flow = mapFigure(page, 0);
  const seq = mapFigure(page, 1);
  await expect(seq).toBeVisible();
  const actions = seq.locator(".map-band-actions");
  // 検証: 開いたときから再生の帯がある
  await expect(bandCount(seq)).toHaveText("–/4");
  for (const [name, label] of [
    ["prev", "前のメッセージ"],
    ["stop", "再生をやめる"],
    ["auto", "自動で進める"],
    ["next", "次のメッセージ"],
  ]) {
    await expect(bandButton(seq, name)).toHaveAttribute("aria-label", label);
  }
  await expect(seq.locator(".map-band input, .map-band select")).toHaveCount(0);
  /** 帯の左上からのボタンの位置 */
  const actionsAt = async () => {
    const band = await seq.locator(".map-band").boundingBox();
    const box = await actions.boundingBox();
    return {
      x: (box?.x ?? 0) - (band?.x ?? 0),
      y: (box?.y ?? 0) - (band?.y ?? 0),
    };
  };
  const idle = await actionsAt();
  // 実行: 自動で進める
  await bandButton(seq, "auto").click();
  // 検証: メッセージ 1 を両方の図で強調し、送り手から受け手へ印を流す
  await expect(bandCount(seq)).toHaveText("1/4");
  await expect(seq.locator(".map-band-title")).toHaveText("設定と Markdown");
  expect(await isDimmed(message(seq, 0))).toBe(false);
  expect(await isDimmed(message(seq, 1))).toBe(true);
  expect(await isDimmed(mapNode(seq, "user"))).toBe(false);
  expect(await isDimmed(mapNode(seq, "marker"))).toBe(true);
  expect(await packetOwners(seq)).toEqual(["0"]);
  expect(await isDimmed(mapNode(flow, "user"))).toBe(false);
  expect(await isDimmed(mapNode(flow, "mount"))).toBe(false);
  expect(await isDimmed(mapNode(flow, "index"))).toBe(true);
  expect(await packetOwners(flow)).toEqual(["user->mount"]);
  // 実行・検証: 2 秒ごとに進む
  await page.clock.runFor(2_000);
  await expect(bandCount(seq)).toHaveText("2/4");
  await page.clock.runFor(4_000);
  await expect(bandCount(seq)).toHaveText("4/4");
  // 実行・検証: 最後の次は最初へ戻る
  await page.clock.runFor(2_000);
  await expect(bandCount(seq)).toHaveText("1/4");
  // 実行・検証: 一時停止で止まる
  await bandButton(seq, "auto").click();
  await expect(bandButton(seq, "auto")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.clock.runFor(4_000);
  await expect(bandCount(seq)).toHaveText("1/4");
  // 実行・検証: 次へで 1 通ずつ進み、帯の文はメッセージの文と説明を改行のまま出す
  const before = { flow: await viewState(flow), seq: await viewState(seq) };
  await bandButton(seq, "next").click();
  await expect(bandCount(seq)).toHaveText("2/4");
  await expect(seq.locator(".map-band-title")).toHaveText("map の範囲");
  const text = await seq.locator(".map-band-text").textContent();
  expect(text?.split("\n")).toContain(MESSAGE_NOTE);
  const step = await actionsAt();
  expect(step.x).toBeCloseTo(idle.x, 0);
  expect(step.y).toBeCloseTo(idle.y, 0);
  // 検証: 前へ・次へでは図の倍率・図の枠の中のスクロール・文書のスクロールが変わらない
  for (const [figure, state] of [
    [flow, before.flow],
    [seq, before.seq],
  ] as const) {
    const now = await viewState(figure);
    expect(now.scroll).toEqual(state.scroll);
    expect(now.transform).toBe(state.transform);
    expect(now.page).toEqual(state.page);
  }
  // 実行・検証: 最初の前へで最後へ回る
  await bandButton(seq, "prev").click();
  await bandButton(seq, "prev").click();
  await expect(bandCount(seq)).toHaveText("4/4");
  // 実行・検証: 構成図の案内を始めると、シーケンス図の強調が解ける
  await bandButton(flow, "next").click();
  await expect(bandCount(seq)).toHaveText("–/4");
  await expect(seq.locator(".map-dim")).toHaveCount(0);
  await bandButton(flow, "stop").click();
  // 実行・検証: 停止で強調が消え、再生を始めた段の図に戻る
  await bandButton(seq, "next").click();
  await bandButton(seq, "stop").click();
  await expect(bandCount(seq)).toHaveText("–/4");
  await expect(flow.locator(".map-dim")).toHaveCount(0);
  await expect(seq.locator(".map-dim")).toHaveCount(0);
  await expect(page.locator("#doc .map-packet")).toHaveCount(0);
});

// 動きを減らす設定でも、再生のデータの印を流す（正常シナリオ（動きを減らす設定））
test("test_normal_when_reduced_motion", async ({ page }) => {
  // 準備
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMap(page, builtRoot, { markdown: BOTH_RANGES });
  const flow = mapFigure(page, 0);
  const seq = mapFigure(page, 1);
  await expect(seq).toBeVisible();
  // 実行
  await bandButton(seq, "next").click();
  // 検証
  await expect(bandCount(seq)).toHaveText("1/4");
  await expect(seq.locator(".map-band-title")).toHaveText("設定と Markdown");
  expect(await packetOwners(flow)).toEqual(["user->mount"]);
  expect(await packetOwners(seq)).toEqual(["0"]);
  expect(await isDimmed(mapNode(flow, "user"))).toBe(false);
  expect(await isDimmed(mapNode(flow, "mount"))).toBe(false);
  // 実行・検証: 停止で印が消える
  await bandButton(seq, "stop").click();
  await expect(page.locator("#doc .map-packet")).toHaveCount(0);
});

// 構成図に無い相手のメッセージは、強調せずに文だけを出す（正常シナリオ（構成図に無い相手がある））
test("test_normal_when_missing_participant", async ({ page }) => {
  // 準備
  const sequence = `${MAP_PLAY_SEQUENCE.replace(
    "  user->>mount",
    "  participant ghost as 外部の呼び出し元\n  user->>mount",
  )}  ghost->>mount: 外からの呼び出し\n`;
  await openMap(page, builtRoot, {
    markdown: `${FLOW_RANGE}\n${sequenceRange(undefined, sequence)}`,
  });
  const flow = mapFigure(page, 0);
  const seq = mapFigure(page, 1);
  await expect(seq).toBeVisible();
  // 検証: シーケンス図の上に書き方の警告がある
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("ghost");
  // 実行・検証: ほかのメッセージは強調する
  await bandButton(seq, "next").click();
  expect(await packetOwners(flow)).toEqual(["user->mount"]);
  // 実行・検証: 無い相手のメッセージでは構成図を強調せず、文を出す
  await bandButton(seq, "prev").click();
  await expect(bandCount(seq)).toHaveText("5/5");
  await expect(seq.locator(".map-band-title")).toHaveText("外からの呼び出し");
  await expect(flow.locator(".map-dim")).toHaveCount(0);
  await expect(flow.locator(".map-packet")).toHaveCount(0);
});

/** シーケンス図を 2 画面目より下に置く文書 */
function belowFold(sequence: string): string {
  const filler = Array.from({ length: 80 }, (_, i) => `段落 ${i + 1}`).join(
    "\n\n",
  );
  return `${FLOW_RANGE}\n${filler}\n\n${sequence}`;
}

// 印の play で、シーケンス図が画面に入ったら押さずに再生を始める（正常シナリオ（印の引数で自動で再生する））
test("test_normal_when_autoplay", async ({ page }) => {
  // 準備
  await page.clock.install();
  const markdown = belowFold(sequenceRange('{"play": "autoplay"}'));
  await openMap(page, builtRoot, { markdown });
  await pauseClock(page);
  const seq = mapFigure(page, 1);
  // 検証: 画面に入るまで始まらない
  await page.clock.runFor(3_000);
  await expect(bandCount(seq)).toHaveText("–/4");
  // 実行: 画面に入れる
  await seq.scrollIntoViewIfNeeded();
  // 検証: 押さずに始まる
  await expect(bandCount(seq)).toHaveText("1/4");
  await expect(bandButton(seq, "auto")).toHaveAttribute("aria-pressed", "true");
  // 実行: 動きを減らす設定で開き直す
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMap(page, builtRoot, { markdown });
  await pauseClock(page);
  const reduced = mapFigure(page, 1);
  await reduced.scrollIntoViewIfNeeded();
  await page.clock.runFor(3_000);
  // 検証: 自動で始めず、再生を押すと印が流れる
  await expect(bandCount(reduced)).toHaveText("–/4");
  await bandButton(reduced, "auto").click();
  expect((await packetOwners(reduced)).length).toBeGreaterThan(0);
  // 実行・検証: play を持たない図は、押すまで再生しない
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openMap(page, builtRoot, { markdown: belowFold(sequenceRange()) });
  await pauseClock(page);
  const plain = mapFigure(page, 1);
  await plain.scrollIntoViewIfNeeded();
  await page.clock.runFor(3_000);
  await expect(bandCount(plain)).toHaveText("–/4");
});

// 印の interval の間隔で自動で進め、読めない値は警告にして既定の 2 秒にする（正常シナリオ（印の引数で間隔を指定する））
test("test_normal_when_interval", async ({ page }) => {
  // 準備
  await page.clock.install();
  await openMap(page, builtRoot, {
    markdown: `${FLOW_RANGE}\n${sequenceRange('{"interval": 1}')}\n${sequenceRange('{"interval": "abc"}')}`,
  });
  await pauseClock(page);
  const first = mapFigure(page, 1);
  const second = mapFigure(page, 2);
  await expect(second).toBeVisible();
  // 検証: 読めない値の図の上に警告がある
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("interval");
  // 実行・検証: 1 つ目は 1 秒ごとに進む
  await bandButton(first, "auto").click();
  await expect(bandCount(first)).toHaveText("1/4");
  await page.clock.runFor(1_000);
  await expect(bandCount(first)).toHaveText("2/4");
  await bandButton(first, "stop").click();
  // 実行・検証: 2 つ目は既定の 2 秒ごとに進む
  await bandButton(second, "auto").click();
  await expect(bandCount(second)).toHaveText("1/4");
  await page.clock.runFor(1_000);
  await expect(bandCount(second)).toHaveText("1/4");
  await page.clock.runFor(1_000);
  await expect(bandCount(second)).toHaveText("2/4");
});
