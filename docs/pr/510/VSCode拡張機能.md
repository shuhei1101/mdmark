# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-21.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-21.ts.yaml) | インターフェース定義『プレビューを再描画する』。正常系の期待値に送信の時刻を持つ | 変更しない |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) | `scheduleRender` が最後の変更から `updateDelayMs` 待って `render` を送信する | 変更しない |
| テスト | [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-rerender.test.ts) | `test_normal` が `editor.edit` の完了の後に取った時刻と送信の時刻を比べる | 修正する |
| テスト | [vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/helpers.ts) | `installRecorder` が送信したメッセージと時刻を記録する。`replaceFirstLine` が先頭の行を書き換える | 必要なら修正する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 最後の書き換えの時刻 | `workspace.onDidChangeTextDocument` で対象の文書が変わった時刻を記録し、最後の記録を `lastEdit` にする | `editor.edit` の完了の時刻は使わない |
| 時刻の比較 | `sentAt - lastEdit` を、インターフェース定義の期待値（300 ms より後）に合わせ、タイマーの誤差の分だけ緩めた下限で比べる | 下限の値は結合テスト作成で決める |
| 実装 | 変えない | 送信した中身が 3 回目の全文のため、送信の待ちは期待どおり |

## テスト結果

### 単体

なし

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/test/vscode/preview-rerender-flaky-timing/vscode/tests/integration/preview-rerender.test.ts) | `test_normal` | 変更 | ✅ | `test_normal` だけを 10 回実行し、1.141.0 と stable（1.146.0）で 20 回 pass<br>`テスト結果/20261114000113_00fc9ff4_結合テスト_test_normalの繰り返し.log` |
| `vscode/tests/integration/*.test.ts` | 全実行 | 実行のみ | ✅ | 1.141.0 と stable（1.146.0）でそれぞれ 82 件 pass・1 件 pending（[#496](https://github.com/shuhei1101/mdmark/issues/496) の `test_normal_when_library_origin_added` を `test.skip` にした）<br>`テスト結果/20261114002014_00fc9ff4_結合テスト_496をskip.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/test/vscode/preview-rerender-flaky-timing/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` | 実行のみ | ❌ | 1.141.0 で「別の配信元がモジュールの要求を受けない」。#496 の事象で、この PR のスコープ外。1.141.0 で fail したため stable は実行されていない<br>`テスト結果/20261113233119_00fc9ff4_結合テスト.log` |
