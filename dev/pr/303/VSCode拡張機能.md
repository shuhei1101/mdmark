# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/VSCodeでプレビューを開く.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.yaml) | プレビューを開いて mdmark で描くシナリオ | 機能をオンにした設定ファイルで、範囲の `ts`・`js` と `css` が動くシナリオを追加（#241） |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューの入出力と制約「CSP」 | `script-src` を nonce と配布物・`libraries` の origin で絞っている。範囲の `ts`・`js` を動かす経路を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの HTML と CSP | CSP の値を組む関数 |
| 実装 | [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | プレビューの HTML と CSP | CSP の `script-src` |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 範囲のスクリプトの機能（#241） | 設定ファイル `mdmark.config.yaml` の `features` を今の経路のまま mdmark へ渡し、機能がオンのときにプレビューで範囲の `ts`・`js` と `css` を当てる | 拡張機能の `settings.json` には項目を追加しない |
| CSP（#241） | CSP の値は今のまま変えない。mdmark がページの `script[nonce]` の `nonce` を読み、範囲の関数を同じ nonce を付けた `script` 要素で動かす | PoC 検証で成立（ライブラリ本体.md の `## PoC 結果`）。`blob:` を `script-src` に追加する案は採らない |
| 範囲の `ts` の変換（#241） | ライブラリ本体の `mount` と同じく、範囲に `ts` がある文書でだけ変換のライブラリを読む（要件の `## 要望` の `未確定` で A のとき）。読む URL の origin を CSP に含める | 変換のライブラリは `eval`・`new Function`・WebAssembly・Worker を使わないものに限る（ライブラリ本体.md の `## PoC 結果`） |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/vscode/src/config.test.ts` | `test_parse_config_when_html_scripts`・`test_resolve_html_scripts`・`test_library_origins_when_html_scripts` | 新規 | ✅ | 全件（1517 テスト）pass<br>`テスト結果/20261105212521_5263a1a1_単体テスト.log` |
| `tests/unit/vscode/src/config.test.ts` | `test_library_origins` | 変更 | ✅ | 同上 |

直したテスト:
- `test_library_origins`: `html-scripts.url` を省いたときはライブラリ本体の既定の URL の origin（`https://cdn.jsdelivr.net`）も CSP に含めるため、期待値に足した（`1febb090`）

lint: `テスト結果/20261105212521_5263a1a1_lint.log`（違反なし）

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/preview-open.test.ts` | `test_normal_when_range_scripts` | 新規 | ✅ | VS Code 1.141.0 と stable（1.145.0）の両方で 69 テスト pass<br>`テスト結果/20261105230946_5981f42a_結合テスト_VSCode拡張機能.log` |

インターフェース定義の期待の「CSP の違反が 0 件」は、テストが Webview の DOM を `inspectPreview` でしか読めないため、`script-src` に `blob:`・`'unsafe-inline'`・`'unsafe-eval'` が無いことと、範囲の `ts` が動き、知らせの枠と書き方の警告が無いことで確かめた。
