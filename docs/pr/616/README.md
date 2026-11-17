# ER 図の部品（CMP-472-1）を map の ER 図へ統合して廃止するか決め、統合するなら今の定義を map へ変換する移行の手順を用意する

## 概要

ER 図の部品（`<!-- er -->` の JSON の定義で描く ER 図）を、map の ER 図（`erDiagram` の map）へ統合して廃止するかを決める。
統合する場合、文書の作成者が今の ER 図の部品の定義を map の範囲へ変換できるようにしてから、ER 図の部品を廃止する。

## 背景

[ER 図の部品（CMP-472-1）を map の ER 図へ統合して廃止するか決め、統合するなら今の定義を map へ変換する移行の手順を用意する](https://github.com/shuhei1101/mdmark/issues/566) の要望。
[新しい図 map で、ER 図・状態遷移図など flowchart とシーケンス図以外の Mermaid の図も、同じ書き方と操作で描けるようにする](https://github.com/shuhei1101/mdmark/issues/465) の作業 PR [#531](https://github.com/shuhei1101/mdmark/pull/531) で map の ER 図を追加したとき、既存の ER 図の部品の記載方法と描画を変えないと決め、統合をスコープ外の行として切り出した。
flow・sequence は [今の flow・sequence の定義を map へ変換するスクリプトを用意し、flow・sequence を廃止する](https://github.com/shuhei1101/mdmark/pull/534) で、移行の手順で map へ変換してから廃止した。
統合して廃止すると、公開している記法 `<!-- er -->` の互換性を壊すため、統合するかはユーザーに確認して決める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
