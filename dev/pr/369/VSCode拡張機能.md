# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/HTMLに書き出す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.yaml) | 開いている Markdown を HTML に書き出して開く | 相対パスの `libraries`・`html-scripts.url` を使う文書のシナリオが無い |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `mdmark.exportHtml` | 制約「設定と相対パス」が相対パスを `file:` の URL にし、その備考が知らせの枠になることを記載している |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/書き出し.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97.ts.yaml) | 書き出し・ブラウザで開く・PDF に印刷 | `buildExportHtml` の設定は `libraries` を `file:` の URL にした値 |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | `readExportConfig`・`exportMarkdown` | `toUrl` が `pathToFileURL(target).href` |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/html.ts) | `buildExportHtml` | `extensions` だけを `data:` の URL にする |
| 実装 | [vscode/src/extensions-bundle.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extensions-bundle.ts) | `bundleExtensions`（esbuild-wasm で ES モジュールにまとめる） | 相対パスの `libraries`・`html-scripts.url` のまとめにも使える |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `resolveLibraries`・`resolveHtmlScripts` | 相対パスを `toUrl` で URL にする |
| テスト | [tests/unit/vscode/src/export/html.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/export/html.test.ts) / [tests/unit/vscode/src/extensions-bundle.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/extensions-bundle.test.ts) | HTML の組み立てとまとめの単体テスト | - |
| テスト | [tests/e2e/単一ユースケース/HTMLに書き出す.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.spec.ts) / [tests/e2e/単一ユースケース/PDFに印刷する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/PDF%E3%81%AB%E5%8D%B0%E5%88%B7%E3%81%99%E3%82%8B.spec.ts) | シナリオの E2E | 相対パスの `libraries` を Chromium で開く手順が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 相対パスの `libraries` | 文書にマーカーがある名前のモジュールだけを、`bundleExtensions` と同じ esbuild-wasm のまとめ方で ES モジュールにし、`data:text/javascript` の URL にして `config.libraries` の値に配置する | マーカーの検出は CLI と同じ `usedLibraryMarks` を、esbuild を import しない `src/render/used.ts` へ移して使用する |
| 相対パスの `html-scripts.url` | 文書に `ts`・`js` の範囲があり `html-scripts` がオンのときだけ、変換のライブラリを同じまとめ方で `data:` の URL にして `config["html-scripts"].url` に配置する | 範囲の有無は CLI の `compileHtmlScripts` と同じく `renderDocument` の出力から取得する `collectRangeScripts`（`src/render/used.ts`）で判定する。範囲を変換して埋めず、`mount` の公開の引数を変えない |
| `http:`・`https:` の URL | 今のまま `config` に配置する | - |
| まとめられないモジュール | 埋めず、出力チャネルに警告を記録して書き出しを続ける | 開いたときは mdmark が知らせの枠を出す |
| 書き出しの共通の処理 | 「HTML に書き出す」「ブラウザで開く」「PDF に印刷する」が使う `readExportConfig` で埋めるため、3 つとも同じ HTML になる | - |
| テスト | 単体: 相対パスの値が `data:` の URL になり、`http:`・`https:` の値と、マーカーの無いライブラリが変わらないこと。E2E: 相対パスの `libraries` と `html-scripts.url` を持つワークスペースから書き出した HTML を Chromium で開き、知らせの枠が出ないこと | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `e86a6cb0..78e6d91c` | - |
| 単一ユースケース設計 | `78e6d91c..9347272c` | レビューの指摘の修正 |
| インターフェース定義設計 | `49cbee03..14c4e182` | - |
| インターフェース定義設計 | `602f08f4..a943b841` | レビューの指摘の修正（@babel/standalone を data: の URL で埋める経路の測定を外部ライブラリ『babel-standalone』に記録） |
| モジュール構成設計 | `726f6043..95ac7fd8` | - |
| モジュール構成設計 | `49771a42..47d1f7e0` | レビューの指摘の修正（判定を `src/render/used.ts` に共通化） |
| インターフェース定義設計 | `133e18c0..200efb21` | 結合テスト作成で見つけた、知らせの枠のクラスの誤り（`.mdmark-embed` → `.mdmark-notice`）の修正 |
| モジュール構成設計 | `b0848819..abd308f4` | 結合テスト作成で見つけた、ビルドの単体テストの期待値の追加（`self` の宣言と `dist/esbuild.wasm`） |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/render/used.test.ts` | 全実行 | 新規 | ✅ | 3 テスト pass（`test_used_library_marks` は `tests/unit/src/cli/embed.test.ts` から移動）<br>`テスト結果/20261108000914_f3ea32eb_単体テスト.log` |
| `tests/unit/vscode/src/export/embed.test.ts` | 全実行 | 新規 | ✅ | 2 テスト pass<br>`テスト結果/20261108000914_f3ea32eb_単体テスト.log` |
| [tests/unit/vscode/src/export/html.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/export/html.test.ts) | 全実行 | 変更 | ✅ | `test_module_data_url` を追加<br>`テスト結果/20261108000914_f3ea32eb_単体テスト.log` |
| [tests/unit/src/cli/embed.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/cli/embed.test.ts) | 全実行 | 変更 | ✅ | `test_used_library_marks` を `used.test.ts` へ移動<br>`テスト結果/20261108000914_f3ea32eb_単体テスト.log` |
| 単体テスト全体 | 全実行 | 実行のみ | ✅ | 250 ファイル・1722 テスト pass。Red は `テスト結果/20261107234541_c39d877c_単体テスト.log`<br>lint: `テスト結果/20261108000914_f3ea32eb_lint.log` |
| [tests/unit/vscode/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/scripts/build.test.ts) | `test_build_extension` | 変更 | ✅ | `self` の宣言と `dist/esbuild.wasm` の複写を確かめる検証を追加<br>`テスト結果/20261108012829_34e7d120_単体テスト.log` |
| 単体テスト全体（結合テスト作成の後） | 全実行 | 実行のみ | ✅ | 全件の実行で 7 件が 15〜30 秒のタイムアウトで落ち（load average 約 18）、その 7 ファイルを流し直して pass<br>`テスト結果/20261108012829_34e7d120_単体テスト.log`<br>lint: `テスト結果/20261108012829_34e7d120_lint.log`（biome の警告 2 件は develop でも同じ） |

`test_collect_range_scripts` の期待値を、範囲のコードの末尾の改行を含んだ値に直した（[f3ea32eb](https://github.com/shuhei1101/mdmark/commit/f3ea32eb)）。`mount` と CLI は範囲のコードの文字のまま照合するため、末尾の改行を落とさないのが設計書の「エスケープを戻したコード」と一致する。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | `test_normal_when_relative_libraries` | 新規 | ✅ | VS Code 1.141.0 と stable で pass<br>`テスト結果/20261108012829_3a58704c_結合テスト.log` |
| VS Code 拡張機能の結合テスト全体 | 全実行 | 実行のみ | ✅ | 70 テスト pass（VS Code 1.141.0・stable）<br>`テスト結果/20261108012829_3a58704c_結合テスト.log` |

結合テストで、拡張機能のビルドが `esbuild.wasm` を `dist/` に複写しておらず、esbuild-wasm の `self` も当てていないため `bundleExtensions` が拡張機能ホストで動かないことが分かった。モジュール構成『VS Code 拡張機能 / ビルドと配布』の `buildExtension` の記述どおりに実装し（[3a58704c](https://github.com/shuhei1101/mdmark/commit/3a58704c)）、単体テストの期待値に足した（[abd308f4](https://github.com/shuhei1101/mdmark/commit/abd308f4)・[34e7d120](https://github.com/shuhei1101/mdmark/commit/34e7d120)）。esbuild は束ねるときに `self` の名前に数字を付ける（`var self2 = globalThis;`）。

### 拡張機能の配布物のサイズ

`collectRangeScripts` が `renderDocument` を取り込むため、`vscode/dist/extension.cjs` は develop の 837,044 バイトから 2,547,009 バイトになった（主に lucide・`src/render`・`src/parts`・postcss・markdown-it）。非機能要件に拡張機能の配布物のサイズの上限は無い。
