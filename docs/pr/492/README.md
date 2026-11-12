# プラグインの plugin.json から version を外し、develop に打ったタグで jsDelivr と VS Code 拡張機能を配る

## 概要

mdmark のプラグインを使用する人が、develop に入った変更をプラグインの更新で受け取れるようにする。
jsDelivr の配布物と VS Code 拡張機能は、スプリントの区切りに develop へ打ったタグで配る。

## 背景

[Issue #434](https://github.com/shuhei1101/mdmark/issues/434) の要望。
0.x の間は release を切らず develop だけで開発する運用（[shuhei1101/ai-monitor#3317](https://github.com/shuhei1101/ai-monitor/issues/3317)）に合わせる。

`plugin/.claude-plugin/plugin.json` が version（v0.10.0）を持つため、version を上げない限りプラグインが配布先に届かない。
jsDelivr の配布物と VS Code 拡張機能は master のタグで配っている。
未着手だった [Issue #356](https://github.com/shuhei1101/mdmark/issues/356)（ビルドの `writePluginManifest` が version を記載しないようにする）を、この Issue に統合した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
