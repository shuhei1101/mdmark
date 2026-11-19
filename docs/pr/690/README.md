# map のクラス図で、click・link の行のクラスを純粋な Mermaid のコードブロックでもリンクにする（#570 の退行）

## 概要

文書の作成者が Mermaid の `classDiagram` に `click {クラス} href "{URL}"`・`link {クラス} "{URL}"` を記載すると、map で描いたクラスのノードが flowchart のノードと同じくリンクになり、押すとリンク先を開ける。

## 背景

[Issue #650](https://github.com/shuhei1101/mdmark/issues/650) の要望。[#570](https://github.com/shuhei1101/mdmark/issues/570) は `click` のノードをリンクにすると定めたが、[#596](https://github.com/shuhei1101/mdmark/issues/596)（map で classDiagram を描く）と [#630](https://github.com/shuhei1101/mdmark/issues/630)（純粋な Mermaid のコードブロックも map で描く）の後、クラス図のノードがリンクにならない。dev-docs の作業 PR [shuhei1101/dev-docs#262](https://github.com/shuhei1101/dev-docs/pull/262) の結合テスト `body_mermaid_click_link` が、純粋な Mermaid のコードブロックのクラス図でリンクを 0 件として fail した。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
