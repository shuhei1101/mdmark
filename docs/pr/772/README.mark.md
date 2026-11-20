# map の図の線・文字・マインドマップの見た目と押せる範囲を修正し、VS Code の書き出しを描いた HTML から起動し、カーソル・単語・描く処理を統一する

## 概要

読者が、map の図の線・ノードの文字・マインドマップの項目を mermaid の図と同じくらい読みやすく確認でき、線と離れたノード・ボタンを axe に誤検出されずに押せるようにする。
VS Code 拡張機能で書き出した HTML から元の Markdown を参照できないようにする。
部品のカーソル・文書の単語・同じ記載を描く処理を 1 つに統一する。

## 背景

束の親 [Issue #771](https://github.com/shuhei1101/mdmark/issues/771) が、次の 8 件をまとめている。

<!-- table: {"kind": "data"} -->

| Issue | 背景 |
| --- | --- |
| [#760](https://github.com/shuhei1101/mdmark/issues/760) | 情報のアイコンにポインターを重ねるとカーソルが `help` になる。develop では ER 図のノートのマーカー（`.map-er-note`）とクラス図のノートのマーカー（`.map-class-note`）が `cursor: help` を持ち、モジュール構成『index.css』の「`cursor: help` を付けない」と食い違っている |
| [#749](https://github.com/shuhei1101/mdmark/issues/749) | [PR #731](https://github.com/shuhei1101/mdmark/pull/731) が「当てる」を「適用する」に置き換えた結果、ポインターを置く操作を「ポインターを適用する」と呼ぶ箇所が残っている（[PR #740](https://github.com/shuhei1101/mdmark/pull/740) のレビューで報告） |
| [#764](https://github.com/shuhei1101/mdmark/issues/764) | 線の押せる範囲（`.map-wire-hit` の path）を axe の target-size が線を囲む矩形で判定し、矩形の中のノード・ボタンを誤検出する（[PR #763](https://github.com/shuhei1101/mdmark/pull/763) のモックの検査で発見） |
| [#766](https://github.com/shuhei1101/mdmark/issues/766) | map の図のノードの名前・種類の行・線のラベルの文字が、mermaid の図より大きく太い（[PR #747](https://github.com/shuhei1101/mdmark/pull/747) のモックのレビューでの利用者の指摘） |
| [#765](https://github.com/shuhei1101/mdmark/issues/765) | map のマインドマップの項目に枠線が無く、短い項目名が折り返され、文字が大きく太く、フォーカスの操作が使いづらい（同上） |
| [#767](https://github.com/shuhei1101/mdmark/issues/767) | 線の出入り口が各辺の中点 1 か所だけで、同じ辺から出る線が同じ点から出て重なる（同上） |
| [#769](https://github.com/shuhei1101/mdmark/issues/769) | [PR #753](https://github.com/shuhei1101/mdmark/pull/753) で CLI と MCP の書き出しは元の Markdown を埋めなくなったが、VS Code 拡張機能の書き出しは今も `TextDocument.getText()` の全文を埋めている（#753 のスコープ外の行） |
| [#748](https://github.com/shuhei1101/mdmark/issues/748) | 同じものを描く処理が 2 つあるときは新しい方に寄せて古い方を削除する、という利用者の方針（[#738](https://github.com/shuhei1101/mdmark/issues/738)）を、mermaid 以外の部品に当てはめる（#747 のスコープ外の行） |

<!-- /table -->

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.mark.md) | VS Code 拡張機能の計画書 |
