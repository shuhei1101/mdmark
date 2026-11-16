# 図の操作と表示の E2E 8 件の fail を修正する（ノードのリンク・グラフの項目の上のドラッグ・mermaid の拡大率・ツールチップ・凡例）

## 概要

図を参照する人が、リンクを持つノードやグラフの項目の上からでも図をドラッグで動かせ、mermaid の図・ツールチップ・凡例・グループのタイトルをシナリオどおりに見られるようにする。

## 背景

[図の操作と表示の E2E 8 件が fail する（ノードのリンク・グラフの項目の上のドラッグ・mermaid の拡大率・ツールチップ・凡例）](https://github.com/shuhei1101/mdmark/issues/400) の報告。
Sprint v0.10.0 の E2E（release PR [release/v0.10.0](https://github.com/shuhei1101/mdmark/pull/393)）で図の部品の 8 件が fail した。
原因は未確定で、図の部品に触れた [図の表示する枠の高さを、36rem の上限を超えて図の全体が収まる高さまで広げられるようにする](https://github.com/shuhei1101/mdmark/pull/253)・[表の列と行を名前の色で強調し、画像・動画・GIF・音声・リンクと添付のカードを描けるようにする](https://github.com/shuhei1101/mdmark/pull/263)・[フロー図の部品に、判定フローチャートの「質問」「結果」のノードの種類を追加する](https://github.com/shuhei1101/mdmark/pull/268)・[既存の記法・点検への項目の追加 6 件（グラフの種類・表のセルの結合・図の定義の点検・タブの入れ子・注意書きのタイトル・コードの折りたたみ）](https://github.com/shuhei1101/mdmark/pull/275)・[部品の操作の不具合を修正する（タッチ端末の図のツールチップ・Firefox の用語のツールチップ・拡大した図のドラッグ）](https://github.com/shuhei1101/mdmark/pull/281)・[ER 図の部品を追加する（テーブル・列・関係を定義から描く）](https://github.com/shuhei1101/mdmark/pull/298)・[描いた文書の表示を改善する（グラフの値のツールチップ・表の幅・図の高さのハンドル・表の列のボタン・構成図の見直し）](https://github.com/shuhei1101/mdmark/pull/308)・[既存の記法・点検への項目の追加 4 件（フロー図の自動配置・記法の点検・コードブロックの折り返し・フロー図のノードのリンク）](https://github.com/shuhei1101/mdmark/pull/328)・[mermaid のコードブロックを VS Code 拡張機能と HTML の書き出しで描く](https://github.com/shuhei1101/mdmark/pull/382) が候補になる。
修正は release へ入れ、E2E 実行 [Sprint v0.10.0 の E2E 実行](https://github.com/shuhei1101/mdmark/issues/255) で実行し直す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と fail したケースごとの終わりの条件 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
