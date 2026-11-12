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
| 長いテストの削除・軽量化 | 削除・軽量化しない。修正前の計測で VS Code 1.141.0 の 81 件が約 3 分、最も長い `release.test.ts` の `test_normal`（64 秒）は拡張機能の配布物を作る唯一の確認で、その次は 10 秒以下 | `テスト結果/20261113000632_f844e4e0_VSCode拡張機能の結合テストの所要時間_修正前.log` |
| 対象外 | `preview-rerender.test.ts` の `test_normal` の時間の比較（#474）と、`test_normal_when_library_origin_added` が毎回落ちる事象（#496）は扱わない。#496 の fail で 1.141.0 の実行が止まるため、stable の修正前の計測は結合テスト作成で #496 のテストを除いて行う | - |

## テスト結果

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/test/integration/shorten-duration-and-fix-flaky/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_color_scheme` | 変更 | ✅ | `preview.theme` を `dark` にした後、`colorScheme` を除いた `config` の描画が届くまで待ち、包む要素の class も待ってから確かめる。2 件だけを 10 回繰り返して全 pass<br>`テスト結果/20261113013500_dae2fee0_VSCode拡張機能の修正した2件の10回の繰り返し.log` |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/test/integration/shorten-duration-and-fix-flaky/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` | 変更 | ✅ | 経過時間の上限（6000 ms）を外し、`/tags` の要求を受けてから打ち切られるまでが 6000 ms 未満であることと、拡張機能のログの打ち切りの理由が `TimeoutError` であることで確かめる。下限（2800 ms）は残す。10 回の繰り返しの 1 回と、develop を取り込んだ後の 1 回前の実行（stable）は下限で fail し、拡張機能の中断が 276 ms・2451 ms で発火していたため #504 に切り出した<br>`テスト結果/20261113013500_dae2fee0_VSCode拡張機能の修正した2件の10回の繰り返し.log`・`テスト結果/20261113023949_328b9b9e_VSCode拡張機能の結合テスト_504のfailを含む.log` |
| 上記以外の `vscode/tests/integration/` | 全実行 | 実行のみ | ✅ | develop を取り込んだ後（328b9b9e）、VS Code 1.141.0 と stable の両方で 80 件が pass。#496 の `test_normal_when_library_origin_added` は作業ツリーだけで `test.skip` にした（commit していない）<br>`テスト結果/20261113025844_328b9b9e_VSCode拡張機能の結合テスト.log` |

VS Code 拡張機能の結合テストの所要時間は、1.141.0 で修正前・修正後とも約 3 分で変わらない。
