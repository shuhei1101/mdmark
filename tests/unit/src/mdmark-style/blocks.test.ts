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
