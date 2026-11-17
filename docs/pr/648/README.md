# テスト実行方法の層ごとに実行場所を決め、ランナーで回せる層を GitHub Actions の workflow で回す

## 概要

テスト実行方法の層ごとに実行場所（GitHub Actions のランナーか手元か）を決め、ランナーで回せる層を GitHub Actions の workflow で回す。
ランナーで回す層も、ランナーで回せないときは手元で回せる状態を保つ。

## 背景

[Issue #560](https://github.com/shuhei1101/mdmark/issues/560) の要望。
全プロジェクトの単体・結合テストが同じ WSL の上で動き、メモリが不足している。
[テスト実行方法](https://github.com/shuhei1101/mdmark/blob/730b1a56/docs/test-procedure/TP-472-1.yaml) の全ての層が手元で回す前提で記載されていて、テストを回す workflow は無い。
依存先の [knowledge#350](https://github.com/shuhei1101/knowledge/issues/350)（判定フローチャート『テストの実行場所』）・[knowledge#351](https://github.com/shuhei1101/knowledge/issues/351)（workflow のインターフェース定義）・[ai-monitor#3434](https://github.com/shuhei1101/ai-monitor/issues/3434)（runner の層をランナーで回す手順）は close 済み。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | テスト実行方法・workflow・スキーマの参照の計画書 |
