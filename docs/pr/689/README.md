# ER 図 ER-472-3・ER-472-6 の relations に from_column・to_column を追加して設計書の検査に合格させる

## 概要

ER 図 ER-472-3・ER-472-6 の `er.relations` に必須のキー `from_column`・`to_column` を追加し、設計書の検査に合格させる。

## 背景

[Issue #646](https://github.com/shuhei1101/mdmark/issues/646) の要望。knowledge の `schemas/design/er.schema.yaml`（`design-schemas/v8.4.0`）は `relations` の要素に `from_column`・`to_column` を必須にしており、`docs/er/ER-472-3.yaml` と `docs/er/ER-472-6.yaml` は project-index の書き込みツールと `ai_monitor.design_docs validate` の検査に合格しない。[作業 PR #644](https://github.com/shuhei1101/mdmark/pull/644) のレビューで対象外の逸脱として報告された。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
