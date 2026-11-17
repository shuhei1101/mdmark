import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

// 図を開く画面の大きさ（図の全体を表示する）
const WIDE = { width: 1920, height: 1000 };

/** ストーリーを開く */
function openStory(id: string, viewport = WIDE): Promise<Page> {
  return holder.openStory(`parts-mapaxisgrid--${id}`, viewport);
}

type Box = { left: number; top: number; right: number; bottom: number };

/** 辺が接するだけは重ならない扱いで、2 つの矩形が重なるか */
const overlaps = (a: Box, b: Box) =>
  a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 &&
  b.top < a.bottom - 0.5;

/** 描いた項目の data-node・形状・矩形・薄くしたか・中の文字 */
function itemsOf(page: Page) {
  return page.locator(".map-axis-item").evaluateAll((elements) =>
    elements.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        id: element.getAttribute("data-node") ?? "",
        shape: element.getAttribute("data-shape") ?? "",
        dim: element.classList.contains("map-dim"),
        text: element.textContent ?? "",
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
      };
    }),
  );
}

/** data-node の項目 */
async function itemOf(page: Page, id: string) {
  const item = (await itemsOf(page)).find((entry) => entry.id === id);
  if (!item) throw new Error(`項目 ${id} が無い`);
  return item;
}

/** 薄くしていない項目の data-node（並べ替えた） */
async function keptOf(page: Page): Promise<string[]> {
  return (await itemsOf(page))
    .filter((item) => !item.dim)
    .map((item) => item.id)
    .sort();
}

/** 項目が互いに重ならないことを確かめる */
async function expectNoOverlap(page: Page) {
  const items = (await itemsOf(page)).filter((item) => item.shape !== "space");
  for (const [i, a] of items.entries())
    for (const b of items.slice(i + 1))
      expect(overlaps(a, b), `${a.id} と ${b.id}`).toBe(false);
}

// section 4 つ・タスク 8 つのガントチャートで、今日の線と説明のマーカーを描く（Gantt）
test("test_gantt", async () => {
  // 準備・実行
  const page = await openStory("gantt");
  // 検証
  const items = await itemsOf(page);
  expect(items).toHaveLength(8);
  await expect(page.locator(".map-axis-frame").count()).resolves.toBe(4);
  await expect(page.locator(".map-axis-today").count()).resolves.toBe(1);
  await expect(
    page.locator(".map-axis-item .mdmark-diagram-info").count(),
  ).resolves.toBe(2);
  const req = await itemOf(page, "req");
  const des = await itemOf(page, "des");
  expect(Math.abs(des.left - req.right)).toBeLessThan(1);
  await expectNoOverlap(page);
});

// 期間 6 つ・出来事 9 つのタイムラインで、section の枠を 2 つ描く（Timeline）
test("test_timeline", async () => {
  // 準備・実行
  const page = await openStory("timeline");
  // 検証
  const items = await itemsOf(page);
  expect(items.filter((item) => item.shape === "period")).toHaveLength(6);
  expect(items.filter((item) => item.shape === "event")).toHaveLength(9);
  await expect(page.locator(".map-axis-frame").count()).resolves.toBe(2);
  await expectNoOverlap(page);
});

// ブランチ 3 つ・commit 10 個の Git グラフで、6 個目の commit の下に文字が無い（GitGraph）
test("test_git_graph", async () => {
  // 準備・実行
  const page = await openStory("git-graph");
  // 検証
  expect(await itemsOf(page)).toHaveLength(10);
  await expect(page.locator("button[data-map-branch]").count()).resolves.toBe(
    3,
  );
  const captions = await page
    .locator(".map-axis-caption")
    .evaluateAll((elements) => elements.map((element) => element.textContent));
  expect(captions).not.toContain("c6");
  expect(captions).toContain("map");
  await expectNoOverlap(page);
});

