import { expect, test } from "vitest";
import {
  ARCH_DOCUMENTS,
  ARCH_INDEX,
  glossaryDocument,
} from "../../helpers/index-fixtures.ts";

/** 参照の表の処理を読み込む（実装が無い間は各テストが個別に失敗する） */
const loadReferences = () => import("../../../../src/knowledge/references.ts");

// related・本文のリンク・文書の別名から被参照を作る（正常系）
test("test_collect_references", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const index = structuredClone(ARCH_INDEX);
  const documents = structuredClone(ARCH_DOCUMENTS);
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references).toEqual({
    backlinks: { arch: ["api", "guide"], api: ["arch"], guide: [] },
    glossary: [],
  });
  expect(index).toEqual(ARCH_INDEX);
  expect(documents).toEqual(ARCH_DOCUMENTS);
});

// backlinks がオフの文書は参照元にも参照先にもならず、glossary がオフの文書の表は入れない（正常系）
test("test_collect_references_when_disabled", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const documents = {
    ...ARCH_DOCUMENTS,
    "使い方/guide.md": [
      "<!-- features: -backlinks -glossary -->",
      "",
      "[構成](../設計/arch.md)",
      "",
      glossaryDocument([["印", "HTML コメントで書く指定"]]),
    ].join("\n"),
  };
  // 実行
  const references = collectReferences({ index: ARCH_INDEX, documents });
  // 検証
  expect(references.backlinks.arch).toEqual(["api"]);
  expect(references.glossary).toEqual([]);
});

// コード・見出し・リンクの文字の中の別名は参照にしない（正常系）
test("test_collect_references_ignores_code_and_headings", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const documents = {
    ...ARCH_DOCUMENTS,
    "設計/arch.md": [
      "# 公開関数",
      "",
      "`公開関数` と [公開関数](https://example.com/)",
      "",
    ].join("\n"),
  };
  // 実行
  const references = collectReferences({ index: ARCH_INDEX, documents });
  // 検証
  expect(references.backlinks.api).toEqual([]);
});
