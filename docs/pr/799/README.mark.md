# 表のほかの部品（ビュー・コメント・図など）を、<mdmark-table> と同じ方式でカスタム要素として使用できるようにする

## 概要

アプリの画面が、ビュー・コメント・図などの mdmark の部品を、`<mdmark-table>` と同じ方式（JavaScript のプロパティで指定し、配布物を読み込むと登録され、操作を要素のイベントで受け取る）のカスタム要素として使用できるようになる。

## 背景

[Issue #797](https://github.com/shuhei1101/mdmark/issues/797) の要望。
[PR #795](https://github.com/shuhei1101/mdmark/pull/795)（起点 [Issue #793](https://github.com/shuhei1101/mdmark/issues/793)）で、表の部品をカスタム要素 `<mdmark-table>` として jsDelivr の `@0` で配り、操作を `CustomEvent` で通知する方式を作った。
PR #795 はほかの部品を追加できる構造（`src/elements.ts` の `ELEMENT_DEFINERS` に登録する関数を並べる）までを作り、ほかの部品はスコープ外にした。

今、表のほかの部品をアプリの画面から使用する API は、ビューを描く `mountView` とコメントを付ける `mountComments` の関数だけで、プロパティで指定するカスタム要素は無い。
図の部品（グラフ・操作できる部品・map の図）は、文書のマーカーと埋め込んだ HTML の `<mdmark-chart>` などの記載から `mount` が描くだけで、アプリの画面から直接描く API が無い。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.mark.md) | Claude Code プラグインの計画書（ガイドの索引） |
