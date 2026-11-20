# 既存の文書の文を削って『文章の書き方』で点検し、エイリアスと用語を登録する

## 概要

文書を参照する人とエージェントが、短い文と統一した呼び名で中身を把握できるように、既存の文書の文を削って規約『文章の書き方』で点検し、設計書のエイリアスと用語集の用語を登録する。

## 背景

[#612](https://github.com/shuhei1101/mdmark/issues/612) の要望。
[#290](https://github.com/shuhei1101/mdmark/issues/290) の作業 PR [#610](https://github.com/shuhei1101/mdmark/pull/610) の要件のうち、文書ごとに文を参照して判断する 2 つを、ユーザーの判断（[確認事項](https://github.com/shuhei1101/mdmark/pull/610#discussion_r4583826062)・推奨案 B）で切り出した。
#610 で移行の規則（map 化・リンク化・1 文 1 行・タグと description の付け直し）を適用した後の文書が対象になる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の設計書・公開ドキュメント・配信の設定の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.mark.md) | VS Code 拡張機能の設計書の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.mark.md) | Claude Code プラグインの設計書の計画書 |
