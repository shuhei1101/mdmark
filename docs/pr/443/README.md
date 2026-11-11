# 390px の枠で描く narrow のストーリーを、390px の画面幅で横にスクロールさせない

## 概要

`frameWidth` を持つストーリーを、`frameWidth` 以下の画面幅で開いても横にスクロールしないようにする。

## 背景

[#367](https://github.com/shuhei1101/mdmark/issues/367) の要望。
`frameWidth: "390px"` を持つ narrow のストーリー（`parts-layoutcolumns--narrow`・`parts-cardgrid--narrow` など）を 390x844 の画面幅で開くと、`detect_screen_issues` が `horizontal-scroll`（`scrollWidth 430 > clientWidth 390`）を返却する。
`scripts/storybook-render.ts` がストーリーを `frameWidth` の幅の `div` で包み、Storybook の余白が加わって画面幅を超える。
[#352](https://github.com/shuhei1101/mdmark/pull/352) の実装のレビューで、対象外の逸脱として見つかった。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
