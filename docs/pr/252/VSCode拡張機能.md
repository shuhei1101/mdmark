# VS Code 拡張機能

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/プレビューを描き直す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E6%8F%8F%E3%81%8D%E7%9B%B4%E3%81%99.ts.yaml) | 書き換えと背面からの復帰で描き直す | 制約「背面のパネル」の保存する値を、切り捨てない元の行番号の位置にする。正常系（背面から戻る）・正常系（差分のパネルが背面から戻る）のセットアップで、見えている先頭を見出しの途中に置く |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/スクロールを合わせる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%82%B9%E3%82%AF%E3%83%AD%E3%83%BC%E3%83%AB%E3%82%92%E5%90%88%E3%82%8F%E3%81%9B%E3%82%8B.ts.yaml) | エディタとプレビューのスクロールを合わせる | 変更なし（`revealLine` は整数に切り捨てた行のまま） |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/Webview.ts.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/Webview.ts.yaml) | パネルの中のスクリプト・スクロールの位置 | `PreviewState`・`PreviewView` の保存する位置と、切り捨てない行の位置を返す関数 |
| 実装 | [vscode/src/webview/scroll.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/src/webview/scroll.ts) | 元の行番号とスクロールの位置の内分 | 切り捨てない行の位置を返す処理を追加。`lineForTop` は切り捨てたまま |
| 実装 | [vscode/src/webview/preview.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/src/webview/preview.ts) | Webview の中で `mount`・`update` を呼び、スクロールを扱う | `setState` へ切り捨てない位置を保存し、その位置へ戻す |
| テスト | [tests/unit/vscode/src/webview/scroll.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/unit/vscode/src/webview/scroll.browser.test.ts) | 内分の単体テスト | 切り捨てない行の位置のケースを追加 |
| テスト | [tests/unit/vscode/src/webview/preview.browser.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/unit/vscode/src/webview/preview.browser.test.ts) | `PreviewView` と起動の単体テスト | 保存する値と、行の途中の位置へ戻すケース |
| テスト | [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_revealed`・`test_normal_when_diff_revealed` | 見えている先頭を見出しの途中に置いて確かめる |
| テスト | [tests/e2e/単一ユースケース/プレビューから設定を開く.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.9.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%81%8B%E3%82%89%E8%A8%AD%E5%AE%9A%E3%82%92%E9%96%8B%E3%81%8F.spec.ts) | `test_normal`（fail した E2E） | 変更なし。この修正で pass させる |

<!-- /table -->

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 保存する位置 | 見えている先頭（帯があるときは帯の下端）を、前後の `data-source-line` の要素の間で内分した元の行番号を、整数に切り捨てずに `setState({ line })` へ保存する | 元の行番号で持つことは変えない（背面の間の書き換えで高さが変わっても同じ箇所へ戻す） |
| 位置の戻し方 | 保存した小数の行を、今の `scrollToLine` と同じく `topForLine` の内分で位置にして先頭に置く | `topForLine` は小数の行もそのまま内分できる |
| エディタとの連動 | `revealLine` で送る行は今のとおり `lineForTop` の切り捨てた整数。戻したスクロールで `revealLine` を送らないことも変えない | - |
| 差分のパネル | 通常のパネルと同じ処理で戻す | - |
| 既存機能への影響 | 以前に保存した整数の行も、そのまま同じ位置へ戻せる | - |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/vscode/src/webview/scroll.browser.test.ts` | `test_fractional_line_for_top`・`test_fractional_line_for_top_when_round_trip` | 新規 | ✅ | [20261031185249_c5217f4_単体テスト.log](./テスト結果/20261031185249_c5217f4_単体テスト.log) |
| `tests/unit/vscode/src/webview/preview.browser.test.ts` | `test_current_position` | 新規 | ✅ | 同上 |
| `tests/unit/vscode/src/webview/preview.browser.test.ts` | `test_start_preview_when_state_saved`・`test_start_preview_when_scrolled` | 変更 | ✅ | 同上 |
| 単体テスト全件（`npm run test:unit`） | 全実行 | 実行のみ | ✅ | 1186 テスト pass。lint: [20261031185249_c5217f4_lint.log](./テスト結果/20261031185249_c5217f4_lint.log) |

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/preview-rerender.test.ts` | `test_normal_when_revealed`・`test_normal_when_diff_revealed` | 変更 | ✅ | [20261031192241_11ddbf4_結合テスト.log](./テスト結果/20261031192241_11ddbf4_結合テスト.log) |
| VS Code 拡張機能の結合テスト全件（`xvfb-run -a npm --prefix vscode run test:integration`） | 全実行 | 実行のみ | ✅ | VS Code 1.141.0・stable で各 63 テスト pass。lint: [20261031192241_11ddbf4_lint.log](./テスト結果/20261031192241_11ddbf4_lint.log) |
