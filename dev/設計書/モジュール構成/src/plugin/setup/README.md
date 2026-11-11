# setup

setup の設計書

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [keys.ts](./keys.ts.yaml) | `keys` の結果を作る。 |
| [main.ts](./main.ts.yaml) | `setup.js` の入口とサブコマンドの振り分け。 |
| [paths.ts](./paths.ts.yaml) | 端末の設定・状態の配置場所・`settings.json`・unit のファイルのパスと、起動の方法・unit の名前・tmux のセッション名の読み取り。 |
| [server.ts](./server.ts.yaml) | `start-server` の起動の方法の決定・systemd --user の unit と tmux のセッションでの起動・待ち受けの確認。 |
| [status.ts](./status.ts.yaml) | `status` の結果を作る。 |
| [systemd.ts](./systemd.ts.yaml) | `start-server`・`status` が呼ぶ systemd --user の確認・unit のファイルの組み立て・unit の状態の読み取り。 |
| [write.ts](./write.ts.yaml) | `write-settings`・`write-config` と `settings.json` の `env` の書き換え。 |

<!-- /table -->
