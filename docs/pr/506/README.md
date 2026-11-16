# 設計書の記法の説明の icon:名前 を、mdmark の点検で書き方の警告にならない書き方に修正する

## 概要

単一ユースケース『リンクをカードの格子に並べる』の補足に記載したアイコンの記法の説明を、mdmark の点検で書き方の警告（`syntax_warning`）にならない書き方に修正する。

## 背景

[設計書『リンクをカードの格子に並べる』の notes の icon:名前 が、mdmark の点検で syntax_warning になる](https://github.com/shuhei1101/mdmark/issues/456) の要望。
シナリオの `notes.項目の記載方法` の `` `icon:名前` `` を mdmark v0.10.0 の `check --text -` で点検すると、`名前` が Lucide のアイコンの名前でないため書き方の警告になる。
knowledge の設計書のスキーマの `$defs/markdown` に `contentMediaType: text/markdown` が入り（[schemas/ の設計書の本文の型に contentMediaType を追加し、プロンプトの kind にエージェントのシステムプロンプトを追加して、prompt・common・files の文言を対応表に合わせる](https://github.com/shuhei1101/knowledge/pull/240)）、dev-docs の `write_docs` はこの値を書き換えたときに書き込みを止める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
