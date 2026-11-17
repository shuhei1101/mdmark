# Mermaid の図を securityLevel: "strict" のまま描くときに、click の URL のリンクをノードのリンクにする

## 概要

文書の作成者が、部品にしない Mermaid の図（`flowchart`・`classDiagram`）に `click {ノード} href "{URL}"` を書くと、`securityLevel: "strict"` のまま、そのノードが書いた URL の `href` を持つリンクになる。

## 背景

[Mermaid の図を securityLevel: "strict" のまま描くときに、click の URL のリンクをノードのリンクにする](https://github.com/shuhei1101/mdmark/issues/570) の要望。
mdmark は Mermaid のコードブロックを `securityLevel: "strict"` で描く（[src/mermaid.ts](https://github.com/shuhei1101/mdmark/blob/develop/src/mermaid.ts)）。
Issue は「`strict` で `click` が無効になりノードがリンクにならない」としているが、実測では `strict` で無効になるのはコールバックだけで、URL の行のノードは Mermaid が `xlink:href` だけを持つ SVG の `<a>` で囲む（[計画書の実測](./ライブラリ本体.md)）。
`href` 属性が無いため、本文の `a[href]` のクリックを拾う dev-docs はこのリンクを受け取れない。
dev-docs は設計書のクラス図の `click` の `id:` の参照を相対パスへ書き換えて mdmark に渡す（[shuhei1101/dev-docs#212](https://github.com/shuhei1101/dev-docs/pull/212)）ため、この変更を待っている。
map の構成図の `click` は [map のノードのリンク](https://github.com/shuhei1101/mdmark/issues/310) で既にノードのリンクにしており、この PR はその扱いを変えない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
