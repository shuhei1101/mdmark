# CLI の E2E 6 件の fail（取り込みとアイコンを埋めた書き出し・雛形からの点検・上のフォルダの設定のパス・YAML の誤りの行番号・文字列の警告）を修正する

## 概要

Sprint v0.10.0 の E2E で fail した CLI の 6 件を、実装の誤りは実装で、テストの誤りはテストで修正し、release で pass させる。

## 背景

[Issue #401](https://github.com/shuhei1101/mdmark/issues/401) の要望。
Sprint v0.10.0 の E2E（[#255](https://github.com/shuhei1101/mdmark/issues/255)、release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で、CLI を呼ぶ 6 件が fail した。
release の今の配布物で再現して切り分けると、実装の誤りが 2 つ（見出しのセクションの中の取り込みが空になる・`mdmark check` が外部ライブラリのマーカーを図の定義のずれにする）、設計と食い違うテストの期待が 3 つある。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の実装 2 件と E2E 3 件の計画書 |
