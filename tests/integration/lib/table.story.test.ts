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
    page.locator("tr.mdmark-table-empty").evaluate((el) => el.hidden),
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

// 幅からはみ出す既定の種類の表は、各列にピン止めのボタンが出て、見出し行が上端に留まる（DefaultOverflow）
test("test_default_overflow", async () => {
  // 準備・実行
  const page = await open("default-overflow");
  // 検証
  await expect(page.locator("button.mdmark-pin:visible").count()).resolves.toBe(
    10,
  );
  const sticky = await page
    .locator("#storybook-root thead th")
    .first()
    .evaluate((el) => getComputedStyle(el).position);
  expect(sticky).toBe("sticky");
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

// 閉じた表は、「表を開く」だけが見える（Closed）
test("test_closed", async () => {
  // 準備・実行
  const page = await open("closed");
  // 検証
  const details = page.locator("details.mdmark-table-details");
  await expect(
    details.evaluate((el) => (el as HTMLDetailsElement).open),
  ).resolves.toBe(false);
  await expect(details.locator("summary").innerText()).resolves.toBe(
    "表を開く",
  );
  await expect(details.locator("table").isVisible()).resolves.toBe(false);
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

/** 集計の行のセルの文字を、空白を除いて左から並べて返す */
function totalTexts(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll("#storybook-root tfoot td")].map((cell) =>
      (cell.textContent ?? "").replace(/\s+/g, ""),
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
  // 準備・実行
  const page = await open("totals");
  // 検証
  await expect(totalTexts(page)).resolves.toEqual([
    "個数4",
    "合計45",
    "平均250",
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
  await expect(totalTexts(page)).resolves.toEqual([
    "個数2",
    "合計43",
    "平均200",
  ]);
});

// 一致する行が無い集計の行を出す（TotalsEmpty）
test("test_totals_empty", async () => {
  // 準備・実行
  const page = await open("totals-empty");
  // 検証
  await expect(totalTexts(page)).resolves.toEqual(["個数0", "合計0", "平均—"]);
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
  await expect(page.locator(".mdmark-copy-status").innerText()).resolves.toBe(
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
  await expect(totalTexts(page)).resolves.toEqual(["", "", "合計25"]);
  expect((await hiddenCells(page, 1)).every(Boolean)).toBe(true);
  await expect(page.locator(".mdmark-row-anchor").count()).resolves.toBe(3);
  await expect(pageOverflows(page)).resolves.toBe(false);
});
