import { expect, test } from "vitest";
import type { MdmarkIndex } from "../../../../src/knowledge/index-shape.ts";
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
    docs: ARCH_INDEX.docs,
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
      '<!-- features: {"backlinks": false, "glossary": false} -->',
      "",
      "[構成](../設計/arch.md)",
      "",
      glossaryDocument([["マーカー", "HTML コメントで記載する指定"]]),
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
    "設計/arch.md": "# アーキテクチャ\n\nmcp を使用する。",
    "api.md": "# API\n",
    "使い方/guide.md": "# 使用方法\n\nＭＣＰ を使用する。",
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
      { to: "arch", type: "requires", when: "前提を確認するとき" },
    ];
    guide.related = ["arch"];
  }
  // どちらの本文も `arch` をリンクでも別名でも指さない
  const documents = {
    "設計/arch.md": "# アーキテクチャ\n",
    "api.md": "# API\n",
    "使い方/guide.md": "# 使用方法\n",
  };
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references.backlinks.arch).toEqual(["api", "guide"]);
});

// フロントマターの中のリンクと用語集の表を読み込まず、後ろの行番号を保つ（正常系）
test("test_parse_document_when_frontmatter", async () => {
  // 準備
  const { parseDocument } = await loadReferences();
  const body = [
    "---",
    'see: "[設計](../設計/arch.md)"',
    "| 用語 | 意味 |",
    "---",
    "",
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 公開関数 | 外から呼ぶ関数 |",
    "",
  ].join("\n");
  // 実行
  const parsed = parseDocument({
    body,
    docId: "guide",
    defaults: { glossary: true },
  });
  // 検証
  const links = parsed.tokens
    .flatMap((token) => token.children ?? [])
    .filter((child) => child.type === "link_open");
  expect(links).toEqual([]);
  expect(parsed.glossary.map((row) => row.entry.term)).toEqual(["公開関数"]);
  expect(parsed.glossary[0]?.line).toBe(10);
});

/** `arch` の行を `id`・`path` だけにした索引（インターフェース定義『参照の表を作る』の「正常系（フロントマターのメタデータ）」） */
const FRONTMATTER_INDEX = {
  ...ARCH_INDEX,
  docs: [
    { id: "arch", path: "設計/arch.md" },
    ...ARCH_INDEX.docs.filter((doc) => doc.id !== "arch"),
  ],
} as MdmarkIndex;

/** フロントマターを持つ本文と、索引に無い `note.md`（`title` を持つ）・`draft.md`（フロントマター無し） */
const FRONTMATTER_DOCUMENTS: Record<string, string> = {
  "設計/arch.md": [
    "---",
    "title: アーキテクチャ",
    "aliases: [構成図]",
    "---",
    "",
    "公開関数を使用する。",
  ].join("\n"),
  "api.md": "# API\n",
  "使い方/guide.md": ["---", "aliases: 使い方", "---", "", "構成図を参照する。"].join(
    "\n",
  ),
  "note.md": ["---", "title: メモ", "---", "", "[構成](設計/arch.md)"].join("\n"),
  "draft.md": "[構成](設計/arch.md)",
};

/** `FRONTMATTER_DOCUMENTS` の各文書のフロントマターを解析した値 */
const FRONTMATTER_VALUES: Record<string, unknown> = {
  "設計/arch.md": { title: "アーキテクチャ", aliases: ["構成図"] },
  "使い方/guide.md": { aliases: "使い方" },
  "note.md": { title: "メモ" },
};

// フロントマターで補った文書を docs に入れ、加えた文書も被参照に数える（正常系）
test("test_collect_references_when_frontmatter_metadata", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  const index = structuredClone(FRONTMATTER_INDEX);
  const documents = structuredClone(FRONTMATTER_DOCUMENTS);
  // 実行
  const references = collectReferences({
    index,
    documents,
    frontmatter: FRONTMATTER_VALUES,
  });
  // 検証
  expect(references.docs?.[0]).toEqual({
    id: "arch",
    path: "設計/arch.md",
    title: "アーキテクチャ",
    aliases: ["構成図"],
  });
  const guide = references.docs?.find((doc) => doc.id === "guide");
  expect(guide?.aliases).toBeUndefined();
  expect(references.docs?.at(-1)).toEqual({
    id: "note.md",
    path: "note.md",
    title: "メモ",
  });
  expect(references.docs?.some((doc) => doc.id === "draft.md")).toBe(false);
  expect(references.backlinks.arch).toEqual(["api", "guide", "note.md"]);
  expect(Object.keys(references.backlinks)).not.toContain("draft.md");
  expect(index).toEqual(FRONTMATTER_INDEX);
  expect(documents).toEqual(FRONTMATTER_DOCUMENTS);
});

// frontmatter を省くと索引に無い文書を加えず、被参照は今と同じ（正常系）
test("test_collect_references_when_no_frontmatter_input", async () => {
  // 準備
  const { collectReferences } = await loadReferences();
  // 実行
  const references = collectReferences({
    index: FRONTMATTER_INDEX,
    documents: FRONTMATTER_DOCUMENTS,
  });
  // 検証
  expect(Object.keys(references.backlinks)).not.toContain("note.md");
  expect(references.docs?.map((doc) => doc.id)).toEqual([
    "arch",
    "api",
    "guide",
  ]);
});

