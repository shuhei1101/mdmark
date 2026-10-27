import { expect, type Page, test } from "@playwright/test";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  removeDistRoot,
} from "../dist-page.ts";

// ビルドした配布物を置いた作業ツリー
let builtRoot = "";

// 描く先の要素を狭くして、列の多い表が横にはみ出すようにする使う側の CSS
const NARROW_HOST_CSS = "#doc { width: 480px; }";

test.beforeAll(async () => {
  builtRoot = await buildDistRoot();
});

test.afterAll(async () => {
  await removeDistRoot(builtRoot);
});

/** 10 列 30 行の表の Markdown。描く先の要素からはみ出す大きさ */
function wideTable(): string {
  const headers = Array.from({ length: 10 }, (_, i) => `列${i + 1}`);
  const rows = Array.from(
    { length: 30 },
    (_, row) =>
      `| ${headers.map((_header, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
  );
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
  ].join("\n");
}

/** 隠れていない本文の行の、指定した列（1 から）の文字を上から並べて返す */
function visibleColumn(page: Page, column: number): Promise<string[]> {
  return page
    .locator(`#doc tbody tr:not([hidden]) td:nth-child(${column})`)
    .allTextContents();
}

/** 見出しの文字で列の `th` を引く */
function head(page: Page, name: string) {
  return page.locator("#doc th", { hasText: name });
}

// 数値の列の見出しを押すたびに、昇順・降順・元の並びで並べ替える（正常シナリオ）
test("test_normal", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<!-- table: data -->\n\n| 名前 | 数 |\n| --- | ---: |\n| a | 10 |\n| b | 2 |\n| c | 33 |\n\n<!-- /table -->\n",
  });
  const sort = head(page, "数").locator("button.mdmark-sort");
  // 実行・検証
  await sort.click();
  await expect(head(page, "数")).toHaveAttribute("aria-sort", "ascending");
  expect(await visibleColumn(page, 2)).toEqual(["2", "10", "33"]);
  await sort.click();
  await expect(head(page, "数")).toHaveAttribute("aria-sort", "descending");
  expect(await visibleColumn(page, 2)).toEqual(["33", "10", "2"]);
  await sort.click();
  expect(await visibleColumn(page, 2)).toEqual(["10", "2", "33"]);
  // 元の並びでは `aria-sort` を持たない（持たないことが `none`）
  expect(await head(page, "数").getAttribute("aria-sort")).toBeNull();
  const html = await page.locator("#doc").innerHTML();
  expect(html).not.toContain("<!--");
  await expect(page.locator("#doc")).not.toContainText("table:");
});

// 列の値をチェックボックスで選び、候補を検索して絞り込み、絞り込みを外す（正常シナリオ（列の値を選んで絞り込む））
test("test_normal_when_filtered_by_values", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<!-- table: data filter=名前 -->\n\n| 名前 | 数 |\n| --- | --- |\n| りんご | 1 |\n| みかん | 2 |\n| りんご飴 | 3 |\n\n<!-- /table -->\n",
  });
  const filters = page.locator("#doc button.mdmark-filter");
  await expect(filters).toHaveCount(1);
  await expect(head(page, "名前").locator("button.mdmark-filter")).toHaveCount(
    1,
  );
  await expect(head(page, "数").locator("button.mdmark-filter")).toHaveCount(0);
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  const search = drawer.locator("input.mdmark-filter-search");
  const options = drawer.locator(".mdmark-filter-options li:not([hidden])");
  const status = filters.locator(".mdmark-visually-hidden");
  // 実行・検証: ボタンを押す
  await filters.click();
  await expect(drawer).toBeVisible();
  await expect(search).toBeFocused();
  await expect(options).toHaveText(["りんご", "みかん", "りんご飴"]);
  // 実行・検証: 候補を検索する
  await search.fill("りんご");
  await expect(options).toHaveText(["りんご", "りんご飴"]);
  // 実行・検証: りんごを選ぶ
  await drawer.getByLabel("りんご", { exact: true }).check();
  expect(await visibleColumn(page, 1)).toEqual(["りんご"]);
  await expect(status).toHaveText("（絞り込み中）");
  // 実行・検証: チェックボックスを全て外す
  await drawer.getByLabel("りんご", { exact: true }).uncheck();
  expect(await visibleColumn(page, 1)).toEqual([
    "りんご",
    "みかん",
    "りんご飴",
  ]);
  // 実行・検証: 選び直して絞り込みを外す
  await drawer.getByLabel("りんご", { exact: true }).check();
  await drawer.getByRole("button", { name: "絞り込みを外す" }).click();
  await expect(search).toHaveValue("");
  await expect(drawer.locator('input[type="checkbox"]:checked')).toHaveCount(0);
  expect(await visibleColumn(page, 1)).toEqual([
    "りんご",
    "みかん",
    "りんご飴",
  ]);
  await expect(status).toHaveText("");
});