// section 3 つ・タスク 7 つのジャーニーで、図の下に人の凡例がある（Journey）
test("test_journey", async () => {
  // 準備・実行
  const page = await openStory("journey");
  // 検証
  const items = await itemsOf(page);
  expect(items).toHaveLength(7);
  const open = await itemOf(page, "文書を開く");
  const fix = await itemOf(page, "ずれを直す");
  expect(open.top).toBeLessThan(fix.top);
  await expect(page.locator("button[data-map-actor]").count()).resolves.toBe(3);
  await expectNoOverlap(page);
});

// columns 3 の格子のブロック図で、入れ子 core の枠と 3 本の線を描く（Block）
test("test_block", async () => {
  // 準備・実行
  const page = await openStory("block");
  // 検証
  expect(await itemsOf(page)).toHaveLength(7);
  await expect(
    page.locator('.map-axis-frame[data-section="core"]').count(),
  ).resolves.toBe(1);
  await expect(page.locator('path[data-wire="arrow"]').count()).resolves.toBe(
    3,
  );
  const pageItem = await itemOf(page, "page");
  const cdn = await itemOf(page, "cdn");
  expect(pageItem.right - pageItem.left).toBeGreaterThan(
    (cdn.right - cdn.left) * 2,
  );
  await expectNoOverlap(page);
});

// 開発を閉じると 1 本の棒になり、日付の軸は変わらない（GanttCollapsed）
test("test_gantt_collapsed", async () => {
  // 準備・実行
  const open = await openStory("gantt");
  const ticks = await open.locator(".map-axis-tick").count();
  const page = await openStory("gantt-collapsed");
  // 検証
  const dev = await itemOf(page, "開発");
  expect(dev.shape).toBe("collapsed");
  expect(dev.text.replace(/\s+/g, "")).toContain("開発（タスク2件）");
  await expect(page.locator(".map-axis-tick").count()).resolves.toBe(ticks);
  await expect(
    page
      .locator('[data-map-section-toggle="開発"]')
      .getAttribute("aria-expanded"),
  ).resolves.toBe("false");
});

// 記法を作るを閉じると期間 1 つ分の幅になり、後ろの期間が詰まる（TimelineCollapsed）
test("test_timeline_collapsed", async () => {
  // 準備・実行
  const open = await openStory("timeline");
  const before = (await itemOf(open, "2026-08")).left;
  const page = await openStory("timeline-collapsed");
  // 検証
  const closed = await itemOf(page, "記法を作る");
  expect(closed.text).toContain("（期間 2 件）");
  expect((await itemOf(page, "2026-08")).left).toBeLessThan(before);
  await expectNoOverlap(page);
});

// 点検するを閉じると、点数の平均の高さの破線のマーカー 1 つになる（JourneyCollapsed）
test("test_journey_collapsed", async () => {
  // 準備・実行
  const page = await openStory("journey-collapsed");
  // 検証
  const closed = await itemOf(page, "点検する");
  const two = await itemOf(page, "記法を調べる");
  expect(closed.shape).toBe("collapsed");
  expect(Math.abs(closed.top - two.top)).toBeLessThan(1);
  const style = await page
    .locator('.map-axis-item[data-node="点検する"]')
    .evaluate((element) => getComputedStyle(element).borderTopStyle);
  expect(style).toBe("dashed");
});

// core を閉じると、記載した幅のまま 1 行の高さになり、ほかのブロックの列は変わらない（BlockCollapsed）
test("test_block_collapsed", async () => {
  // 準備・実行
  const open = await openStory("block");
  const doc = (await itemOf(open, "doc")).left;
  const page = await openStory("block-collapsed");
  // 検証
  const core = await itemOf(page, "core");
  expect(core.text.replace(/\s+/g, "")).toContain("core（ブロック2件）");
  const mdmark = await itemOf(page, "mdmark");
  expect(
    Math.abs(core.bottom - core.top - (mdmark.bottom - mdmark.top)),
  ).toBeLessThan(1);
  expect((await itemOf(page, "doc")).left).toBe(doc);
});

