# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/scenario)・[docs/interface/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/interface)・[docs/module/](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/module) のうち Claude Code プラグインの文書 | 設計書 | ライブラリ本体と同じく、Mermaid の flow・タグと description の欠けがある |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/413825ab/docs/scenario/SC-472-15.yaml) | ガイドを参照する | Claude Code はタグ `topic:ガイド` で絞ってガイドを参照する |
| 管理用の YAML | [plugin/files.yaml](https://github.com/shuhei1101/mdmark/blob/413825ab/plugin/files.yaml) | コードの行 | 設計書への `related` が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設計書 | ライブラリ本体の計画書の変更方針と同じく移行する | - |
| ガイドのタグ | 付け直した後も、ガイドの全てのページに `topic:ガイド` を残す | dev-docs.yaml の `instructions` の絞り込みが当たるようにする |
| コードの行 | `plugin/files.yaml` の行に `related`（`implements`）を張る | - |

## テスト結果

### 単体

なし

### 結合

なし
