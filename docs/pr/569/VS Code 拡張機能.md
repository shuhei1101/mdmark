# VS Code 拡張機能

## 現状

<!-- table: {"kind": "data"} -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/panel.ts) | プレビューのパネル | 違反 5 件 |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/config.ts) | 拡張機能の設定 | 違反 2 件 |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/export/embed.ts) | 書き出しの埋め込み | 違反 2 件 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/export/export.ts) | HTML の書き出し | 違反 2 件 |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/version.ts) | 配布物のバージョン | 違反 2 件 |
| 実装 | [vscode/src/preview/includes.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/includes.ts) | 取り込む文書の読み込み | 違反 1 件 |
| 実装 | [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/1d81ae93/vscode/src/preview/manager.ts) | プレビューの管理 | 違反 1 件 |
| ドキュメント | [MOD-472-104](https://github.com/shuhei1101/mdmark/blob/1d81ae93/docs/module/MOD-472-104.ts.yaml) | 引数が 4 つの `libraryOrigins` | 引数の表を更新する |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 検査の範囲 | `vscode/src/**/*.ts` を複雑さの 4 規則の `files` に含める（設定はライブラリ本体の計画書の `tools/eslint/eslint.config.js`） | Webview（`vscode/src/webview/`）の他の規則は今のまま |
| 違反の修正 | ライブラリ本体の計画書の「違反の修正」「分けた関数の配置」と同じ方針で、違反した関数を分ける | 拡張機能のコマンド・設定・Webview との通信の挙動を変えない |
| 設計書 | `libraryOrigins` の引数を、設定から取り出した値の 1 つのオブジェクトにまとめる。他の分けた関数は設計書に追加しない | ライブラリ本体の計画書の「設計書」と同じ |
| 回帰の確認 | ルートの単体テスト（`vscode/src/` の単体テストを含む）・型検査（`npm --prefix vscode run typecheck`）を全て回し、全 pass を確認する。`vscode/` の結合テストは「テスト結果」の「結合テストの実行範囲」の表のとおり | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | [1d81ae93..339299ee](https://github.com/shuhei1101/mdmark/compare/1d81ae93...339299ee) | - |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/vscode/](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode)（ルートの `npm run test:unit` で実行） | 全実行 | 実行のみ | ✅ | `テスト結果/20261115062845_271cb637_単体テスト.log` |
| 型検査（`npm --prefix vscode run typecheck`） | 全実行 | 実行のみ | ✅ | `テスト結果/20261115062845_271cb637_lint.log` |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/) の `preview-open`・`preview-diff`・`preview-rerender`・`open-config`・`export`・`00-undecidable` | 全実行 | 実行のみ | ✅ | VS Code 1.141.0 と stable（1.146.0）の 2 つの版<br>1 回目は `preview-open` の `test_normal`（配布物の要求に `map.js` が無い）が 1.141.0 で fail した。コードを変えずに流し直して、2 つの版で pass<br>`テスト結果/20261115071422_5bf9c393_結合テスト_VSCode拡張機能.log` |

#### 結合テストの実行範囲

<!-- table: {"kind": "data"} -->

| 変更したファイル | 関係する結合テスト | 回すか | 理由 |
| --- | --- | --- | --- |
| `vscode/src/preview/panel.ts`・`vscode/src/preview/manager.ts`・`vscode/src/export/export.ts` | [preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts)・[preview-diff.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-diff.test.ts)・[preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-rerender.test.ts)・[open-config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/open-config.test.ts)・[export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts)・[00-undecidable.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/00-undecidable.test.ts) | 回す | 3 つのファイルには `tests/unit/vscode/src/` の単体テストが無い。分けた処理（`openMarkdown`・`previewHtml`・`resolveAssets`・`reportLoadFailed`・`updateWatched`・`applyLoadedConfig`・`needsHtmlReload`・`openConfig`・`readExportConfig`）を通る |
| `vscode/src/`（`config.ts`・`export/embed.ts`・`preview/includes.ts`・`version.ts`・`extensions-bundle.ts`） | `vscode/tests/integration/` の `commands`・`open-settings`・`preview-link`・`preview-reload`・`release`・`scroll-sync` | 回さない | 分けた処理は `tests/unit/vscode/src/` の単体テストが覆う。分けた処理だけを通る経路を持たず、通る経路は上の 6 つと重なる |

<!-- /table -->

