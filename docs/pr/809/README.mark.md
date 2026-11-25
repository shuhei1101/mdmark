# 図の枠のリサイズハンドルの押せる範囲を 24px 以上にし、部品『media』のモックのスクリプトのエラーを修正する

## 概要

読者が、図の表示する枠の高さを、表示する枠の下の高さ 24 CSS px の帯のリサイズハンドルから変えられるようになる。
部品『media』のモックを、スクリプトのエラーを出さずに開けるようになる。

## 背景

束の親 [Issue #808](https://github.com/shuhei1101/mdmark/issues/808) の子 2 件の要望。

- [Issue #806](https://github.com/shuhei1101/mdmark/issues/806): 図の枠のリサイズハンドル（[src/diagram/diagram-resize.interact.ts](https://github.com/shuhei1101/mdmark/blob/5cf2959a/src/diagram/diagram-resize.interact.ts)・[src/index.css](https://github.com/shuhei1101/mdmark/blob/5cf2959a/src/index.css) の `.mdmark-diagram-resize`）は 28×16 の札で、押せる範囲の高さが 24px に足りない。高さを変える操作はポインターではドラッグとダブルクリックだけで、knowledge の規約『レイアウト』『操作とアクセシビリティ』と WCAG 2.2 の 2.5.7 から逸脱している。作業 PR [#805](https://github.com/shuhei1101/mdmark/pull/805) は、同じ見た目にした動画のリサイズハンドルだけを、押せる範囲 24×24 と、押すと開く大きさのメニューに修正した
- [Issue #807](https://github.com/shuhei1101/mdmark/issues/807): [docs/mock/refs/263/assets/media.js](https://github.com/shuhei1101/mdmark/blob/5cf2959a/docs/mock/refs/263/assets/media.js) の 150〜152 行目が、部品『media』のモック（[docs/mock/components/media/index.html](https://github.com/shuhei1101/mdmark/blob/5cf2959a/docs/mock/components/media/index.html)）のライトボックスに無い拡大・縮小・全体のボタンを探し、開いたときにスクリプトのエラーになる。#805 のモック作成の崩れの検出で見つかった

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と未確定の論点 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書（図の枠のリサイズハンドルと、部品『media』のモック） |
