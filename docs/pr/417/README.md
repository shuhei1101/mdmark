# 本文の幅とビューの E2E 4 件の fail（wide の広がり・右側の目次との重なり・狭い幅のスクロール・ビューの中の文字の選択）を修正する

## 概要

Sprint v0.10.0 の E2E で fail した wide の範囲の 3 件と、複合ユースケース『ビューで探してコメントを付ける』の 1 件を、設計と食い違っている側（実装かテスト）で修正し、release で pass させる。

## 背景

[Issue #403](https://github.com/shuhei1101/mdmark/issues/403) の要望。
Sprint v0.10.0 の E2E（[#255](https://github.com/shuhei1101/mdmark/issues/255)、release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で 4 件が fail した。
wide の範囲は右側の目次の配置（#320・#322・#323）と表の幅の変更（#308）の後、ビューのケースは本文を `div.mdmark-content` で包む変更（#277）の後に入った E2E で fail している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | wide の範囲の 3 件とビューの 1 件の計画書 |
