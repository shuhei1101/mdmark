# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/plugin/tools.ts) | MCP のツールの定義と処理 | Markdown に書き出すツールを追加する |
| 実装 | [src/plugin/arguments.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/plugin/arguments.ts) | MCP のツールの引数の検査 | 新しいツールの引数を追加する |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/src/plugin/mcp.ts) | ツールの登録と instructions | instructions に新しいツールを追加する |
| ドキュメント | [docs/interface/IF-472-9.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/docs/interface/IF-472-9.ts.yaml) | 文書をHTMLに書き出す（MCP） | 新しいインターフェース定義の雛形にする |
| ドキュメント | [docs/scenario/SC-472-3.yaml](https://github.com/shuhei1101/mdmark/blob/e6104511657e4c56f8e8d4104aa67a385dc7205a/docs/scenario/SC-472-3.yaml) | ClaudeCodeから点検と書き出しを呼ぶ | 新しいツールを追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| MCP のツール | `export_html` と同じく、作業のフォルダを `project_dir` で受けて CLI と同じ処理を呼び、書き出した Markdown と画像のパスを返すツールを追加する | ツール名はインターフェース定義設計で決める |
| instructions | 新しいツールを MCP サーバーの instructions に追加する | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `e6104511..5e406a2b` | SC-472-3 |

## テスト結果

なし
