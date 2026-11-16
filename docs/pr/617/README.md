# Marketplace への公開が一覧に出るまでの待ちを開発コマンドと vsce の設計書に記載する

## 概要

拡張機能を公開する開発者が、`vsce publish` の後に Marketplace の一覧へバージョンが出るまでの待ちを知り、公開の確認で一覧に出るまで条件で待てるようにする。

## 背景

[#568](https://github.com/shuhei1101/mdmark/issues/568) の要望。
[#84](https://github.com/shuhei1101/mdmark/issues/84)・[#512](https://github.com/shuhei1101/mdmark/pull/512) の反映作業「拡張機能の最初のタグ」で、`vscode-v0.1.3` のワークフローは公開を終えて success になったが、直後の確認では Marketplace の一覧に `0.1.3` が無く failed になった。
約 11 分後に参照し直すと `0.1.3` が出ていた。
同じ反映作業の再実行では、公開済みのバージョンを前提確認で `failed` にしていたため、確認だけを回し直せなかった（[追加のコメント](https://github.com/shuhei1101/mdmark/issues/568#issuecomment-6875491612)）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | VS Code 拡張機能の公開の流れの設計書の計画書 |
