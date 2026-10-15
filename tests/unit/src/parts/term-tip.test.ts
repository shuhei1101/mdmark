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
  // 意味だけ: role="tooltip" で、関連文書の区分を持たない
  expect(findTag(termOnly, 'id="tip-term"')).toContain('role="tooltip"');
  expect(termOnly).toContain("話し合いの記録を置くフォルダ");
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
