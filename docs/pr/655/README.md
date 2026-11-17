# 利用側が dist/index.js を 1 枚の HTML に埋めて Blob の URL から読み込んでも、map・view・comments の部品を読み込めるようにする

## 概要

利用側のアプリが、mdmark の配布物を通信しない 1 枚の HTML に埋めて Blob の URL から読み込んでも、map・ビュー・コメントの部品を読み込んで文書を描ける。

## 背景

[利用側が dist/index.js を 1 枚の HTML に入れて Blob の URL から読むと、map の部品を読み込めない](https://github.com/shuhei1101/mdmark/issues/624) の要望。
shuhei1101/mindstella は配る書き出しに `dist/index.js` を埋め、Blob の URL から `import()` して `mount` を呼ぶ（[shuhei1101/mindstella#551](https://github.com/shuhei1101/mindstella/pull/551) の PoC）。
今の `src/part-modules.ts` は部品の配布ファイルを `import.meta.url` から解決するため、Blob の URL では `TypeError: Invalid URL` で止まる。
読み込みを差し替える `setPartModuleLoader` は mdmark が書き出した HTML の起動の処理だけが使い、`dist/index.js` の export に無い。
[shuhei1101/mindstella#532](https://github.com/shuhei1101/mindstella/issues/532) がこの対応を待つ。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
