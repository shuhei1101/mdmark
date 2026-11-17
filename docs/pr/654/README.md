# upgrade の v0.13.0 の変換で map の補足の文字列に `--` があっても、点検のずれで全ての変更を戻さないようにする

## 概要

文書の作成者が、元の図の文字に `--` を含む `flow`・`sequence` の範囲を持つ文書でも、`mdmark upgrade` で map の範囲へ書き換えてバージョンを上げられるようになる。

## 背景

[Issue #623](https://github.com/shuhei1101/mdmark/issues/623) の要望。
MindStella のワークスペースの資料 836 件に `mdmark upgrade --yes` を適用すると、v0.13.0 の移行の手順が flow のノードの `sub`（例: `コンテナの中・--mcp-config`）を map の補足へコピーし、点検が `map_invalid_value` を 7 件出して、ほかの 270 件の範囲も含めて全てコピーから戻る。

変換（`src/map/convert.ts`）は補足の JSON の `--` の 2 つ目の `-` を JSON の Unicode エスケープにして書き出すが、点検（`src/map/data.ts`）は JSON を解析した後の値の `--` を `map_invalid_value` にするため、エスケープした値も弾く。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
