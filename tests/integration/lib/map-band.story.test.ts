import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 帯の 4 つのボタンの、スクリーンリーダー向けの名前・title・押せるか・押したか・位置 */
function bandButtons(page: Page) {
  return page.locator(".map-band-actions button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return {
        label: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
        disabled: (button as HTMLButtonElement).disabled,
        pressed: button.getAttribute("aria-pressed"),
        left: box.left,
        top: box.top,
      };
    }),
  );
}

// 始める前は番号が –/4 で、停止は押せず、タイトルと文の行が無い。帯は名前を持つ region で、文は aria-live（Idle）
test("test_idle", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--idle");
  // 検証
  const band = page.locator(".map-band");
  await expect(band.getAttribute("role")).resolves.toBe("region");
  await expect(band.getAttribute("aria-label")).resolves.toBe(
    "全体の構成の案内",
  );
  await expect(page.locator(".map-band-count").innerText()).resolves.toBe(
    "–/4",
  );
  await expect(page.locator(".map-band-title").isHidden()).resolves.toBe(true);
  await expect(page.locator(".map-band-text").isHidden()).resolves.toBe(true);
  await expect(
    page.locator(".map-band-text").getAttribute("aria-live"),
  ).resolves.toBe("polite");
  const buttons = await bandButtons(page);
  expect(buttons.map((button) => button.label)).toEqual([
    "前の手順",
    "案内をやめる",
    "自動で進める",
    "次の手順",
  ]);
  expect(buttons.map((button) => button.title)).toEqual(
    buttons.map((button) => button.label),
  );
  expect(buttons.map((button) => button.disabled)).toEqual([
    false,
    true,
    false,
    false,
  ]);
  const numerals = await page
    .locator(".map-band-count")
    .evaluate((count) => getComputedStyle(count).fontVariantNumeric);
  expect(numerals).toBe("tabular-nums");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 2 つ目の手順は番号 2/4・タイトル・3 行の文を出し、ボタンの位置は始める前と同じ（Step）
test("test_step", async () => {
  // 準備・実行
  const idle = await bandButtons(await holder.openStory("parts-mapband--idle"));
  const page = await holder.openStory("parts-mapband--step");
  // 検証
  await expect(page.locator(".map-band-count").innerText()).resolves.toBe(
    "2/4",
  );
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "記法を読む",
  );
  await expect(page.locator(".map-band-text").innerText()).resolves.toBe(
    "1 行目\n2 行目\n3 行目",
  );
  const buttons = await bandButtons(page);
  expect(buttons.map((button) => button.disabled)).toEqual([
    false,
    false,
    false,
    false,
  ]);
  buttons.forEach((button, index) => {
    expect(button.left).toBeCloseTo(idle[index]?.left ?? -1, 0);
    expect(button.top).toBeCloseTo(idle[index]?.top ?? -1, 0);
  });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 自動で進めている間は、自動で進めるのボタンが一時停止の名前になり aria-pressed が true（Auto）
test("test_auto", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--auto");
  // 検証
  const auto = (await bandButtons(page))[2];
  expect(auto).toMatchObject({
    label: "一時停止",
    title: "一時停止",
    pressed: "true",
  });
});

// シーケンス図の再生は、タイトルがメッセージの文で、ボタンの名前が前のメッセージ・再生をやめる・次のメッセージ（Playback）
test("test_playback", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--playback");
  // 検証
  await expect(page.locator(".map-band-count").innerText()).resolves.toBe(
    "3/9",
  );
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "mount を呼ぶ",
  );
  const buttons = await bandButtons(page);
  expect(buttons.map((button) => button.label)).toEqual([
    "前のメッセージ",
    "再生をやめる",
    "自動で進める",
    "次のメッセージ",
  ]);
});

// 状態遷移図の遷移の再生は、タイトルが「{遷移元} → {遷移先}：{ラベル}」で、ボタンの名前が前の遷移・再生をやめる・次の遷移（StatePlayback）
test("test_state_playback", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--state-playback");
  // 検証
  await expect(page.locator(".map-band-count").innerText()).resolves.toBe(
    "6/13",
  );
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "判定 → 差し戻しの理由を確認する：差し戻し",
  );
  const buttons = await bandButtons(page);
  expect(buttons.map((button) => button.label)).toEqual([
    "前の遷移",
    "再生をやめる",
    "自動で進める",
    "次の遷移",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 幅 390px では、タイトルを番号とボタンの下の行に回す（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--narrow", {
    width: 390,
    height: 360,
  });
  // 検証
  const title = await page.locator(".map-band-title").boundingBox();
  const actions = await page.locator(".map-band-actions").boundingBox();
  expect(title?.y ?? 0).toBeGreaterThanOrEqual(
    (actions?.y ?? 0) + (actions?.height ?? 0) - 1,
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});
