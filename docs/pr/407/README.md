# リポジトリの移行の手順を参照するテストを、migrations/next か最新のバージョンのフォルダの有る方から参照するようにする

## 概要

リポジトリの移行の手順を参照するテストを、release・master で `migrations/next/` を `migrations/v{バージョン}/` へ移した後も通るようにする。

## 背景

[Issue #395](https://github.com/shuhei1101/mdmark/issues/395) の要望。
Sprint v0.10.0 の E2E（release PR [#393](https://github.com/shuhei1101/mdmark/pull/393)）で、tester が開発コマンド『管理作業』の手順のとおり `migrations/next/` を `migrations/v0.10.0/` へ移した後、リポジトリの `migrations/next/` を直接参照するテストが落ちた。
テストは [#355](https://github.com/shuhei1101/mdmark/pull/355) と [#360](https://github.com/shuhei1101/mdmark/pull/360) で追加したもの。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体のテストの計画書 |
