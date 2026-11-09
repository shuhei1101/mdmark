# プラグインの global-setup で MCP の常駐サーバーを systemd --user の unit で起動できるようにする

## 概要

文書を書く人が `global-setup` を呼ぶと、MCP の常駐サーバー（`mdmark serve`）を規約『ローカルサーバーの立て方』の systemd --user の unit で起動でき、端末の起動時にも自動で起動する。

## 背景

[Issue #366](https://github.com/shuhei1101/mdmark/issues/366) の要望。
[#165](https://github.com/shuhei1101/mdmark/issues/165)（[#354](https://github.com/shuhei1101/mdmark/pull/354)）で、`global-setup` は常駐サーバーを tmux のセッション（既定 `mdmark-mcp`）で起動するようにした。
規約『ローカルサーバーの立て方』は、必ず動いていてほしい常駐サーバーを systemd --user の unit で起動し、WSL の起動時に自動で起動すると定めている。
#354 では tmux を既定にし、systemd --user に合わせるかは tmux の起動が入った後に決めることにしてスコープ外に残した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグイン（スキル・常駐サーバーの起動・状態・MCP の説明文・SessionStart の案内）の計画書 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体（端末の設定のキーと移行）の計画書 |
