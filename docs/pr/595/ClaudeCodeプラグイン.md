# ClaudeCodeプラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [guide/index.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/index.yaml)・[guide/files.yaml](https://github.com/shuhei1101/mdmark/blob/develop/guide/files.yaml) | ガイドの索引の原本と管理用の YAML（直下の `guide/` の中身はこの 2 つだけ） | 移す |
| ドキュメント | [docs/er/ER-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/er/ER-472-4.yaml) | ER 図『ガイド』。原本の置き場所と `page` の例 | 更新対象 |
| ドキュメント | [docs/module/MOD-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-14.ts.yaml)・[docs/module/MOD-472-166.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-166.ts.yaml) | プラグインのビルドのモジュール構成（`GUIDE_SOURCE`）とテスト | 更新対象 |
| ドキュメント | [docs/scenario/SC-472-15.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-15.yaml)・[docs/scenario/SC-472-85.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-85.yaml) | ガイドを参照する・Claude Code でガイドを参照して記載し点検する | 更新対象 |
| ドキュメント | [docs/dev-command/CMD-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/dev-command/CMD-472-1.yaml) | ビルドの開発コマンド | 更新対象 |
| ドキュメント | [docs/layout/LAY-472-1.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/layout/LAY-472-1.yaml) | フォルダ構成の設計書 | 更新対象 |
| 設定 | [dev-docs.yaml](https://github.com/shuhei1101/mdmark/blob/develop/dev-docs.yaml) | 配信元の `id: guide` の行（`paths: [guide/files.yaml]`） | 更新対象 |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/scripts/build-plugin.ts) | `GUIDE_SOURCE`（`guide/index.yaml`） | 移し先のパスへ |
| テスト | [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts)・[tests/unit/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build.test.ts) | 一時フォルダに `guide/index.yaml` を配置する | 移し先のパスへ |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| ガイドの索引の置き場所 | `guide/index.yaml` を `plugin/guide-index.yaml` へ移し、`guide/files.yaml` の行を `plugin/files.yaml` へ移して、直下の `guide/` を削除する | 案と判定は `要件.md` |
| ガイドの索引の `page` | 改名したガイドのページの `page` を `.mark.md` へ合わせる。ビルドの検査（指すページの有無）が通ることを確認する | - |
| ビルドの読み込み先 | `GUIDE_SOURCE` を移し先のパスにし、テストの一時フォルダの配置とエラーの文のパスを合わせる | - |
| 配信元の行 | `dev-docs.yaml` の `id: guide` の行を削除し（`id: plugin` の行が `plugin/files.yaml` を配信する）、`description` が指すガイドのページのパスを合わせる | - |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `ab346d56..c9f7be6b` | - |
| インターフェース定義設計 | `136411c4..a39704c6` | 一体の ER 図『ガイド』（ER-472-4） |
| モジュール構成設計 | `bfbc338b..12f965d5` | MOD-472-14・MOD-472-166・一体のフォルダ構成（LAY-472-1）・IF-472-41 の言い回し |

## テスト結果

### 結合テストの実行範囲

[ライブラリ本体](./ライブラリ本体.md) の「結合テストの実行範囲」の表にまとめた（`tests/integration/lib/build.test.ts` の行）。

### 結合

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/integration/lib/build.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/lib/build.test.ts) | 全実行 | 実行のみ | ❌ | 5 pass・3 fail。fail は `dist/index.js` の上限超えで、develop でも同じ 3 件が fail する（[ビルドの結合テスト 3 件が、dist/index.js が配布ファイルの上限（688128 バイト）を超えて fail する](https://github.com/shuhei1101/mdmark/issues/601)）。実際の `plugin/guide-index.yaml` は `checkGuideSource` の検査を通った（22 行・問題 0）<br>`テスト結果/20261115223312_5801dc20_結合テスト.log` |
| [tests/integration/plugin-inputs.ts](https://github.com/shuhei1101/mdmark/blob/docs/guide/mark-md-extension-and-index-placement/tests/integration/plugin-inputs.ts) | - | 変更 | ✅ | 結合テストの準備（`global-setup.ts`）と `build.test.ts` の準備で通った |

### 単体

| ファイル | メソッド | 変更種別 | 結果 | 補足 |
| --- | --- | --- | --- | --- |
| [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build-plugin.test.ts) | 全実行 | 変更 | ✅ | 索引のパスを `plugin/guide-index.yaml` に合わせた<br>`テスト結果/20261115205202_ee84d144_単体テスト.log` |
| [tests/unit/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/scripts/build.test.ts) | 全実行 | 変更 | ✅ | 索引のパスを `plugin/guide-index.yaml` に合わせた |

ドキュメント修正の工程では、単体・結合テストを実行していない。
改名したページを参照するテスト（`tests/unit/helpers/diagrams.ts`・`tests/unit/scripts/build-plugin.test.ts`・`tests/unit/scripts/build.test.ts`・`upgrade` の単体と結合のテスト）は、この時点で旧パスを参照して fail する。単体テスト作成・実装・結合テスト作成の工程で新しいパスに合わせ、そこで実行する。
