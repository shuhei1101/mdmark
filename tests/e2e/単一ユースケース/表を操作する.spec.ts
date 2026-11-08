import { expect, type Page, test } from "@playwright/test";
import { stubClipboard, writtenTexts } from "../diagram.ts";
import {
  buildDistRoot,
  mountDocument,
  openPage,
  readColumnsCalls,
  removeDistRoot,
  TREE_EXAMPLE_MARKDOWN,
  treeMarkdown,
  treeRow,
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

// 数値の列の見出しを押すたびに、降順・昇順・元の並びで並べ替え、`+機能` を書かない表にはボタン・集計・行へのリンクを付けない（正常シナリオ）
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
  await expect(head(page, "数")).toHaveAttribute("aria-sort", "descending");
  expect(await visibleColumn(page, 2)).toEqual(["33", "10", "2"]);
  await sort.click();
  await expect(head(page, "数")).toHaveAttribute("aria-sort", "ascending");
  expect(await visibleColumn(page, 2)).toEqual(["2", "10", "33"]);
  await sort.click();
  expect(await visibleColumn(page, 2)).toEqual(["10", "2", "33"]);
  // 元の並びでは `aria-sort` を持たない（持たないことが `none`）
  expect(await head(page, "数").getAttribute("aria-sort")).toBeNull();
  const html = await page.locator("#doc").innerHTML();
  expect(html).not.toContain("<!--");
  await expect(page.locator("#doc")).not.toContainText("table:");
  // `+機能` を書いた表にだけ付くボタン・集計の行・行へのリンクが無い
  for (const selector of [
    ".mdmark-table-count",
    ".mdmark-table-settings-toggle",
    "button.mdmark-copy",
    "tfoot",
    ".mdmark-row-anchor",
  ]) {
    await expect(page.locator(`#doc ${selector}`), selector).toHaveCount(0);
  }
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
  await drawer.getByRole("button", { name: "絞り込みを解除" }).click();
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
    markdown: [
      "<!-- table: data closed -->",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| a | 1 |",
      "| b | 2 |",
      "| c | 3 |",
      "",
      "<!-- /table -->",
      "",
      "<!-- table: data open title=リリースの一覧 -->",
      "",
      "| 名前 | 数 |",
      "| --- | --- |",
      "| d | 4 |",
      "| e | 5 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const folds = page.locator("#doc details.mdmark-table-details");
  const closedRows = folds.nth(0).locator("tbody tr:not(.mdmark-table-empty)");
  const openRows = folds.nth(1).locator("tbody tr:not(.mdmark-table-empty)");
  // 検証: 描いた直後
  await expect(folds.nth(0)).not.toHaveAttribute("open", "");
  await expect(folds.nth(0).locator("summary")).toHaveText("表（3 行）");
  await expect(closedRows.first()).toBeHidden();
  await expect(folds.nth(1).locator("summary")).toHaveText("リリースの一覧");
  await expect(openRows).toHaveCount(2);
  await expect(openRows.first()).toBeVisible();
  // 実行
  await folds.nth(0).locator("summary").click();
  // 検証
  await expect(closedRows).toHaveCount(3);
  await expect(closedRows.first()).toBeVisible();
  await expect(closedRows.last()).toBeVisible();
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

// 知らない種類は読み飛ばして既定の種類にし、書き方の警告を出さずに +sort を当てる（正常シナリオ（知らない種類））
test("test_normal_when_unknown_kind", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `<!-- table: unknown +sort -->\n\n${wideTable()}\n<!-- /table -->\n\n表の後の段落\n`,
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
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

// 知らない機能とキーは読み飛ばし、書き方の警告を出さずに data の機能を付ける（正常シナリオ（知らない機能・キー））
test("test_normal_when_unknown_feature_or_key", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `<!-- table: data +unknown size=2 -->\n\n${wideTable()}\n<!-- /table -->\n`,
  });
  // 検証
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
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

/** テーブル設定のパネル（`index` 番目の表のもの） */
function settingsPanel(page: Page, index = 0) {
  return page.locator("#doc .mdmark-table-settings").nth(index);
}

/** テーブル設定のパネルの、列名 `name` の行の目のアイコン */
function eyeOf(panel: ReturnType<Page["locator"]>, name: string) {
  return panel.locator(
    `.mdmark-table-settings-item[data-name="${name}"] .mdmark-table-settings-eye`,
  );
}

/** テーブル設定のパネルの、列名 `name` の行のつまみ */
function gripOf(panel: ReturnType<Page["locator"]>, name: string) {
  return panel.locator(
    `.mdmark-table-settings-item[data-name="${name}"] .mdmark-table-settings-grip`,
  );
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
    .getByRole("button", { name: "絞り込みを解除" })
    .click();
  await expect(count).toContainText("3 / 3 件");
});

// テーブル設定のパネルの目のアイコンで列を隠し・出し、Esc で閉じる（正常シナリオ（列を隠す・出す））
test("test_normal_when_columns_toggled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: fruitTable("data +columns hide=説明"),
  });
  const toggle = page.getByRole("button", { name: "テーブル設定" });
  const panel = settingsPanel(page);
  const badge = toggle.locator(".mdmark-table-tool-badge");
  // 検証: テーブル設定のボタンは文字を持たないアイコンだけのボタンで、ツールチップが「テーブル設定」
  await expect(toggle).toHaveAttribute("title", "テーブル設定");
  const visibleText = await toggle.evaluate((button) => {
    const copy = button.cloneNode(true) as HTMLElement;
    copy.querySelector(".mdmark-table-tool-badge")?.remove();
    return (copy.textContent ?? "").trim();
  });
  expect(visibleText).toBe("");
  // 検証: 描いた直後は説明の列だけが隠れ、隠した列の数 1 のバッジと、読み上げの「（1 列を非表示）」がある
  await expect(head(page, "説明")).toBeHidden();
  await expect(head(page, "名前")).toBeVisible();
  await expect(head(page, "更新日")).toBeVisible();
  await expect(badge).toHaveText("1");
  await expect(
    page.getByRole("button", { name: "テーブル設定（1 列を非表示）" }),
  ).toHaveCount(1);
  // 実行・検証: パネルを開く
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(panel.locator(".mdmark-table-settings-eye")).toHaveCount(3);
  await expect(eyeOf(panel, "説明")).toHaveAttribute("aria-pressed", "true");
  await expect(eyeOf(panel, "更新日")).toHaveAttribute("aria-pressed", "false");
  await expect(eyeOf(panel, "名前")).toBeDisabled();
  await expect(panel).toContainText("先頭の列は隠せません");
  // 実行・検証: 説明を表示すると、全ての列が出てバッジが無くなる
  await eyeOf(panel, "説明").click();
  await expect(head(page, "説明")).toBeVisible();
  await expect(head(page, "更新日")).toBeVisible();
  await expect(badge).toBeHidden();
  // 実行・検証: 更新日を隠すと、名前と説明が元の位置に並び、バッジが 1 になる
  await eyeOf(panel, "更新日").click();
  await expect(head(page, "更新日")).toBeHidden();
  const order = await page.locator("#doc thead th").allTextContents();
  expect(order[0]).toContain("名前");
  expect(order[1]).toContain("説明");
  await expect(badge).toHaveText("1");
  // 実行・検証: Esc で閉じてフォーカスが戻る
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
});

