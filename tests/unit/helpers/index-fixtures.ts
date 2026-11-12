import type {
  MdmarkIndex,
  MdmarkIndexTerm,
} from "../../../src/knowledge/index-shape.ts";

/** 3 つの文書と用語 1 つを持つ索引（`api` の `related` が `arch`、`api` の別名が `公開関数`） */
export const ARCH_INDEX: MdmarkIndex = {
  schema: 2,
  docs: [
    { id: "arch", path: "設計/arch.md", title: "アーキテクチャ" },
    {
      id: "api",
      path: "api.md",
      title: "API",
      aliases: ["公開関数"],
      related: ["arch"],
    },
    { id: "guide", path: "使い方/guide.md", title: "使用方法" },
  ],
  terms: [
    {
      id: "ws",
      term: "ワークスペース",
      aliases: ["WS"],
      meaning: "話し合いの記録を配置するフォルダ",
    },
  ],
};

/** `ARCH_INDEX` の文書のパスから本文を参照する表（`arch` の本文に `api` の別名、`guide` の本文に `arch` へのリンク） */
export const ARCH_DOCUMENTS: Record<string, string> = {
  "設計/arch.md": "# アーキテクチャ\n\n公開関数を使用する。",
  "api.md": "# API\n",
  "使い方/guide.md": "# 使用方法\n\n[構成](../設計/arch.md)",
};

/** 用語集の表を 1 つ持つ Markdown。`rows` は `[用語, 意味]` の並びで、最初の行が 5 行目になる */
export function glossaryDocument(rows: Array<[string, string]>): string {
  return [
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    ...rows.map(([term, meaning]) => `| ${term} | ${meaning} |`),
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n");
}

/** やめた言い方 `作業場` を持つ用語 `ワークスペース` */
export const AVOIDED_TERMS: MdmarkIndexTerm[] = [
  {
    id: "ws",
    term: "ワークスペース",
    meaning: "話し合いの記録を配置するフォルダ",
    avoid: ["作業場"],
  },
];

/** `作業場` が 3 行目の段落（2 回）・8 行目（段落の 2 行目）・12 行目（表のセル）に出る文書。1 行目の見出しと 5 行目の行内のコードにも出る */
export const AVOIDED_GUIDE = [
  "# 作業場の手引き",
  "",
  "作業場を開き、作業場に記録を配置する。",
  "",
  "`作業場`",
  "",
  "ワークスペースを閉じる前に",
  "作業場の記録を確認する。",
  "",
  "| 項目 | 内容 |",
  "| --- | --- |",
  "| 共有 | 作業場の共有 |",
  "",
].join("\n");

/** 用語 `ワークスペース` にやめた言い方 `作業場`・`ワーク場` を持つ用語集の表だけの文書。表の中に `作業場`・`ワーク場` が出る */
export const AVOID_GLOSSARY_DOCUMENT = [
  '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}, "avoid": {"column": "やめた言い方"}} -->',
  "",
  "| 用語 | 意味 | やめた言い方 |",
  "| --- | --- | --- |",
  "| ワークスペース | 作業の配置場所 | 作業場、ワーク場 |",
  "",
  "<!-- /glossary -->",
  "",
].join("\n");

/** `AVOID_GLOSSARY_DOCUMENT` のやめた言い方が 1 行目（`作業場`）と 3 行目（`ワーク場`）に出る、表を持たない文書。5 行目の `ワークスペース` はずれにならない */
export const AVOID_GLOSSARY_GUIDE = [
  "作業場を開く。",
  "",
  "ワーク場を閉じる。",
  "",
  "ワークスペースを使用する。",
  "",
].join("\n");
