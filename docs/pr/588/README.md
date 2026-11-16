# 結合テストのタッチの代役が、後のテストに (hover: none)・(pointer: coarse) を残さないようにする

## 概要

結合テストのタッチの代役を付けたテストの後でも、同じページの後のテストで `(hover: hover)`・`(pointer: fine)` が当たり、ポインターを乗せて確かめるテストをどこに置いても落ちないようにする。

## 背景

[結合テストのタッチの代役が、後のテストまで (hover: none)・(pointer: coarse) を残す](https://github.com/shuhei1101/mdmark/issues/530) の要望。
`tests/integration/lib/mount.browser.test.ts` の `test_normal_when_column_resized_by_touch`（[表の列の幅を、見出しの右端をドラッグして変えられるようにし、ダブルクリックで元の幅に戻す](https://github.com/shuhei1101/mdmark/pull/449) の [31508a21](https://github.com/shuhei1101/mdmark/commit/31508a21)）は、CDP の `Emulation.setTouchEmulationEnabled` でタッチの代役を付け、`finally` で `enabled: false` に戻している。
戻した後も同じページの後のテストで `(hover: hover)`・`(pointer: fine)` が当たらないままで、`setEmitTouchEventsForMouse` の false・`clearDeviceMetricsOverride` を送っても戻らなかった。
[描いた文書の表示を改善する（表の列の幅の自動計算・ファイルツリーの既定の全開き・コードブロックの帯の線の削除・目次で押した見出しのセクションを開く）](https://github.com/shuhei1101/mdmark/pull/505) は `test_normal_when_code_fold_column_hovered` をタッチのテストより前へ置いて避けている。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理と変更箇所の由来 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