// 表の印で囲まない表に続けて、列の表示を持つ 3 列の表と、備考を隠した 2 列の表を置いた文書
const COLUMNS_NOTIFY_MARKDOWN = [
  "| 項目 | 値 |",
  "| --- | --- |",
  "| x | 1 |",
  "",
  fruitTable("data +columns"),
  "<!-- table: data +columns hide=備考 -->",
  "",
  "| 名前 | 備考 |",
  "| --- | --- |",
  "| みかん | 季節の果物 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 列の表示を切り替えるたびに、+columns の表の番号と隠している列を onColumnsChange に渡す（正常シナリオ（列の表示の切り替えを受け取る））
test("test_normal_when_columns_change_notified", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: COLUMNS_NOTIFY_MARKDOWN,
    recordColumns: true,
  });
  const toggles = page.getByRole("button", { name: "テーブル設定" });
  await expect(toggles).toHaveCount(2);
  const first = settingsPanel(page, 0);
  const second = settingsPanel(page, 1);
  // 検証: 描いた直後は呼ばない
  expect(await readColumnsCalls(page)).toEqual([]);
  // 実行・検証: 1 つ目の表で説明を隠す
  await toggles.nth(0).click();
  await eyeOf(first, "説明").click();
  expect(await readColumnsCalls(page)).toEqual([
    { tableIndex: 0, hidden: ["説明"] },
  ]);
  // 実行・検証: 説明を表示し、更新日・説明の順に隠す
  await eyeOf(first, "説明").click();
  await eyeOf(first, "更新日").click();
  await eyeOf(first, "説明").click();
  expect((await readColumnsCalls(page)).at(-1)).toEqual({
    tableIndex: 0,
    hidden: ["説明", "更新日"],
  });
  await page.keyboard.press("Escape");
  // 実行・検証: 2 つ目の表で備考を表示し、もう一度隠す
  await toggles.nth(1).click();
  await eyeOf(second, "備考").click();
  expect((await readColumnsCalls(page)).at(-1)).toEqual({
    tableIndex: 1,
    hidden: [],
  });
  await eyeOf(second, "備考").click();
  expect((await readColumnsCalls(page)).at(-1)).toEqual({
    tableIndex: 1,
    hidden: ["備考"],
  });
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
  await page.getByRole("button", { name: "テーブル設定" }).click();
  await eyeOf(settingsPanel(page), "説明").click();
  await eyeOf(settingsPanel(page), "更新日").click();
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
  await expect(status).toContainText("手動でコピー");
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
  await expect(head(page, "名前")).toHaveAttribute("aria-sort", "descending");
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
  await expect(head(page, "数量")).toHaveAttribute("aria-sort", "descending");
  expect((await visibleColumn(page, 2)).slice(0, 3)).toEqual([
    "60",
    "59",
    "58",
  ]);
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
  await expect(head(page, "名前")).toHaveAttribute("aria-sort", "descending");
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

/** 表の枠の左端に対する、表の中の指定した要素の左端の位置 */
async function offsetInTable(
  table: ReturnType<Page["locator"]>,
  target: ReturnType<Page["locator"]>,
): Promise<number> {
  const box = await table.boundingBox();
  const cell = await target.boundingBox();
  if (!box || !cell) {
    throw new Error("要素の位置を取れない");
  }
  return cell.x - box.x;
}

// 囲まない表ははみ出すと 1 列目を留め、-pin の表は留めない（正常シナリオ（はみ出す表で先頭の列を留める））
test("test_normal_when_pinned_by_default", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: `${wideTable()}\n<!-- table: -pin -->\n\n${wideTable()}\n<!-- /table -->\n`,
  });
  const tables = page.locator("#doc table");
  await expect(tables).toHaveCount(2);
  const plain = tables.nth(0);
  const unpinned = tables.nth(1);
  const pins = plain.locator("button.mdmark-pin:not([hidden])");
  // 検証: 囲まない表は 1 列目が留まっている
  await expect(pins.nth(0)).toHaveAttribute("aria-pressed", "true");
  await plain.evaluate((el) => {
    el.scrollLeft = 600;
  });
  const first = plain.locator("thead th:nth-child(1)");
  expect(await offsetInTable(plain, first)).toBeGreaterThanOrEqual(-1);
  expect(await offsetInTable(plain, first)).toBeLessThan(8);
  // 検証: -pin の表はボタンが無く、1 列目がスクロールで見えなくなる
  await expect(unpinned.locator("button.mdmark-pin")).toHaveCount(0);
  await unpinned.evaluate((el) => {
    el.scrollLeft = 600;
  });
  expect(
    await offsetInTable(unpinned, unpinned.locator("thead th:nth-child(1)")),
  ).toBeLessThan(-100);
  // 実行・検証: 1 列目のピン止めのボタンを押すと留めた列が外れる
  await pins.nth(0).click();
  await expect(pins.nth(0)).toHaveAttribute("aria-pressed", "false");
  expect(await offsetInTable(plain, first)).toBeLessThan(-100);
});

