# Claude Code プラグイン

## ガイドの索引からファイルツリーの記載方法に行き着く

### 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-15.yaml) | ガイドを参照する | フォルダ構成の記載で行き着く流れを追加する |
| 実装 | [docs/guide/files.yml](https://github.com/shuhei1101/mdmark/blob/develop/docs/guide/files.yml) | ガイドのページの description | 『本文を部品で組む』の description は「注意書き・タブ・ステップ・ファイルツリー…を記載する手順」で、フォルダ構成の語が無い |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | ガイドの索引 | `components` の `when` は「注意書き・タブ・ステップ・ファイルツリー・バッジ・目次などで本文を組むとき」で、フォルダ構成の記載に当たる語が無い |

### 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 索引 | `docs/guide/files.yml` の『本文を部品で組む』の description と、`guide/index.yaml` の `components` の `when` に「フォルダ構成・ファイルツリーを記載するとき」を加える | dev-docs のガイドの検索は description で選ぶ |
| SessionStart | 変えない | dev-docs の instructions がガイドの検索へ導き、記載した後の点検で警告が出るため |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `41546b5e..c9338492` | - |

## テスト結果

### ドキュメント修正

なし（ガイドの Markdown・`guide/index.yaml`・`docs/guide/files.yml` の文言の修正で、規約『V字モデル』の対応表で対応する単体・結合テストが無い。ガイドの索引の検査は配布物のビルドが行い、実装の工程で回す）
