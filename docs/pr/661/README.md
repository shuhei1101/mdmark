# 開発ドキュメントのタブの並びとサイドバーのグループを決まりに従って定義し、目次を並べない

## 概要

開発ドキュメントサーバー（dev-docs）で配信元 `mdmark` を開いた人が、起点になる文書（はじめに・使い方）を左のタブから参照し始め、各タブの文書をサイドバーのグループで探せるようにする。

## 背景

[#605](https://github.com/shuhei1101/mdmark/issues/605) の要望。
配信元 `mdmark` のタブは文書の行ごとに 27 件並び、画面の幅に収まらない。並びに決まりが無く、公開ドキュメントのタブが右の方にある。
[project-index.yaml](https://github.com/shuhei1101/mdmark/blob/4c455f92/project-index.yaml) に `nav` が無く、dev-docs が文書の行ごとにタブを作っている。
タブの並び・サイドバーのグループ・目次を並べない決まりは、knowledge の規約『開発ドキュメントのナビゲーション』（[shuhei1101/knowledge#421](https://github.com/shuhei1101/knowledge/issues/421) で登録）にある。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と画面での確認の基準 |
