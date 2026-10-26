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

// 全角と半角・英字の大文字と小文字だけが違う文書の別名を被参照にする（正常系）
test("test_collect_references_when_alias_notation_differs", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const index = structuredClone(ARCH_INDEX);
  const api = index.docs.find((doc) => doc.id === "api");
  if (api) {
    api.aliases = ["MCP"];
    api.related = [];
  }
  // どちらの本文も `api` へのリンクを持たず、別名の表記だけが違う
  const documents = {
    "設計/arch.md": "# アーキテクチャ\n\nmcp を使う。",
    "api.md": "# API\n",
    "使い方/guide.md": "# 使い方\n\nＭＣＰ を使う。",
  };
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references.backlinks.api).toEqual(["arch", "guide"]);
});

// オブジェクトの関連は `to` を、文字列の関連はその文字列を参照に数える（正常系）
test("test_collect_references_when_related_objects", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const index = structuredClone(ARCH_INDEX);
  const api = index.docs.find((doc) => doc.id === "api");
  const guide = index.docs.find((doc) => doc.id === "guide");
  if (api && guide) {
    api.aliases = [];
    api.related = [
      { to: "arch", type: "requires", when: "前提を確かめるとき" },
    ];
    guide.related = ["arch"];
  }
  // どちらの本文も `arch` をリンクでも別名でも指さない
  const documents = {
    "設計/arch.md": "# アーキテクチャ\n",
    "api.md": "# API\n",
    "使い方/guide.md": "# 使い方\n",
  };
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references.backlinks.arch).toEqual(["api", "guide"]);
});
