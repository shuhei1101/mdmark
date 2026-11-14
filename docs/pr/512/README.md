# VS Code 拡張機能を vscode-v* のタグで Marketplace へ公開する

## 概要

拡張機能の利用者が、`vscode-v*` のタグを打ったバージョンを Visual Studio Marketplace から受け取れるようにする。

## 背景

[Issue #84](https://github.com/shuhei1101/mdmark/issues/84) の要望。
今の `.github/workflows/vscode-release.yml` は、`vscode-v*` のタグで .vsix を作って GitHub Release に添えるまでで、Marketplace へは手で公開している。
Marketplace は trusted publishing（GitHub Actions の OIDC。`vsce publish --oidc`）に対応し、ユーザーが publisher `ShuheiNishikawa` にポリシーを登録した。Open VSX には公開しない（[ユーザーの回答](https://github.com/shuhei1101/mdmark/pull/512#discussion_r4570559008)）。
[#261](https://github.com/shuhei1101/mdmark/pull/261) で拡張機能の ID を `ShuheiNishikawa.mdmark-vscode` に固定し、[#492](https://github.com/shuhei1101/mdmark/pull/492)（[#434](https://github.com/shuhei1101/mdmark/issues/434)）でタグを develop に打つ運用にした。
ユーザーから、修正が自動で利用者に届く配布を最優先にする依頼がある（[コメント](https://github.com/shuhei1101/mdmark/issues/84#issuecomment-6832944413)）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
