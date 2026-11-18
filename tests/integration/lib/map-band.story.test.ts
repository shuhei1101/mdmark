import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 左右の矢印のボタンの、スクリーンリーダー向けの名前・title・大きさ・位置 */
function arrowButtons(page: Page) {
  return page.locator('.map-band [data-band="step"]').evaluateAll((buttons) =>
    buttons.map((button) => {
      const box = button.getBoundingClientRect();
      return {
        label: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
        width: box.width,
        height: box.height,
        left: box.left,
        top: box.top,
      };
    }),
  );
}

/** 手順のバー（スライダー）の属性 */
function sliderOf(page: Page) {
  return page.locator('.map-band [role="slider"]').evaluate((bar) => ({
    label: bar.getAttribute("aria-label"),
    min: bar.getAttribute("aria-valuemin"),
    max: bar.getAttribute("aria-valuemax"),
    now: bar.getAttribute("aria-valuenow"),
    text: bar.getAttribute("aria-valuetext"),
    tabindex: bar.getAttribute("tabindex"),
  }));
}

/** 区切りの class */
function segmentClasses(page: Page) {
  return page
    .locator(".map-band-seg")
    .evaluateAll((segments) => segments.map((segment) => segment.className));
}

// 始める前は帯の枠線と面が無く、4 つの区切りのバーと左右の矢印だけ。帯は名前を持つ region で、文は aria-live（Idle）
test("test_idle", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--idle");
  // 検証
  const band = page.locator(".map-band");
  await expect(band.getAttribute("role")).resolves.toBe("region");
  await expect(band.getAttribute("aria-label")).resolves.toBe(
    "全体の構成の案内",
  );
  const look = await band.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      border: style.borderTopColor,
      background: style.backgroundColor,
    };
  });
  expect(look.border).toBe("rgba(0, 0, 0, 0)");
  expect(look.background).toBe("rgba(0, 0, 0, 0)");
  await expect(page.locator(".map-band-seg").count()).resolves.toBe(4);
  await expect(page.locator(".map-band-title").isHidden()).resolves.toBe(true);
  await expect(page.locator(".map-band-text").isHidden()).resolves.toBe(true);
  await expect(
    page.locator(".map-band-text").getAttribute("aria-live"),
  ).resolves.toBe("polite");
  await expect(sliderOf(page)).resolves.toEqual({
    label: "手順",
    min: "0",
    max: "4",
    now: "0",
    text: "始める前",
    tabindex: "0",
  });
  const arrows = await arrowButtons(page);
  expect(arrows.map((arrow) => arrow.label)).toEqual(["前の手順", "次の手順"]);
  expect(arrows.map((arrow) => arrow.title)).toEqual(["前の手順", "次の手順"]);
  for (const arrow of arrows) {
    expect(arrow.width).toBeGreaterThanOrEqual(24);
    expect(arrow.height).toBeGreaterThanOrEqual(24);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 2 つ目の手順を繰り返している途中は、帯の枠線と面・タイトル・3 行の文を出し、済み・今・残りの区切りを描き分ける。矢印の位置は始める前と同じ（Step）
test("test_step", async () => {
  // 準備・実行
  const idle = await arrowButtons(
    await holder.openStory("parts-mapband--idle"),
  );
  const page = await holder.openStory("parts-mapband--step");
  // 検証
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "記法を読む",
  );
  await expect(page.locator(".map-band-text").innerText()).resolves.toBe(
    "1 行目\n2 行目\n3 行目",
  );
  const classes = await segmentClasses(page);
  expect(classes[0]).toContain("is-done");
  expect(classes[1]).toContain("is-current");
  expect(classes[1]).toContain("is-playing");
  expect(classes[2]).not.toContain("is-done");
  const fill = await page
    .locator(".map-band-fill")
    .evaluate((element) => element.style.width);
  expect(fill).toBe("50%");
  const segments = await page.locator(".map-band-seg").evaluateAll((items) =>
    items.map((item) => {
      const style = getComputedStyle(item);
      return { background: style.backgroundColor, ring: style.boxShadow };
    }),
  );
  expect(segments[0]?.background).not.toBe(segments[2]?.background);
  expect(segments[1]?.ring).not.toBe("none");
  await expect(sliderOf(page)).resolves.toMatchObject({
    now: "2",
    text: "手順 2/4 手順 2",
  });
  const arrows = await arrowButtons(page);
  arrows.forEach((arrow, index) => {
    expect(arrow.left).toBeCloseTo(idle[index]?.left ?? -1, 0);
    expect(arrow.top).toBeCloseTo(idle[index]?.top ?? -1, 0);
  });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// シーケンス図の再生は、タイトルがメッセージの文で、バーと矢印の名前がメッセージ（Playback）
test("test_playback", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--playback");
  // 検証
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "mount を呼ぶ",
  );
  await expect(page.locator(".map-band-seg").count()).resolves.toBe(9);
  await expect(sliderOf(page)).resolves.toMatchObject({
    label: "メッセージ",
    now: "3",
  });
  const arrows = await arrowButtons(page);
  expect(arrows.map((arrow) => arrow.label)).toEqual([
    "前のメッセージ",
    "次のメッセージ",
  ]);
});

// 状態遷移図の遷移の再生は、タイトルが「{遷移元} → {遷移先}：{ラベル}」で、バーと矢印の名前が遷移（StatePlayback）
test("test_state_playback", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--state-playback");
  // 検証
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "判定 → 差し戻しの理由を確認する：差し戻し",
  );
  await expect(sliderOf(page)).resolves.toMatchObject({
    label: "遷移",
    max: "13",
    now: "6",
  });
  const arrows = await arrowButtons(page);
  expect(arrows.map((arrow) => arrow.label)).toEqual(["前の遷移", "次の遷移"]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// Git グラフの commit の再生は、タイトルが「{ブランチ名} · {commit のキー}」で、バーと矢印の名前が commit（CommitPlayback）
test("test_commit_playback", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--commit-playback");
  // 検証
  await expect(page.locator(".map-band-title").innerText()).resolves.toBe(
    "develop · c6",
  );
  const arrows = await arrowButtons(page);
  expect(arrows.map((arrow) => arrow.label)).toEqual([
    "前の commit",
    "次の commit",
  ]);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 手順 40 の幅 390px では、40 の区切りが折り返さずに 1 行に並び、左右の矢印が残る（Dense）
test("test_dense", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--dense", {
    width: 390,
    height: 360,
  });
  // 検証
  const tops = await page
    .locator(".map-band-seg")
    .evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
  expect(tops).toHaveLength(40);
  expect(new Set(tops.filter((_, index) => index !== 19)).size).toBe(1);
  await expect(arrowButtons(page)).resolves.toHaveLength(2);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 幅 390px では、長いタイトルを折り返し、バーと矢印は 1 行のまま（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-mapband--narrow", {
    width: 390,
    height: 360,
  });
  // 検証
  const title = await page.locator(".map-band-title").boundingBox();
  const bar = await page.locator(".map-band-bar").boundingBox();
  expect(title?.y ?? 0).toBeGreaterThanOrEqual(
    (bar?.y ?? 0) + (bar?.height ?? 0) - 1,
  );
  expect(bar?.height ?? 0).toBeLessThanOrEqual(26);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