// 説明の列の見出しのボタンから文字の入力欄を出し、含む行だけにする（正常シナリオ（文字で絞り込む））
test("test_normal_when_filtered_by_text", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<!-- table: data filter=説明:text -->\n\n| 説明 |\n| --- |\n| 描画を速くする |\n| 印刷を直す |\n| 描画の崩れを直す |\n\n<!-- /table -->\n",
  });
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  // 実行
  await head(page, "説明").locator("button.mdmark-filter").click();
  // 検証: 文字の入力欄が出る
  await expect(drawer.locator('input[type="checkbox"]')).toHaveCount(0);
  await drawer.locator('input[type="text"]').fill("描画");
  expect(await visibleColumn(page, 1)).toEqual([
    "描画を速くする",
    "描画の崩れを直す",
  ]);
  await expect(page.locator("#doc td", { hasText: "印刷を直す" })).toBeHidden();
});

// 更新日の列の見出しのボタンから開始日と終了日の入力欄を出し、期間に入る行だけにする（正常シナリオ（日付で絞り込む））
test("test_normal_when_filtered_by_date", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<!-- table: data filter=更新日:date -->\n\n| 更新日 |\n| --- |\n| 2026-10-01 |\n| 2026-10-10 |\n| 2026-10-20 |\n\n<!-- /table -->\n",
  });
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  const from = drawer.getByLabel("開始日");
  const to = drawer.getByLabel("終了日");
  // 実行
  await head(page, "更新日").locator("button.mdmark-filter").click();
  // 検証: 開始日と終了日の日付の入力欄が出る
  await expect(drawer.locator('input[type="date"]')).toHaveCount(2);
  await from.fill("2026-10-05");
  await to.fill("2026-10-15");
  expect(await visibleColumn(page, 1)).toEqual(["2026-10-10"]);
  // 検証: 開始日だけを入れる
  await to.fill("");
  expect(await visibleColumn(page, 1)).toEqual(["2026-10-10", "2026-10-20"]);
});

// 既定の種類の表は、押した列までを左端に留める（正常シナリオ（ピン止めする））
test("test_normal_when_pinned", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  await mountDocument(page, { markdown: wideTable() });
  const table = page.locator("#doc table");
  const pins = page.locator("#doc button.mdmark-pin:not([hidden])");
  await expect(pins).toHaveCount(10);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(0);
  /** 表の枠の左端に対する、指定した要素の左端の位置 */
  const offset = async (selector: string) => {
    const box = await table.boundingBox();
    const target = await page.locator(selector).first().boundingBox();
    if (!box || !target) {
      throw new Error("要素の位置を取れない");
    }
    return target.x - box.x;
  };
  // 実行・検証: 2 列目のピン止めを押して横にスクロールする
  await pins.nth(1).click();
  await expect(pins.nth(1)).toHaveAttribute("aria-pressed", "true");
  await table.evaluate((el) => {
    el.scrollLeft = 600;
  });
  expect(await offset("#doc thead th:nth-child(1)")).toBeLessThan(8);
  const second = await offset("#doc thead th:nth-child(2)");
  expect(second).toBeGreaterThan(0);
  expect(second).toBeLessThan(200);
});

// 閉じた表は折り畳みの見出しを押すと開く（正常シナリオ（閉じた表））
test("test_normal_when_closed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown:
      "<!-- table: data closed -->\n\n| 名前 | 数 |\n| --- | --- |\n| a | 1 |\n| b | 2 |\n| c | 3 |\n\n<!-- /table -->\n",
  });
  const rows = page.locator("#doc tbody tr");
  // 検証: 描いた直後
  await expect(
    page.locator("#doc details.mdmark-table-details"),
  ).not.toHaveAttribute("open", "");
  await expect(rows.first()).toBeHidden();
  // 実行
  await page.locator("#doc details.mdmark-table-details > summary").click();
  // 検証
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toBeVisible();
  await expect(rows.last()).toBeVisible();
});

// 印で並べ替えを外した表は、並べ替えのボタンが無く、ピン止めのボタンがある（正常シナリオ（機能を外す））
test("test_normal_when_feature_removed", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `<!-- table: data -sort -->\n\n${wideTable()}\n<!-- /table -->\n`,
  });
  // 検証
  await expect(
    page.locator("#doc button.mdmark-pin:not([hidden])"),
  ).toHaveCount(10);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(0);
});

// 知らない種類は既定の種類に読み替え、書き方の警告を出して +sort を当てる（異常シナリオ（知らない種類））
test("test_error_when_unknown_kind", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `<!-- table: unknown +sort -->\n\n${wideTable()}\n<!-- /table -->\n\n表の後の段落\n`,
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("unknown");
  await expect(warning).toContainText("data");
  await expect(warning).toContainText("plain");
  await expect(
    page.locator("#doc button.mdmark-pin:not([hidden])"),
  ).toHaveCount(10);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(10);
  await expect(page.locator("#doc > p")).toHaveText("表の後の段落");
});

// 閉じの印が無いと、印から文書の終わりまでを範囲にして、2 つの表に機能を付ける（異常シナリオ（閉じの印が無い））
test("test_error_when_range_end_missing", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      "<!-- table: data -->\n\n| a |\n| --- |\n| 1 |\n\n| b |\n| --- |\n| 2 |\n",
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toContainText(
    "<!-- /table -->",
  );
  await expect(page.locator("#doc table")).toHaveCount(2);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(2);
});

