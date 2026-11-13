# src/files.yaml の config-files.ts の行で重なった MOD-472-116 への implements の 1 つを削除する

## 概要

`src/files.yaml` の `config-files.ts` の行の `related` で重なっている、`docs/module/MOD-472-116.ts` への `implements` の 1 つを削除する。

## 背景

[Issue #490](https://github.com/shuhei1101/mdmark/issues/490) の要望。
[#472](https://github.com/shuhei1101/mdmark/pull/472) で設計書を ID に移したとき、`設定を重ねて読み込む.ts` と `CLI.ts` を指していた 2 つの関連が、どちらも `MOD-472-116.ts` に置き換わって重なった。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
