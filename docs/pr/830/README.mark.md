# タブの並びを横幅に入りきらないときに折り返さず横スクロールにし、選んだタブを見える位置へ移す

## 概要

タブが多い文書でも、読者がタブ名の並びを 1 行のまま横にスクロールして読み、選んでいるタブを並びの中で見分けられるようになる。

## 背景

[Issue #829](https://github.com/shuhei1101/mdmark/issues/829) の要望。
タブ名の並び（`.mdmark-tablist`）は [src/index.css](https://github.com/shuhei1101/mdmark/blob/69cac886/src/index.css#L2967-L2978) で `flex-wrap: wrap` のため、横幅に入りきらないタブは次の行へ折り返す。
セクション 7 つのタブの中にタブを入れ子にした資料では並びが 2〜3 行になり、本文が下へ押し下がり、どの行のどのタブを選んでいるかも見分けにくい。
[src/tabs/tabs.interact.ts](https://github.com/shuhei1101/mdmark/blob/69cac886/src/tabs/tabs.interact.ts#L103) の `select`・`choose` は、選んだタブを並びの見える位置へ移す処理を持たない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（タブ名の並びの横スクロールと、選んだタブを見える位置へ移す処理） |
