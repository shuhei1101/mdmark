# 表の列の幅のつまみの押せる範囲を 24px 以上にし、列の並べ替えにドラッグをしない操作を用意し、表の操作のバーで表の高さが増えないようにする

## 概要

読者が、表の列の幅を、ポインターの種類によらず 24 x 24 CSS px 以上のつまみから変えられるようになる。
テーブル設定の列の並べ替えを、ドラッグをせずにクリック・タップだけで操作できるようになる。
表の操作のバー（件数・テーブル設定・集計・コピー）で表の高さが増えなくなる。

## 背景

[Issue #810](https://github.com/shuhei1101/mdmark/issues/810) の要望。
表の列の幅のつまみ（[src/index.css](https://github.com/shuhei1101/mdmark/blob/7c771731/src/index.css) の `.mdmark-table .mdmark-col-resize`・[src/table/table-resize.interact.ts](https://github.com/shuhei1101/mdmark/blob/7c771731/src/table/table-resize.interact.ts)）の押せる幅は 12px で、24px にするのは `@media (pointer: coarse)` の中だけ。
列の幅を変える操作はポインターではドラッグだけで、knowledge の規約『レイアウト』『操作とアクセシビリティ』と WCAG 2.2 の 2.5.7 から逸脱している。

作業 PR [#809](https://github.com/shuhei1101/mdmark/pull/809)（起点 [Issue #808](https://github.com/shuhei1101/mdmark/issues/808)）の現状調査で見つかった。
#809 は図の枠のリサイズハンドルを下端の 24px の帯にし、ドラッグの代わりの操作は今のダブルクリック（全体が収まる高さにする）のままにした。

同じ規約の同じ型の箇所として、テーブル設定のパネルの列の並べ替え（[src/table/table-settings.interact.ts](https://github.com/shuhei1101/mdmark/blob/7c771731/src/table/table-settings.interact.ts)）もポインターではドラッグだけで操作する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と未確定の論点 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（表の列の幅のつまみ・列の並べ替え・表の操作のバー） |