/** 1 列目 No・2 列目 物理名・長い文の 説明 を含む 8 列の表の Markdown */
function pinAndWideTable(mark: string): string {
  const headers = [
    "No",
    "物理名",
    "論理名",
    "型",
    "必須",
    "既定",
    "説明",
    "備考",
  ];
  const rows = Array.from({ length: 5 }, (_, row) =>
    [
      `${row + 1}`,
      `column_${row + 1}`,
      `列${row + 1}`,
      "string",
      "true",
      "-",
      `列${row + 1}の値は、表を描くときに見出しの順で並べ、読む人が横にスクロールして読む長い説明の文です`,
      "-",
    ].join(" | "),
  );
  return [
    `<!-- table: ${mark} -->`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row} |`),
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

// pin= の列までを留め、wide= の列を折り返さずに広く取る（正常シナリオ（留める列と広く取る列を指定する））
test("test_normal_when_pin_and_wide", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: pinAndWideTable("data pin=物理名 wide=説明"),
  });
  const table = page.locator("#doc table");
  await table.evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  // 検証: No と物理名の列が左端に残る
  const no = head(page, "No");
  const name = head(page, "物理名");
  expect(await offsetInTable(table, no)).toBeGreaterThanOrEqual(-1);
  expect(await offsetInTable(table, no)).toBeLessThan(8);
  const second = await offsetInTable(table, name);
  expect(second).toBeGreaterThan(0);
  expect(second).toBeLessThan(200);
  // 検証: 説明の列は 1 行で、ほかの列より広い
  const description = page
    .locator("#doc tbody tr")
    .first()
    .locator("td")
    .nth(6);
  await expect(description).toHaveCSS("white-space", "nowrap");
  const widths = await page
    .locator("#doc thead th")
    .evaluateAll((cells) =>
      cells.map((cell) => cell.getBoundingClientRect().width),
    );
  expect(Math.max(...widths)).toBe(widths[6]);
  // 検証: 表は横にスクロールし、ページは横にスクロールしない
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
    true,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

/** 必須と既定の列が true・false の 3 行の表の Markdown */
function checkTable(mark: string): string {
  return [
    `<!-- table: ${mark} -->`,
    "",
    "| 名前 | 必須 | 既定 |",
    "| --- | --- | --- |",
    "| a | true | false |",
    "| b | false | true |",
    "| c | true | true |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

// check= の列は true を ✓、false を空欄で出し、絞り込み・並べ替え・コピーは値で動く（正常シナリオ（真偽値を ✓ で出す））
test("test_normal_when_check_column", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: checkTable("data check=必須 filter=必須 +copy"),
  });
  const required = page.locator("#doc tbody tr td:nth-child(2)");
  // 検証: 必須の列の ✓ と空欄
  await expect(required.nth(0).locator(".mdmark-check")).toHaveAttribute(
    "aria-label",
    "はい",
  );
  await expect(required.nth(1).locator(".mdmark-check")).toHaveCount(0);
  expect(await required.nth(1).innerText()).not.toMatch(/true|false|✓/);
  // 検証: 既定の列は文字のまま
  expect(await visibleColumn(page, 3)).toEqual(["false", "true", "true"]);
  // 実行・検証: 並べ替えは true・false の値で動く
  await head(page, "必須").locator("button.mdmark-sort").click();
  expect(await visibleColumn(page, 1)).toEqual(["b", "a", "c"]);
  await head(page, "必須").locator("button.mdmark-sort").click();
  await head(page, "必須").locator("button.mdmark-sort").click();
  // 実行・検証: 絞り込みの選択肢は true・false で、true に絞ると ✓ の行だけが出る
  await head(page, "必須").locator("button.mdmark-filter").click();
  const drawer = page.locator("#doc .mdmark-filter-drawer");
  await expect(
    drawer.locator(".mdmark-filter-options li:not([hidden])"),
  ).toHaveText(["true", "false"]);
  await drawer.getByLabel("true", { exact: true }).check();
  expect(await visibleColumn(page, 1)).toEqual(["a", "c"]);
  await expect(
    page.locator("#doc tbody tr:not([hidden]) td:nth-child(2) .mdmark-check"),
  ).toHaveCount(2);
  await drawer.getByRole("button", { name: "絞り込みを解除" }).click();
  // 実行・検証: コピーした中身は true・false の値を持つ
  await page.locator("#doc button.mdmark-copy").click();
  await page
    .locator("#doc .mdmark-copy-menu button.mdmark-copy-format")
    .nth(1)
    .click();
  expect(await writtenTexts(page)).toEqual([
    "名前\t必須\t既定\na\ttrue\tfalse\nb\tfalse\ttrue\nc\ttrue\ttrue",
  ]);
});

// pin= と check= の知らない列名は警告し、読めた指定だけを当てる（異常シナリオ（知らない列名））
test("test_error_when_unknown_column", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  // 実行
  await mountDocument(page, {
    markdown: pinAndWideTable(
      "data pin=無い列 wide=説明 check=無い列 filter=説明",
    ),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(2);
  for (const item of await warning.all()) {
    await expect(item).toContainText("無い列");
  }
  await expect(
    page.locator("#doc tbody tr").first().locator("td").nth(6),
  ).toHaveCSS("white-space", "nowrap");
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(8);
  await expect(head(page, "説明").locator("button.mdmark-filter")).toHaveCount(
    1,
  );
});

/** 本文の行（空の行の知らせを除く）の、1 列目のセルの文字・`rowspan`・表示の有無 */
async function firstCells(
  page: Page,
  tableIndex = 0,
): Promise<{ text: string; rowspan: string | null; shown: boolean }[]> {
  return page
    .locator("#doc table")
    .nth(tableIndex)
    .locator("tbody tr:not(.mdmark-table-empty):not([hidden])")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const cell = (row as HTMLTableRowElement).cells[0] as HTMLElement;
        return {
          text: cell.textContent?.trim() ?? "",
          rowspan: cell.getAttribute("rowspan"),
          shown: !cell.hidden && cell.getBoundingClientRect().height > 0,
        };
      }),
    );
}

// 見出しを 2 段にして横に結合し、行見出しの列を縦に結合し、コピーでは結合したセルの値を埋める（正常シナリオ（多段の見出しと行見出し））
test("test_normal_when_cells_merged", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data +copy header-rows=2 row-header=1 -->",
      "",
      "| 区分 | 値 | << | 備考 |",
      "| --- | --- | --- | --- |",
      "| 分類 | 件数 | 時間 | メモ |",
      "| A | 1 | 2 | x |",
      "| ^^ | 3 | 4 | y |",
      "| ^^ | 5 | 6 | z |",
      "",
      "<!-- /table -->",
      "",
      "| 列A | 列B |",
      "| --- | --- |",
      "| ^^ | << |",
      "",
    ].join("\n"),
  });
  // 検証: 見出しが 2 段で、1 段目の 2 列目が 2 列にまたがる
  const merged = page.locator("#doc table").nth(0);
  const headRows = merged.locator("thead tr");
  await expect(headRows).toHaveCount(2);
  const spanning = headRows.nth(0).locator("th", { hasText: "値" });
  await expect(spanning).toHaveAttribute("colspan", "2");
  const valueBox = await spanning.boundingBox();
  const countBox = await headRows
    .nth(1)
    .locator("th", { hasText: "件数" })
    .boundingBox();
  const timeBox = await headRows
    .nth(1)
    .locator("th", { hasText: "時間" })
    .boundingBox();
  expect(valueBox?.width ?? 0).toBeCloseTo(
    (countBox?.width ?? 0) + (timeBox?.width ?? 0),
    0,
  );
  await expect(headRows.nth(0)).not.toContainText("<<");
  // 検証: 各行の 1 列目が行見出しで、A が 3 行にまたがる 1 つのセル
  const rowHeads = merged.locator('tbody th[scope="row"]');
  await expect(rowHeads).toHaveCount(3);
  expect(await firstCells(page)).toEqual([
    { text: "A", rowspan: "3", shown: true },
    { text: "A", rowspan: null, shown: false },
    { text: "A", rowspan: null, shown: false },
  ]);
  // 検証: 並べ替え・絞り込み・ピン止めのボタンが、見出しの 2 段目の各列にだけある
  await expect(headRows.nth(0).locator("button")).toHaveCount(0);
  for (const selector of [
    "button.mdmark-sort",
    "button.mdmark-filter",
    "button.mdmark-pin",
  ]) {
    await expect(headRows.nth(1).locator(selector)).toHaveCount(4);
  }
  // 実行: TSV でコピーする
  await page.locator("#doc button.mdmark-copy").click();
  await page
    .locator('#doc button.mdmark-copy-format[data-format="tsv"]')
    .click();
  // 検証: `^^` のセルが上のセルの値を持ち、結合の記号が入らない
  await expect.poll(() => writtenTexts(page)).toHaveLength(1);
  const [copied = ""] = await writtenTexts(page);
  const lines = copied.split("\n");
  for (const line of lines.slice(-3)) {
    expect(line.split("\t")[0]).toBe("A");
  }
  expect(copied).not.toContain("^^");
  expect(copied).not.toContain("<<");
  // 検証: マーカーで囲まない表の `^^` と `<<` は書いたとおりの文字
  const plain = page.locator("#doc table").nth(1);
  await expect(plain.locator("tbody td")).toHaveText(["^^", "<<"]);
});

// 並べ替え・絞り込みの後に、隣り合う同じ値のセルだけを結合し直す（正常シナリオ（並べ替えの後に結合し直す））
test("test_normal_when_merged_after_sort", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- table: data -->",
      "",
      "| 分類 | 数値 |",
      "| --- | ---: |",
      "| A | 3 |",
      "| ^^ | 1 |",
      "| B | 4 |",
      "| ^^ | 2 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  // 検証: 描いた直後は A と B が 2 行ずつ結合している
  expect(await firstCells(page)).toEqual([
    { text: "A", rowspan: "2", shown: true },
    { text: "A", rowspan: null, shown: false },
    { text: "B", rowspan: "2", shown: true },
    { text: "B", rowspan: null, shown: false },
  ]);
  // 実行: 数値の列を降順に並べ替える
  await head(page, "数値").locator("button.mdmark-sort").click();
  // 検証: 隣り合う同じ値が無いため結合しない
  await expect(head(page, "数値")).toHaveAttribute("aria-sort", "descending");
  expect(await visibleColumn(page, 2)).toEqual(["4", "3", "2", "1"]);
  expect(await firstCells(page)).toEqual(
    ["B", "A", "B", "A"].map((text) => ({ text, rowspan: null, shown: true })),
  );
  // 実行: 分類で A に絞り込む
  await head(page, "分類").locator("button.mdmark-filter").click();
  await page
    .locator("#doc .mdmark-filter-drawer")
    .getByLabel("A", { exact: true })
    .check();
  // 検証: A の 2 行だけが出て、分類のセルが縦に結合している
  expect(await visibleColumn(page, 2)).toHaveLength(2);
  expect(await firstCells(page)).toEqual([
    { text: "A", rowspan: "2", shown: true },
    { text: "A", rowspan: null, shown: false },
  ]);
});

// 読めない `header-rows=` と、結合する相手の無い `^^`・`<<` を書き方の警告にし、文字のまま出す（異常シナリオ（読めないセルの結合））
test("test_error_when_merge_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data header-rows=5 -->",
      "",
      "| << | 列B |",
      "| --- | --- |",
      "| x | ^^ |",
      "| y | z |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toHaveCount(1);
  for (const text of ["header-rows=", "^^", "<<"]) {
    await expect(warning).toContainText(text);
  }
  const table = page.locator("#doc table");
  await expect(table).toBeVisible();
  await expect(table.locator("thead tr")).toHaveCount(1);
  await expect(table.locator("thead th").nth(0)).toContainText("<<");
  await expect(
    table.locator("tbody tr").nth(0).locator("td").nth(1),
  ).toHaveText("^^");
  await expect(table.locator("thead button.mdmark-sort")).toHaveCount(2);
  await expect(table.locator("thead button.mdmark-filter")).toHaveCount(2);
});

// はみ出す表で、行見出しの列までを描いた直後から左端に留める（正常シナリオ（はみ出す表で行見出しの列までを留める））
test("test_normal_when_row_header_pinned", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  const headers = [
    "分類",
    "記法",
    ...Array.from({ length: 8 }, (_, i) => `とても長い列の名前${i + 3}`),
  ];
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data row-header=2 -->",
      "",
      `| ${headers.join(" | ")} |`,
      `| ${headers.map(() => "---").join(" | ")} |`,
      ...Array.from(
        { length: 5 },
        (_, row) =>
          `| ${headers.map((_, i) => `値${row + 1}-${i + 1}`).join(" | ")} |`,
      ),
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const pins = page.locator("#doc button.mdmark-pin");
  await expect(pins.nth(1)).toHaveAttribute("aria-pressed", "true");
  // 実行: 表を横に端までスクロールする
  const scroller = await page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("#doc table");
    const target =
      table && table.scrollWidth > table.clientWidth
        ? table
        : document.querySelector<HTMLElement>("#doc .mdmark-table");
    if (target) target.scrollLeft = target.scrollWidth;
    return target === table ? "#doc table" : "#doc .mdmark-table";
  });
  // 検証: 1・2 列目が左端に見えている
  const left = (await page.locator(scroller).boundingBox())?.x ?? 0;
  const cells = page.locator("#doc tbody tr").nth(0).locator("th, td");
  await expect
    .poll(async () => {
      const first = await cells.nth(0).boundingBox();
      return Math.abs((first?.x ?? 0) - left);
    })
    .toBeLessThanOrEqual(2);
  const first = await cells.nth(0).boundingBox();
  const second = await cells.nth(1).boundingBox();
  expect(
    Math.abs((second?.x ?? 0) - ((first?.x ?? 0) + (first?.width ?? 0))),
  ).toBeLessThanOrEqual(1);
  await expect(cells.nth(0)).toBeInViewport();
  await expect(cells.nth(1)).toBeInViewport();
});

/** 見出しの行と 3 行の CSV（引用符で囲んだ区切りと改行を含む） */
const CSV = [
  "名前,拠点,金額",
  '北山,"東京, 本社",1200',
  '南田,"大阪',
  '（支店）",800',
  "西川,名古屋,950",
].join("\n");

// 言語 csv のコードブロックを表にし、表の機能を付ける（正常シナリオ（CSV の表））
test("test_normal_when_csv", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: [
      "<!-- table: data -->",
      "",
      "```csv",
      CSV,
      "```",
      "",
      "<!-- /table -->",
      "",
      "```csv",
      CSV,
      "```",
      "",
      "```text",
      CSV,
      "```",
      "",
    ].join("\n"),
  });
  // 検証
  const tables = page.locator('#doc .mdmark-table[data-source="csv"]');
  await expect(tables).toHaveCount(2);
  const first = tables.nth(0);
  await expect(first.locator("thead th")).toHaveText([/名前/, /拠点/, /金額/]);
  await expect(first.locator("tbody tr")).toHaveCount(3);
  await expect(first.locator(".mdmark-sort").first()).toBeVisible();
  await expect(first.locator(".mdmark-pin").first()).toBeAttached();
  await expect(first.locator("td", { hasText: "東京, 本社" })).toHaveText(
    "東京, 本社",
  );
  await expect(first.locator("td", { hasText: "大阪" })).toContainText(
    "（支店）",
  );
  await first.locator("thead th").nth(2).locator(".mdmark-sort").click();
  await expect(first.locator("tbody tr td:nth-child(3)")).toHaveText([
    "800",
    "950",
    "1200",
  ]);
  await expect(tables.nth(1)).toHaveAttribute("data-kind", "default");
  await expect(tables.nth(1).locator(".mdmark-sort")).toHaveCount(0);
  await expect(page.locator("#doc .mdmark-syntax-warning")).toHaveCount(0);
  await expect(page.locator("#doc code.language-text")).toContainText(
    "名前,拠点,金額",
  );
});