// 知らない機能とキーは当てず、使えるものを並べた書き方の警告を出す（異常シナリオ（知らない機能・キー））
test("test_error_when_unknown_feature_or_key", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `<!-- table: data +unknown size=2 -->\n\n${wideTable()}\n<!-- /table -->\n`,
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("+unknown");
  await expect(warning).toContainText("size=");
  await expect(warning).toContainText("sort");
  await expect(warning).toContainText("filter=");
  await expect(
    page.locator("#doc button.mdmark-pin:not([hidden])"),
  ).toHaveCount(10);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(10);
});

// 知らない絞り込みの種類は当てず、読める列だけに絞り込みのボタンを付ける（異常シナリオ（知らない絞り込みの種類））
test("test_error_when_unknown_filter_kind", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown:
      "<!-- table: data filter=名前:range,説明:text -->\n\n| 名前 | 説明 |\n| --- | --- |\n| a | b |\n\n<!-- /table -->\n",
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("range");
  for (const kind of ["select", "text", "date"]) {
    await expect(warning).toContainText(kind);
  }
  await expect(head(page, "説明").locator("button.mdmark-filter")).toHaveCount(
    1,
  );
  await expect(head(page, "名前").locator("button.mdmark-filter")).toHaveCount(
    0,
  );
});

/** 名前・説明・更新日の 3 行の表を、印の引数で囲んだ Markdown */
function fruitTable(mark: string): string {
  return [
    `<!-- table: ${mark} -->`,
    "",
    "| 名前 | 説明 | 更新日 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 2026-10-01 |",
    "| みかん | 印刷を直す | 2026-10-10 |",
    "| りんご飴 | 描画の崩れを直す | 2026-10-20 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 表の列の見出しのボタンから文字の入力欄を出し、文字を入れる */
async function filterByText(
  page: Page,
  column: string,
  text: string,
): Promise<void> {
  const button = head(page, column).locator("button.mdmark-filter");
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  if (!(await drawer.first().isVisible())) {
    await button.click();
  }
  await drawer.locator('input[type="text"]').fill(text);
}

/** 出ている集計の行ごとに、セルの文字を空白を除いて左から並べて返す */
async function totalRows(page: Page): Promise<string[][]> {
  return await page
    .locator("#doc tfoot tr:not([hidden])")
    .evaluateAll((rows) =>
      rows.map((row) =>
        [...row.querySelectorAll("td")].map((cell) =>
          (cell.textContent ?? "").replace(/\s+/g, ""),
        ),
      ),
    );
}

/** 4 列 4 行の集計の行を持つ表の Markdown（数量は空のセルを含み、産地は `青森`・`愛媛`・`青森`・空） */
const TOTALS_MARKDOWN = [
  "<!-- table: data +total total=数量:sum,単価:avg,産地:count filter=名前:text -->",
  "",
  "| 名前 | 数量 | 単価 | 産地 |",
  "| --- | --- | --- | --- |",
  "| りんご | 10 | 100 | 青森 |",
  "| みかん | 2 | 200 | 愛媛 |",
  "| りんご飴 | 33 | 300 | 青森 |",
  "| ぶどう |  | 400 |  |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 表の上の件数が、絞り込みで行が減ると書き換わり、外すと戻る（正常シナリオ（件数を見る））
test("test_normal_when_counting_rows", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: fruitTable("data +count filter=説明:text"),
  });
  const count = page.locator("#doc .mdmark-table-count");
  // 検証: 描いた直後
  await expect(count).toContainText("3 / 3 件");
  await expect(count).toHaveAttribute("aria-live", "polite");
  // 実行・検証: 「描画」で絞り込む
  await filterByText(page, "説明", "描画");
  await expect(count).toContainText("2 / 3 件");
  await expect(count).toContainText("3 件中 2 件を表示");
  // 実行・検証: 絞り込みを外す
  await page
    .locator("#doc .mdmark-filter-drawer")
    .getByRole("button", { name: "絞り込みを外す" })
    .click();
  await expect(count).toContainText("3 / 3 件");
});

// 列の表示のメニューで列を隠し・出し、既定に戻し、Esc で閉じる（正常シナリオ（列を隠す・出す））
test("test_normal_when_columns_toggled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: fruitTable("data +columns hide=説明"),
  });
  const toggle = page.getByRole("button", { name: "列の表示" });
  const menu = page.locator("#doc .mdmark-columns-menu");
  const boxes = menu.locator('input[type="checkbox"]');
  // 検証: 描いた直後は説明の列だけが隠れている
  await expect(head(page, "説明")).toBeHidden();
  await expect(head(page, "名前")).toBeVisible();
  await expect(head(page, "更新日")).toBeVisible();
  // 実行・検証: メニューを開く
  await toggle.click();
  await expect(menu).toBeVisible();
  await expect(boxes).toHaveCount(3);
  await expect(boxes.nth(1)).not.toBeChecked();
  await expect(boxes.nth(0)).toBeDisabled();
  await expect(menu).toContainText("先頭の列は隠せません");
  // 実行・検証: 説明を入れ、更新日を外す
  await boxes.nth(1).check();
  await boxes.nth(2).uncheck();
  await expect(head(page, "説明")).toBeVisible();
  await expect(head(page, "更新日")).toBeHidden();
  const order = await page.locator("#doc thead th").allTextContents();
  expect(order[0]).toContain("名前");
  expect(order[1]).toContain("説明");
  // 実行・検証: 既定に戻す
  await menu.getByRole("button", { name: "既定に戻す" }).click();
  await expect(head(page, "説明")).toBeHidden();
  await expect(head(page, "更新日")).toBeVisible();
  // 実行・検証: Esc で閉じてフォーカスが戻る
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
});

