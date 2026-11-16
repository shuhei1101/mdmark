# src/ 以外の管理用の YAML に行の無いファイルの行を追加し、配信元の設定を project-index.yaml へ改名して $schema を差し替える

## 概要

dev-docs・project-index が src/ 以外の管理用の YAML のフォルダのファイルを漏れなく配信し、エディタが配信元の設定の `when` を警告せずに検証できるようになる。

## 背景

同じタグ（`kind:文書のメタデータの登録`・`scope:dev-docs.yaml`）の 2 件をまとめた [文書のメタデータの登録 2 件](https://github.com/shuhei1101/mdmark/issues/575) の要望。

| Issue | 背景 |
| --- | --- |
| [src/ 以外の管理用の YAML に、フォルダの中にあるのに行の無いファイルの行を追加する](https://github.com/shuhei1101/mdmark/issues/491) | 管理用の YAML に行も除外も無いファイルがあり、dev-docs が配信しない |
| [配信元の設定の $schema の注釈を、when を持つ project-index のスキーマへ差し替える](https://github.com/shuhei1101/mdmark/issues/553) | 直下の `dev-docs.yaml` の `$schema` は `when` を持たない dev-docs のスキーマを指し、[配信元の設定に使う場面（when）を記載する](https://github.com/shuhei1101/mdmark/pull/551) で記載した `when` がエディタで未知のキーとして警告される |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [要件.yaml](./要件.yaml) | 影響するユースケース・更新ドキュメント・スコープ外 |
| [タスク一覧](./タスク一覧.yaml) | 工程ごとの状態 |
| [反映作業](./反映作業/index.yaml) | 端末の設定の配信元のパスの付け替え |
| [ライブラリ本体](./ライブラリ本体.md) | 配信元の設定・tests・モックの管理用の YAML・設計書の現状と変更方針 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | plugin の管理用の YAML・ガイド・MCP の設計書の現状と変更方針 |
| [VS Code 拡張機能](./VS%20Code%20拡張機能.md) | vscode の管理用の YAML の現状と変更方針 |
