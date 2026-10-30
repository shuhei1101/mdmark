# VS Code の差分ビューで Shift+Alt+D とタイトルのボタンから mdmark のプレビューを開けるようにする

## 概要

文書を書く人が、VS Code の Markdown の差分ビューから `Shift+Alt+D` とエディタのタイトルのボタンで、変更を色分けした mdmark のプレビューを開けるようになる。

## 背景

[Issue #233](https://github.com/shuhei1101/mdmark/issues/233) の修正。
[release PR #229](https://github.com/shuhei1101/mdmark/pull/229) の E2E（[E2E 実行 Issue #153](https://github.com/shuhei1101/mdmark/issues/153)）で、差分ビューから `Shift+Alt+D` でプレビューを開く 4 ケースが VS Code 1.141.0 で fail し、tester が実装バグと切り分けた。
差分ビューで押した `Shift+Alt+D` は `no when clauses matched the context` で `mdmark.openPreviewToSide` が呼ばれず、コマンドパレットからは差分のパネルが開く。
`vscode/package.json` のショートカットとボタンの `when`（`editorLangId == markdown`）は [#69](https://github.com/shuhei1101/mdmark/pull/69) からのもので、差分ビューから開く機能を追加した [#196](https://github.com/shuhei1101/mdmark/pull/196) は、この `when` が差分ビューでも当たる前提を置いていた。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [ ] PoC 検証
- [x] ~~複合ユースケース設計~~（影響なし: 複合ユースケースのシナリオを変えない）
- [x] ~~デザインスタイル選定~~（見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（影響なし: シナリオは今も `Shift+Alt+D` で開くと書いており、記述を変えない）
- [x] ~~モック作成~~（画面を変えない）
- [ ] インターフェース定義設計
- [x] ~~部品設計~~（部品を変えない）
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正（docs/リファレンス/VSCode拡張機能.md）
- [x] ~~単体テスト作成~~（`package.json` の `when` だけを変え、単体テストの対象の関数を変えない）
- [ ] 実装
- [ ] 結合テスト作成
- [x] ~~E2E テスト作成~~（既存の E2E が差分ビューから `Shift+Alt+D` で開くケースを持つ）