// 2 つ目の準備の中へ入ると、その section の 2 つのタスクと道筋を描き、日付の軸が縮む（GanttEntered）
test("test_gantt_entered", async () => {
  // 準備・実行
  const page = await openStory("gantt-entered");
  // 検証
  expect((await itemsOf(page)).map((item) => item.id).sort()).toEqual(
    ["env", "手順書を書く"].sort(),
  );
  await expect(
    page.locator(".map-axis-trail").getAttribute("aria-label"),
  ).resolves.toBe("全体からの道筋");
  const trail = await page.locator(".map-axis-trail").innerText();
  expect(trail.replace(/\s+/g, " ")).toContain("全体 › 準備");
  await expect(
    page.locator(".map-axis-tick").first().innerText(),
  ).resolves.toBe("9");
});

// core の中へ入ると、読み取りと配置だけを columns 2 の格子で描く（BlockEntered）
test("test_block_entered", async () => {
  // 準備・実行
  const page = await openStory("block-entered");
  // 検証
  const items = await itemsOf(page);
  expect(items.map((item) => item.id).sort()).toEqual(["layout", "parse"]);
  expect(Math.abs((items[0]?.top ?? 0) - (items[1]?.top ?? 1))).toBeLessThan(1);
  const trail = await page.locator(".map-axis-trail").innerText();
  expect(trail.replace(/\s+/g, " ")).toContain("全体 › core");
});

// 設計するを選ぶと、after の前後のタスクとつながりの線のほかが薄い（GanttSelected）
test("test_gantt_selected", async () => {
  // 準備・実行
  const page = await openStory("gantt-selected");
  // 検証
  expect(await keptOf(page)).toEqual(["des", "imp", "req"]);
  await expect(page.locator('path[data-wire="after"]').count()).resolves.toBe(
    2,
  );
  await expect(
    page
      .locator('.map-axis-item[data-node="des"] .mdmark-diagram-node-hit')
      .getAttribute("aria-label"),
  ).resolves.toBe("設計する（選択中）");
});

// feat を選ぶと、feat の commit のほかが薄く、ブランチ名のボタンが押した状態（GitBranchSelected）
test("test_git_branch_selected", async () => {
  // 準備・実行
  const page = await openStory("git-branch-selected");
  // 検証
  expect(await keptOf(page)).toHaveLength(2);
  expect(await keptOf(page)).toContain("axis");
  await expect(
    page.locator('button[data-map-branch="feat"]').getAttribute("aria-pressed"),
  ).resolves.toBe("true");
});

// AI を選ぶと、AI のタスクのほかが薄く、AI のタスクだけが線でつながる（JourneyActorSelected）
test("test_journey_actor_selected", async () => {
  // 準備・実行
  const page = await openStory("journey-actor-selected");
  // 検証
  expect(await keptOf(page)).toEqual(
    ["mdmark check を流す", "図を書く", "図を辿る"].sort(),
  );
  await expect(page.locator('path[data-lane="actor"]').count()).resolves.toBe(
    1,
  );
  await expect(
    page.locator('button[data-map-actor="AI"]').getAttribute("aria-pressed"),
  ).resolves.toBe("true");
});

// 再生の手順 6 では、6 個目の commit のほかが薄い（Played）
test("test_played", async () => {
  // 準備・実行
  const page = await openStory("played");
  // 検証
  expect(await keptOf(page)).toEqual(["c6"]);
});

// 補足の layout で、リリース判定が purple で、公開が閉じて描かれる（Colored）
test("test_colored", async () => {
  // 準備・実行
  const page = await openStory("colored");
  // 検証
  const closed = await itemOf(page, "公開");
  expect(closed.shape).toBe("collapsed");
  expect((await itemsOf(page)).map((item) => item.id)).not.toContain("rel");
});

// ヒントをオフにすると、説明のマーカーが無い（HintsOff）
test("test_hints_off", async () => {
  // 準備・実行
  const page = await openStory("hints-off");
  // 検証
  await expect(page.locator(".mdmark-diagram-info").count()).resolves.toBe(0);
});

// 幅 390px の置き場所では、等倍のまま図の枠の中を横にスクロールでき、ページははみ出さない（Narrow）
test("test_narrow", async () => {
  // 準備・実行
  const page = await openStory("narrow", { width: 390, height: 844 });
  // 検証
  const scroll = await page
    .locator(".mdmark-diagram-viewport")
    .evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(scroll).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
