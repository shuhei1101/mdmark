# セットアップ

global-setup・setup のスキルが呼ぶ setup.js のサブコマンド

## 目次

<!-- table: data -->

| ページ | 概要 |
| --- | --- |
| [全体](./全体.yaml) | setup.js のフォルダ構成とスキルの配置場所 |
| [入口.ts](./入口.ts.yaml) | setup.js の入口とサブコマンドの振り分け |
| [パス.ts](./パス.ts.yaml) | 端末の設定・状態の配置場所・settings.json・unit のファイルのパスと起動の方法・unit の名前・tmux のセッション名 |
| [状態.ts](./状態.ts.yaml) | status の結果を作る |
| [キーの一覧.ts](./キーの一覧.ts.yaml) | keys の結果を作る |
| [書き込み.ts](./書き込み.ts.yaml) | write-settings・write-config と settings.json の env の書き換え |
| [起動.ts](./起動.ts.yaml) | start-server の起動の方法の決定・unit と tmux での起動・待ち受けの確認 |
| [systemd.ts](./systemd.ts.yaml) | systemd --user の確認・unit のファイルの組み立て・unit の状態の読み取り |

<!-- /table -->
