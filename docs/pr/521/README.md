# 移行の手順のフォルダの legacy-marks.js にまとめた依存のライセンスを表記する

## 概要

移行の手順のフォルダの `legacy-marks.js` にまとめた依存のライセンスを、後のバージョンで `dist/` の依存が変わっても欠けないように表記する。

## 背景

[#480](https://github.com/shuhei1101/mdmark/issues/480) の要望。[#477](https://github.com/shuhei1101/mdmark/pull/477) のレビューの任意の指摘で、#477 の要件.yaml のスコープ外の行。
`scripts/build.ts` の `buildLegacyMarks` は、移行の手順のフォルダ（`migrations/next/`。release で `migrations/v{バージョン}/` に移る）へ、描画の依存をまとめた `legacy-marks.js` を書き込む。
今は `dist/THIRD_PARTY_LICENSES.txt` が同じ依存を挙げているが、`writeThirdPartyLicenses` は `buildLegacyMarks` の metafile を読まない。
移行の手順のフォルダのファイルは削除しないため、後のバージョンで `dist/` の依存が変わると表記が欠ける。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
