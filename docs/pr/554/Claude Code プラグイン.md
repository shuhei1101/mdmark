# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-3.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-3.yaml) | Claude Code から点検と書き出しを呼ぶ | 既定で隠すことと、隠さない書き出しの指定を追加 |
| ドキュメント | [docs/interface/IF-472-9.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-9.ts.yaml) | `export_html` | 隠さない書き出しの引数を追加 |
| ドキュメント | [docs/interface/IF-472-13.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-13.ts.yaml) | `build_site` | 同上 |
| ドキュメント | [docs/module/MOD-472-48.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-48.ts.yaml) | MCP サーバー / `tools.ts` | ツールの引数を CLI の書き出しへ渡す |
| ドキュメント | [docs/module/MOD-472-49.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-49.ts.yaml) | MCP サーバー / `arguments.ts` | 引数の検査を追加 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `export_html`・`build_site` | CLI の `exportDocument`・`buildSite` を呼ぶ |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 既定と開発用の指定 | `export_html`・`build_site` は既定で隠し、CLI と同じ意味の隠さない書き出しの引数を追加する | 引数の名前はインターフェース定義設計で CLI と揃えて決める |
| 既存機能への影響 | 既存の引数・戻り値は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `de2762ce..d460d6c4` | - |
| 単一ユースケース設計 | `dccad6d4..6ff90b71` | レビューの指摘の修正 |
| 単一ユースケース設計 | `6ff90b71..0555f15f` | レビューの指摘の修正 |

## テスト結果

### 単体

なし

### 結合

なし
