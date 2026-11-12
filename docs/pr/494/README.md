# モジュール構成『ライブラリ本体 / CLI』のフォルダ構成に markdown-check.ts・issues.ts を追加する

## 概要

モジュール構成『ライブラリ本体 / CLI』のフォルダ構成（`src/cli/` のツリー）に、`markdown-check.ts`・`issues.ts` の行と受け持ちのコメントを追加し、要素の `container` と揃える。

## 背景

[Issue #437](https://github.com/shuhei1101/mdmark/issues/437) の要望。
[PR #435 の reviewer の対象外の逸脱の報告](https://github.com/shuhei1101/mdmark/pull/435#discussion_r4507775552)で、フォルダ構成に 2 ファイルが無く、[#328](https://github.com/shuhei1101/mdmark/pull/328)・[#378](https://github.com/shuhei1101/mdmark/pull/378) で追加した要素の `container`（`src/cli/markdown-check.ts`・`src/cli/issues.ts`）と食い違っていると分かった。
Issue の起票後に [#472](https://github.com/shuhei1101/mdmark/pull/472) でモジュール構成が物理ファイルごとに分かれ、フォルダ構成は `docs/module/MOD-472-23.yaml`、2 ファイルの要素は `MOD-472-127.ts.yaml`・`MOD-472-125.ts.yaml` へ移っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
