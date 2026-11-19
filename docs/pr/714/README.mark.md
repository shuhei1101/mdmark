# モジュール構成の 200 字を超え 2 文以上を持つ summary の詳細を description へ移し、summary を 1 行の概要にする

## 概要

モジュール構成の要素の長い `summary` を 1 行の概要にし、詳細を `description` で 1 文 1 行と表で読めるようにする。

## 背景

[#669](https://github.com/shuhei1101/mdmark/issues/669) の要望。
[#614](https://github.com/shuhei1101/mdmark/issues/614) の作業 PR [#668](https://github.com/shuhei1101/mdmark/pull/668) は、400 字を超え 5 文以上を持つ `summary` だけを直し、基準の外の長い `summary` をスコープ外にした。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体のモジュール構成の計画書 |
