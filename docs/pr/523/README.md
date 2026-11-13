# VS Code 拡張機能の結合テストで、タグ一覧の待ちの経過時間を時計の補正に左右されずに測る

## 概要

開発者が、WSL2 の時計の補正で `Date.now` が戻っても、タグ一覧の待ちの上限（3 秒）を確かめる結合テストを落とさずに流せるようになる。

## 背景

[#504](https://github.com/shuhei1101/mdmark/issues/504) の不具合。
VS Code 拡張機能の結合テスト `test_normal_when_tags_unreachable` で、タグ一覧の要求が待ちの上限 3000 ms より早い 276 ms で `TimeoutError` になり、前回のバージョンの配布物を 335 ms で要求した（VS Code 1.141.0、10 回の繰り返しのうち 1 回）。
[#485](https://github.com/shuhei1101/mdmark/pull/485) の stable の実行でも、中断が 2451 ms で発火していた。
同じテストは [#195](https://github.com/shuhei1101/mdmark/issues/195) でも 1734 ms で落ち、[#247](https://github.com/shuhei1101/mdmark/pull/247) では再現せず、原因の材料をメッセージに出す修正だけを入れた。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
