# 表の不具合 3 件を修正する（列の幅のつまみの aria-valuenow・スマホ幅のテーブル設定のパネルの高さ・列の中身のはみ出し）

## 概要

読者が、表のセルの中身が隣の列に重ならない表を読めるようになり、折り返さない列を中身より狭くできなくなる。
列の幅のつまみが描いた直後から今の幅を支援技術へ伝え、スマホ幅で開いたテーブル設定のパネルが画面を広く覆わなくなる。

## 背景

束の親 [Issue #823](https://github.com/shuhei1101/mdmark/issues/823) の要望で、次の 3 件を 1 つの作業 PR で修正する。

- [Issue #816](https://github.com/shuhei1101/mdmark/issues/816): 列の幅のつまみ（[src/table/table.part.ts](https://github.com/shuhei1101/mdmark/blob/8258c10b/src/table/table.part.ts#L348) の `renderTableTools`）は描いた直後に `aria-valuenow` を持たず、操作を付けない描画で axe-core の `aria-required-attr` が出る。`aria-valuenow` を入れるのは操作を付ける [src/table/table-resize.interact.ts](https://github.com/shuhei1101/mdmark/blob/8258c10b/src/table/table-resize.interact.ts) だけ
- [Issue #817](https://github.com/shuhei1101/mdmark/issues/817): テーブル設定のパネル（[src/index.css](https://github.com/shuhei1101/mdmark/blob/8258c10b/src/index.css#L10146) の `.mdmark-table-settings`）は `position: fixed` で高さの上限とスクロールの指定が無く、スマホ幅（390x844）で崩れの検出の `fixed-area-height` が出る
- [Issue #812](https://github.com/shuhei1101/mdmark/issues/812): 列の既定の幅が中身より狭く描かれて隣の列に重なることがあり、列の幅のつまみで折り返さない列を中身より狭くできる。利用者が MindStella のプレビューで見つけた

#816・#817 は作業 PR [#811](https://github.com/shuhei1101/mdmark/pull/811) のレビューの崩れの検出で、対象外の逸脱として報告された。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と未確定の論点 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（列の幅の決め方とつまみ・テーブル設定のパネル） |