// 型の合うキーだけを取り出す（正常系）
test("test_read_frontmatter_metadata", async () => {
  // 準備
  const { readFrontmatterMetadata } = await loadReferences();
  const value = {
    title: "メモ",
    description: 1,
    aliases: "別名",
    tags: ["設計", { name: "topic:mcp", main: true }],
    id: "x",
  };
  // 実行
  const metadata = readFrontmatterMetadata(value);
  // 検証
  expect(metadata).toEqual({
    title: "メモ",
    tags: ["設計", { name: "topic:mcp", main: true }],
  });
});

// マッピングでない値は空にする（正常系）
test("test_read_frontmatter_metadata_when_not_mapping", async () => {
  // 準備
  const { readFrontmatterMetadata } = await loadReferences();
  // 実行
  const results = [["title"], "title", null].map((value) =>
    readFrontmatterMetadata(value),
  );
  // 検証
  expect(results).toEqual([{}, {}, {}]);
});

// 索引に無いキーだけを補い、両方にあるキーは索引の値にする（正常系）
test("test_supplement_index_docs", async () => {
  // 準備
  const { supplementIndexDocs } = await loadReferences();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "api", path: "api.md", title: "API" }],
  };
  // 実行
  const { docs } = supplementIndexDocs({
    index,
    documents: { "api.md": "# API\n" },
    frontmatter: { "api.md": { title: "公開関数", description: "引数の一覧" } },
  });
  // 検証
  expect(docs).toEqual([
    { id: "api", path: "api.md", title: "API", description: "引数の一覧" },
  ]);
});

// title を持つ索引に無い文書だけを加える（正常系）
test("test_supplement_index_docs_when_unindexed", async () => {
  // 準備
  const { supplementIndexDocs } = await loadReferences();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "api", path: "api.md", title: "API" }],
  };
  // 実行
  const { docs, added } = supplementIndexDocs({
    index,
    documents: {
      "api.md": "# API\n",
      "note.md": "---\ntitle: メモ\n---\n",
      "draft.md": "下書き\n",
    },
    frontmatter: { "note.md": { title: "メモ" } },
  });
  // 検証
  expect(docs.at(-1)).toEqual({ id: "note.md", path: "note.md", title: "メモ" });
  expect([...added]).toEqual(["note.md"]);
});

// 索引の id と重なる文書は加えない（正常系）
test("test_supplement_index_docs_when_id_conflicts", async () => {
  // 準備
  const { supplementIndexDocs } = await loadReferences();
  const index: MdmarkIndex = {
    schema: 2,
    docs: [{ id: "note.md", path: "a.md", title: "A" }],
  };
  // 実行
  const { added } = supplementIndexDocs({
    index,
    documents: { "a.md": "# A\n", "note.md": "---\ntitle: メモ\n---\n" },
    frontmatter: { "note.md": { title: "メモ" } },
  });
  // 検証
  expect(added.size).toBe(0);
});

// どこにも title が無い索引の文書は h1 かファイル名で補う（正常系）
test("test_supplement_index_docs_when_no_title", async () => {
  // 準備
  const { supplementIndexDocs } = await loadReferences();
  const index = {
    schema: 2,
    docs: [
      { id: "guide", path: "使い方/guide.md" },
      { id: "faq", path: "faq.md" },
    ],
  } as MdmarkIndex;
  // 実行
  const { docs } = supplementIndexDocs({
    index,
    documents: { "使い方/guide.md": "# 使用方法\n", "faq.md": "本文だけ\n" },
  });
  // 検証
  expect(docs.map((doc) => doc.title)).toEqual(["使用方法", "faq"]);
});

// 索引のタイトルを最優先する（正常系）
test("test_resolve_doc_title", async () => {
  // 準備
  const { resolveDocTitle } = await loadReferences();
  // 実行
  const title = resolveDocTitle({
    path: "api.md",
    markdown: "# 一覧\n",
    indexTitle: "API",
    frontmatterTitle: "公開関数",
  });
  // 検証
  expect(title).toBe("API");
});

// 索引のタイトルが無ければフロントマターのタイトルを h1 より優先する（正常系）
test("test_resolve_doc_title_when_frontmatter", async () => {
  // 準備
  const { resolveDocTitle } = await loadReferences();
  // 実行
  const title = resolveDocTitle({
    path: "配布.md",
    markdown: "---\ntitle: 配布の手順\n---\n\n# はじめに\n",
    frontmatterTitle: "配布の手順",
  });
  // 検証
  expect(title).toBe("配布の手順");
});

// h1 も無ければファイル名（正常系）
test("test_resolve_doc_title_when_no_heading", async () => {
  // 準備
  const { resolveDocTitle } = await loadReferences();
  // 実行
  const title = resolveDocTitle({
    path: "使い方/guide.md",
    markdown: "---\n# 見出し\nsummary: 説明\n---\n\n本文だけ\n",
  });
  // 検証
  expect(title).toBe("guide");
});
