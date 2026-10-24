import { expect, test } from "vitest";

/** find_docs・list_tags の結果の組み立てを読み込む（実装が無い間は各テストが個別に失敗する） */
const loadResults = () => import("../../../../src/plugin/results.ts");

/** CLI の誤りを読み込む */
const loadErrors = () => import("../../../../src/cli/errors.ts");

/** 引数の形（`FindDocsCursor['filter']`）に合う、条件が 1 つだけの絞り込み */
const TAGS_FILTER = { tags: ["設計"] };

/** `cursor` を読めないときに投げる文を確かめる */
async function expectCursorError(read: () => unknown): Promise<void> {
  const { CURSOR_ERROR_MESSAGE } = await loadResults();
  const { CliError } = await loadErrors();
  let thrown: unknown;
  try {
    read();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(CliError);
  expect((thrown as Error).message).toBe(CURSOR_ERROR_MESSAGE);
}

// 読み戻すと同じ値になり、URL にそのまま置ける（正常系）
test("test_encode_cursor", async () => {
  // 準備
  const { encodeCursor, decodeCursor } = await loadResults();
  const cursor = { offset: 20, filter: { tags: ["設計"], text: "文書" } };
  // 実行
  const encoded = encodeCursor(cursor);
  // 検証
  expect(decodeCursor({ cursor: encoded, filter: cursor.filter })).toBe(20);
  expect(
    JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
  ).toEqual(cursor);
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
});

// 同じ条件なら位置を返す（正常系）
test("test_decode_cursor", async () => {
  // 準備
  const { encodeCursor, decodeCursor } = await loadResults();
  const cursor = encodeCursor({ offset: 20, filter: TAGS_FILTER });
  // 実行
  const offset = decodeCursor({ cursor, filter: TAGS_FILTER });
  // 検証
  expect(offset).toBe(20);
});

// 読めない cursor を拒む（異常系）
test("test_decode_cursor_when_invalid", async () => {
  // 準備
  const { encodeCursor, decodeCursor } = await loadResults();
  const notJson = Buffer.from("json ではない文字列").toString("base64url");
  const negative = encodeCursor({ offset: -1, filter: TAGS_FILTER });
  // 実行・検証
  for (const cursor of ["not-a-cursor", notJson, negative]) {
    await expectCursorError(() =>
      decodeCursor({ cursor, filter: TAGS_FILTER }),
    );
  }
});

// 条件を変えた cursor を拒む（異常系）
test("test_decode_cursor_when_filter_changed", async () => {
  // 準備
  const { encodeCursor, decodeCursor } = await loadResults();
  const cursor = encodeCursor({ offset: 20, filter: TAGS_FILTER });
  // 実行・検証
  await expectCursorError(() =>
    decodeCursor({ cursor, filter: { tags: ["設計"], text: "文書" } }),
  );
});

// `brief` では 4 つとも省き、取り方を添える（正常系）
test("test_select_doc_fields", async () => {
  // 準備
  const { selectDocFields } = await loadResults();
  // 実行
  const result = selectDocFields({ view: "brief", include: [], exclude: [] });
  // 検証
  expect(result.fields).toEqual([]);
  expect(result.omitted.map((omitted) => omitted.field)).toEqual([
    "path",
    "aliases",
    "related",
    "referenced_by",
  ]);
  expect(result.omitted[0]?.how).toBe('include: ["path"]');
});

// `include` を加えた後に `exclude` を除く（正常系）
test("test_select_doc_fields_when_include_and_exclude", async () => {
  // 準備
  const { selectDocFields } = await loadResults();
  // 実行
  const result = selectDocFields({
    view: "standard",
    include: ["referenced_by", "path"],
    exclude: ["path"],
  });
  // 検証
  expect(result.fields).toEqual(["aliases", "referenced_by"]);
  expect(result.omitted.map((omitted) => omitted.field)).toEqual([
    "path",
    "related",
  ]);
});

// 既定の項目だけの行にする（正常系）
test("test_to_doc_row", async () => {
  // 準備
  const { toDocRow } = await loadResults();
  const doc = {
    id: "a",
    path: "a.md",
    title: "A",
    tags: ["設計", { name: "topic:mcp", main: true }],
  };
  // 実行
  const row = toDocRow({ doc, chars: 120, fields: [], references: undefined });
  // 検証
  expect(Object.keys(row)).toEqual([
    "id",
    "title",
    "description",
    "tags",
    "chars",
  ]);
  expect(row.description).toBeNull();
  expect(row.tags).toEqual([
    { name: "設計", main: false },
    { name: "topic:mcp", main: true },
  ]);
});

// 全ての項目を持つ行にする（正常系）
test("test_to_doc_row_when_full", async () => {
  // 準備
  const { toDocRow, VIEW_FIELDS } = await loadResults();
  const doc = { id: "a", path: "a.md", title: "A" };
  const references = { backlinks: { a: ["b", "c"] }, glossary: [] };
  // 実行
  const row = toDocRow({
    doc,
    chars: null,
    fields: VIEW_FIELDS.full,
    references,
  });
  // 検証
  expect(row.chars).toBeNull();
  expect(row.path).toBe("a.md");
  expect(row.aliases).toEqual([]);
  expect(row.related).toEqual([]);
  expect(row.referenced_by).toBe(2);
});

// 近いタグの有無で文を分ける（正常系）
test("test_unknown_tag_warning", async () => {
  // 準備
  const { unknownTagWarning } = await loadResults();
  // 実行
  const near = unknownTagWarning({ tag: "topic:mcq", nearest: "topic:mcp" });
  const far = unknownTagWarning({ tag: "kind:guide", nearest: undefined });
  // 検証
  expect(near).toContain("topic:mcq");
  expect(near).toContain("topic:mcp");
  expect(far).toContain("kind:guide");
  expect(far).toContain("list_tags");
});

// インターフェース定義の例のとおりに並べる（正常系）
test("test_format_find_docs", async () => {
  // 準備
  const { formatFindDocs } = await loadResults();
  const result = {
    total: 25,
    returned: 20,
    total_chars: 48210,
    next_cursor: "eyJvZmZzZXQiOjIwfQ",
    hint: "続きがあります。tags・any_tags・text で絞るか、count_only で件数だけを確かめてください。",
    tag_counts: [{ name: "設計", count: 25 }],
    warnings: [],
    omitted: [
      { field: "aliases", how: 'include: ["aliases"]' },
      { field: "related", how: 'include: ["related"]' },
      { field: "referenced_by", how: 'include: ["referenced_by"]' },
    ],
    docs: [
      {
        id: "arch",
        title: "アーキテクチャ",
        description: "全体の構成と依存の向き",
        tags: [{ name: "設計", main: true }],
        chars: 2410,
        path: "設計/arch.md",
      },
    ],
  };
  // 実行
  const markdown = formatFindDocs(result);
  // 検証
  expect(markdown).toBe(
    [
      "総件数 25 件・返した件数 20 件・合計文字数 48210・next_cursor: eyJvZmZzZXQiOjIwfQ",
      "",
      "| ID | 題 | 概要 | タグ | 文字数 | パス |",
      "| --- | --- | --- | --- | --- | --- |",
      "| arch | アーキテクチャ | 全体の構成と依存の向き | 設計（主題） | 2410 | 設計/arch.md |",
      "",
      "タグごとの件数: 設計 25",
      "",
      '省いた項目: aliases（include: ["aliases"]）・related（include: ["related"]）・referenced_by（include: ["referenced_by"]）',
      "",
      "続きがあります。tags・any_tags・text で絞るか、count_only で件数だけを確かめてください。",
    ].join("\n"),
  );
});

// 件数だけの結果は表を出さない（正常系）
test("test_format_find_docs_when_count_only", async () => {
  // 準備
  const { formatFindDocs } = await loadResults();
  const result = {
    total: 3,
    total_chars: 300,
    tag_counts: [{ name: "topic:mcp", count: 2 }],
    warnings: [],
  };
  // 実行
  const markdown = formatFindDocs(result);
  // 検証
  expect(markdown.split("\n")[0]).toBe("総件数 3 件・合計文字数 300");
  expect(markdown).not.toContain("|");
  expect(markdown).not.toContain("next_cursor");
  expect(markdown).toContain("タグごとの件数: topic:mcp 2");
});

// セルの `|` と改行で表を崩さない（正常系）
test("test_format_find_docs_when_pipe_in_cell", async () => {
  // 準備
  const { formatFindDocs } = await loadResults();
  const result = {
    total: 1,
    returned: 1,
    total_chars: 10,
    next_cursor: null,
    hint: null,
    tag_counts: [],
    warnings: [],
    omitted: [],
    docs: [
      {
        id: "a",
        title: "A",
        description: "a|b\n続き",
        tags: [],
        chars: 10,
      },
    ],
  };
  // 実行
  const markdown = formatFindDocs(result);
  // 検証
  const rows = markdown.split("\n").filter((line) => line.startsWith("| a |"));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toContain("a\\|b 続き");
});

// インターフェース定義の例のとおりに並べる（正常系）
test("test_format_list_tags", async () => {
  // 準備
  const { formatListTags } = await loadResults();
  const tags = [
    {
      name: "topic:mcp",
      group: "topic",
      description:
        "含める: MCP のツール。含めない: Claude Code の設定。例: find_docs",
      aliases: ["MCP"],
      deprecated: null,
      docs: 2,
    },
  ];
  // 実行
  const markdown = formatListTags(tags);
  // 検証
  expect(markdown).toBe(
    [
      "| 名前 | グループ | 説明 | 別名 | 振り替え先 | 文書の数 |",
      "| --- | --- | --- | --- | --- | --- |",
      "| topic:mcp | topic | 含める: MCP のツール。含めない: Claude Code の設定。例: find_docs | MCP | - | 2 |",
    ].join("\n"),
  );
});

// タグが無ければ見出しだけの表（正常系）
test("test_format_list_tags_when_empty", async () => {
  // 準備
  const { formatListTags } = await loadResults();
  // 実行
  const markdown = formatListTags([]);
  // 検証
  expect(markdown.split("\n")).toEqual([
    "| 名前 | グループ | 説明 | 別名 | 振り替え先 | 文書の数 |",
    "| --- | --- | --- | --- | --- | --- |",
  ]);
});
