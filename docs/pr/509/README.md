# 公開ドキュメントの Pages を docs/_theme/ のレイアウトで描き、AI Monitor の develop のバージョンへ取り込む

## 概要

mdmark の公開ドキュメントの GitHub Pages を、AI Monitor の配布する共通のレイアウト `docs/_theme/` で描く。

## 背景

[Issue #473](https://github.com/shuhei1101/mdmark/issues/473) の要望。
[#472](https://github.com/shuhei1101/mdmark/pull/472)（`dev/` を `docs/` へまとめる移行）のスコープ外から切り出した。
今の Pages は `docs/_config.yml` に `exclude` だけを持ち、Jekyll の既定のレイアウトで描かれていて、`docs/_theme/` を使っていない。
`docs/_theme/` は [#230](https://github.com/shuhei1101/mdmark/pull/230) で取り込んだ AI Monitor v0.3.0 のままになっている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
