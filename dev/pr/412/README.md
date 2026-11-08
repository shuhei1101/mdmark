# 図の操作と表示の E2E 8 件の fail を修正する（ノードのリンク・グラフの項目の上のドラッグ・mermaid の拡大率・ツールチップ・凡例）

## 概要

図を参照する人が、リンクを持つノードやグラフの項目の上からでも図をドラッグで動かせ、mermaid の図・ツールチップ・凡例・グループのタイトルをシナリオどおりに見られるようにする。

## 背景

[Issue #400](https://github.com/shuhei1101/mdmark/issues/400) の報告。
Sprint v0.10.0 の E2E（release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で図の部品の 8 件が fail した。
原因は未確定で、図の部品に触れた [#253](https://github.com/shuhei1101/mdmark/pull/253)・[#263](https://github.com/shuhei1101/mdmark/pull/263)・[#268](https://github.com/shuhei1101/mdmark/pull/268)・[#275](https://github.com/shuhei1101/mdmark/pull/275)・[#281](https://github.com/shuhei1101/mdmark/pull/281)・[#298](https://github.com/shuhei1101/mdmark/pull/298)・[#308](https://github.com/shuhei1101/mdmark/pull/308)・[#328](https://github.com/shuhei1101/mdmark/pull/328)・[#382](https://github.com/shuhei1101/mdmark/pull/382) が候補になる。
修正は release へ入れ、E2E 実行 [#255](https://github.com/shuhei1101/mdmark/issues/255) で実行し直す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と fail したケースごとの終わりの条件 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
