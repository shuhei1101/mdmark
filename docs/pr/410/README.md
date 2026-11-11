# E2E の使い方集の 2 ケースで、dev-docs の MCP の呼び出しが既定の時間切れで落ちないようにする

## 概要

E2E を実行する人が、『使い方集を読む』『ClaudeCodeで使い方集を参照して書き点検する』を、dev-docs の応答が遅いときも SDK の既定の時間切れで落とさずに実行できるようになる。

## 背景

[Issue #398](https://github.com/shuhei1101/mdmark/issues/398) の報告。
Sprint v0.10.0 の E2E（[release PR #393](https://github.com/shuhei1101/mdmark/pull/393)）で、dev-docs を起動する 2 ケースの `test_normal` が `SdkError: Request timed out` で fail した。
[PR #293](https://github.com/shuhei1101/mdmark/pull/293) で追加した `tests/e2e/dev-docs.ts` は、`search_docs` の `client.callTool` に時間切れを指定せず、SDK の既定の待ちに頼っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
