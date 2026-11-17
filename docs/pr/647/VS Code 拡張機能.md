# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-19.yaml](https://github.com/shuhei1101/mdmark/blob/730b1a56/docs/module/MOD-472-19.yaml) | 分類『VS Code 拡張機能 / 拡張機能の入口』のフォルダ構成を持つモジュール構成 | `directory` に `escape.ts`・`workspace.ts` の行がある。変更しない |
| ドキュメント | [docs/module/index.yaml](https://github.com/shuhei1101/mdmark/blob/730b1a56/docs/module/index.yaml) | モジュール構成の目次 | 2 ファイルの行が無い |
| ドキュメント | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/730b1a56/vscode/files.yaml) | `vscode/` の管理用の YAML | `src/escape.ts`・`src/workspace.ts` は MOD-472-19 を implements で指す |
| 実装 | [vscode/src/escape.ts](https://github.com/shuhei1101/mdmark/blob/730b1a56/vscode/src/escape.ts) | HTML として特別な文字のエスケープ（vscode を import しない） | `escapeHtml` |
| 実装 | [vscode/src/workspace.ts](https://github.com/shuhei1101/mdmark/blob/730b1a56/vscode/src/workspace.ts) | 相対パスの設定の基準のフォルダ | `baseDirOf` |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `vscode/src/escape.ts` のモジュール構成 | 関数 `escapeHtml` を記載したモジュール構成を新規作成する | ライブラリ本体の `src/parts/escape.ts` の `escapeHtml` とは別の関数として記載する |
| `vscode/src/workspace.ts` のモジュール構成 | 関数 `baseDirOf` を記載したモジュール構成を新規作成する | - |
| [docs/module/index.yaml](https://github.com/shuhei1101/mdmark/blob/730b1a56/docs/module/index.yaml) | 新規作成した 2 件の行を追加する | - |
| `vscode/files.yaml` | 2 ファイルの行の implements を新規作成したモジュール構成へ向け、`description` の受け持ちを新規作成したモジュール構成に合わせる | ドキュメント修正の工程 |

## テスト結果

### 単体

なし（設計書と管理用の YAML だけの変更で、実装とテストを変えないため、関係する単体テストが無い）

### 結合

なし（同じ理由で、関係する結合テストが無い）
