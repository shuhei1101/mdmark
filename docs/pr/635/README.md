# VS Code 拡張機能のテストを 1 つの置き場所にまとめ、collectMapStructure の単体テストを structure.ts のテストへ移す

## 概要

VS Code 拡張機能のテストの置き場所をまとめ、`collectMapStructure` の単体テストを `src/map/structure.ts` の単体テストのファイルへ移す。

## 背景

[テストの置き場所の統一 2 件](https://github.com/shuhei1101/mdmark/issues/634) の束で、次の 2 件を 1 つの作業 PR で対応する。

- [#581](https://github.com/shuhei1101/mdmark/issues/581): VS Code 拡張機能のテストが `tests/unit/vscode/`・`tests/integration/vscode/`・`vscode/tests/integration/` の 3 か所にあり、フォルダ構成の設計書 `docs/layout/LAY-472-1.yaml` で 3 つのエントリが同じ `content_types`（`test`・`vscode`）を持つ。[#574](https://github.com/shuhei1101/mdmark/pull/574) のフォルダ構成の設計書の作成で、規約『フォルダ構成の切り方とレビュー』の観点「同じ種類が散る」に当たると分かった
- [#592](https://github.com/shuhei1101/mdmark/issues/592): `collectMapStructure` の単体テストが `src/map/check.ts` の再 export 経由で `tests/unit/src/map/check.test.ts` にあり、[#589](https://github.com/shuhei1101/mdmark/pull/589) で作った `docs/module/MOD-589-1.ts.yaml` が `test_files` を持たない

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
