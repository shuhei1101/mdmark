# map の図のタッチでのドラッグと、罫線のコードブロックの点検の警告を追加する

## 概要

読者がスマホの指で map の図を動かせるようになる。
文書の作成者と Claude Code が、罫線でフォルダ構成を記載したのに言語が `tree` でないコードブロックに点検と書き出しで気づき、ガイドの索引からファイルツリーの記載方法に行き着けるようになる。

## 背景

束の親 Issue [#507](https://github.com/shuhei1101/mdmark/issues/507) の要望で、子 Issue [#464](https://github.com/shuhei1101/mdmark/issues/464)・[#466](https://github.com/shuhei1101/mdmark/issues/466) を 1 つの作業 PR で進める。
#464 は、map で作り直すとしてクローズした [#404](https://github.com/shuhei1101/mdmark/issues/404)・[#405](https://github.com/shuhei1101/mdmark/issues/405)・[#357](https://github.com/shuhei1101/mdmark/issues/357)・[#333](https://github.com/shuhei1101/mdmark/issues/333) の要件を、map（[#445](https://github.com/shuhei1101/mdmark/pull/445)）へ追加する。
#466 は、エージェントがフォルダ構成を言語 `text` のコードブロックで記載し、`export_html` も描画の確認も警告を出さず、利用者に指摘されるまで気づかなかったことによる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