// 表の末尾に計算ごとの集計の行を置き、絞り込みで計算し直し、並べ替えても末尾に残す（正常シナリオ（集計の行を読む））
test("test_normal_when_totals_shown", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TOTALS_MARKDOWN });
  // 検証: 描いた直後
  await expect(page.locator("#doc tfoot tr")).toHaveCount(3);
  expect(await totalRows(page)).toEqual([
    ["合計", "45", "", ""],
    ["平均", "", "250", ""],
    ["件数", "", "", "3"],
  ]);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  // 実行・検証: 「りんご」で絞り込む
  await filterByText(page, "名前", "りんご");
  expect(await totalRows(page)).toEqual([
    ["合計", "43", "", ""],
    ["平均", "", "200", ""],
    ["件数", "", "", "2"],
  ]);
  // 実行・検証: 数量の列を並べ替える
  await head(page, "数量").locator("button.mdmark-sort").click();
  await expect(page.locator("#doc tfoot tr")).toHaveCount(3);
  await expect(page.locator("#doc tbody tfoot")).toHaveCount(0);
  await expect(page.locator("#doc tbody tr.mdmark-table-total")).toHaveCount(0);
  const last = await page.locator("#doc table tr").last().getAttribute("class");
  expect(last).toContain("mdmark-table-total");
});

// コピーのボタンで形式に TSV を選ぶと、表示している行と列を TSV でコピーし、ボタンで知らせる（正常シナリオ（表をコピーする））
test("test_normal_when_table_copied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: fruitTable("data +copy +columns hide=説明 filter=名前:text"),
  });
  await filterByText(page, "名前", "りんご");
  const button = page.locator("#doc button.mdmark-copy");
  const menu = page.locator("#doc .mdmark-copy-menu");
  const formats = menu.locator("button.mdmark-copy-format");
  // 実行・検証: コピーのボタンで形式のメニューを開く
  await button.click();
  await expect(menu).toBeVisible();
  await expect(formats).toHaveCount(2);
  await expect(formats.locator(".mdmark-copy-format-name")).toHaveText([
    "Markdown の表",
    "TSV",
  ]);
  // 実行: キーボードで TSV を選ぶ
  await expect(formats.nth(0)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(formats.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  // 検証
  await expect(button).toContainText("コピーしました");
  expect(await writtenTexts(page)).toEqual([
    "名前\t更新日\nりんご\t2026-10-01\nりんご飴\t2026-10-20",
  ]);
  await expect(menu).toBeHidden();
  await expect(button).toBeFocused();
  await expect(page.locator("#doc .mdmark-table-status")).toContainText(
    "コピーしました",
  );
});

// 列の表示と絞り込みの後に見えている行と列を、Markdown の表でコピーする（正常シナリオ（表を Markdown でコピーする））
test("test_normal_when_table_copied_as_markdown", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: fruitTable("data +copy +columns hide=説明 filter=名前:text"),
  });
  const toggle = page.getByRole("button", { name: "列の表示" });
  const boxes = page.locator(
    '#doc .mdmark-columns-menu input[type="checkbox"]',
  );
  await toggle.click();
  await boxes.nth(1).check();
  await boxes.nth(2).uncheck();
  await page.keyboard.press("Escape");
  await filterByText(page, "名前", "りんご");
  const button = page.locator("#doc button.mdmark-copy");
  // 実行: コピーのボタンを押し、形式に Markdown を選ぶ
  await button.click();
  await page
    .locator('#doc button.mdmark-copy-format[data-format="markdown"]')
    .click();
  // 検証
  await expect(button).toContainText("コピーしました");
  expect(await writtenTexts(page)).toEqual([
    "| 名前 | 説明 |\n| --- | --- |\n| りんご | 描画を速くする |\n| りんご飴 | 描画の崩れを直す |",
  ]);
  await expect(page.locator("#doc .mdmark-table-status")).toContainText(
    "コピーしました",
  );
});

