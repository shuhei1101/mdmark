# PreToolUse のフックの出力に permissionDecision を付け、auto モードで入力を書き換えた呼び出しが拒否されないようにする

## 概要

Claude Code の auto モードで使用する文書の作成者が、プラグインのフックが作業のフォルダを入れた mdmark のツールを、拒否されずに呼べるようになる。

## 背景

[Issue #463](https://github.com/shuhei1101/mdmark/issues/463) の報告。
プラグインの PreToolUse のフック（`src/plugin/pre-tool-use.ts`、配布物の `plugin/scripts/pre-tool-use.js`）は、`updatedInput` だけを返却し、`permissionDecision` を返却していない。
Claude Code の公式の資料（[Hooks](https://code.claude.com/docs/en/hooks) の「updatedInput in auto mode」）では、auto モードで `updatedInput` を `permissionDecision` なしで返却すると、書き換えた呼び出しが拒否されうる。
インターフェース定義『作業のフォルダを引数に入れる』は、[PR #141](https://github.com/shuhei1101/mdmark/pull/141) で「`permissionDecision` を返却しない」と定めた。
利用者の指示（TH-721）で、フックを持つプラグインは必ず `permissionDecision` を付ける。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | Claude Code プラグインの計画書 |
