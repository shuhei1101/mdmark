import { expect, test } from "vitest";
import {
  findTags,
  matches,
  outerHtml,
  plainText,
} from "../../../helpers/html.ts";
import MarkdownIt from "markdown-it";
import { renderDoc } from "../../../helpers/render.ts";

/** 表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTables = () => import("../../../../../src/render/syntax/tables.ts");

// 種類・機能・絞り込み・折り畳みを読み込む（正常系）
test("test_read_table_spec", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    features: { sort: { enabled: false } },
    columns: { 名前: { filter: {} }, 更新日: { filter: { type: "date" } } },
    collapse: { open: false },
  };
  // 実行
  const spec = readTableSpec(options, ["名前", "値", "更新日"], 10);
  // 検証: kind を省いた列は kind を持たない
  expect(spec.filters[0]).not.toHaveProperty("kind");
  expect(spec).toMatchObject({
    kind: "data",
    features: ["pin", "filter", "resize"],
    filters: [{ column: 0 }, { column: 2, kind: "date" }],
    collapse: "closed",
    warnings: [],
  });
});

// 列の設定を記載した機能を付け、hidden・total を読み込む（正常系）
test("test_read_table_spec_when_features", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    features: { count: {}, copy: {}, rowlink: {} },
    columns: {
      説明: { hidden: true },
      数量: { total: [{ calc: "sum" }] },
      名前: { total: [{ calc: "count" }] },
    },
  };
  // 実行
  const spec = readTableSpec(options, ["名前", "説明", "数量"], 10);
  // 検証
  expect(spec.features).toEqual([
    "sort",
    "pin",
    "filter",
    "resize",
    "count",
    "columns",
    "total",
    "copy",
    "rowlink",
  ]);
  expect(spec.hide).toEqual([1]);
  expect(spec.totals).toEqual([
    { column: 2, calc: "sum" },
    { column: 0, calc: "count" },
  ]);
  expect(spec.warnings).toEqual([]);
});

// pinned・width・format を列の位置として解釈する（正常系）
test("test_read_table_spec_when_columns", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    columns: {
      物理名: { pinned: true },
      No: { pinned: false },
      説明: { width: { mode: "nowrap", max: 30 } },
      必須: { format: { type: "check" } },
      既定: { format: { type: "check" } },
    },
  };
  // 実行
  const spec = readTableSpec(
    options,
    ["No", "物理名", "説明", "必須", "既定"],
    10,
  );
  // 検証
  expect(spec.pin).toEqual([1]);
  expect(spec.unpinned).toEqual([0]);
  expect(spec.widths).toEqual([{ column: 2, mode: "nowrap", max: 30 }]);
  expect(spec.check).toEqual([3, 4]);
  expect(spec.warnings).toEqual([]);
});

// 見出しと前の行に重ならない ID を作る（正常系）
test("test_row_id_of", async () => {
  // 準備
  const { rowIdOf } = await loadTables();
  const taken = new Set(["みかん", "みかん-1"]);
  // 実行
  const ids = ["りんご", "みかん", "みかん"].map((text) =>
    rowIdOf(text, taken),
  );
  // 検証
  expect(ids).toEqual(["りんご", "みかん-2", "みかん-3"]);
});

// 文字から ID が作れないときは row を元にする（正常系）
test("test_row_id_of_when_empty", async () => {
  // 準備
  const { rowIdOf } = await loadTables();
  const taken = new Set<string>();
  // 実行
  const ids = ["!!!", ""].map((text) => rowIdOf(text, taken));
  // 検証
  expect(ids).toEqual(["row", "row-1"]);
});

// 表のマーカーの表を指定どおりに囲み、囲まない表を default にする（正常系）
test("test_decorate_tables", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}, "collapse": {"open": false}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "",
    "<!-- /table -->",
    "",
    "| 列 |",
    "| --- |",
    "| x |",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    'data-kind="data" data-features="sort pin filter resize" data-filter="0:select"',
  );
  expect(html).toContain('<details class="mdmark-table-details">');
  expect(html).toContain('data-kind="default" data-features="pin resize"');
});

// 閉じのマーカーが無いときは文書の終わりまでの表に当て、警告を差し込む（正常系）
test("test_decorate_tables_when_range_not_closed", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 列 |",
    "| --- |",
    "| x |",
    "",
    "| 別の列 |",
    "| --- |",
    "| y |",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(matches(html, /data-kind="data"/g)).toHaveLength(2);
  expect(html).toContain("mdmark-syntax-warning");
  expect(html).toContain("&lt;!-- /table --&gt;");
});

// 5 つの機能と hidden・total を属性にコピーし、行に ID とリンクを付ける（正常系）
test("test_decorate_tables_when_features", () => {
  // 準備
  const markdown = [
    "## みかん",
    "",
    '<!-- table: {"kind": "data", "features": {"count": {}, "copy": {}, "rowlink": {}}, "columns": {"説明": {"hidden": true}, "数量": {"total": [{"calc": "sum"}]}}} -->',
    "",
    "| 名前 | 説明 | 数量 |",
    "| --- | --- | --- |",
    "| りんご | 描画を速くする | 1 |",
    "| みかん | 印刷を修正する | 2 |",
    "| みかん | 描画の崩れを修正する | 3 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 囲みの属性
  expect(html).toContain(
    'data-features="sort pin filter resize count columns total copy rowlink"',
  );
  expect(html).toContain('data-hide="1"');
  expect(html).toContain('data-total="2:sum"');
  // 検証: 行の ID（見出しの ID `みかん` と重ならない）
  const rowIds = findTags(html, "<tr")
    .map((tag) => /\sid="([^"]*)"/.exec(tag)?.[1])
    .filter((id) => id !== undefined);
  expect(rowIds).toEqual(["りんご", "みかん-1", "みかん-2"]);
  // 検証: 先頭のセルの行へのリンク
  const hrefs = findTags(html, "mdmark-row-anchor").map(
    (tag) => /\shref="([^"]*)"/.exec(tag)?.[1],
  );
  expect(hrefs).toEqual(["#りんご", "#みかん-1", "#みかん-2"]);
});

// 集計する列の数として読み込めないセルを、列と計算ごとの警告にして表の上に差し込む（異常系）
test("test_decorate_tables_when_total_unreadable", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}, {"calc": "avg"}, {"calc": "count"}]}}} -->',
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 12 |",
    "| b | 約3 |",
    "| c |  |",
    "| d | - |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 警告は合計と平均の 2 つで、どちらも表の前にある
  expect(matches(html, /<div class="mdmark-syntax-warning"/g)).toHaveLength(2);
  const table = html.indexOf('<div class="mdmark-table"');
  expect(table).toBeGreaterThan(0);
  expect(html.lastIndexOf("mdmark-syntax-warning")).toBeLessThan(table);
  // 検証: 読み込めない値は行内のコードで並び、計算の名前を記載する
  const message = (calc: string): string =>
    `「数量」の列に数として読み込めない値 <code>約3</code>・<code>-</code> があるため、${calc}を出していません。数を記載するか、セルを空にしてください。`;
  expect(html).toContain(message("合計"));
  expect(html).toContain(message("平均"));
  // 検証: count の警告は無い
  expect(html).not.toContain("件数を出していません");
});

// 数として読み込めないセルが無ければ警告を差し込まない（正常系）
test("test_decorate_tables_when_total_readable", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"数量": {"total": [{"calc": "sum"}, {"calc": "avg"}]}}} -->',
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| a | 1,000 |",
    "| b |  |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).not.toContain("mdmark-syntax-warning");
});

// table がオフなら今の表のままにする（正常系）
test("test_decorate_tables_when_feature_off", () => {
  // 準備
  const markdown = "## 変数\n\n| 列 |\n| --- |\n| x |\n";
  // 実行
  const { html } = renderDoc(markdown, { table: false });
  // 検証
  expect(html).toMatch(/<table tabindex="0" aria-label="[^"]*">/);
  expect(html).not.toContain("mdmark-table");
});

// 折り畳みの見出しを collapse.title か本文の行の数にする（正常系）
test("test_decorate_tables_when_collapse_title", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "collapse": {"open": false}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- table: {"kind": "data", "collapse": {"open": true, "title": "リリースの一覧"}} -->',
    "",
    "| 名前 | 値 |",
    "| --- | --- |",
    "| a | 1 |",
    "| b | 2 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  expect(html).toContain(
    '<details class="mdmark-table-details"><summary>表（3 行）</summary>',
  );
  expect(html).toContain(
    '<details class="mdmark-table-details" open><summary>リリースの一覧</summary>',
  );
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 行の詳細の中に表を配置しても、親の表の行を全て親の表の囲みに残し、列名・行の数・行へのリンク・集計を親の表の行だけで付ける（正常系）
test("test_decorate_tables_when_row_detail_has_table", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "features": {"rowlink": {}}, "columns": {"数量": {"total": [{"calc": "sum"}]}}, "collapse": {"open": false}} -->',
    "",
    "| 名前 | 数量 |",
    "| --- | --- |",
    "| Todo | 1 |",
    "| Done | 2 |",
    "",
    "<!-- /table -->",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の囲みの外に行が出ない
  const parent = outerHtml(html, 'data-kind="data"');
  expect(html.slice(html.indexOf(parent) + parent.length)).not.toContain("<tr");
  // 検証: 親の行のセルの列名が親の表の見出しになり、行の数と行へのリンクが親の行だけになる
  const parentTable = outerHtml(parent, "<table ");
  expect(parentTable).toContain('<td data-label="数量">2</td>');
  expect(matches(parentTable, /data-label="名前"/g)).toHaveLength(2);
  expect(matches(parentTable, /data-label="数量"/g)).toHaveLength(2);
  expect(parent).toContain("<summary>表（2 行）</summary>");
  expect(findTags(parentTable, 'id="todo"')).toHaveLength(1);
  expect(findTags(parentTable, 'id="done"')).toHaveLength(1);
  // 検証: 詳細の行の中の表は既定の種類の囲みに入り、中の表の見出しで列名を付け、行のリンクを持たない
  const nested = outerHtml(parentTable, 'data-kind="default"');
  expect(matches(nested, /data-label="引数"/g)).toHaveLength(1);
  expect(matches(nested, /data-label="値"/g)).toHaveLength(1);
  expect(findTags(nested, "<tr").filter((tag) => tag.includes(" id="))).toEqual(
    [],
  );
  // 検証: 数として読み込めない値の警告が無い
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 表のマーカーの外の表でも、行の詳細の中の表の後ろの親の行を親の表の囲みに残す（正常系）
test("test_decorate_tables_when_row_detail_has_table_without_mark", () => {
  // 準備
  const markdown = [
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| Todo | a |",
    "| Done | b |",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の表が既定の種類の囲みに入り、Done の行が親の表の中にある
  const parent = outerHtml(html, 'data-kind="default"');
  expect(html.slice(html.indexOf(parent) + parent.length)).not.toContain("<tr");
  const parentTable = outerHtml(parent, "<table ");
  expect(parentTable).toContain('<td data-label="説明">b</td>');
  expect(matches(parentTable, /data-label="名前"/g)).toHaveLength(2);
  expect(matches(parentTable, /data-label="説明"/g)).toHaveLength(2);
});

// 行の詳細の中の表には、その表を囲む表のマーカーだけを当て、外の表のマーカーの指定を適用しない（正常系）
test("test_decorate_tables_when_row_detail_has_marked_table", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}}} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| Todo | a |",
    "| Done | b |",
    "",
    "<!-- /table -->",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    '<!-- table: {"kind": "plain"} -->',
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| status | todo |",
    "",
    "<!-- /table -->",
    "",
    "<!-- /row-detail -->",
    "",
    '<!-- row-detail: {"at": 2} -->',
    "",
    "| 引数 | 値 |",
    "| --- | --- |",
    "| mode | fast |",
    "",
    "<!-- /row-detail -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 親の表は外の表のマーカー、1 つ目の中の表は中のマーカー、2 つ目の中の表は既定の種類になる
  const wrappers = findTags(html, 'class="mdmark-table"');
  expect(wrappers).toHaveLength(3);
  expect(wrappers[0]).toContain('data-kind="data"');
  expect(wrappers[0]).toContain('data-filter="0:select"');
  expect(wrappers[1]).toContain('data-kind="plain"');
  expect(wrappers[2]).toContain('data-kind="default"');
  expect(wrappers[2]).not.toContain("data-filter");
  // 検証: 記載の警告が無く、表のマーカーのコメントが出力に残らない
  expect(html).not.toContain("mdmark-syntax-warning");
  expect(html).not.toContain("<!-- table");
  expect(html).not.toContain("<!-- /table");
});

// 列の強調と行の色を属性にする（正常系）
test("test_decorate_tables_when_colors", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"金額": {"highlight": {}}}, "rows": {"colors": [{"column": "状態", "value": "完了", "color": "green"}, {"at": 2, "color": "red"}]}} -->',
    "",
    "| 名前 | 状態 | 金額 |",
    "| --- | --- | --- |",
    "| a | 完了 | 100 |",
    "| b | 保留 | 200 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 金額の列の見出しと 2 つのセル
  const highlighted = findTags(html, "mdmark-col-highlight");
  expect(highlighted.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(highlighted.filter((tag) => tag.startsWith("<td"))).toHaveLength(2);
  for (const tag of highlighted) {
    expect(tag).toContain('data-color="blue"');
  }
  // 検証: 本文の行の色
  const rows = matches(html, /<tr\b[^>]*data-color="[a-z]+"[^>]*>/g);
  expect(rows.map((row) => /data-color="([a-z]+)"/.exec(row)?.[1])).toEqual([
    "green",
    "red",
  ]);
  expect(html).not.toContain("mdmark-syntax-warning");
});

// pinned・format を属性にコピーし、折り返さない列と真偽値の列のセルに class を付け、真偽値を ✓ と空欄にする（正常系）
test("test_decorate_tables_when_columns_specified", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"物理名": {"pinned": true}, "説明": {"width": {"mode": "nowrap"}}, "必須": {"format": {"type": "check"}}}} -->',
    "",
    "| No | 物理名 | 説明 | 必須 |",
    "| --- | --- | --- | --- |",
    "| 1 | id | 行の ID | true |",
    "| 2 | name | 表示する名前 | false |",
    "| 3 | note | 備考 | 未定 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証: 囲みの属性
  const wrapper = findTags(html, 'class="mdmark-table"')[0] ?? "";
  expect(wrapper).toContain('data-pin="1"');
  expect(wrapper).toContain('data-check="3"');
  // 検証: 広く取る列と真偽値の列の class
  const wide = findTags(html, "mdmark-wide");
  expect(wide.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(wide.filter((tag) => tag.startsWith("<td"))).toHaveLength(3);
  const centered = findTags(html, "mdmark-align-center");
  expect(centered.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(centered.filter((tag) => tag.startsWith("<td"))).toHaveLength(3);
  // 検証: 真偽値のセル
  const checkCells = matches(
    html,
    /<td\b[^>]*mdmark-align-center[^>]*>[\s\S]*?<\/td>/g,
  );
  expect(checkCells).toHaveLength(3);
  const [yes = "", no = "", other = ""] = checkCells;
  expect(yes).toContain('data-value="true"');
  expect(yes).toContain('class="mdmark-check"');
  expect(no).toContain('data-value="false"');
  expect(no).toContain('class="mdmark-visually-hidden"');
  expect(no).not.toContain("mdmark-check");
  expect(plainText(no)).toBe("いいえ");
  expect(other).not.toContain("data-value");
  expect(plainText(other)).toBe("未定");
  expect(html).not.toContain("mdmark-syntax-warning");
});

/** 全角の文字を指定した数だけ並べる */
const wide = (count: number): string => "あ".repeat(count);