// URL の #ID が指す行へ、閉じた表と閉じた節を開き、絞り込みを外して移り、その行を強調する（正常シナリオ（行へのリンクで行へ移る））
test("test_normal_when_row_link_opened", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, {
    hash: `#${encodeURIComponent("みかん")}`,
  });
  await mountDocument(page, {
    markdown: [
      "# 見出し",
      "",
      ...Array.from({ length: 30 }, (_, i) => `長い段落 ${i + 1}\n`),
      "<!-- table: data +rowlink closed -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
      "## 節",
      "",
      "<!-- section: closed -->",
      "",
      "<!-- table: data +rowlink filter=名前:text -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| ぶどう | 1 |",
      "| もも | 2 |",
      "| なし | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const targets = page.locator("#doc tr[data-target]");
  // 検証: 各行の先頭のセルに、行の id を指すリンクがある
  const anchors = page.locator("#doc .mdmark-row-anchor");
  await expect(anchors).toHaveCount(6);
  await expect(anchors.nth(1)).toHaveAttribute("href", "#みかん");
  // 検証: 閉じていた表が開き、みかんの行が見えて強調されている
  await expect(
    page.locator("#doc details.mdmark-table-details").first(),
  ).toHaveAttribute("open", "");
  await expect(page.locator('#doc tr[id="みかん"]')).toBeInViewport();
  await expect(targets).toHaveCount(1);
  await expect(targets).toHaveAttribute("id", "みかん");
  // 実行: 節を開いて表 B を絞り込み、節を閉じ、URL の #ID を もも にする
  const toggle = page.locator('#doc button[aria-controls="section-節"]');
  await toggle.click();
  await filterByText(page, "名前", "ぶどう");
  await page.locator("body").click({ position: { x: 0, y: 0 } });
  await toggle.click();
  await expect(page.locator('#doc [id="section-節"]')).toBeHidden();
  await page.evaluate(() => {
    location.hash = "#もも";
  });
  // 検証: 節が開き、表 B の絞り込みが外れて 3 行とも出て、もも の行が見える
  await expect(page.locator('#doc [id="section-節"]')).toBeVisible();
  const second = page.locator("#doc .mdmark-table").nth(1);
  await expect(second.locator("tbody tr:not(.mdmark-table-empty)")).toHaveCount(
    3,
  );
  await expect(
    second.locator("tbody tr:not(.mdmark-table-empty):visible"),
  ).toHaveCount(3);
  await expect(page.locator('#doc tr[id="もも"]')).toBeInViewport();
  // 検証: 強調が もも の行へ移り、みかん の行は強調されない
  await expect(targets).toHaveCount(1);
  await expect(targets).toHaveAttribute("id", "もも");
});

// 読めない計算・表に無い列名・先頭の列は指定ごとの警告にして当てず、機能の無い表のキーも当てない（異常シナリオ（読めない集計・隠す列））
test("test_error_when_unknown_total_or_hidden_column", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const rows = [
    "| 名前 | 数量 | 単価 |",
    "| --- | --- | --- |",
    "| a | 1 | 200 |",
    "| b | 2 | 400 |",
    "",
    "<!-- /table -->",
    "",
  ];
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data +total +columns total=数量:max,価格:sum,単価:avg hide=備考,名前 -->",
      "",
      ...rows,
      "<!-- table: data total=数量:sum hide=名前 -->",
      "",
      ...rows,
      "<!-- table: data +total -->",
      "",
      ...rows,
    ].join("\n"),
  });
  // 検証: 表 A
  const [a, b, c] = await page.locator("#doc .mdmark-table").all();
  if (!a || !b || !c) {
    throw new Error("表が 3 つ描かれていない");
  }
  const warningsA = a.locator(".mdmark-syntax-warning");
  await expect(warningsA).toHaveCount(4);
  const textA = (await warningsA.allTextContents()).join("\n");
  for (const word of ["max", "sum", "avg", "count", "価格", "備考", "名前"]) {
    expect(textA).toContain(word);
  }
  expect(textA).toContain("先頭の列");
  await expect(a.locator("tfoot tr")).toHaveCount(1);
  await expect(a.locator("tfoot tr")).toHaveAttribute("data-total-kind", "avg");
  const footA = a.locator("tfoot td");
  await expect(footA).toHaveCount(3);
  await expect(footA.nth(0)).toHaveText("平均");
  await expect(footA.nth(1)).toHaveText("");
  await expect(footA.nth(2)).toContainText("300");
  await expect(a.locator("thead th")).toHaveCount(3);
  for (const header of await a.locator("thead th").all()) {
    await expect(header).toBeVisible();
  }
  // 検証: 表 B
  const warningsB = b.locator(".mdmark-syntax-warning");
  await expect(warningsB).toHaveCount(1);
  await expect(warningsB).toContainText("+total");
  await expect(warningsB).toContainText("+columns");
  await expect(b.locator("tfoot")).toHaveCount(0);
  await expect(b.locator("thead th", { hasText: "名前" })).toBeVisible();
  // 検証: 表 C
  await expect(c.locator(".mdmark-syntax-warning")).toHaveCount(0);
  await expect(c.locator("tfoot")).toHaveCount(0);
});

