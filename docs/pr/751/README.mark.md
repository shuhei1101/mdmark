# 開発コマンドの配布ファイルの上限を 712KB に合わせ、公開ドキュメントの files.yml の行にエイリアスを持たせる

## 概要

開発コマンドのビルドの配布ファイルの上限を非機能要件と同じ 712KB に修正し、ガイドのページの名前と別名をエイリアスとして照合できるようにする。

## 背景

束の親 Issue [#750](https://github.com/shuhei1101/mdmark/issues/750) の要望。
子 Issue [#744](https://github.com/shuhei1101/mdmark/issues/744) と [#743](https://github.com/shuhei1101/mdmark/issues/743) は、どちらも [#731](https://github.com/shuhei1101/mdmark/pull/731)（起点 Issue [#612](https://github.com/shuhei1101/mdmark/issues/612)）のスコープ外として切り出した。

- #744: [#700](https://github.com/shuhei1101/mdmark/pull/700) で配布ファイルの上限を 712KB に上げたとき、開発コマンドの「ビルド・生成」の `effects` だけが前の値の 688KB のまま残った
- #743: #612 で登録したエイリアスは設計書の `aliases` と用語集が対象で、公開ドキュメント（`docs/guide/` の Markdown）は含めなかった。ガイドのページは `docs/guide/files.yml` の行でメタデータを持つが、`id`・`aliases` を持たず、`project-index.yaml` の `id: docs` の行に `alias_type` が無い

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の開発コマンド・公開ドキュメント・配信の設定の計画書 |
