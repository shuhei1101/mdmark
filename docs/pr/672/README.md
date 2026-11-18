# src/files.yaml に行の無い 17 ファイルを追加し、配信元 mdmark の検索の対象とメタデータを project-index の setup の推奨に合わせて見直す

## 概要

AI エージェントが、配信元 mdmark のファイルを project-index の推奨の範囲とメタデータの付け方で検索できるようになる。

## 背景

束の親 [Issue #671](https://github.com/shuhei1101/mdmark/issues/671) の要望で、子 [#627](https://github.com/shuhei1101/mdmark/issues/627) と [#645](https://github.com/shuhei1101/mdmark/issues/645) を 1 つの作業 PR で行う。
`src/files.yaml` に行の無いファイルが 17 件あり、dev-docs・project-index が配信していない（#627）。
project-index の setup の推奨の範囲と仮のメタデータの付け方が変わった（shuhei1101/project-index#101・shuhei1101/project-index#102）が、この配信元はそれより前の範囲と付け方のまま（#645）。
直下と `docs/` 直下のファイルを管理用の YAML に記載できるようにする変更（shuhei1101/project-index#133）は closed。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の管理用の YAML と配信元の設定の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の管理用の YAML の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの管理用の YAML の計画書 |
