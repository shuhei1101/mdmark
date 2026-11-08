# Firefox の E2E で fail する図のリサイズハンドルのドラッグとグラフの項目へのフォーカスの 2 件を修正する

## 概要

Firefox で図を参照する人が、リサイズハンドルのドラッグで表示する枠の高さをドラッグした量のとおりに変えられ、グラフの項目にフォーカスを移してツールチップを参照できるようにする。

## 背景

[Issue #418](https://github.com/shuhei1101/mdmark/issues/418) の報告。
[PR #412](https://github.com/shuhei1101/mdmark/pull/412)（[Issue #400](https://github.com/shuhei1101/mdmark/issues/400) の修正）で図の E2E を Firefox でも実行したところ、#400 の 8 件に含まれない 2 件が Firefox だけで fail した。
release/v0.10.0 の [4d5568c4](https://github.com/shuhei1101/mdmark/commit/4d5568c4) でも同じく fail し、Chromium ではどちらも pass する。
修正は release へ入れ、E2E 実行 [#255](https://github.com/shuhei1101/mdmark/issues/255) で実行し直す。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と fail したケースごとの終わりの条件 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