// 長文の列と列の幅の範囲を囲みに写し、種類を省いた絞り込みを長文の列なら text にする（正常系）
test("test_decorate_tables_when_long_columns", () => {
  // 準備: インターフェース定義『文書をHTML文字列にする』の「正常系（長文の列と列の幅の範囲）」の文書
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"名前": {"filter": {}}, "説明": {"filter": {}, "width": {"min": 20, "max": 30}}, "備考": {"filter": {"type": "select"}, "width": {"max": 12}}}} -->',
    "",
    "| 名前 | 説明 | 手順 | 備考 |",
    "| --- | --- | --- | --- |",
    `| ${wide(6)} | ${wide(120)} | ${wide(10)}<br>${wide(10)}<br>${wide(10)} | ${wide(80)} |`,
    `| ${wide(4)} | ${wide(100)} | ${wide(8)} | ${wide(60)} |`,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const wrapper = findTags(html, 'class="mdmark-table"')[0] ?? "";
  expect(wrapper).toContain('data-long="1 3"');
  expect(wrapper).toContain('data-width="1:20-30 3:-12"');
  expect(wrapper).toContain('data-filter="0:select 1:text 3:select"');
  expect(html).not.toContain("mdmark-syntax-warning");
});

// width.mode が nowrap の長文の列も data-long に入れ、種類を省いた絞り込みを text にする（正常系）
test("test_decorate_tables_when_nowrap_long_column", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "columns": {"説明": {"width": {"mode": "nowrap"}, "filter": {}}}} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    `| ${wide(4)} | ${wide(120)} |`,
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const wrapper = findTags(html, 'class="mdmark-table"')[0] ?? "";
  expect(wrapper).toContain('data-long="1"');
  expect(wrapper).toContain('data-filter="1:text"');
  const wideTags = findTags(html, "mdmark-wide");
  expect(wideTags.filter((tag) => tag.startsWith("<th"))).toHaveLength(1);
  expect(wideTags.filter((tag) => tag.startsWith("<td"))).toHaveLength(1);
});

