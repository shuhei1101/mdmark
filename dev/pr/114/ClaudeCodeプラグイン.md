# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引から文書を探す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.yaml) | `find_docs` で文書を引くシナリオ。返る行は ID・パス・題名・概要・タグ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引を書き換える.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.yaml) | `update_index` で文書か用語を書き換えるシナリオ | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` の引数 `text`・`tags`（AND）・`related_to`・`config`。条件を 1 つも渡さなければ全ての文書を、索引の並びの JSON で返す | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/索引を書き換える.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.ts.yaml) | `update_index` の `kind` は `doc`・`term` | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | MCP の `check` のずれの一覧 | 追従の要否をインターフェース定義設計で確かめる |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | `TOOLS`・`runFindDocs`・`runUpdateIndex`・`callTool` | 更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | MCP のツールの定義と処理。結果は `texts` か JSON 1 つのテキストで返し、structuredContent と `readOnlyHint` を持たない | 更新対象 |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | ツールの一覧の登録と呼び出しの振り分け | annotations を出すときに更新対象 |
| テスト | [tests/integration/ClaudeCodeプラグイン/find-docs.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/find-docs.test.ts) | `find_docs` の結合テスト | 更新対象 |
| テスト | [tests/integration/ClaudeCodeプラグイン/update-index.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/update-index.test.ts) | `update_index` の結合テスト | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/索引から文書を探す.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.spec.ts) | 文書を探す E2E | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/索引を書き換える.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.spec.ts) | 索引を書き換える E2E | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| find_docs のタグ | 全てを持つ文書（今の `tags`）に加えて、どれかを持つ文書で絞る引数を加え、主題のタグの一致を上に並べる | 引数の形（AND / OR の切り替えの引数か、OR のタグの別の引数か）はインターフェース定義設計で決める |
| find_docs の件数と続き | 既定 20・上限 100 の `limit` と、続きを指す `cursor` を加え、総件数・返した件数・合計文字数・`next_cursor`・タグごとの件数を返す | 引数なしでも全ての文書は返さない |
| find_docs の返す量 | `view`（`brief` / `standard` / `full`、既定 `brief`）と `include` / `exclude` を加え、省いた項目を `omitted` で返す | 各 `view` の項目と `include` の項目は要件の `未確定` |
| find_docs の文字数 | 各行の文字数と合計文字数は、索引に載った文書のファイルの文字数で数える | 文書のファイルが無いときの扱いはインターフェース定義設計で決める |
| find_docs の件数だけ | `count_only: true` のとき、一覧を返さずに総件数・合計文字数・タグごとの件数だけを返す | - |
| find_docs の未登録のタグ | 語彙を記載した索引で語彙に無いタグを渡したときは、拒否せず結果に警告と近い語彙のタグを添える | - |
| 返す形式 | `find_docs` に `format`（`markdown` / `json`、既定 `markdown`）を加える。`markdown` は表のテキストだけを返し、`json` は structuredContent と text に同じ JSON を入れる | 書き込み・点検など他のツールの返し方は変えない |
| readOnlyHint | 読み取りのツール（`read_guide`・`find_docs`・`check`）に `readOnlyHint: true` を付ける | 付けるツールはインターフェース定義設計で確かめる |
| update_index | `kind` に `tag` を加え、語彙のタグを `name` で足す・置き換える・消す | 書く前の索引のスキーマの検査は今と同じ |

## テスト結果
