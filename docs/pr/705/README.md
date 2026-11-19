# 表の見出し行を、mount・VS Code のプレビュー・スクロールする区画の中でも、全ての表で同じ位置に留める

## 概要

読者が、`mount`・VS Code 拡張機能のプレビュー・CLI の書き出しのどれで描いた文書でも、表の種類と機能の指定によらず、全ての表の見出し行が留まった状態で表を確認できる。
スクロールする区画の中に描いた文書でも、どのブラウザでも見出し行が同じ位置に留まる。

## 背景

[#683](https://github.com/shuhei1101/mdmark/issues/683) の報告。統合した [#675](https://github.com/shuhei1101/mdmark/issues/675)（VS Code 拡張機能のプレビューで見出し行が留まらない）を含む。

- `mount` は本文を `div.mdmark-content` に包み、[src/table/table-sticky.interact.ts](https://github.com/shuhei1101/mdmark/blob/feeade114e8ec6c06018ece012d121cae1a22136/src/table/table-sticky.interact.ts) の `attachStickyRows` はその要素に `data-mdmark-sticky` を付ける。[src/index.css](https://github.com/shuhei1101/mdmark/blob/feeade114e8ec6c06018ece012d121cae1a22136/src/index.css) の見出し行の規則は `.mdmark[data-mdmark-sticky=...]` を参照するため、`mount` で描いた表では見出し行が留まらない。VS Code のプレビューも `mount` で描くため同じ症状になる
- スクロールする区画の中では、`timeline`（Chromium）は区画の上端を、`script`（Firefox）は画面の上端を基準にするため、`--mdmark-sticky-top` を 1 つの値にしても両方を同じ位置に統一できない
- 利用者は [shuhei1101/mindstella#591 のスレッド](https://github.com/shuhei1101/mindstella/pull/591#discussion_r4616572444) で、表の種類・機能の指定・描き方によらず常に見出し行を固定し、固定されない表がある前提の記述・設定も修正するよう指示した
- 後続の [shuhei1101/mindstella#591](https://github.com/shuhei1101/mindstella/pull/591) が、この対応の後に本文の表の見出し行の固定を mdmark に任せる

## 計画書

| ファイル | 中身 |
| --- | --- |
| `要件.md` | 要望の整理と変更箇所の由来 |
| `ライブラリ本体.md` | 見出し行を留める処理・CSS・設計書の計画書 |
| `VS Code 拡張機能.md` | プレビューで見出し行が留まることの確認の計画書 |
