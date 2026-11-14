# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-21.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-21.ts.yaml) | インターフェース定義『プレビューを再描画する』。このテストの setup は `<!-- my-chart: {"label": "a"} -->` のマーカーを持つ `guide.md` | 変更しない |
| テスト | [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` のテストの文書が `<!-- my-chart: a -->` で、マーカーを描かずに記載の警告を出すため、別の配信元がモジュールの要求を受けない | 修正する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| テストの文書のマーカー | `<!-- my-chart: a -->` を `<!-- my-chart: {"label": "a"} -->` に変える | インターフェース定義の setup の記載 |
| 実装 | 変えない | #477 の動作は設計書どおり |
| 確認 | `preview-rerender.test.ts` を VS Code 1.141.0 と stable の両方で実行し、pass を確かめる | - |

## テスト結果

### 単体

なし

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [vscode/tests/integration/preview-rerender.test.ts](https://github.com/shuhei1101/mdmark/blob/test/vscode/library-origin-added-marker/vscode/tests/integration/preview-rerender.test.ts) | `test_normal_when_library_origin_added` | 変更 | ✅ | 1.141.0 と stable（1.146.0）で pass<br>`テスト結果/20261114025113_b3d86422_結合テスト.log` |
| `vscode/tests/integration/*.test.ts` | 全実行 | 実行のみ | ✅ | 1.141.0 と stable（1.146.0）でそれぞれ 83 件 pass<br>`テスト結果/20261114025113_b3d86422_結合テスト.log` |

lint: `テスト結果/20261114025113_b3d86422_lint.log`（`plugin/bin/setup.js` のファイルの大きさの警告 1 件は base ブランチから残っている）
