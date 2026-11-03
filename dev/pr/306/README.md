# PoC: コードブロックの HTML の範囲の ts・js を CSP の下で動かす

## 概要

`<!-- html -->` の範囲の `ts` を範囲の根の要素で呼ぶ機構が、書き出した HTML と VS Code のプレビューの CSP の下で成立するかを確かめる。

## 背景

[#303](https://github.com/shuhei1101/mdmark/pull/303) の PoC 検証（[#241](https://github.com/shuhei1101/mdmark/issues/241)）。
方針は [#303 の方針の案](https://github.com/shuhei1101/mdmark/pull/303#discussion_r4457826942)で合格した。
結論は #303 の `ライブラリ本体.md` の `## PoC 結果` に記録し、この PR はマージせずに閉じる。

## 計画書

なし

## タスク一覧

- [ ] PoC 検証（`poc/html-scripts/run.mjs`）
