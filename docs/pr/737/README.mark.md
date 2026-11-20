# 表のセルの並べ替え・絞り込み・コピーの値から、脚注・注記のツールチップの定義の文字を除く

## 概要

脚注・注記を含む表のセルで、並べ替え・絞り込み・コピーの値に脚注・注記のツールチップの文字を入れない。

## 背景

[Issue #734](https://github.com/shuhei1101/mdmark/issues/734) の要望。表のセルの値（`src/shared/text.interact.ts` の `cellValue`）は、`data-value` が無いとき `visibleText` の文字を返す。`visibleText` は用語のツールチップ（`.mdmark-term-tip`）だけを除き、脚注・注記のツールチップ（`.mdmark-fn-tip`）の文字を残すため、脚注の定義の文字がセルの値に入る。

[#732](https://github.com/shuhei1101/mdmark/pull/732)（[Issue #728](https://github.com/shuhei1101/mdmark/issues/728)）で列の幅の計測だけを直したときに、reviewer が対象外の逸脱として報告した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
