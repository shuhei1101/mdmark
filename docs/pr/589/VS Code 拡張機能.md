# VS Code 拡張機能

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-16.yaml](https://github.com/shuhei1101/mdmark/blob/52b7213b/docs/module/MOD-472-16.yaml) | Webview のフォルダ構成を持つ束ねる設計書 | `directory` に `vite-env.d.ts` の行がある。変更しない |
| ドキュメント | [vscode/files.yaml](https://github.com/shuhei1101/mdmark/blob/52b7213b/vscode/files.yaml) | `vscode/` の管理用の YAML | `src/webview/vite-env.d.ts` の行が無い |
| 実装 | [vscode/src/webview/vite-env.d.ts](https://github.com/shuhei1101/mdmark/blob/52b7213b/vscode/src/webview/vite-env.d.ts) | `vite/client` の型の参照 | 要素を持たない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `vscode/src/webview/vite-env.d.ts` のモジュール構成 | 要素を持たないモジュール構成を新規作成し、`lead` に `vite/client` の型の参照だけを持つファイルだと記載する | `未確定`（[要件](./要件.md) の `## 要望`） |
| `docs/module/index.yaml` | 新規作成した 1 件の行を追加する | - |
| `vscode/files.yaml` | `src/webview/vite-env.d.ts` の行を追加し、implements で新規作成したモジュール構成を指す | ドキュメント修正の工程 |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| モジュール構成設計 | `52b7213b..542114b9` | - |

## テスト結果

### 単体

なし

### 結合

なし
