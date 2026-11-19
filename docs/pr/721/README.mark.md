# map のノードの名前の幅の見積もりを描いたフォントの幅に合わせ、pill の形状の左の余白を見積もりに入れる

## 概要

map の構成図・状態遷移図で、ノードの大きさの見積もりの名前の幅と左右の余白を描画に合わせ、ノードが名前の行の数に合った幅と高さで描かれるようにする。

## 背景

[Issue #720](https://github.com/shuhei1101/mdmark/issues/720) の要望。[PR #719](https://github.com/shuhei1101/mdmark/pull/719)（起点 [Issue #718](https://github.com/shuhei1101/mdmark/issues/718)）のスコープ外から切り出した。

`src/map/layout.ts` の `textWidth`・`splitLines` は、全角でない文字を文字の大きさの 0.6 倍の幅とみなす。
Chromium では「文書の Markdown」の見積もりが 117.6px、描画が 129px になる。
フォントによっては見積もりより狭く描かれ、Windows の Edge では「注文の明細を月ごとに集計する」が幅 220px で 1 行に収まり、2 行を見込んだ高さ 83px の下が空く。
`pill` の形状のノードは `src/index.css` で左の余白が 16px だが、`sizeLeaf` は左の余白を `LABEL_METRICS.padX`（10px）で見積もる。
#719 は右の余白 28px と枠線を見積もりに入れ、`src/map/flow-view.ts` の `measure` が中身の入る高さにする修正で、見積もりの精度は扱っていない。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