// 列の数がそろわない行は見出しにそろえ、警告に行番号を書く（異常シナリオ（CSV の列の数がそろわない））
test("test_error_when_csv_columns_mismatch", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, {
    markdown: ["```csv", "a,b,c", "1,2", "1,2,3,4", "```", ""].join("\n"),
  });
  // 検証
  const warning = page.locator("#doc .mdmark-syntax-warning");
  await expect(warning).toContainText("2 行目");
  await expect(warning).toContainText("3 行目");
  const rows = page.locator("#doc table tbody tr");
  await expect(rows.nth(0).locator("td")).toHaveText(["1", "2", ""]);
  await expect(rows.nth(1).locator("td")).toHaveText(["1", "2", "3"]);
});

// RAW のボタンで、表と書いたとおりの CSV を切り替える（正常シナリオ（CSV の表と元の CSV を切り替える））
test("test_normal_when_csv_raw_toggled", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: [
      "<!-- table: data filter=拠点 -->",
      "",
      "```csv",
      CSV,
      "```",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  });
  const wrapper = page.locator('#doc .mdmark-table[data-source="csv"]');
  const button = wrapper.locator(".mdmark-raw-toggle");
  // 検証: 描いた直後
  await expect(button).toHaveAttribute("aria-pressed", "false");
  const table = await wrapper.locator("table").boundingBox();
  const box = await button.boundingBox();
  expect(
    Math.abs(
      (box?.x ?? 0) +
        (box?.width ?? 0) -
        ((table?.x ?? 0) + (table?.width ?? 0)),
    ),
  ).toBeLessThanOrEqual(2);
  // 実行
  await button.click();
  // 検証
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(wrapper.locator("pre.mdmark-raw")).toBeVisible();
  await expect(wrapper.locator("pre.mdmark-raw")).toContainText(
    '北山,"東京, 本社",1200',
  );
  // 実行: Enter で押す
  await button.focus();
  await page.keyboard.press("Enter");
  // 検証
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(wrapper.locator("table")).toBeVisible();
  await expect(wrapper.locator(".mdmark-sort").first()).toBeVisible();
  await expect(wrapper.locator(".mdmark-filter").first()).toBeVisible();
});

