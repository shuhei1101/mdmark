# src/files.yaml に #352・#354 で追加した行の無い 10 ファイルの行を追加する

## 概要

`src/files.yaml` に行が無い `src/` のファイルの行を追加し、dev-docs が設計書からこれらのコードをたどれるようにする。

## 背景

[Issue #436](https://github.com/shuhei1101/mdmark/issues/436) の要望。
[#352](https://github.com/shuhei1101/mdmark/pull/352)・[#354](https://github.com/shuhei1101/mdmark/pull/354) が追加したファイルの行が `src/files.yaml` に無く、規約『ドキュメント管理』の files.yaml（フォルダごとの `files.yaml` が 1 ファイル 1 行で持つ）に反する。
[PR #435](https://github.com/shuhei1101/mdmark/pull/435) のスコープ外から起票された。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | Claude Code プラグインの計画書 |
