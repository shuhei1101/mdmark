# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/module/MOD-472-3.ts.yaml](https://github.com/shuhei1101/mdmark/blob/9d4883b5/docs/module/MOD-472-3.ts.yaml) | モジュール構成『session-start.ts』 | `NOT_LISTENING_CONTEXT`・`PORT_INVALID_CONTEXT` を定数で持つ |
| ドキュメント | [docs/module/MOD-472-349.ts.yaml](https://github.com/shuhei1101/mdmark/blob/9d4883b5/docs/module/MOD-472-349.ts.yaml) | モジュール構成『guide-notice.ts』 | `NOTICE_BODY` と `noticeHead` の文を持つ |
| ドキュメント | [docs/module/MOD-775-1.ts.yaml](https://github.com/shuhei1101/mdmark/blob/9d4883b5/docs/module/MOD-775-1.ts.yaml) | モジュール構成『prompt.ts』 | `kind` は `instructions`・`tool` だけ。読み込む先はパッケージの直下の `content/prompts/` |
| ドキュメント | [docs/module/MOD-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/9d4883b5/docs/module/MOD-472-14.ts.yaml) | モジュール構成『build-plugin.ts』 | フックを `plugin/scripts/` にまとめる |
| ドキュメント | [project-index.yaml](https://github.com/shuhei1101/mdmark/blob/9d4883b5/project-index.yaml) | 配信元の設定 | `prompts` の行の `paths` は `content/prompts/**/*.yaml` だけ |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/9d4883b5/src/plugin/session-start.ts) | SessionStart のフック | 注入文をコードの文字列に持つ |
| 実装 | [src/plugin/guide-notice.ts](https://github.com/shuhei1101/mdmark/blob/9d4883b5/src/plugin/guide-notice.ts) | 記法のルールの参照の案内のフック | 注入文をコードの文字列に持つ |
| 実装 | [src/plugin/prompt.ts](https://github.com/shuhei1101/mdmark/blob/9d4883b5/src/plugin/prompt.ts) | プロンプトファイルの読み込み・検査・描画 | `loadPrompt`・`renderPrompt` |
| テスト | [tests/unit/src/plugin/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/9d4883b5/tests/unit/src/plugin/session-start.test.ts)・[tests/unit/src/plugin/guide-notice.test.ts](https://github.com/shuhei1101/mdmark/blob/9d4883b5/tests/unit/src/plugin/guide-notice.test.ts) | フックの単体テスト | 注入する文が変わらないことを確認する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プロンプトファイル | `plugin/content/prompts/hooks/` に、SessionStart の 2 つの文と案内のフックの文を `kind: hook` で作る。文言は今の定数と同じにし、`{port}`・`{value}`・ファイル名は変数にする | 1 つのフックの文を 1 枚にまとめるか、文ごとに分けるかはモジュール構成設計で決める |
| フック | `session-start.ts`・`guide-notice.ts` は `loadPrompt`・`renderPrompt` でプロンプトファイルを読み込んで描くだけにし、文の定数を削除する | プロンプトファイルを読み込めないときの注入の扱いは、フックが Claude Code を止めない今の決まり（どの場合も 0 を返却する）に合わせる |
| プロンプトの描画 | `prompt.ts` の `kind` に `hook` を追加し、読み込む先の直下（パッケージの直下かプラグインのルート）を呼び出し側が指定できるようにする | - |
| プラグインのビルド | `plugin/content/prompts/` がプラグインの配布物に含まれ、`plugin/scripts/` のフックからプラグインのルートを解決して読み込めるようにする | - |
| 配信元の設定 | `project-index.yaml` の `prompts` の行の `paths` に `plugin/content/prompts/**/*.yaml` を追加する | - |
| テスト | 単体: フックが今と同じ文を出すこと・`kind: hook` の読み込み。結合: ビルドした `plugin/scripts/` のフックが配布物のプロンプトファイルから文を出すこと | - |

## テスト結果

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/src/plugin/session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/feat/map/wire-drag-label-packet-and-hook-prompts/tests/unit/src/plugin/session-start.test.ts) | 全実行 | 変更 | ✅ | `テスト結果/20261122201936_3c456c62_単体テスト.log` |
| [tests/unit/src/plugin/guide-notice.test.ts](https://github.com/shuhei1101/mdmark/blob/feat/map/wire-drag-label-packet-and-hook-prompts/tests/unit/src/plugin/guide-notice.test.ts) | 全実行 | 変更 | ✅ | `テスト結果/20261122201936_3c456c62_単体テスト.log` |

### 結合テストの実行範囲

[ライブラリ本体.mark.md](./ライブラリ本体.mark.md) の `### 結合テストの実行範囲` の表にまとめた（プラグインの分は `tests/integration/ClaudeCodeプラグイン/session-start.test.ts`・`tests/integration/ClaudeCodeプラグイン/guide-notice.test.ts`）。

### 結合

なし（reviewer の確認を受けた後、結合テスト作成で記入する）
