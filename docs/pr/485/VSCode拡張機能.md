# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く。`test_normal_when_tags_unreachable`（期待値「待ちの上限（3 秒）を少し過ぎたところで要求される」）・`test_normal_when_color_scheme` | テスト名と期待値を変えないため変えない |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_color_scheme` が `preview.theme` を `dark` にした後の描画を待たずに、直前の描画の `config` を見る | 新しい描画を待つ |
| テスト | 同上 | `test_normal_when_tags_unreachable` が経過時間を `elapsed >= 2800 && elapsed < 6000` で見ていて、負荷が高いと外れる | 上限の判定を見直す |
| テスト | 同上・[vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/helpers.ts) | `test_normal`（2 件、各約 28 秒）・`test_normal_when_loading_shown`（約 12 秒） | 軽量化の候補 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 所要時間の計測 | mocha の ms の出力から、VS Code 1.141.0・stable のテストごとの所要時間を取り、長い順の一覧にして `テスト結果/` に置く。修正の前と後に測る | - |
| `test_normal_when_color_scheme` | `preview.theme` を `dark` にした後、`config` が `colorScheme` を持たない描画が届くまで `waitFor` で待ってから検証する | 作業ブランチで 10 回続けて流して全 pass を確かめる |
| `test_normal_when_tags_unreachable` | 下限（2800 ms 以上）は待ちの上限の確認として残す。上限は、拡張機能が `/tags` の要求を待ちの上限で打ち切ったこと（代役の配信が記録した、接続を閉じられた時刻）で確かめ、経過時間の固定の上限で落とさない | 期待値「待ちの上限（3 秒）を少し過ぎたところで要求される」は変えない |
| 長いテストの削除・軽量化 | 計測の一覧の上位のうち、ほかのテストと確認する内容が重なるものを削除し、準備・待ちが長いものを確認する内容を変えずに軽くする | `未確定`（決める段: インターフェース定義設計） |
| 対象外 | `preview-rerender.test.ts` の `test_normal` の時間の比較（#474）は扱わない | - |

## テスト結果

（テスト作成・実装で記入する）
