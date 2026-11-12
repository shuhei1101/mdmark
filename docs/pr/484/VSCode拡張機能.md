# VSCode拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-10.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-10.yaml) | VSCodeでプレビューを開く | 相対パスの `syntax.url` で色分けするシナリオを追加 |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-6.yaml) | HTMLに書き出す | 相対パスの `syntax.url` を埋めるシナリオを追加 |
| ドキュメント | [docs/interface/IF-472-21.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-21.ts.yaml) | プレビューを再描画する（制約「設定の取り出し方」・相対パスの解決と CSP の origin の再読み込み） | 取り出すキーに `tooltips`・`syntax` を、相対パスを解決する値に `syntax.url` を追加 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く（CSP・`render` の `config` の形） | `syntax.url` の origin と `config` の `tooltips`・`syntax` を追加 |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す（制約「埋めるライブラリ」） | 相対パスの `syntax.url` の埋め方を追加 |
| ドキュメント | [docs/interface/IF-472-18.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-18.ts.yaml) / [docs/interface/IF-472-16.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-16.ts.yaml) | ブラウザで開く・PDFに印刷する | HTMLに書き出すと同じ `config` で書き出す。記述の追随を確かめる |
| ドキュメント | [docs/module/MOD-472-104.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-104.ts.yaml) | 設定 / config.ts（`PreviewConfig`・`pickPreviewConfig`・`libraryOrigins`・`resolveMermaid`） | `tooltips`・`syntax` の取り出しと `syntax.url` の解決・origin を追加 |
| ドキュメント | [docs/module/MOD-472-90.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-90.ts.yaml) / [docs/module/MOD-472-92.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-92.ts.yaml) | プレビュー / panel.ts・html.ts | 相対パスの `syntax.url` の解決と CSP の origin を追加 |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-99.ts.yaml) / [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-102.ts.yaml) | 書き出し / export.ts・embed.ts | 相対パスの `syntax.url` を埋める |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `pickPreviewConfig`・`libraryOrigins`・`resolveHtmlScripts`・`resolveMermaid` | `tooltips`・`syntax` を追加 |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) / [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) | `render` の `config` と CSP | `syntax.url` の解決と origin を追加 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) / [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/embed.ts) | 書き出す HTML の `config` と相対パスの値の埋め方 | 相対パスの `syntax.url` を埋める |
| テスト | [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/config.test.ts) / [tests/unit/vscode/src/export/embed.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/export/embed.test.ts) | 設定の取り出し・埋め方の単体テスト | ケースを追加 |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) / [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | プレビューと書き出しの結合テスト | ケースを追加 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `PreviewConfig`・`pickPreviewConfig` | 重ねた設定の `tooltips`・`syntax` がマップのときだけ取り出す。マップでないときは指定しない | `labels` と同じ扱い |
| `tooltips` | 記載した値のまま `mount` に指定する | 相対パスの解決は要らない |
| CSP | `syntax.url`（記載しないときは既定の jsDelivr）の `http:`・`https:` の origin を `script-src` に追加する。再読み込みで origin の集まりが変わったら Webview の HTML を入れ直す | `mermaid.url` と同じ扱い |
| プレビューの相対パスの `syntax.url` | 設定ファイルのフォルダから解決したフォルダを Webview の URL にし、末尾の `/` を残す | `localResourceRoots` の外は Webview が読み込めず、色分けせずに描く |
| 書き出しの相対パスの `syntax.url` | 文書が使用する言語があるときだけ、本体と言語のモジュールを HTML に埋める | `data:` の URL を import map で割り当てる（[要件](./要件.md)） |
| 単体テスト | `tooltips`・`syntax` の取り出し・`syntax.url` の解決と origin・埋め方のケースを追加する | - |
| 結合テスト | プレビューと書き出した HTML で、`tooltips.placement` の位置と相対パスの `syntax.url` の色分けを確かめる | 不具合は拡張機能の画面で効かないことなので、描いた結果で確かめる |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `076685e8..0887d22e` | VSCodeでプレビューを開く・HTMLに書き出す・記載した内容をプレビューに映す |
| 単一ユースケース設計 | `0887d22e..7f1f1b22` | レビューの指摘の修正（色分けのライブラリの手元のコピーを `@highlightjs/cdn-assets` の `es/` と明記） |
| インターフェース定義設計 | `ef884572..4703c5ea` | プレビューを再描画する・プレビューを開く・HTMLに書き出すと設定（VS Code 拡張機能）。develop の取り込み（#483）を含む |
| モジュール構成設計 | `1b4d4ae8..11d595b1` | 設定（`tooltips`・`syntax` の取り出し・色分けのライブラリの URL を修正する・`libraryOrigins` の `syntax`）・プレビュー（panel.ts）・書き出し（相対パスの色分けのライブラリを埋める・import map）。インターフェース定義の任意の指摘（IF-472-21 の再読み込みで比べる origin に `mermaid.url`）の修正を含む |
| モジュール構成設計 | `4ea9af36..0ad400c7` | レビューの任意の指摘の修正（書き出しで `config.syntax` を置き換える・`buildCsp` の `syntax.url` の origin） |
| モジュール構成設計 | `308b8fa5..17a18454` | 実装で判明した責務の移動。`usedSyntaxLanguages` を `src/render/used.ts` から import する（[ライブラリ本体](./ライブラリ本体.md)）。IF-472-15 の制約「埋める色分けのライブラリ」の参照先も直す |

## 実装

| 項目 | 内容 |
| --- | --- |
| バンドルの確認 | `usedSyntaxLanguages` を `src/render/used.ts` から import した後の `vscode/dist/extension.cjs` に、ネイティブの `esbuild` の `ESBUILD_BINARY_PATH` が 0 件（develop と同じ） |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/vscode/src/config.test.ts` | 全実行 | 新規・変更 | ✅ | `test_library_origins_when_syntax`・`test_resolve_syntax`・`test_load_config_when_tooltips_and_syntax` を追加。`test_library_origins_when_mermaid` の期待値に既定の jsDelivr の origin を追加（設計書の修正のとおり）<br>`テスト結果/20261112225936_4bee4d9d_単体テスト.log`<br>Red: `テスト結果/20261112222508_308b8fa5_単体テスト.log` |
| `tests/unit/vscode/src/export/embed.test.ts` | 全実行 | 新規 | ✅ | `test_embed_local_syntax` ほか 3 件<br>`テスト結果/20261112225936_4bee4d9d_単体テスト.log` |
| `tests/unit/vscode/src/export/html.test.ts` | 全実行 | 新規 | ✅ | `test_build_export_html_when_import_map`<br>`テスト結果/20261112225936_4bee4d9d_単体テスト.log` |
| `tests/`（`npm run test:unit` の全件） | 全実行 | 実行のみ | ✅ | 284 ファイル・2062 テスト pass<br>同じ commit の 1 回目は lint と他の作業の vitest を同時に流していたため `test_main`・`test_prepare_embeds` が時間切れになり、単独で pass した後に全件を流し直した<br>lint: `テスト結果/20261112225009_4bee4d9d_lint.log` |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/pass-tooltips-and-syntax-url/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tooltips_and_relative_syntax` | 新規 | ✅ | VS Code 1.141.0 と stable の両方で pass。脚注の参照へフォーカスを移す `focusInPreview` を `vscode/tests/integration/helpers.ts` に追加<br>`テスト結果/20261113022917_01d4c320_VSCode拡張機能の結合テスト.log` |
| [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/pass-tooltips-and-syntax-url/vscode/tests/integration/export.test.ts) | `test_normal_when_tooltips_and_relative_syntax` | 新規 | ✅ | VS Code 1.141.0 と stable の両方で pass<br>`テスト結果/20261113022917_01d4c320_VSCode拡張機能の結合テスト.log` |
| `vscode/tests/integration/*.test.ts` | 全実行 | 実行のみ | ✅ | 1.141.0・stable ともに 82 件 pass・1 件 pending<br>pending は [#496](https://github.com/shuhei1101/mdmark/issues/496) の `test_normal_when_library_origin_added` を手元だけで `test.skip` にしたもの（commit していない）<br>lint: `テスト結果/20261113023319_01d4c320_lint.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/pass-tooltips-and-syntax-url/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` | 実行のみ | ❌ | 「別の配信元がモジュールの要求を受けない」。develop の既存の fail で、[#496](https://github.com/shuhei1101/mdmark/issues/496) で起票済み。この PR の対象外<br>`テスト結果/20261113022052_01d4c320_VSCode拡張機能の結合テスト_496のfailを含む.log` |
