# map の図で薄くした要素の文字のコントラストを 4.5:1 以上にし、表の列の幅のつまみの aria-valuenow を aria-valuemin 以上・aria-valuemax 以下にする

## 概要

読者が、map の図の案内・再生・中へ入る操作で薄くした要素の文字を、コントラストの基準を満たす濃さで参照できる。
支援技術の利用者が、表の列の幅のつまみで、今の幅が最小の幅と上限の間に収まった正しい値を受け取れる。

## 背景

束の親 Issue [#706](https://github.com/shuhei1101/mdmark/issues/706) の子 Issue 2 件の報告。

- [#678](https://github.com/shuhei1101/mdmark/issues/678): map の図で薄くした要素（`.map-dim`・`.map-focus` の強調しない要素）が `opacity: 0.25`、中へ入ったときにグループの外側に残るノード（`.map-faded`。統合した [#664](https://github.com/shuhei1101/mdmark/issues/664)）が `opacity: 0.4` で描かれ、axe の `color-contrast` が 1280x800・390x844 で出る。ER 図・状態遷移図・クラス図の `.map-dim` も同じ型。[#677](https://github.com/shuhei1101/mdmark/pull/677) のモックで reviewer が検出した
- [#686](https://github.com/shuhei1101/mdmark/issues/686): [src/table/table-resize.interact.ts](https://github.com/shuhei1101/mdmark/blob/d164eff2085539c7225486c2e32a5bb0f7f75c47/src/table/table-resize.interact.ts#L155-L158) の `updateValues` が `aria-valuenow`・`aria-valuemin`・`aria-valuemax` を大小を比べずに入れるため、上限が今の幅や最小の幅を下回る列で axe の `aria-valid-attr-value`（critical）が出る。[shuhei1101/mindstella#591](https://github.com/shuhei1101/mindstella/pull/591#discussion_r4622879385) のレビューで見つかり、mindstella は mdmark 側の修正を待つ

## 計画書

| ファイル | 中身 |
| --- | --- |
| `要件.md` | 要望の整理と変更箇所の由来 |
| `ライブラリ本体.md` | map の図の CSS・表の列の幅のつまみ・モック・設計書の計画書 |
