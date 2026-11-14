# 書き出した HTML から、mdmark を使用していることが読み取れないようにする

## 概要

文書の作成者が、指定をしなくても、書き出した HTML を見る人に mdmark で作ったことを知られずに文書を配れるようになる。

## 背景

[Issue #527](https://github.com/shuhei1101/mdmark/issues/527) の要望。今の `mdmark export`・`mdmark build`（MCP の `export_html`・`build_site`）で書き出した HTML には、`mdmark-` で始まるクラス名・CSS 変数・`#mdmark-payload` の要素、HTML のコメント・マーカーのコメント、`--mdmark-version` のバージョンの情報が残り、mdmark で作ったことが読み取れる。
隠す範囲と既定の動作は [Issue #527 の追記（D-453）](https://github.com/shuhei1101/mdmark/issues/527#issuecomment-6850621695) で決まった。元の Markdown を埋め込まない範囲は [#532](https://github.com/shuhei1101/mdmark/issues/532)、純粋な Markdown への書き出しは [#313](https://github.com/shuhei1101/mdmark/issues/313) が扱う。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | CLI の書き出し・まとめと、書き出した HTML の起動の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | MCP の `export_html`・`build_site` の計画書 |
