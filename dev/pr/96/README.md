# クローン直後の npm ci だけで npm run typecheck が通るようにする

## 概要

開発者がクローンした直後に、直下の `npm ci` だけで `npm run typecheck` を通せるようにする。

## 背景

[Issue #91](https://github.com/shuhei1101/mdmark/issues/91) の報告。
release/v0.7.0 の E2E（[E2E 実行 Issue #56](https://github.com/shuhei1101/mdmark/issues/56)・[release PR #85](https://github.com/shuhei1101/mdmark/pull/85)）で、単一『配布物をビルドして検査する』の `test_normal` が `npm run typecheck` の終了コード 1 で fail し、続く 7 件は serial のため流れなかった。
直下の `tsconfig.json` は `tests` を含み、`tests/e2e/vscode.ts` が `vscode/tests/integration/run.ts` を import する。
`run.ts` が import する `@vscode/test-electron` は `vscode/package.json` にだけあるため、直下の `npm ci` だけでは型を引けない。
原因は [#69](https://github.com/shuhei1101/mdmark/pull/69)（`7fb28e4`）が足した import。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の結合テストの代役の配信と、E2E の import の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状の設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（影響なし: シナリオの記述を変えない）
- [x] ~~デザインスタイル選定~~（見た目を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] ~~単一ユースケース設計~~（影響なし: シナリオの記述を変えない）
- [x] ~~モック作成~~（画面を変えない）
- [x] ~~インターフェース定義設計~~（入出力を変えない）
- [x] ~~部品設計~~（部品を変えない）
- [x] ~~画面設計~~（画面の要素を変えない）
- [ ] モジュール構成設計
- [x] ~~ドキュメント修正~~（更新するドキュメントが無い）
- [x] ~~単体テスト作成~~（製品の実装を変えず、テストの支えのファイルを分けるだけ）
- [ ] 実装
- [x] ~~結合テスト作成~~（インターフェースを変えない。既存の VS Code 拡張機能の結合テストを実行のみで流す）
- [ ] E2E テスト作成
