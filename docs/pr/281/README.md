# 部品の操作の不具合を修正する（タッチ端末の図のツールチップ・Firefox の用語のツールチップ・拡大した図のドラッグ）

## 概要

読む人が、タッチ端末で開いた図のツールチップを閉じられ、Firefox で用語のツールチップに覆われずに同じ文書のリンクを押せ、拡大した図を余白のドラッグで動かせるようになる。

## 背景

[部品の操作の不具合の修正 3 件（タッチ端末の図のツールチップ・Firefox の用語のツールチップ・拡大した図のドラッグ）](https://github.com/shuhei1101/mdmark/issues/279) の要望で、部品の操作の不具合 3 件を束ねる。

- [タッチ端末で、図のツールチップを開いた後に閉じられない](https://github.com/shuhei1101/mdmark/issues/170): iOS の Safari で図のツールチップを開くと、タップした持ち主に `:hover` が残り、外をタップしても閉じる処理が走らない。
  閉じる手段が Esc だけになる
- [Firefox で、hover で開いた用語のツールチップが同じ文書のリンクを覆い、押せない](https://github.com/shuhei1101/mdmark/issues/267): Firefox で hover で開いた用語のツールチップが同じ文書のリンクを覆い、E2E『複数の文書を1枚のHTMLにまとめる』の `test_normal`・`test_normal_when_aliases` が Firefox だけ時間切れで fail する。
  [表の列と行を名前の色で強調し、画像・動画・GIF・音声・リンクと添付のカードを描けるようにする](https://github.com/shuhei1101/mdmark/pull/263) の E2E テスト作成で見つかった
- [E2E の test_normal_when_embedded_chart で、拡大してから余白をドラッグしても図が動かない](https://github.com/shuhei1101/mdmark/issues/273): E2E『図を拡大・縮小・移動する』の `test_normal_when_embedded_chart` で、拡大してから余白をドラッグしても `scrollLeft` が増えず、Chromium と Firefox で fail する。
  [フロー図の部品に、判定フローチャートの「質問」「結果」のノードの種類を追加する](https://github.com/shuhei1101/mdmark/pull/268) のレビューで見つかった

[Firefox で、hover で開いた用語のツールチップが同じ文書のリンクを覆い、押せない](https://github.com/shuhei1101/mdmark/issues/267) と [E2E の test_normal_when_embedded_chart で、拡大してから余白をドラッグしても図が動かない](https://github.com/shuhei1101/mdmark/issues/273) は Sprint v0.10.0 の E2E 実行（[Sprint v0.10.0 の E2E 実行](https://github.com/shuhei1101/mdmark/issues/255)）を fail させる。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |

## タスク一覧

- [x] ~~初期構築~~（既存リポジトリのため対象外）
- [x] ~~リバースエンジニアリング~~（現状設計書が揃っている）
- [x] ~~方針決め~~（方針決めを依頼する Issue ではない）
- [x] ~~PoC 検証~~（未検証の技術機構に依存しない）
- [x] ~~複合ユースケース設計~~（影響なし: 複合ユースケースの流れを変えない）
- [x] ~~デザインスタイル選定~~（利用者に見える画面の見た目が変わらない）
- [x] ~~画面一覧・画面遷移~~（画面の追加・削除と画面遷移の変更を含まない）
- [x] 単一ユースケース設計
- [x] ~~モック作成~~（利用者に見える画面の見た目が変わらない）
- [x] インターフェース定義設計
- [x] 部品設計
- [x] 画面設計
- [x] モジュール構成設計
- [x] ドキュメント修正（[図を描く](https://github.com/shuhei1101/mdmark/blob/748e77a51f533c02847d5f66996930efc0f3dc2c/docs/使い方/図を描く/図を描く.md)・[構成図の決まり](https://github.com/shuhei1101/mdmark/blob/748e77a51f533c02847d5f66996930efc0f3dc2c/docs/リファレンス/構成図の決まり.md)・[コードブロックのHTMLを描く](https://github.com/shuhei1101/mdmark/blob/748e77a51f533c02847d5f66996930efc0f3dc2c/docs/使い方/図を描く/コードブロックのHTMLを描く.md)・[記法](https://github.com/shuhei1101/mdmark/blob/748e77a51f533c02847d5f66996930efc0f3dc2c/docs/リファレンス/記法.md)）
- [x] 単体テスト作成
- [x] 実装
- [x] 結合テスト作成
- [x] E2E テスト作成
