import { expect, type Page, test } from "@playwright/test";
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

// 既定の種類の表は、縦にスクロールしても見出し行が留まり、押した列までを左端に留める（正常シナリオ（ピン止めする））
test("test_normal_when_pinned", async ({ page }) => {
  // 準備
  await openPage(page, builtRoot, { hostCss: NARROW_HOST_CSS });
  await mountDocument(page, { markdown: wideTable() });
  const table = page.locator("#doc table");
  const pins = page.locator("#doc button.mdmark-pin:not([hidden])");
  await expect(pins).toHaveCount(10);
  await expect(page.locator("#doc button.mdmark-sort")).toHaveCount(0);
  /** 表の枠に対する、指定した要素の左端と上端の位置 */
  const offset = async (selector: string) => {
    const box = await table.boundingBox();
    const target = await page.locator(selector).first().boundingBox();
    if (!box || !target) {
      throw new Error("要素の位置を取れない");
    }
    return { left: target.x - box.x, top: target.y - box.y };
  };
  // 実行・検証: 縦にスクロールする
  await table.evaluate((el) => {
    el.scrollTop = 300;
  });
  expect((await offset("#doc thead th")).top).toBeLessThan(8);
  // 実行・検証: 2 列目のピン止めを押して横にスクロールする
  await pins.nth(1).click();
  await expect(pins.nth(1)).toHaveAttribute("aria-pressed", "true");
  await table.evaluate((el) => {
    el.scrollLeft = 600;
  });
  expect((await offset("#doc thead th:nth-child(1)")).left).toBeLessThan(8);
  const second = await offset("#doc thead th:nth-child(2)");
  expect(second.left).toBeGreaterThan(0);
  expect(second.left).toBeLessThan(200);
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
