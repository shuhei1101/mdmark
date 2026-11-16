# map で erDiagram・stateDiagram-v2 の Mermaid を、flowchart・シーケンス図と同じ記載方法と操作で描く

## 概要

文書の作成者が、map の範囲に erDiagram・stateDiagram-v2 の Mermaid と補足を記載し、flowchart・シーケンス図と同じマーカー・補足・操作（自動配置・説明・中へ入る・開閉・巡回）で ER 図と状態遷移図を描ける。

## 背景

[新しい図 map で、ER 図・状態遷移図など flowchart とシーケンス図以外の Mermaid の図も、同じ書き方と操作で描けるようにする](https://github.com/shuhei1101/mdmark/issues/465) の要望。
map（[Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する](https://github.com/shuhei1101/mdmark/issues/324)・[新しい図 map に、シーケンス図の参加者の操作・loop と alt の枠・タッチでのドラッグ・汎用の箱の種類の表示名を追加する](https://github.com/shuhei1101/mdmark/issues/464)）で描ける Mermaid の種類は flowchart と sequenceDiagram に限られ、それ以外の種類はコードブロックのまま表示される。
設計書の ER 図・状態遷移図は map の操作を使用できず、ER 図をフロー図で代用すると関連の表と図を二重に持つことになり、レビューで食い違いを指摘された。
印は map の 1 つにし、種類は Mermaid の 1 行目で決める（話し合いの決定 D-56）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
