# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [設計書/インターフェース定義/VSCode拡張機能/プレビューを開く.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%97%E3%83%AC%E3%83%93%E3%83%A5%E3%83%BC%E3%82%92%E9%96%8B%E3%81%8F.ts.yaml) | フロー `正常系（タグ一覧が返らない）` の期待値「待ちの上限（3 秒）を少し過ぎたところで要求される」 | 変えない |
| ドキュメント | [設計書/モジュール構成/VSCode拡張機能/読むバージョン.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E8%AA%AD%E3%82%80%E3%83%90%E3%83%BC%E3%82%B8%E3%83%A7%E3%83%B3.ts.yaml) | `TAGS_TIMEOUT_MS`・`fetchLatestVersion`・`decideVersion` | 実装が誤っていた場合に更新する |
| 実装 | [vscode/src/version.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/version.ts) | タグ一覧を合計 3 秒の `AbortSignal.timeout` で辿り、取れなければ前回のバージョンを使う | 切り分けの対象 |
| 実装 | [vscode/src/preview/panel.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/preview/panel.ts) | 読み込みのたびに `decideVersion` を呼び、`globalThis.fetch` を渡す | 切り分けの対象 |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_tags_unreachable` が経過 2800 ms 以上 6000 ms 未満を期待する | develop で 1734 ms になり fail |
| テスト | [vscode/tests/integration/stub-server.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/stub-server.ts) | `tags: "hang"` のとき `/tags` に応答を返さない代役の配信 | 切り分けの対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因の切り分け | 拡張機能のログ（`タグ一覧を取れない` の警告の `reason.name`・`reason.message`）と代役の配信が受けた要求から、タグ一覧の要求が 3 秒より前に終わった理由を特定する | 実装が上限より前に諦めているなら実装、代役の配信や経過の測り方が応答しない状態を作れていないならテストを誤りとする |
| 修正 | 誤っている側だけを修正し、待ちの上限 3 秒と期待の範囲（2800 ms 以上 6000 ms 未満）は変えない | 実装を修正した場合は、モジュール構成『読むバージョン』と単体テスト `tests/unit/vscode/src/version.test.ts` を追従させる |

## テスト結果

（implementer が記入）
