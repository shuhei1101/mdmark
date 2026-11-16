# VS Code 拡張機能 mdmark for VS Code にアイコンを付けて Marketplace に表示する

## 概要

拡張機能の利用者が、Visual Studio Marketplace と VS Code の拡張機能のビューで、`mdmark for VS Code` を専用のアイコンで見分けられるようにする。

## 背景

[VS Code 拡張機能 `mdmark for VS Code` にアイコンが無い](https://github.com/shuhei1101/mdmark/issues/559) の要望。
`vscode/package.json` は最上位の `icon` を持たず、Marketplace の `ShuheiNishikawa.mdmark-vscode` は既定のアイコンで表示されている。
Marketplace への公開は [VS Code 拡張機能を vscode-v* のタグで Marketplace へ公開する](https://github.com/shuhei1101/mdmark/pull/512) で `vscode-v*` のタグから行う運用になり、`vscode/package.json` の `version` は `0.1.3`（タグ `vscode-v0.1.3`）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
