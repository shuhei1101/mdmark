import type { Token } from "markdown-it";
import { expect, test } from "vitest";
import { DEFAULT_FEATURES } from "../../../../src/config.ts";
import {
  findWords,
  matchableChildren,
} from "../../../../src/knowledge/dictionary.ts";
import { parseDocument } from "../../../../src/knowledge/references.ts";

/** 本文の位置の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadPositions = () => import("../../../../src/knowledge/positions.ts");

/** 本文の行内のトークンを、本文の頭から順に返す */
function inlineTokens(body: string): Token[] {
  const { tokens } = parseDocument({
    body,
    docId: "guide",
    defaults: DEFAULT_FEATURES,
  });
  return tokens.filter((token) => token.type === "inline");
}

// 記法の記号を飛ばして文字を当てる（正常系）
test("test_align_text", async () => {
  // 準備
  const { alignText } = await loadPositions();
  // 実行
  const aligned = alignText({
    body: "**ワークスペース**",
    cursor: 0,
    text: "ワークスペース",
  });
  // 検証
  // 7 文字の始まりと、末尾に足した終わりの位置
  expect(aligned.offsets).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
  expect(aligned.end).toBe(9);
});

// エスケープと実体参照を数えて当てる（正常系）
test("test_align_text_with_escape_and_entity", async () => {
  // 準備
  const { alignText } = await loadPositions();
  const body = String.raw`\*記号\* と A&amp;B`;
  const text = "*記号* と A&B";
  // 実行
  const aligned = alignText({ body, cursor: 0, text });
  const hex = alignText({
    body: "&#x30EF;ークス",
    cursor: 0,
    text: "ワークス",
  });
  // 検証
  expect(aligned.offsets).toHaveLength(text.length + 1);
  // 記号の文字は、エスケープの後ろの本文の位置を指す
  expect(aligned.offsets[1]).toBe(2);
  expect(aligned.offsets[2]).toBe(3);
  // `A&B` の範囲が、本文の `A&amp;B` を指す
  const start = text.indexOf("A&B");
  expect(aligned.offsets[start]).toBe(body.indexOf("A&amp;B"));
  expect(aligned.offsets[start + 1]).toBe(body.indexOf("&amp;"));
  expect(aligned.offsets[start + 3]).toBe(body.length);
  expect(body.slice(aligned.offsets[start], aligned.offsets[start + 3])).toBe(
    "A&amp;B",
  );
  expect(aligned.end).toBe(body.length);
  // 数値の実体参照は、戻した 1 文字が実体参照の全体を指す
  expect(hex.offsets).toEqual([0, 8, 9, 10, 11]);
});

// 同じ綴りが先に行内のコードとリンクの文字にあっても、地の文の位置を返す（正常系）
test("test_inline_offsets", async () => {
  // 準備
  const { inlineOffsets } = await loadPositions();
  const body =
    "`ワークスペース` と [ワークスペース](./WS/ws.md) の後ろのワークスペース";
  const [inline] = inlineTokens(body);
  expect(inline).toBeDefined();
  // 実行
  const aligned = inlineOffsets({ body, inline: inline as Token, start: 0 });
  // 検証
  // コード・リンクの文字は照合してよい子に入らず、位置も返らない
  const positions = matchableChildren(inline as Token);
  expect([...aligned.byChild.keys()]).toEqual(positions);
  expect(positions).toHaveLength(2);
  // 地の文の子の各文字が、本文の同じ文字を指す
  for (const [position, offsets] of aligned.byChild) {
    const content = inline?.children?.[position]?.content ?? "";
    expect(offsets).toHaveLength(content.length + 1);
    [...content].forEach((char, at) => {
      expect(body[offsets[at] ?? -1]).toBe(char);
    });
  }
  // 地の文の `ワークスペース` は、本文の最後の綴りを指す
  const last = aligned.byChild.get(positions[1] as number) ?? [];
  const found = findWords(
    inline?.children?.[positions[1] as number]?.content ?? "",
    ["ワークスペース"],
  );
  expect(found).toHaveLength(1);
  expect(last[found[0]?.start ?? -1]).toBe(body.lastIndexOf("ワークスペース"));
  expect(aligned.end).toBe(body.length);
});

