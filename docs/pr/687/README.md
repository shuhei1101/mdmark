# AI Monitor v0.5.0 の配布物へ追従する

## 概要

AI Monitor v0.4.0..v0.5.0 の配布物へ追従し、配布先の反映作業 1 件を実行して、準拠バージョンと `docs/_theme/` の取り込み元の記録を v0.5.0 にする。

## 背景

[Issue #625](https://github.com/shuhei1101/mdmark/issues/625) の要望。
`ai-monitor-version.ini`・`ai-monitor-theme.yaml` は v0.4.0 のまま（[#644](https://github.com/shuhei1101/mdmark/pull/644) で v0.4.0 へ追従済み）で、v0.5.0 の配布先の反映作業（直下の `mdmark.config.yaml` の `map.kinds` の記載）の対象が develop に残っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | 配布物の取り込み・目次の印・反映作業の計画書 |
