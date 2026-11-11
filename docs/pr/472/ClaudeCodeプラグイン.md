# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/インターフェース定義/ClaudeCodeプラグイン)・[dev/設計書/モジュール構成/ClaudeCodeプラグイン/](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/モジュール構成/ClaudeCodeプラグイン)・[dev/設計書/設定/ClaudeCodeプラグイン.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/設定/ClaudeCodeプラグイン.yaml) | Claude Code プラグインの設計書 | 種類のフォルダへ移す |
| 設定 | [plugin/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/plugin/files.yaml) | プラグインのファイルのメタデータ。関連が `dev/設計書/` を指す | 28 行目の `description` がバッククォートで始まり YAML として読めず、dev-docs が配信から除いている |
| 設定 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | 使い方集の索引。`docs/使用方法/` などのページを指す | パスを `docs/guide/` に合わせる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設計書の置き場所 | ライブラリ本体と同じ手順で、v0.4.0 の変換の後に種類のフォルダへ移す | 中身は変えない |
| パスを指す設定 | `plugin/files.yaml`・`guide/index.yaml` を移した後のパスに合わせる。`plugin/files.yaml` は書き換えるときに `description` を引用符で囲んで読めるようにする | 振る舞いは変えない |

## テスト結果

（実装で記入する）
