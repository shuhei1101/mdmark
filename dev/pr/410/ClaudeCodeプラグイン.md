# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/テスト/テスト実行方法.yaml](https://github.com/shuhei1101/mdmark/blob/68802cad/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%86%E3%82%B9%E3%83%88/%E3%83%86%E3%82%B9%E3%83%88%E5%AE%9F%E8%A1%8C%E6%96%B9%E6%B3%95.yaml) | E2E テストの前提に、2 ケースが dev-docs を起動することと dev-docs のクローンの場所の決め方がある。呼び出しの時間切れは記載が無い | 前提の行に時間切れの値を追加する |
| テスト | [tests/e2e/dev-docs.ts](https://github.com/shuhei1101/mdmark/blob/68802cad/tests/e2e/dev-docs.ts) | `withDevDocs` は待ち受けの開始だけを待ち、`searchDocs` は `client.callTool` に時間切れを指定しない | 時間切れを指定する |
| テスト | [tests/e2e/単一ユースケース/使い方集を読む.spec.ts](https://github.com/shuhei1101/mdmark/blob/68802cad/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.spec.ts) | `test_normal` が `searchDocs` を 2 回呼ぶ | 変更しない |
| テスト | [tests/e2e/複合ユースケース/ClaudeCodeで使い方集を参照して書き点検する.spec.ts](https://github.com/shuhei1101/mdmark/blob/68802cad/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%A7%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E5%8F%82%E7%85%A7%E3%81%97%E3%81%A6%E6%9B%B8%E3%81%8D%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.spec.ts) | `test_normal` が `searchDocs` を 2 回呼ぶ | 変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 所要時間の実測 | 起動した dev-docs へ、2 ケースと同じ引数の `search_docs` を繰り返し呼び、1 回ごとの所要時間を測る。起動の直後の 1 回目と 2 回目以降を分けて記録する | 実測のログを `テスト結果/` に配置する |
| 呼び出しの時間切れ | `searchDocs` の `client.callTool` の第 3 引数の `timeout` に、実測の p99.9 + その 50% の値を定数で指定する | 定数のコメントに導出の元の値と導き方を記載する |
| ケースの待ち | 2 回の呼び出しの時間切れの合計と dev-docs の起動・mdmark の MCP の呼び出しが、`playwright.config.ts` の `timeout`（300 秒）に収まるかを確認する | 収まらなければ、該当の spec に `test.setTimeout` で入れ子の待ちの値を指定する |
| 設計書 | 『テスト実行方法』の E2E テストの dev-docs の前提の行に、呼び出しの時間切れの値と導出の元の値を追加する | - |

## テスト結果

### 単体

なし（テストコードと設計書だけの変更で、規約『V字モデル』で対応する単体テストが無い）

### 結合

なし（結合テストは dev-docs を起動せず、変更する `tests/e2e/dev-docs.ts` を使用しない）

### dev-docs の所要時間の実測

| 対象 | 回数 | 最大 | 中央値 | 補足 |
| --- | --- | --- | --- | --- |
| `search_docs`（一覧と本文） | 30 回（起動 3 回 × 5 回 × 2 種） | 89.4 秒 | 約 21 秒 | 起動の直後の 1 回目が最も遅い<br>`テスト結果/20261108211857_f13754f_dev-docsの所要時間.log` |
