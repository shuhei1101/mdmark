# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/アーキテクチャ図/アーキテクチャ図.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E5%9B%B3/%E3%82%A2%E3%83%BC%E3%82%AD%E3%83%86%E3%82%AF%E3%83%81%E3%83%A3%E5%9B%B3.yaml) | リポジトリ構成に `guide/`（使い方集）と `plugin/`（SessionStart・MCP）の場所だけがあり、中身は無い | サブシステムを追加する |
| 実装 | なし | プラグイン・マーケットプレイスの定義・フック・使い方集は無い | 新規 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| マーケットプレイス | リポジトリの直下の `.claude-plugin/marketplace.json` に `plugin/` のプラグインを載せる | - |
| プラグインの定義 | `plugin/.claude-plugin/plugin.json` に名前・版・説明を書き、版は配布物のビルドが mdmark の版を書く | Claude Code は版が変わったときだけプラグインを更新する |
| 索引を入れる | `plugin/hooks/hooks.json` の SessionStart のフックが、使い方集の索引を `hookSpecificOutput.additionalContext` で返す。索引は事実として書き、命令調にしない | 10,000 文字を超えると先頭 2,000 文字だけになるため、ビルドで止める |
| MCP サーバーの起動 | `plugin/.mcp.json` に、束ねた MCP サーバーを `node ${CLAUDE_PLUGIN_ROOT}/...` で起動する行を書く。束ねない実行時の依存（esbuild）は `plugin/package.json` と `plugin/package-lock.json` に版を固定して書く | Claude Code が入れる依存は、lockfile が揃うときだけ・`--ignore-scripts`・60 秒で打ち切り。esbuild は postinstall に頼らず `@esbuild/{プラットフォーム}` の optional dependency で動く。外部ライブラリの Claude Code の設計書に書く |
| ツールの説明 | 各ツールの説明に、呼ぶ場面と引数・戻り値を書く。`read_guide` の説明に、索引の名前を渡すことを書く | - |
| エラー表示 | ツールのエラーは、何が合わないかと直し方を日本語の 1 文で返す（CLI の点検の内容の文と同じ書き方） | - |
| 使い方集の索引 | 名前・読むとき・概要・本文のページを 1 件 1 行で持ち、記法・部品・図の描き方・拡張の仕方・HTML の書き方・図の確かめ方の本文を指す | 本文の持ち方は要件.md の `未確定` |
| 動作環境 | 確かめた Claude Code の版を非機能要件に書く | PoC で確かめる |
| 外部ライブラリ | MCP サーバーは公式 SDK v2（`@modelcontextprotocol/server` 2.3.1）の `McpServer.registerTool` と `serveStdio` で作り、esbuild で束ねる。束ねた配布物に ajv と zod の著作権表示を入れる | [ライブラリ選定](https://github.com/shuhei1101/mdmark/pull/72#discussion_r4357833926)。旧方式（`initialize`）と新方式（`server/discover`）の両方に答える |

`未確定`: サブシステムを分けるか（決める段: PoC 検証の後のアーキテクチャ図の確定）

| 案 | 内容 | メリット | デメリット |
| --- | --- | --- | --- |
| A | 「Claude Code プラグイン」を別のサブシステムにする | Claude Code の版・仕様に依る部分を分けて確かめられる | サブシステムが増える |
| B | ライブラリ本体に含める | 版とリリースが 1 つで済む | ライブラリ本体の動く場所に Claude Code が加わり、責務の境界がぼやける |

推奨: A

プラグインとフックは Claude Code の上で動き、ブラウザと Node で動くライブラリ本体と動く場所が違う。
ツールの処理はライブラリ本体、起動とフックはプラグインの側に分かれる。

## PoC 結果

| 検証構成 | 成功条件 | 結果 | PoC PR | 補足 |
| --- | --- | --- | --- | --- |
| マーケットプレイス | `claude plugin marketplace add`・`claude plugin install` が終了コード 0 | ✅ 成功 | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | 空の `CLAUDE_CONFIG_DIR` と、ユーザーの手元の対話のセッションの両方 |
| 索引の注入（対話） | 起動の直後の最初の依頼で、索引の先頭と末尾の合言葉を答えに出せる | ✅ 両方とも出た | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | ユーザーの手元の対話のセッション（[返信](https://github.com/shuhei1101/mdmark/pull/72#discussion_r4357235963)） |
| 索引の長さ | 9,000 文字の索引の末尾まで届く | ✅ 8,982 文字の末尾の合言葉が出た | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | debug のログに `provided additionalContext (8982 chars)` |
| `instructions` | ツールを呼ぶ前に `instructions` の合言葉を答えに出せる | ✅ 出た | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | 同上の返信 |
| ツールの呼び出し | `read_guide`・`check` を最初の依頼で呼べ、`check` が `mdmark check` と同じ 2 件を返す | ✅ `schema`・`missing_doc` | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | 同上の返信 |
| MCP の起動（案 A: `npx github:` で CLI の `mdmark mcp`） | 空の npm のキャッシュから 30 秒以内（`MCP_TIMEOUT` の既定） | ❌ 53.0 秒 / 54.1 秒 | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | 取得した npm のキャッシュ 474M。キャッシュありは 7.9 秒。不採用 |
| MCP の起動（案 B: `plugin/` に束ねた JavaScript を `node` で起動） | 同上 | ✅ 120ms で接続 | [#73](https://github.com/shuhei1101/mdmark/pull/73)（closed） | 空のキャッシュからプラグインの導入まで 7 秒（`marketplace add` 5.2 秒・`install` 1.8 秒）。採用 |

成立。
SessionStart のフックで索引を渡すこと、MCP サーバーの `instructions`、ツールの呼び出しは、対話のセッションの起動の直後の依頼にも間に合った。
MCP サーバーは CLI を `npx` で取得すると初回が 30 秒を超えるため、束ねた JavaScript をプラグインに置く。

最小再現コードの要点（[#73 の diff](https://github.com/shuhei1101/mdmark/pull/73/files)）:

```jsonc
// plugin/.mcp.json
{ "mcpServers": { "mdmark": { "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server/mcp.js"] } } }
```

```jsonc
// plugin/hooks/hooks.json（session-start.mjs は hookSpecificOutput.additionalContext に索引を入れた JSON を標準出力へ書く）
{ "hooks": { "SessionStart": [ { "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/session-start.mjs"] } ] } ] } }
```

- `src/cli/mcp.ts`: `@modelcontextprotocol/sdk` の `Server` に `instructions` と `ListTools`・`CallTool` の処理を渡し、`check` は `collectCheckIssues` の一覧をそのまま返す
- `poc/build-plugin-server.mjs`: esbuild で `runMcp` を `plugin/server/mcp.js` に束ね、esbuild だけを外に出す
- `plugin/package.json`・`plugin/package-lock.json`: esbuild だけを依存に持つ。プラグインを入れたときに Claude Code が `node_modules` を作った

## テスト結果

なし
