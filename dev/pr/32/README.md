# サーバー無しで Markdown を 1 枚で完結する HTML に書き出し、複数の文書を 1 枚にまとめる CLI を作る

## 概要

文書を書く人が、サーバーを持たずに CLI で Markdown を HTML に書き出せ、複数の文書を参照・被参照・用語のツールチップが効く 1 枚の HTML にまとめられる。
書き出した HTML は CDN を読まず、file:// で開いても 1 枚で完結する。

## 背景

[Issue #9](https://github.com/shuhei1101/mdmark/issues/9) の要望。
OneDrive など Microsoft の環境では CDN を読めないため、CDN を読まない 1 枚の HTML が要る（[PR #16 での要望](https://github.com/shuhei1101/mdmark/pull/16#discussion_r4258211591)）。
今の mdmark は、使う側のページが jsDelivr から配布物を読み、使う側のサーバーが読んだ設定と索引を `mount`・`render` に渡す形だけを持ち、ファイルを読んで HTML を書き出す口を持たない。
[#3](https://github.com/shuhei1101/mdmark/issues/3)（[#16](https://github.com/shuhei1101/mdmark/pull/16)）が画面を持たない `render` を、[#5](https://github.com/shuhei1101/mdmark/issues/5)（[#27](https://github.com/shuhei1101/mdmark/pull/27)）が参照の表を作る `collectReferences` と索引を点検する `checkIndex` を、この Issue の CLI から呼ぶ前提で用意している。
MCP の `export_html`・`build_site`・`check` は [#11](https://github.com/shuhei1101/mdmark/issues/11)、版を上げる `mdmark upgrade` は [#10](https://github.com/shuhei1101/mdmark/issues/10) が持つ。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |

## タスク一覧

- [x] ~~初期構築~~（[#12](https://github.com/shuhei1101/mdmark/pull/12) で済んでいる）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] PoC 検証
- [ ] 複合ユースケース設計
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [ ] 画面一覧・画面遷移
- [ ] 単一ユースケース設計
- [ ] モック作成
- [ ] インターフェース定義設計
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成