# VS Code 拡張機能を vscode-v* のタグで Open VSX へ公開する

## 概要

拡張機能の利用者が、`vscode-v*` のタグを打った版を Open VSX から受け取れるようにする。
Marketplace への公開は、公開済みの掲載の扱いを決めてから同じワークフローへ加える。

## 背景

[Issue #84](https://github.com/shuhei1101/mdmark/issues/84) の要望。
今の `.github/workflows/vscode-release.yml` は、`vscode-v*` のタグで .vsix を作って GitHub Release に添えるまでで、Marketplace と Open VSX へは手で公開している。
Marketplace の PAT は 2026-12-01 に止まり、OIDC に未対応のため自動化を見送っていた。Open VSX は trusted publisher（OIDC）で長期のトークン無しに公開できる（[ユーザーの追加の情報](https://github.com/shuhei1101/mdmark/issues/84#issuecomment-6432548337)）。
[#261](https://github.com/shuhei1101/mdmark/pull/261) で拡張機能の ID を `ShuheiNishikawa.mdmark-vscode` に固定し、[#492](https://github.com/shuhei1101/mdmark/pull/492)（[#434](https://github.com/shuhei1101/mdmark/issues/434)）でタグを develop に打つ運用にした。
ユーザーから、修正が自動で利用者に届く配布を最優先にする依頼がある（[コメント](https://github.com/shuhei1101/mdmark/issues/84#issuecomment-6832944413)）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
