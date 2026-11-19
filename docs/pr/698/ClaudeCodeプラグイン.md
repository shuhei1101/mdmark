# Claude Code プラグイン

## 現状

| 分類 | ページ / ファイル | 概要 | 補足 |
| --- | --- | --- | --- |
| ドキュメント | [docs/library/LIB-472-29.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/library/LIB-472-29.yaml) | tmux の利用範囲と実測 | `verification` が手元の tmux サーバーでの結果 |
| ドキュメント | [docs/interface/IF-472-7.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-7.ts.yaml) | 常駐サーバーを起動する | 前提が `TMUX_TMPDIR` だけで分ける |
| ドキュメント | [docs/interface/IF-472-11.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-11.ts.yaml) | 端末の状態を調べる | 同上 |
| ドキュメント | [docs/interface/IF-472-12.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-12.ts.yaml) | 端末の設定を書き込む | 同上 |
| ドキュメント | [docs/interface/IF-472-14.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/interface/IF-472-14.ts.yaml) | 設定のキーの一覧を返却する | 同上 |
| ドキュメント | [docs/scenario/SC-472-22.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-22.yaml) | セッションの開始で常駐サーバーの状態を受け取る | 同上 |
| ドキュメント | [docs/scenario/SC-472-69.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/scenario/SC-472-69.yaml) | 端末に mdmark をセットアップする | 同上 |
| ドキュメント | [docs/module/MOD-472-12.ts.yaml](https://github.com/shuhei1101/mdmark/blob/develop/docs/module/MOD-472-12.ts.yaml) | 常駐サーバーの起動の `server.ts` のモジュール構成 | `test_start_with_tmux` の mock が `TMUX_TMPDIR` だけを記載 |
| テスト | [tests/integration/plugin.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/plugin.ts) | 結合テストの共通の準備 | `TMUX`・`TMUX_PANE` を子プロセスの環境から削除している |
| テスト | [tests/integration/terminal.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/integration/terminal.ts) | 一時の端末と tmux サーバー | 同上 |
| テスト | [tests/unit/src/plugin/setup/server.test.ts](https://github.com/shuhei1101/mdmark/blob/develop/tests/unit/src/plugin/setup/server.test.ts) | 常駐サーバーの起動の単体テスト | 環境を `HOME`・`PATH`・`MDMARK_*`・`TMUX_TMPDIR` だけで組み立て、`TMUX` を渡さない |

## 変更方針

| 対象 | 方針 | 補足 |
| --- | --- | --- |
| LIB-472-29 の `verification` | 手元の tmux サーバーの設定・セッションに触れない分け方で、`-e` の環境変数の渡り方・`has-session -t =` の完全一致・`default-shell` の既定を実測し直す | 分け方と、手元のサーバーの設定が変わっていないことの確かめ方も記載する |
| 設計書の前提（IF・SC・MOD） | `TMUX`・`TMUX_PANE` を除外した環境で `TMUX_TMPDIR` を空の一時フォルダの下にする分け方を記載する | [要件](./要件.md) の分け方 |
| テストのコード | 変えない | 既に設計書の前提の分け方で動いている |

## 設計書の確定コミット

| 工程 | 範囲 | 補足 |
| --- | --- | --- |
| 単一ユースケース設計 | `560c24a9..30c9e680` | - |
| インターフェース定義設計 | `30c9e680..13f01177` | - |
| モジュール構成設計 | `ccb0333e..99422a8e` | - |
