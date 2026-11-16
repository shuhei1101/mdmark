# 本文の幅とビューの E2E 4 件の fail（wide の広がり・右側の目次との重なり・狭い幅のスクロール・ビューの中の文字の選択）を修正する

## 概要

Sprint v0.10.0 の E2E で fail した wide の範囲の 3 件と、複合ユースケース『ビューで探してコメントを付ける』の 1 件を、設計と食い違っている側（実装かテスト）で修正し、release で pass させる。

## 背景

[本文の幅とビューの E2E 4 件が fail する（wide の広がり・右側の目次との重なり・狭い幅のスクロール・ビューの中の文字の選択）](https://github.com/shuhei1101/mdmark/issues/403) の要望。
Sprint v0.10.0 の E2E（[Sprint v0.10.0 の E2E 実行](https://github.com/shuhei1101/mdmark/issues/255)、release PR [release/v0.10.0](https://github.com/shuhei1101/mdmark/pull/393)）で 4 件が fail した。
wide の範囲は右側の目次の配置（[描いた文書の表示の改善 2 件（見出し 1・2 の下の区切り線・右側の目次の上端とピン止めと hover の位置）](https://github.com/shuhei1101/mdmark/pull/320)・[右側の目次の、hover で開いた目次に表のヘッダーが重なる不具合と、追従する目次の上端が見切れる不具合を修正する](https://github.com/shuhei1101/mdmark/pull/322)・[右側の目次を、ピン止めしていないときも画面の右端に配置する](https://github.com/shuhei1101/mdmark/pull/323)）と表の幅の変更（[描いた文書の表示を改善する（グラフの値のツールチップ・表の幅・図の高さのハンドル・表の列のボタン・構成図の見直し）](https://github.com/shuhei1101/mdmark/pull/308)）の後、ビューのケースは本文を `div.mdmark-content` で包む変更（[本文の右の余白に、コメントのある箇所のマーカーを出す](https://github.com/shuhei1101/mdmark/pull/277)）の後に入った E2E で fail している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | wide の範囲の 3 件とビューの 1 件の計画書 |
