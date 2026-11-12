# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/scenario/SC-472-6.yaml) | 単一 UC『HTMLに書き出す』。ブラウザで開く操作を含む | エイリアスの下線とツールチップが出る正常シナリオと、YAML を読み込めない行を除く異常シナリオを追加する |
| ドキュメント | [docs/scenario/SC-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/scenario/SC-472-9.yaml) | 単一 UC『PDFに印刷する』 | 書き出しと同じ HTML を組むため実行のみ |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/interface/IF-472-15.ts.yaml) | インターフェース定義『HTMLに書き出す』 | エイリアスを持つ設定の正常系と、YAML を読み込めない行の異常系を追加する |
| ドキュメント | [docs/interface/IF-472-16.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/interface/IF-472-16.ts.yaml)・[docs/interface/IF-472-18.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/interface/IF-472-18.ts.yaml) | インターフェース定義『PDFに印刷する』『ブラウザで開く』 | 書き出しと同じ HTML を組む。記述に `mount` の引数があれば合わせる |
| ドキュメント | [docs/module/MOD-472-104.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/module/MOD-472-104.ts.yaml) | `config.ts`。`loadConfig` はプレビューのときだけエイリアスを作る | 書き出しでもエイリアスを作る |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/module/MOD-472-99.ts.yaml) | `export.ts`。設定を読み込み、HTML を組んで書き込む | エイリアスと警告の受け渡しを追加する |
| ドキュメント | [docs/module/MOD-472-100.ts.yaml](https://github.com/shuhei1101/mdmark/blob/6a904ccf/docs/module/MOD-472-100.ts.yaml) | `html.ts`。`buildExportHtml` が書き出す HTML を組む | 引数にエイリアスを追加し、`mount` に指定する |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/vscode/src/config.ts) | `loadConfig` の `aliasResult` は `purpose` が `preview` のときだけ `loadPreviewAliases` を呼ぶ | 書き出しでも呼ぶ |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/vscode/src/export/export.ts) | `purpose: "export"` で `loadConfig` を呼ぶ | エイリアスを `buildExportHtml` に指定し、`aliasIssues` を出力チャネルに記録する |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/vscode/src/export/html.ts) | `mount(main, { markdown: data.markdown, config: data.config })` | エイリアスを JSON に埋め、あるときだけ `aliases` を指定する |
| テスト | [tests/unit/vscode/src/export/html.test.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/tests/unit/vscode/src/export/html.test.ts) | 書き出す HTML の単体テスト | エイリアスを指定するケースを追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| エイリアスの作成 | `loadConfig` は `purpose` によらず、設定に `aliases` があれば `loadPreviewAliases` でエイリアスを作る | 基準の設定ファイルはプレビューと同じ（最も近い `mdmark.config.yaml`、無ければ端末の設定ファイル） |
| HTML への埋め込み | `buildExportHtml` にエイリアスを指定し、`mdmark-data` の JSON に `aliases` を追加する。`mount` にはエイリアスがあるときだけ `aliases` を指定する | 設定に `aliases` が無いときは今と同じ HTML |
| エラー表示 | 読み込めない行・レコードは除いて書き出し、出力チャネルにプレビューと同じ書式で警告を記録する | 書き出しは止めず、通知も出さない |
| 対象の操作 | 「HTML に書き出す」「ブラウザで開く」「PDF に印刷する」は同じ `buildExportHtml` で HTML を組むため、3 つとも同じ変更で有効になる | - |
| 既存機能への影響 | プレビューのエイリアスの作成・再描画と、`aliases` の行の YAML を見張る処理は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `6a904ccf..b390e317` | HTMLに書き出す |
| インターフェース定義設計 | `ee594960..60b2622f` | HTMLに書き出す・プレビューを開く |
| モジュール構成設計 | `329a3e46..30dcb774` | config.ts・export.ts・html.ts。インターフェース定義『HTMLに書き出す』の制約「エイリアス」に `env` を含まないことを追加 |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/vscode/src/export/html.test.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/tests/unit/vscode/src/export/html.test.ts) | 全実行 | 変更 | ✅ | `test_build_export_html_when_aliases` を追加<br>`テスト結果/20261113074349_67e8fab1_単体テスト.log` |
| [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/6a904ccf/tests/unit/vscode/src/config.test.ts) | 全実行 | 変更 | ✅ | `test_load_config_when_export` の期待値を書き出しでもエイリアスを作る値に変更<br>`テスト結果/20261113074349_67e8fab1_単体テスト.log` |
| `npm run test:unit` | 全実行 | 実行のみ | ✅ | 284 ファイル・2068 テスト pass<br>`テスト結果/20261113074349_67e8fab1_単体テスト.log` |

Red のログ: `テスト結果/20261113073300_438e0bbf_単体テスト.log`（追加・変更した 2 テストだけが、実装が無いことで fail）

lint: `テスト結果/20261113074349_67e8fab1_lint.log`（`biome check` の警告 1 件は、この PR が触らない `plugin/bin/setup.js` のファイルサイズ）

### 結合

なし（書き出しの結合テストは無く、タスク一覧で `skipped`）

ドキュメント修正の工程は、ガイドと設定の設計書の記述だけを変えたため、関係する単体・結合テストは無い。