// <br> で行を分け、行内のコードとバッジだけのセルを短い値にする（正常系）
test("test_column_lines_of", async () => {
  // 準備
  const { columnLinesOf } = await loadTables();
  const tokens = new MarkdownIt({ html: true }).parse(
    [
      "| 手順 | 状態 | コード | 説明 |",
      "| --- | --- | --- | --- |",
      "| 測る<br>分ける | `badge:対応中` | `npm run build` | 描画を速くする |",
      "",
    ].join("\n"),
    {},
  );
  const tableOpen = tokens.findIndex((token) => token.type === "table_open");
  // 実行
  const columns = columnLinesOf(tokens, tableOpen);
  // 検証
  expect(columns.map((column) => column.head)).toEqual([
    ["手順"],
    ["状態"],
    ["コード"],
    ["説明"],
  ]);
  expect(columns.map((column) => column.cells[0])).toEqual([
    { lines: ["測る", "分ける"], compact: false },
    { lines: ["対応中"], compact: true },
    { lines: ["npm run build"], compact: true },
    { lines: ["描画を速くする"], compact: false },
  ]);
});

// 列の強調と、値と位置の行の色を読み込む（正常系）
test("test_read_table_colors", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const options = {
    columns: { 金額: { highlight: {} } },
    rows: {
      colors: [
        { column: "状態", value: "完了", color: "green" },
        { column: "状態", value: "保留", color: "yellow" },
        { at: 3, color: "red" },
      ],
    },
  };
  const cells = [
    ["a", "完了", "1"],
    ["b", "保留", "2"],
    ["c", "未着手", "3"],
  ];
  // 実行
  const colors = readTableColors(options, ["名前", "状態", "金額"], cells);
  // 検証
  expect(colors.highlight).toEqual([{ column: 2, color: "blue" }]);
  expect(colors.rows).toEqual(["green", "yellow", "red"]);
  expect(colors.warnings).toEqual([]);
});

