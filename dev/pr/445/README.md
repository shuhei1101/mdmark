# Mermaid と補足で書き、自動配置で描いて階層を辿れる新しい図（map）を追加する

## 概要

文書を書く人が Mermaid の図に補足を付けて `map` のマーカーで囲むと、mdmark が自動配置で図を描き、読む人が箱の中へ入る・開閉する・巡回する・シーケンスを構成図の上で再生する、の操作で図を辿れるようになる。

## 背景

[#324](https://github.com/shuhei1101/mdmark/issues/324) の要望。
今のフロー図（`flow`）・シーケンス図（`sequence`）は座標を全て記載した JSON で書き、mdmark の無い表示（GitHub・VS Code の標準のプレビュー）では JSON がそのまま見える。
図は 1 枚の平面で、枠は 1 つ・層は横の分割だけのため、入れ子の構成を描けない。
枠の入れ子と層の分割の [#309](https://github.com/shuhei1101/mdmark/issues/309) はこの Issue に統合した。
機能は avagahana（MIT）を参考にするが、依存せず mdmark に独自に作る。見た目は avagahana に寄せず、モック作成で決める。
後続に、書き出しの `map` の変換（[#313](https://github.com/shuhei1101/mdmark/issues/313)）と、既存の文書の移行（[#290](https://github.com/shuhei1101/mdmark/issues/290) ほか各リポジトリの Issue）がある。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と影響する UC 一覧 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
