# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/MCPサーバーを起動・停止する.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.yaml) | 正常シナリオ（起動する）の期待値は「クライアントの `tools/list` が、mdmark のツールの一覧を返す」で、ツールの個数を決めていない | 変更しない |
| テスト | [tests/e2e/単一ユースケース/MCPサーバーを起動・停止する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.spec.ts) | `test_normal_when_start` が `expect([...tools].sort()).toEqual(["build_site", "check", "export_html"])` で、ツールが 3 つちょうどであることを期待している | 期待値を変更する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `test_normal_when_start` のツールの一覧の検証 | `expect(tools).toEqual(expect.arrayContaining(["build_site", "check", "export_html"]))` にし、3 つを含むことだけを確認する | `ClaudeCodeにプラグインを入れる.spec.ts`・`端末にmdmarkをセットアップする.spec.ts` と同じ書き方。ツールの名前の全件の一致は結合テスト `tests/integration/ClaudeCodeプラグイン/serve.test.ts` と単体テスト `tests/unit/src/plugin/mcp.test.ts` が確認している |
| 他の検証 | URL・出力・待ち受け・プロセスの検証と、他のテストは変えない | - |

## テスト結果

なし
