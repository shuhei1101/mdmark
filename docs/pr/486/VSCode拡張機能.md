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

### 単体

なし（実装を変えず、対応する単体テストが無い）

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/test/vscode/range-scripts-csp-violations/vscode/tests/integration/preview-open.test.ts) | `test_normal_when_range_scripts` | 変更 | ✅ | VS Code 1.141.0 と stable（1.146.0）の両方で pass<br>`テスト結果/20261113014657_5740bcbd_結合テスト.log` |
| `vscode/tests/integration/*.test.ts` | 全実行 | 実行のみ | ✅ | 1.141.0・stable ともに 80 件 pass・1 件 pending<br>pending は [#496](https://github.com/shuhei1101/mdmark/issues/496) の `test_normal_when_library_origin_added` を手元だけで `test.skip` にしたもの（commit していない）<br>`テスト結果/20261113014657_5740bcbd_結合テスト.log` |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/test/vscode/range-scripts-csp-violations/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` | 実行のみ | ❌ | 「別の配信元がモジュールの要求を受けない」。develop の既存の fail で、[#496](https://github.com/shuhei1101/mdmark/issues/496) で起票済み（#477 で `libraries` のマーカーの書き方が変わった）。この PR の対象外<br>`テスト結果/20261113014657_5740bcbd_結合テスト_496のfailを含む.log` |
