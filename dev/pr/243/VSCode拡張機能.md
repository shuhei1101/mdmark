# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/書いた内容をプレビューに映す.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.yaml) | 書き換え・背面からの復帰・リロードで描き直す | `正常シナリオ（背面から戻る）` にスクロールの位置の期待値を追加 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/プレビューから設定を開く.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%8B%E3%82%89%E8%A8%AD%E5%AE%9A%E3%82%92%E9%96%8B%E3%81%8F.yaml) | 歯車から設定画面を開く | 変更なし（期待値は既にスクロールの位置を保つ） |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 書き換えと背面からの復帰で描き直す | `正常系（背面から戻る）` の期待値・差分のパネルが背面から戻る流れと、制約「背面のパネル」に位置の戻し方を追加 |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | パネルの開き方（`retainContextWhenHidden: false`） | 制約「パネル」の補足（背面からの復帰）を位置の戻し方に合わせる |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/スクロールを合わせる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.ts.yaml) | エディタとプレビューのスクロールを合わせる | 制約「往復の止め方」に、位置を戻すスクロールで `revealLine` を送らないことを追加 |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/プレビュー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC.ts.yaml) | パネルの管理・描き直し | 変更なし（`retainContextWhenHidden: false` のまま） |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト・スクロールの位置 | 位置の保存と、作り直した後の最初の描画での戻し |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/src/webview/preview.ts) | Webview の中で `mount`・`update` を呼び、スクロールを扱う | 位置を保存し、作り直した後の最初の描画で戻す |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/src/preview/panel.ts) | 1 つの Markdown のパネル。`ready` を受けて全文を送る | 変更なし |
| 実装 | [vscode/src/preview/manager.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/src/preview/manager.ts) | パネルを `retainContextWhenHidden: false` で開く | 変更なし |
| テスト | [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_revealed` | スクロールの位置の確かめを追加 |
| テスト | [tests/e2e/単一ユースケース/書いた内容をプレビューに映す.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E6%9B%B8%E3%81%84%E3%81%9F%E5%86%85%E5%AE%B9%E3%82%92%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%AB%E6%98%A0%E3%81%99.spec.ts) | `test_normal_when_revealed` | スクロールの位置の確かめを追加 |
| テスト | [tests/e2e/単一ユースケース/プレビューから設定を開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%8B%E3%82%89%E8%A8%AD%E5%AE%9A%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | `test_normal`（fail した E2E） | 変更なし。この修正で pass させる |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 位置の持ち方 | Webview が見えている先頭の元の行番号を、スクロールの知らせと `render` を描いた後に Webview の状態（`setState`）へ保存する。`retainContextWhenHidden` は `false` のまま | - |
| 位置の戻し方 | 作り直した Webview が最初の `render` を描き終えたら、保存した行を先頭に置く。2 回目以降の `render` は今の描き直しの位置の控え方のまま | 文書が短くなって行が無いときは、文書の末尾までに収める |
| エディタとの連動 | 位置を戻したスクロールでは `revealLine` を送らず、エディタを動かさない | `scrollToLine` と同じく自分が起こしたスクロールとして捨てる |
| 差分のパネル | 通常のパネルと同じ処理で戻す | - |
| 既存機能への影響 | 開いた直後（保存した位置が無い）は今のとおり先頭から描く。リロード（`mdmark.refreshPreview`）などで HTML を入れ直したときも、保存した行へ戻す | - |

<!-- /table -->

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/vscode/src/webview/preview.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/unit/vscode/src/webview/preview.browser.test.ts) | 全実行 | 変更 | ✅ | 19 テスト pass（追加した 4 テストを含む）<br>`テスト結果/20261031151111_da197d4_単体テスト.log` |
| `tests/unit/` | 全実行 | 実行のみ | ✅ | 161 ファイル・1183 テスト pass<br>`テスト結果/20261031151111_da197d4_単体テスト.log` |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_revealed` | 変更 | ✅ | VS Code 1.141.0 と stable で pass<br>`テスト結果/20261031151319_da197d4_結合テスト.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_diff_revealed` | 新規 | ✅ | VS Code 1.141.0 と stable で pass<br>`テスト結果/20261031151319_da197d4_結合テスト.log` |
| `vscode/tests/integration/` | 全実行 | 実行のみ | ✅ | VS Code 1.141.0 と stable でそれぞれ 63 テスト pass<br>`テスト結果/20261031151319_da197d4_結合テスト.log` |
| `tests/integration/` | 全実行 | 実行のみ | ✅ | 66 ファイル・565 テスト pass<br>`テスト結果/20261031151319_da197d4_結合テスト.log` |
