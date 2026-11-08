import { afterEach, expect, test, vi } from "vitest";
import { resolveConfig } from "../../../../src/config.ts";
import type { DiffRevision, DiffSource } from "../../../../src/diff/source.ts";
import { renderDocument } from "../../../../src/render/index.ts";
import { loadSource } from "../../helpers/lazy.ts";

/** ブロックの色分けの処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadBlocks = () =>
  loadSource(
    import.meta.glob<typeof import("../../../../src/diff/blocks.ts")>(
      "../../../../src/diff/blocks.ts",
    ),
  );

/** 差分の計算を読み込む（書き換えの見分けに既定の計算を指定する） */
const loadCompute = () => import("../../../../src/diff/compute.ts");

// 新しい順に並べた、後（変更後）と前（変更前）のリビジョン
const REVISIONS: DiffRevision[] = [
  { id: "modified", at: "2026-10-20T02:05:00Z" },
  { id: "original", at: "2026-10-19T07:40:00Z" },
];

/** `content` が受けた引数 */
type ContentCall = { docId: string; revisionId: string };

/** 呼ばれた引数を記録する取り出し元 */
type RecordingSource = DiffSource & {
  revisionsCalls: string[];
  contentCalls: ContentCall[];
};

/** 呼ばれた引数を記録し、リビジョンごとの全文を返却する取り出し元を作る */
function createSource(
  override: Partial<DiffSource> = {},
  revisions: DiffRevision[] = REVISIONS,
): RecordingSource {
  const revisionsCalls: string[] = [];
  const contentCalls: ContentCall[] = [];
  const texts: Record<string, string> = {
    modified: "# 手引き\n\n後の段落\n",
    original: "# 手引き\n\n前の段落\n",
  };
  return {
    revisionsCalls,
    contentCalls,
    revisions: async (docId) => {
      revisionsCalls.push(docId);
      return revisions;
    },
    content: async (target) => {
      contentCalls.push(target);
      return texts[target.revisionId] ?? "";
    },
    ...override,
  };
}

/** 単語の区切り（本番の `mount` と同じ） */
function createSegmenter(): Intl.Segmenter {
  return new Intl.Segmenter("ja", { granularity: "word" });
}

/** Markdown を既定の設定で描いた中身を、画面に配置する前の断片として返却する（元の行番号を残す） */
function renderFragment(markdown: string): DocumentFragment {
  const config = resolveConfig({ config: { features: {} } });
  const template = document.createElement("template");
  template.innerHTML = renderDocument({ markdown, config }).html;
  return template.content;
}

/** 前と後の Markdown を描いて色分けし、色分けした後の断片を返却する */
async function colorBlocks(options: {
  before: string;
  after: string;
}): Promise<DocumentFragment> {
  const { colorDiffBlocks } = await loadBlocks();
  const before = renderFragment(options.before);
  const after = renderFragment(options.after);
  colorDiffBlocks({
    before: { root: before, markdown: options.before },
    after: { root: after, markdown: options.after },
    segmenter: createSegmenter(),
  });
  return after;
}

/** 断片の HTML を返却する */
function htmlOf(fragment: DocumentFragment): string {
  const holder = document.createElement("div");
  holder.append(fragment.cloneNode(true));
  return holder.innerHTML;
}

/** 要素の中の最初の段落の文字を返却する */
function paragraphText(element: Element): string {
  return element.querySelector("p")?.textContent ?? "";
}

afterEach(() => {
  vi.restoreAllMocks();
});

// 2 番目を前、1 番目を後にして取り出す（正常系）
test("test_load_diff_pair", async () => {
  // 準備
  const { loadDiffPair } = await loadBlocks();
  const source = createSource();
  // 実行
  const pair = await loadDiffPair({ source, docId: "guide" });
  // 検証
  expect(source.revisionsCalls).toEqual(["guide"]);
  expect(source.contentCalls.map((call) => call.revisionId).sort()).toEqual([
    "modified",
    "original",
  ]);
  expect(source.contentCalls.every((call) => call.docId === "guide")).toBe(
    true,
  );
  expect(pair).toEqual({
    kind: "pair",
    before: "# 手引き\n\n前の段落\n",
    after: "# 手引き\n\n後の段落\n",
  });
});