// クリップボードへの書き込みが拒まれたら、コピーする中身を選択したパネルを出し、閉じるとコピーのボタンへフォーカスを戻す（異常シナリオ（クリップボードに書けない））
test("test_error_when_clipboard_denied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "deny");
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: fruitTable("data +copy") });
  const button = page.locator("#doc button.mdmark-copy");
  const panel = page.locator("#doc .mdmark-copy-panel");
  const textarea = panel.locator("textarea");
  // 実行: コピーのボタンを押し、形式に TSV を選ぶ
  await button.click();
  await page
    .locator('#doc button.mdmark-copy-format[data-format="tsv"]')
    .click();
  // 検証: コピーできなかったことと手でコピーできることが、ボタンと読み上げで知らされる
  await expect(button).toContainText("コピーできませんでした");
  await expect(button).toHaveAttribute("data-state", "failed");
  const status = page.locator("#doc .mdmark-table-status");
  await expect(status).toContainText("コピーできませんでした");
  await expect(status).toContainText("手でコピー");
  // 検証: コピーする中身が全て選択された状態でパネルに出ている
  await expect(panel).toBeVisible();
  await expect(textarea).toHaveValue(
    [
      "名前\t説明\t更新日",
      "りんご\t描画を速くする\t2026-10-01",
      "みかん\t印刷を直す\t2026-10-10",
      "りんご飴\t描画の崩れを直す\t2026-10-20",
    ].join("\n"),
  );
  await expect(textarea).toBeFocused();
  expect(
    await textarea.evaluate((el: HTMLTextAreaElement) => [
      el.selectionStart,
      el.selectionEnd === el.value.length,
    ]),
  ).toEqual([0, true]);
  // 実行・検証: Esc でパネルを閉じる
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();
  // 実行・検証: もう一度コピーして閉じるボタンで閉じる
  await button.click();
  await page
    .locator('#doc button.mdmark-copy-format[data-format="tsv"]')
    .click();
  await expect(panel).toHaveCount(1);
  await panel.getByRole("button", { name: "閉じる" }).click();
  await expect(panel).toHaveCount(0);
  await expect(button).toBeFocused();
  // 検証: 表はそのまま操作できる
  await head(page, "名前").locator("button.mdmark-sort").click();
  await expect(head(page, "名前")).toHaveAttribute("aria-sort", "ascending");
});

/** 長い段落を 40 個並べた Markdown の行 */
function paragraphs(label: string): string[] {
  return Array.from({ length: 40 }, (_, i) => `${label}の段落 ${i + 1}\n`);
}

/** 長い段落の後に、集計の行を持つ 10 列 60 行の表を置き、表の後に長い段落を置いた Markdown。2 列目の数量は上から 60・59・…・1 */
function stickyDocument(): string {
  const headers = [
    "名前",
    "数量",
    ...Array.from({ length: 8 }, (_, i) => `列${i + 3}`),
  ];
  const rows = Array.from({ length: 60 }, (_, row) => {
    const cells = [
      `行${row + 1}`,
      String(60 - row),
      ...Array.from({ length: 8 }, (_cell, i) => `値${row + 1}-${i + 3}`),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  return [
    ...paragraphs("前"),
    "<!-- table: data +total total=数量:sum -->",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
    "<!-- /table -->",
    "",
    ...paragraphs("後"),
  ].join("\n");
}

/** ページを縦に `top` までスクロールする */
async function scrollPageTo(page: Page, top: number): Promise<void> {
  await page.evaluate((y) => window.scrollTo(0, y), top);
}

/** 見出し行の各セルの上端・集計の行の各セルの下端と、画面の高さを返す */
async function stuckEdges(
  page: Page,
): Promise<{ head: number[]; foot: number[]; viewport: number }> {
  return await page.evaluate(() => ({
    head: [...document.querySelectorAll("#doc thead th")].map(
      (cell) => cell.getBoundingClientRect().top,
    ),
    foot: [...document.querySelectorAll("#doc tfoot td")].map(
      (cell) => cell.getBoundingClientRect().bottom,
    ),
    viewport: document.documentElement.clientHeight,
  }));
}

/** 見出し行と集計の行の各セルの、同じ列の本文のセルとの左端と幅の差のうち最大のもの */
async function columnMisalignment(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const body = [
      ...(document.querySelector("#doc tbody tr")?.querySelectorAll("td") ??
        []),
    ];
    const pick = (selector: string) => [...document.querySelectorAll(selector)];
    const diffs = [...pick("#doc thead th"), ...pick("#doc tfoot td")].map(
      (cell, index) => {
        const column = index % body.length;
        const a = cell.getBoundingClientRect();
        const b = (body[column] as Element).getBoundingClientRect();
        return Math.max(Math.abs(a.left - b.left), Math.abs(a.width - b.width));
      },
    );
    return Math.max(...diffs);
  });
}

// 見出し行を画面の上端に、集計の行を画面の下端に留め、横にスクロールしても本文の列に揃え、表が外れると一緒に外す（正常シナリオ（見出し行を画面の上端に留める））
test("test_normal_when_header_stuck", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  await mountDocument(page, { markdown: stickyDocument() });
  const wrapper = page.locator("#doc .mdmark-table");
  const table = page.locator("#doc table");
  const pins = page.locator("#doc button.mdmark-pin:not([hidden])");
  await expect(pins).toHaveCount(10);
  // 検証: 表の中で縦にスクロールせず、全ての行がページの中に並ぶ
  await expect(wrapper).toHaveCSS("max-height", "none");
  expect(
    await wrapper.evaluate((el) => el.scrollHeight - el.clientHeight),
  ).toBe(0);
  const box = await table.boundingBox();
  const tableTop = await table.evaluate(
    (el) => el.getBoundingClientRect().top + window.scrollY,
  );
  const tableHeight = box?.height ?? 0;
  expect(tableHeight).toBeGreaterThan(60 * 20);
  // 実行: 2 列目のピン止めを押し、表の途中までページをスクロールする
  await pins.nth(1).click();
  await scrollPageTo(page, tableTop + 600);
  // 検証: 見出し行が画面の上端、集計の行が画面の下端に見える
  await expect
    .poll(async () => {
      const edges = await stuckEdges(page);
      return Math.max(
        ...edges.head.map((top) => Math.abs(top)),
        ...edges.foot.map((bottom) => Math.abs(bottom - edges.viewport)),
      );
    })
    .toBeLessThanOrEqual(1);
  // 実行: 表を横にスクロールする
  await table.evaluate((el) => {
    el.scrollLeft = 200;
  });
  // 検証: 見出し行と集計の行が本文の列に揃い、1・2 列目が左端に見える
  await expect.poll(() => columnMisalignment(page)).toBeLessThanOrEqual(1);
  const tableLeft = (await table.boundingBox())?.x ?? 0;
  const first = await page.locator("#doc thead th").nth(0).boundingBox();
  const second = await page.locator("#doc thead th").nth(1).boundingBox();
  expect(Math.abs((first?.x ?? 0) - tableLeft)).toBeLessThanOrEqual(2);
  expect(
    Math.abs((second?.x ?? 0) - ((first?.x ?? 0) + (first?.width ?? 0))),
  ).toBeLessThanOrEqual(1);
  // 実行・検証: 留めた見出し行の数量の並べ替えを押す
  await head(page, "数量").locator("button.mdmark-sort").click();
  await expect(head(page, "数量")).toHaveAttribute("aria-sort", "ascending");
  expect((await visibleColumn(page, 2)).slice(0, 3)).toEqual(["1", "2", "3"]);
  // 検証: 見出し行は 1 組で、Tab で見出し行の各ボタンへ 1 回ずつ移る
  await expect(page.locator("#doc thead")).toHaveCount(1);
  const buttons = page.locator("#doc thead button:not([hidden])");
  const count = await buttons.count();
  expect(count).toBe(20);
  await table.evaluate((el) => el.focus({ preventScroll: true }));
  for (let index = 0; index < count; index++) {
    await page.keyboard.press("Tab");
    await expect(buttons.nth(index)).toBeFocused();
  }
  // 実行: 表の後の段落までページをスクロールする
  await scrollPageTo(page, tableTop + tableHeight + 400);
  // 検証: 見出し行と集計の行が画面から外れる
  await expect
    .poll(async () => {
      const edges = await stuckEdges(page);
      return Math.max(
        ...edges.head.map((top) => top),
        ...edges.foot.map((bottom) => bottom),
      );
    })
    .toBeLessThan(0);
});

