# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | `mdmark.*` と拡張機能が読む `mdmark.config.yaml` のキー | `mdmark.configPath` はワークスペースのフォルダから解決するだけ |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) / [プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) / [プレビューをリロードする.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E3%83%AA%E3%83%AD%E3%83%BC%E3%83%89%E3%81%99%E3%82%8B.ts.yaml) | プレビューの開く・描き直す・リロード | 設定ファイルは 1 つで、`theme`・`extensions` を読まない |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/設定ファイルを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | `mdmark.openConfig` | 開くのは `mdmark.configPath` の 1 つ |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `mdmark.exportHtml` | 書き出す HTML に `theme`・`extensions` が当たらない |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) / [プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) / [Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) / [書き出し.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97.ts.yaml) / [拡張機能の入口.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD%E3%81%AE%E5%85%A5%E5%8F%A3.ts.yaml) / [ビルドと配布.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%93%E3%83%AB%E3%83%89%E3%81%A8%E9%85%8D%E5%B8%83.ts.yaml) | 設定の取り出し・パネル・Webview・書き出し・見張り・ビルド | 設定を読む処理を拡張機能が自分で持つ |
| ドキュメント | [dev/設計書/画面設計/VSCodeのプレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) / [VSCodeのコマンドと通知.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E7%94%BB%E9%9D%A2%E8%A8%AD%E8%A8%88/VSCode%E3%81%AE%E3%82%B3%E3%83%9E%E3%83%B3%E3%83%89%E3%81%A8%E9%80%9A%E7%9F%A5.ts.yaml) | プレビューのパネルと、コマンド・通知・雛形の中身 | 雛形のコメントが拡張機能の読むキーを 4 つとしている |
| ドキュメント | [dev/設計書/部品設計/設定ファイルを読めない帯.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E9%83%A8%E5%93%81%E8%A8%AD%E8%A8%88/%E8%A8%AD%E5%AE%9A%E3%83%95%E3%82%A1%E3%82%A4%E3%83%AB%E3%82%92%E8%AA%AD%E3%82%81%E3%81%AA%E3%81%84%E5%B8%AF.ts.yaml) | 設定ファイルを読めない帯と「設定ファイルを開く」 | 読めないファイルが 1 つの前提 |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config.ts) | `resolveConfigPath`・`parseConfig`・`loadConfig` | `parseConfig` が `features`・`libraries`・`html-scripts`・`side-toc`・`colorTheme`・`assets.root` だけを取り出す |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) / [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/html.ts) / [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/manager.ts) | パネル・CSP（`buildCsp`）・`localResourceRoots` | `localResourceRoots` に足すのは `assets.root` だけ |
| 実装 | [vscode/src/extension.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extension.ts) | 設定ファイルの見張り | ワークスペースのフォルダごとに `mdmark.configPath` の 1 つを見張る |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | HTML に書き出す・ブラウザで開く・PDF に印刷 | `readExportConfig` が設定を読み直す |
| 実装 | [vscode/src/config-file.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/config-file.ts) | `mdmark.openConfig` | - |
| 実装 | [vscode/src/webview/features/preview/panel/boot.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/features/preview/panel/boot.ts) | Webview で `mount` を呼ぶ | 拡張を登録しない |
| テスト | [tests/unit/vscode/src/config.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/config.test.ts) / [tests/unit/vscode/src/preview/html.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/src/preview/html.test.ts) | 設定の取り出しと CSP の単体テスト | - |
| テスト | `tests/e2e/単一ユースケース/` の [VSCodeでプレビューを開く](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.spec.ts)・[書いた内容をプレビューに映す](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.spec.ts)・[テーマを上書きする](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%86%E3%83%BC%E3%83%9E%E3%82%92%E4%B8%8A%E6%9B%B8%E3%81%8D%E3%81%99%E3%82%8B.spec.ts)・[固有の部品とCSSを当てる](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E5%9B%BA%E6%9C%89%E3%81%AE%E9%83%A8%E5%93%81%E3%81%A8CSS%E3%82%92%E5%BD%93%E3%81%A6%E3%82%8B.spec.ts)・[HTMLに書き出す](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.spec.ts) | シナリオの E2E | プレビューの `theme`・`extensions` を確かめる手順が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設定の読み取り | ライブラリ本体の設定を読む共通の処理を esbuild で拡張機能に束ねて呼び、`parseConfig` の取り出しをやめる | `mount` に渡すキーは共通の処理の結果から取る（#259 の `labels` も渡る見込み） |
| `mdmark.configPath` | 既定を空にし、空のときは Markdown のフォルダから上へ探して重ねる。値を書いたときは、そのファイルと端末の設定だけを重ねる | 既定の変更は設定の設計書と `package.json` の `contributes` に反映する |
| `theme` | プレビューの HTML に `theme` の CSS を Webview の URI で読む `link` を足し、`localResourceRoots` にそのフォルダを足す | CSP の `style-src` は `cspSource` を持つため変えない |
| `extensions` | Webview が `mount` の前に `extensions` のモジュールを読み込んで登録し、`localResourceRoots` にそのフォルダを足す | CLI の書き出しと同じ順で登録する。CSP の `script-src` は `cspSource` を持つため変えない |
| 書き換えの反映 | 重ねた設定ファイル（端末の設定を含む）・`theme` の CSS・`extensions` のファイルを見張り、書き換えたら描き直す | `theme` の CSS だけが変わったときは、HTML を入れ直さず CSS を読み直す |
| 書き出し | HTML に書き出す・ブラウザで開く・PDF に印刷も重ねた設定を使い、`theme` と `extensions` を当てる | 書き出す HTML への `theme`・`extensions` の入れ方はインターフェース定義設計で決める |
| エラー表示 | 重ねた設定ファイルのどれかを読めないとき、帯に読めないファイルを出し、「設定ファイルを開く」はそのファイルを開く | 帯の文言と配置はモック作成で決める |
| `mdmark.openConfig` | 最も近い `mdmark.config.yaml` を開く。無ければ今と同じく `mdmark.configPath`（既定はワークスペースのフォルダ）に雛形を作るかを尋ねる | 雛形のコメントの「読むキー」の説明を直す |
| セキュリティ | `localResourceRoots` に足すのは、重ねた設定の `theme`・`extensions` のファイルのフォルダだけにする | 設定ファイルを読めないときは、前に足したフォルダを外す |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `197e33ad..1bae4810` | 3 つの対象システムにまたがる複合ユースケース |
| 複合ユースケース設計 | `a2dbc02d..ded2d0a3` | レビューの指摘の修正 |
| 単一ユースケース設計 | `c2bac536..1f7584fc` | - |

## テスト結果

テスト作成・実装で記入する。