// リビジョンが 1 つなら本文を取り出さない（正常系）
test("test_load_diff_pair_when_single", async () => {
  // 準備
  const { loadDiffPair } = await loadBlocks();
  const source = createSource({}, [REVISIONS[0] as DiffRevision]);
  // 実行
  const pair = await loadDiffPair({ source, docId: "guide" });
  // 検証
  expect(pair).toEqual({ kind: "single" });
  expect(source.contentCalls).toEqual([]);
});

// 本文を取り出せなければ failed を返却する（異常系）
test("test_load_diff_pair_when_content_rejected", async () => {
  // 準備
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  const { loadDiffPair } = await loadBlocks();
  const error = new Error("本文を返却できない");
  const source = createSource({
    content: async ({ revisionId }) => {
      if (revisionId === "original") {
        throw error;
      }
      return "# 手引き\n";
    },
  });
  // 実行
  const pair = await loadDiffPair({ source, docId: "guide" });
  // 検証
  expect(pair).toEqual({ kind: "failed" });
  const args = consoleError.mock.calls.flat();
  expect(args).toContain(error);
  for (const word of ["content", "guide", "original"]) {
    expect(args.some((arg) => String(arg).includes(word))).toBe(true);
  }
});

// 一覧の構造が合わなければ failed を返却する（異常系）
test("test_load_diff_pair_when_revisions_invalid", async () => {
  // 準備
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { loadDiffPair } = await loadBlocks();
  const source = createSource({
    revisions: async () => ({}) as unknown as DiffRevision[],
  });
  // 実行
  const pair = await loadDiffPair({ source, docId: "guide" });
  // 検証
  expect(pair).toEqual({ kind: "failed" });
  expect(source.contentCalls).toEqual([]);
});

// セクションの中身の中のブロックと、リストの項目・表の行を分ける（正常系）
test("test_collect_block_ranges", async () => {
  // 準備
  const { collectBlockRanges } = await loadBlocks();
  const markdown = [
    "# タイトル", // 0
    "", // 1
    "## セクション", // 2
    "", // 3
    "段落", // 4
    "", // 5
    "1. 項目一", // 6
    "1. 項目二", // 7
    "1. 項目三", // 8
    "", // 9
    "| 名前 | 値 |", // 10
    "| --- | --- |", // 11
    "| 行一 | 1 |", // 12
    "| 行二 | 2 |", // 13
  ].join("\n");
  const root = renderFragment(markdown);
  // 実行
  const ranges = collectBlockRanges({ root, lineCount: 14 });
  // 検証
  expect(
    ranges.map((range) => ({
      unit: range.unit,
      start: range.start,
      end: range.end,
    })),
  ).toEqual([
    { unit: "block", start: 0, end: 1 },
    { unit: "block", start: 2, end: 3 },
    { unit: "block", start: 4, end: 5 },
    { unit: "item", start: 6, end: 6 },
    { unit: "item", start: 7, end: 7 },
    { unit: "item", start: 8, end: 9 },
    { unit: "block", start: 10, end: 11 },
    { unit: "row", start: 12, end: 12 },
    { unit: "row", start: 13, end: 13 },
  ]);
  const tags = ranges.map((range) => range.element.tagName.toLowerCase());
  expect(tags.slice(0, 6)).toEqual(["h1", "h2", "p", "li", "li", "li"]);
  expect(tags.slice(7)).toEqual(["tr", "tr"]);
  expect(ranges[6]?.element.matches("table, .mdmark-table")).toBe(true);
  expect(
    ranges.some((range) => range.element.matches(".mdmark-section-body")),
  ).toBe(false);
});

