# map の順番の再生に手順のバー・手順ごとの再生と速度・なめらかな移動を追加し、C4Container・C4Component・C4Dynamic・C4Deployment を描く

## 概要

読者が、map の案内・再生の手順のバーで手順の全体と今の位置を確認し、区切りか左右の矢印で離れた手順へ 1 回の操作で移ってその手順を繰り返し再生でき、手順を移すと関係するノードが収まる位置へ図がなめらかに移る。
文書の作成者が、map の範囲に C4Container・C4Component・C4Dynamic・C4Deployment の Mermaid を記載し、C4Context と同じ記載方法と操作で描ける。

## 背景

束の親 Issue [map の順番の再生に手順のバー・手順ごとの再生と速度・なめらかな移動を追加し、C4Container・C4Component・C4Dynamic・C4Deployment を描く](https://github.com/shuhei1101/mdmark/issues/658) の要望で、次の 2 件を 1 つの作業 PR で扱う。

- [図の順番の再生に、手順のバー・手順ごとの再生と速度・なめらかな移動を追加する](https://github.com/shuhei1101/mdmark/issues/603)
- [map で C4Container・C4Component・C4Dynamic・C4Deployment の Mermaid を、C4Context と同じ記載方法と操作で描く](https://github.com/shuhei1101/mdmark/issues/607)

#603 は、利用者の報告（手順の全体が分からず、離れた手順へ 1 回で移れない）と、DynamicArchitectViewer を動かして比べた調査から起票された。
今の案内・再生のバーは、今の手順の番号・タイトル・文と、前へ・停止・自動で進める・次へだけを持ち、自動で進めたときは強調したノードの中心へ表示する枠をスクロールするだけで倍率は変えない。

#607 は、[#564](https://github.com/shuhei1101/mdmark/issues/564) の作業 PR [#596](https://github.com/shuhei1101/mdmark/pull/596) のスコープ外から切り出した後続で、#596 が作った C4Context の読み取りと描画を前提に、残りの C4 の 4 種類を追加する。

## 計画書

| ファイル | 中身 |
| --- | --- |
| [要件](./要件.md) | 要望の整理 |
| [ライブラリ本体](./ライブラリ本体.md) | ライブラリ本体の計画書 |
