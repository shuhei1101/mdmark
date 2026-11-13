# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-21.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-21.yaml) | VS Code 拡張機能 / 設定のフォルダ構成（`vscode/src/`） | 更新対象 |
| ドキュメント | [docs/module/MOD-472-106.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-106.ts.yaml) | `extensions-bundle.ts` の要素 | 受け持ちのコメントの根拠。変更しない |
| ドキュメント | [docs/module/MOD-472-16.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-16.yaml) | VS Code 拡張機能 / Webview のフォルダ構成 | 更新対象 |
| 実装 | [vscode/src/extensions-bundle.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/extensions-bundle.ts) | 拡張のまとめ | 変更しない |
| 実装 | [vscode/src/webview/vite-env.d.ts](https://github.com/shuhei1101/mdmark/blob/develop/vscode/src/webview/vite-env.d.ts) | `vite/client` の型の参照 | 変更しない。要素の文書が無い |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `MOD-472-21` の `directory` | `vscode/src/` の階層に `extensions-bundle.ts` の行を、既存の行とコメントの桁を揃えて追加する。既存の桁より長いファイル名の行は `#` の前に空白 1 つで追加する | 他の行は変えない |
| `MOD-472-16` の `directory` | `vscode/src/webview/` の階層に `vite-env.d.ts` の行を追加する | 他の行は変えない |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | `934a668d..9fa83528` | dev-docs の配信元に無いため、YAML を直接編集した |
| モジュール構成設計 | `841d07da..838afaf6` | レビューの指摘の修正（`main.tsx` の行の空白を戻した） |

## テスト結果

### 単体

なし

### 結合

なし
