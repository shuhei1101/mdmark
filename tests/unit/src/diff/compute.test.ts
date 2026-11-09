import { expect, test, vi } from "vitest";
import type { DiffEngine } from "../../../../src/diff/compute.ts";

/** 差分の計算を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadCompute = () => import("../../../../src/diff/compute.ts");

// 段落の単語を書き換え、別の行を削除し、行を 1 つ追加した前と後
const BEFORE = "# ガイド\n差分を色分けして読み込む。\n削除する行\n終わり\n";
const AFTER = "# ガイド\n変更を色分けして読み込む。\n終わり\n追加する行\n";

/** 差分の行の切れ（単語）の構造 */
type Part = { text: string; changed: boolean };
/** 差分の行の構造 */
type Line = { kind: "same" | "del" | "add"; parts: Part[] };
/** 差分の塊の構造 */
type Block = { type: "lines" | "html"; lines: Line[] };

/** 結果の全ての行を、上から順に平らにして返却する */
function allLines(blocks: Block[]): Line[] {
  return blocks.flatMap((block) => block.lines);
}

/** 行の文字を切れから組み立てる */
function textOf(line: Line): string {
  return line.parts.map((part) => part.text).join("");
}

/** 行の中で変わった切れだけをつないだ文字を返却する */
function changedOf(line: Line): string {
  return line.parts
    .filter((part) => part.changed)
    .map((part) => part.text)
    .join("");
}

/** 指定した種類の行のうち、変わった切れを持つものを返却する */
function pairedLine(blocks: Block[], kind: "del" | "add"): Line {
  const line = allLines(blocks).find(
    (candidate) => candidate.kind === kind && changedOf(candidate) !== "",
  );
  if (line === undefined) {
    throw new Error(`変わった切れを持つ ${kind} の行が無い`);
  }
  return line;
}

// 行の差と対の行の単語の差を出す（正常系）
test("test_compute_diff", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  const segmenter = new Intl.Segmenter("ja", { granularity: "word" });
  // 実行
  const result = computeDiff({ before: BEFORE, after: AFTER, segmenter });
  // 検証
  expect(result.counts).toEqual({ del: 2, add: 2 });
  const del = pairedLine(result.blocks, "del");
  const add = pairedLine(result.blocks, "add");
  expect(textOf(del)).toBe("差分を色分けして読み込む。");
  expect(changedOf(del)).toBe("差分");
  expect(textOf(add)).toBe("変更を色分けして読み込む。");
  expect(changedOf(add)).toBe("変更");
  // 対にならない行は 1 つの切れで、変わった切れを持たない
  const unpaired = allLines(result.blocks).filter(
    (line) => line.kind !== "same" && changedOf(line) === "",
  );
  expect(unpaired.map(textOf)).toEqual(["削除する行", "追加する行"]);
  expect(unpaired.every((line) => line.parts.length === 1)).toBe(true);
});

// 単語の区切りが無ければ 1 文字ずつ比べる（正常系）
test("test_compute_diff_when_no_segmenter", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: BEFORE,
    after: AFTER,
    segmenter: undefined,
  });
  // 検証
  const del = pairedLine(result.blocks, "del");
  const add = pairedLine(result.blocks, "add");
  expect(changedOf(del)).toBe("差分");
  expect(changedOf(add)).toBe("変更");
  expect(textOf(del)).toBe("差分を色分けして読み込む。");
  expect(textOf(add)).toBe("変更を色分けして読み込む。");
});

// 同じ本文なら数が 0（正常系）
test("test_compute_diff_when_same", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: BEFORE,
    after: BEFORE,
    segmenter: undefined,
  });
  // 検証
  expect(result.counts).toEqual({ del: 0, add: 0 });
  const lines = allLines(result.blocks);
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.every((line) => line.kind === "same")).toBe(true);
});

