# 設定ファイルをグローバルの設定と上のフォルダから重ねて読み、CLI・MCP・VS Code 拡張機能で共通にする

## 概要

文書を書く人が、端末の設定と、今のフォルダから上のフォルダの `mdmark.config.yaml` を重ねた設定で、CLI・MCP・VS Code 拡張機能のどれからでも同じように文書を描き・書き出せるようになる。
VS Code 拡張機能のプレビューにも `theme` の CSS と `extensions` の拡張が当たり、書き出した HTML と同じ見た目になる。

## 背景

[Issue #163](https://github.com/shuhei1101/mdmark/issues/163) の要望。
CLI（`export`・`build`・`check`・`upgrade`）と MCP は、`--config`（MCP は `config`）で指したファイルか、今のフォルダから上へ探して最初に見つかった 1 つの `mdmark.config.yaml` だけを読み、端末に共通の設定を置く場所が無い。
VS Code 拡張機能は `mdmark.configPath` をワークスペースのフォルダから解決するだけで上へ探さず、設定ファイルから `features`・`libraries`・`html-scripts`・`side-toc`・`colorTheme`・`assets.root` だけを取り出す。
そのため `theme` の CSS と `extensions` の拡張が書き出した HTML には当たるがプレビューには当たらず、設定を読む処理も CLI（`src/cli/config.ts`）と拡張機能（`vscode/src/config.ts`）に別々にある。

端末の設定の場所と環境変数 `MDMARK_CONFIG` は、[#165 のユーザーのコメント](https://github.com/shuhei1101/mdmark/issues/165#issuecomment-6652543567) で決まった。
文書ごとのページの設定（[#161](https://github.com/shuhei1101/mdmark/issues/161)）と CSS のテンプレート（[#164](https://github.com/shuhei1101/mdmark/issues/164)）は、この PR の設定の読み方を前提にする。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体（CLI と設定を読む共通の処理）の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグイン（MCP のツール）の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない。設定ファイルのフォルダのファイルを Webview の URI にして CSP の `cspSource` と `localResourceRoots` で読む経路は、`libraries`・`assets.root` で動いている）
- [x] 複合ユースケース設計
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [ ] 単一ユースケース設計
- [ ] モック作成（設定ファイルを読めない帯: 重ねた設定ファイルのどれを読めないかの出し方）
- [ ] インターフェース定義設計
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正（要件.md の `## 更新ドキュメント`）
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