// 複数が該当する行は後ろの要素の色にし、範囲を読み込む（正常系）
test("test_read_table_colors_when_overlap", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const options = {
    columns: {
      名前: { highlight: { color: "red" } },
      金額: { highlight: {} },
    },
    rows: {
      colors: [
        { column: "状態", value: "完了", color: "green" },
        { at: { from: 1, to: 2 }, color: "gray" },
      ],
    },
  };
  const cells = [
    ["a", "完了", "1"],
    ["b", "完了", "2"],
    ["c", "完了", "3"],
  ];
  // 実行
  const colors = readTableColors(options, ["名前", "状態", "金額"], cells);
  // 検証
  expect(colors.highlight).toEqual([
    { column: 0, color: "red" },
    { column: 2, color: "blue" },
  ]);
  expect(colors.rows).toEqual(["gray", "gray", "green"]);
});

// 表に照らせない指定を警告にし、片方だけの要素を当てない（異常系）
test("test_read_table_colors_when_unreadable", async () => {
  // 準備
  const { readTableColors } = await loadTables();
  const options = {
    columns: { 無い列: { highlight: {} } },
    rows: {
      colors: [
        { column: "状態", color: "green" },
        { at: 9, color: "red" },
      ],
    },
  };
  const cells = [
    ["a", "完了"],
    ["b", "保留"],
  ];
  // 実行
  const colors = readTableColors(options, ["名前", "状態"], cells);
  // 検証
  expect(colors.highlight).toEqual([]);
  expect(colors.rows).toEqual([null, null]);
  expect(colors.warnings.map((warning) => warning.label)).toEqual([
    "無い列",
    "9",
  ]);
});

