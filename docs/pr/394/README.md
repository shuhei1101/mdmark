# コードのコメント・文書・UI 文言の単語を、用語の選び方の規約の対応表に合わせて修正する

## 概要

mdmark の文書・コードのコメント・画面と CLI に出る文言から、knowledge の対応表が NG とする単語（「箱」「印」「版」「題」「節」「足す」など）を無くし、読み手が IT の分野で定着した単語で理解できるようにする。

## 背景

[Issue #289](https://github.com/shuhei1101/mdmark/issues/289) の要望。
knowledge の規約『文章の書き方』は、比喩の和語・訓読みの動詞・一字の単語を NG とし、置き換え先を対応表に定めている。
受付の判断で、同じ種類の [#105](https://github.com/shuhei1101/mdmark/issues/105) をこの Issue に統合した（[ユーザーの回答: 案 C](https://github.com/shuhei1101/mdmark/issues/289#issuecomment-6596942950)）。
対応表は shuhei1101/knowledge#135 で YAML（`docs/word-list/word-list-ai-slop.yaml`）に移り、修正する単語はこの対応表を正とする（[task-planner の連絡](https://github.com/shuhei1101/mdmark/issues/289#issuecomment-6604991344)）。
受付の判断の件数（「印」「版」「題」「節」「箱」の 5 単語）に対し、正の対応表は 50 を超える単語を持ち、対象の件数は約 10 倍になる（[要件](./要件.md) の `## 要望`）。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
| [VS Code 拡張機能](./VSCode拡張機能.md) | VS Code 拡張機能の計画書 |
| [Claude Code プラグイン](./ClaudeCodeプラグイン.md) | Claude Code プラグインの計画書 |
