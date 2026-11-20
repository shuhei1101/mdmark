# map のマーカーの引数 mode（boxes・layers・list の見せ方の切り替え）を追加するかを決める

## 概要

map のマーカーの引数に、図の見せ方を切り替える `mode` を追加するかを決め、追加する場合は文書の作成者が `mode` で map の図の見せ方を切り替えられるようにする。

## 背景

[Issue #468](https://github.com/shuhei1101/mdmark/issues/468) の要望。[PR #445](https://github.com/shuhei1101/mdmark/pull/445)（[#324](https://github.com/shuhei1101/mdmark/issues/324) の作業 PR）のスコープ外として起票された。

#324 の本文の参考に `<!-- map: view=呼び出し mode=boxes title=全体の構成 -->` の例が残っている（手元で話し合った一案で、確認していないもの）。PR #445 ではマーカーの引数を JSON のオブジェクト（`title`・`focus`・`collapse`）にし、層は補足の `layout` とグループ（Mermaid の `subgraph`）で表して入れ子のグループを既定の描き方にしたため、切り替える先が無いとして `mode` を追加しなかった。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
