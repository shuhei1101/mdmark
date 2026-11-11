# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/インターフェース定義/VSCode拡張機能/](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/インターフェース定義/VSCode拡張機能)・[dev/設計書/モジュール構成/VSCode拡張機能/](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/モジュール構成/VSCode拡張機能)・[dev/設計書/設定/VSCode拡張機能.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/設定/VSCode拡張機能.yaml)・[dev/設計書/画面設計/](https://github.com/shuhei1101/mdmark/blob/develop/dev/設計書/画面設計) | VS Code 拡張機能の設計書 | 種類のフォルダへ移す |
| 設定 | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/vscode/files.yaml) | 拡張機能のファイルのメタデータ。関連が `dev/設計書/` を指す | パスを合わせる |
| テスト | [vscode/tests/integration/preview-open.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/preview-open.test.ts)・[vscode/tests/integration/helpers.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/tests/integration/helpers.ts) | プレビューの確認に `dev/`・`docs/` の文書を使う | パスを合わせる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 設計書の置き場所 | ライブラリ本体と同じ手順で、v0.4.0 の変換の後に種類のフォルダへ移す | 中身は変えない |
| パスを指す設定・テスト | `vscode/files.yaml`・`vscode/tests/integration/` を移した後のパスに合わせる | 振る舞いは変えない |

## テスト結果

### ドキュメント修正

関係する単体・結合テストは無い。この工程は文書・管理用の YAML の置き場所と参照だけを変える。設計書の検証は [ライブラリ本体](./ライブラリ本体.md) の `## テスト結果`。

### 実装

#### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `vscode/tests/integration/` | 全実行 | 変更 | ✅ | `helpers.ts`・`preview-open.test.ts` は見本の文書とモックの素材のパスだけ変更。VS Code 1.141.0 と stable の両方で 81 テスト pass<br>`テスト結果/20261111185504_8799167c_VSCode拡張機能の結合テスト.log` |

同じ commit の 1 回前の実行は、stable の「プレビューを再描画する」test_normal が時間の比較で 1 件 fail した（`テスト結果/20261111185504_8799167c_VSCode拡張機能の結合テストの1回前.log`）。文書のパスと無関係のため、スコープ外に書いた。
