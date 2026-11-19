# VS Code 拡張機能の mdmark.version で develop を選べるようにし、develop の配布物の作り直しが出したバージョンの migrations/v*/ を書き換えないようにする

## 概要

- 文書の作成者が、VS Code 拡張機能の設定 `mdmark.version` に `develop` を記載し、プレビューで develop の最新の配布物を読み込めるようになる
- develop の配布物の作り直しとタグを打つときのビルドが、出したバージョンの `migrations/v*/` を書き換えなくなる

## 背景

[Issue #682](https://github.com/shuhei1101/mdmark/issues/682) は、次の 2 件の子 Issue を 1 つの作業 PR で実行する束の親。

| 子 | 要望 |
| --- | --- |
| [#638](https://github.com/shuhei1101/mdmark/issues/638) | [#621](https://github.com/shuhei1101/mdmark/pull/621) で jsDelivr の `@develop`・`npx github:shuhei1101/mdmark#develop`・`mdmark.config.yaml` の `version: develop` を使用できるようにしたが、VS Code 拡張機能の `mdmark.version` は `pattern` が `^(latest|v\d+\.\d+\.\d+)$` で `develop` を記載できない |
| [#639](https://github.com/shuhei1101/mdmark/issues/639) | #621 で入った `develop-dist.yml` が `git add --all dist plugin migrations` で `migrations/` も commit し、`scripts/build.ts` の `buildLegacyMarks`・`buildRetiredDiagrams` が出したバージョンのフォルダも作り直すため、[dd0b92b1](https://github.com/shuhei1101/mdmark/commit/dd0b92b1bdd7a5a04e056fea60687d43bb18f46a) 以降の develop の配布物の作り直しが出したバージョンの移行の手順の配布物を書き換えて commit している |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の計画書（#638） |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書（#639） |
