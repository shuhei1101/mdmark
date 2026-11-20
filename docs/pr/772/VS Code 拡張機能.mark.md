# VS Code 拡張機能

## 書き出した HTML に元の Markdown を埋め込まない（#769）

### 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-6.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/scenario/SC-472-6.yaml) | HTMLに書き出す | 書き出した HTML を開いたときの流れを、描いた HTML から起動する流れに変える |
| ドキュメント | [docs/scenario/SC-472-9.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/scenario/SC-472-9.yaml) | PDFに印刷する | SC-472-6 に追随する |
| ドキュメント | [docs/interface/IF-472-15.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-15.ts.yaml) | HTMLに書き出す | 制約「書き出す中身」が `TextDocument.getText()` の全文を `<script type="application/json">` に埋め、`mount(..., { markdown, config })` で描く |
| ドキュメント | [docs/interface/IF-472-16.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-16.ts.yaml) | PDFに印刷する | IF-472-15 と同じ組み立てを使う |
| ドキュメント | [docs/interface/IF-472-18.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-18.ts.yaml) | ブラウザで開く | 同上 |
| ドキュメント | [docs/module/MOD-472-99.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-99.ts.yaml) | export.ts | `document.getText()` を組み立てへ渡す |
| ドキュメント | [docs/module/MOD-472-100.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-100.ts.yaml) | html.ts | `buildExportHtml` が本文と設定の JSON と `mount` を呼ぶスクリプトを組む |
| ドキュメント | [docs/module/MOD-472-102.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/module/MOD-472-102.ts.yaml) | embed.ts | 相対パスのライブラリと範囲のスクリプトを埋める（描いた HTML でも要るかを確認する） |
| ドキュメント | [docs/interface/IF-472-35.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/interface/IF-472-35.ts.yaml) | 文書を描く | `opts.rendered`・`opts.pureMarkdown`（#753 で追加）。変更は無い見込み |
| ドキュメント | [docs/screen/SCR-472-1.ts.yaml](https://github.com/shuhei1101/mdmark/blob/133b1da5/docs/screen/SCR-472-1.ts.yaml) | VS Code のコマンドと通知 | 配布物を取得できないとき・描いた HTML から起動できないバージョンのときの通知を追加する |
| 実装 | [vscode/src/export/export.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/src/export/export.ts) | 書き出し・ブラウザで開く・印刷のコマンド | - |
| 実装 | [vscode/src/export/html.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/src/export/html.ts) | 書き出す HTML の組み立て | `data.markdown` を `mount` に指定する |
| 実装 | [vscode/tests/integration/export.test.ts](https://github.com/shuhei1101/mdmark/blob/133b1da5/vscode/tests/integration/export.test.ts) | 書き出しの結合テスト | 埋めた JSON の中身の確認を変える |

### 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| 描く処理の在りか | 書き出すときに、設定のバージョンの配布物で `render`・`toPureMarkdown` を呼んで描く | 取得した `dist/index.js` はバージョンごとに拡張機能の保存先に置く（[要件](./要件.mark.md) の #769） |
| 書き出す中身 | 埋める JSON から `markdown` を削除し、描いた結果（本文の HTML・機能のオン・オフ・ページの設定）と純粋な Markdown を持たせる | CLI の `ExportPayload`（#753）と同じ持ち方に揃える |
| 開いたときの起動 | `mount(main, { rendered, pureMarkdown, config, aliases })` で描き、外部ライブラリ・拡張のマーカーは残したマーカーの場所にモジュールで描く | 印刷を待つ処理は今のまま |
| 取り込み | 取り込む文書の本文は描いた HTML に入れ、Markdown を埋めない | - |
| 通知 | 配布物を取得できないとき・`opts.rendered` を持たないバージョンのときに書き出さず通知を出す | 文言は画面設計（SCR-472-1） |
| 確認 | 書き出した HTML に元の Markdown の文字列（マーカー・生の HTML）が含まれないことと、開いて描き終えた本文が今と同じであることを結合テストで確認する | - |

## テスト結果

ドキュメント修正（`docs/guide/` の 5 ページ）は、規約『V字モデル』の対応表で対応する単体・結合テストが無いため回していない（ガイドのページはコードを持たない）。

### 単体テスト

| 実行 | 結果 | ログ |
| --- | --- | --- |
| 実装の前（変更したテストファイルだけ） | Red（25 件の fail は全て実装が無いことによる） | [20261121040152_56ef4e06_単体テスト.log](./テスト結果/20261121040152_56ef4e06_単体テスト.log) |
| 実装の後（ランナーで全件） | 全 pass（331 ファイル・2780 件） | [20261121042430_26a5cb96_単体テスト.log](./テスト結果/20261121042430_26a5cb96_単体テスト.log) |
| lint | 終了コード 0 | [20261121041449_26a5cb96_lint.log](./テスト結果/20261121041449_26a5cb96_lint.log) |

### テストの期待値を直したテスト

| テスト | 理由 |
| --- | --- |
| `tests/unit/src/map/layout.test.ts` の `test_layout_map_when_name_fits_with_right_padding`・`test_layout_map_when_width_with_right_padding`・`test_layout_map_when_pill_padding`・`test_leaf_height`・`test_estimate_text_width` | 設計書の期待値が名前の文字の大きさ 14px のままだった。`LABEL_METRICS.nameSize` を 13px にした設計に合わせ、設計書（[e861d6cf](https://github.com/shuhei1101/mdmark/commit/e861d6cf)）とテスト（[e4fe9e18](https://github.com/shuhei1101/mdmark/commit/e4fe9e18)）を直した |
| `tests/unit/src/map/mindmap-view.browser.test.ts` の `test_attach_map_mindmap_when_selected` | 「目的」の項目のキーは id の `a1` で、`selected` に `目的` が入らない。id を持たない「予算」に、設計書（[0fbd47f9](https://github.com/shuhei1101/mdmark/commit/0fbd47f9)）とテスト（[69a0b63d](https://github.com/shuhei1101/mdmark/commit/69a0b63d)）を直した |
| `tests/unit/src/map/flow-view.browser.test.ts` の `test_attach_map_flow_when_crowded` | 押せる範囲が `path` から `g` と区間ごとの帯に変わり、`d` を読めない。並べた線の点を帯の矩形で確かめる形にした（[69a0b63d](https://github.com/shuhei1101/mdmark/commit/69a0b63d)） |

### 結合テストの実行範囲

層は TL-3（結合テスト（フロント））。`judge_integration_scope` は層に一覧と対応表が無く、全てのファイルが R7（要調査）だったため、変更したファイルを参照する結合テストを調べて決めた。

<!-- table: {"kind": "data"} -->

| 変更したファイル | 結果 | 実行する結合テスト | 結合テストが無い入口 |
| --- | --- | --- | --- |
| `docs/` の設計書・ガイド・モック・PR ドキュメント | R7 | なし（結合テストが読み込まない） | - |
| `tests/unit/` のテスト | R7 | なし（単体テストの層） | - |
| `src/map/layout.ts`・`src/map/map.part.ts`・`src/map/flow-view.ts`・`src/map/sequence-view.ts`・`src/map/drag.ts`・`src/map/class-view.ts`・`src/map/c4-view.ts`・`src/map/mindmap-layout.ts`・`src/map/mindmap-view.ts`・`src/index.css` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`（map の部品の描画と操作。線の押せる範囲・端の位置・文字の大きさを使う）と `tests/integration/lib/mount.browser.test.ts`（IF-472-35 の `test_file`） | - |
| `scripts/storybook-render.ts` | R7 | 上の `map-*.story.test.ts`（部品の描画のインターフェースが Storybook に返す図） | - |
| `src/mount.ts`・`src/index.ts` | R7 | `tests/integration/lib/render-for-mount.test.ts`（新規。IF-472-51 の `test_file`）・`tests/integration/lib/mount.browser.test.ts` | - |
| `src/cli/export.ts` | R7 | `tests/integration/lib/export.test.ts`（IF-472-33 の `test_file`） | - |
| `vscode/src/export/dist.ts`・`vscode/src/export/export.ts`・`vscode/src/export/html.ts` | R7 | `vscode/tests/integration/export.test.ts`（TP-472-1 の補足「VS Code 拡張機能」のコマンドで実行） | IF-472-15 は `test_file` を持たない。VS Code 拡張機能の結合テストの `export.test.ts` で確認する |

<!-- /table -->

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `133b1da5..fe3b8046` | - |
| 単一ユースケース設計 | `fe3b8046..f7f72394` | レビューの指摘の修正 |
| インターフェース定義設計 | `9e0a8e97..aad634c7` | - |
| インターフェース定義設計 | `ebd2244d..57b60672` | レビューの指摘の修正 |
| 画面設計 | `9a1d8815..f16e2411` | - |
| 画面設計 | `ee052719..b165a4bc` | レビューの指摘の修正 |
| モジュール構成設計 | `e009287c..eafe9d89` | - |
| インターフェース定義設計・モジュール構成設計（レビュー指摘の反映） | `48dc739c..54a0a9db` | - |
| モジュール構成設計（単体テスト作成で見つけた食い違いの修正） | `0558fb9d..7e03796d` | - |
