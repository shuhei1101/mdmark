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
| レビュー指摘の反映の後（ランナーで全件） | 全 pass（331 ファイル・2781 件） | [20261121043327_89d56736_単体テスト.log](./テスト結果/20261121043327_89d56736_単体テスト.log) |
| lint（レビュー指摘の反映の後） | 終了コード 0 | [20261121043327_89d56736_lint.log](./テスト結果/20261121043327_89d56736_lint.log) |

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
| `docs/component/CMP-472-4.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/component/CMP-472-5.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/component/CMP-531-1.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/component/CMP-596-1.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/component/CMP-649-1.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/guide/API.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/guide/VSCodeで確認する-HTMLとPDFにする.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/guide/VSCode拡張機能.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/guide/図を描く-Mermaidと補足で図を描く.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/guide/構成図の決まり.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/interface/IF-472-15.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/interface/IF-472-35.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/interface/IF-472-51.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/interface/README.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/interface/index.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/components/index.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/components/map-mindmap-item/index.html` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/components/map-node-text/index.html` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/components/map-wire-hit/index.html` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/components/map-wire-ports/index.html` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/files.yml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/refs/772/assets/mock.css` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/refs/772/assets/mock.js` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/refs/772/index.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/mock/refs/index.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-100.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-120.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-130.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-133.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-141.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-170.css.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-203.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-369.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-472-99.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-596-4.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-596-6.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-649-2.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/MOD-649-3.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/README.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/module/index.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/README.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/VS Code 拡張機能.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/タスク一覧.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/テスト結果/20261121040152_56ef4e06_単体テスト.log` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/テスト結果/20261121041449_26a5cb96_lint.log` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/テスト結果/20261121042430_26a5cb96_単体テスト.log` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/ライブラリ本体.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/確認ログ.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/要件.mark.md` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/要件.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-19.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-39.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-40.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-42.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-6.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-73.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-8.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/scenario/SC-472-9.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `docs/screen/SCR-472-1.ts.yaml` | R7 | なし（結合テストが読み込まない） | - |
| `scripts/storybook-render.ts` | R7 | `tests/integration/lib/map-*.story.test.ts`（部品の描画のインターフェースが Storybook に返す図） | - |
| `src/cli/export.ts` | R7 | `tests/integration/lib/export.test.ts`（IF-472-33 の `test_file`） | - |
| `src/index.css` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/index.ts` | R7 | `tests/integration/lib/render-for-mount.test.ts`（新規。IF-472-51 の `test_file`）・`tests/integration/lib/mount.browser.test.ts` | - |
| `src/map/c4-view.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/class-view.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/drag.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/flow-view.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/layout.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/map.part.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/mindmap-layout.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/mindmap-view.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/map/sequence-view.ts` | R7 | `tests/integration/lib/map-flow.story.test.ts`・`map-sequence.story.test.ts`・`map-er.story.test.ts`・`map-class.story.test.ts`・`map-c4.story.test.ts`・`map-mindmap.story.test.ts`・`map-state.story.test.ts`・`map-architecture.story.test.ts`・`map-band.story.test.ts`・`map-list.story.test.ts`・`map-axis-grid.story.test.ts`・`tests/integration/lib/mount.browser.test.ts`（map の部品の描画と操作） | - |
| `src/mount.ts` | R7 | `tests/integration/lib/render-for-mount.test.ts`（新規。IF-472-51 の `test_file`）・`tests/integration/lib/mount.browser.test.ts` | - |
| `tests/files.yaml` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/map/flow-view.browser.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/map/layout.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/map/map.part.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/map/mindmap-layout.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/map/mindmap-view.browser.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/src/mount.browser.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/vscode/src/export/dist.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `tests/unit/vscode/src/export/html.test.ts` | R7 | なし（結合テストの実行に影響しない） | - |
| `vscode/files.yaml` | R7 | なし（結合テストの実行に影響しない） | - |
| `vscode/src/export/dist.ts` | R7 | `vscode/tests/integration/export.test.ts`（TP-472-1 の補足「VS Code 拡張機能」のコマンドで実行） | IF-472-15 は `test_file` を持たない。VS Code 拡張機能の結合テストの `export.test.ts` で確認する |
| `vscode/src/export/export.ts` | R7 | `vscode/tests/integration/export.test.ts`（TP-472-1 の補足「VS Code 拡張機能」のコマンドで実行） | IF-472-15 は `test_file` を持たない。VS Code 拡張機能の結合テストの `export.test.ts` で確認する |
| `vscode/src/export/html.ts` | R7 | `vscode/tests/integration/export.test.ts`（TP-472-1 の補足「VS Code 拡張機能」のコマンドで実行） | IF-472-15 は `test_file` を持たない。VS Code 拡張機能の結合テストの `export.test.ts` で確認する |
| `docs/pr/772/テスト結果/20261121043327_89d56736_lint.log` | R7 | なし（結合テストが読み込まない） | - |
| `docs/pr/772/テスト結果/20261121043327_89d56736_単体テスト.log` | R7 | なし（結合テストが読み込まない） | - |

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
| モジュール構成設計・画面設計（実装で見つけた食い違いの修正） | `e861d6cf`・`0fbd47f9`・`1bdbf283` | layout.ts の単体テストの期待値（13px）・マインドマップの選び方のテストの項目・起動できないバージョンの通知の条件 |
| モジュール構成設計・インターフェース定義設計（レビュー指摘の反映。develop の配布物） | `6337ab52` | MOD-472-369・IF-472-15 |
