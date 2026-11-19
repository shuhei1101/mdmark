# map のクラス図などの構成図の上で描く種類でも、click・link の id: のリンク先を resolveIdLink で URL にしてリンクにする

## 概要

利用側のページが `mount` の `opts.resolveIdLink` を指定したとき、map のクラス図の `click`・`link` の行の `id:` のリンク先も、flowchart と同じく URL に変えてリンクにする。

## 背景

[#693](https://github.com/shuhei1101/mdmark/issues/693) の報告。作業 PR [#690](https://github.com/shuhei1101/mdmark/pull/690)（起点 Issue [#650](https://github.com/shuhei1101/mdmark/issues/650)）のレビューの [指摘](https://github.com/shuhei1101/mdmark/pull/690#discussion_r4624621216) から切り出した。

- [src/map/index.ts](https://github.com/shuhei1101/mdmark/blob/709ff6cec191d8e7e34078d60c0393d49f40c040/src/map/index.ts) の `attachRange` は、構成図の上で描く種類（`FLOW_BASED`）を `attach(range, config, args)` で付け、`resolveIdLink` を渡すのは flowchart の `attachFlowRange` だけ
- そのため [src/map/flow-view.ts](https://github.com/shuhei1101/mdmark/blob/709ff6cec191d8e7e34078d60c0393d49f40c040/src/map/flow-view.ts) の `attachMapFlow` が受け取る `resolveIdLink` が `undefined` になり、クラス図の `id:` のリンク先は全て許さないリンク先として落ちる
- インターフェース定義『文書を描く』の制約『map のクラス図』は、`click`・`link` の行を制約『map のノードのリンク』と同じ許可と描き方にすると定めている

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.mark.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.mark.md) | `resolveIdLink` の受け渡し・設計書・テストの計画書 |
