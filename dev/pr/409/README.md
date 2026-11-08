# E2E の 9 件の期待値と準備を、後の PR が変えた出力に合わせる

## 概要

Sprint v0.10.0 の E2E で fail した 9 件のケースを、後の PR が変えた今の出力とテストの準備に合わせ、release で pass させる。

## 背景

[Issue #397](https://github.com/shuhei1101/mdmark/issues/397) の要望。
Sprint v0.10.0 の E2E（[#255](https://github.com/shuhei1101/mdmark/issues/255)、release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で 9 件が fail した。
9 件とも描いた結果はシナリオどおりで、後から入った PR が出力を変えたのにテストの期待値が追従していないか、テストを足した PR の準備が足りない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の E2E 4 件とシナリオ『コードブロックを飾る』の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の E2E 3 件の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | Claude Code プラグインの E2E 2 件の計画書 |
