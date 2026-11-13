# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-22.ts.yaml) | 読み込むバージョン。`fetchLatestVersion` の処理の 1 が「`AbortSignal.timeout(timeoutMs)` を 1 つ作り、全てのページの要求に指定する」 | 原因に合わせて処理と単体テストを直す |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く。正常系（タグ一覧を取れない）の期待が「待ちの上限（3 秒）を少し過ぎたところで `@v0.6.0/dist/index.js` が要求される」 | 期待を変えないため変えない |
| ドキュメント | [docs/nonfunctional/NFR-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/nonfunctional/NFR-472-1.yaml) | 『タグ一覧を取る待ちの上限』3 秒 | 値を変えないため変えない |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/version.ts) | `fetchLatestVersion` が呼ぶたびに `AbortSignal.timeout(timeoutMs)` を作り、`fetch` に指定する。中断は `[warn] タグ一覧を取れない` に名前とメッセージを出して `undefined` を返す | 中断が 276 ms・2451 ms で発火した |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts)・[vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | プレビューの `load` と書き出しが `fetchLatestVersion` を `globalThis.fetch` と `TAGS_TIMEOUT_MS` で呼ぶ | - |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` が、`/tags` を受けた時刻・閉じられた時刻と拡張機能のログの理由をメッセージに出す | 繰り返しの実行で確かめる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因の特定 | 拡張機能のホストで、`AbortSignal.timeout` を作った時刻・`fetch` を呼んだ時刻・中断した時刻を測り、上限より早く中断する条件を再現して切り分ける | 結果を `テスト結果/` に置く |
| `fetchLatestVersion` の中断の合図 | 特定した原因に合わせ、要求を始めてから待ちの上限が経つまでは中断しない作り方へ直す。合計の待ちにする目的は保つ | `未確定`（決める段: モジュール構成設計） |
| 単体テスト | `tests/unit/vscode/src/version.test.ts` に、上限より前に中断しないことの確認を足す | - |
| 結合テスト | `test_normal_when_tags_unreachable` を VS Code 1.141.0 と stable で 10 回ずつ繰り返し、全 pass のログを置く | - |

`未確定` の中断の合図の作り方は、原因の特定の結果で決める。

| 案 | 内容 |
| --- | --- |
| A | `AbortController` と `setTimeout` で上限を測り、上限が経ったら `abort` する |
| B | `AbortSignal.timeout` のまま、原因になった呼び方（合図を作る時点など）だけを直す |

推奨: A

`setTimeout` は拡張機能のホストの他の待ちと同じ時計で動き、作った時点と中断する時点をログで確かめられるため。
