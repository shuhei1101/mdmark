# 描いた文書の表示を改善する（表の見出し行と幅・表のコピーと集計・コードブロックのラベルとコピー・タブの中の見出しへの移動・空の badge:）

## 概要

文書を読む人が、広い画面の幅を使い、表の見出し行を見ながら大きい表をページのスクロールだけで読み、表とコードブロックを用途に合う形でコピーし、URL の見出しがタブの中にあってもそこへ移れるようにする。

## 背景

[Issue #150](https://github.com/shuhei1101/mdmark/issues/150) は、計画で同じタグ（`kind:描いた文書の表示の改善`）を持ち、触る範囲が重なる [#119](https://github.com/shuhei1101/mdmark/issues/119)・[#123](https://github.com/shuhei1101/mdmark/issues/123)・[#130](https://github.com/shuhei1101/mdmark/issues/130)・[#132](https://github.com/shuhei1101/mdmark/issues/132)・[#136](https://github.com/shuhei1101/mdmark/issues/136)・[#139](https://github.com/shuhei1101/mdmark/issues/139) を 1 本の作業 PR で対応する束。
[#123](https://github.com/shuhei1101/mdmark/issues/123) の言語のラベルと Dockerfile・diff を除く要望は、AI Monitor のドキュメントサイトの本文を mdmark v0.7.0 の `mount` で描くように置き換える作業 PR（[shuhei1101/ai-monitor#2990](https://github.com/shuhei1101/ai-monitor/pull/2990)）から挙がった、今の AI Monitor にあり mdmark に無い動き。
[#123](https://github.com/shuhei1101/mdmark/issues/123) の言語のラベルと Dockerfile・diff は、[#67](https://github.com/shuhei1101/mdmark/issues/67)（[PR #97](https://github.com/shuhei1101/mdmark/pull/97)）の色分けを VS Code 拡張機能のプレビューで使って出た要望。

今の mdmark は、本文の幅を `--mdmark-content-width: 46rem`、表の高さを `--mdmark-table-max-height: 28rem` で抑え、見出し行は表の中の縦のスクロールで表の上端に留める。
表のコピー（`+copy`）は TSV だけで、集計（`total=`）は 1 行にまとめ、数として読めないセルを警告せずに除く。
コードブロックの言語は読み上げの名前にだけ使い、コピーボタンは無い。
URL の `#ID` が閉じた節の中を指すときは節を開くが、選ばれていないタブの中の見出しには移れない。
`badge:` だけのインラインコードは中身の無いバッジになる。

配布物 `dist/index.js` は、非機能要件『配布ファイル 1 つのサイズ』の上限 384KB（393,216 バイト）に対して 391,395 バイト（2026-10-26 の develop）で、残りは 1,821 バイト。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] PoC 検証
- [x] ~~複合ユースケース設計~~（影響なし: 業務の流れは変わらない）
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] モック作成
- [x] インターフェース定義設計
- [x] 部品設計
- [x] 画面設計
- [x] モジュール構成設計
- [x] ドキュメント修正（docs/リファレンス/記法.md・docs/リファレンス/API.md・docs/リファレンス/用語集.md・docs/使い方/書く/表に機能を付ける.md・docs/使い方/書く/本文を部品で組む.md・docs/使い方/カスタマイズ/テーマを上書きする.md・docs/使い方/カスタマイズ/印刷する.md・docs/はじめに/コアコンセプト/文書を描く仕組み.md）
- [x] 単体テスト作成
- [x] 実装
- [ ] 結合テスト作成
- [ ] E2E テスト作成
