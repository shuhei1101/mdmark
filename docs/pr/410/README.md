# E2E の使い方集の 2 ケースで、dev-docs の MCP の呼び出しが既定の時間切れで落ちないようにする

## 概要

E2E を実行する人が、『使い方集を読む』『ClaudeCodeで使い方集を参照して書き点検する』を、dev-docs の応答が遅いときも SDK の既定の時間切れで落とさずに実行できるようになる。

## 背景

[E2E の使い方集の 2 ケースで、dev-docs の MCP の呼び出しが既定の時間切れ（SdkError: Request timed out）になる](https://github.com/shuhei1101/mdmark/issues/398) の報告。
Sprint v0.10.0 の E2E（[release/v0.10.0](https://github.com/shuhei1101/mdmark/pull/393)）で、dev-docs を起動する 2 ケースの `test_normal` が `SdkError: Request timed out` で fail した。
[使い方集を dev-docs の配信元として配り、read_guide を削除して書く前の参照と書いた後の点検の動線を置く](https://github.com/shuhei1101/mdmark/pull/293) で追加した `tests/e2e/dev-docs.ts` は、`search_docs` の `client.callTool` に時間切れを指定せず、SDK の既定の待ちに頼っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
