import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  countColorPixels,
  createBrowserHolder,
  pageOverflows,
  resolveColor,
} from "../story.ts";

const holder = createBrowserHolder();

beforeAll(holder.launch);
afterAll(holder.close);

/** 表のストーリーを開く */
function open(id: string): Promise<Page> {
  return holder.openStory(`parts-table--${id}`);
}

/** 表の本文の行の指定した列の文字を、上から並べて返す（隠れた行も含む） */
function columnTexts(page: Page, column: number): Promise<string[]> {
  return page.evaluate((index) => {
    return [
      ...document.querySelectorAll(
        "#storybook-root tbody tr:not(.mdmark-table-empty):not(.mdmark-row-detail)",
      ),
    ].map((row) => row.querySelectorAll("td")[index]?.textContent ?? "");
  }, column);
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

/** 表の外側の枠の色を返す */
function frameColor(page: Page): Promise<string> {
  return page
    .locator(".mdmark-table table")
    .evaluate((el) => getComputedStyle(el).borderTopColor);
}

/** 表の右端から 10px 内側（右の角の丸みと、右端のセルの文字の間）の x と、表の下端の y を返す */
function tableBottom(page: Page): Promise<{ x: number; y: number }> {
  return page.locator(".mdmark-table table").evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      x: Math.floor(rect.right + window.scrollX) - 10,
      y: Math.floor(rect.bottom + window.scrollY),
    };
  });
}

/** 表の下端の線の太さ（枠の色の画素の数）を返す。見えている最後の行の下の線と重なって 2px になっていないかを見る */
async function bottomLineWidth(page: Page): Promise<number> {
  const { x, y } = await tableBottom(page);
  return countColorPixels({
    page,
    clip: { x, y: y - 5, width: 1, height: 7 },
    color: await frameColor(page),
  });
}

/** 集計の行の上の線の太さ（枠の色の画素の数）を返す */
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

/** 指定した行（見出し・本文・集計）の高さの真ん中で、表の右端の線の太さ（枠の色の画素の数）を返す */
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

/** 見出し行・本文の行・集計の行の右端の線の太さを、上から並べて返す */
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
  ).resolves.toBe("絞り込みを外す");
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

// 名前の列を絞り込むと、ボタンが絞り込み中の見た目になる（Filtered）
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
    .locator(".mdmark-table table")
    .evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(scrolls).toBe(true);
});

// 2 列目までピン止めすると、留めた最後の列の右に境目の線がある（Pinned）
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

// plain の種類は、機能を付けず、縦の罫線と面を外す（Plain）
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

/** 表の本文の行の隠れた列を含む、指定した列のセルが `hidden` かを上から並べて返す */
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

/** 集計の行ごとに、セルの文字を空白を除いて左から並べて返す */
function totalRows(page: Page): Promise<string[][]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("#storybook-root tfoot tr")].map((row) =>
      [...row.querySelectorAll("td")].map((cell) =>
        (cell.textContent ?? "").replace(/\s+/g, ""),
      ),
    ),
  );
}

/** 件数の要素の、画面に出る文字を返す（読み上げだけの文字は含めない） */
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

// hide= の列を隠し、帯に列の表示のボタンを出す（ColumnsHidden）
test("test_columns_hidden", async () => {
  // 準備・実行
  const page = await open("columns-hidden");
  // 検証
  await expect(
    page.locator(".mdmark-columns-toggle").innerText(),
  ).resolves.toContain("列の表示");
  await expect(
    page.locator(".mdmark-columns-menu:not([hidden])").count(),
  ).resolves.toBe(0);
  const hidden = await hiddenCells(page, 1);
  expect(hidden.every(Boolean)).toBe(true);
  expect((await hiddenCells(page, 0)).some(Boolean)).toBe(false);
});

