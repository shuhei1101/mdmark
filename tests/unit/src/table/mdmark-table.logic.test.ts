import { expect, test } from "vitest";

/** 表のカスタム要素の指定の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLogic = () => import("../../../../src/table/mdmark-table.logic.ts");

/** 4 列の列の定義 */
const columns = () => [
  { key: "title", title: "タイトル" },
  { key: "state", title: "状態" },
  { key: "owner", title: "担当" },
  { key: "updated", title: "更新日" },
];

/** 2 行の行のデータ（文字列・数値・null を含む） */
const rows = () => [
  {
    key: "R1",
    values: { title: "設計", state: "未着手", owner: "佐藤", updated: null },
  },
  {
    key: "R2",
    values: { title: "列の幅", state: "進行中", owner: "鈴木", updated: 12 },
  },
];

// 正しい指定は誤りが無い（正常系）
test("test_check_table_spec", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  // 実行
  const issue = checkTableSpec({
    columns: columns(),
    rows: rows(),
    features: { count: {}, add: {} },
  });
  // 検証
  expect(issue).toBeUndefined();
});

// 行のデータが配列でない（異常系）
test("test_check_table_spec_when_rows_not_array", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  // 実行
  const issue = checkTableSpec({
    columns: columns(),
    rows: "R1",
    features: undefined,
  });
  // 検証
  expect(issue?.path).toBe("rows");
});

// 列名が重なる（異常系）
test("test_check_table_spec_when_title_duplicated", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  const duplicated = [
    { key: "a", title: "担当" },
    { key: "b", title: "担当" },
  ];
  // 実行
  const issue = checkTableSpec({
    columns: duplicated,
    rows: [],
    features: undefined,
  });
  // 検証
  expect(issue?.path).toBe("columns[1].title");
});

// 受け付けない機能（異常系）
test("test_check_table_spec_when_feature_unknown", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  // 実行
  const issue = checkTableSpec({
    columns: columns(),
    rows: rows(),
    features: { total: {} },
  });
  // 検証
  expect(issue?.path).toBe("features.total");
});

// 機能の enabled が真偽値でない（異常系）
test("test_check_table_spec_when_feature_enabled_invalid", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  // 実行
  const issue = checkTableSpec({
    columns: columns(),
    rows: rows(),
    features: { resize: { enabled: "no" } },
  });
  // 検証
  expect(issue?.path).toBe("features.resize.enabled");
});

// 値が文字列・有限の数値・null でない（異常系）
test("test_check_table_spec_when_value_invalid", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  const withObject = rows();
  withObject[0] = {
    key: "R1",
    values: { ...withObject[0].values, owner: {} as unknown as string },
  };
  const withNaN = rows();
  withNaN[0] = {
    key: "R1",
    values: { ...withNaN[0].values, owner: Number.NaN as unknown as string },
  };
  // 実行
  const objectIssue = checkTableSpec({
    columns: columns(),
    rows: withObject,
    features: undefined,
  });
  const nanIssue = checkTableSpec({
    columns: columns(),
    rows: withNaN,
    features: undefined,
  });
  // 検証
  expect(objectIssue?.path).toBe("rows[0].values.owner");
  expect(nanIssue?.path).toBe("rows[0].values.owner");
});

// 先頭の列を隠す指定（異常系）
test("test_check_table_spec_when_first_column_hidden", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  const hidden = columns();
  hidden[0] = { ...hidden[0], hidden: true } as (typeof hidden)[0];
  // 実行
  const issue = checkTableSpec({
    columns: hidden,
    rows: rows(),
    features: undefined,
  });
  // 検証
  expect(issue?.path).toBe("columns[0].hidden");
});

// 行のキーが重なる（異常系）
test("test_check_table_spec_when_row_key_duplicated", async () => {
  // 準備
  const { checkTableSpec } = await loadLogic();
  const duplicated = rows();
  duplicated[1] = { ...duplicated[1], key: "R1" };
  // 実行
  const issue = checkTableSpec({
    columns: columns(),
    rows: duplicated,
    features: undefined,
  });
  // 検証
  expect(issue?.path).toBe("rows[1].key");
});

// 列の定義の機能と位置を引数に写す（正常系）
test("test_to_table_options", async () => {
  // 準備
  const { toTableOptions } = await loadLogic();
  const spec = {
    columns: [
      { key: "title", title: "タイトル", pinned: true },
      { key: "state", title: "状態", filter: {} },
      { key: "owner", title: "担当", editable: true },
      { key: "updated", title: "更新日", hidden: true },
    ],
    rows: rows(),
    features: { count: {}, reorder: {}, add: {} },
  };
  // 実行
  const options = toTableOptions(spec);
  // 検証
  expect(options.kind).toBe("data");
  expect(options.features).toEqual(
    expect.arrayContaining([
      "sort",
      "pin",
      "filter",
      "resize",
      "count",
      "reorder",
      "columns",
    ]),
  );
  expect(options.features).not.toContain("add");
  expect(options.pin).toEqual([0]);
  expect(options.filters).toEqual([{ column: 1, kind: "select" }]);
  expect(options.editable).toEqual([2]);
  expect(options.hide).toEqual([3]);
  expect(options.addRow).toBe(true);
  expect(options.pressable).toBe(true);
  expect(options.rowKeys).toEqual(["R1", "R2"]);
  expect(options.columnKeys).toEqual(["title", "state", "owner", "updated"]);
});

// 列名と値をエスケープし、数値と null を文字にする（正常系）
test("test_to_table_options_when_html", async () => {
  // 準備
  const { toTableOptions } = await loadLogic();
  const spec = {
    columns: [
      { key: "a", title: "<b>" },
      { key: "b", title: "数" },
      { key: "c", title: "空" },
    ],
    rows: [
      {
        key: "R1",
        values: { a: "<script>alert(1)</script>", b: 12, c: null },
      },
    ],
    features: undefined,
  };
  // 実行
  const options = toTableOptions(spec);
  // 検証
  expect(options.columns?.[0]).toBe("&lt;b&gt;");
  expect(options.rows?.[0]).toEqual([
    "&lt;script&gt;alert(1)&lt;/script&gt;",
    "12",
    "",
  ]);
});

// enabled が false の機能を既定から削除する（正常系）
test("test_to_table_options_when_feature_removed", async () => {
  // 準備
  const { toTableOptions } = await loadLogic();
  // 実行
  const options = toTableOptions({
    columns: columns(),
    rows: rows(),
    features: { resize: { enabled: false } },
  });
  // 検証
  expect(options.features).not.toContain("resize");
});

// 文字列・数値・null を文字にする（正常系）
test("test_cell_text", async () => {
  // 準備
  const { cellText } = await loadLogic();
  // 実行
  const texts = [cellText("佐藤"), cellText(12.5), cellText(null), cellText(undefined)];
  // 検証
  expect(texts).toEqual(["佐藤", "12.5", "", ""]);
});
