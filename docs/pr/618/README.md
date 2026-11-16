# Mermaid の図を securityLevel: "strict" のまま描くときに、click の URL のリンクをノードのリンクにする

## 概要

文書の作成者が、部品にしない Mermaid の図（`flowchart`・`classDiagram`）に `click {ノード} href "{URL}"` を書くと、`securityLevel: "strict"` のまま、そのノードが書いた URL のリンクになる。

## 背景

[Mermaid の図を securityLevel: "strict" のまま描くときに、click の URL のリンクをノードのリンクにする](https://github.com/shuhei1101/mdmark/issues/570) の要望。
mdmark は Mermaid のコードブロックを `securityLevel: "strict"` で描き（[src/mermaid.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/mermaid.ts)）、Mermaid は `strict` で `click` を無効にするため、`click` を書いてもノードはリンクにならない。
dev-docs は設計書のクラス図の `click` の `id:` の参照を相対パスへ書き換えて mdmark に渡す（[shuhei1101/dev-docs#212](https://github.com/shuhei1101/dev-docs/pull/212)）ため、この変更を待っている。
map の構成図の `click` は [map のノードのリンク](https://github.com/shuhei1101/mdmark/issues/310) で既にノードのリンクにしており、この PR はその扱いを変えない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
