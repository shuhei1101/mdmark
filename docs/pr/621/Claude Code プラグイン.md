# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/scenario/SC-472-69.yaml](https://github.com/shuhei1101/mdmark/blob/35edd638/docs/scenario/SC-472-69.yaml) | 端末に mdmark をセットアップする | 実行のみ |
| 実装 | [plugin/](https://github.com/shuhei1101/mdmark/tree/35edd638/plugin) | プラグインの定義と、配布物のビルドが記載するまとめたフック | 生成物は `dist/` と同じ時期にだけ commit する。マーケットプレイスは develop の commit を届ける |
| 実装 | [src/plugin/setup/server.ts](https://github.com/shuhei1101/mdmark/blob/35edd638/src/plugin/setup/server.ts) | 常駐サーバーの起動 | `npx -y github:shuhei1101/mdmark#{呼んだ CLI のバージョン} serve` で起動する |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| `plugin/` の生成物 | develop への push のワークフローで `dist/` と一緒に再作成して commit する | プラグインは develop の commit で届くため、フックと `dist/` が同じ commit の生成物になる |
| 常駐サーバーの取り出し元 | 埋めたバージョンが `+develop.` を含む develop のビルドは、起動コマンドを `npx -y github:shuhei1101/mdmark#develop serve` にし、端末の設定を作るときの `version` と状態の `target_version` を `develop` にする | `init` と同じ判定。起動コマンドを短縮 SHA にすると、生成物を含まない commit を取り出すため採らない |

## テスト結果

なし