// 追加した・書き換えた段落に追加の色、削除した段落を前の位置に削除の色で差し込む（正常系）
test("test_color_diff_blocks", async () => {
  // 準備
  const before = [
    "# タイトル",
    "",
    "差分を確認する手順です。",
    "",
    "## セクション",
    "",
    "古い注意書きを削除します。",
    "",
    "配布物が届くまで数分かかります。",
    "",
  ].join("\n");
  const after = [
    "# タイトル",
    "",
    "変更を確認する手順です。",
    "",
    "## セクション",
    "",
    "表の列を増やす案をまとめました。",
    "",
  ].join("\n");
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: 段落 A と E が追加の色に包まれる
  const adds = [
    ...colored.querySelectorAll('div.mdmark-diff-block[data-kind="add"]'),
  ];
  expect(adds.map(paragraphText)).toEqual([
    "変更を確認する手順です。",
    "表の列を増やす案をまとめました。",
  ]);
  // 検証: 段落 C がセクションの中身の先頭、段落 D が E の直前に削除のブロックで入る
  const dels = [...colored.querySelectorAll('[data-kind="del"]')];
  expect(dels.map(paragraphText)).toEqual([
    "古い注意書きを削除します。",
    "配布物が届くまで数分かかります。",
  ]);
  expect(colored.querySelector("#section-セクション")?.firstElementChild).toBe(
    dels[0],
  );
  expect(adds[1]?.previousElementSibling).toBe(dels[1]);
  // 検証: 書き換えた段落 A の削除は無い
  expect(dels.some((del) => del.textContent?.includes("差分を確認する"))).toBe(
    false,
  );
  // 検証: 削除のブロックの中に元の行番号と id が無い
  for (const del of dels) {
    expect(del.hasAttribute("id")).toBe(false);
    expect(del.hasAttribute("data-source-line")).toBe(false);
    expect(del.querySelector("[data-source-line], [id]")).toBeNull();
  }
});

// リストの項目と表の行の単位で色を適用する（正常系）
test("test_color_diff_blocks_when_list_and_table", async () => {
  // 準備: 番号付きリストの番号は全て 1 にして、行の違いを項目の文字だけにする
  const list = (items: string[]) =>
    items.map((item) => `1. ${item}`).join("\n");
  const table = (rows: string[]) =>
    ["| 名前 | 値 |", "| --- | --- |", ...rows].join("\n");
  const before = [
    list(["項目一", "項目二", "項目三", "項目四", "項目五"]),
    "",
    table(["| 行一 | 1 |", "| 行二 | 2 |", "| 行三 | 3 |"]),
    "",
  ].join("\n");
  const after = [
    list(["項目一", "項目二", "項目三", "項目五", "項目六"]),
    "",
    table(["| 行一 | 1 |", "| 更新 | 22 |", "| 行三 | 3 |"]),
    "",
  ].join("\n");
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: リストと表そのものは包まれない
  const ol = colored.querySelector("ol");
  const tableElement = colored.querySelector("table");
  expect(ol?.closest(".mdmark-diff-block")).toBeNull();
  expect(tableElement?.closest(".mdmark-diff-block")).toBeNull();
  // 検証: 削除した項目が 3 番目の項目の後ろに削除、追加した項目が追加で、どちらも li に class を持つ
  const items = [...(ol?.querySelectorAll(":scope > li") ?? [])];
  expect(items.map((item) => item.getAttribute("data-kind"))).toEqual([
    null,
    null,
    null,
    "del",
    null,
    "add",
  ]);
  expect(items[3]?.textContent).toContain("項目四");
  expect(items[5]?.textContent).toContain("項目六");
  for (const item of [items[3], items[5]]) {
    expect(item?.classList.contains("mdmark-diff-block")).toBe(true);
  }
  // 検証: 表の 2 行目は削除の行と追加の行がこの順
  const rows = [...(tableElement?.querySelectorAll("tbody > tr") ?? [])];
  expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual([
    null,
    "del",
    "add",
    null,
  ]);
  expect(rows[1]?.textContent).toContain("行二");
  expect(rows[2]?.textContent).toContain("更新");
  for (const row of [rows[1], rows[2]]) {
    expect(row?.classList.contains("mdmark-diff-block")).toBe(true);
  }
});

