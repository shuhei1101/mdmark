# フォルダ構成の設計書（layout）を作成し、今のフォルダ構成をレビューの観点で確認する

## 概要

レビューする側が、knowledge のテンプレート『フォルダ構成』の書式の設計書で、このリポジトリのフォルダ構成の問題を洗い出せるようになる。

## 背景

[フォルダ構成の設計書（layout）を作成し、今のフォルダ構成をレビューの観点で確認する](https://github.com/shuhei1101/mdmark/issues/361) の要望。
このリポジトリにはフォルダ構成の設計書が無く、フォルダ構成の問題をレビューで洗い出せない。
依存していた [shuhei1101/knowledge#219](https://github.com/shuhei1101/knowledge/issues/219)（テンプレート）・[shuhei1101/ai-monitor#3267](https://github.com/shuhei1101/ai-monitor/issues/3267)（設計の手順）・[shuhei1101/ai-monitor#3188](https://github.com/shuhei1101/ai-monitor/issues/3188)（knowledge のスキーマの参照）・[dev/ を廃止して文書を docs/ 1 つにまとめ、ai-monitor#3307 と同じ構成へ移す](https://github.com/shuhei1101/mdmark/issues/454)（文書を `docs/` 1 つにまとめる）は完了している。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [要件.yaml](./要件.yaml) | 更新ドキュメント・スコープ外 |
| [タスク一覧](./タスク一覧.yaml) | 工程ごとの状態 |
| [リポジトリ全体](./リポジトリ全体.md) | 現状・変更方針・テスト結果 |
