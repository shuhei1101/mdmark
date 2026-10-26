import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, inject, test } from "vitest";
import type { MdmarkIndex, MdmarkReferences } from "../../../src/index.ts";

type Built = {
  collectReferences: (input: {
    index: MdmarkIndex;
    documents: Record<string, string>;
  }) => MdmarkReferences;
};

/** ビルドした配布物を Node で読み込む */
async function loadBuilt(): Promise<Built> {
  const url = pathToFileURL(join(inject("builtRoot"), "dist", "index.js")).href;
  return await import(url);
}

/** 3 つの文書を持つ索引（`api` の `related` が `arch`、`api` の別名が `公開関数`） */
const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    {
      id: "api",
      path: "api.md",
      title: "API",
      aliases: ["公開関数"],
      related: ["arch"],
    },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

/** `INDEX` の文書の本文（`arch` に `api` の別名、`guide` に `arch` へのリンク） */
const DOCUMENTS: Record<string, string> = {
  "設計/arch.md": "# アーキテクチャ\n\n公開関数を使う。",
  "api.md": "# API\n",
  "使い方/guide.md": "# 使い方\n\n[構成](../設計/arch.md)",
};

// related・本文のリンク・文書の別名から被参照を作る（正常系）
test("test_normal", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const index = structuredClone(INDEX);
  const documents = structuredClone(DOCUMENTS);
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references.backlinks.arch).toEqual(["api", "guide"]);
  expect(references.backlinks.api).toEqual(["arch"]);
  expect(references.backlinks.guide).toEqual([]);
  expect(references.glossary).toEqual([]);
  expect(index).toEqual(INDEX);
  expect(documents).toEqual(DOCUMENTS);
});

// 全角と半角・大文字と小文字だけが違う別名の出現も被参照にする（正常系）
test("test_normal_when_alias_notation_differs", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const index: MdmarkIndex = {
    ...INDEX,
    docs: INDEX.docs.map((doc) =>
      doc.id === "api"
        ? { id: doc.id, path: doc.path, title: doc.title, aliases: ["MCP"] }
        : doc,
    ),
  };
  // どちらの本文も `api` を指すリンクを持たず、別名の出現の表記だけが違う
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

// 各文書の用語集の表から用語を集める（正常系）
test("test_normal_when_glossary_table", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const index: MdmarkIndex = {
    schema: 1,
    docs: [
      { id: "glossary", path: "用語集.md", title: "用語集" },
      { id: "guide", path: "使い方/guide.md", title: "使い方" },
    ],
  };
  const documents = {
    "用語集.md": [
      "<!-- glossary: term=用語 aliases=別名 meaning=意味 avoid=やめた言い方 -->",
      "",
      "| 用語 | 別名 | 意味 | やめた言い方 |",
      "| --- | --- | --- | --- |",
      "| 印 | マーク、オン・オフの印 | HTML コメントで書く指定 | しるし |",
      "",
      "<!-- /glossary -->",
      "",
    ].join("\n"),
    "使い方/guide.md": "# 使い方\n",
  };
  // 実行
  const references = collectReferences({ index, documents });
  // 検証
  expect(references.glossary).toEqual([
    {
      term: "印",
      aliases: ["マーク", "オン・オフの印"],
      meaning: "HTML コメントで書く指定",
      docId: "glossary",
      avoid: ["しるし"],
    },
  ]);
});

// Schema に合わない文書を除いて作り、例外を投げない（正常系）
test("test_normal_when_invalid_index", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const index = {
    ...INDEX,
    docs: [
      ...INDEX.docs,
      { id: "broken", title: "壊れた文書", related: ["arch"] },
    ],
  } as unknown as MdmarkIndex;
  // 実行
  const references = collectReferences({ index, documents: DOCUMENTS });
  // 検証
  expect(references.backlinks.arch).toEqual(["api", "guide"]);
  expect(Object.keys(references.backlinks)).not.toContain("broken");
});

// 符号化して書いたリンクと ?・# を持つリンクも、同じ文書への参照にする（正常系）
test("test_normal_when_encoded_link", async () => {
  // 準備
  const { collectReferences } = await loadBuilt();
  const documents = {
    ...DOCUMENTS,
    "使い方/guide.md":
      "# 使い方\n\n[構成](../%E8%A8%AD%E8%A8%88/arch.md?v=1#top)",
  };
  // 実行
  const references = collectReferences({ index: INDEX, documents });
  // 検証
  expect(references.backlinks.arch).toEqual(["api", "guide"]);
});
