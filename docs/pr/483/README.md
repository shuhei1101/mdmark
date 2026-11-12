# dev-docs が配信から除いている docs/mock/files.yml のバイナリの素材 4 行を修正する

## 概要

dev-docs が「path が指すファイルがありません」として配信から除いている `docs/mock/files.yml` のバイナリの素材 4 行を修正し、警告が出ないようにする。

## 背景

[Issue #482](https://github.com/shuhei1101/mdmark/issues/482) は、同じ種類（文書のメタデータの登録）の [Issue #341](https://github.com/shuhei1101/mdmark/issues/341) と [Issue #413](https://github.com/shuhei1101/mdmark/issues/413) をまとめた Issue。

| Issue | origin/develop での状態 |
| --- | --- |
| [#341](https://github.com/shuhei1101/mdmark/issues/341) | [#263](https://github.com/shuhei1101/mdmark/pull/263) で入ったバイナリ 4 行は、[#472](https://github.com/shuhei1101/mdmark/pull/472) で `dev/mock/files.yaml` から `docs/mock/files.yml` へ移った後も残っている |
| [#413](https://github.com/shuhei1101/mdmark/issues/413) | `plugin/files.yaml` の 2 行の `description:` は [#472](https://github.com/shuhei1101/mdmark/pull/472)（[23881bce](https://github.com/shuhei1101/mdmark/commit/23881bce)）で引用符で囲まれ、解消済み |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