/** 列の並べ替えを付けた表（`+reorder +columns`）・`+reorder` だけの表・`+reorder` も `+columns` も付けない表の文書 */
const REORDER_MARKDOWN = [
  "<!-- table: data +reorder +columns -->",
  "",
  "| 名前 | 型 | 既定 | 説明 |",
  "| --- | --- | --- | --- |",
  "| features.table | bool | true | 表の機能 |",
  "| features.html | bool | true | 埋め込んだ HTML |",
  "| build.include | string[] |  | まとめる文書 |",
  "",
  "<!-- /table -->",
  "",
  "<!-- table: data +reorder -->",
  "",
  "| 名前 | 型 |",
  "| --- | --- |",
  "| a | b |",
  "",
  "<!-- /table -->",
  "",
  "<!-- table: data -->",
  "",
  "| 名前 | 型 |",
  "| --- | --- |",
  "| c | d |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

/** `index` 番目の表の、見出しの最下段のセルの列名を左から並べて返す */
async function headNames(page: Page, index = 0): Promise<string[]> {
  const table = page.locator("#doc .mdmark-table").nth(index);
  const row = table.locator("thead tr").last();
  return (await row.locator("th:visible").allInnerTexts()).map((text) =>
    text.trim(),
  );
}

/** パネルの一覧の項目の列名を並んだ順に返す */
async function settingsNames(
  panel: ReturnType<Page["locator"]>,
): Promise<string[]> {
  return panel
    .locator(".mdmark-table-settings-item")
    .evaluateAll((items) =>
      items.map((item) => (item as HTMLElement).dataset.name ?? ""),
    );
}

// テーブル設定の一覧のつまみのドラッグと ↑・↓ キーで列を並べ替え、目のアイコンで列を隠す（正常シナリオ（列を並べ替える））
test("test_normal_when_columns_reordered", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: REORDER_MARKDOWN });
  const table = page.locator("#doc .mdmark-table").nth(0);
  const toggle = table.getByRole("button", { name: "テーブル設定" });
  const panel = settingsPanel(page, 0);
  // 検証: 見出しには行の並べ替えのボタンだけがあり、つまみが無い
  await expect(table.locator("thead .mdmark-table-settings-grip")).toHaveCount(
    0,
  );
  await expect(table.locator("thead button.mdmark-sort").first()).toBeVisible();
  await expect(toggle).toHaveAttribute("title", "テーブル設定");
  // 実行・検証: テーブル設定を押す
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".mdmark-table-settings-grip")).toHaveCount(4);
  await expect(panel.locator(".mdmark-table-settings-eye")).toHaveCount(4);
  await expect(eyeOf(panel, "名前")).toBeDisabled();
  await expect(panel).toContainText("先頭の列は隠せません");
  // 実行・検証: 説明のつまみを名前の上へドラッグする
  await gripOf(panel, "説明").dragTo(gripOf(panel, "名前"), {
    targetPosition: { x: 4, y: 1 },
  });
  expect(await headNames(page)).toEqual(["説明", "名前", "型", "既定"]);
  expect(
    await table.locator("tbody tr").first().locator("td").allInnerTexts(),
  ).toEqual(["表の機能", "features.table", "bool", "true"]);
  expect(await settingsNames(panel)).toEqual(["説明", "名前", "型", "既定"]);
  // 実行・検証: 型のつまみで ↓ キーを押す
  await gripOf(panel, "型").focus();
  await page.keyboard.press("ArrowDown");
  expect(await headNames(page)).toEqual(["説明", "名前", "既定", "型"]);
  await expect(gripOf(panel, "型")).toBeFocused();
  // 実行・検証: 説明の目のアイコンを押す
  await eyeOf(panel, "説明").click();
  await expect(head(page, "説明")).toBeHidden();
  await expect(eyeOf(panel, "説明")).toHaveAttribute("aria-pressed", "true");
  await expect(eyeOf(panel, "説明")).toHaveAttribute(
    "aria-label",
    "「説明」を表示",
  );
  await expect(toggle.locator(".mdmark-table-tool-badge")).toHaveText("1");
  await expect(eyeOf(panel, "名前")).toBeDisabled();
  await page.keyboard.press("Escape");
  // 実行・検証: 行を並べ替え、絞り込んでも列の順が変わらない
  await head(page, "名前").locator("button.mdmark-sort").click();
  expect(await headNames(page)).toEqual(["名前", "既定", "型"]);
  await filterByText(page, "名前", "html");
  expect(await headNames(page)).toEqual(["名前", "既定", "型"]);
  // 検証: ほかの表
  await page
    .locator("#doc .mdmark-table")
    .nth(1)
    .getByRole("button", { name: "テーブル設定" })
    .click();
  await expect(
    settingsPanel(page, 1).locator(".mdmark-table-settings-grip"),
  ).toHaveCount(2);
  await expect(
    settingsPanel(page, 1).locator(".mdmark-table-settings-eye"),
  ).toHaveCount(0);
  await expect(
    page
      .locator("#doc .mdmark-table")
      .nth(2)
      .locator(".mdmark-table-settings-toggle"),
  ).toHaveCount(0);
  // 実行・検証: 開き直すと Markdown の順に戻る
  await page.reload();
  await page.waitForFunction(() => "mdmark" in window);
  await mountDocument(page, { markdown: REORDER_MARKDOWN });
  expect(await headNames(page)).toEqual(["名前", "型", "既定", "説明"]);
});

