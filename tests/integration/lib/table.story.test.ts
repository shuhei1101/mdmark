import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  contrastRatio,
  countColorPixels,
  createBrowserHolder,
  pageOverflows,
  resolveColor,
  resolveColorIn,
  resolveLightColor,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 表のストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-table--${id}`);
}

/** 表の本文の行の指定した列の文字を、上から並べて返却する（隠れた行も含む） */
function columnTexts(page: Page, column: number): Promise<string[]> {
  return page.evaluate((index) => {
    return [
      ...document.querySelectorAll(
        "#storybook-root tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
      ),
    ].map((row) => row.querySelectorAll("td")[index]?.textContent ?? "");
  }, column);
}

/** 表の本文の最初の行のうち、`position` の計算値が `sticky` のセルの列の位置を返却する */
function pinnedColumns(page: Page): Promise<number[]> {
  return page.evaluate(() =>
    [
      ...(document
        .querySelector("#storybook-root tbody tr")
        ?.querySelectorAll("td") ?? []),
    ].flatMap((cell, index) =>
      getComputedStyle(cell).position === "sticky" ? [index] : [],
    ),
  );
}

/** 表の本文の行のうち、隠れていない行の数 */
function visibleRows(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "#storybook-root tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
        ),
      ].filter((row) => !row.hidden).length,
  );
}

/** 表の外側の枠の色を返却する */
function frameColor(page: Page): Promise<string> {
  return page
    .locator(".mdmark-table table")
    .evaluate((el) => getComputedStyle(el).borderTopColor);
}

/** 表の見えている右端（表と、表を包む要素の右端のうち左のほう）から 10px 内側（右の角の丸みと、右端のセルの文字の間）の x と、表の下端の y を返却する */
function tableBottom(page: Page): Promise<{ x: number; y: number }> {
  return page.locator(".mdmark-table table").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const scroller = el.parentElement?.getBoundingClientRect();
    const right = Math.min(rect.right, scroller?.right ?? rect.right);
    return {
      x: Math.floor(right + window.scrollX) - 10,
      y: Math.floor(rect.bottom + window.scrollY),
    };
  });
}

/** 表の下端の線の太さ（枠の色の画素の数）を返却する。見えている最後の行の下の線と重なって 2px になっていないかを確認する */
async function bottomLineWidth(page: Page): Promise<number> {
  const { x, y } = await tableBottom(page);
  return countColorPixels({
    page,
    clip: { x, y: y - 5, width: 1, height: 7 },
    color: await frameColor(page),
  });
}

/** 集計の行の上の線の太さ（枠の色の画素の数）を返却する */
async function footerTopLineWidth(page: Page): Promise<number> {
  const { x } = await tableBottom(page);
  const top = await page
    .locator("#storybook-root tfoot td")
    .first()
    .evaluate((el) =>
      Math.floor(el.getBoundingClientRect().top + window.scrollY),
    );
  return countColorPixels({
    page,
    clip: { x, y: top - 4, width: 1, height: 6 },
    color: await frameColor(page),
  });
}

/** 指定した行（見出し・本文・集計）の高さの真ん中で、表の右端の線の太さ（枠の色の画素の数）を返却する */
async function rightEdgeWidth(page: Page, row: string): Promise<number> {
  const { right, y } = await page
    .locator(row)
    .first()
    .evaluate((el) => {
      const table = el.closest("table")?.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return {
        right: Math.floor((table?.right ?? 0) + window.scrollX),
        y: Math.floor(rect.top + rect.height / 2 + window.scrollY),
      };
    });
  return countColorPixels({
    page,
    clip: { x: right - 5, y, width: 7, height: 1 },
    color: await frameColor(page),
  });
}

/** 見出し行・本文の行・集計の行の右端の線の太さを、上から並べて返却する */
async function rightEdgeWidths(page: Page, rows: string[]): Promise<number[]> {
  const widths: number[] = [];
  for (const row of rows) {
    widths.push(await rightEdgeWidth(page, row));
  }
  return widths;
}

const BODY_ROW =
  "#storybook-root tbody tr:not([hidden]):not(.mdmark-table-empty)";

// data の種類は、並べ替え・ピン止め・絞り込みの機能を持ち、並べていない（Data）
test("test_data", async () => {
  // 準備・実行
  const page = await open("data");
  // 検証
  const wrapper = page.locator(".mdmark-table");
  await expect(wrapper.getAttribute("data-kind")).resolves.toBe("data");
  await expect(wrapper.getAttribute("data-features")).resolves.toBe(
    "sort pin filter",
  );
  await expect(page.locator("th button.mdmark-sort").count()).resolves.toBe(3);
  await expect(page.locator("th[aria-sort]").count()).resolves.toBe(0);
  await expect(columnTexts(page, 2)).resolves.toEqual(["6.2", "1.4", "2.1"]);
  // 外側を 1px・角丸（`--mdmark-radius` の 4px の 2 倍）の枠で囲む
  const frame = await page.locator(".mdmark-table table").evaluate((el) => ({
    width: getComputedStyle(el).borderTopWidth,
    radius: getComputedStyle(el).borderTopLeftRadius,
  }));
  expect(frame).toEqual({ width: "1px", radius: "8px" });
  // 本文の行は地の色、見出し行だけ面の色で塗る
  await expect(
    page
      .locator(".mdmark-table table")
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe(await resolveColor(page, "var(--mdmark-color-bg)"));
  await expect(
    page
      .locator("#storybook-root tbody td")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe("rgba(0, 0, 0, 0)");
  await expect(
    page
      .locator("#storybook-root thead th")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe(await resolveColor(page, "var(--mdmark-color-table-head)"));
});

// 増分の列で昇順に並べる（SortedAscending）
test("test_sorted_ascending", async () => {
  // 準備・実行
  const page = await open("sorted-ascending");
  // 検証
  await expect(
    page.locator("th[aria-sort='ascending']").innerText(),
  ).resolves.toContain("増分");
  await expect(columnTexts(page, 2)).resolves.toEqual(["1.4", "2.1", "6.2"]);
});

// 増分の列で降順に並べる（SortedDescending）
test("test_sorted_descending", async () => {
  // 準備・実行
  const page = await open("sorted-descending");
  // 検証
  await expect(
    page.locator("th[aria-sort='descending']").innerText(),
  ).resolves.toContain("増分");
  await expect(columnTexts(page, 2)).resolves.toEqual(["6.2", "2.1", "1.4"]);
});

// 値を選ぶドロワーを開くと、候補の検索欄とチェックボックスが出る（FilterSelectOpen）
test("test_filter_select_open", async () => {
  // 準備・実行
  const page = await open("filter-select-open");
  // 検証
  const drawer = page.locator(".mdmark-filter-drawer:not([hidden])");
  await expect(drawer.count()).resolves.toBe(1);
  await expect(drawer.getAttribute("data-filter-kind")).resolves.toBe("select");
  await expect(drawer.locator(".mdmark-filter-search").count()).resolves.toBe(
    1,
  );
  await expect(drawer.locator("input[type='checkbox']").count()).resolves.toBe(
    3,
  );
  await expect(
    drawer.locator(".mdmark-filter-clear").innerText(),
  ).resolves.toBe("絞り込みを解除");
  await expect(
    page.locator(".mdmark-filter[aria-expanded='true']").count(),
  ).resolves.toBe(1);
});

// 文字で絞るドロワーを開いて「描画」を入れると、含まない行が隠れる（FilterTextOpen）
test("test_filter_text_open", async () => {
  // 準備・実行
  const page = await open("filter-text-open");
  // 検証
  const drawer = page.locator(".mdmark-filter-drawer:not([hidden])");
  await expect(drawer.getAttribute("data-filter-kind")).resolves.toBe("text");
  await expect(drawer.locator("input").inputValue()).resolves.toBe("描画");
  await expect(visibleRows(page)).resolves.toBe(2);
});

// 日付で絞るドロワーを開くと、開始日と終了日を縦に並べる（FilterDateOpen）
test("test_filter_date_open", async () => {
  // 準備・実行
  const page = await open("filter-date-open");
  // 検証
  const drawer = page.locator(".mdmark-filter-drawer:not([hidden])");
  await expect(drawer.getAttribute("data-filter-kind")).resolves.toBe("date");
  const inputs = drawer.locator("input[type='date']");
  await expect(inputs.count()).resolves.toBe(2);
  await expect(drawer.innerText()).resolves.toContain("開始日");
  await expect(drawer.innerText()).resolves.toContain("終了日");
  const first = await inputs.nth(0).boundingBox();
  const second = await inputs.nth(1).boundingBox();
  expect(second?.y ?? 0).toBeGreaterThan(
    (first?.y ?? 0) + (first?.height ?? 0) - 1,
  );
});

// 名前の列を絞り込むと、ボタンが絞り込み中の外観になる（Filtered）
test("test_filtered", async () => {
  // 準備・実行
  const page = await open("filtered");
  // 検証
  const button = page.locator(".mdmark-filter");
  await expect(
    button.evaluate((el) => el.classList.contains("is-active")),
  ).resolves.toBe(true);
  await expect(
    button.locator(".mdmark-visually-hidden").innerText(),
  ).resolves.toBe("（絞り込み中）");
  await expect(
    page.locator(".mdmark-filter-drawer:not([hidden])").count(),
  ).resolves.toBe(0);
  await expect(visibleRows(page)).resolves.toBe(1);
  // 隠した行が tbody の末尾にあっても、見えている最後の行の下の線と枠が重ならず、下端は 1px
  await expect(
    page
      .locator("tr.mdmark-table-empty")
      .evaluate((el) => el.hasAttribute("hidden")),
  ).resolves.toBe(true);
  await expect(bottomLineWidth(page)).resolves.toBe(1);
});

// 絞り込みに一致する行が無いときは、「一致する行がありません」の行を出す（NoMatch）
test("test_no_match", async () => {
  // 準備・実行
  const page = await open("no-match");
  // 検証
  await expect(visibleRows(page)).resolves.toBe(0);
  const empty = page.locator("tr.mdmark-table-empty");
  await expect(empty.isVisible()).resolves.toBe(true);
  await expect(empty.innerText()).resolves.toBe("一致する行がありません");
});

// 幅からはみ出す既定の種類の表は、各列にピン止めのボタンが出て、表の中で横にスクロールする（DefaultOverflow）
test("test_default_overflow", async () => {
  // 準備・実行
  const page = await open("default-overflow");
  // 検証
  await expect(page.locator("button.mdmark-pin:visible").count()).resolves.toBe(
    10,
  );
  const scrolls = await page
    .locator(".mdmark-table .mdmark-table-scroll")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
  // 先頭の列を既定で留める
  await expect(
    page.locator("button.mdmark-pin").first().getAttribute("aria-pressed"),
  ).resolves.toBe("true");
  await expect(pinnedColumns(page)).resolves.toEqual([0]);
});

// -pin ではみ出す表は、ピン止めのボタンを出さず、どの列も留めない（NoPin）
test("test_no_pin", async () => {
  // 準備・実行
  const page = await open("no-pin");
  // 検証
  await expect(page.locator("button.mdmark-pin").count()).resolves.toBe(0);
  await expect(pinnedColumns(page)).resolves.toEqual([]);
  await expect(
    page
      .locator(".mdmark-table .mdmark-table-scroll")
      .evaluate((el) => el.scrollWidth > el.clientWidth),
  ).resolves.toBe(true);
});

// pin=担当 wide=概要 は、担当の列だけを留め、概要の列を折り返さずに広く取る（PinAndWide）
test("test_pin_and_wide", async () => {
  // 準備・実行
  const page = await open("pin-and-wide");
  // 検証: 留める列
  await expect(
    page.locator(".mdmark-table").getAttribute("data-pin"),
  ).resolves.toBe("1");
  await expect(pinnedColumns(page)).resolves.toEqual([1]);
  // 検証: 概要の列は折り返さず、1 行の高さに収まる
  const summary = page
    .locator("#storybook-root tbody tr")
    .first()
    .locator("td")
    .nth(2);
  await expect(
    summary.evaluate((el) => getComputedStyle(el).whiteSpace),
  ).resolves.toBe("nowrap");
  await expect(
    summary.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).resolves.toBe(true);
});

// check=必須 は、true を ✓、false を空欄で出し、既定の列は文字のまま（Check）
test("test_check", async () => {
  // 準備・実行
  const page = await open("check");
  // 検証: 必須の列の ✓ と空欄
  const cells = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#storybook-root tbody tr:not(.mdmark-table-empty)",
      ),
    ].map((row) => {
      const cell = row.querySelectorAll("td")[2];
      const mark = cell?.querySelector(".mdmark-check");
      return {
        value: cell?.getAttribute("data-value"),
        label: mark?.getAttribute("aria-label") ?? null,
        role: mark?.getAttribute("role") ?? null,
        spoken:
          cell?.querySelector(".mdmark-visually-hidden")?.textContent ?? null,
        align: cell ? getComputedStyle(cell).textAlign : "",
      };
    }),
  );
  expect(cells.map((cell) => cell.value)).toEqual([
    "true",
    "false",
    "false",
    "true",
  ]);
  expect(cells[0]).toMatchObject({
    label: "はい",
    role: "img",
    spoken: null,
    align: "center",
  });
  expect(cells[1]).toMatchObject({
    label: null,
    spoken: "いいえ",
    align: "center",
  });
  // 検証: 空欄のセルは外観に文字が無い（いいえはスクリーンリーダーだけで、大きさを持たない）
  const spokenBox = await page
    .locator("#storybook-root tbody tr")
    .nth(1)
    .locator("td .mdmark-visually-hidden")
    .evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return Math.max(rect.width, rect.height);
    });
  expect(spokenBox).toBeLessThanOrEqual(1);
  // 検証: 既定の列は文字のまま
  await expect(columnTexts(page, 3)).resolves.toEqual([
    "-",
    "全てオン",
    "jsDelivr",
    "-",
  ]);
});

// pinMode: through で 2 列目までピン止めすると、2 列目のボタンだけが押され、留めた最後の列の右に境目の線がある（Pinned）
test("test_pinned", async () => {
  // 準備・実行
  const page = await open("pinned");
  // 検証
  await expect(
    page.locator("button.mdmark-pin[aria-pressed='true']").count(),
  ).resolves.toBe(1);
  const cells = page.locator("#storybook-root tbody tr").first().locator("td");
  await expect(
    cells.nth(0).evaluate((el) => el.classList.contains("is-pinned-col")),
  ).resolves.toBe(true);
  await expect(
    cells.nth(1).evaluate((el) => el.classList.contains("is-pinned-edge")),
  ).resolves.toBe(true);
  await expect(
    cells.nth(2).evaluate((el) => el.classList.contains("is-pinned-col")),
  ).resolves.toBe(false);
  await expect(
    cells.nth(1).evaluate((el) => getComputedStyle(el).boxShadow),
  ).resolves.not.toBe("none");
  // ピン止めした列の本文のセルは、表と同じ地の色。見出しは見出し行の面の色
  await expect(
    cells.nth(0).evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe(await resolveColor(page, "var(--mdmark-color-bg)"));
  await expect(
    page
      .locator("#storybook-root thead th.is-pinned-col")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor),
  ).resolves.toBe(await resolveColor(page, "var(--mdmark-color-table-head)"));
});

// pinMode: each で 1・3 列目だけを留め、1・3 列目のボタンを押した状態にする（PinnedEach）
test("test_pinned_each", async () => {
  // 準備・実行
  const page = await open("pinned-each");
  // 検証
  await expect(
    page
      .locator("#storybook-root thead button.mdmark-pin")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-pressed")),
      ),
  ).resolves.toEqual([
    "true",
    "false",
    "true",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
  ]);
  await expect(
    page
      .locator("#storybook-root thead button.mdmark-pin")
      .first()
      .getAttribute("aria-label"),
  ).resolves.toBe("「文書」の列をピン止め");
  await expect(pinnedColumns(page)).resolves.toEqual([0, 2]);
});

/** ピン止めのボタンごとの、押した状態・留まっていない状態・名前 */
function pinStates(page: Page): Promise<
  Array<{
    pressed: string | null;
    unpinned: boolean;
    label: string | null;
    title: string | null;
  }>
> {
  return page
    .locator("#storybook-root thead button.mdmark-pin")
    .evaluateAll((buttons) =>
      buttons.map((button) => ({
        pressed: button.getAttribute("aria-pressed"),
        unpinned: button.classList.contains("is-unpinned"),
        label: button.getAttribute("aria-label"),
        title: button.getAttribute("title"),
      })),
    );
}

// pinMode: each で 1・3・9 列目を選び、unpinned の 9 列目を留めず、ボタンを押したまま破線のピンにする（PinnedOverflowEach）
test("test_pinned_overflow_each", async () => {
  // 準備・実行
  const page = await open("pinned-overflow-each");
  // 検証
  await expect(pinnedColumns(page)).resolves.toEqual([0, 2]);
  const states = await pinStates(page);
  expect(states.map((state) => state.pressed)).toEqual([
    "true",
    "false",
    "true",
    "false",
    "false",
    "false",
    "false",
    "false",
    "true",
    "false",
  ]);
  expect(states.map((state) => state.unpinned)).toEqual([
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    false,
    true,
    false,
  ]);
  const label =
    "「iOS Safari」の列をピン止め（表の幅に収まらないため留まっていません）";
  expect(states[8]?.label).toBe(label);
  expect(states[8]?.title).toBe(label);
  expect(states[0]?.title).toBeNull();
  // 検証: 破線の枠線
  await expect(
    page
      .locator("#storybook-root thead button.mdmark-pin.is-unpinned")
      .evaluate((button) => getComputedStyle(button).borderTopStyle),
  ).resolves.toBe("dashed");
});

// pinMode: through で 3 列目までを押し、unpinned の 3 列目を留めず、押した 3 列目のボタンだけを破線のピンにする（PinnedOverflowThrough）
test("test_pinned_overflow_through", async () => {
  // 準備・実行
  const page = await open("pinned-overflow-through");
  // 検証
  await expect(pinnedColumns(page)).resolves.toEqual([0, 1]);
  const states = await pinStates(page);
  expect(states.map((state) => state.pressed)).toEqual([
    "false",
    "false",
    "true",
    ...Array.from({ length: 7 }, () => "false"),
  ]);
  expect(states.map((state) => state.unpinned)).toEqual([
    false,
    false,
    true,
    ...Array.from({ length: 7 }, () => false),
  ]);
  expect(states[2]?.label).toBe(
    "「表」の列までピン止め（表の幅に収まらないため留まっていません）",
  );
});

// pinMode: each で結合した見出しの下の既定だけを名前と一緒に留め、結合した設定のセルは留めない（PinnedUnderMergedHeader）
test("test_pinned_under_merged_header", async () => {
  // 準備・実行
  const page = await open("pinned-under-merged-header");
  // 検証
  await expect(pinnedColumns(page)).resolves.toEqual([0, 2]);
  const headPositions = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLTableCellElement>(
        "#storybook-root thead th",
      ),
    ].map((cell) => ({
      text: cell.textContent?.trim() ?? "",
      sticky: getComputedStyle(cell).position === "sticky",
    })),
  );
  expect(headPositions.find((cell) => cell.text === "設定")?.sticky).toBe(
    false,
  );
  expect(headPositions.find((cell) => cell.text === "既定")?.sticky).toBe(true);
  // ボタンは見出しの行の順に並ぶので、列の名前で引く
  const pressed = Object.fromEntries(
    await page
      .locator("#storybook-root thead button.mdmark-pin")
      .evaluateAll((buttons) =>
        buttons.map((button) => [
          button.getAttribute("aria-label"),
          button.getAttribute("aria-pressed"),
        ]),
      ),
  );
  expect(pressed).toEqual({
    "「名前」の列をピン止め": "true",
    "「型」の列をピン止め": "false",
    "「既定」の列をピン止め": "true",
    "「必須」の列をピン止め": "false",
    "「備考」の列をピン止め": "false",
  });
});

// 幅に収まる既定の種類の表は、ピン止めのボタンを出さない（DefaultFits）
test("test_default_fits", async () => {
  // 準備・実行
  const page = await open("default-fits");
  // 検証
  await expect(page.locator("button.mdmark-pin:visible").count()).resolves.toBe(
    0,
  );
  await expect(
    page.locator(".mdmark-table").getAttribute("data-features"),
  ).resolves.toBe("pin");
});

// plain の種類は、機能を付けず、縦の罫線と面を削除する（Plain）
test("test_plain", async () => {
  // 準備・実行
  const page = await open("plain");
  // 検証
  await expect(
    page.locator(".mdmark-table").getAttribute("data-kind"),
  ).resolves.toBe("plain");
  await expect(page.locator("#storybook-root th button").count()).resolves.toBe(
    0,
  );
  const border = await page
    .locator("td")
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(border).toBe("0px");
});

// 閉じた表は、本文の行の数の見出し「表（1 行）」だけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await open("closed");
  // 検証
  const details = page.locator("details.mdmark-table-details");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "表（1 行）",
  );
  await expect(details.locator("table").isVisible()).resolves.toBe(false);
});

// 閉じた表に title= を付けると、その文字が見出しになり、表が見えない（ClosedTitle）
test("test_closed_title", async () => {
  // 準備・実行
  const page = await open("closed-title");
  // 検証
  const details = page.locator("details.mdmark-table-details");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "リリースの一覧",
  );
  await expect(details.locator("table").isVisible()).resolves.toBe(false);
});

// 開いた表に title= を付けると、見出しの下に表が見える（OpenTitle）
test("test_open_title", async () => {
  // 準備・実行
  const page = await open("open-title");
  // 検証
  const details = page.locator("details.mdmark-table-details");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(true);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "リリースの一覧",
  );
  await expect(details.locator("table").isVisible()).resolves.toBe(true);
  await expect(
    details.locator("tbody tr:not(.mdmark-table-empty)").count(),
  ).resolves.toBe(2);
});

// 長い列名と値は、セルの中で折り返し、見出しのボタンが文字に重ならない（LongCells）
test("test_long_cells", async () => {
  // 準備・実行
  const page = await open("long-cells");
  // 検証
  const overlap = await page
    .locator("#storybook-root thead th")
    .first()
    .evaluate((cell) => {
      const sort = cell.querySelector(".mdmark-sort")?.getBoundingClientRect();
      const tools = cell
        .querySelector(".mdmark-th-tools")
        ?.getBoundingClientRect();
      return sort && tools ? sort.right > tools.left + 1 : true;
    });
  expect(overlap).toBe(false);
  const wraps = await page
    .locator("#storybook-root tbody td")
    .first()
    .evaluate((cell) => cell.getBoundingClientRect().height > 40);
  expect(wraps).toBe(true);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 表の本文の行の隠れた列を含む、指定した列のセルが `hidden` かを上から並べて返却する */
function hiddenCells(page: Page, column: number): Promise<boolean[]> {
  return page.evaluate((index) => {
    const cells = [
      document.querySelectorAll("#storybook-root thead th")[index],
      ...[
        ...document.querySelectorAll(
          "#storybook-root tbody tr:not(.mdmark-table-empty)",
        ),
      ].map((row) => row.querySelectorAll("td")[index]),
      document.querySelectorAll("#storybook-root tfoot td")[index],
    ];
    return cells
      .filter((cell): cell is Element => cell !== undefined)
      .map((cell) => cell.hasAttribute("hidden"));
  }, column);
}

/** 集計の行ごとに、セルの文字を空白を除いて左から並べて返却する */
function totalRows(page: Page): Promise<string[][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("#storybook-root tfoot tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, ""),
      ),
    ),
  );
}

/** 件数の要素の、画面に出る文字を返却する（スクリーンリーダー向けの文字は含めない） */
function countText(page: Page): Promise<string> {
  return page.locator(".mdmark-table-count [aria-hidden='true']").innerText();
}

// 件数を表の上に出す（Count）
test("test_count", async () => {
  // 準備・実行
  const page = await open("count");
  // 検証
  await expect(countText(page)).resolves.toBe("3 / 3 件");
  await expect(
    page.locator(".mdmark-table-count").getAttribute("aria-live"),
  ).resolves.toBe("polite");
});

// 絞り込んだ後の件数を出す（CountFiltered）
test("test_count_filtered", async () => {
  // 準備・実行
  const page = await open("count-filtered");
  // 検証
  await expect(countText(page)).resolves.toBe("2 / 3 件");
  await expect(visibleRows(page)).resolves.toBe(2);
});

// hide= の列を隠し、帯にテーブル設定のアイコンだけのボタンと、隠した列の数のバッジを出す（ColumnsHidden）
test("test_columns_hidden", async () => {
  // 準備・実行
  const page = await open("columns-hidden");
  // 検証
  const toggle = page.locator(".mdmark-table-settings-toggle");
  await expect(toggle.getAttribute("aria-label")).resolves.toBe(
    "テーブル設定（1 列を非表示）",
  );
  await expect(
    toggle.locator(".mdmark-table-tool-badge").innerText(),
  ).resolves.toBe("1");
  await expect(toggle.locator("svg").count()).resolves.toBe(1);
  await expect(
    page.locator(".mdmark-table-settings:not([hidden])").count(),
  ).resolves.toBe(0);
  const hidden = await hiddenCells(page, 1);
  expect(hidden.every(Boolean)).toBe(true);
  expect((await hiddenCells(page, 0)).some(Boolean)).toBe(false);
});

// テーブル設定のパネルを開くと、各行に目のアイコンがあり、先頭の列は隠せず理由が出る（ColumnsMenuOpen）
test("test_columns_menu_open", async () => {
  // 準備・実行
  const page = await open("columns-menu-open");
  // 検証
  const panel = page.locator(".mdmark-table-settings:not([hidden])");
  await expect(panel.count()).resolves.toBe(1);
  await expect(
    panel.locator(".mdmark-table-settings-title").innerText(),
  ).resolves.toBe("表示と並び順");
  const eyes = panel.locator(".mdmark-table-settings-eye");
  await expect(eyes.count()).resolves.toBe(3);
  await expect(eyes.nth(0).isDisabled()).resolves.toBe(true);
  await expect(eyes.nth(1).getAttribute("aria-pressed")).resolves.toBe("false");
  await expect(eyes.nth(2).getAttribute("aria-pressed")).resolves.toBe("true");
  await expect(panel.innerText()).resolves.toContain("先頭の列は隠せません");
  await expect(
    page.locator(".mdmark-table-settings-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  // 最後の列を隠していても、表の右端は外側の枠の 1px だけ（表に重なるパネルは隠して測る）
  await page.addStyleTag({
    content: ".mdmark-table-settings { display: none; }",
  });
  expect((await hiddenCells(page, 2)).every(Boolean)).toBe(true);
  await expect(
    rightEdgeWidths(page, ["#storybook-root thead tr", BODY_ROW]),
  ).resolves.toEqual([1, 1]);
});

// 集計の行を表の末尾に出す（Totals）
test("test_totals", async () => {
  // 準備・実行: 表が画面に収まる高さにする（集計の行を画面の下端に留めず、元の位置で線を測る）
  const page = await holder.openStory("parts-table--totals", {
    width: 420,
    height: 800,
  });
  // 検証
  await expect(totalRows(page)).resolves.toEqual([
    ["合計", "45", ""],
    ["平均", "", "250"],
    ["件数4", "", ""],
  ]);
  // 集計の行の上と、表の下端の線は 1px（下は表の枠でなく集計の行が描く）
  await expect(footerTopLineWidth(page)).resolves.toBe(1);
  await expect(bottomLineWidth(page)).resolves.toBe(1);
  // 見出し行・本文の行・集計の行の右端は、外側の枠の 1px だけ
  await expect(
    rightEdgeWidths(page, [
      "#storybook-root thead tr",
      BODY_ROW,
      "#storybook-root tfoot tr",
    ]),
  ).resolves.toEqual([1, 1, 1]);
});

// 絞り込んだ行で集計する（TotalsFiltered）
test("test_totals_filtered", async () => {
  // 準備・実行
  const page = await open("totals-filtered");
  // 検証
  await expect(totalRows(page)).resolves.toEqual([
    ["合計", "43", ""],
    ["平均", "", "200"],
    ["件数2", "", ""],
  ]);
});

// 一致する行が無い集計の行を出す（TotalsEmpty）
test("test_totals_empty", async () => {
  // 準備・実行
  const page = await open("totals-empty");
  // 検証
  await expect(totalRows(page)).resolves.toEqual([
    ["合計", "0", ""],
    ["平均", "", "—"],
    ["件数0", "", ""],
  ]);
  await expect(countText(page)).resolves.toBe("0 / 4 件");
});

// コピーしたことを通知する（Copied）
test("test_copied", async () => {
  // 準備・実行
  const page = await open("copied");
  // 検証
  const button = page.locator(".mdmark-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("copied");
  await expect(button.innerText()).resolves.toContain("コピーしました");
  await expect(page.locator(".mdmark-table-status").innerText()).resolves.toBe(
    "コピーしました",
  );
});

// コピーできなかったことを通知する（CopyFailed）
test("test_copy_failed", async () => {
  // 準備・実行
  const page = await open("copy-failed");
  // 検証
  const button = page.locator(".mdmark-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("failed");
  await expect(button.innerText()).resolves.toContain("コピーできませんでした");
});

// 行へのリンクを持ち、指している行を強調する（RowLinkTarget）
test("test_row_link_target", async () => {
  // 準備・実行
  const page = await open("row-link-target");
  // 検証
  const rows = page.locator("#storybook-root tbody tr[id]");
  await expect(rows.count()).resolves.toBe(3);
  await expect(
    page.locator(".mdmark-row-anchor").nth(1).getAttribute("href"),
  ).resolves.toBe("#みかん");
  await expect(
    page.locator("tr[data-target]").getAttribute("id"),
  ).resolves.toBe("みかん");
  await expect(page.locator("tr[data-target]").count()).resolves.toBe(1);
});

// 5 つの機能を全て付けた表を出す（AllFeatures）
test("test_all_features", async () => {
  // 準備・実行
  const page = await open("all-features");
  // 検証
  await expect(countText(page)).resolves.toBe("3 / 3 件");
  await expect(
    page.locator(".mdmark-table-settings-toggle").count(),
  ).resolves.toBe(1);
  await expect(page.locator(".mdmark-copy").count()).resolves.toBe(1);
  await expect(totalRows(page)).resolves.toEqual([["合計", "", "25"]]);
  expect((await hiddenCells(page, 1)).every(Boolean)).toBe(true);
  await expect(page.locator(".mdmark-row-anchor").count()).resolves.toBe(3);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 数として読み込めないセルを持つ列は、合計の行のセルを空にし、平均の行のセルは読み込めた値で出す（TotalsUnreadable）
test("test_totals_unreadable", async () => {
  // 準備・実行
  const page = await open("totals-unreadable");
  // 検証
  await expect(totalRows(page)).resolves.toEqual([
    ["合計", "", ""],
    ["平均", "", "250"],
  ]);
});

// 集計のメニューを開くと、合計・平均・件数のチェックボックスに全てチェックが入っている（TotalsMenuOpen）
test("test_totals_menu_open", async () => {
  // 準備・実行
  const page = await open("totals-menu-open");
  // 検証
  const menu = page.locator(".mdmark-totals-menu:not([hidden])");
  await expect(menu.count()).resolves.toBe(1);
  await expect(menu.getAttribute("aria-label")).resolves.toBe("表示する集計");
  await expect(menu.innerText()).resolves.toContain("表示する集計");
  const boxes = menu.locator("input[type='checkbox']");
  await expect(boxes.count()).resolves.toBe(3);
  await expect(
    boxes.evaluateAll((inputs) =>
      inputs.map((input) => ({
        value: (input as HTMLInputElement).value,
        checked: (input as HTMLInputElement).checked,
        label: input.parentElement?.textContent?.trim(),
      })),
    ),
  ).resolves.toEqual([
    { value: "sum", checked: true, label: "合計" },
    { value: "avg", checked: true, label: "平均" },
    { value: "count", checked: true, label: "件数" },
  ]);
  await expect(
    page.locator(".mdmark-totals-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 平均と件数のチェックを解除すると、合計の行だけを出し、集計のボタンが隠していることを示す（TotalsHidden）
test("test_totals_hidden", async () => {
  // 準備・実行
  const page = await open("totals-hidden");
  // 検証
  const rows = page.locator("#storybook-root tfoot tr");
  await expect(
    rows.evaluateAll((elements) =>
      elements.map((element) => ({
        kind: element.getAttribute("data-total-kind"),
        hidden: element.hasAttribute("hidden"),
      })),
    ),
  ).resolves.toEqual([
    { kind: "sum", hidden: false },
    { kind: "avg", hidden: true },
    { kind: "count", hidden: true },
  ]);
  await expect(rows.locator("visible=true").count()).resolves.toBe(1);
  const toggle = page.locator(".mdmark-totals-toggle");
  await expect(
    toggle.evaluate((el) => el.classList.contains("is-active")),
  ).resolves.toBe(true);
  await expect(
    toggle.locator(".mdmark-visually-hidden").innerText(),
  ).resolves.toBe("（2 件を非表示にしています）");
});

// コピーの形式のメニューを開くと、Markdown の表と TSV の 2 つを用途と並べて出す（CopyMenuOpen）
test("test_copy_menu_open", async () => {
  // 準備・実行
  const page = await open("copy-menu-open");
  // 検証
  const menu = page.locator(".mdmark-copy-menu:not([hidden])");
  await expect(menu.count()).resolves.toBe(1);
  await expect(
    menu.locator(".mdmark-copy-format").evaluateAll((buttons) =>
      buttons.map((button) => ({
        format: button.getAttribute("data-format"),
        name: button.querySelector(".mdmark-copy-format-name")?.textContent,
        note: button.querySelector(".mdmark-copy-format-note")?.textContent,
      })),
    ),
  ).resolves.toEqual([
    {
      format: "markdown",
      name: "Markdown の表",
      note: "文書に貼るとそのまま表になる",
    },
    {
      format: "tsv",
      name: "TSV",
      note: "表計算ソフトに貼るとセルに分かれる",
    },
  ]);
  await expect(
    page.locator(".mdmark-copy").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// クリップボードに書き込めないときは、手動でコピーするパネルを帯の直後に出し、中身を読み取り専用で並べる（CopyFallback）
test("test_copy_fallback", async () => {
  // 準備・実行
  const page = await open("copy-fallback");
  // 検証
  const button = page.locator(".mdmark-copy");
  await expect(button.getAttribute("data-state")).resolves.toBe("failed");
  await expect(button.innerText()).resolves.toContain("コピーできませんでした");
  const panel = page.locator(".mdmark-copy-panel");
  await expect(panel.count()).resolves.toBe(1);
  await expect(panel.getAttribute("role")).resolves.toBe("group");
  await expect(
    page
      .locator(".mdmark-table-bar")
      .evaluate((bar) => bar.nextElementSibling?.className),
  ).resolves.toBe("mdmark-copy-panel");
  await expect(panel.innerText()).resolves.toContain(
    "クリップボードにコピーできませんでした",
  );
  await expect(
    panel.locator(".mdmark-copy-panel-close").getAttribute("aria-label"),
  ).resolves.toBe("閉じる");
  const textarea = panel.locator("textarea");
  await expect(
    textarea.evaluate((el) => (el as HTMLTextAreaElement).readOnly),
  ).resolves.toBe(true);
  await expect(textarea.inputValue()).resolves.toBe(
    [
      "| 名前 | 説明 | 更新日 |",
      "| --- | --- | --- |",
      "| りんご | 描画を速くする | 2026-10-01 |",
      "| みかん | 印刷を修正する | 2026-10-10 |",
    ].join("\n"),
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 行へのリンクの通知の、行の ID・状態・文字・画面に出ているかを返却する */
function rowLinkNotice(page: Page): Promise<{
  row: string | undefined;
  state: string | null;
  text: string;
  visible: boolean;
}> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>(
      "#storybook-root tr[data-target]",
    );
    const notice = row?.querySelector<HTMLElement>(".mdmark-row-link-notice");
    return {
      row: row?.id,
      state: notice?.getAttribute("data-state") ?? null,
      text: notice?.textContent ?? "",
      visible: (notice?.getClientRects().length ?? 0) > 0,
    };
  });
}

// 2 行目の行へのリンクの URL をコピーすると、マーカーの横に「リンクをコピーしました」を出す（RowLinkCopied）
test("test_row_link_copied", async () => {
  // 準備・実行
  const page = await open("row-link-copied");
  // 検証
  await expect(rowLinkNotice(page)).resolves.toEqual({
    row: "みかん",
    state: "copied",
    text: "リンクをコピーしました",
    visible: true,
  });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 2 行目の行へのリンクの URL をコピーできないと、マーカーの横に「リンクをコピーできませんでした」を出す（RowLinkFailed）
test("test_row_link_failed", async () => {
  // 準備・実行
  const page = await open("row-link-failed");
  // 検証
  await expect(rowLinkNotice(page)).resolves.toEqual({
    row: "みかん",
    state: "failed",
    text: "リンクをコピーできませんでした",
    visible: true,
  });
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 広い画面（自動で決めた幅の合計が 420px を超えるストーリー） */
const WIDE_VIEWPORT = { width: 1280, height: 400 };

/** 最下段の見出しのセルの外側の幅と、表の左右の枠線を除いた幅・表を包む要素のはみ出し、本文の 1 行目のセルの文字の行の数を返却する */
function widthLayout(page: Page): Promise<{
  heads: number[];
  table: number;
  autoWidth: boolean;
  scrollWidth: number;
  clientWidth: number;
  lines: number[];
}> {
  return page.locator(".mdmark-table table").evaluate((table) => {
    const scroller = table.parentElement as HTMLElement;
    const cells = [
      ...(table.querySelector("tbody tr")?.querySelectorAll("td") ?? []),
    ];
    return {
      heads: [...table.querySelectorAll("thead th")].map(
        (th) => th.getBoundingClientRect().width,
      ),
      table:
        table.getBoundingClientRect().width -
        Number.parseFloat(getComputedStyle(table).borderLeftWidth) -
        Number.parseFloat(getComputedStyle(table).borderRightWidth),
      autoWidth: table.hasAttribute("data-auto-width"),
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      lines: cells.map((cell) => {
        const tops = new Set<number>();
        const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            tops.add(Math.round(rect.top));
          }
        }
        return tops.size;
      }),
    };
  });
}

/** 幅の並びが、期待した幅の並びと 1px 以内で一致することを確認する */
function expectWidths(actual: number[], expected: number[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((width, index) => {
    expect(Math.abs(width - (expected[index] ?? 0))).toBeLessThanOrEqual(1);
  });
}

// 列の少ない表を、本文の幅まで広げず列の幅の合計で描き、横にスクロールしない（FitsContent）
test("test_fits_content", async () => {
  // 準備・実行
  const page = await open("fits-content");
  // 検証
  const layout = await widthLayout(page);
  expect(layout.autoWidth).toBe(true);
  expectWidths(layout.heads, [80, 72]);
  expect(Math.abs(layout.table - 152)).toBeLessThanOrEqual(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.lines).toEqual([1, 1]);
});

// 長文の説明の列だけを折り返し、ほかの列は最も長い行の幅で 1 行に収める（AutoWidth）
test("test_auto_width", async () => {
  // 準備・実行
  const page = await holder.openStory("parts-table--auto-width", WIDE_VIEWPORT);
  // 検証
  const layout = await widthLayout(page);
  expectWidths(layout.heads, [60, 90, 112, 78, 92, 713]);
  expect(layout.lines.slice(0, 4)).toEqual([1, 1, 1, 1]);
  expect(layout.lines[4]).toBe(3);
  expect(layout.lines[5]).toBeGreaterThan(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  await expect(
    page.locator(".mdmark-table").getAttribute("data-long"),
  ).resolves.toBe("5");
});

// 長文の列が 2 つある表は、1 行で収まる備考の列を 1 行のまま、説明の列を折り返す（TwoLongColumns）
test("test_two_long_columns", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-table--two-long-columns",
    WIDE_VIEWPORT,
  );
  // 検証
  const layout = await widthLayout(page);
  expectWidths(layout.heads, [82, 740, 323]);
  expect(layout.lines[0]).toBe(1);
  expect(layout.lines[1]).toBeGreaterThan(1);
  expect(layout.lines[2]).toBe(1);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
});

// 狭い画面では長文の列を最小の幅（45em）で折り返し、表の中で横にスクロールする（NarrowScroll）
test("test_narrow_scroll", async () => {
  // 準備・実行
  const page = await open("narrow-scroll");
  // 検証
  const layout = await widthLayout(page);
  expectWidths(layout.heads, [82, 630, 630]);
  expect(layout.lines[1]).toBeGreaterThan(1);
  expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// width.min・width.max を記載した説明の列を、記載した範囲の幅で折り返す（WidthRange）
test("test_width_range", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-table--width-range",
    WIDE_VIEWPORT,
  );
  // 検証
  await expect(
    page.locator(".mdmark-table").getAttribute("data-width"),
  ).resolves.toBe("1:20-30");
  const layout = await widthLayout(page);
  expectWidths(layout.heads, [82, 420, 72]);
  expect(layout.lines[0]).toBe(1);
  expect(layout.lines[1]).toBeGreaterThan(1);
  expect(layout.lines[2]).toBe(1);
});

// filter.type を省いた長文の説明の列は、文字で絞り込むドロワーを開く（LongColumnTextFilter）
test("test_long_column_text_filter", async () => {
  // 準備・実行
  const page = await holder.openStory(
    "parts-table--long-column-text-filter",
    WIDE_VIEWPORT,
  );
  // 検証
  await expect(
    page.locator(".mdmark-table").getAttribute("data-filter"),
  ).resolves.toBe("0:select 1:text");
  const drawer = page.locator(".mdmark-filter-drawer:not([hidden])");
  await expect(drawer.count()).resolves.toBe(1);
  await expect(drawer.getAttribute("data-filter-kind")).resolves.toBe("text");
  await expect(drawer.locator("input[type='checkbox']").count()).resolves.toBe(
    0,
  );
});

// 30 行と集計の行を持つ表は、枠を縦にスクロールすると、表が枠に残っている間、見出し行が上端に、集計の行が下端に留まる（StickyRows）
test("test_sticky_rows", async () => {
  // 準備
  const page = await open("sticky-rows");
  const tableTop = await page
    .locator(".mdmark-table table")
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  const viewportHeight = page.viewportSize()?.height ?? 0;
  const headTop = (): Promise<number> =>
    page
      .locator("#storybook-root thead th")
      .first()
      .evaluate((el) => el.getBoundingClientRect().top);
  const footBottom = (): Promise<number> =>
    page
      .locator("#storybook-root tfoot td")
      .last()
      .evaluate((el) => el.getBoundingClientRect().bottom);
  // 実行: 表の途中までスクロールする
  await page.evaluate((top) => window.scrollTo(0, top), tableTop + 300);
  // 検証
  await expect
    .poll(async () => Math.abs((await headTop()) - 0))
    .toBeLessThanOrEqual(1);
  await expect
    .poll(async () => Math.abs((await footBottom()) - viewportHeight))
    .toBeLessThanOrEqual(1);
});

/** 本文の行ごとの色の名前と、各セルの面の色・文字の色・下の罫線の色・上の線（box-shadow） */
function rowColors(page: Page) {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll(
        "#storybook-root tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
      ),
    ].map((row) => ({
      name: row.querySelector("td")?.textContent ?? "",
      color: row.getAttribute("data-color"),
      cells: [...row.querySelectorAll("td")].map((cell) => {
        const style = getComputedStyle(cell);
        return {
          background: style.backgroundColor,
          text: style.color,
          bottom: style.borderBottomColor,
          shadow: style.boxShadow,
          highlighted: cell.classList.contains("mdmark-col-highlight"),
        };
      }),
    })),
  );
}

/** 色のプリセットの面の薄い色と文字の色を、表の中で解決した色にする */
async function accent(page: Page, color: string) {
  return {
    bg: await resolveColorIn(
      page,
      ".mdmark",
      `var(--mdmark-color-accent-${color}-bg)`,
    ),
    text: await resolveColorIn(
      page,
      ".mdmark",
      `var(--mdmark-color-accent-${color}-text)`,
    ),
  };
}

// highlight= の列は、セルを面の薄い色にし、見出しのセルの下端に線を付ける（Highlighted）
test("test_highlighted", async () => {
  // 準備・実行
  const page = await open("highlighted");
  // 検証
  const blue = await accent(page, "blue");
  const head = await page.evaluate(() =>
    [...document.querySelectorAll("#storybook-root thead th")].map((th) => ({
      highlighted: th.classList.contains("mdmark-col-highlight"),
      color: th.getAttribute("data-color"),
      background: getComputedStyle(th).backgroundColor,
      shadow: getComputedStyle(th).boxShadow,
    })),
  );
  expect(head.map((th) => th.highlighted)).toEqual([false, false, true]);
  expect(head[2]?.color).toBe("blue");
  expect(head[2]?.background).toBe(blue.bg);
  // 見出しの下端の線は、色の文字の色の内側の影
  expect(head[2]?.shadow).toContain(blue.text);
  expect(head[2]?.shadow).toContain("inset");
  const rows = await rowColors(page);
  for (const row of rows) {
    expect(row.cells.map((cell) => cell.highlighted)).toEqual([
      false,
      false,
      true,
    ]);
    expect(row.cells[2]?.background).toBe(blue.bg);
    expect(row.cells[0]?.background).not.toBe(blue.bg);
    expect(
      contrastRatio(row.cells[2]?.text ?? "", row.cells[2]?.background ?? ""),
    ).toBeGreaterThanOrEqual(4.5);
  }
});

// row-color= の行は、面の薄い色にし、行の上下に線を付ける（RowColors）
test("test_row_colors", async () => {
  // 準備・実行
  const page = await open("row-colors");
  // 検証
  const green = await accent(page, "green");
  const yellow = await accent(page, "yellow");
  const rows = await rowColors(page);
  expect(rows.map((row) => row.color)).toEqual([
    "green",
    "yellow",
    null,
    "green",
  ]);
  for (const cell of rows[0]?.cells ?? []) {
    expect(cell.background).toBe(green.bg);
    expect(cell.bottom).toBe(green.text);
    // 先頭の行は上に線を付ける
    expect(cell.shadow).toContain(green.text);
    expect(contrastRatio(cell.text, cell.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
  for (const cell of rows[1]?.cells ?? []) {
    expect(cell.background).toBe(yellow.bg);
    expect(cell.bottom).toBe(yellow.text);
    expect(contrastRatio(cell.text, cell.background)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
  // 色の無い行の後ろの色の行は、上に線を付ける
  for (const cell of rows[3]?.cells ?? []) {
    expect(cell.background).toBe(green.bg);
    expect(cell.shadow).toContain(green.text);
  }
  for (const cell of rows[2]?.cells ?? []) {
    expect(cell.background).not.toBe(green.bg);
    expect(cell.background).not.toBe(yellow.bg);
  }
});

// 並べ替えた後も、値で付けた色は行に付いたまま動く（RowColorsSorted）
test("test_row_colors_sorted", async () => {
  // 準備・実行
  const page = await open("row-colors-sorted");
  // 検証
  const rows = await rowColors(page);
  expect(rows.map((row) => [row.name, row.color])).toEqual([
    ["納品の確認", "green"],
    ["請求書の発行", null],
    ["契約書の確認", "yellow"],
    ["見積もりの作成", "green"],
  ]);
  const green = await accent(page, "green");
  expect(rows[0]?.cells[0]?.background).toBe(green.bg);
});

// 列の強調と行の色が重なるセルは、行の色にする（HighlightAndRowColors）
test("test_highlight_and_row_colors", async () => {
  // 準備・実行
  const page = await open("highlight-and-row-colors");
  // 検証
  const blue = await accent(page, "blue");
  const red = await accent(page, "red");
  const rows = await rowColors(page);
  expect(rows.map((row) => row.color)).toEqual([null, "red", null, null]);
  expect(rows[1]?.cells.map((cell) => cell.background)).toEqual([
    red.bg,
    red.bg,
    red.bg,
  ]);
  for (const index of [0, 2, 3]) {
    expect(rows[index]?.cells[2]?.background).toBe(blue.bg);
  }
});

// 暗い配色では、暗い配色の色のプリセットで列と行を描く（RowColorsDark）
test("test_row_colors_dark", async () => {
  // 準備・実行
  const page = await open("row-colors-dark");
  // 検証
  await expect(
    page.locator(".mdmark").getAttribute("class"),
  ).resolves.toContain("mdmark-theme-dark");
  const green = await accent(page, "green");
  const blue = await accent(page, "blue");
  const rows = await rowColors(page);
  expect(rows[0]?.cells[0]?.background).toBe(green.bg);
  expect(rows[2]?.cells[2]?.background).toBe(blue.bg);
  for (const row of rows) {
    for (const cell of row.cells) {
      expect(contrastRatio(cell.text, cell.background)).toBeGreaterThanOrEqual(
        4.5,
      );
    }
  }
  // 明るい配色の値と違う
  const light = await resolveLightColor(
    page,
    "var(--mdmark-color-accent-green-bg)",
  );
  expect(green.bg).not.toBe(light);
});

/** 表の本文の行の行見出し（`th`）について、文字・隠れているか・`rowspan` を上から並べて返却する（隠れた行も含む） */
function rowHeaders(
  page: Page,
): Promise<Array<{ text: string; hidden: boolean; rowSpan: number }>> {
  return page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLTableRowElement>(
        "#storybook-root tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
      ),
    ].map((row) => {
      const cell = row.querySelector<HTMLTableCellElement>("th[scope=row]");
      return {
        text: cell?.textContent ?? "",
        hidden: cell?.hidden === true,
        rowSpan: cell?.rowSpan ?? 0,
      };
    }),
  );
}

// 多段の見出しと行見出しは、上期・下期を 2 列にまたいで中央に配置し、同じ地域を縦に結合して上に配置する（Merged）
test("test_merged", async () => {
  // 準備・実行
  const page = await open("merged");
  // 検証: 見出しの 2 行と、2 列をまたぐ見出し
  await expect(page.locator("#storybook-root thead tr").count()).resolves.toBe(
    2,
  );
  const groups = page.locator("#storybook-root thead th[scope=colgroup]");
  await expect(groups.allTextContents()).resolves.toEqual(["上期", "下期"]);
  await expect(
    groups.evaluateAll((cells) =>
      cells.map((cell) => [
        (cell as HTMLTableCellElement).colSpan,
        getComputedStyle(cell).textAlign,
      ]),
    ),
  ).resolves.toEqual([
    [2, "center"],
    [2, "center"],
  ]);
  // 検証: 地域の行見出しの縦の結合
  await expect(rowHeaders(page)).resolves.toEqual([
    { text: "東日本", hidden: false, rowSpan: 3 },
    { text: "東日本", hidden: true, rowSpan: 1 },
    { text: "東日本", hidden: true, rowSpan: 1 },
    { text: "西日本", hidden: false, rowSpan: 2 },
    { text: "西日本", hidden: true, rowSpan: 1 },
  ]);
  await expect(
    page
      .locator("#storybook-root tbody th.is-merged")
      .first()
      .evaluate((cell) => getComputedStyle(cell).verticalAlign),
  ).resolves.toBe("top");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 降順に並べ替えた後は、隣り合う同じ地域だけをもう一度結合する（MergedSorted）
test("test_merged_sorted", async () => {
  // 準備・実行
  const page = await open("merged-sorted");
  // 検証
  await expect(page.locator("th[aria-sort=descending]").count()).resolves.toBe(
    1,
  );
  await expect(columnTexts(page, 3)).resolves.toEqual([
    "342",
    "248",
    "151",
    "135",
    "102",
  ]);
  await expect(rowHeaders(page)).resolves.toEqual([
    { text: "東日本", hidden: false, rowSpan: 1 },
    { text: "西日本", hidden: false, rowSpan: 2 },
    { text: "西日本", hidden: true, rowSpan: 1 },
    { text: "東日本", hidden: false, rowSpan: 2 },
    { text: "東日本", hidden: true, rowSpan: 1 },
  ]);
});

// 東日本で絞り込んだ後は、表示している 3 行の地域をもう一度結合する（MergedFiltered）
test("test_merged_filtered", async () => {
  // 準備・実行
  const page = await open("merged-filtered");
  // 検証
  await expect(visibleRows(page)).resolves.toBe(3);
  await expect(
    page.locator("button.mdmark-filter.is-active").count(),
  ).resolves.toBe(1);
  const headers = await rowHeaders(page);
  expect(headers[0]).toEqual({ text: "東日本", hidden: false, rowSpan: 3 });
  expect(headers.slice(1, 3).every((header) => header.hidden)).toBe(true);
});

// row-header=2 のはみ出す表は、描いた直後に 1・2 列目を留め、1・2 列目のピン止めのボタンが押された状態（RowHeaderPinned）
test("test_row_header_pinned", async () => {
  // 準備・実行
  const page = await open("row-header-pinned");
  // 検証
  await expect(
    page
      .locator("#storybook-root thead button.mdmark-pin")
      .evaluateAll((buttons) =>
        buttons.map((button) => button.getAttribute("aria-pressed")),
      ),
  ).resolves.toEqual([
    "true",
    "true",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
    "false",
  ]);
  const sticky = await page.evaluate(() =>
    [
      ...(document
        .querySelector("#storybook-root tbody tr")
        ?.querySelectorAll("th, td") ?? []),
    ].map((cell) => getComputedStyle(cell).position),
  );
  expect(sticky.slice(0, 2)).toEqual(["sticky", "sticky"]);
  expect(sticky.slice(2).every((position) => position !== "sticky")).toBe(true);
  // 表は枠より広い
  await expect(
    page
      .locator("#storybook-root .mdmark-table .mdmark-table-scroll")
      .evaluate((scroller) => scroller.scrollWidth > scroller.clientWidth),
  ).resolves.toBe(true);
});

// 結合する相手の無い ^^・<< は、表の前に記載の警告を配置し、セルを記載した文字のまま描く（MergeInvalid）
test("test_merge_invalid", async () => {
  // 準備・実行
  const page = await open("merge-invalid");
  // 検証
  const items = page.locator(".mdmark-syntax-warning li");
  await expect(items.count()).resolves.toBe(2);
  await expect(items.nth(0).innerText()).resolves.toContain("^^");
  await expect(items.nth(1).innerText()).resolves.toContain("<<");
  await expect(columnTexts(page, 0)).resolves.toEqual(["^^", "<<", "東日本"]);
  await expect(
    page.locator("#storybook-root tbody .is-merged").count(),
  ).resolves.toBe(0);
  const order = await page.evaluate(() => {
    const warning = document.querySelector(".mdmark-syntax-warning");
    const table = document.querySelector(".mdmark-table");
    return warning && table
      ? warning.compareDocumentPosition(table) &
          Node.DOCUMENT_POSITION_FOLLOWING
      : 0;
  });
  expect(order).toBeGreaterThan(0);
});

// CSV の表は、帯の右端に押していない RAW のボタンを配置し、元の CSV を隠す（CsvTable）
test("test_csv_table", async () => {
  // 準備・実行
  const page = await open("csv-table");
  // 検証
  const button = page.locator(".mdmark-raw-toggle");
  await expect(button.getAttribute("aria-label")).resolves.toBe(
    "元の CSV を表示",
  );
  await expect(button.getAttribute("aria-pressed")).resolves.toBe("false");
  const box = await button.boundingBox();
  const wrapper = await page.locator(".mdmark-table").boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(24);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeCloseTo(
    (wrapper?.x ?? 0) + (wrapper?.width ?? 0),
    0,
  );
  await expect(
    page
      .locator("pre.mdmark-raw")
      .evaluate((pre) => getComputedStyle(pre).visibility),
  ).resolves.toBe("hidden");
});

// RAW のボタンを押した状態は、表を隠して記載したとおりの CSV を出し、ボタンを青の面にする（CsvRaw）
test("test_csv_raw", async () => {
  // 準備・実行
  const page = await open("csv-raw");
  const plain = await open("csv-table");
  // 検証
  const read = (target: Page) =>
    target.locator(".mdmark-raw-toggle").evaluate((button) => ({
      pressed: button.getAttribute("aria-pressed"),
      background: getComputedStyle(button).backgroundColor,
    }));
  const pressed = await read(page);
  expect(pressed.pressed).toBe("true");
  expect(pressed.background).not.toBe((await read(plain)).background);
  await expect(
    page
      .locator(".mdmark-table table")
      .evaluate((t) => getComputedStyle(t).visibility),
  ).resolves.toBe("hidden");
  await expect(page.locator("pre.mdmark-raw").innerText()).resolves.toContain(
    '北山,"東京, 本社",1200',
  );
});

/** テーブル設定の一覧の項目の列名を、並んだ順に返却する */
function settingsNames(page: Page): Promise<string[]> {
  return page
    .locator(".mdmark-table-settings-item")
    .evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.name ?? ""),
    );
}

// `+reorder +columns` の表でパネルを開くと、各行につまみと目のアイコンがある（SettingsOpenReorder）
test("test_settings_open_reorder", async () => {
  // 準備・実行
  const page = await open("settings-open-reorder");
  // 検証
  const panel = page.locator(".mdmark-table-settings:not([hidden])");
  await expect(
    panel.locator(".mdmark-table-settings-title").innerText(),
  ).resolves.toBe("表示と並び順");
  await expect(settingsNames(page)).resolves.toEqual([
    "名前",
    "型",
    "既定",
    "説明",
  ]);
  await expect(
    panel.locator(".mdmark-table-settings-grip").count(),
  ).resolves.toBe(4);
  await expect(
    panel.locator(".mdmark-table-settings-eye").count(),
  ).resolves.toBe(4);
  await expect(
    panel
      .locator(".mdmark-table-settings-grip")
      .nth(0)
      .getAttribute("draggable"),
  ).resolves.toBe("true");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// `+reorder` だけの表のパネルはタイトルが `並び順` で、目のアイコンを出さない（SettingsReorderOnly）
test("test_settings_reorder_only", async () => {
  // 準備・実行
  const page = await open("settings-reorder-only");
  // 検証
  const panel = page.locator(".mdmark-table-settings:not([hidden])");
  await expect(
    panel.locator(".mdmark-table-settings-title").innerText(),
  ).resolves.toBe("並び順");
  await expect(
    panel.locator(".mdmark-table-settings-eye").count(),
  ).resolves.toBe(0);
  await expect(
    panel.locator(".mdmark-table-settings-grip").count(),
  ).resolves.toBe(4);
});

// 説明を名前の上へドラッグしている間、説明の行を薄くし、名前の上の境に線を出す（ReorderDragging）
test("test_reorder_dragging", async () => {
  // 準備・実行
  const page = await open("reorder-dragging");
  // 検証
  const item = (column: number) =>
    page.locator(`.mdmark-table-settings-item[data-column="${column}"]`);
  await expect(
    item(3).evaluate((el) => el.classList.contains("is-dragging")),
  ).resolves.toBe(true);
  await expect(
    item(0).evaluate((el) => el.classList.contains("is-drop-before")),
  ).resolves.toBe(true);
  const opacity = await item(3).evaluate((el) =>
    Number(getComputedStyle(el).opacity),
  );
  expect(opacity).toBeLessThan(1);
  await expect(
    item(0).evaluate((el) => getComputedStyle(el).boxShadow),
  ).resolves.toContain("inset");
  await expect(
    item(1).evaluate((el) => getComputedStyle(el).boxShadow),
  ).resolves.toBe("none");
});

// 説明・名前・既定・型の順に並べ、説明を隠し、ボタンにバッジ `1` を出す（Reordered）
test("test_reordered", async () => {
  // 準備・実行
  const page = await open("reordered");
  // 検証
  const order = await page
    .locator("#storybook-root tbody tr:first-child td")
    .evaluateAll((cells) =>
      cells.map((cell) => (cell as HTMLElement).dataset.label),
    );
  expect(order).toEqual(["説明", "名前", "既定", "型"]);
  await expect(settingsNames(page)).resolves.toEqual([
    "説明",
    "名前",
    "既定",
    "型",
  ]);
  expect((await hiddenCells(page, 0)).every(Boolean)).toBe(true);
  expect((await hiddenCells(page, 1)).some(Boolean)).toBe(false);
  await expect(
    page
      .locator(".mdmark-table-settings-toggle .mdmark-table-tool-badge")
      .innerText(),
  ).resolves.toBe("1");
});

// pinMode: through で、2 行の見出しで名前をピン止めした表のパネルを、ピン止めの列・設定の範囲・範囲の外の列に分ける（ReorderGroups）
test("test_reorder_groups", async () => {
  // 準備・実行
  const page = await open("reorder-groups");
  // 検証
  await expect(
    page.locator(".mdmark-table-settings-group").allInnerTexts(),
  ).resolves.toEqual(["ピン止めの列", "設定", "範囲の外の列"]);
  const grip = (column: number) =>
    page.locator(
      `.mdmark-table-settings-item[data-column="${column}"] .mdmark-table-settings-grip`,
    );
  await expect(grip(0).isDisabled()).resolves.toBe(true);
  await expect(grip(4).isDisabled()).resolves.toBe(true);
  await expect(grip(1).isDisabled()).resolves.toBe(false);
  await expect(pinnedColumns(page)).resolves.toEqual([0]);
});

/** 階層の表の行の `data-path` を、表示しているものだけ上から並べて返却する */
function shownTreePaths(page: Page): Promise<string[]> {
  return page
    .locator("#storybook-root tr.mdmark-tree-row")
    .evaluateAll((rows) =>
      rows
        .filter((row) => !(row as HTMLElement).hidden)
        .map((row) => (row as HTMLElement).dataset.path ?? ""),
    );
}

// 表に無い親を薄い斜体で補い、型のバッジとチップ・必須の *・既定を出す（Tree）
test("test_tree", async () => {
  // 準備・実行
  const page = await open("tree");
  // 検証
  await expect(shownTreePaths(page)).resolves.toEqual([
    "features",
    "features.table",
    "features.html",
    "aliases[]",
    "aliases[].id",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ]);
  const virtual = page.locator(
    'tr.mdmark-tree-row.is-virtual[data-path="features"] .mdmark-tree-name',
  );
  await expect(
    virtual.evaluate((el) => getComputedStyle(el).fontStyle),
  ).resolves.toBe("italic");
  const real = page.locator(
    'tr.mdmark-tree-row[data-path="features.table"] .mdmark-tree-name',
  );
  await expect(
    real.evaluate((el) => getComputedStyle(el).fontStyle),
  ).resolves.toBe("normal");
  await expect(
    page.locator('.mdmark-type-badge[data-type="bool"]').count(),
  ).resolves.toBe(2);
  await expect(page.locator(".mdmark-type-chip").count()).resolves.toBe(2);
  await expect(page.locator(".mdmark-tree-required").count()).resolves.toBe(1);
  await expect(page.locator(".mdmark-tree-default").innerText()).resolves.toBe(
    "true",
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// aliases[] を畳むと、ボタンが閉じた向きになり子孫を隠す（TreeFolded）
test("test_tree_folded", async () => {
  // 準備・実行
  const page = await open("tree-folded");
  // 検証
  await expect(shownTreePaths(page)).resolves.toEqual([
    "features",
    "features.table",
    "features.html",
    "aliases[]",
  ]);
  await expect(
    page
      .locator('tr[data-path="aliases[]"] button.mdmark-tree-toggle')
      .getAttribute("aria-expanded"),
  ).resolves.toBe("false");
});

// キーの列を id で絞り込むと、aliases[] と aliases[].id だけを出し、id に色を付ける（TreeFiltered）
test("test_tree_filtered", async () => {
  // 準備・実行
  const page = await open("tree-filtered");
  // 検証
  await expect(shownTreePaths(page)).resolves.toEqual([
    "aliases[]",
    "aliases[].id",
  ]);
  const hit = page.locator("mark.mdmark-tree-hit");
  await expect(hit.innerText()).resolves.toBe("id");
  const color = await hit.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(color).not.toBe("rgba(0, 0, 0, 0)");
});

// features.html の行を選ぶと、同じ親の範囲の縦線を濃くする（TreeSelected）
test("test_tree_selected", async () => {
  // 準備・実行
  const page = await open("tree-selected");
  // 検証
  await expect(
    page.locator('tr[data-path="features.html"]').getAttribute("aria-selected"),
  ).resolves.toBe("true");
  const active = await page
    .locator("tr.mdmark-tree-row")
    .evaluateAll((rows) =>
      rows
        .filter((row) =>
          row
            .querySelector(".mdmark-tree-guide")
            ?.classList.contains("is-active"),
        )
        .map((row) => (row as HTMLElement).dataset.path),
    );
  expect(active).toEqual(["features.table", "features.html"]);
  const [activeColor, otherColor] = await page.evaluate(() =>
    [
      ".mdmark-tree-guide.is-active",
      'tr[data-path="aliases[].id"] .mdmark-tree-guide',
    ].map((selector) => {
      const guide = document.querySelector(selector);
      return guide ? getComputedStyle(guide).borderLeftColor : "";
    }),
  );
  expect(activeColor).not.toBe("");
  expect(activeColor).not.toBe(otherColor);
});

// 見本を結んだ表で選んだパスの行に、開いているタブの見本で色を付ける（TreeExample）
test("test_tree_example", async () => {
  // 準備・実行
  const page = await open("tree-example");
  // 検証
  const linked = page.locator(
    '.mdmark-tree-example [role="tabpanel"]:not([hidden]) .mdmark-yaml-line.is-linked',
  );
  await expect(linked.count()).resolves.toBe(1);
  await expect(linked.getAttribute("data-path")).resolves.toBe(
    "aliases[].metadata.alias_type.type",
  );
  await expect(
    page
      .locator('.mdmark-tree-example [role="tab"][aria-selected="true"]')
      .innerText(),
  ).resolves.toContain("エイリアス");
});

// 選んだキーが開いているタブの見本に無いときは、見本に色を付けない（TreeExampleMissing）
test("test_tree_example_missing", async () => {
  // 準備・実行
  const page = await open("tree-example-missing");
  // 検証
  await expect(
    page.locator(".mdmark-tree-example .mdmark-yaml-line.is-linked").count(),
  ).resolves.toBe(0);
  await expect(
    page
      .locator('.mdmark-tree-example [role="tab"][aria-selected="true"]')
      .innerText(),
  ).resolves.toContain("最小");
});

// 見本を隠すと、ボタンの文言が `見本を表示` で `aria-expanded="false"`（TreeExampleHidden）
test("test_tree_example_hidden", async () => {
  // 準備・実行
  const page = await open("tree-example-hidden");
  // 検証
  const toggle = page.locator("button.mdmark-tree-example-toggle");
  await expect(toggle.innerText()).resolves.toContain("見本を表示");
  await expect(toggle.getAttribute("aria-expanded")).resolves.toBe("false");
  await expect(page.locator(".mdmark-tree-example").isVisible()).resolves.toBe(
    false,
  );
});

/** 帯のボタンの見えている文字（スクリーンリーダー向けの文字を除く）と、幅・高さ */
function toolBoxes(page: Page) {
  return page
    .locator("#storybook-root .mdmark-table-tools > button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const copy = button.cloneNode(true) as HTMLElement;
        for (const hidden of copy.querySelectorAll(
          ".mdmark-visually-hidden, .mdmark-table-tool-badge",
        )) {
          hidden.remove();
        }
        const rect = button.getBoundingClientRect();
        return {
          text: (copy.textContent ?? "").trim(),
          width: rect.width,
          height: rect.height,
          title: button.getAttribute("title"),
          name: button.getAttribute("aria-label") ?? button.textContent ?? "",
        };
      }),
    );
}

// 帯は、テーブル設定とコピーのボタンがアイコンだけで、テーブル設定に隠した列の数のバッジを持つ（ColumnsButtonA）
test("test_columns_button_a", async () => {
  // 準備・実行
  const page = await open("columns-button-a");
  // 検証
  const tools = await toolBoxes(page);
  expect(tools).toHaveLength(2);
  for (const button of tools) {
    expect(button.text).toBe("");
    expect(Math.abs(button.width - button.height)).toBeLessThanOrEqual(1);
  }
  expect(tools[0]?.title).toBe("テーブル設定");
  expect(tools[0]?.name).toBe("テーブル設定（1 列を非表示）");
  await expect(
    page
      .locator(".mdmark-table-settings-toggle .mdmark-table-tool-badge")
      .innerText(),
  ).resolves.toBe("1");
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 表の列ごとの見出しのセルとつまみの状態を返却する */
function resizeHandles(page: Page): Promise<
  Array<{
    label: string | null;
    role: string | null;
    cursor: string;
    lineOpacity: number;
    dragging: boolean;
    resized: boolean;
    width: number;
  }>
> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("#storybook-root thead th")].map(
      (head) => {
        const handle = head.querySelector<HTMLElement>(
          ":scope > .mdmark-col-resize",
        );
        return {
          label: handle?.getAttribute("aria-label") ?? null,
          role: handle?.getAttribute("role") ?? null,
          cursor: handle ? getComputedStyle(handle).cursor : "",
          lineOpacity: handle
            ? Number(getComputedStyle(handle, "::after").opacity)
            : -1,
          dragging: handle?.classList.contains("is-dragging") ?? false,
          resized: head.classList.contains("is-resized"),
          width: head.getBoundingClientRect().width,
        };
      },
    ),
  );
}

// resize の表の最下段の各列の見出しの右端に、線を出していないつまみがある（Resizable）
test("test_resizable", async () => {
  // 準備・実行
  const page = await open("resizable");
  // 検証
  const handles = await resizeHandles(page);
  expect(handles.map((handle) => handle.label)).toEqual([
    "「名前」の列の幅",
    "「説明」の列の幅",
    "「更新日」の列の幅",
  ]);
  for (const handle of handles) {
    expect(handle.role).toBe("separator");
    expect(handle.cursor).toBe("col-resize");
    expect(handle.lineOpacity).toBe(0);
  }
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// ドラッグしている列のつまみだけが線を出したままにする（ResizeDragging）
test("test_resize_dragging", async () => {
  // 準備・実行
  const page = await open("resize-dragging");
  // 検証
  const handles = await resizeHandles(page);
  expect(handles.map((handle) => handle.dragging)).toEqual([
    true,
    false,
    false,
  ]);
  expect(handles[0]?.lineOpacity).toBe(1);
  expect(handles[1]?.lineOpacity).toBe(0);
});

// 名前の列だけが指定した幅を持つ（ColumnResized）
test("test_column_resized", async () => {
  // 準備・実行
  const page = await open("column-resized");
  // 検証
  const handles = await resizeHandles(page);
  expect(handles.map((handle) => handle.resized)).toEqual([true, false, false]);
  expect(handles[0]?.width).toBeGreaterThanOrEqual(200);
});

// 幅を指定した wide= の列は折り返す（WideResized）
test("test_wide_resized", async () => {
  // 準備・実行
  const page = await open("wide-resized");
  // 検証
  const cells = await page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "#storybook-root tbody td:nth-child(2)",
      ),
    ].map((cell) => ({
      classes: [...cell.classList],
      whiteSpace: getComputedStyle(cell).whiteSpace,
      lines: Math.round(
        cell.getBoundingClientRect().height /
          Number.parseFloat(getComputedStyle(cell).lineHeight),
      ),
    })),
  );
  expect(cells[0]?.classes).toEqual(
    expect.arrayContaining(["mdmark-wide", "is-resized"]),
  );
  expect(cells[0]?.whiteSpace).not.toBe("nowrap");
  expect(cells[0]?.lines).toBeGreaterThan(1);
});
