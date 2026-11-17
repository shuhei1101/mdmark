# develop に v0.14.0 のタグを打つ（#570 を含める）

## 概要

#570 を含む develop の commit に、次のバージョンのタグ `v0.14.0` を打つ。

## 背景

[#571](https://github.com/shuhei1101/mdmark/issues/571) の要望。
dev-docs・knowledge は mdmark を jsDelivr のタグで読み込むため、[#570](https://github.com/shuhei1101/mdmark/issues/570)（Mermaid の `click` の URL をノードのリンクにする）と [#304](https://github.com/shuhei1101/mdmark/issues/304)（注記の記法）を含むタグが打たれるまで取り込めない。
待っている作業 PR は [shuhei1101/dev-docs#212](https://github.com/shuhei1101/dev-docs/pull/212) と [shuhei1101/knowledge#396](https://github.com/shuhei1101/knowledge/pull/396)。
ユーザーの[回答](https://github.com/shuhei1101/mdmark/issues/571#issuecomment-6876964715)（案 A）で、#570 が develop へ入った後に [#567](https://github.com/shuhei1101/mdmark/issues/567) と同じ手順で打つと決まっている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | version.ini・移行の手順・配布物の計画書 |
| [Claude Code プラグイン](./Claude%20Code%20プラグイン.md) | plugin/ の配布物の計画書 |
| [反映作業](./反映作業/index.yaml) | マージの後に打つタグ |
