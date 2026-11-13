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
| 単一ユースケース設計 | `236fa0a4..d46fdf44` | レビューの指摘の修正 |
| インターフェース定義設計 | `f09875e5..47e17f7b` | 記法のルールの参照を案内する（新規）・MCPサーバーを起動・停止する（instructions）・設定: Claude Code プラグイン・外部ライブラリ『ClaudeCode』 |
| インターフェース定義設計 | `87893c33..60e03df9` | レビューの指摘の修正（PreCompact で記録を消す。SC-472-4・SC-472-15 の期待値を合わせた） |
| モジュール構成設計 | `22e66f6d..4d4a73de` | guide-notice.ts（新規）・build-plugin.ts・mcp.ts |
| インターフェース定義設計 | `745562c9..5b63c852` | レビューの指摘の修正（MDMARK_GUIDE_NOTICE_DIR を visibility: developer にした） |

## テスト結果

### ドキュメント修正

なし（ドキュメント修正の工程は、ガイド・README・アーキテクチャ図・設定の Schema・移行の行だけを修正し、実装コードを変えないため、関係する単体・結合テストが無い。修正したガイドと README は `mdmark check --text` でずれ 0 件を確かめた）

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/unit/src/plugin/guide-notice.test.ts` | 全実行 | 新規 | ✅ | 全件（`npm run test:unit`）2118 件のうち 2116 件 pass。時間切れの 2 件（`test_run_check`・`test_prepare_embeds`）は同じ commit で単独に流し直して pass<br>`テスト結果/20261114050515_cd513697_単体テスト.log` |
| [tests/unit/src/plugin/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/unit/src/plugin/pre-tool-use.test.ts) | 全実行 | 実行のみ | ✅ | `hooks.json` の PreToolUse の 1 行目が変わらないことの回帰確認 |

`tests/unit/src/plugin/guide-notice.test.ts` は、lint の `noTemplateCurlyInString` の警告を抑える注釈だけを `b17210bf` で実装と別に追加した（`hooks.json` に記載した展開前の文字列と比べるため）。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| `tests/integration/ClaudeCodeプラグイン/guide-notice.test.ts` | 全実行 | 新規 | ✅ | 7 テスト pass<br>`テスト結果/20261114053437_dfc991bb_結合テスト.log` |
| [tests/integration/ClaudeCodeプラグイン/check.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/ClaudeCodeプラグイン/check.test.ts) | 全実行 | 変更 | ✅ | 拡張子の提案のケースを追加し、正常系・取り込み先のフィクスチャの文書を `.mark.md` にした |
| [tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/ClaudeCodeプラグイン/pre-tool-use.test.ts)・[session-start.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/ClaudeCodeプラグイン/session-start.test.ts)・[serve.test.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/ClaudeCodeプラグイン/serve.test.ts) | 全実行 | 実行のみ | ✅ | `hooks.json` の行の追加と `INSTRUCTIONS` の変更の回帰確認 |
| [tests/integration/plugin.ts](https://github.com/shuhei1101/mdmark/blob/d2e6de76/tests/integration/plugin.ts) | - | 変更 | - | 案内のフックの行を起動する `runGuideNoticeHook` を追加した（テストの補助） |
