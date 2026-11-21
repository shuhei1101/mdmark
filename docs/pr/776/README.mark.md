# MCP サーバーとスキルの設計書を knowledge のテンプレートで作成し、実装を設計書に合わせる

## 概要

Claude Code プラグインの MCP サーバーとスキルに、knowledge のテンプレートに沿った設計書を作成し、実装を設計書に合わせる。

## 背景

[Issue #775](https://github.com/shuhei1101/mdmark/issues/775) の要望。
[shuhei1101/ai-monitor#3743](https://github.com/shuhei1101/ai-monitor/issues/3743) で、AI Monitor の設計の工程に「エージェント・MCP サーバー設計」「エージェントフロー・LLM 呼び出し設計」が入った。
このリポジトリの MCP サーバー（`mdmark serve`）とスキル（`global-setup`・`setup`）には、シナリオ・インターフェース定義・モジュール構成はあるが、テンプレート `template-mcp-server`・`template-agent-flow` に沿った設計書が無い。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.mark.md) | Claude Code プラグインの計画書 |
| [反映作業](./反映作業/index.yaml) | 反映作業の一覧 |
