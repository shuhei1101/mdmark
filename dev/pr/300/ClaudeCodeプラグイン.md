# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/MCPサーバーを起動・停止する.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.yaml) | 起動する・止める・ポートが使われているの各シナリオが 8782 で起動し、ポートを上書きするシナリオが「8782 では待ち受けない」を期待値に持つ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/ClaudeCodeにプラグインを入れる.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.yaml) | 常駐サーバーが 8782 で待ち受けている・待ち受けていないことをセットアップに持ち、事前条件に 8782 を持つ | 更新対象 |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/MCPサーバーを起動してプラグインからつなぐ.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%97%E3%81%A6%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%8B%E3%82%89%E3%81%A4%E3%81%AA%E3%81%90.yaml) | 期待値「既定のポート 8782 で待ち受けるプロセスが 1 つだけある」と、セットアップ・事前条件に 8782 を持つ | 更新対象 |
| テスト | [tests/e2e/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/plugin.ts) | `DEFAULT_PORT`（8782）と、既定のポートを使うテストの間で譲り合うロック `lockDefaultPort` を持つ。`withMcpClient` は `serverUrl` を省くと空きポートで `mdmark serve` を起動する | `DEFAULT_PORT` と `lockDefaultPort` を削除 |
| テスト | [tests/e2e/単一ユースケース/MCPサーバーを起動・停止する.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.spec.ts) | `MDMARK_PORT` を指定せず起動するケースと、8782 を別のプロセスで塞ぐケースがある。全ケースが `isListening(DEFAULT_PORT)` を確認する | 空きポートに置き換え |
| テスト | [tests/e2e/単一ユースケース/ClaudeCodeにプラグインを入れる.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/ClaudeCode%E3%81%AB%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%82%8B.spec.ts) | `.mcp.json` の接続先が `http://127.0.0.1:8782/mcp` に展開されることと、8782 で待ち受けていないことを確認する | 空きポートに置き換え |
| テスト | [tests/e2e/複合ユースケース/MCPサーバーを起動してプラグインからつなぐ.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%97%E3%81%A6%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%81%8B%E3%82%89%E3%81%A4%E3%81%AA%E3%81%90.spec.ts) | 既定のポートで起動し、`isListening(DEFAULT_PORT)` を確認する | 空きポートに置き換え |
| テスト | [tests/unit/src/plugin/http.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/http.test.ts) | `test_read_port` が `MDMARK_PORT` の無いときに既定のポートを返すことを確認する | 変更しない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| E2E の共通の準備 | `tests/e2e/plugin.ts` から `DEFAULT_PORT`・`DEFAULT_PORT_LOCK`・`lockDefaultPort`・ロックの間隔と上限の定数を削除する | 空きポートは `findFreePort` で取得する |
| 『MCPサーバーを起動・停止する』の E2E | 全ケースで `MDMARK_PORT` に `findFreePort` の空きポートを指定して起動し、待ち受けの有無はそのポートで確認する。ポートが使われているケースは、空きポートを別のプロセスで塞いでから同じポートを `MDMARK_PORT` に指定する | 正常シナリオ（起動する）の扱いは要件の `未確定` |
| 『MCPサーバーを起動・停止する』のシナリオ | セットアップ・フロー・期待値の 8782 を「`MDMARK_PORT` に指定した空きポート」に置き換え、ポートを上書きするシナリオの「8782 では待ち受けない」を削除する | 手元の `mdmark serve` が 8782 で待ち受けていると成り立たないため |
| 『ClaudeCodeにプラグインを入れる』の E2E とシナリオ | 常駐サーバーを空きポートで起動し、`.mcp.json` の接続先をそのポートの `MDMARK_PORT` で展開して確認する。異常シナリオは、起動していない空きポートを `MDMARK_PORT` に指定して接続を拒否されることを確認する | `.mcp.json` の `${MDMARK_PORT:-8782}` の記載は変えない |
| 『MCPサーバーを起動してプラグインからつなぐ』の E2E とシナリオ | 常駐サーバーを空きポートで起動し、期待値「待ち受けるプロセスが 1 つだけある」をそのポートで確認する。事前条件・セットアップの 8782 を同じく置き換える | - |
| テスト実行方法 | E2E テストの前提に、どのケースも 8782 を使わないこと（手元の `mdmark serve` が使う）を追加する | 結合テストの前提と同じ記載 |

## テスト結果

なし
