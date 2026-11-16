# dev-docs が配信から除いている [docs/mock/files.yml](https://github.com/shuhei1101/mdmark/blob/0dcb2d79476a29498091dd9e339d322796da4e35/docs/mock/files.yml) のバイナリの素材 4 行を修正する

## 概要

dev-docs が「path が指すファイルがありません」として配信から除いている [docs/mock/files.yml](https://github.com/shuhei1101/mdmark/blob/0dcb2d79476a29498091dd9e339d322796da4e35/docs/mock/files.yml) のバイナリの素材 4 行を修正し、警告が出ないようにする。

## 背景

[dev-docs が配信から除いている files.yaml の行の修正 2 件（mock のバイナリの素材 4 行・plugin の SKILL.md の description）](https://github.com/shuhei1101/mdmark/issues/482) は、同じ種類（文書のメタデータの登録）の [dev/mock/files.yaml の #263 のバイナリの素材 4 行を dev-docs が配信から除いている](https://github.com/shuhei1101/mdmark/issues/341) と [plugin/files.yaml の SKILL.md の行の description がバッククォートで始まり、YAML として参照できない](https://github.com/shuhei1101/mdmark/issues/413) をまとめた Issue。

| Issue | origin/develop での状態 |
| --- | --- |
| [dev/mock/files.yaml の #263 のバイナリの素材 4 行を dev-docs が配信から除いている](https://github.com/shuhei1101/mdmark/issues/341) | [表の列と行を名前の色で強調し、画像・動画・GIF・音声・リンクと添付のカードを描けるようにする](https://github.com/shuhei1101/mdmark/pull/263) で入ったバイナリ 4 行は、[dev/ を廃止して文書を docs/ 1 つにまとめ、ai-monitor#3307 と同じ構成へ移す](https://github.com/shuhei1101/mdmark/pull/472) で `dev/mock/files.yaml` から [docs/mock/files.yml](https://github.com/shuhei1101/mdmark/blob/0dcb2d79476a29498091dd9e339d322796da4e35/docs/mock/files.yml) へ移った後も残っている |
| [plugin/files.yaml の SKILL.md の行の description がバッククォートで始まり、YAML として参照できない](https://github.com/shuhei1101/mdmark/issues/413) | `plugin/files.yaml` の 2 行の `description:` は [dev/ を廃止して文書を docs/ 1 つにまとめ、ai-monitor#3307 と同じ構成へ移す](https://github.com/shuhei1101/mdmark/pull/472)（[23881bce](https://github.com/shuhei1101/mdmark/commit/23881bce)）で引用符で囲まれ、解消済み |

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
