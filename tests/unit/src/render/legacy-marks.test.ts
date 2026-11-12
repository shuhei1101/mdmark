import { expect, test } from "vitest";

/** 今の書き方のマーカーの変換を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadLegacyMarks = () => import("../../../../src/render/legacy-marks.ts");

/** シナリオ『バージョンを上げる』の 1 つ目の文書（表とコードブロックの飾り） */
const FIRST_DOCUMENT = [
  "# 在庫",
  "",
  "<!-- table: data +count total=数量:sum filter=名前,更新日:date closed -->",
  "",
  "| 名前 | 数量 | 更新日 |",
  "| --- | --- | --- |",
  "| りんご | 3 | 2026-11-01 |",
  "",
  "<!-- /table -->",
  "",
  "<!-- code: title=app.ts lines highlight=2,4-6 -->",
  "",
  "```ts",
  "const a = 1;",
  "const b = 2;",
  "const c = 3;",
  "const d = 4;",
  "const e = 5;",
  "const f = 6;",
  "```",
  "",
].join("\n");

/** シナリオ『バージョンを上げる』の 2 つ目の文書（details・図の番号・取り込み・目次・コードブロックの中のマーカー） */
const SECOND_DOCUMENT = [
  "# 手順",
  "",
  "<!-- toc -->",
  "",
  "<!-- details: 実行の例 open -->",
  "",
  "実行の例の本文",
  "",
  "<!-- /details -->",
  "",
  "<!-- fig: arch -->",
  "",
  "![構成](arch.png)",
  "",
  "<!-- include: src/app.ts#L3-L5 -->",
  "",
  "```markdown",
  "<!-- section: closed -->",
  "```",
  "",
].join("\n");

// 表の今の書き方を、列の設定と機能と折り畳みにする（正常系）
test("test_convert_legacy_args", async () => {
  // 準備
  const { convertLegacyArgs } = await loadLegacyMarks();
  // 実行
  const result = convertLegacyArgs({
    name: "table",
    text: "data +count total=数量:sum filter=名前,更新日:date hide=備考 closed",
  });
  // 検証
  expect(result.options).toEqual({
    kind: "data",
    features: { count: {} },
    columns: { 名前: { filter: {} }, 更新日: { filter: { type: "date" } } },
    collapse: { open: false },
  });
  expect(result.dropped.map((item) => item.text)).toEqual([
    "total=数量:sum",
    "hide=備考",
  ]);
  expect(result.dropped[0]?.reason).toContain("+total");
  expect(result.dropped[1]?.reason).toContain("+columns");
});

// 記法のマーカーごとの今の書き方を対応のとおりにする（正常系）
test("test_convert_legacy_args_when_each_mark", async () => {
  // 準備
  const { convertLegacyArgs } = await loadLegacyMarks();
  const cases = [
    {
      name: "code",
      text: "title=app.ts lines highlight=2,4-6 fold=8 wrap",
      options: {
        title: "app.ts",
        lines: {},
        highlight: [2, { from: 4, to: 6 }],
        fold: [8],
        wrap: true,
      },
    },
    {
      name: "details",
      text: "実行の例 open",
      options: { title: "実行の例", open: true },
    },
    { name: "tree", text: "open=2 wrap", options: { depth: 2, wrap: true } },
    {
      name: "include",
      text: "src/app.ts#L3-L5",
      options: { path: "src/app.ts", lines: { from: 3, to: 5 } },
    },
    {
      name: "include",
      text: "a.md#L3-L5",
      options: { path: "a.md", heading: "L3-L5" },
    },
    {
      name: "view",
      text: "group=状態 default=table filter=担当 icons=未着手:inbox",
      options: {
        board: {
          group: { column: "状態" },
          values: { 未着手: { icon: "inbox" } },
        },
        initial: "table",
        columns: { 担当: { filter: {} } },
      },
    },
    {
      name: "glossary",
      text: "term=用語 meaning=意味",
      options: { term: { column: "用語" }, meaning: { column: "意味" } },
    },
    { name: "features", text: "+a -b", options: { a: true, b: false } },
    {
      name: "page",
      text: "scheme=dark toc=fixed",
      options: { scheme: "dark", toc: { mode: "fixed" } },
    },
  ];
  // 実行
  const results = cases.map(({ name, text }) =>
    convertLegacyArgs({ name, text }),
  );
  // 検証
  expect(results.map((result) => result.options)).toEqual(
    cases.map((item) => item.options),
  );
  expect(results.flatMap((result) => result.dropped)).toEqual([]);
});

