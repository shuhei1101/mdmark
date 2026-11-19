/** 用語集の `mdmark.config.yaml` の場所 */
export const GLOSSARY_CONFIG = "/g/mdmark.config.yaml";

/** 用語 WS・mdmark と、用語集の表の 配信元・エイリアスのアカウントを持つ用語集のファイル */
export const GLOSSARY_FILES: Record<string, string> = {
  [GLOSSARY_CONFIG]: [
    "index: index.yaml",
    "aliases:",
    "  - id: words",
    "    alias_type: term",
    "    paths:",
    "      - terms/*.yaml",
    "",
  ].join("\n"),
  "/g/index.yaml": [
    "schema: 2",
    "docs:",
    "  - id: guide",
    "    path: guide.md",
    "    title: ガイド",
    "terms:",
    "  - id: ws",
    "    term: WS",
    "    meaning: 話し合いの記録を配置するフォルダ",
    "  - id: mdmark",
    "    term: mdmark",
    "    meaning: Markdown 文書の表示を各アプリで共通に使用するライブラリ",
    "",
  ].join("\n"),
  "/g/guide.md": [
    "# ガイド",
    "",
    '<!-- glossary: {"term": {"column": "用語"}, "meaning": {"column": "意味"}} -->',
    "",
    "| 用語 | 意味 |",
    "| --- | --- |",
    "| 配信元 | 文書を配るまとまり |",
    "",
    "<!-- /glossary -->",
    "",
  ].join("\n"),
  "/g/terms/account.yaml": [
    "id: account",
    "name: アカウント",
    "description: 借りる単位",
    "",
  ].join("\n"),
};