// 見出しごと削除したセクションを 1 つの削除のブロックにする（正常系）
test("test_color_diff_blocks_when_section_deleted", async () => {
  // 準備
  const before = [
    "## 一",
    "",
    "段落一",
    "",
    "## 二",
    "",
    "段落二の一",
    "",
    "段落二の二",
    "",
    "## 三",
    "",
    "段落三",
    "",
  ].join("\n");
  const after = ["## 一", "", "段落一", "", "## 三", "", "段落三", ""].join(
    "\n",
  );
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証
  const dels = [...colored.querySelectorAll('[data-kind="del"]')];
  expect(dels).toHaveLength(1);
  const [del] = dels as [Element];
  expect(del.querySelector("h2")).not.toBeNull();
  expect(del.querySelectorAll("p")).toHaveLength(2);
  expect(del.querySelector("h2")?.hasAttribute("id")).toBe(false);
  expect(colored.querySelector("#section-一")?.nextElementSibling).toBe(del);
});

// 見出し行を変えて行を削除した表でも、削除した行を差し込む（正常系）
test("test_color_diff_blocks_when_table_header_changed", async () => {
  // 準備
  const table = (header: string, rows: string[]) =>
    [header, "| --- | --- |", ...rows, ""].join("\n");
  const before = table("| 名前 | 値 |", [
    "| a | 1 |",
    "| b | 2 |",
    "| c | 3 |",
  ]);
  const after = table("| 名前 | 数 |", ["| a | 1 |", "| c | 3 |"]);
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: 表が追加のブロックに包まれ、行 a の後ろに行 b が削除の行である
  expect(
    colored.querySelectorAll('div.mdmark-diff-block[data-kind="add"] table'),
  ).toHaveLength(1);
  const rows = [...colored.querySelectorAll("tbody > tr")];
  expect(rows.map((row) => row.getAttribute("data-kind"))).toEqual([
    null,
    "del",
    null,
  ]);
  expect(rows[1]?.textContent).toContain("b");
});

// 1 行の段落だけの文書で、空行の一致に参照されず変えていない段落に色を適用しない（正常系）
test("test_color_diff_blocks_when_one_line_paragraphs", async () => {
  // 準備: 空行どうしが一致する並びと段落 C が一致する並びが同じ長さになる組
  const paragraphs = (texts: string[]) =>
    texts.map((text) => `${text}\n`).join("\n");
  const before = paragraphs(["段落 A", "段落 C", "段落 D"]);
  const after = paragraphs(["段落 A", "段落 B", "段落 C"]);
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: 段落 B だけが追加の色に包まれる
  const adds = [
    ...colored.querySelectorAll('div.mdmark-diff-block[data-kind="add"]'),
  ];
  expect(adds.map(paragraphText)).toEqual(["段落 B"]);
  // 検証: 段落 C の後ろに段落 D が削除のブロックで入る
  const dels = [...colored.querySelectorAll('[data-kind="del"]')];
  expect(dels.map(paragraphText)).toEqual(["段落 D"]);
  const paragraphOf = (text: string) =>
    [...colored.querySelectorAll("p")].find(
      (p) => p.textContent === text && p.closest('[data-kind="del"]') === null,
    );
  expect(paragraphOf("段落 C")?.nextElementSibling).toBe(dels[0]);
  // 検証: 段落 A と C は包まれない
  for (const text of ["段落 A", "段落 C"]) {
    expect(paragraphOf(text)?.closest(".mdmark-diff-block")).toBeNull();
  }
});

// 空行だけを追加して段落を 2 つに分けた変更で、分けた後の段落に追加の色を適用する（正常系）
test("test_color_diff_blocks_when_paragraph_split", async () => {
  // 準備
  const before = "段落 X\n段落 Y\n";
  const after = "段落 X\n\n段落 Y\n";
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: 分けた後の 2 つの段落が追加の色に包まれる
  const adds = [
    ...colored.querySelectorAll('div.mdmark-diff-block[data-kind="add"]'),
  ];
  expect(adds.map(paragraphText)).toEqual(["段落 X", "段落 Y"]);
  // 検証: 削除のブロックは無い
  expect(colored.querySelectorAll('[data-kind="del"]')).toHaveLength(0);
});