// 読み込めない記載を書き出さずに分ける（異常系）
test("test_convert_legacy_args_when_unreadable", async () => {
  // 準備
  const { convertLegacyArgs } = await loadLegacyMarks();
  // 実行
  const result = convertLegacyArgs({
    name: "table",
    text: "data filter=名前:range +unknown",
  });
  // 検証
  expect(result.options).toEqual({ kind: "data" });
  expect(result.dropped.map((item) => item.text)).toEqual([
    "filter=名前:range",
    "+unknown",
  ]);
});

// 今の書き方のマーカーだけを書き換え、ほかの文字を変えない（正常系）
test("test_rewrite_legacy_marks", async () => {
  // 準備
  const { rewriteLegacyMarks } = await loadLegacyMarks();
  // 実行
  const first = rewriteLegacyMarks({ markdown: FIRST_DOCUMENT });
  const second = rewriteLegacyMarks({ markdown: SECOND_DOCUMENT });
  // 検証
  expect(first.markdown).toBe(
    FIRST_DOCUMENT.replace(
      "<!-- table: data +count total=数量:sum filter=名前,更新日:date closed -->",
      '<!-- table: {"kind": "data", "features": {"count": {}}, "columns": {"名前": {"filter": {}}, "更新日": {"filter": {"type": "date"}}}, "collapse": {"open": false}} -->',
    ).replace(
      "<!-- code: title=app.ts lines highlight=2,4-6 -->",
      '<!-- code: {"title": "app.ts", "lines": {}, "highlight": [2, {"from": 4, "to": 6}]} -->',
    ),
  );
  expect(second.markdown).toBe(
    SECOND_DOCUMENT.replace(
      "<!-- details: 実行の例 open -->",
      '<!-- details: {"title": "実行の例", "open": true} -->',
    )
      .replace("<!-- fig: arch -->", '<!-- fig: {"id": "arch"} -->')
      .replace(
        "<!-- include: src/app.ts#L3-L5 -->",
        '<!-- include: {"path": "src/app.ts", "lines": {"from": 3, "to": 5}} -->',
      ),
  );
  expect(first.report).toHaveLength(1);
  expect(first.report[0]).toMatchObject({
    line: 3,
    name: "table",
    text: "total=数量:sum",
  });
  expect(first.report[0]?.reason).toContain("+total");
  expect(second.report).toEqual([]);
});

// 記法でないマーカーを書き換えずに報告する（正常系）
test("test_rewrite_legacy_marks_when_unconverted", async () => {
  // 準備
  const { rewriteLegacyMarks } = await loadLegacyMarks();
  const markdown = [
    "<!-- greet: world -->",
    "",
    "<!-- table: data filter=名前:range -->",
    "",
    "| 名前 |",
    "| --- |",
    "| りんご |",
    "",
    "<!-- /table -->",
    "",
  ].join("\n");
  // 実行
  const result = rewriteLegacyMarks({ markdown });
  // 検証
  expect(result.markdown).toBe(
    markdown.replace(
      "<!-- table: data filter=名前:range -->",
      '<!-- table: {"kind": "data"} -->',
    ),
  );
  expect(
    result.report.map((line) => [line.line, line.name, line.text]),
  ).toEqual([
    [1, "greet", "world"],
    [3, "table", "filter=名前:range"],
  ]);
});

// 書き換えた本文をもう一度書き換えても変わらない（正常系）
test("test_rewrite_legacy_marks_when_rerun", async () => {
  // 準備
  const { rewriteLegacyMarks } = await loadLegacyMarks();
  const { markdown } = rewriteLegacyMarks({ markdown: FIRST_DOCUMENT });
  // 実行
  const result = rewriteLegacyMarks({ markdown });
  // 検証
  expect(result.markdown).toBe(markdown);
  expect(result.report).toEqual([]);
});
