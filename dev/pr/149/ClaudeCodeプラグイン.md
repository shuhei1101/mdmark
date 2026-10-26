# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| テスト | [tests/e2e/複合ユースケース/ClaudeCodeで索引を書き換えて点検してから配る.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.8.0/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%A7%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%81%A6%E7%82%B9%E6%A4%9C%E3%81%97%E3%81%A6%E3%81%8B%E3%82%89%E9%85%8D%E3%82%8B.spec.ts) | `test_normal` が `find_docs` を `{ text: "A" }` だけで呼び（46 行目）、返った本文を `JSON.parse` して `docs` が 1 件かを確かめる（57 行目） | 更新対象。既定の markdown の本文（先頭行 `総件数 1 件・返した件数 …`）を JSON として読んで `SyntaxError` になる |
| テスト | [tests/e2e/単一ユースケース/索引から文書を探す.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.8.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.spec.ts) | `format: "json"` を渡したときに `structured` と本文の JSON が一致し、`docs` の ID を読めることを確かめている（275〜286 行目） | 参照のみ。読み方を揃える先 |
| 実装 | [src/plugin/results.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.8.0/src/plugin/results.ts) | `find_docs` の結果を、既定は markdown の表、`format: "json"` のときは JSON で返す | 変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `find_docs` の呼び方 | `test_normal` の `find_docs` の引数を `{ text: "A", format: "json" }` にする | インターフェース定義『文書を探す』と単一ユースケースの E2E が JSON を受けるときの呼び方に揃える |
| `find_docs` の確かめ | 57 行目の `JSON.parse(...).docs` が 1 件の確かめは変えない | 当たった文書の数の確かめを、markdown の表の行の数え方に依らずに保つ |
| 他のステップ | `update_index`・`check`・`build_site` の呼び方と確かめは変えない | |

## テスト結果

### 単体

なし

### 結合

なし

### E2E

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
