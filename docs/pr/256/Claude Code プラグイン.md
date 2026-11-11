# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/ER図/使い方集.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/ER%E5%9B%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86.yaml) | 使い方集の索引 `guide/index.yaml` の構造 | 変更しない（行を追加するだけ） |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | 索引を検査し `plugin/guide/` へコピーするビルド | 変更しない |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | 使い方集の索引の正本（17 行） | writing の行を追加 |
| 実装 | [plugin/guide/index.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/guide/index.json) | ビルドが書く索引と、指すページのコピー（`plugin/guide/docs/`） | 再生成 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 使い方集の索引 | `guide/index.yaml` に `name: writing`・`page: docs/使い方/書く/文書の書き方.md` の行を追加する。`when` は「人向けの資料を mdmark で書くとき」の趣旨、`summary` は 4 つの決まりを並べる | 既存の行の `name` は変えない |
| 索引の文字数 | 行を追加した索引で、ビルドの索引の文字数の検査（`checkGuideSource` の `contextLimit`）を通す | 超えるときは既存の行の `when`・`summary` を確認表で短くする |
| 生成物 | ビルド（`scripts/build-plugin.ts`）を流して `plugin/guide/` を再生成し、ページの語の修正と新しいページを反映する | 手で書き換えない |
| 既存機能への影響 | `read_guide`・SessionStart のフックの入出力は変えない | 行の数・名前に依るテストは無い |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | 全実行 | 実行のみ | ✅ | `テスト結果/20261101022208_481a1a4_単体テスト.log` |
| [tests/unit/src/plugin/guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/guide.test.ts) | 全実行 | 実行のみ | ✅ | 2 ファイル 34 テスト pass<br>`テスト結果/20261101022208_481a1a4_単体テスト.log` |

lint（Biome の check と tsc の型検査）は違反 0 件。`テスト結果/20261101022509_481a1a4_lint.log`

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/integration/ClaudeCodeプラグイン/read-guide.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/read-guide.test.ts) | 全実行 | 実行のみ | ✅ | 3 テスト pass<br>`テスト結果/20261101022319_481a1a4_結合テスト.log` |
