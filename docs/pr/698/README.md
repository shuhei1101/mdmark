# tmux の設計書の前提と実測を、手元の tmux サーバーにつながらない分け方に修正する

## 概要

tmux を使う設計書の前提と LIB-472-29 の実測を、手元の tmux のセッションの中で動かしても手元の tmux サーバーにつながらない分け方に修正し、実測を取り直す。

## 背景

[Issue #674](https://github.com/shuhei1101/mdmark/issues/674) の要望。
[PR #354](https://github.com/shuhei1101/mdmark/pull/354) の reviewer は、`TMUX_TMPDIR` を一時フォルダにして別の tmux サーバーへ分けたつもりで tmux の挙動を実測した。
tmux のセッションの中では環境変数 `TMUX` のソケットが `TMUX_TMPDIR` より優先されるため、実測は AI Monitor が使う手元の tmux サーバーで行われ、その設定を書き換えた（[shuhei1101/ai-monitor#3264](https://github.com/shuhei1101/ai-monitor/issues/3264)）。
テストのコード（`tests/integration/plugin.ts`・`terminal.ts`・`tests/unit/src/plugin/setup/server.test.ts`）は `TMUX`・`TMUX_PANE` を子プロセスへ渡さずに分けているが、設計書の前提はその削除を記載していない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
