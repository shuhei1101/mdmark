# 結合テストの所要時間を測り、意味の薄い長いテストを削除・軽量化し、ときどき落ちる既存のテストを直す

## 概要

開発者が、結合テストの全件を短い時間で流し、今回の変更と関係ないテストの fail による流し直しをせずに全 pass のログを取れるようになる。

## 背景

[結合テストの所要時間を測り、意味の薄い長いテストを削除・軽量化し、ときどき落ちる既存のテストを直す](https://github.com/shuhei1101/mdmark/issues/390) の要望。
[mermaid のコードブロックを VS Code 拡張機能と HTML の書き出しで描く](https://github.com/shuhei1101/mdmark/pull/382)（起点 Issue [mermaid のコードブロックを VS Code 拡張機能と HTML の書き出しで描く](https://github.com/shuhei1101/mdmark/issues/190)）の結合テストで、全件の実行を 5 回繰り返し、1 回あたり 20〜25 分かかった。
流し直しの主な原因は、今回の変更と関係ない既存のテストが、実行ごとに違うものでときどき落ちたこと。
関係する Issue は、メモリの使い過ぎの [結合テストがファイルごとに Chromium を起動し並列の上限も無いため、メモリを使い過ぎてほかの作業と重なると回せない](https://github.com/shuhei1101/mdmark/issues/373) と、`test_normal_when_range_scripts` が通しで流すと落ちる [結合テスト test_normal_when_range_scripts が mount.browser.test.ts を通しで流すと落ちる](https://github.com/shuhei1101/mdmark/issues/364)。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
