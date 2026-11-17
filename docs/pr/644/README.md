# AI Monitor v0.4.0 の配布物へ追従する

## 概要

AI Monitor v0.3.0..v0.4.0 の配布物へ追従し、配布先の反映作業 8 件を実行して、準拠バージョンと `docs/_theme/` の取り込み元の記録を v0.4.0 にする。

## 背景

[Issue #587](https://github.com/shuhei1101/mdmark/issues/587) の要望。
`ai-monitor-version.ini`・`ai-monitor-theme.yaml` は v0.3.0 のままで、v0.4.0 の配布先の反映作業（ルール索引の直下への移動・スキーマの参照への移行・データの設計書の作成など）の対象が develop に残っている。
[Issue #584](https://github.com/shuhei1101/mdmark/issues/584)・[Issue #586](https://github.com/shuhei1101/mdmark/issues/586) の範囲を統合した。
『各プロジェクトのスキーマの参照への移行』のうち ER 図を除く設計書の種類の分は、[Issue #290](https://github.com/shuhei1101/mdmark/issues/290) の作業 PR [#610](https://github.com/shuhei1101/mdmark/pull/610) が引き取って develop へ入っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | 配布物の取り込み・設計書・Schema・反映作業の計画書 |
