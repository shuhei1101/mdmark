import type { Page } from "playwright";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createBrowserHolder, pageOverflows } from "../story.ts";

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
