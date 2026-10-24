# ClaudeCodeプラグイン

Claude Code プラグインの SessionStart のフックと MCP のツール

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [使い方集の索引を渡す.ts](./使い方集の索引を渡す.ts.yaml) | セッションの開始で、使い方集の索引だけを additionalContext で渡す（SessionStart） |
| [使い方集を読む.ts](./使い方集を読む.ts.yaml) | 索引の名前ごとに使い方集の本文を返す（read_guide） |
| [文書を探す.ts](./文書を探す.ts.yaml) | 索引から題・別名・概要・タグ・関係する文書で文書を引く（find_docs） |
| [タグの語彙を見る.ts](./タグの語彙を見る.ts.yaml) | 索引のタグの語彙を、説明と付いている文書の数つきで返す（list_tags） |
| [索引を書き換える.ts](./索引を書き換える.ts.yaml) | 索引の文書・用語・タグの語彙の項目を、Schema で検査してから置き換え・足し・消す（update_index） |
| [点検する.ts](./点検する.ts.yaml) | mdmark check と同じ点検をし、ずれの一覧を返す（check） |
| [文書をHTMLに書き出す.ts](./文書をHTMLに書き出す.ts.yaml) | mdmark export と同じ処理で 1 文書を 1 枚の HTML に書き出す（export_html） |
| [複数の文書を1枚のHTMLにまとめる.ts](./複数の文書を1枚のHTMLにまとめる.ts.yaml) | mdmark build と同じ処理で文書を 1 枚の HTML にまとめる（build_site） |

<!-- /table -->
