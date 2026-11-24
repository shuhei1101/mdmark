# 表のセルの中の動画をモーダルで再生できるようにし、段落の動画にもモーダルで再生する属性を追加する

## 概要

読者が、表のセルの中に埋め込んだ動画をモーダルで再生できるようになる。
文書の作成者が、段落に記載した動画も属性の指定で、その場に再生バーを出さずにモーダルで再生させられるようになる。

## 背景

[Issue #800](https://github.com/shuhei1101/mdmark/issues/800) の要望。
aituber の動画作成で、動画作成ノードが素材 15 件の確認用の動画を表のセルに埋め込み、利用者が 1 件も再生できなかった。
動画のファイルと配信は正常だった。

今の `buildImageFigures`（[src/media/image.syntax.ts](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/src/media/image.syntax.ts)）は段落（`paragraph_open`）の中の画像だけを動画・音声にし、表のセルの中の `![名前](パス.mp4)` は `img` のまま出力する。
部品設計『動画と音声』（[CMP-472-36](https://github.com/shuhei1101/mdmark/blob/de9f7a458626b27d09ae0546a7f6c916cc4797d0/docs/component/CMP-472-36.ts.yaml)）にも、表のセルの中の動画・音声の扱いの記載は無い。
画像は、押すと全画面のダイアログで拡大するライトボックス（[#199](https://github.com/shuhei1101/mdmark/issues/199)）を持つ。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と未確定の論点 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.mark.md) | VS Code 拡張機能の計画書（プレビューの動画の読み込み） |
