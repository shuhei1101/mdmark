# 比較中に右側の目次の変わったセクションにマーカーを出し、長文の列に表の並べ替えを既定で付けない

## 概要

比較元を指定して文書を描いた読者が、右側の目次で比較元から変わったセクションを見分けられる。
表の説明文のような長文の列には並べ替えが付かず、短い値の列だけを並べ替えられる。

## 背景

[Issue #549](https://github.com/shuhei1101/mdmark/issues/549) の束で、[Issue #518](https://github.com/shuhei1101/mdmark/issues/518) と [Issue #526](https://github.com/shuhei1101/mdmark/issues/526) の要望。

- #518: dev-docs の文書の画面は独自の目次を削除して mdmark の右側の目次だけを使用する（[shuhei1101/dev-docs#88](https://github.com/shuhei1101/dev-docs/issues/88)）。独自の目次は比較中に変わったセクションの見出しにマーカーを出していたが、`src/interact/side-toc.ts` は `baseMarkdown` の色分けを扱わず、長い文書では変わったセクションを本文をスクロールして探すことになる
- #526: `src/render/syntax/tables.ts` は data の表の既定の機能に `sort` を含め、列の中身によらず全ての列の見出しに並べ替えのボタンを付ける。説明文のような長文の列を並べ替えることは無い

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
