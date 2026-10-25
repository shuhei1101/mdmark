# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeにプラグインを入れる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.yaml) | プラグインを入れ、`installPath` の MCP サーバーを `.mcp.json` のコマンドで起動してツールの一覧を受け取る | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/使い方集を読む.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.yaml) | `read_guide` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引から文書を探す.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%81%8B%E3%82%89%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.yaml) | `find_docs` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/索引を書き換える.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.yaml) | `update_index` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeから点検と書き出しを呼ぶ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%8B%E3%82%89%E7%82%B9%E6%A4%9C%E3%81%A8%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%97%E3%82%92%E5%91%BC%E3%81%B6.yaml) | `check`・`export_html`・`build_site` のシナリオ | 追従 |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/ClaudeCodeで索引を書き換えて点検してから配る.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%A7%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%81%A6%E7%82%B9%E6%A4%9C%E3%81%97%E3%81%A6%E3%81%8B%E3%82%89%E9%85%8D%E3%82%8B.yaml) | プラグインを入れてから索引を書き換え、点検してまとめる流れ | 更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/使い方集を読む.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E4%BD%BF%E3%81%84%E6%96%B9%E9%9B%86%E3%82%92%E8%AA%AD%E3%82%80.ts.yaml) | `read_guide` の入出力 | 呼び出しを HTTP にするときに更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書を探す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92%E6%8E%A2%E3%81%99.ts.yaml) | `find_docs` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/索引を書き換える.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%B4%A2%E5%BC%95%E3%82%92%E6%9B%B8%E3%81%8D%E6%8F%9B%E3%81%88%E3%82%8B.ts.yaml) | `update_index` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/点検する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%82%B9%E6%A4%9C%E3%81%99%E3%82%8B.ts.yaml) | `check` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/文書をHTMLに書き出す.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E6%96%87%E6%9B%B8%E3%82%92HTML%E3%81%AB%E6%9B%B8%E3%81%8D%E5%87%BA%E3%81%99.ts.yaml) | `export_html` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/複数の文書を1枚のHTMLにまとめる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E8%A4%87%E6%95%B0%E3%81%AE%E6%96%87%E6%9B%B8%E3%82%921%E6%9E%9A%E3%81%AEHTML%E3%81%AB%E3%81%BE%E3%81%A8%E3%82%81%E3%82%8B.ts.yaml) | `build_site` の入出力 | 作業のフォルダの引数で更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | `createMcpServer`・`runMcpServer`（`CLAUDE_PROJECT_DIR` を読み `serveStdio` で動かす）・`TOOLS`・`ToolContext` | 更新対象 |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/フック.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%95%E3%83%83%E3%82%AF.ts.yaml) | SessionStart のフック | PreToolUse のフックを加える |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/プラグインのビルド.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%AE%E3%83%93%E3%83%AB%E3%83%89.ts.yaml) | MCP サーバーとフックを束ねて `plugin/` に書く | 束ねる入口が変わるときに更新対象 |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | 64 行目が `serveStdio(...)`。`CLAUDE_PROJECT_DIR` が無いと 1 で終わる | 更新対象 |
| 実装 | [src/plugin/tools.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/tools.ts) | `ToolContext` の `projectDir` を各ツールが使う | 作業のフォルダを引数から取る |
| 実装 | [plugin/.mcp.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/.mcp.json) | `command: node`・`args: [${CLAUDE_PLUGIN_ROOT}/server/mcp.js]` | 手で書くファイル。更新対象 |
| 実装 | [plugin/hooks/hooks.json](https://github.com/shuhei1101/mdmark/blob/develop/plugin/hooks/hooks.json) | SessionStart のフックだけ | PreToolUse のフックを加える |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/scripts/build-plugin.ts) | `plugin/server/mcp.js` と `plugin/scripts/session-start.js` を束ねる | フックの入口が増える |
| テスト | [tests/unit/src/plugin/mcp.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/mcp.test.ts) | `runMcpServer` の単体テスト | 更新対象 |
| テスト | [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | `plugin/.mcp.json` を手で書くファイルとして確かめる | 更新対象 |
| テスト | [tests/integration/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/plugin.ts) | 結合テストで MCP サーバーを子プロセスとして起動し、`StdioClientTransport` でつなぐ | 更新対象 |
| テスト | [tests/e2e/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/plugin.ts) | E2E で MCP サーバーを起動してつなぐ準備 | 更新対象 |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | `.mcp.json` のコマンドで起動したサーバーがツールの一覧を返すかを確かめる | 更新対象 |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 待ち受け | `serveStdio` をやめ、`@modelcontextprotocol/server` 2.3.1 の HTTP の待ち受け（`createMcpHandler` など）を `node:http` のサーバーにつなぎ、`127.0.0.1` の `/mcp` で待ち受ける | 使う API と `node:http` へのつなぎ方は PoC 検証とモジュール構成設計で決める |
| ポート | 起動時に `MDMARK_PORT` を読み、無ければ 8782。ポートが数値でない・使われているときは待ち受けずに理由と直し方を出して 0 以外で終わる | 決める値の出所は knowledge の規約の既定のポートの台帳 |
| 接続先 | `plugin/.mcp.json` を `type: http`・`url: http://127.0.0.1:${MDMARK_PORT:-8782}/mcp` にする | `type` の無いエントリは stdio として読まれるので必ず添える |
| 作業のフォルダ | 作業のフォルダを使うツールに、作業のフォルダの絶対パスの引数を持たせる。プラグインの PreToolUse のフックが `mcp__plugin_mdmark_mdmark__*` の呼び出しに `CLAUDE_PROJECT_DIR` の値を入れる | 引数の名前はインターフェース定義設計で決める。引数が無い呼び出しの異常系もインターフェース定義で決める |
| セッションごとの状態 | ツールの処理は呼び出しごとに引数から前提を作り、プロセスの中にセッションごとの状態を持たない | 今の `ToolContext` から `projectDir` を外す |
| 使い方集と配布物 | `read_guide` の使い方集と、書き出しに埋める配布物は、サーバーを起動したときのルートから読む | ルートの決め方は起動の入口（要件の `未確定`）で決まる |
| 既存のツール | ツールの名前・引数（作業のフォルダを除く）・戻り値・`instructions` は変えない | - |

PoC 検証で確かめること:

| 検証構成 | 成功条件 |
| --- | --- |
| `@modelcontextprotocol/server` 2.3.1 の HTTP の待ち受けを `node:http` にのせた最小のサーバー | Claude Code の実機で、`.mcp.json` の `type: http`・`url` の `${MDMARK_PORT:-8782}` の展開でつながり、並行する 2 つのセッションが同じプロセスの `tools/list`・`tools/call` を受け取る |
| プラグインの PreToolUse のフックで MCP のツールの引数を書き換える | フックが返した引数（作業のフォルダ）がサーバーのツールに届き、エージェントが書いた引数は変わらない |

## PoC 結果

結論: 成立。PoC PR は #142（検証コードの commit: [0b22e50](https://github.com/shuhei1101/mdmark/commit/0b22e50)）。

確かめた環境: Claude Code 2.1.310・Node v24.14.0・`@modelcontextprotocol/server` 2.3.1（WSL2）。

| 成功条件 | 実測値 | 判定 |
| --- | --- | --- |
| `.mcp.json` の `type: http`・`${MDMARK_PORT:-8782}` の展開でつながる | 環境変数なしのセッションが 8782 のサーバー（pid 98064）の `echo_project_dir` を呼べた。`MDMARK_PORT=18782` のセッションは 18782 のサーバー（pid 1934）を呼べた | 合格 |
| 並行する 2 つのセッションが同じプロセスの `tools/list`・`tools/call` を受け取る | 同時に起動した 2 つのセッションの戻り値の pid がどちらも 98064。8782 で待ち受けるプロセスは 1 つ | 合格 |
| フックが返した作業のフォルダがツールに届く | 戻り値の `project_dir` が、それぞれのセッションの作業のフォルダ（`wa`・`wb`）と一致した | 合格 |
| エージェントが書いた引数は変わらない | フックの記録の `tool_input` は `{"message": ...}` だけで `project_dir` を持たない。戻り値の `message` はエージェントが書いた値のまま | 合格 |
| `tools/list` に作業のフォルダの引数を出さない | `tools/list` の `inputSchema` は `message` だけ。サーバー側の検査（`checkArguments`）だけが `project_dir` を必須にした | 合格 |
| 許可の扱いが変わらない | `--permission-mode default` で、フックありとフックなしのプラグインのどちらも `permission_denials` に入って拒否された（`claude -p` ではダイアログが出ないため、拒否か通過かで記録）。`--allowedTools` で許可したときはどちらも通過 | 合格 |
| サーバーが起動していないときもセッションは使える | 18782 のサーバーを止めてセッションを開くと、`mcp_servers` の `plugin:mdmark-poc:mdmark-poc` が `failed`、他の MCP サーバーは `connected` で、応答（`1+1` → `2`）も返った | 合格 |

所感:

- フックが `permissionDecision` を返さず `updatedInput` だけを返しても、許可の判定は変わらない。拒否の記録の `tool_input` にはフックが入れた `project_dir` が載るので、許可のダイアログにも作業のフォルダが出ると見込む
- Claude Code は `updatedInput` を `tools/list` の Schema で検査し直さない（`additionalProperties: false` の Schema に `project_dir` を入れても通った）。案 B（公開の Schema にも引数を載せる）へ切り替える必要は無い
- 1 つの `McpServer` を呼び出しごとに作る `createMcpHandler` の形で、セッションごとの状態を持たずに動いた
- 計画との違い: マーケットプレイスの追加ではなく `--plugin-dir` でプラグインを読み込んだ。読み込んだ後の `.mcp.json`・`hooks.json` の扱いは同じ
- この手元の設定は `permissions.defaultMode` が `bypassPermissions` のため、許可の確かめは `--permission-mode default` で上書きして行った

検証コードの要点（`poc/mcp-http/server.ts` と `add-project-dir.mjs` の核心部）:

```ts
// 公開の Schema には project_dir を出さず、サーバーの検査だけが必須にする
const CHECKED_SCHEMA: ToolInputSchema = {
  ...PUBLISHED_SCHEMA,
  properties: { ...PUBLISHED_SCHEMA.properties, project_dir: { type: "string" } },
  required: [...PUBLISHED_SCHEMA.required, "project_dir"],
};
server.registerTool("echo_project_dir",
  { inputSchema: fromJsonSchema(PUBLISHED_SCHEMA, ACCEPT_ALL_VALIDATOR) },
  (args) => {
    const mismatch = checkArguments({ schema: CHECKED_SCHEMA, args });
    if (mismatch !== undefined) return { content: [{ type: "text", text: mismatch }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify({ pid: process.pid, args }) }] };
  });

// node:http の要求を組み込みの Request にし、Host と Origin を検査してから渡す
const handler = createMcpHandler(createPocServer);
createServer(async (req, res) => {
  const request = await toRequest({ req, port });
  const rejected =
    hostHeaderValidationResponse(request, localhostAllowedHostnames()) ??
    originValidationResponse(request, localhostAllowedOrigins());
  const response = rejected ?? (await handler.fetch(request));
  // 応答のヘッダーと本文（SSE を含む）を届いた順に書く
}).listen(port, "127.0.0.1");
```

```js
// PreToolUse のフック: permissionDecision を返さず、引数に作業のフォルダを入れて返す
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    updatedInput: { ...input.tool_input, project_dir: process.env.CLAUDE_PROJECT_DIR },
  },
}));
```

PoC PR の diff の見どころ:

- `poc/mcp-http/server.ts`: `toRequest` で `node:http` の要求を組み込みの `Request` にし、`createMcpHandler` の `fetch` へ渡す。本番の待ち受けもこの形にする
- `poc/mcp-http/marketplace/plugin/.mcp.json`: `type: http` と `${MDMARK_PORT:-8782}` の `url`
- `poc/mcp-http/marketplace/plugin/hooks/hooks.json`: PreToolUse の `matcher` をツール名で絞る。本番は `mcp__plugin_mdmark_mdmark__.*` にする

## テスト結果

未実行。
