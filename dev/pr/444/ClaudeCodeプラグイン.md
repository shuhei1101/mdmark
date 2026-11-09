# Claude Code プラグイン

## 現状

<!-- table: data -->

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/端末にmdmarkをセットアップする.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%AB%AF%E6%9C%AB%E3%81%ABmdmark%E3%82%92%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97%E3%81%99%E3%82%8B.yaml) | global-setup で端末の設定を作り常駐サーバーを起動する | tmux のセッションで起動する流れだけを持つ |
| ドキュメント | [dev/設計書/シナリオ/単一ユースケース/セッションの開始で常駐サーバーの状態を受け取る.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%82%BB%E3%83%83%E3%82%B7%E3%83%A7%E3%83%B3%E3%81%AE%E9%96%8B%E5%A7%8B%E3%81%A7%E5%B8%B8%E9%A7%90%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%81%AE%E7%8A%B6%E6%85%8B%E3%82%92%E5%8F%97%E3%81%91%E5%8F%96%E3%82%8B.yaml) | SessionStart の案内と MCP の instructions | instructions が tmux のセッション名を伝える |
| ドキュメント | [dev/設計書/シナリオ/複合ユースケース/プラグインを入れて端末と文書のフォルダをセットアップする.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%B7%E3%83%8A%E3%83%AA%E3%82%AA/%E8%A4%87%E5%90%88%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3%E3%82%92%E5%85%A5%E3%82%8C%E3%81%A6%E7%AB%AF%E6%9C%AB%E3%81%A8%E6%96%87%E6%9B%B8%E3%81%AE%E3%83%95%E3%82%A9%E3%83%AB%E3%83%80%E3%82%92%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97%E3%81%99%E3%82%8B.yaml) | プラグインを入れて global-setup・setup を通す流れ | 期待値が tmux のセッションを前提にする |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/常駐サーバーを起動する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E5%B8%B8%E9%A7%90%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%81%99%E3%82%8B.ts.yaml) | setup.js start-server | tmux の new-session で起動する |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/端末の状態を調べる.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E7%AB%AF%E6%9C%AB%E3%81%AE%E7%8A%B6%E6%85%8B%E3%82%92%E8%AA%BF%E3%81%B9%E3%82%8B.ts.yaml) | setup.js status | tmux のセッション名と tmux の有無を返す |
| ドキュメント | [dev/設計書/インターフェース定義/ClaudeCodeプラグイン/MCPサーバーを起動・停止する.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%83%95%E3%82%A7%E3%83%BC%E3%82%B9%E5%AE%9A%E7%BE%A9/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC%E3%82%92%E8%B5%B7%E5%8B%95%E3%83%BB%E5%81%9C%E6%AD%A2%E3%81%99%E3%82%8B.ts.yaml) | mdmark serve と instructions | instructions が tmux のセッションを伝える |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/セットアップ/起動.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97/%E8%B5%B7%E5%8B%95.ts.yaml) | start-server の tmux の起動と待ち受けの確かめ | - |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/セットアップ/状態.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97/%E7%8A%B6%E6%85%8B.ts.yaml) | status の結果 | - |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/セットアップ/パス.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97/%E3%83%91%E3%82%B9.ts.yaml) | 状態の置き場所と tmux のセッション名 | - |
| ドキュメント | [dev/設計書/モジュール構成/ClaudeCodeプラグイン/MCPサーバー.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E3%83%A2%E3%82%B8%E3%83%A5%E3%83%BC%E3%83%AB%E6%A7%8B%E6%88%90/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/MCP%E3%82%B5%E3%83%BC%E3%83%90%E3%83%BC.ts.yaml) | MCP サーバーの instructions | - |
| ドキュメント | [dev/設計書/設定/ClaudeCodeプラグイン.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E8%A8%AD%E5%AE%9A/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3.yaml) | MDMARK_PORT・MDMARK_STATE_DIR など | MDMARK_STATE_DIR を tmux のセッションへ渡すと書いている |
| ドキュメント | [dev/設計書/外部ライブラリ/tmux.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev/%E8%A8%AD%E8%A8%88%E6%9B%B8/%E5%A4%96%E9%83%A8%E3%83%A9%E3%82%A4%E3%83%96%E3%83%A9%E3%83%AA/tmux.yaml) | tmux のセッションの確かめ・起動・閉じる操作 | systemd の外部ライブラリの設計書は無い |
| 実装 | [plugin/skills/global-setup/SKILL.md](https://github.com/shuhei1101/mdmark/blob/develop/plugin/skills/global-setup/SKILL.md) | global-setup の手順 | tmux の起動を前提にした手順と報告 |
| 実装 | [src/plugin/setup/server.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/setup/server.ts) | startServer | - |
| 実装 | [src/plugin/setup/status.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/setup/status.ts) | status | - |
| 実装 | [src/plugin/setup/paths.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/setup/paths.ts) | 状態の置き場所とセッション名 | - |
| 実装 | [src/plugin/mcp.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/mcp.ts) | MCP の instructions | - |
| 実装 | [src/plugin/session-start.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/plugin/session-start.ts) | SessionStart のフック | - |
| テスト | [tests/integration/ClaudeCodeプラグイン/setup-start-server.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3/setup-start-server.test.ts) | start-server の結合テスト | 一時の TMUX_TMPDIR で手元の tmux と分ける |
| テスト | [tests/e2e/単一ユースケース/端末にmdmarkをセットアップする.spec.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/e2e/%E5%8D%98%E4%B8%80%E3%83%A6%E3%83%BC%E3%82%B9%E3%82%B1%E3%83%BC%E3%82%B9/%E7%AB%AF%E6%9C%AB%E3%81%ABmdmark%E3%82%92%E3%82%BB%E3%83%83%E3%83%88%E3%82%A2%E3%83%83%E3%83%97%E3%81%99%E3%82%8B.spec.ts) | global-setup の E2E | - |

<!-- /table -->

## 変更方針

<!-- table: data -->

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 起動の方法の選び方 | systemd --user が使える端末では unit、使えない端末では tmux で起動する。端末の設定のキーでどちらかに固定できる | [確認ログ](./確認ログ.yaml) |
| unit の起動 | `~/.config/systemd/user/{サービス名}.service` に `mdmark serve` の unit を書き、`systemctl --user daemon-reload` の後に `enable --now` で起動する。環境変数は unit の `Environment=` に書く | サービス名と、unit を書き換えたときの再起動の仕方は設計で決める |
| 待ち受けの確かめ | 今の `startServer` と同じく、1 秒ごとにポートへつなぎ直し、上限 120 秒で待つ。待ち受けた後に `tools/list` を確かめる | - |
| 既にあるとき | unit が active で待ち受けていれば起動しない。待ち受けていなければ `restart` する。tmux のセッションで動いている常駐サーバーは閉じてから unit を起動する | - |
| 状態・報告 | `status`・`start-server` の結果に起動の方法・ログの見方・止め方を出し、MCP の `instructions` と `global-setup` の報告もそれに合わせる | - |
| 外部ライブラリ | systemd（`systemctl --user`・`journalctl --user`）の外部ライブラリの設計書を足す | - |
| テスト | 結合テスト・E2E で手元の systemd --user の常駐サーバー（8782）と unit を壊さないよう、テスト専用のサービス名とポートで確かめる | 確かめ方は設計で決める |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 複合ユースケース設計 | `18a6fb8c1..3f9d8a695` | 単一ユースケース設計と同じ commit |
| 単一ユースケース設計 | `18a6fb8c1..3f9d8a695` | 起動の方法の選び方は推奨の案 A で書いた |
| 単一ユースケース設計 | `32972d435..fcc6c673c` | レビューの指摘の修正 |
| インターフェース定義設計 | `1d128ef37..8462a0e8c` | 設定（serve.launcher・serve.systemdUnit・MDMARK_LAUNCHER）と外部ライブラリ systemd を含む |
| インターフェース定義設計 | `da5dbcf23..327596319` | レビューの指摘の修正 |
| モジュール構成設計 | `2ed905357..27cf4f0b9` | 引数の tmux で unit が動いていれば already_running を返す形をインターフェース定義にも反映 |
