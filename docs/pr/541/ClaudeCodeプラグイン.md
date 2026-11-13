# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/scenario/SC-472-15.yaml) | ガイドを参照する | `.mark.md` の記載と利用者の指示で案内を受けるシナリオを追加する |
| ドキュメント | [docs/scenario/SC-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/scenario/SC-472-4.yaml) | Claude Code にプラグインを入れる | 入るフックの追加に合わせる |
| ドキュメント | [docs/scenario/SC-472-3.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/scenario/SC-472-3.yaml) | Claude Code から点検と書き出しを呼ぶ | 提案のずれが返ることを加える |
| ドキュメント | [docs/scenario/SC-472-85.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/scenario/SC-472-85.yaml) | Claude Code でガイドを参照して記載し点検する（複合） | 案内を受けてから参照する流れにする |
| ドキュメント | [docs/interface/IF-472-5.ts.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/interface/IF-472-5.ts.yaml)・[IF-472-6](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/interface/IF-472-6.ts.yaml) | 既存の PreToolUse・SessionStart のフック | 新しいフックのインターフェース定義の書き方を合わせる |
| ドキュメント | [docs/module/MOD-472-13.ts.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/module/MOD-472-13.ts.yaml)・[MOD-472-3](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/module/MOD-472-3.ts.yaml)・[MOD-472-14](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/module/MOD-472-14.ts.yaml)・[MOD-472-48](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/module/MOD-472-48.ts.yaml) | フック・プラグインのビルド・MCP サーバー | 新しいフックのモジュールと `hooks.json`・`instructions` を追加・修正する |
| ドキュメント | [docs/library/LIB-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/d2e6de76/docs/library/LIB-472-1.yaml) | Claude Code | UserPromptSubmit と Write・Edit への PreToolUse の入出力を追加する |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/d2e6de76/plugin/hooks/hooks.json) | PreToolUse（mdmark の MCP のツールだけ）と SessionStart | Write・Edit への PreToolUse と UserPromptSubmit を追加する |
| 実装 | [src/plugin/pre-tool-use.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/src/plugin/pre-tool-use.ts)・[src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/src/plugin/session-start.ts) | 既存のフック | 新しいフックの出力の形を合わせる |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/src/plugin/mcp.ts) | MCP の `instructions` | 純粋な `.md` に記法を使用しないことと、`.mark.md` の拡張子を記載する |
| テスト | [tests/unit/src/plugin/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/unit/src/plugin/pre-tool-use.test.ts)・[tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts) | フックのテスト | 新しいフックのケースを追加する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `.mark.md` の記載の案内 | Write・Edit への PreToolUse のフックが、`tool_input.file_path` が `.mark.md` で終わり、そのセッションで未案内のとき、記法のルールを MCP で参照するよう `additionalContext` で案内する | 呼び出しは止めない |
| 利用者の指示の案内 | UserPromptSubmit のフックが、発言が mdmark で記載するよう指示し、そのセッションで未案内のとき、同じ案内を `additionalContext` で出す | 指示の判定は `要件.md` の `未確定` |
| 案内の記録 | 案内したセッションの `session_id` を、プラグインのフックがファイルに記録し、同じセッションでは 2 回目から出さない | 置き場所と古い記録の片付けはモジュール構成設計で決める |
| 純粋な `.md` の扱い | MCP の `instructions` に、記法で記載する文書の拡張子が `.mark.md` で、純粋な `.md` には利用者の指示が無い限り記法を使用しないことを事実の文で記載する | 文字数の上限に収める |
| 案内の文面 | 記法のルールを参照する MCP のツールと、記載した後に `check` で点検することを 1〜2 行で伝える | Claude Code が読む文で、利用者の画面には出ない |
| 既存機能への影響 | 既存の PreToolUse（mdmark の MCP のツール）と SessionStart の出力は変えない | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `d2e6de76..94aaab6f` | ClaudeCodeでガイドを参照して記載し点検する |
| 単一ユースケース設計 | `ff181329..c3c2bca0` | ガイドを参照する・ClaudeCodeにプラグインを入れる・ClaudeCodeから点検と書き出しを呼ぶ。複合 UC の任意の指摘の反映を含む |
