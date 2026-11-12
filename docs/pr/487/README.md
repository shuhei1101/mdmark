# モック ui-canvas/80/side-by-side の列ごとのランドマークに列の名前を付け、axe の landmark-unique を無くす

## 概要

モック `docs/mock/pages/ui-canvas/80/side-by-side/` で、列ごとに並ぶ同じ role・同じ名前のランドマークを列の名前で区別し、axe の `landmark-unique` の検出を無くす。

## 背景

[Issue #425](https://github.com/shuhei1101/mdmark/issues/425) の要望。
作業 PR [#424](https://github.com/shuhei1101/mdmark/pull/424) のモックのレビューで、reviewer が対象外の逸脱として報告した（[報告](https://github.com/shuhei1101/mdmark/pull/424#discussion_r4507303693)）。
`app.js` は `[data-canvas]` のセクションごとに列を作って列ごとに同じ Markdown と設定で `mount` を呼び、HTML の見本（`template`）も列ごとに同じ要素を写すため、目次・関連文書の nav、箇所が見つからないコメントの section、`nav.mdmark-doc-list` が同じ名前で列の数だけ並ぶ。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
