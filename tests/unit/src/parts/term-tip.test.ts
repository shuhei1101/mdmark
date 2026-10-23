import { expect, test } from "vitest";
import { findTag } from "../../helpers/html.ts";

/** 用語のツールチップの部品を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadTermTip = () => import("../../../../src/parts/term-tip.ts");

/** 部品設計『用語のツールチップ』の `DocsOnly` の関連文書 */
const API_DOC = {
  title: "API",
  href: "../api.md",
  description: "mount・render などの公開関数と引数の一覧",
};

// 部品設計の状態ごとに HTML を返す（正常系）
test("test_render_term_tip", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const termOnly = renderTermTip({
    text: "ワークスペース",
    id: "tip-term",
    meaning: "話し合いの記録を置くフォルダ",
  });
  const docsOnly = renderTermTip({
    text: "公開関数",
    id: "tip-docs",
    docs: [API_DOC],
  });
  const both = renderTermTip({
    text: "索引",
    id: "tip-both",
    meaning: "文書と用語を並べた YAML のファイル",
    docs: [API_DOC],
  });
  // 検証
  // 意味だけ: role="tooltip" で、見出し「用語」だけを持つ
  expect(findTag(termOnly, 'id="tip-term"')).toContain('role="tooltip"');
  expect(termOnly).toContain("話し合いの記録を置くフォルダ");
  expect(termOnly).toContain(">用語<");
  expect(termOnly).not.toContain("関連文書");
  // 関連文書だけ: role="group" で、見出し「関連文書」とリンクを持ち、「用語」の見出しを持たない
  expect(findTag(docsOnly, 'id="tip-docs"')).toContain('role="group"');
  expect(docsOnly).toContain("関連文書");
  expect(docsOnly).not.toContain(">用語<");
  expect(docsOnly).toContain('href="../api.md"');
  expect(docsOnly).toContain("mount・render などの公開関数と引数の一覧");
  // 両方: role="group" で、見出し「用語」の次に「関連文書」が並ぶ
  expect(findTag(both, 'id="tip-both"')).toContain('role="group"');
  expect(both.indexOf(">用語<")).toBeGreaterThan(-1);
  expect(both.indexOf(">用語<")).toBeLessThan(both.indexOf(">関連文書<"));
  expect(both).toContain("文書と用語を並べた YAML のファイル");
  // どの状態も hidden を持たない（開閉は CSS と attachTermTips が付ける class が決める）
  for (const html of [termOnly, docsOnly, both]) {
    expect(html).not.toMatch(/\shidden(?=[\s=>])/);
  }
});

// 意味と題をエスケープする（正常系）
test("test_render_term_tip_escapes", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  const html = renderTermTip({
    text: "語",
    id: "tip-escape",
    meaning: "<script>alert(1)</script>",
    docs: [{ title: "<b>題</b>", href: "../a.md" }],
  });
  // 検証
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;b&gt;題&lt;/b&gt;");
});

// `replacement` を渡すと、やめた言い方のマーカーと代わりの用語のツールチップを返す（正常系）
test("test_render_term_tip_avoided", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  // 部品設計の `Avoided` の引数に、使われないはずの `meaning`・`docs` も渡す
  const html = renderTermTip({
    text: "作業場",
    id: "tip-avoided",
    meaning: "渡しても出ない意味",
    docs: [API_DOC],
    replacement: {
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  });
  const escaped = renderTermTip({
    text: "作業場",
    id: "tip-avoided-escape",
    replacement: {
      term: "<script>語</script>",
      meaning: "<script>意味</script>",
    },
  });
  // 検証
  const word = findTag(html, "mdmark-term-avoided");
  expect(word).toContain('class="mdmark-term mdmark-term-avoided"');
  expect(word).toContain('aria-describedby="tip-avoided"');
  expect(findTag(html, 'id="tip-avoided"')).toContain('role="tooltip"');
  // 見出しは「代わりの用語」だけで、代わりの用語の語と意味が出る
  expect(html).toContain(">代わりの用語<");
  expect(html).not.toContain(">用語<");
  expect(html).not.toContain("関連文書");
  expect(findTag(html, "mdmark-term-tip-replacement")).toBeDefined();
  expect(html).toContain("ワークスペース");
  expect(html).toContain("話し合いの記録を置くフォルダ");
  // 渡した `meaning`・`docs` は出ない
  expect(html).not.toContain("渡しても出ない意味");
  expect(html).not.toContain("../api.md");
  // 代わりの用語の語と意味をエスケープする
  expect(escaped).toContain("&lt;script&gt;語&lt;/script&gt;");
  expect(escaped).toContain("&lt;script&gt;意味&lt;/script&gt;");
  expect(escaped).not.toContain("<script>");
});

// `below` を渡すと、語を包む要素に is-below を付ける（正常系）
test("test_render_term_tip_below", async () => {
  // 準備
  const { renderTermTip } = await loadTermTip();
  // 実行
  // 部品設計の `Below` と `TermOnly` の引数
  const below = renderTermTip({
    text: "ワークスペース",
    id: "tip-below",
    meaning: "話し合いの記録を置くフォルダ",
    below: true,
  });
  const termOnly = renderTermTip({
    text: "ワークスペース",
    id: "tip-term",
    meaning: "話し合いの記録を置くフォルダ",
  });
  // 検証
  expect(findTag(below, "mdmark-term-wrap")).toContain("is-below");
  expect(findTag(termOnly, "mdmark-term-wrap")).not.toContain("is-below");
});