/** 2 段の見出しで名前をピン止めし、設定の範囲を持つ表の文書 */
const REORDER_GROUPS_MARKDOWN = [
  "<!-- table: data +reorder +columns header-rows=2 pin=名前 -->",
  "",
  "| 名前 | 設定 | << | << | 備考 |",
  "| --- | --- | --- | --- | --- |",
  "| ^^ | 型 | 既定 | 必須 | ^^ |",
  "| features.table | bool | true | ✓ | 表の機能のオン・オフを決める、長い説明の文 |",
  "| features.html | bool | true |  | 埋め込んだ HTML のオン・オフを決める、長い説明の文 |",
  "",
  "<!-- /table -->",
  "",
].join("\n");

// 結合した見出しの範囲の中だけで列を動かし、範囲の外やピン止めの境をまたがせない（正常シナリオ（結合した見出しとピン止めの列を並べ替える））
test("test_normal_when_reordered_within_groups", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  await mountDocument(page, { markdown: REORDER_GROUPS_MARKDOWN });
  const table = page.locator("#doc .mdmark-table");
  const panel = settingsPanel(page);
  await table.getByRole("button", { name: "テーブル設定" }).click();
  // 検証: 一覧の分け方
  await expect(panel.locator(".mdmark-table-settings-group")).toHaveText([
    "ピン止めの列",
    "設定",
    "範囲の外の列",
  ]);
  await expect(gripOf(panel, "名前")).toBeDisabled();
  await expect(gripOf(panel, "備考")).toBeDisabled();
  // 実行・検証: 既定を型の上へドラッグする
  await gripOf(panel, "既定").dragTo(gripOf(panel, "型"), {
    targetPosition: { x: 4, y: 1 },
  });
  expect(await headNames(page)).toEqual(["既定", "型", "必須"]);
  await expect(table.locator("thead th", { hasText: "設定" })).toHaveAttribute(
    "colspan",
    "3",
  );
  // 実行・検証: 型を備考の下へドラッグしても動かず、線も出ない
  await gripOf(panel, "型").hover();
  await page.mouse.down();
  const notes = await panel
    .locator('.mdmark-table-settings-item[data-name="備考"]')
    .boundingBox();
  if (!notes) {
    throw new Error("備考の行の範囲を取れない");
  }
  await page.mouse.move(notes.x + 4, notes.y + notes.height - 1, { steps: 5 });
  await expect(panel.locator(".is-drop-before, .is-drop-after")).toHaveCount(0);
  await page.mouse.up();
  expect(await headNames(page)).toEqual(["既定", "型", "必須"]);
  // 実行・検証: 範囲の端の列で範囲の外へ向かう ↑ キーを押しても動かない
  await gripOf(panel, "既定").focus();
  await page.keyboard.press("ArrowUp");
  expect(await headNames(page)).toEqual(["既定", "型", "必須"]);
  await page.keyboard.press("Escape");
  // 検証: 横にスクロールしても名前の列が左端に留まる
  const name = table.locator("tbody tr").first().locator("td").first();
  const before = await name.boundingBox();
  await table.locator("table").evaluate((el) => {
    el.scrollLeft = 200;
  });
  const after = await name.boundingBox();
  expect(Math.round(after?.x ?? 0)).toBe(Math.round(before?.x ?? -1));
});

// キーの列を階層で描き、表に無い親を補い、ツールチップとコピーを付ける（正常シナリオ（キーの列を階層で描く））
test("test_normal_when_tree", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  // 実行
  await mountDocument(page, { markdown: treeMarkdown() });
  // 検証: 補った親の行
  for (const path of [
    "features",
    "aliases[]",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
  ]) {
    const row = treeRow(page, path);
    await expect(row).toHaveClass(/\bis-virtual\b/);
    await expect(row.locator(".mdmark-tree-name")).toHaveCSS(
      "font-style",
      "italic",
    );
    for (const cell of await row.locator("td:not(.mdmark-tree-key)").all()) {
      await expect(cell).toHaveText("");
    }
  }
  // 検証: 末尾の名前・縦線・横線
  const leaf = treeRow(page, "aliases[].metadata.alias_type.type");
  await expect(leaf.locator(".mdmark-tree-name")).toHaveText("type");
  await expect(leaf.locator(".mdmark-tree-guide")).toHaveCount(3);
  await expect(leaf.locator("td.mdmark-tree-key")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  // 実行・検証: ポインターを乗せるとツールチップ
  await leaf.locator(".mdmark-tree-name").hover();
  await expect(leaf.getByRole("tooltip")).toHaveText(
    "aliases[].metadata.alias_type.type",
  );
  // 実行・検証: ⧉ でコピー
  await leaf.locator("button.mdmark-tree-copy").click();
  await expect(leaf.locator("button.mdmark-tree-copy")).toContainText(
    "コピーしました",
  );
  expect(await writtenTexts(page)).toEqual([
    "aliases[].metadata.alias_type.type",
  ]);
  // 検証: 型・必須・既定
  await expect(
    page.locator('#doc .mdmark-type-badge[data-type="bool"]'),
  ).toHaveCount(2);
  await expect(leaf.locator(".mdmark-type-chip")).toHaveText(["ref", "custom"]);
  await expect(page.locator("#doc thead th", { hasText: "必須" })).toHaveCount(
    0,
  );
  const required = treeRow(page, "features.table").locator(
    ".mdmark-tree-required",
  );
  await expect(required).toHaveText("*");
  await expect(page.locator("#doc .mdmark-tree-required")).toHaveCount(1);
  await expect(
    treeRow(page, "features.table").locator(".mdmark-tree-default"),
  ).toHaveText("true");
  await expect(page.locator("#doc thead button.mdmark-sort")).toHaveCount(0);
});