// 多段の見出し・行見出し・結合したセルにし、マーカーの外の表は結合しない（正常系）
test("test_decorate_tables_when_cells_merged", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "header": {"rows": 2, "columns": 1}} -->',
    "",
    "| 地域 | 上期 | << | 下期 |",
    "| --- | --- | --- | --- |",
    "| 地域 | 売上 | 件数 | 売上 |",
    "| A | 1 | 2 | 3 |",
    "| ^^ | 4 | 5 | 6 |",
    "| ^^ | 7 | 8 | 9 |",
    "",
    "<!-- /table -->",
    "",
    "| 列 | 値 |",
    "| --- | --- |",
    "| ^^ | << |",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const marked = outerHtml(html, 'data-kind="data"');
  const thead = marked.slice(
    marked.indexOf("<thead"),
    marked.indexOf("</thead>"),
  );
  expect(matches(thead, /<tr/g)).toHaveLength(2);
  const firstRow = thead.slice(0, thead.indexOf("</tr>"));
  const headCells = findTags(firstRow, "<th").filter(
    (tag) => !tag.startsWith("<thead"),
  );
  expect(headCells[1]).toContain('colspan="2"');
  expect(headCells[1]).toContain('scope="colgroup"');
  expect(firstRow).not.toContain("&lt;&lt;");
  const tbody = marked.slice(marked.indexOf("<tbody"));
  const rowHeads = findTags(tbody, '<th scope="row"');
  expect(rowHeads).toHaveLength(3);
  expect(rowHeads[0]).toContain('rowspan="3"');
  for (const cell of rowHeads.slice(1)) {
    expect(cell).toContain('data-merge="up"');
    expect(cell).toContain("hidden");
  }
  expect(matches(tbody, /<th[^>]*data-merge="up"[^>]*>A<\/th>/g)).toHaveLength(
    2,
  );
  expect(marked).toContain('data-merge-columns="0"');
  const plain = html.slice(html.lastIndexOf("<table"));
  expect(plain).toContain("^^");
  expect(plain).toContain("&lt;&lt;");
  expect(plain).not.toContain("data-merge");
  expect(plain).not.toContain("rowspan");
  expect(html).not.toContain("mdmark-syntax-warning");
});

