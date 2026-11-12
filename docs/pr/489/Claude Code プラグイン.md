# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [src/files.yaml](https://github.com/shuhei1101/mdmark/blob/bdbcf022/src/files.yaml) | `src/` のファイルの description・tags・related | `plugin/` の要件の 9 ファイルの行が無い |
| ドキュメント | `docs/module/` の MOD-472-3・5・6・7・8・10・11・12・15 | 要件の表のとおり | 参照先。変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 行の位置 | 既存の行と同じく `path` の順の位置に追加する | - |
| `description` | 既存の行と同じ書式で、受け持ちはモジュール構成の要素の `summary` から記載する | - |
| `tags` | 同じフォルダの既存の行のタグを使用する | 新しいタグを作らない |
| `related` | 要件の表の受け持つ設計書へ `implements` を記載する | - |

## テスト結果

なし。`src/files.yaml` の行の追加だけで、規約『V字モデル』の対応表で関係する単体・結合テストが無い。
