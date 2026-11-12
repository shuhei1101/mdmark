# side-toc をオフにしたまとめた HTML でも、脚注の番号・戻るリンクで URL の # を書き換えない

## 概要

まとめた HTML を読む人が、設定の `side-toc` をオフにしていても、脚注の番号と戻るリンクを URL の `#` を書き換えずに使用できるようになる。

## 背景

[Issue #419](https://github.com/shuhei1101/mdmark/issues/419) の報告。
まとめた HTML（`mdmark build`）で `side-toc` をオフにし、コメントの列でも包まないとき、`attachFootnotes` の `root` がまとめた HTML の `view` そのものになる。
最初の `mount` より前に登録した `src/viewer/bundle.ts` の `view` の `click` が脚注の `click` より先に走り、`history.replaceState` で URL の `#` を書き換える。
モジュール構成『ライブラリ本体 / 操作』の `attachFootnotes` の「どちらも URL の `#` を書き換えない」が成り立たない。
[PR #416](https://github.com/shuhei1101/mdmark/pull/416) の reviewer の任意の指摘（[discussion_r4506507077](https://github.com/shuhei1101/mdmark/pull/416#discussion_r4506507077)）から切り出した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
