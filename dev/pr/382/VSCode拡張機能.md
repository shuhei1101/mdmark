# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/VSCodeでプレビューを開く.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/VSCode%E3%81%A7%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.yaml) | プレビューを開いて mdmark で描く | 設定の `mermaid` を `mount` に指定する |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/HTMLに書き出す.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.yaml) | jsDelivr の配布物で描く HTML に書き出す | 相対パスの `mermaid.url` を埋める |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | プレビューの CSP と `mount` に指定する設定 | `mermaid.url` の origin を `script-src` に追加する |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/HTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | 書き出す HTML の設定と、相対パスの値の埋め方 | `mermaid.url` を追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの HTML と CSP | 同上 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/設定.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%A8%AD%E5%AE%9A.ts.yaml) | 設定ファイルから `mount` に指定するキーの取り出し | `mermaid` を取り出すキーに追加する |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/書き出し.ts.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97.ts.yaml) | HTML への書き出し | 相対パスの `mermaid.url` を埋める |
| ドキュメント | [dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD.yaml) | 拡張機能が読み込む `mdmark.config.yaml` のキー | `mermaid` を追加する |
| 実装 | [vscode/src/config.ts](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/vscode/src/config.ts) | 設定ファイルのキーの取り出しと CSP の origin | `mermaid` を追加する |
| 実装 | [vscode/src/preview/html.ts](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/vscode/src/preview/html.ts) | パネルの HTML と CSP | origin の追加を受ける |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/vscode/src/preview/panel.ts) | 設定を `mount` に指定する | `mermaid.url` の相対パスを解決する |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/8c82fd6b555ad788de63f9b565aad24a87886500/vscode/src/export/embed.ts) | 相対パスの値を `data:` の URL で埋める | `mermaid.url` を追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設定の取り出し | `mdmark.config.yaml` の `mermaid` を、`html-scripts` と同じく `mount` に指定するキーに追加する | - |
| CSP | `mermaid.url`（無ければライブラリ本体の既定の URL）の `http:`・`https:` の origin を `script-src` に追加する | mermaid が SVG に入れるインラインの `style` は、今の `style-src 'unsafe-inline'` で受ける。足りるかを PoC で確認する |
| 相対パスの `mermaid.url` | プレビューは設定ファイルのフォルダから解決した Webview の URL、書き出しは `data:` の URL にする | `html-scripts.url` と同じ扱い |
| テーマ | プレビューの VS Code のライト・ダークの切り替えで、mermaid の図も描き直す | ライブラリ本体のテーマ・明暗の追従を使用する |

## PoC 結果

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| `buildCsp` と同じ規則（`cspSource` の代わりにページの origin）で組んだ CSP のページで、mermaid 12.3.0 の本体と chunk を jsDelivr から読み込んで描く（Chromium） | CSP 違反が 0 件、7 種類の図すべてが SVG | ✅ 0 件・7/7 | [#384](https://github.com/shuhei1101/mdmark/pull/384)（closed） | ライト・ダークとも。jsDelivr への要求は 55 件（本体と chunk） |

結論: Chromium で成立。

所感:

- mermaid が SVG に入れるインラインの `style` は、今の `style-src 'unsafe-inline'` で受けられた。jsDelivr の origin は配布物の origin と同じで、既定の `mermaid.url` なら CSP の `script-src` は今のままで足りる
- 本番の Webview（`vscode-webview://` の origin）での CSP 違反は、実装の工程の結合テスト（VS Code を起動するテスト）で数えて確定する

スクリーンショット: [CSP のページ（ライト）](https://github.com/shuhei1101/mdmark/blob/ff34427e99f18bfff63b68bb30998b369725f260/poc/mermaid/out/csp-light.png)・[CSP のページ（ダーク）](https://github.com/shuhei1101/mdmark/blob/ff34427e99f18bfff63b68bb30998b369725f260/poc/mermaid/out/csp-dark.png)

## テスト結果

なし（テスト作成・実装の工程で記入する）