// 表に収まらない header.rows と結合する相手の無いセルを 1 つの警告にまとめ、文字のまま出す（異常系）
test("test_decorate_tables_when_merge_invalid", () => {
  // 準備
  const markdown = [
    '<!-- table: {"kind": "data", "header": {"rows": 5}} -->',
    "",
    "| << | 値 |",
    "| --- | --- |",
    "| a | ^^ |",
    "| b | 2 |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const { html } = renderDoc(markdown);
  // 検証
  const warnings = findTags(html, 'class="mdmark-syntax-warning"');
  expect(warnings).toHaveLength(1);
  const warning = html.slice(
    html.indexOf("mdmark-syntax-warning"),
    html.indexOf("<table"),
  );
  expect(warning).toContain("header.rows");
  expect(warning).toContain("^^");
  expect(warning).toContain("&lt;&lt;");
  const table = html.slice(html.indexOf("<table"));
  const thead = table.slice(table.indexOf("<thead"), table.indexOf("</thead>"));
  expect(matches(thead, /<tr/g)).toHaveLength(1);
  expect(table).toContain("^^");
  expect(table).toContain("&lt;&lt;");
  expect(table).not.toContain("rowspan");
  expect(table).not.toContain("colspan");
  expect(table).not.toContain("data-merge=");
  expect(html).toContain('data-features="sort pin filter resize"');
});

// 表に無い列名を警告にして適用しない（異常系）
test("test_read_table_spec_when_unknown_column", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    columns: { 無い列: { filter: {} }, 名前: { pinned: true } },
  };
  // 実行
  const spec = readTableSpec(options, ["名前", "値"], 10);
  // 検証
  expect(spec.filters).toEqual([]);
  expect(spec.pin).toEqual([0]);
  expect(spec.warnings).toHaveLength(1);
  const text = JSON.stringify(spec.warnings[0]);
  expect(text).toContain("無い列");
  expect(text).toContain("名前");
  expect(text).toContain("値");
});

