# mdmark-style で、行の詳細・ステップ・ファイルツリー・バッジなど残りの mdmark の機能を Claude Code の画面に描く

## 概要

Claude Code を使用する人が、mdmark-style を入れた Claude Code の画面で、返答の行の詳細・ステップ・ファイルツリー・バッジと文字の色・キー・タブなどの中身・図と表の番号を、mdmark の共通スタイルで参照できるようになる。

## 背景

[mdmark-style で、ステップ・ファイルツリー・バッジなど残りの mdmark の機能を Claude Code の画面に描く](https://github.com/shuhei1101/mdmark/issues/702) の要望。
[mdmark-style の初回の PR](https://github.com/shuhei1101/mdmark/pull/699) は、返答の表・注意書き・見出し・コードブロック・開閉の範囲と用語のマーカーを描いた。
mod の API で描けるが要件に無かった機能（[mdmark の機能との対応](https://github.com/shuhei1101/mdmark/blob/4e2ff2643a1bb2caa39955c9a8705e88b8f672a5/docs/pr/699/ClaudeCode%E3%83%97%E3%83%A9%E3%82%B0%E3%82%A4%E3%83%B3.md) の ➕）は、[利用者の回答](https://github.com/shuhei1101/mdmark/pull/699#discussion_r4626704888) で別の Issue に切り出した。
今の mdmark-style は、これらの機能のマーカーを画面から削除するだけで、中身は Claude Code の `Markdown` 部品の描き方のまま描く。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [mdmark-style](./mdmark-style.mark.md) | 返答の描き換えに部品を追加する計画書 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | 色の名前の色を共通スタイルの定義に追加する計画書 |
