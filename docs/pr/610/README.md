# 既存の文書を mdmark の書き方と表し方の優先順位（図 → 表 → 箇条書き → 文）に移行する

## 概要

文書を読む人が、mdmark の図・表で中身を把握できるように、既存の文書を mdmark の書き方と「図 → 表 → 箇条書き → 文」の優先順位に移行し、タグ・エイリアス・description・関連を今の規約で付け直す。

## 背景

[#290](https://github.com/shuhei1101/mdmark/issues/290) の要望。
dev-docs への移行で文書の配信は統一したが、文書の中身は Mermaid の図・文の羅列・接頭辞の無いタグ・空の description のまま残っている。
[#112](https://github.com/shuhei1101/mdmark/issues/112)（シナリオの flow を mermaid のコードブロックで囲む）は #290 に統合され、flow を map で描くと解消する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の設計書・公開ドキュメント・Schema の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の設計書の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | Claude Code プラグインの設計書の計画書 |
