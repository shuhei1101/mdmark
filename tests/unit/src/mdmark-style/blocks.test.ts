import { expect, test } from "vitest";

/** 返答をブロックに分けるモジュール（実装が無い間は各テストが個別に失敗する） */
const loadBlocks = () => import("../../../../src/mdmark-style/blocks.ts");

/** 全ての部品がオンの設定 */
const ALL_PARTS = {
  table: true,
  heading: true,
  callout: true,
  code: true,
  fold: true,
  terms: true,
  hover_card: true,
  footnote: true,
  row_detail: true,
  steps: true,
  tree: true,
  inline: true,
  stack: true,
  figure: true,
};

// 種類ごとに分ける（正常系）
test("test_split_blocks", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "## 見出し",
    "",
    "段落の文。",
    "",
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | b |",
    "",
    "<!-- /table -->",
    "",
    "> [!NOTE]",
    "> 注意の文",
    "",
    "```ts",
    "const a = 1",
    "```",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks.map((block) => block.kind)).toEqual([
    "heading",
    "markdown",
    "table",
    "callout",
    "code",
  ]);
  expect(blocks[2]?.table?.kind).toBe("data");
  expect(blocks[3]?.callout?.type).toBe("NOTE");
  expect(JSON.stringify(blocks)).not.toContain("<!--");
});

// コードブロックの飾りを読み込む（正常系）
test("test_split_blocks_when_code_marked", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "<!-- code: title=a.ts lines highlight=2 -->",
    "",
    "```ts",
    "const a = 1 // [!code ++]",
    "const b = 2",
    "const c = 3",
    "```",
  ].join("\n");
  // 実行
  const [block] = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(block).toMatchObject({
    kind: "code",
    code: {
      title: "a.ts",
      lineNumbers: true,
      lines: [{ text: "const a = 1", mark: "++" }, { mark: "highlight" }, {}],
    },
  });
});

// 開閉の範囲をまとめる（正常系）
test("test_split_blocks_when_fold", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "<!-- details: 用語 -->",
    "",
    "段落 1",
    "",
    "段落 2",
    "",
    "<!-- /details -->",
    "",
    "> [!TIP]-",
    "> 閉じた注意書き",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks).toMatchObject([
    { kind: "fold", fold: { title: "用語", index: 0, body: [{}, {}] } },
    { kind: "callout", callout: { closed: true } },
  ]);
  expect(blocks).toHaveLength(2);
});

// オフにした種類は markdown にする（正常系）
test("test_split_blocks_when_part_disabled", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    '<!-- table: {"kind": "data"} -->',
    "",
    "| 名前 | 説明 |",
    "| --- | --- |",
    "| a | b |",
    "",
    "<!-- /table -->",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: { ...ALL_PARTS, table: false } });
  // 検証
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.kind).toBe("markdown");
  expect(blocks[0]?.markdown).not.toContain("<!-- table");
});

// 行内のマーカーを除いて 1 つの空白でつなぐ（正常系）
test("test_split_blocks_when_inline_marker", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  // 実行
  const blocks = splitBlocks({
    text: "a <!-- unknown: x --> b",
    parts: ALL_PARTS,
  });
  // 検証
  expect(blocks).toEqual([
    expect.objectContaining({ kind: "markdown", markdown: "a b" }),
  ]);
});

// 注意書きの中のブロックの行と文字の位置を返答の本文に合わせる（正常系）
test("test_split_blocks_when_callout_columns", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  // 実行
  const blocks = splitBlocks({
    text: ["> [!NOTE]", "> WS を作る"].join("\n"),
    parts: ALL_PARTS,
  });
  // 検証
  expect(blocks[0]?.callout?.body).toEqual([
    expect.objectContaining({
      kind: "markdown",
      line: 2,
      markdown: "WS を作る",
      columns: [[2, 3, 4, 5, 6, 7]],
    }),
  ]);
});

// 行内のマーカーの後ろの文字の位置を元の行に合わせる（正常系）
test("test_split_blocks_when_inline_marker_columns", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  // 実行
  const blocks = splitBlocks({ text: "a <!-- x --> WS", parts: ALL_PARTS });
  // 検証
  expect(blocks).toEqual([
    expect.objectContaining({ markdown: "a WS", columns: [[0, 1, 13, 14]] }),
  ]);
});

// 図はコードブロックにする（正常系）
test("test_split_blocks_when_diagram", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = ["```mermaid", "flowchart LR", "  a --> b", "```"].join("\n");
  // 実行
  const [block] = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(block?.kind).toBe("code");
  expect(block?.code?.lang).toBe("mermaid");
});

/** 2 行の表の Markdown */
const TWO_ROW_TABLE = [
  "| 名前 | 値 |",
  "| --- | --- |",
  "| りんご | 10 |",
  "| みかん | 2 |",
];

// 行の詳細と表の番号を表に付ける（正常系）
test("test_split_blocks_when_row_detail_and_figure", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    '<!-- fig: {"id": "a"} -->',
    ...TWO_ROW_TABLE,
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "りんごは青森県から届く。",
    "",
    "<!-- /row-detail -->",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.kind).toBe("table");
  expect(blocks[0]?.table?.figure).toBe(1);
  expect(blocks[0]?.table?.details).toEqual([
    {
      row: 0,
      body: [
        expect.objectContaining({
          kind: "markdown",
          markdown: "りんごは青森県から届く。",
        }),
      ],
    },
  ]);
});