// ▾ で子孫を畳み、Shift で入れ子をまとめて開閉し、畳んだ行もコピーに含める（正常シナリオ（階層を畳む・開く））
test("test_normal_when_tree_folded", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: treeMarkdown(" +copy") });
  const toggle = (path: string) =>
    treeRow(page, path).locator("button.mdmark-tree-toggle");
  const descendants = [
    "aliases[].id",
    "aliases[].metadata",
    "aliases[].metadata.alias_type",
    "aliases[].metadata.alias_type.type",
  ];
  // 検証: 子を持つ行だけにボタンがあり、全ての行が見えている
  await expect(page.locator("#doc button.mdmark-tree-toggle")).toHaveCount(4);
  await expect(
    treeRow(page, "features.table").locator("button.mdmark-tree-toggle"),
  ).toHaveCount(0);
  for (const row of await page.locator("#doc tr.mdmark-tree-row").all()) {
    await expect(row).toBeVisible();
  }
  // 実行・検証: 畳む
  await toggle("aliases[]").click();
  for (const path of descendants) {
    await expect(treeRow(page, path)).toBeHidden();
  }
  await expect(toggle("aliases[]")).toHaveAttribute("aria-expanded", "false");
  // 実行・検証: 開くと子だけを出し、子の開閉を保つ
  await toggle("aliases[]").click();
  await expect(treeRow(page, "aliases[].id")).toBeVisible();
  // 実行・検証: Shift で入れ子をまとめて畳み、開く
  await toggle("aliases[]").click({ modifiers: ["Shift"] });
  await expect(toggle("aliases[].metadata")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await toggle("aliases[]").click({ modifiers: ["Shift"] });
  for (const path of descendants) {
    await expect(treeRow(page, path)).toBeVisible();
  }
  // 実行・検証: Enter・Space
  await toggle("aliases[]").focus();
  await page.keyboard.press("Enter");
  await expect(treeRow(page, "aliases[].id")).toBeHidden();
  await page.keyboard.press(" ");
  await expect(treeRow(page, "aliases[].id")).toBeVisible();
  // 実行・検証: 畳んだままコピーする
  await toggle("aliases[]").click();
  await page.locator("#doc button.mdmark-copy").click();
  await page
    .locator('#doc button.mdmark-copy-format[data-format="markdown"]')
    .click();
  await expect(page.locator("#doc button.mdmark-copy")).toContainText(
    "コピーしました",
  );
  expect((await writtenTexts(page))[0]).toContain("| aliases[].id |");
});

// 末尾の名前で照合し、当たった行と親の行を残し、件数は補った行を数えない（正常シナリオ（階層の表を絞り込む））
test("test_normal_when_tree_filtered", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, {
    markdown: treeMarkdown(" +count filter=キー:text"),
  });
  const count = page.locator("#doc .mdmark-table-count");
  await treeRow(page, "features").locator("button.mdmark-tree-toggle").click();
  const shown = () =>
    page
      .locator("#doc tr.mdmark-tree-row:visible")
      .evaluateAll((rows) =>
        rows.map((row) => (row as HTMLElement).dataset.path),
      );
  // 実行・検証: id
  await filterByText(page, "キー", "id");
  await expect.poll(shown).toEqual(["aliases[]", "aliases[].id"]);
  await expect(
    treeRow(page, "aliases[].id").locator("mark.mdmark-tree-hit"),
  ).toHaveText("id");
  await expect(treeRow(page, "aliases[]").locator("mark")).toHaveCount(0);
  await expect(count).toContainText("1 / 4 件");
  // 実行・検証: metadata
  await filterByText(page, "キー", "metadata");
  await expect.poll(shown).toEqual(["aliases[]", "aliases[].metadata"]);
  await expect(
    treeRow(page, "aliases[].metadata").locator("mark.mdmark-tree-hit"),
  ).toHaveText("metadata");
  await expect(count).toContainText("0 / 4 件");
  // 実行・検証: 解除すると絞り込む前の開閉に戻る
  await filterByText(page, "キー", "");
  await expect(treeRow(page, "features.table")).toBeHidden();
  await expect(treeRow(page, "aliases[].id")).toBeVisible();
});

// 行を押すと同じ親の範囲の縦線を濃くし、別の行で付け替え、もう一度押すと解く（正常シナリオ（階層の行を選ぶ））
test("test_normal_when_tree_row_selected", async ({ page }) => {
  // 準備
  await stubClipboard(page, "allow");
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: treeMarkdown() });
  const activeRows = () =>
    page
      .locator("#doc tr.mdmark-tree-row")
      .evaluateAll((rows) =>
        rows
          .filter((row) =>
            row
              .querySelector(".mdmark-tree-guide")
              ?.classList.contains("is-active"),
          )
          .map((row) => (row as HTMLElement).dataset.path),
      );
  const html = treeRow(page, "features.html");
  // 実行・検証: features.html の行を押す
  await html.locator("td").last().click();
  await expect(html).toHaveAttribute("aria-selected", "true");
  expect(await activeRows()).toEqual(["features.table", "features.html"]);
  const activeWidth = await page
    .locator("#doc .mdmark-tree-guide.is-active")
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  const width = await treeRow(page, "aliases[].id")
    .locator(".mdmark-tree-guide")
    .first()
    .evaluate((el) => getComputedStyle(el).borderLeftWidth);
  expect(activeWidth).not.toBe(width);
  // 実行・検証: 別の行を押す
  await treeRow(page, "aliases[].id").locator("td").last().click();
  await expect(html).toHaveAttribute("aria-selected", "false");
  expect(await activeRows()).toContain("aliases[].id");
  // 実行・検証: 同じ行をもう一度押す
  await treeRow(page, "aliases[].id").locator("td").last().click();
  await expect(page.locator("#doc .mdmark-tree-guide.is-active")).toHaveCount(
    0,
  );
  // 実行・検証: ⧉ と ▾ では選ばない
  await html.locator("button.mdmark-tree-copy").click();
  await treeRow(page, "aliases[]").locator("button.mdmark-tree-toggle").click();
  await expect(page.locator('#doc tr[aria-selected="true"]')).toHaveCount(0);
});