// 空行だけを削除して 2 つの段落を 1 つにつないだ変更で、つないだ段落に追加の色を適用する（正常系）
test("test_color_diff_blocks_when_paragraphs_joined", async () => {
  // 準備
  const before = "段落 X\n\n段落 Y\n";
  const after = "段落 X\n段落 Y\n";
  // 実行
  const colored = await colorBlocks({ before, after });
  // 検証: つないだ段落が追加の色に包まれる
  const adds = [
    ...colored.querySelectorAll('div.mdmark-diff-block[data-kind="add"]'),
  ];
  expect(adds.map(paragraphText)).toEqual(["段落 X\n段落 Y"]);
  // 検証: 削除のブロックは無い
  expect(colored.querySelectorAll('[data-kind="del"]')).toHaveLength(0);
});

// 段落の間の空行の数だけを変えた変更では、色を適用しない（正常系）
test("test_color_diff_blocks_when_blank_lines_only", async () => {
  // 準備
  const before = "段落 A\n\n段落 B\n";
  const after = "段落 A\n\n\n段落 B\n";
  const { colorDiffBlocks } = await loadBlocks();
  const beforeRoot = renderFragment(before);
  const afterRoot = renderFragment(after);
  const htmlBefore = htmlOf(afterRoot);
  // 実行
  colorDiffBlocks({
    before: { root: beforeRoot, markdown: before },
    after: { root: afterRoot, markdown: after },
    segmenter: createSegmenter(),
  });
  // 検証
  expect(htmlOf(afterRoot)).toBe(htmlBefore);
});

// 同じ本文なら何も変えない（正常系）
test("test_color_diff_blocks_when_same", async () => {
  // 準備
  const markdown = "# タイトル\n\n段落\n\n## セクション\n\n段落二\n";
  const { colorDiffBlocks } = await loadBlocks();
  const before = renderFragment(markdown);
  const after = renderFragment(markdown);
  const htmlBefore = htmlOf(after);
  // 実行
  colorDiffBlocks({
    before: { root: before, markdown },
    after: { root: after, markdown },
    segmenter: createSegmenter(),
  });
  // 検証
  expect(htmlOf(after)).toBe(htmlBefore);
});

// 単語を 1 つ書き換えた文は書き換え（正常系）
test("test_is_rewrite", async () => {
  // 準備
  const { isRewrite } = await loadBlocks();
  const { jsdiffEngine } = await loadCompute();
  // 実行
  const rewrite = isRewrite({
    before: "差分を確認する手順です。",
    after: "変更を確認する手順です。",
    segmenter: createSegmenter(),
    engine: jsdiffEngine,
  });
  // 検証
  expect(rewrite).toBe(true);
});

// 別の文は入れ替え（正常系）
test("test_is_rewrite_when_replaced", async () => {
  // 準備
  const { isRewrite } = await loadBlocks();
  const { jsdiffEngine } = await loadCompute();
  // 実行: 共通する単語が句点だけの 2 つの文
  const rewrite = isRewrite({
    before: "配布物が届く。",
    after: "表を増やす。",
    segmenter: createSegmenter(),
    engine: jsdiffEngine,
  });
  // 検証
  expect(rewrite).toBe(false);
});

// 同じ文字がちょうど半分なら書き換え（正常系）
test("test_is_rewrite_when_half", async () => {
  // 準備
  const { isRewrite } = await loadBlocks();
  const { jsdiffEngine } = await loadCompute();
  // 実行: 単語の区切りが無く、1 文字ずつ比べる
  const rewrite = isRewrite({
    before: "abcd",
    after: "abxy",
    segmenter: undefined,
    engine: jsdiffEngine,
  });
  // 検証
  expect(rewrite).toBe(true);
});
