# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/](https://github.com/shuhei1101/mdmark/blob/b129cd3e/docs/scenario)・[docs/interface/](https://github.com/shuhei1101/mdmark/blob/b129cd3e/docs/interface)・[docs/module/](https://github.com/shuhei1101/mdmark/blob/b129cd3e/docs/module)・[docs/config/](https://github.com/shuhei1101/mdmark/blob/b129cd3e/docs/config) のうち Claude Code プラグインの文書 | 設計書 | - |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設計書 | ライブラリ本体の計画書の変更方針と同じく、文を削除して点検し、エイリアスと用語を登録する | - |
| ガイドのタグ | 文を削除した後も、ガイドの全てのページに `topic:ガイド` を残す | `project-index.yaml` の `instructions` の絞り込みがガイドにヒットするようにする |

## テスト結果

### 単体

なし。

### 結合

なし。
