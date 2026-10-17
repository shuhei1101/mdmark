import type { MdmarkIndex, MdmarkReferences } from "../../../src/index.ts";

/** 索引つきの `render` の結合テストが使う索引: 文書 3 つと用語 1 つ */
export const INDEX: MdmarkIndex = {
  schema: 1,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    { id: "api", path: "api.md", title: "API", aliases: ["公開関数"] },
    { id: "guide", path: "使い方/guide.md", title: "使い方" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      meaning: "話し合いの記録を置くフォルダ",
    },
  ],
};

/** 参照の表: `arch` を `api`・`guide` が参照している */
export const REFERENCES: MdmarkReferences = {
  backlinks: { arch: ["api", "guide"], api: ["arch"], guide: [] },
  glossary: [],
};

/** 描く文書の `id` */
export const DOC_ID = "arch";

/** 用語 `ワークスペース` と、文書の別名 `公開関数` が出る Markdown */
export const MARKDOWN = "ワークスペースを置き、公開関数を使う。\n";

/** 上の入力で `render` が返す HTML 文字列 */
export const EXPECTED_HTML =
  '<p><span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-describedby="mdmark-term-1">ワークスペース</span><span class="mdmark-term-tip" id="mdmark-term-1" role="tooltip"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">用語</span><span class="mdmark-term-tip-meaning">話し合いの記録を置くフォルダ</span></span></span></span>を置き、<span class="mdmark-term-wrap"><span class="mdmark-term" tabindex="0" aria-details="mdmark-term-2">公開関数</span><span class="mdmark-term-tip" id="mdmark-term-2" role="group" aria-label="「公開関数」の関連文書"><span class="mdmark-term-tip-section"><span class="mdmark-term-tip-heading">関連文書</span><span class="mdmark-term-tip-docs" role="list"><span class="mdmark-term-tip-doc" role="listitem"><a href="../api.md">API</a></span></span></span></span></span>を使う。</p>\n<nav class="mdmark-backlinks" aria-labelledby="mdmark-backlinks-title"><p class="mdmark-backlinks-title" id="mdmark-backlinks-title">関連文書</p><ul><li><a href="../api.md">API</a></li><li><a href="../使い方/guide.md">使い方</a></li></ul></nav>';
