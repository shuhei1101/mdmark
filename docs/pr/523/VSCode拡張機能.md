# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-22.ts.yaml) | 読み込むバージョン。`fetchLatestVersion` の処理の 1 が「`AbortSignal.timeout(timeoutMs)` を 1 つ作り、全てのページの要求に指定する」 | 処理を変えないため変えない |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く。正常系（タグ一覧を取れない）の期待が「待ちの上限（3 秒）を少し過ぎたところで `@v0.6.0/dist/index.js` が要求される」 | 期待を変えないため変えない |
| ドキュメント | [docs/nonfunctional/NFR-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/nonfunctional/NFR-472-1.yaml) | 『タグ一覧を取る待ちの上限』3 秒 | 値を変えないため変えない |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/version.ts) | `fetchLatestVersion` が呼ぶたびに `AbortSignal.timeout(timeoutMs)` を作り、`fetch` に指定する。中断は `[warn] タグ一覧を取れない` に名前とメッセージを出して `undefined` を返す | 中断が 276 ms・2451 ms で発火した |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts)・[vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | プレビューの `load` と書き出しが `fetchLatestVersion` を `globalThis.fetch` と `TAGS_TIMEOUT_MS` で呼ぶ | - |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` が、`/tags` を受けた時刻・閉じられた時刻と拡張機能のログの理由をメッセージに出す | 繰り返しの実行で確かめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因の特定 | 手元の node（v24.14.0）で `AbortSignal.timeout(3000)` の中断と、`Date.now`・`performance.now` の進みの差を測った。`performance.now` で 3000 ms のとき `Date.now` は 2929 ms で、`Date.now` は 30 秒ごとに 55〜72 ms 戻る。カーネルのログにも `Time jumped backwards` が残る | `テスト結果/20261113142206_905ccdba_時計の補正の計測.log` |
| `vscode/src/version.ts` | 変えない | `AbortSignal.timeout` は単調な時計で測る |
| `stub-server.ts` の `/tags` の要求の時刻 | `receivedAt`・`closedAt` に加え、受けてから閉じられるまでを代役の配信の中で `performance.now` の差で測った値を返す | テストと別のプロセスのため、プロセスをまたいで `performance.now` を比べない |
| `preview-open.test.ts` の経過時間 | `test_normal_when_tags_unreachable`（タグ一覧の代役が応えないときと 403 のとき）と `test_normal_when_loading_shown` の経過時間を `performance.now` の差で測る | 期待の範囲は変えない |
| fail のときのメッセージ | `Date.now` と `performance.now` の両方の経過時間を出す | 実装の中断が単調な時計でも早いときは、実装の修正へ戻る |
| 結合テスト | `test_normal_when_tags_unreachable` を VS Code 1.141.0 と stable で 10 回ずつ繰り返し、全 pass のログを置く | - |

## テスト結果

### 単体

なし（`vscode/src/` を変えないため）

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/tags-timeout-early-abort/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` | 変更 | ✅ | VS Code 1.141.0 と stable（1.146.0）で 10 回ずつ繰り返して 20 回とも pass<br>`テスト結果/20261113160406_ccda144d_VSCode拡張機能のtest_normal_when_tags_unreachableの10回の繰り返し.log` |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/tags-timeout-early-abort/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_loading_shown` | 変更 | ✅ | 全実行の中で pass |
| [vscode/tests/integration/stub-server.ts](https://github.com/shuhei1101/mdmark/blob/fix/vscode/tags-timeout-early-abort/vscode/tests/integration/stub-server.ts) | - | 変更 | ✅ | テストの代役の配信。全実行の中で使う |
| `vscode/tests/integration/` | 全実行 | 実行のみ | ✅ | 1.141.0・stable とも 82 pass・1 pending<br>`テスト結果/20261113212510_ccda144d_結合テスト.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` | 実行のみ | ❌ | 別の配信元がモジュールの要求を受けない。[#496](https://github.com/shuhei1101/mdmark/issues/496) で毎回 fail すると起票済みの既存の不具合で、この PR の変更と関係しない。1 回目の全実行で fail したため、2 回目はこのテストだけを作業ツリーで `test.skip` にして流した（commit していない）<br>`テスト結果/20261113211959_ccda144d_結合テスト.log` |
