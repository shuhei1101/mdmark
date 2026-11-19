# 利用側が dist/index.js を 1 枚の HTML に埋めて使用するときに、mermaid のモジュールも埋めて指定し、jsDelivr へ要求せずに mermaid の図を描けるようにする

## 概要

利用側のアプリが、mdmark の配布物を通信しない 1 枚の HTML に埋めて使用しても、mermaid のモジュールを埋めて指定し、jsDelivr へ要求せずに mermaid の図を描ける。

## 背景

[利用側が dist/index.js を 1 枚の HTML に埋めて使うと、mermaid のライブラリを jsDelivr から読み込み、通信を止めると mermaid の図を描けない](https://github.com/shuhei1101/mdmark/issues/656) の要望。
`src/mermaid.ts` の `loadMermaid` は、埋めた mermaid の指定が無いと設定の `mermaid.url` を `import()` する。
埋めた mermaid を指定する `setEmbeddedMermaid` は mdmark が書き出した HTML の起動の処理だけが使用し、`dist/index.js` の export に無い。
map・ビュー・コメントの部品は [#655](https://github.com/shuhei1101/mdmark/pull/655) で公開関数 `setPartModuleLoader` を用意し、mermaid はそのスコープ外として切り出された。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