/** 390px の幅で 1 行に収まらない説明を最終列に持つ、3 列 3 行の表の Markdown */
const FOLD_TABLE = [
  "<!-- table: data -->",
  "",
  "| 名前 | 状態 | 説明 |",
  "| --- | --- | --- |",
  "| りんご | 新規 | 描画を速くするために、見出しの ID を作る処理を 1 回にまとめる改善の説明 |",
  "| みかん | 進行 | 印刷で折り畳みを開き、リンクの URL を併記して紙に収める変更の説明 |",
  "| ぶどう | 完了 | 表の見出し行を画面の上端に留めて、縦に長い表を読みやすくする変更の説明 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 描く先の要素が 720px 未満で最終列が 1 行に収まらないとき、最終列を畳み、行の開閉のボタンで開き、広げると畳まない（正常シナリオ（狭い幅で最終列を畳む））
test("test_normal_when_last_column_collapsed", async ({ page }) => {
  // 準備
  await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page, builtRoot, { hostCss: "body { margin: 0 }" });
  await mountDocument(page, { markdown: FOLD_TABLE });
  const rows = page.locator(
    "#doc tbody tr:not(.mdmark-row-detail):not(.mdmark-table-empty)",
  );
  const toggles = page.locator("#doc button.mdmark-fold-toggle");
  // 検証: 描いた直後、説明の列は表示されず、名前と状態の列は表示される
  await expect(head(page, "説明")).toBeHidden();
  await expect(head(page, "名前")).toBeVisible();
  await expect(head(page, "状態")).toBeVisible();
  for (const cell of await rows.locator("td:nth-child(3)").all()) {
    await expect(cell).toBeHidden();
  }
  await expect(rows.locator("td:nth-child(1)").first()).toBeVisible();
  // 検証: 各行が開閉のボタンを持つ
  await expect(toggles).toHaveCount(3);
  for (const [index, name] of ["りんご", "みかん", "ぶどう"].entries()) {
    await expect(toggles.nth(index)).toHaveAttribute("aria-expanded", "false");
    await expect(toggles.nth(index)).toHaveAttribute(
      "aria-label",
      `「${name}」の説明`,
    );
  }
  // 実行: 2 行目のボタンを押す
  const second = toggles.nth(1);
  await second.click();
  // 検証: 2 行目の直後に、見出し `説明` と 2 行目の説明の中身を持つ行が表示される
  await expect(second).toHaveAttribute("aria-expanded", "true");
  const detailId = (await second.getAttribute("aria-controls")) ?? "";
  const detail = page.locator(`[id="${detailId}"]`);
  await expect(
    rows.nth(1).locator("xpath=following-sibling::tr[1]"),
  ).toHaveAttribute("id", detailId);
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("説明");
  await expect(detail).toContainText("印刷で折り畳みを開き");
  // 実行・検証: もう一度押す
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "false");
  await expect(detail).toBeHidden();
  // 実行・検証: Enter と Space でも開閉する
  const first = toggles.nth(0);
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-expanded", "false");
  // 実行: 画面の幅を 1280px に広げる
  await page.setViewportSize({ width: 1280, height: 844 });
  // 検証: 説明の列が表示され、開閉のボタンが無い
  await expect(head(page, "説明")).toBeVisible();
  await expect(rows.locator("td:nth-child(3)").first()).toBeVisible();
  await expect(toggles.first()).toBeHidden();
  await expect(detail).toBeHidden();
});

