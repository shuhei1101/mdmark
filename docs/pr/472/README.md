# dev/ を廃止して文書を docs/ 1 つにまとめ、ai-monitor#3307 と同じ構成へ移す

## 概要

`dev/` を廃止して文書を `docs/` 1 つにまとめ、[shuhei1101/ai-monitor#3307](https://github.com/shuhei1101/ai-monitor/pull/3307) と同じ構成（種類だけのフォルダ・フラットな中身・Schema は `schemas/`・公開範囲は各文書の `visibility`）へ移す。

## 背景

[#454](https://github.com/shuhei1101/mdmark/issues/454) の要望。
ai-monitor#3307 の要件「AI Monitor 自身以外の全ての監視対象のプロジェクトも、この PR と同じ構成へ移す。」による。
ai-monitor#3307 はマージ済みで、`dev/` が残る間は `python -m ai_monitor.design_docs` の設計書の検証・Markdown の生成が動かない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
