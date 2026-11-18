# モジュール構成の functions[].summary・constants[].summary に入った詳細を description へ移し、summary を 1 行の概要にする

## 概要

モジュール構成の要素の `summary` を 1 行の概要にし、詳細を `description` で 1 文 1 行と表で読めるようにする。

## 背景

[#614](https://github.com/shuhei1101/mdmark/issues/614) の要望。
[#290](https://github.com/shuhei1101/mdmark/issues/290) の作業 PR [#610](https://github.com/shuhei1101/mdmark/pull/610) で長い文を 1 文 1 行にしたとき、`summary` は 1 行の決まり（`^[^\n]+$`）で改行できず、5 文以上・400 字を超える詳細を持つ `summary` が残った。
同じ文書の `readTableColors`・`columnLinesOf` は、`summary` を 1 行の概要にして詳細を `description` に持っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体のモジュール構成の計画書 |
