# mdmark の記法で記載する文書の拡張子を .mark.md にし、純粋な .md への記法の使用を警告して、記法のルールの参照を 1 セッションに 1 回案内する

## 概要

文書の作成者が、mdmark の記法で記載する文書を拡張子 `.mark.md` で純粋な Markdown（`.md`）と区別できるようにする。
Claude Code が、純粋な `.md` には利用者の指示が無い限り記法を使用せず、`.mark.md` と「mdmark で書いて」の指示では記法のルールを参照してから記載するようにする。

## 背景

[Issue #499](https://github.com/shuhei1101/mdmark/issues/499) の要望。拡張子は検討事項 D-426 で B `hoge.mark.md` に決まった。

mdmark の記法で記載した文書と純粋な Markdown が、どちらも拡張子 `.md` でファイル名から区別できない。
Claude Code が、指示されていない純粋な Markdown に記法を使用することと、mdmark の文書を記法のルールを参照せずに記載することがある。
プラグインのフックは SessionStart と mdmark の MCP のツールへの PreToolUse だけで、Write・Edit と利用者の発言には何も伝えない。
フックの出力は [Issue #463](https://github.com/shuhei1101/mdmark/issues/463) で `permissionDecision` を付ける形に直っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
