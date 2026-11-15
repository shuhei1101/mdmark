# 記法を含む既存の .md の拡張子を .mark.md へ移し、中身 1 つだけの guide/ のガイドの索引の置き場所を見直す

## 概要

mdmark のリポジトリの既存のガイドのうち mdmark の記法を含む `.md` の拡張子を `.mark.md` へ移し、直下の `guide/` にあるガイドの索引を置き場所を見直して移す。

## 背景

束の親 Issue [#594](https://github.com/shuhei1101/mdmark/issues/594) の要望で、[#546](https://github.com/shuhei1101/mdmark/issues/546) と [#582](https://github.com/shuhei1101/mdmark/issues/582) を束ねる。

- #546: [#541](https://github.com/shuhei1101/mdmark/pull/541)（起点 Issue [#499](https://github.com/shuhei1101/mdmark/issues/499)）で mdmark の記法で記載する文書の拡張子を `.mark.md` にし、`mdmark check` が記法を含む `.md` に改名を提案する（`plain_md_with_marks`）ようにした。#499 の後続は他のリポジトリの移行だけを挙げ、mdmark のリポジトリそのものの文書は `.md` のまま残っている
- #582: 直下の `guide/` はガイドの索引 `guide/index.yaml` と管理用の `guide/files.yaml` だけのフォルダで、knowledge の規約『フォルダ構成の切り方とレビュー』の「中身が 1 つだけのフォルダは作らない」から外れている。ガイドの本文は `docs/guide/` にあり、名前の似たフォルダが 2 つある（[#574](https://github.com/shuhei1101/mdmark/pull/574) のフォルダ構成の確認で見つかった）

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理・移す文書の一覧・変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ガイドのページの改名と、変更履歴を読むパスの計画書 |
| [ClaudeCodeプラグイン](./ClaudeCodeプラグイン.md) | ガイドの索引の置き場所と、ビルドが読む索引のパスの計画書 |
