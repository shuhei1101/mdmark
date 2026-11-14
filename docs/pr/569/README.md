# 既存の TypeScript 全体に複雑さの lint を error で適用し、違反を修正する

## 概要

Webview だけに適用している複雑さの lint を、リポジトリの他の TypeScript にも error で適用し、出た違反を挙動を変えずに修正する。

## 背景

[Issue #344](https://github.com/shuhei1101/mdmark/issues/344) の要望。
[PR #342](https://github.com/shuhei1101/mdmark/pull/342)（起点 [#173](https://github.com/shuhei1101/mdmark/issues/173)）で ESLint の道具を `tools/eslint/` に配置し、複雑さの lint を `vscode/src/webview/**` だけに適用した。
knowledge の規約『設計原則』の complexity-01 は、複雑さを lint で検査し、新しいリポジトリは error にすると定める。

計画の見積もりは 13pt で、ユーザーの回答（[分割の確認への返信](https://github.com/shuhei1101/mdmark/issues/344#issuecomment-6681027450)）で分割せず 1 つの作業 PR で進める。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と違反の件数 |
| [ライブラリ本体](./ライブラリ本体.md) | `tools/eslint/`・`src/`・`scripts/` の計画書 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | `vscode/src/`（Webview 以外）の計画書 |
