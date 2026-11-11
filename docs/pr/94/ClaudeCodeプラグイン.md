# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeにプラグインを入れる.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.yaml) | `正常シナリオ` の期待値 2〜4 が、`claude plugin list` の `Read from:` を導入先として使う | 更新対象 |
| ドキュメント | [dev/設計書/テスト/テスト実行方法.yaml](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%86%E3%82%B9%E3%83%88/%E3%83%86%E3%82%B9%E3%83%88%E5%AE%9F%E8%A1%8C%E6%96%B9%E6%B3%95.yaml) | E2E テストの前提に、`dist/` と `plugin/` の生成物を commit・push してから流すことが無い（テストのコメントにだけある） | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/release/v0.7.0/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | `test_normal` が `claude plugin list` の出力を `/Read from:\s*(.+)/` で読み、導入先とその中身・MCP サーバーの起動に使う | 更新対象。Claude Code 2.1.309 は `Read from:` を出さず、空文字になって落ちる |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 導入先の読み取り | `claude plugin list --json` の出力を JSON として読み、`id` が `mdmark@mdmark` の行の `installPath` を導入先にする | 行の項目名は実装の段で `--json` の実際の出力で確かめる |
| 有効の検証 | 同じ JSON の行で `mdmark@mdmark` が有効であることを確かめる | テキストの `enabled` を探す検証を置き換える |
| 導入先の中身と MCP サーバーの検証 | 導入先が `CLAUDE_CONFIG_DIR` の下にあること、`hooks/hooks.json`・`.mcp.json`・`server/mcp.js`・`node_modules/esbuild` があること、`.mcp.json` のコマンドで起動したサーバーがツールの一覧を返すことの検証は変えない | 変数名 `readFrom` は導入先を表す名前にする |
| シナリオの期待値 | 期待値 2〜4 の `Read from:` を、`claude plugin list --json` の `installPath` の場所に書き換える | 他の期待値・フロー・セットアップは変えない |
| テスト実行方法 | E2E テストの前提に、『ClaudeCodeにプラグインを入れる』は release ブランチで `npm run build` を流して `dist/` と `plugin/` の生成物を commit・push した後に流すことを 1 行加える | テストのコメントは変えない |

## テスト結果
