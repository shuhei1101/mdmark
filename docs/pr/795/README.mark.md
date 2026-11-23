# 表の部品を、アプリの画面からカスタム要素 <mdmark-table> として使用できるようにする

## 概要

アプリの画面（MindStella の表形式のビュー・AI Monitor のフィードバック画面 など）が、`<mdmark-table>` のタグと、列の定義と行のデータの指定だけで、mdmark の表の部品の機能を使用でき、行やセルの操作をイベントで受け取れるようになる。

## 背景

[Issue #793](https://github.com/shuhei1101/mdmark/issues/793) の要望。
表の部品（[CMP-472-61](../../component/CMP-472-61.ts.yaml)）は Markdown の表を囲んだときにだけ使用でき、アプリの画面はデータベースの一覧を表示する表をアプリごとに作っている。
そのため MindStella の表形式のビューでは列の幅の変更・列の並べ替えができず（[shuhei1101/mindstella#670](https://github.com/shuhei1101/mindstella/issues/670)）、AI Monitor のフィードバック画面では長い文字が隣の列に重なり、ピン止めが無い（[shuhei1101/ai-monitor#3775](https://github.com/shuhei1101/ai-monitor/issues/3775)）。

今ある公開関数と要素（`mount`・`render`・`mountView`・`mountComments`・埋め込んだ HTML の `<mdmark-chart>`）には、アプリのデータ（JSON）から表を描くカスタム要素と、行の操作をアプリへ通知する決まりが無い。
提供の方式は、利用者の回答で D-869 の案 A（カスタム要素を今の配布物と同じ jsDelivr から配り、操作をカスタム要素のイベントで通知する）に決定した。
読み込むバージョンの指定は、受付判断での利用者の回答（[案 C](https://github.com/shuhei1101/mdmark/issues/793#issuecomment-7079910656)）が Issue の本文の決定より優先する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | ライブラリ本体の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.mark.md) | Claude Code プラグインの計画書（ガイドの索引） |
