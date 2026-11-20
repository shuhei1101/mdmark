# 表の列の幅をセルに見えている文字だけから決め、用語のツールチップの文字で列を広げないようにする

## 概要

用語を含む表の列の幅を、セルに見えている文字だけから決める。

## 背景

[Issue #728](https://github.com/shuhei1101/mdmark/issues/728) の要望。dev-docs で ai-monitor の用語集を開くと、「用語」の列が 2,051px、表が 2,983px になり、表示枠（934px）を大きくはみ出す。

列の幅の計測（`src/table/table-width.interact.ts` の `linesOf`）が、複製したセルの `textContent` を、開いていない用語のツールチップ（`.mdmark-term-tip`）の文字まで含めて 1 行として測るため。
計測は [#505](https://github.com/shuhei1101/mdmark/pull/505) で入り、[#727](https://github.com/shuhei1101/mdmark/pull/727)（[Issue #725](https://github.com/shuhei1101/mdmark/issues/725)）で計測用の要素の配置と幅の取得をまとめる処理に組み替えた。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
