# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/076685e8feb647d54aec4b8e8e1a4a97f9daa051/docs/interface/IF-472-22.ts.yaml) | プレビューを開く。正常系（範囲のスクリプトと CSS）の期待値に「CSP の違反が 0 件」がある | 変更しない |
| ドキュメント | [docs/module/MOD-472-75.tsx.yaml](https://github.com/shuhei1101/mdmark/blob/076685e8feb647d54aec4b8e8e1a4a97f9daa051/docs/module/MOD-472-75.tsx.yaml) | テストのときだけ `data-mdmark-csp-violations` に CSP の違反の件数を記載する | 変更しない |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/076685e8feb647d54aec4b8e8e1a4a97f9daa051/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_range_scripts` が `script-src` の中身と、知らせの枠・書き方の警告が 0 件であることだけを確認する | 確認を追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `test_normal_when_range_scripts` | 検証の CSP の節の末尾で、`inspect("html")` の先頭の要素の `attributes["data-mdmark-csp-violations"]` が `"0"` であることを確認する | 範囲の ts を動かした後に確認するため、ts の実行で出た違反も数える |

## テスト結果