// 埋め込んだ HTML の範囲を塊にし、前と後の中身を取り出す（正常系）
test("test_compute_diff_when_html", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  const range = (body: string) =>
    ["<!-- html -->", "```html", body, "```", "<!-- /html -->"].join("\n");
  const before = [
    "# 表",
    range("<table><tr><td>120</td></tr></table>"),
    "中間",
    range("<p>同じ</p>"),
    "末尾",
    "",
  ].join("\n");
  const after = [
    "# 表",
    range("<table><tr><td>150</td></tr></table>"),
    "中間",
    range("<p>同じ</p>"),
    "末尾",
    range("<p>新しい</p>"),
    "",
  ].join("\n");
  // 実行
  const result = computeDiff({ before, after, segmenter: undefined });
  // 検証
  const htmlBlocks = result.blocks.filter(
    (block) => block.type === "html",
  ) as (Block & {
    changed: boolean;
    before: string | null;
    after: string | null;
  })[];
  expect(htmlBlocks).toHaveLength(3);
  expect(htmlBlocks.map((block) => block.changed)).toEqual([true, false, true]);
  expect(htmlBlocks[0]?.before).toContain("120");
  expect(htmlBlocks[0]?.after).toContain("150");
  expect(htmlBlocks[1]?.before).toContain("同じ");
  expect(htmlBlocks[1]?.after).toContain("同じ");
  expect(htmlBlocks[2]?.before).toBeNull();
  expect(htmlBlocks[2]?.after).toContain("新しい");
});

// 指定した計算を使用する（正常系）
test("test_compute_diff_when_engine", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  const lines = vi.fn((pair: { before: string; after: string }) => [
    { value: pair.before, added: false, removed: true },
    { value: pair.after, added: true, removed: false },
  ]);
  const words = vi.fn((pair: { before: string; after: string }) => [
    { value: pair.before, added: false, removed: true },
    { value: pair.after, added: true, removed: false },
  ]);
  const engine: DiffEngine = { lines, words };
  // 実行
  const result = computeDiff({
    before: "a\nb\n",
    after: "c\nd\n",
    segmenter: undefined,
    engine,
  });
  // 検証
  expect(lines).toHaveBeenCalledWith({ before: "a\nb\n", after: "c\nd\n" });
  const kinds = allLines(result.blocks).map((line) => line.kind);
  expect(kinds).toEqual(["del", "del", "add", "add"]);
  expect(result.counts).toEqual({ del: 2, add: 2 });
});

/** 結果の行を、種類と文字の組にして上から順に返却する */
function kindsOf(blocks: Block[]): [Line["kind"], string][] {
  return allLines(blocks).map((line) => [line.kind, textOf(line)]);
}

// 1 行の段落だけの文書で、空行の一致を手がかりにせず、変えていない段落を同じ行にする（正常系）
test("test_compute_diff_when_one_line_paragraphs", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: "A\n\nC\n\nD\n",
    after: "A\n\nB\n\nC\n",
    segmenter: undefined,
  });
  // 検証
  expect(kindsOf(result.blocks)).toEqual([
    ["same", "A"],
    ["same", ""],
    ["add", "B"],
    ["add", ""],
    ["same", "C"],
    ["del", ""],
    ["del", "D"],
  ]);
  expect(result.counts).toEqual({ del: 2, add: 2 });
});

// 空行だけを追加した変更を、追加した空行にする（正常系）
test("test_compute_diff_when_blank_line_added", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: "X\nY\n",
    after: "X\n\nY\n",
    segmenter: undefined,
  });
  // 検証
  expect(kindsOf(result.blocks)).toEqual([
    ["same", "X"],
    ["add", ""],
    ["same", "Y"],
  ]);
  expect(result.counts).toEqual({ del: 0, add: 1 });
});

// 文字の違う空白だけの行は、削除した行と追加した行にする（正常系）
test("test_compute_diff_when_blank_text_differs", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: "A\n  \nB\n",
    after: "A\n\nB\n",
    segmenter: undefined,
  });
  // 検証
  expect(kindsOf(result.blocks)).toEqual([
    ["same", "A"],
    ["del", "  "],
    ["add", ""],
    ["same", "B"],
  ]);
});

// 先頭の空行はソースの先頭に付け、前と後で対にする（正常系）
test("test_compute_diff_when_leading_blank_lines", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: "\n\nA\n",
    after: "\nA\n",
    segmenter: undefined,
  });
  // 検証
  expect(kindsOf(result.blocks)).toEqual([
    ["same", ""],
    ["del", ""],
    ["same", "A"],
  ]);
});

// 最後の行の改行の有無は比べない（正常系）
test("test_compute_diff_when_last_newline_missing", async () => {
  // 準備
  const { computeDiff } = await loadCompute();
  // 実行
  const result = computeDiff({
    before: "A\nB",
    after: "A\nB\n",
    segmenter: undefined,
  });
  // 検証
  expect(result.counts).toEqual({ del: 0, add: 0 });
  const lines = allLines(result.blocks);
  expect(lines.map(textOf)).toEqual(["A", "B"]);
  expect(lines.every((line) => line.kind === "same")).toBe(true);
});
