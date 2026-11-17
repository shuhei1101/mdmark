# VS Code 拡張機能の結合テスト test_normal_when_map_configured・test_normal_when_version_pinned を、確認する描画・要求を受けるまで待つように修正する

## 概要

VS Code 拡張機能の結合テスト `test_normal_when_map_configured`（`preview-rerender.test.ts`）と `test_normal_when_version_pinned`（`preview-open.test.ts`）を、実行の速さによらず同じ結果になるように修正する。

## 背景

[テストの非同期処理の不具合の修正 2 件](https://github.com/shuhei1101/mdmark/issues/636) の束で、次の 2 件の要望。

| Issue | 事象 |
| --- | --- |
| [VS Code 拡張機能の結合テスト test_normal_when_map_configured が、余分な再描画を数えてときどき fail する](https://github.com/shuhei1101/mdmark/issues/535) | `hexagon` を書き込んだ後に描画の回数が増えたかだけを待ち、`'rect' !== 'hexagon'` で fail した |
| [VS Code 拡張機能の結合テスト test_normal_when_version_pinned が map.js の要求の記録より先に検証して fail することがある](https://github.com/shuhei1101/mdmark/issues/563) | `rendered` を受けた直後に配布物の要求を検証し、`map.js` の要求が欠けて fail した |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
