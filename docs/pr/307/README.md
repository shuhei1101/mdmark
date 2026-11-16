# 記法の新設 8 件（icon:・columns・蛍光ペン・kbd: と ruby・details と pagebreak・include・wide・csv の表）

## 概要

文書を書く人が、アイコン・段組み・蛍光ペン・キー・ルビ・範囲の折りたたみ・改ページ・ほかの文書の取り込み・本文の幅を越える配置・CSV の表を、新しい記法として使えるようになる。

## 背景

[記法の新設 8 件（icon:・columns・蛍光ペン・kbd: と ruby・details と pagebreak・include・wide・csv の表）](https://github.com/shuhei1101/mdmark/issues/305) の要望。
記法を新設する子 Issue の束で、子ごとの範囲と決まったことは子の Issue の本文と、本文の `## 必読` に挙げた話し合いの記録が正。

- [インラインコード `icon\:名前` で Lucide のアイコンを見出しと本文に出す](https://github.com/shuhei1101/mdmark/issues/192): セクションのタイトルにアイコンを付ける方法が無い。Lucide のアイコンは図とボタンで使う分だけを配布物に束ねている
- [本文を横に分割する columns のマーカーを追加する](https://github.com/shuhei1101/mdmark/issues/193): 本文を横に並べる記法が無い
- [蛍光ペンのマーカー ==text== を描き、色を名前の色で選べるようにする](https://github.com/shuhei1101/mdmark/issues/213): 本文の強調が太字だけで、蛍光ペンのマーカーが無い
- [インラインコード kbd: をキーの見た目で描き、文書の HTML で ruby を許す](https://github.com/shuhei1101/mdmark/issues/214): 操作の手順でキーが目立たない。ルビは描く処理が `<ruby>` を落とさないが、記法の一覧と使い方集に記載が無い
- [details のマーカーで範囲を折りたたみ、pagebreak のマーカーで印刷のときに改ページする](https://github.com/shuhei1101/mdmark/issues/217): 折りたためるのは見出しのセクションと注意書きの `-` だけで、見出しの無い補足を閉じられない。印刷で改ページの位置を決められない
- [include のマーカーでほかの文書・見出し・コードの行の範囲を取り込む](https://github.com/shuhei1101/mdmark/issues/219): 同じ説明を複数の文書に記載するしかなく、記載した箇所ごとにずれる
- [wide のマーカーで図・表・画像を本文の幅を越えて広げる](https://github.com/shuhei1101/mdmark/issues/220): 大きい図や表も本文の幅に収まり、狭いまま見ることになる
- [言語 csv のコードブロックを表の機能付きの表で描く](https://github.com/shuhei1101/mdmark/issues/221): 表計算から貼った CSV を、Markdown の表に修正する手間がある

依存の [表の列と行を色で強調し、決まった色を名前で指定できるようにする](https://github.com/shuhei1101/mdmark/issues/158)（色のプリセット）・[書き出した HTML で blob: URL と動的 import をやめ、1 つの script に束ねる](https://github.com/shuhei1101/mdmark/issues/189)（書き出した HTML を 1 つの script に束ねる）は develop へ入っている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VSCode拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [ClaudeCodeプラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない。使う文書でだけ外部ライブラリを読む経路と、書き出した HTML への埋め込みは既存の仕組みを使う）
- [x] 複合ユースケース設計
- [x] ~~デザインスタイル選定~~（デザイン方針があり、見た目の方向を変えない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] モック作成
- [x] インターフェース定義設計
- [x] 部品設計
- [x] 画面設計
- [x] モジュール構成設計
- [x] ドキュメント修正
- [x] 単体テスト作成
- [x] 実装
- [x] 結合テスト作成
- [x] E2E テスト作成
