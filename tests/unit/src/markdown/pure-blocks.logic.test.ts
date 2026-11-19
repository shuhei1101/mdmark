import { expect, test } from "vitest";
import { INQUIRY_COUNT_TEXT } from "../../helpers/charts.ts";
import { wrapDirective } from "../../helpers/diagrams.ts";

/** ブロックの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBlocks = () =>
  import("../../../../src/markdown/pure-blocks.logic.ts");

/** 段落・表のマーカーで囲んだ表・コードブロック・chart・div の生の HTML を持つ文書 */
const DOCUMENT = [
  "段落。",
  "",
  '<!-- table: {"kind": "data"} -->',
  "",
  "| a |",
  "| --- |",
  "| 1 |",
  "",
  "<!-- /table -->",
  "",
  "```ts",
  "const a = 1;",
  "```",
  "",
  wrapDirective("chart", INQUIRY_COUNT_TEXT),
  "<div>生の HTML</div>",
  "",
].join("\n");

/** 指定した文字列を最初に含む行の行番号（1 から） */
function lineOf(markdown: string, needle: string): number {
  return markdown.split("\n").findIndex((line) => line.includes(needle)) + 1;
}

// 記法ごとにブロックに分ける（正常系）
test("test_split_pure_blocks", async () => {
  // 準備
  const { splitPureBlocks } = await loadBlocks();
  // 実行
  const blocks = splitPureBlocks({ markdown: DOCUMENT, features: {} });
  // 検証
  expect(blocks.map((block) => block.kind)).toEqual([
    "text",
    "mark",
    "fence",
    "figure",
    "html",
  ]);
  expect(blocks.map((block) => block.line)).toEqual([
    lineOf(DOCUMENT, "段落。"),
    lineOf(DOCUMENT, "<!-- table"),
    lineOf(DOCUMENT, "```ts"),
    lineOf(DOCUMENT, "<!-- chart"),
    lineOf(DOCUMENT, "<div>"),
  ]);
  expect(blocks[1]?.mark?.name).toBe("table");
  expect(blocks[3]?.mark?.name).toBe("chart");
});

// 機能がオフのマーカーは off の mark にする（正常系）
test("test_split_pure_blocks_when_feature_off", async () => {
  // 準備
  const { splitPureBlocks } = await loadBlocks();
  // 実行
  const blocks = splitPureBlocks({
    markdown: DOCUMENT,
    features: { table: false },
  });
  // 検証
  const table = blocks.find((block) => block.mark?.name === "table");
  expect(table?.kind).toBe("mark");
  expect(table?.off).toBe(true);
});

/** 1 つ目のブロックを変換した行 */
async function convertFirst(markdown: string, features = {}) {
  const { splitPureBlocks, convertPureBlock } = await loadBlocks();
  const [block] = splitPureBlocks({ markdown, features });
  if (block === undefined) {
    throw new Error("ブロックが無い");
  }
  return convertPureBlock({ block, headings: [] });
}

// 範囲のマーカーの行を除き中身を残す（正常系）
test("test_convert_pure_block_marks_removed", async () => {
  // 実行
  const lines = await convertFirst(
    [
      '<!-- table: {"kind": "data"} -->',
      "",
      "| a |",
      "| --- |",
      "| 1 |",
      "",
      "<!-- /table -->",
      "",
    ].join("\n"),
  );
  // 検証
  expect(lines.join("\n")).not.toContain("<!--");
  expect(lines).toContain("| a |");
  expect(lines).toContain("| 1 |");
});

/** Mermaid と map-data と注記を持つ map の範囲 */
const MAP = [
  "<!-- map -->",
  "",
  "```mermaid",
  "flowchart LR",
  "  a --> b",
  "```",
  "",
  '<!-- map-data: {"version": 1, "notes": {"a": {"annotations": ["n1"]}}} -->',
  "",
  "<!-- /map -->",
  "",
  "※[n1]: 補足",
  "",
].join("\n");

// map は Mermaid のコードブロックだけを残す（正常系）
test("test_convert_pure_block_map", async () => {
  // 実行
  const lines = await convertFirst(MAP);
  // 検証
  expect(lines.filter((line) => line !== "")).toEqual([
    "```mermaid",
    "flowchart LR",
    "  a --> b",
    "```",
  ]);
});

// コードブロックの飾りを取り除く（正常系）
test("test_convert_pure_block_code_decoration", async () => {
  // 実行
  const lines = await convertFirst(
    [
      '<!-- code: {"title": "main.ts"} -->',
      "",
      "```ts",
      "const a = 1; // [!code ++]",
      "```",
      "",
    ].join("\n"),
  );
  // 検証
  const text = lines.join("\n");
  expect(text).toContain("**main.ts**");
  expect(text.indexOf("**main.ts**")).toBeLessThan(text.indexOf("```ts"));
  expect(text).not.toContain("[!code");
  expect(text).not.toContain("<!--");
  expect(text).toContain("const a = 1;");
});

// 生の HTML のブロックを取り除く（正常系）
test("test_convert_pure_block_raw_html", async () => {
  // 実行
  const lines = await convertFirst("<div>\n生の HTML\n</div>\n");
  // 検証
  expect(lines).toEqual([]);
});

// 機能がオフのマーカーの行を除き中身をそのまま残す（正常系）
test("test_convert_pure_block_when_off", async () => {
  // 実行
  const toc = await convertFirst("<!-- toc -->\n", { toc: false });
  const map = await convertFirst(MAP, { map: false });
  // 検証
  expect(toc.filter((line) => line !== "")).toEqual([]);
  expect(map).toContain("```mermaid");
  expect(map).toContain("  a --> b");
  expect(map.join("\n")).not.toContain("<!--");
});

// 入れ子と重なる見出しのアンカー（正常系）
test("test_toc_list", async () => {
  // 準備
  const { tocList } = await loadBlocks();
  // 実行
  const lines = tocList([
    { level: 1, text: "手引き" },
    { level: 2, text: "導入" },
    { level: 3, text: "前提" },
    { level: 2, text: "導入" },
  ]);
  // 検証
  expect(lines).toEqual([
    "- [導入](#導入)",
    "  - [前提](#前提)",
    "- [導入](#導入-1)",
  ]);
});
