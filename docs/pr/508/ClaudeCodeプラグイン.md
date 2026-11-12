# Claude Code プラグイン

## ガイドの索引からファイルツリーの記載方法に行き着く

### 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-15.yaml) | ガイドを参照する | フォルダ構成の記載で行き着く流れを追加する |
| ドキュメント | [docs/module/MOD-472-4.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-4.ts.yaml)・[MOD-472-3.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-3.ts.yaml) | guide.ts・session-start.ts | 更新対象か設計で決める |
| ドキュメント | [docs/interface/IF-472-6.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-6.ts.yaml) | 常駐サーバーの状態を伝える | SessionStart の案内に文を加える場合に更新する |
| 実装 | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml) | ガイドの索引 | `components` の `when` は「注意書き・タブ・ステップ・ファイルツリー・バッジ・目次などで本文を組むとき」で、フォルダ構成の記載に当たる語が無い |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフック | ファイルツリーの案内は無い |

### 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 索引 | `components` の `when` に「フォルダ構成・ファイルツリーを記載するとき」を加える | - |
| SessionStart | 案内に「フォルダ構成は言語 `tree` のコードブロックで記載する」の 1 行を加えるか | `未確定`（決める段: インターフェース定義設計） |

| 案 | 内容 |
| --- | --- |
| A | 加えない。索引の `when` と点検の警告で足りる |
| B | 加える |

推奨: A

記載した後の点検で警告が出て直せ、毎セッションの案内を増やさずに済むため。

## テスト結果

なし
