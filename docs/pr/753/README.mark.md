# 用語の YAML から用語集の表を描き、書き出した HTML に元の Markdown を埋め込まず描画した HTML から起動する

## 概要

文書の作成者が、用語の YAML（`terms[]`）だけを原本にして、用語集の表を描けるようにする。
書き出した HTML（`export_html`・`build_site`、CLI の `export`・`build`）から元の Markdown を参照できないようにする。

## 背景

束の親 [Issue #752](https://github.com/shuhei1101/mdmark/issues/752) が、次の 2 件をまとめている。

| Issue | 背景 |
| --- | --- |
| [#742](https://github.com/shuhei1101/mdmark/issues/742) | [PR #731](https://github.com/shuhei1101/mdmark/pull/731)（起点 Issue [#612](https://github.com/shuhei1101/mdmark/issues/612)）で用語の YAML `docs/guide/用語集.yaml` を新設したが、`docs/guide/用語集.mark.md` の表（`glossary` のマーカー）も残したため、同じ用語を YAML と表の 2 か所で持っている |
| [#532](https://github.com/shuhei1101/mdmark/issues/532) | 書き出した HTML は元の Markdown を `#mdmark-payload` に埋め込み、開いたときにその Markdown から描いているため、書き出した HTML から元の Markdown を参照できる（[#527](https://github.com/shuhei1101/mdmark/issues/527) の決定の続き） |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
| [mdmark-style](./mdmark-style.mark.md) | mdmark-style の計画書 |