// ステップを分ける（正常系）
test("test_split_blocks_when_steps", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "<!-- steps -->",
    "",
    "1. 依存を入れる",
    "2. ビルドする",
    "",
    "<!-- /steps -->",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks).toHaveLength(1);
  expect(blocks[0]?.kind).toBe("steps");
  expect(blocks[0]?.steps?.items).toHaveLength(2);
});

// ファイルツリーと解釈できないツリー（正常系）
test("test_split_blocks_when_tree", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "```tree",
    "mdmark/",
    "├── src/ # ソース",
    "└── README.md # 説明",
    "```",
    "",
    "```tree",
    "mdmark/",
    "├── src/",
    "│   │   └── index.ts",
    "└── README.md",
    "```",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks.map((block) => block.kind)).toEqual(["tree", "code"]);
  const notes = blocks[0]?.tree?.lines.map((line) => line.note);
  expect(notes).toContain("ソース");
  expect(notes).toContain("説明");
  expect(JSON.stringify(blocks[0]?.tree)).not.toContain("#");
  expect(blocks[1]?.code?.lang).toBe("tree");
});

// タブ・段組み・CSV を分ける（正常系）
test("test_split_blocks_when_stack", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "<!-- tabs -->",
    "",
    "#### macOS",
    "",
    "brew で入れる。",
    "",
    "#### Windows",
    "",
    "winget で入れる。",
    "",
    "<!-- /tabs -->",
    "",
    "<!-- columns -->",
    "",
    "左の列",
    "",
    "<!-- column -->",
    "",
    "右の列",
    "",
    "<!-- /columns -->",
    "",
    "```csv",
    "名前,拠点,金額",
    '北山,"東京, 本社",1200',
    "```",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks).toMatchObject([
    {
      kind: "stack",
      stack: {
        kind: "tabs",
        sections: [{ title: "macOS" }, { title: "Windows" }],
      },
    },
    { kind: "stack", stack: { kind: "columns", sections: [{}, {}] } },
    {
      kind: "table",
      table: {
        header: ["名前", "拠点", "金額"],
        rows: [["北山", "東京, 本社", "1200"]],
      },
    },
  ]);
  expect(blocks).toHaveLength(3);
  expect(blocks[1]?.stack?.sections).toHaveLength(2);
});

// オフにした部品は飾りだけ除外する（正常系）
test("test_split_blocks_when_document_part_disabled", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "<!-- steps -->",
    "",
    "1. 依存を入れる",
    "2. ビルドする",
    "",
    "<!-- /steps -->",
    "",
    '<!-- fig: {"id": "a"} -->',
    ...TWO_ROW_TABLE,
  ].join("\n");
  // 実行
  const blocks = splitBlocks({
    text,
    parts: { ...ALL_PARTS, steps: false, figure: false },
  });
  // 検証
  expect(blocks.map((block) => block.kind)).toEqual(["markdown", "table"]);
  expect(blocks[0]?.markdown).toContain("1. 依存を入れる");
  expect(blocks[0]?.markdown).not.toContain("<!--");
  expect(blocks[1]?.table?.figure).toBeUndefined();
});

// 表に付けられない行の詳細は本文にする（正常系）
test("test_split_blocks_when_row_detail_without_table", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "段落の文。",
    "",
    '<!-- row-detail: {"at": 1} -->',
    "",
    "詳細 A",
    "",
    "<!-- /row-detail -->",
    "",
    ...TWO_ROW_TABLE,
    "",
    '<!-- row-detail: {"at": 5} -->',
    "",
    "詳細 B",
    "",
    "<!-- /row-detail -->",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  const markdowns = blocks
    .filter((block) => block.kind === "markdown")
    .map((block) => block.markdown);
  expect(markdowns).toContain("詳細 A");
  expect(markdowns).toContain("詳細 B");
  const table = blocks.find((block) => block.kind === "table");
  expect(table?.table?.details ?? []).toEqual([]);
  expect(JSON.stringify(blocks)).not.toContain("<!--");
});

// 表を指すリンクの文字を番号に替える（正常系）
test("test_split_blocks_when_figure_link", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    '<!-- fig: {"id": "price"} -->',
    ...TWO_ROW_TABLE,
    "",
    "[価格の表](#fig-price) と [別](#fig-none)",
  ].join("\n");
  // 実行
  const blocks = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(blocks.find((block) => block.kind === "markdown")?.markdown).toBe(
    "[表 1](#fig-price) と [別](#fig-none)",
  );
});

// 字下げの後ろに罫線が無い行はコードブロックにする（正常系）
test("test_split_blocks_when_tree_rule_missing", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = ["```tree", "├── src/", "│   index.ts", "```"].join("\n");
  // 実行
  const [block] = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(block?.kind).toBe("code");
  expect(block?.code?.lang).toBe("tree");
});

// 注釈を HTML にしないで持つ（正常系）
test("test_split_blocks_when_tree_note_escaped", async () => {
  // 準備
  const { splitBlocks } = await loadBlocks();
  const text = [
    "```tree",
    "src/",
    "|-- a.ts # a < b & c",
    "`-- b.ts",
    "```",
  ].join("\n");
  // 実行
  const [block] = splitBlocks({ text, parts: ALL_PARTS });
  // 検証
  expect(block?.kind).toBe("tree");
  expect(block?.tree?.lines.map((line) => line.note)).toContain("a < b & c");
  expect(block?.tree?.lines.map((line) => line.rule)).toEqual([
    "",
    "├── ",
    "└── ",
  ]);
});
