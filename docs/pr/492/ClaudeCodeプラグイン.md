# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| 実装 | [plugin/.claude-plugin/plugin.json](https://github.com/shuhei1101/mdmark/blob/e4a15bad/plugin/.claude-plugin/plugin.json) | プラグインの名前・バージョン・説明 | `version` を削除する |
| 実装 | [scripts/build-plugin.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/scripts/build-plugin.ts) | `writePluginManifest` が `plugin.json` の `version` を記載する | 削除する |
| 実装 | [src/plugin/setup/status.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/src/plugin/setup/status.ts)・[src/plugin/setup/server.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/src/plugin/setup/server.ts) | `target_version` と起動コマンドの `#v{バージョン}` を、ビルドで埋めた `__MDMARK_VERSION__` から作る | 出所は既に `version.ini`。コードは変えない見込み |
| ドキュメント | [docs/scenario/SC-472-4.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/scenario/SC-472-4.yaml) | プラグインを入れる | 更新で develop の commit が届くことを合わせる |
| ドキュメント | [docs/scenario/SC-472-69.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/scenario/SC-472-69.yaml) | 端末にセットアップする | 移行の目標のバージョンの出所の記述を合わせる |
| ドキュメント | [docs/interface/IF-472-11.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-11.ts.yaml)・[IF-472-12](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-12.ts.yaml)・[IF-472-8](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-8.ts.yaml)・[IF-472-7](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-7.ts.yaml)・[IF-472-9](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-9.ts.yaml)・[IF-472-13](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-13.ts.yaml) | 「プラグインのバージョン（`plugin.json` の `version`）」を移行の目標・雛形の `version`・同梱の配布物のバージョンにする | ビルドで埋めた mdmark のバージョンの記述に修正する |
| ドキュメント | [docs/interface/IF-472-41.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/interface/IF-472-41.ts.yaml) | 配布物のビルドが `plugin.json` の `version` を記載する | 記載しない振る舞いに修正する |
| ドキュメント | [docs/module/MOD-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-14.ts.yaml) | `writePluginManifest` の関数とテスト | 関数を削除する |
| ドキュメント | [docs/module/MOD-472-10.ts.yaml](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-10.ts.yaml)・[MOD-472-11](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-11.ts.yaml)・[MOD-472-12](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-12.ts.yaml)・[MOD-472-8](https://github.com/shuhei1101/mdmark/blob/e4a15bad/docs/module/MOD-472-8.ts.yaml) | 依存の「プラグインのバージョン」 | 呼び名を合わせる |
| テスト | [tests/unit/scripts/build-plugin.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/unit/scripts/build-plugin.test.ts)・[tests/unit/scripts/build.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/unit/scripts/build.test.ts)・[tests/integration/lib/build.test.ts](https://github.com/shuhei1101/mdmark/blob/e4a15bad/tests/integration/lib/build.test.ts) | `plugin.json` の `version` を確認するケース | `version` を記載しないことを確認するケースに修正する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| プラグインの定義 | `plugin.json` から `version` を削除し、`name`・`description` だけにする | - |
| ビルド | `writePluginManifest` と呼び出しを削除し、`plugin.json` を書き換えない | - |
| バージョンを参照する処理 | `__MDMARK_VERSION__`（`version.ini`）を出所にしたまま、設計書の出所の記述を合わせる | - |
| プラグインの更新 | `version` の無いプラグインが commit で更新されることを PoC で確認し、外部ライブラリの制約に記録する | - |
| `plugin/` の生成物 | スプリントの区切りの管理作業でビルドして入れる | `未確定`（要件.md の推奨 A。決める段: 単一ユースケース設計） |
| 既存機能への影響 | 雛形の `version`・常駐サーバーの起動コマンドのバージョンは今と同じ値になる | - |

## テスト結果

なし（テスト作成・実装で記入する）