// 「集計」のメニューでチェックを外した計算の行を出さず、入れ直すと戻す（正常シナリオ（出す集計を選ぶ））
test("test_normal_when_totals_selected", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TOTALS_MARKDOWN });
  const toggle = page.locator("#doc button.mdmark-totals-toggle");
  const menu = page.locator("#doc .mdmark-totals-menu");
  const boxes = menu.locator('input[type="checkbox"]');
  const names = page.locator("#doc tfoot tr:not([hidden]) .mdmark-total-name");
  // 実行: キーボードで「集計」のボタンを押す
  await toggle.focus();
  await page.keyboard.press("Enter");
  // 検証: 合計・平均・件数のチェックボックスが並び、全てチェックが入っている
  await expect(menu).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(menu.locator("label")).toHaveText(["合計", "平均", "件数"]);
  for (const box of await boxes.all()) {
    await expect(box).toBeChecked();
  }
  // 実行・検証: 平均のチェックを外す
  await expect(boxes.nth(0)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(boxes.nth(1)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(boxes.nth(1)).not.toBeChecked();
  await expect(names).toHaveText(["合計", "件数"]);
  // 実行・検証: 平均にチェックを入れる
  await page.keyboard.press("Space");
  await expect(boxes.nth(1)).toBeChecked();
  await expect(names).toHaveText(["合計", "平均", "件数"]);
  // 実行・検証: Esc でメニューを閉じてボタンへフォーカスを戻す
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
});

// 数として読めないセルを持つ列は、合計を出さずに警告し、読めない値の無い列の集計は出す（異常シナリオ（数として読めないセルを集計する））
test("test_error_when_total_cell_not_number", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data +total total=数量:sum,単価:avg -->",
      "",
      "| 名前 | 数量 | 単価 |",
      "| --- | --- | --- |",
      "| りんご | 10 | 100 |",
      "| みかん | 2 | 200 |",
      "| ぶどう | - | 300 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  // 検証
  expect(await totalRows(page)).toEqual([
    ["合計", "", ""],
    ["平均", "", "200"],
  ]);
  await expect(page.locator("#doc tfoot")).not.toContainText("12");
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  await expect(warning).toContainText("数量");
  await expect(warning).toContainText("-");
  await expect(warning).toContainText("合計");
  // 検証: 表の並べ替えはそのまま操作できる
  await head(page, "名前").locator("button.mdmark-sort").click();
  await expect(head(page, "名前")).toHaveAttribute("aria-sort", "ascending");
});

// 行のアンカーを押すと、行の絶対 URL をコピーして知らせ、行へ移ってその行を強調する（正常シナリオ（行の URL をコピーする））
test("test_normal_when_row_url_copied", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- table: data +rowlink -->",
      "",
      "| 名前 | 値 |",
      "| --- | --- |",
      "| りんご | 1 |",
      "| みかん | 2 |",
      "| りんご飴 | 3 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const row = page.locator('#doc tr[id="みかん"]');
  const anchor = row.locator("a.mdmark-row-anchor");
  const notice = row.locator(".mdmark-row-link-notice");
  const href = await anchor.evaluate((el: HTMLAnchorElement) => el.href);
  // 実行
  await anchor.click();
  // 検証: アンカーの href を絶対 URL にしてコピーし、短く知らせる
  await expect(notice).toHaveText("リンクをコピーしました");
  await expect(notice).toHaveAttribute("role", "status");
  expect(await writtenTexts(page)).toEqual([href]);
  expect(href).toMatch(/^https:\/\/app\.example\.test\/#/);
  // 検証: URL の末尾が行の ID になり、みかんの行だけが強調される
  expect(decodeURIComponent(new URL(page.url()).hash)).toBe("#みかん");
  const targets = page.locator("#doc tr[data-target]");
  await expect(targets).toHaveCount(1);
  await expect(targets).toHaveAttribute("id", "みかん");
  // 検証: しばらくすると知らせが消える
  await expect(notice).toHaveText("");
});
