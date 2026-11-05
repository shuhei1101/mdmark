# 既存の記法への項目の追加 3 件（表の列の並べ替え・コードブロックの HTML の TypeScript と CSS・表のキーの階層）

## 概要

文書を書く人が、表の列の並べ替え・表のキーの列の階層と YAML の見本との連動・`<!-- html -->` の範囲の TypeScript と CSS による動きと見た目を、既存の記法に追加した項目として使えるようになる。

## 背景

[Issue #301](https://github.com/shuhei1101/mdmark/issues/301) の要望。
既存の記法へ項目を追加する子 Issue の束で、子ごとの範囲と決まったことは子の Issue の本文が正。

- [#184](https://github.com/shuhei1101/mdmark/issues/184): 表の機能（sort・pin・filter・count・columns・total・copy・rowlink）に列の順を変える機能が無く、列の多い表で見たい列を隣に並べられない
- [#241](https://github.com/shuhei1101/mdmark/issues/241): `<!-- html -->` の範囲の HTML はスクリプトとイベントの属性を落とすため、押すと畳むなどの動きのある見本を文書の中に置けない。動きを追加する手段は `registerExtension` と `theme.css` だけで、ページか設定ファイルの単位で当たる
- [#250](https://github.com/shuhei1101/mdmark/issues/250): 設定の一覧（`docs/リファレンス/設定.md`）はキーを全体のパスで記載した表で、同じ親が行ごとに繰り返され、どこからが入れ子か読み取りにくい

依存の [#183](https://github.com/shuhei1101/mdmark/issues/183)（表のセルの結合と多段の見出し）・[#189](https://github.com/shuhei1101/mdmark/issues/189)（書き出した HTML を 1 つの script に束ねる）・[#245](https://github.com/shuhei1101/mdmark/issues/245)（はみ出す表の既定のピン止め）・[#249](https://github.com/shuhei1101/mdmark/issues/249)（コードブロックの折りたたみ）は develop へ入っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] PoC 検証（#241: VS Code のプレビューの CSP（nonce で絞った `script-src`）と、`blob:`・動的 `import()` を使わない書き出した HTML の下で、範囲の `ts`・`js` を動かせるか）
- [x] 複合ユースケース設計
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] モック作成
- [x] インターフェース定義設計
- [ ] 部品設計
- [ ] 画面設計
- [ ] モジュール構成設計
- [ ] ドキュメント修正
- [ ] 単体テスト作成
- [ ] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
