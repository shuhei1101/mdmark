# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/モジュール構成/VSCode拡張機能/ビルドと配布.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/VSCode%E6%8B%A1%E5%BC%B5%E6%A9%9F%E8%83%BD/%E3%83%93%E3%83%AB%E3%83%89%E3%81%A8%E9%85%8D%E5%B8%83.ts.yaml) | `unit_tests` の `test_build_extension` の `condition` が「作業ツリーの `vscode/` を一時フォルダに複製して `tests` が `false` で呼ぶ」 | 除外する対象を condition に追加する |
| テスト | [tests/unit/vscode/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/vscode/scripts/build.test.ts) | `cp` の `filter` が `source.includes("node_modules")` だけを除外する | filter を変更する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| コピーの除外 | `cp` の `filter` で、コピー元の `vscode/` からの相対パスが `node_modules`・`.vscode-test`・`out`・`dist`・`media/preview.js`・`media/preview.css` のどれかか、その配下なら除外する | `source.includes` の部分一致をやめ、相対パスの先頭で判定する |
| 設計書 | `test_build_extension` の `condition` に、生成物と取得物を除外してコピーすることを記載する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | `97c273d0..822a16c5` | - |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/vscode/scripts/build.test.ts` | `test_build_extension` | 変更 | ✅ | `vscode/out/`・`vscode/.vscode-test/`・`vscode/dist/`・`vscode/media/preview.{js,css}` を置いた作業ツリーでも成功する（修正前のテストは同じ状態で `out/` が無いことの検証で失敗する） |
| 全テスト | 全実行 | 実行のみ | ✅ | 183 ファイル・1311 テスト pass<br>`テスト結果/20261103223723_57b049b8_単体テスト.log` |

### lint

`テスト結果/20261103223723_57b049b8_lint.log`（Biome の check・ルートと `vscode/` の tsc で違反なし）
