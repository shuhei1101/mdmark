import type { MdmarkIndex } from "../../../src/knowledge/index-shape.ts";

/** 3 つの文書と用語 1 つを持つ索引（`api` の `related` が `arch`、`api` の別名が `公開関数`） */
export const ARCH_INDEX: MdmarkIndex = {
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

/** `ARCH_INDEX` の文書のパスから本文を引く表（`arch` の本文に `api` の別名、`guide` の本文に `arch` へのリンク） */
export const ARCH_DOCUMENTS: Record<string, string> = {
  "設計/arch.md": "# アーキテクチャ\n\n公開関数を使う。",
  "api.md": "# API\n",
  "使い方/guide.md": "# 使い方\n\n[構成](../設計/arch.md)",
};

/** 用語集の表を 1 つ持つ Markdown。`rows` は `[用語, 意味]` の並びで、最初の行が 5 行目になる */
export function glossaryDocument(rows: Array<[string, string]>): string {
  return [
    "<!-- glossary: term=用語 meaning=意味 -->",
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    ...rows.map(([term, meaning]) => `| ${term} | ${meaning} |`),
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
}