/** 複数行の段落・リストの入れ子・引用・表のセル・強調・エスケープ・実体参照・参照形式のリンク・画像・字下げの見本 */
const BLOCKS = [
  "ワークスペースを開く。",
  "",
  "ワークスペースを開き、",
  "次の行の WS を確かめる。",
  "",
  "- 項目のワークスペース",
  "  - 入れ子の WS",
  "    続きの行のワークスペース",
  "",
  "> 引用の WS",
  "> > 入れ子の引用のワークスペース",
  "",
  "| 項目 | 内容 |",
  "| --- | --- |",
  "| WS | ワークスペースの表 |",
  "",
  "**ワークスペース** と *WS*",
  "",
  String.raw`\*記号\* の後ろのワークスペース`,
  "",
  "&amp; の後ろの WS と A&amp;B",
  "",
  "[文字][ref] の後ろのワークスペース",
  "",
  "![画像の文字](a.png) の後ろの WS",
  "",
  "   字下げした段落のワークスペース",
  "",
  "[ref]: ./ws.md",
  "",
].join("\n");

// 複数行の段落・リストの入れ子・引用・表のセル・参照形式のリンク・画像の後ろでも、本文の行と行の中の位置が合う（正常系）
test("test_inline_offsets_in_blocks", async () => {
  // 準備
  const { inlineOffsets } = await loadPositions();
  const body = BLOCKS;
  const lines = body.split("\n");
  // 各行の頭の、本文の頭からの位置
  const lineStarts = lines.map((_, at) =>
    lines.slice(0, at).reduce((sum, line) => sum + line.length + 1, 0),
  );
  const words = ["ワークスペース", "WS", "A&B"];
  // 実行
  const matched: Array<{
    line: number;
    start: number;
    end: number;
    word: string;
  }> = [];
  let previous: { line: number; end: number } | undefined;
  for (const inline of inlineTokens(body)) {
    const line = inline.map?.[0] ?? 0;
    // 同じ行から始まる行内のトークン（表のセル）は、前のセルを当て終えた位置から始める
    const start =
      previous?.line === line ? previous.end : (lineStarts[line] ?? 0);
    const aligned = inlineOffsets({ body, inline, start });
    previous = { line, end: aligned.end };
    for (const [position, offsets] of aligned.byChild) {
      const content = inline.children?.[position]?.content ?? "";
      for (const found of findWords(content, words)) {
        const from = offsets[found.start] ?? -1;
        const to = offsets[found.end] ?? -1;
        const row = body.slice(0, from).split("\n").length;
        matched.push({
          line: row,
          start: from - (lineStarts[row - 1] ?? 0),
          end: to - (lineStarts[row - 1] ?? 0),
          word: found.word,
        });
      }
    }
  }
  // 検証
  // 見本の地の文の一致は 18 件
  expect(matched).toHaveLength(18);
  // 本文の行を切り出した文字が、一致した文字と同じ（実体参照は戻して同じ）
  for (const match of matched) {
    const cut = (lines[match.line - 1] ?? "").slice(match.start, match.end);
    expect(cut.replaceAll("&amp;", "&")).toBe(match.word);
  }
  // 表のセルは、同じ行のそれぞれのセルの位置を指す
  const row = lines.indexOf("| WS | ワークスペースの表 |") + 1;
  expect(
    matched
      .filter((match) => match.line === row)
      .map((match) => [match.word, match.start]),
  ).toEqual([
    ["WS", 2],
    ["ワークスペース", 7],
  ]);
});

// タグ・コメント・落ちる要素の中と、照合しない要素が直接持つ文字を伏せ、要素の文字と入れ子の文字を残す（正常系）
test("test_mask_embedded_html", async () => {
  // 準備
  const { maskEmbeddedHtml } = await loadPositions();
  const html =
    '<span title="語">語</span><!-- 語 --><script>語</script><code>語</code><a href="#">語</a><a href="#"><span>入</span></a><h2><em>見</em></h2>';
  // 実行
  const masked = maskEmbeddedHtml(html);
  // 検証
  expect(masked).toHaveLength(html.length);
  // 最初の span の要素の文字・a の中の span の文字・見出しの中の em の文字だけが残る
  expect(masked.replace(/[^語入見]/g, "")).toBe("語入見");
  expect(masked).not.toMatch(/[<>]/);
  // 残る文字は、元の位置のまま
  for (const char of ["語", "入", "見"]) {
    const at = masked.indexOf(char);
    expect(html[at]).toBe(char);
  }
  expect(masked.indexOf("語")).toBe(html.indexOf(">語</span>") + 1);
});
