# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-15.ts.yaml) | HTML に書き出す | `test_normal_when_relative_mermaid` のケースを持つ。テストの誤りなら更新 |
| ドキュメント | [docs/interface/IF-472-22.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-22.ts.yaml) | プレビューを開く | `test_normal_when_mermaid` のケースを持つ。テストの誤りなら更新 |
| ドキュメント | [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-102.ts.yaml) | 書き出し / embed.ts | 相対パスの `mermaid.url` を `data:` の URL に替える処理。実装の誤りなら更新 |
| 実装 | [vscode/src/export/embed.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/embed.ts) | 相対パスのライブラリ・`mermaid.url` を `bundle` でまとめて `data:` の URL に替える | まとめられないと `url` を削除する |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/export/export.ts) | 重ねた設定の相対パスを埋めて書き出す | - |
| テスト | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | `test_normal_when_relative_mermaid` が fail |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts) | プレビューを開く結合テスト | `test_normal_when_mermaid` が fail |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 原因 | [#630](https://github.com/shuhei1101/mdmark/pull/630)（[4d38ecc2](https://github.com/shuhei1101/mdmark/commit/4d38ecc2)）から、純粋な mermaid のコードブロックは map の図で描き、map で同じ図にできないときだけ mermaid の図に戻す。2 件のテストのフィクスチャの `flowchart LR` は map で描けるため mermaid の対象にならず、書き出しは `usesMermaid` が `false` を返して `mermaid.url` を削除し、プレビューは mermaid の図を描かない | 実装は #630 で決めた仕様どおりで、誤っているのはテストの前提 |
| インターフェース定義 | IF-472-15・IF-472-22 の 2 ケースの見本のワークスペースに、コードブロックの先頭の行に `%%{init: {}}%%` を記載すると書き足す | #630 がライブラリ本体のテスト（`tests/integration/lib/export.test.ts`・`bundle.test.ts`）で mermaid の図に戻すために使った行と同じ |
| 結合テスト | `export.test.ts` の `test_normal_when_relative_mermaid` と `preview-open.test.ts` の `test_normal_when_mermaid` のフィクスチャの `flowchart LR` の前に `%%{init: {}}%%` の行を足す | 実装は変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| インターフェース定義設計 | `942f69e1..10b2a3f4` | - |

## テスト結果

### 結合テストの実行範囲

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無いエントリーポイント |
| --- | --- | --- | --- |
| `docs/interface/IF-472-15.ts.yaml` | R7（一覧・対応表に無い。テストのフィクスチャの説明だけの変更で、実行時に読む結合テストが無い） | - | - |
| `docs/interface/IF-472-22.ts.yaml` | R7（同上） | - | - |
| `docs/pr/688/README.md` | R7（PR ドキュメントで、実行時に読む結合テストが無い） | - | - |
| `docs/pr/688/VS Code 拡張機能.md` | R7（同上） | - | - |
| `docs/pr/688/タスク一覧.yaml` | R7（同上） | - | - |
| `docs/pr/688/要件.md` | R7（同上） | - | - |
| `docs/pr/688/要件.yaml` | R7（同上） | - | - |
| `vscode/tests/integration/export.test.ts` | R2 | `vscode/tests/integration/export.test.ts` | - |
| `vscode/tests/integration/preview-open.test.ts` | R2 | `vscode/tests/integration/preview-open.test.ts` | - |

実行のしかた: VS Code 拡張機能の結合テストは、ランナーの workflow（`test.yml`）が `paths` を指定したときに回さないため、手元で TL-3 の補足「VS Code 拡張機能」のコマンドを、ビルドした `vscode/out/test/` から上の 2 ファイル以外のテストを除いて実行する（[#684](https://github.com/shuhei1101/mdmark/pull/684) と同じ）。VS Code 1.141.0 と stable の両方で回る。並列数は 1（`parallelism` を持たない層）。

```bash
cd vscode && node scripts/build.ts --tests && find out/test -name "*.test.mjs" ! -name "export.test.mjs" ! -name "preview-open.test.mjs" -delete && xvfb-run -a node tests/integration/run.ts
```

### 単体

なし（実装を変えず、規約『V字モデル』の対応表で対応する単体テストが無い）

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/export.test.ts` | 全実行 | 変更 | ✅ | `test_normal_when_relative_mermaid` のフィクスチャを変更。VS Code 1.141.0 と stable で、2 ファイル合わせて 37 テスト pass<br>`テスト結果/20261119110605_3ab997f2_結合テスト_VSCode拡張機能.log` |
| `vscode/tests/integration/preview-open.test.ts` | 全実行 | 変更 | ✅ | `test_normal_when_mermaid` のフィクスチャを変更。同じ実行で pass<br>`テスト結果/20261119110605_3ab997f2_結合テスト_VSCode拡張機能.log` |

### lint

✅ `テスト結果/20261119110605_3ab997f2_lint.log`（警告 1 件は作業 PR が変えていない `plugin/bin/setup.js` のファイルの大きさ）