// 列の表示のメニューを開くと、先頭の列は外せず理由が出る（ColumnsMenuOpen）
test("test_columns_menu_open", async () => {
  // 準備・実行
  const page = await open("columns-menu-open");
  // 検証
  const menu = page.locator(".mdmark-columns-menu:not([hidden])");
  await expect(menu.count()).resolves.toBe(1);
  const boxes = menu.locator("input[type='checkbox']");
  await expect(boxes.count()).resolves.toBe(3);
  await expect(boxes.nth(0).isDisabled()).resolves.toBe(true);
  await expect(boxes.nth(1).isChecked()).resolves.toBe(true);
  await expect(boxes.nth(2).isChecked()).resolves.toBe(false);
  await expect(menu.innerText()).resolves.toContain("先頭の列は隠せません");
  await expect(menu.innerText()).resolves.toContain("既定に戻す");
  await expect(
    page.locator(".mdmark-columns-toggle").getAttribute("aria-expanded"),
  ).resolves.toBe("true");
  // 最後の列を隠していても、表の右端は外側の枠の 1px だけ（表に重なるメニューは隠して測る）
  await page.addStyleTag({
    content: ".mdmark-columns-menu { display: none; }",
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

// コピーしたことを知らせる（Copied）
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

// コピーできなかったことを知らせる（CopyFailed）
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
  await expect(page.locator(".mdmark-columns-toggle").count()).resolves.toBe(1);
  await expect(page.locator(".mdmark-copy").count()).resolves.toBe(1);
  await expect(totalRows(page)).resolves.toEqual([["合計", "", "25"]]);
  expect((await hiddenCells(page, 1)).every(Boolean)).toBe(true);
  await expect(page.locator(".mdmark-row-anchor").count()).resolves.toBe(3);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 数として読めないセルを持つ列は、合計の行のセルを空にし、平均の行のセルは読めた値で出す（TotalsUnreadable）
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
  await expect(menu.getAttribute("aria-label")).resolves.toBe("出す集計");
  await expect(menu.innerText()).resolves.toContain("出す集計");
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

// 平均と件数のチェックを外すと、合計の行だけを出し、集計のボタンが隠していることを示す（TotalsHidden）
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
  ).resolves.toBe("（2 件を隠しています）");
});

// コピーの形式のメニューを開くと、Markdown の表と TSV の 2 つを使いどころと並べて出す（CopyMenuOpen）
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

// クリップボードに書けないときは、手でコピーするパネルを帯の直後に出し、中身を読み取り専用で並べる（CopyFallback）
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
      "| みかん | 印刷を直す | 2026-10-10 |",
    ].join("\n"),
  );
  await expect(pageOverflows(page)).resolves.toBe(false);
});

/** 行へのリンクの知らせの、行の ID・状態・文字・画面に出ているかを返す */
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

// 2 行目の行へのリンクの URL をコピーすると、印の横に「リンクをコピーしました」を出す（RowLinkCopied）
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

// 2 行目の行へのリンクの URL をコピーできないと、印の横に「リンクをコピーできませんでした」を出す（RowLinkFailed）
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

/** 畳んだ表の最終列の見出しとセルが画面に出ているかを、見出し・本文の行の順に返す */
function lastColumnShown(page: Page): Promise<boolean[]> {
  return page.evaluate(() => {
    const cells = [
      document.querySelector("#storybook-root thead th:last-child"),
      ...[
        ...document.querySelectorAll(
          "#storybook-root tbody tr:not(.mdmark-fold-detail):not(.mdmark-table-empty)",
        ),
      ].map((row) => row.querySelector("td:last-child")),
    ];
    return cells.map((cell) => (cell?.getClientRects().length ?? 0) > 0);
  });
}

// 最終列を畳むと、説明の列を出さず、各行の先頭のセルに開閉のボタンが付く（Folded）
test("test_folded", async () => {
  // 準備・実行
  const page = await open("folded");
  // 検証
  await expect(
    page
      .locator(".mdmark-table")
      .evaluate((el) => el.classList.contains("is-folded")),
  ).resolves.toBe(true);
  await expect(lastColumnShown(page)).resolves.toEqual([false, false, false]);
  const toggles = page.locator("button.mdmark-fold-toggle");
  await expect(toggles.count()).resolves.toBe(2);
  await expect(
    toggles.evaluateAll((buttons) =>
      buttons.map((button) => ({
        expanded: button.getAttribute("aria-expanded"),
        label: button.getAttribute("aria-label"),
        inFirstCell:
          button.closest("td") === button.closest("tr")?.querySelector("td"),
      })),
    ),
  ).resolves.toEqual([
    { expanded: "false", label: "「りんご」の説明", inFirstCell: true },
    { expanded: "false", label: "「みかん」の説明", inFirstCell: true },
  ]);
  await expect(
    page.locator("tr.mdmark-fold-detail:visible").count(),
  ).resolves.toBe(0);
  await expect(pageOverflows(page)).resolves.toBe(false);
});

// 最終列を畳み、1 行目を開くと、行の直後に説明の見出しと中身を出す（FoldedOpen）
test("test_folded_open", async () => {
  // 準備・実行
  const page = await open("folded-open");
  // 検証
  const toggles = page.locator("button.mdmark-fold-toggle");
  await expect(
    toggles.evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-expanded")),
    ),
  ).resolves.toEqual(["true", "false"]);
  const detail = page.locator("tr.mdmark-fold-detail:visible");
  await expect(detail.count()).resolves.toBe(1);
  await expect(
    detail.evaluate(
      (el) => el.previousElementSibling?.querySelector("td")?.textContent,
    ),
  ).resolves.toContain("りんご");
  await expect(detail.locator(".mdmark-fold-name").innerText()).resolves.toBe(
    "説明",
  );
  await expect(
    detail.locator(".mdmark-fold-value").innerText(),
  ).resolves.toContain("見出しの ID を作る処理を 1 回にまとめる");
  await expect(pageOverflows(page)).resolves.toBe(false);
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