// 表の行と見本の行を互いに強調し、見本の表示を切り替える（正常シナリオ（YAML の見本と連動する））
test("test_normal_when_tree_linked_to_example", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  await mountDocument(page, { markdown: TREE_EXAMPLE_MARKDOWN });
  const example = page.locator("#doc aside.mdmark-tree-example");
  const toggle = page.locator("#doc button.mdmark-tree-example-toggle");
  const linked = example.locator(
    '[role="tabpanel"]:not([hidden]) .mdmark-yaml-line.is-linked',
  );
  // 検証: 表の下に見本が既定で出る
  await expect(example).toBeVisible();
  await expect(example).toHaveAttribute("aria-label", "見本: 設定の見本");
  await expect(example.getByRole("tab")).toHaveText(["最小", "エイリアス"]);
  // 実行・検証: features.table の行を押す
  await treeRow(page, "features.table").locator("td").last().click();
  await expect(linked).toHaveCount(1);
  await expect(linked).toContainText("table:");
  // 実行・検証: 選んだキーが開いているタブに無いとき
  await treeRow(page, "aliases[].metadata.alias_type.type")
    .locator("td")
    .last()
    .click();
  await expect(linked).toHaveCount(0);
  // 実行・検証: エイリアスのタブで id の行を押す
  await example.getByRole("tab", { name: "エイリアス" }).click();
  await example.locator('.mdmark-yaml-line[data-path="aliases[].id"]').click();
  await expect(treeRow(page, "aliases[].id")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // 実行・検証: 見本を隠す
  await expect(toggle).toHaveText(/見本を隠す/);
  await toggle.click();
  await expect(example).toBeHidden();
  await expect(toggle).toHaveText(/見本を表示/);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

// 表に無い列名の tree=・tree= の無い type=・無い見出しの example= の表の上に書き方の警告を置き、読めた指定だけで描く（異常シナリオ（読めない階層の指定））
test("test_error_when_tree_options_invalid", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot);
  const table = (mark: string) =>
    treeMarkdown().replace(
      "<!-- table: data tree=キー type=型 required=必須 default=既定 -->",
      `<!-- table: ${mark} -->`,
    );
  // 実行
  await mountDocument(page, {
    markdown: [
      table("data tree=キー名"),
      table("data type=型"),
      table("data tree=キー example=見本"),
    ].join("\n"),
  });
  // 検証
  const warnings = page.locator("#doc .mdmark-syntax-warning");
  await expect(warnings).toHaveCount(3);
  await expect(warnings.nth(0)).toContainText("tree=キー名");
  await expect(warnings.nth(1)).toContainText("type=型");
  await expect(warnings.nth(2)).toContainText("example=見本");
  const tables = page.locator("#doc .mdmark-table");
  await expect(tables.nth(0).locator("tr.mdmark-tree-row")).toHaveCount(0);
  await expect(tables.nth(1).locator(".mdmark-type-badge")).toHaveCount(0);
  await expect(tables.nth(1)).toContainText("bool");
  await expect(
    tables.nth(2).locator("tr.mdmark-tree-row").first(),
  ).toBeVisible();
  await expect(page.locator("#doc .mdmark-tree-example")).toHaveCount(0);
  await expect(
    page.locator("#doc button.mdmark-tree-example-toggle"),
  ).toHaveCount(0);
});

/** 列名と 3 行の表を、`<!-- table: data -->` で囲んだ Markdown にする */
function dataTable(columns: string[]): string {
  const rows = [1, 2, 3].map(
    (row) => `| ${columns.map((_, i) => `値 ${row}-${i + 1}`).join(" | ")} |`,
  );
  return [
    "<!-- table: data -->",
    "",
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
}

/** 表の外側の枠・包む横のスクロールの要素・表の範囲と、横のスクロールの状態 */
function tableSizes(wrapper: ReturnType<Page["locator"]>) {
  return wrapper.evaluate((element) => {
    const scroller = element.querySelector<HTMLElement>(".mdmark-table-scroll");
    const table = element.querySelector("table");
    const heads = [...element.querySelectorAll<HTMLElement>("thead th")];
    return {
      wrapper: element.getBoundingClientRect().width,
      scrollerRight: scroller?.getBoundingClientRect().right ?? 0,
      tableRight: table?.getBoundingClientRect().right ?? 0,
      lastHeadRight: heads.at(-1)?.getBoundingClientRect().right ?? 0,
      overflows: scroller ? scroller.scrollWidth > scroller.clientWidth : false,
      // 端の影: はみ出す表は既定で先頭の列を留め、留めた列の右端に影を出す
      edgeShadows: element.querySelectorAll(".is-pinned-edge").length,
      headLines: heads.map((head) => {
        const label = head.querySelector(".mdmark-th") ?? head;
        const range = document.createRange();
        range.selectNodeContents(label);
        return new Set(
          [...range.getClientRects()]
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.round(rect.top)),
        ).size;
      }),
      widths: heads.map((head) => ({
        width: head.getBoundingClientRect().width,
        min: Number.parseFloat(getComputedStyle(head).minWidth) || 0,
      })),
    };
  });
}

// 列の少ない表を本文の幅まで広げ、本文の幅に収まらない表だけ表の中で横にスクロールさせる（正常シナリオ（表を本文の幅に広げる））
test("test_normal_when_table_fills_width", async ({ page }) => {
  // 準備: 描く先の要素の幅は 1000px
  await openPage(page, builtRoot, { hostCss: "#doc { width: 1000px; }" });
  const wide = Array.from({ length: 12 }, (_, i) => `列の見出し ${i + 1}`);
  // 実行
  await mountDocument(page, {
    markdown: [
      "本文の段落。",
      "",
      dataTable(["名前", "数量"]),
      dataTable(wide),
    ].join("\n"),
    config: { features: { "side-toc": false } },
  });
  const body = await page
    .locator("#doc > p")
    .first()
    .evaluate((element) => element.getBoundingClientRect().width);
  const tables = page.locator("#doc .mdmark-table");
  await expect(tables).toHaveCount(2);
  // 検証: 2 列の表の外側の枠が本文の幅で、右端の列の右端が枠の内側に揃い、横にスクロールせず、見出しが折り返さない
  const narrow = await tableSizes(tables.nth(0));
  expect(Math.abs(narrow.wrapper - body)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(narrow.lastHeadRight - narrow.tableRight),
  ).toBeLessThanOrEqual(1);
  expect(
    Math.abs(narrow.tableRight - narrow.scrollerRight),
  ).toBeLessThanOrEqual(1);
  expect(narrow.overflows).toBe(false);
  expect(narrow.edgeShadows).toBe(0);
  expect(narrow.headLines.every((lines) => lines === 1)).toBe(true);
  // 検証: 12 列の表の外側の枠が本文の幅で、表の中で横にスクロールでき、各列が列の最小幅以上
  const many = await tableSizes(tables.nth(1));
  expect(Math.abs(many.wrapper - body)).toBeLessThanOrEqual(1);
  expect(many.overflows).toBe(true);
  await expect
    .poll(async () => (await tableSizes(tables.nth(1))).edgeShadows)
    .toBeGreaterThan(0);
  for (const column of many.widths) {
    expect(column.width).toBeGreaterThanOrEqual(column.min - 1);
  }
  const scroller = tables.nth(1).locator(".mdmark-table-scroll");
  await scroller.evaluate((element) => {
    element.scrollLeft = 200;
  });
  expect(
    await scroller.evaluate((element) => element.scrollLeft),
  ).toBeGreaterThan(0);
  // 検証: ページに横スクロールが出ない
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
