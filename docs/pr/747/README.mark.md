# 罫線のコードブロックをファイルツリーで描き、mermaid のライブラリへ戻すコードブロックを map で描き、アーキテクチャ図の guide/ の行を修正する

## 概要

文書の作成者が、言語を指定せずに記載した罫線のフォルダ構成と、map のマーカーで囲んでいない mermaid のコードブロックを、ビュワーで mdmark の部品（ファイルツリー・map の図）として参照できるようにする。
あわせて、アーキテクチャ図のフォルダの役割の表を実体に合わせる。

## 背景

[#746](https://github.com/shuhei1101/mdmark/issues/746) の要望（束の親 Issue）。子 Issue は次の 3 件。

| Issue | 要望 |
| --- | --- |
| [#741](https://github.com/shuhei1101/mdmark/issues/741) | [#731](https://github.com/shuhei1101/mdmark/pull/731) のスコープ外として切り出した、アーキテクチャ図の `guide/` の行の修正 |
| [#739](https://github.com/shuhei1101/mdmark/issues/739) | 言語が `tree` でない罫線のコードブロックは、[#466](https://github.com/shuhei1101/mdmark/issues/466) で入れた記載の警告が出るだけでファイルツリーにならない。ファイルツリーの帯がコードブロックの帯と統一されていない |
| [#738](https://github.com/shuhei1101/mdmark/issues/738) | [#630](https://github.com/shuhei1101/mdmark/pull/630) で map の範囲の外の mermaid も map の図にしたが、`%%{` の行・front matter の `config`・map が読めない行・見た目を指定する行を持つものと、map が描けない種類は mermaid のライブラリの経路に残る |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ファイルツリー・コードブロック・map と mermaid の図の計画書 |
