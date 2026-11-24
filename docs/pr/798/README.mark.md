# dev-docs のメタデータの画面から直コミットしてよい種類を project-index.yaml の direct_commit に追加する

## 概要

dev-docs のメタデータの画面から、mdmark の文書（タグ・用語集・管理用の YAML の説明など）を直コミットできるようにする。

## 背景

[Issue #796](https://github.com/shuhei1101/mdmark/issues/796) の要望。
配信元の設定 `project-index.yaml` に `direct_commit` が無いため、dev-docs のメタデータの画面では全ての種類が参照のみになっている。
dev-docs は [shuhei1101/dev-docs#317](https://github.com/shuhei1101/dev-docs/pull/317)（依頼元 [shuhei1101/dev-docs#314](https://github.com/shuhei1101/dev-docs/issues/314)）で同じ `direct_commit` を追加した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| `要件.mark.md` | 要望の整理 |
| `反映作業/index.yaml` | マージの後に端末の設定へ直コミットできる種類を登録する作業 |
