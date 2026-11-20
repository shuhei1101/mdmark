# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f94aee03/docs/interface/IF-472-15.ts.yaml) | HTML に書き出す | `test_normal_when_relative_mermaid` のケースは、Markdown の先頭に `<!-- features: {"map": false} -->` を記載する見本 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/f94aee03/docs/interface/IF-472-22.ts.yaml) | プレビューを開く | `test_normal_when_mermaid` のケースは同上 |
| テスト | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/f94aee03/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | フィクスチャが `%%{init: {}}%%` のままで、`test_normal_when_relative_mermaid` が fail |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/f94aee03/vscode/tests/integration/preview-open.test.ts) | プレビューを開く結合テスト | 同上で `test_normal_when_mermaid` が fail |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因 | [#747](https://github.com/shuhei1101/mdmark/pull/747) から `%%{init: {}}%%` を持つ mermaid のコードブロックも map で描く。2 件のフィクスチャの flowchart は map で描かれ、書き出しは `mermaid.url` を埋めず、プレビューは mermaid の図を描かない | 実装は #747 で決めた仕様どおりで、誤っているのはテストのフィクスチャ。ライブラリ本体の結合テストは #747 で `<!-- features: {"map": false} -->` に書き換え済み |
| 結合テスト | 2 件のフィクスチャの Markdown の先頭に `<!-- features: {"map": false} -->` を記載し、コードブロックの `%%{init: {}}%%` の行を削除する | インターフェース定義と実装は変えない |

## テスト結果

### 結合テストの実行範囲

層は TL-3（結合テスト（フロント））。`judge_integration_scope` は層に一覧と対応表が無く、全てのファイルが R7（要調査）だったため、判定フローチャートで判定し直した（テストのファイルは R2、PR ドキュメントは結合テストが読み込まない）。

<!-- table: {"kind": "data"} -->

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無いエントリーポイント |
| --- | --- | --- | --- |
| `docs/pr/774/README.mark.md` | R7 | なし（PR ドキュメントで、結合テストが読み込まない） | - |
| `docs/pr/774/VS Code 拡張機能.mark.md` | R7 | なし（同上） | - |
| `docs/pr/774/タスク一覧.yaml` | R7 | なし（同上） | - |
| `docs/pr/774/要件.mark.md` | R7 | なし（同上） | - |
| `docs/pr/774/要件.yaml` | R7 | なし（同上） | - |
| `vscode/tests/integration/export.test.ts` | R2 | `vscode/tests/integration/export.test.ts`（変更したテスト自身） | - |
| `vscode/tests/integration/preview-open.test.ts` | R2 | `vscode/tests/integration/preview-open.test.ts`（変更したテスト自身） | - |

<!-- /table -->

実行の方法: VS Code 拡張機能の結合テストを、ビルドした `vscode/out/test/` から上の 2 ファイル以外のテストを除いて手元で実行する（[PR #688](https://github.com/shuhei1101/mdmark/pull/688) と同じ）。並列数は 1（`parallelism` を持たない層）。

```bash
cd vscode && node scripts/build.ts --tests && find out/test -name "*.test.mjs" ! -name "export.test.mjs" ! -name "preview-open.test.mjs" -delete && xvfb-run -a node tests/integration/run.ts
```

### 単体

なし（実装を変えず、対応する単体テストが無い）

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/export.test.ts` | 全実行 | 変更 | ✅ | `test_normal_when_relative_mermaid` のフィクスチャを変更。VS Code 1.141.0 と stable（1.147.0）で、2 ファイル合わせて 37 テスト pass<br>`テスト結果/20261121055702_4d861459_結合テスト_VSCode拡張機能.log` |
| `vscode/tests/integration/preview-open.test.ts` | 全実行 | 変更 | ✅ | `test_normal_when_mermaid` のフィクスチャを変更。同じ実行で pass<br>`テスト結果/20261121055702_4d861459_結合テスト_VSCode拡張機能.log` |

### lint

✅ `テスト結果/20261121055702_4d861459_lint.log`（警告 1 件は作業 PR が変えていない `plugin/bin/setup.js` のファイルの大きさ、info 1 件は作業 PR が変えていない `tests/unit/src/tree/tree.syntax.test.ts`）