// enabled を false にした機能の列の設定を適用しない（正常系）
test("test_read_table_spec_when_feature_disabled", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    features: { total: { enabled: false } },
    columns: { 数量: { total: [{ calc: "sum" }] } },
  };
  // 実行
  const spec = readTableSpec(options, ["名前", "数量"], 10);
  // 検証
  expect(spec.features).not.toContain("total");
  expect(spec.totals).toEqual([]);
  expect(spec.warnings).toEqual([]);
});

// 先頭の列の hidden を警告にして適用しない（異常系）
test("test_read_table_spec_when_first_column_hidden", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = { kind: "data", columns: { 名前: { hidden: true } } };
  // 実行
  const spec = readTableSpec(options, ["名前", "数量"], 10);
  // 検証
  expect(spec.hide).toEqual([]);
  expect(spec.warnings).toHaveLength(1);
  expect(JSON.stringify(spec.warnings[0])).toContain("名前");
});

// 見出しの行の数と行見出しの列の数を読み取る（正常系）
test("test_read_table_spec_when_header", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = { kind: "data", header: { rows: 2, columns: 1 } };
  // 実行
  const spec = readTableSpec(options, ["A", "B", "C", "D"], 5);
  // 検証
  expect(spec.headRows).toBe(2);
  expect(spec.rowHeader).toBe(1);
  expect(spec.warnings).toEqual([]);
});

// 表に収まらない数を既定にして警告にする（異常系）
test("test_read_table_spec_when_header_too_large", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = { kind: "data", header: { rows: 5, columns: 3 } };
  // 実行
  const spec = readTableSpec(options, ["A", "B", "C"], 3);
  // 検証
  expect(spec.headRows).toBe(1);
  expect(spec.rowHeader).toBe(0);
  const texts = spec.warnings.map((warning) => JSON.stringify(warning));
  expect(texts).toHaveLength(2);
  expect(texts[0]).toContain("header.rows");
  expect(texts[0]).toContain("3");
  expect(texts[1]).toContain("header.columns");
  expect(texts[1]).toContain("3");
});

// tree の列を読み込み、sort を除く（正常系）
test("test_read_table_spec_when_tree", async () => {
  // 準備
  const { readTableSpec } = await loadTables();
  const options = {
    kind: "data",
    tree: {
      key: { column: "キー" },
      type: { column: "型" },
      example: { heading: "YAML" },
    },
  };
  // 実行
  const spec = readTableSpec(options, ["キー", "型", "説明"], 10);
  // 検証
  expect(spec.tree).toBe(0);
  expect(spec.treeType).toBe(1);
  expect(spec.example).toBe("YAML");
  expect(spec.features).not.toContain("sort");
});
