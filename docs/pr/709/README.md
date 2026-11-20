# map の手順の再生で倍率を変えず、言語が markdown のコードブロックでソースと描画した結果を切り替える

## 概要

読者が、map の図の手順を選んでも、自分で指定した倍率のまま図を読める。
読者が、言語が `markdown`（`md`）のコードブロックで、ソースの表示と描いた結果の表示を切り替えて見比べられる。

## 背景

束の親 [#708](https://github.com/shuhei1101/mdmark/issues/708) の 2 件。

- [#685](https://github.com/shuhei1101/mdmark/issues/685): map の手順の再生で手順を選ぶと、利用者が 100 % で見ていても図が拡大される。[#660](https://github.com/shuhei1101/mdmark/pull/660) で入った [src/map/band.ts](https://github.com/shuhei1101/mdmark/blob/e274e87509c421696302eefe38b4df94061f8cdb/src/map/band.ts) の `createFollow` の `reveal` が、強調するノードを囲む矩形が収まる倍率と位置へ `focusRect` で図を移している
- [#697](https://github.com/shuhei1101/mdmark/issues/697): 言語が `markdown` のコードブロックはソースの文字のまま描かれ、描いた結果を見るには同じ内容をコードブロックの外にもう一度記載する必要がある。[src/code-block/](https://github.com/shuhei1101/mdmark/tree/e274e87509c421696302eefe38b4df94061f8cdb/src/code-block) に言語 markdown を描いて切り替える処理は無い

## 計画書

| ファイル | 中身 |
| --- | --- |
| `要件.md` | 要望の整理と変更箇所の由来 |
| `ライブラリ本体.md` | 手順の再生の図の移し方と、言語 markdown のコードブロックの切り替えの計画書 |
