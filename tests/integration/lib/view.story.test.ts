import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** ビューのストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-view--${id}`);
}

/** ボードの列の見出しの値を、並びの順に返す */
function columnNames(page: Page): Promise<string[]> {
  return page
    .locator(".mdmark-view-column-name")
    .allInnerTexts()
    .then((names) => names.map((name) => name.trim()));
}

/** ボードの列の見出しの項目の数を、並びの順に返す */
function columnCounts(page: Page): Promise<string[]> {
  return page.locator(".mdmark-view-column-count").allInnerTexts();
}

/** 表形式の本文の行のうち、隠れていない行の数 */
function visibleRows(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#storybook-root .mdmark-view-table tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
        ),
      ].filter((row) => !row.hidden).length,
  );
}

/** 切り替えのボタンの `aria-pressed` を返す */
function pressed(page: Page, mode: "board" | "table"): Promise<string | null> {
  return page
    .locator(`.mdmark-view-switch-item[data-mode="${mode}"]`)
    .getAttribute("aria-pressed");
}

/** ボードと表形式のうち、隠れているほうを返す */
function hiddenView(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#storybook-root .mdmark-view-board, #storybook-root .mdmark-view-table",
      ),
    ]
      .filter((view) => view.hidden)
      .map((view) => view.className),
  );
}

/** ボードの列の見出しのアイコンの形を、並びの順に返す */
function columnIcons(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll(".mdmark-view-column-head svg")].map(
      (icon) => icon.innerHTML,
    ),
  );
}

// 状態の列の値ごとの列に、題と残りの列を並べたボードで開く（Board）
test("test_board", async () => {
  // 準備・実行
  const page = await open("board");
  // 検証
  await expect(pressed(page, "board")).resolves.toBe("true");
  await expect(pressed(page, "table")).resolves.toBe("false");
  await expect(hiddenView(page)).resolves.toEqual(["mdmark-view-table"]);
  await expect(columnNames(page)).resolves.toEqual([
    "進行中",
    "未着手",
    "完了",
  ]);
  await expect(columnCounts(page)).resolves.toEqual(["2", "2", "1"]);
  await expect(
    page.locator(".mdmark-view-card-title").first().innerText(),
  ).resolves.toBe("ビューを描く");
  await expect(
    page.locator(".mdmark-view-board").getAttribute("tabindex"),
  ).resolves.toBe("0");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 表形式で開き、担当の列にだけ絞り込みのボタンを出す（Table）
test("test_table", async () => {
  // 準備・実行
  const page = await open("table");
  // 検証
  await expect(pressed(page, "table")).resolves.toBe("true");
  await expect(hiddenView(page)).resolves.toEqual(["mdmark-view-board"]);
  await expect(visibleRows(page)).resolves.toBe(5);
  const buttons = page.locator("th button.mdmark-filter");
  await expect(buttons.count()).resolves.toBe(1);
  await expect(
    buttons.first().evaluate((button) => button.closest("th")?.cellIndex),
  ).resolves.toBe(2);
});

// 表形式で担当を `佐藤` に絞り込む（TableFilteredSelect）
test("test_table_filtered_select", async () => {
  // 準備・実行
  const page = await open("table-filtered-select");
  // 検証
  await expect(visibleRows(page)).resolves.toBe(2);
  await expect(
    page.locator("th button.mdmark-filter").getAttribute("class"),
  ).resolves.toContain("is-active");
});

// 絞り込んだままボードに切り替えても、ボードは全ての項目を出す（BoardAfterFilter）
test("test_board_after_filter", async () => {
  // 準備・実行
  const page = await open("board-after-filter");
  // 検証
  await expect(pressed(page, "board")).resolves.toBe("true");
  await expect(page.locator(".mdmark-view-card").count()).resolves.toBe(5);
  await expect(columnCounts(page)).resolves.toEqual(["2", "2", "1"]);
  await expect(
    page
      .locator(".mdmark-view-table")
      .evaluate((view) => (view as HTMLElement).hidden),
  ).resolves.toBe(true);
});

// 題を文字 `表` で絞り込み、ドロワーを開く（TableFilteredText）
test("test_table_filtered_text", async () => {
  // 準備・実行
  const page = await open("table-filtered-text");
  // 検証
  await expect(visibleRows(page)).resolves.toBe(1);
  const button = page.locator("th button.mdmark-filter");
  await expect(button.getAttribute("aria-expanded")).resolves.toBe("true");
  await expect(
    page.locator(".mdmark-filter-drawer input[type='text']").inputValue(),
  ).resolves.toBe("表");
});

// 題を文字 `山田` で絞り込み、一致する行が無い（TableNoMatch）
test("test_table_no_match", async () => {
  // 準備・実行
  const page = await open("table-no-match");
  // 検証
  await expect(visibleRows(page)).resolves.toBe(0);
  await expect(page.locator(".mdmark-table-empty").isVisible()).resolves.toBe(
    true,
  );
});

// 既定のアイコンの 5 つの値の列を、値ごとに別のアイコンで出す（DefaultIcons）
test("test_default_icons", async () => {
  // 準備・実行
  const page = await open("default-icons");
  // 検証
  await expect(columnNames(page)).resolves.toEqual([
    "未着手",
    "進行中",
    "保留",
    "完了",
    "中止",
  ]);
  const icons = await columnIcons(page);
  expect(icons).toHaveLength(5);
  expect(new Set(icons).size).toBe(5);
  await expect(
    page
      .locator(".mdmark-view-column-head svg")
      .first()
      .getAttribute("aria-hidden"),
  ).resolves.toBe("true");
});

// icons= でアイコンを上書きすると、上書きした値の列だけアイコンが替わる（OverriddenIcons）
test("test_overridden_icons", async () => {
  // 準備・実行
  const page = await open("overridden-icons");
  const overridden = await columnIcons(page);
  const defaults = await (async () => {
    const reference = await open("board");
    return columnIcons(reference);
  })();
  // 検証
  await expect(columnNames(page)).resolves.toEqual([
    "進行中",
    "未着手",
    "完了",
  ]);
  expect(overridden[0]).toBe(defaults[0]);
  expect(overridden[1]).not.toBe(defaults[1]);
  expect(overridden[2]).not.toBe(defaults[2]);
});

// 列が多いときは、ボードの中で横にスクロールする。既定の対応に無い値は circle（ManyColumns）
test("test_many_columns", async () => {
  // 準備・実行
  const page = await open("many-columns");
  // 検証
  await expect(page.locator(".mdmark-view-column").count()).resolves.toBe(7);
  await expect(
    page
      .locator(".mdmark-view-board")
      .evaluate((board) => board.scrollWidth > board.clientWidth),
  ).resolves.toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
  const icons = await columnIcons(page);
  expect(new Set(icons).size).toBe(1);
});

// 長い題は折り返し、空の値は項目に出さない（LongTitleEmptyValue）
test("test_long_title_empty_value", async () => {
  // 準備・実行
  const page = await open("long-title-empty-value");
  // 検証
  await expect(pageOverflows(page)).resolves.toBe(false);
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll(".mdmark-view-card")].map((card) =>
      [...card.querySelectorAll("dt")].map((name) => name.textContent),
    ),
  );
  expect(fields).toEqual([["担当"], ["期限"]]);
});

// group= の列が表に無いときは、ボードのボタンを押せなくして表形式を出す（BoardDisabled）
test("test_board_disabled", async () => {
  // 準備・実行
  const page = await open("board-disabled");
  // 検証
  const board = page.locator('.mdmark-view-switch-item[data-mode="board"]');
  await expect(board.isDisabled()).resolves.toBe(true);
  await expect(board.getAttribute("aria-describedby")).resolves.toBe(
    "story-warning",
  );
  await expect(pressed(page, "table")).resolves.toBe("true");
  await expect(visibleRows(page)).resolves.toBe(2);
});

// group が無いときは、切り替えを置かずに表形式だけを出す（TableOnly）
test("test_table_only", async () => {
  // 準備・実行
  const page = await open("table-only");
  // 検証
  await expect(page.locator(".mdmark-view-switch").count()).resolves.toBe(0);
  await expect(page.locator(".mdmark-view-board").count()).resolves.toBe(0);
  await expect(visibleRows(page)).resolves.toBe(2);
});
