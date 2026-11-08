---
name: global-setup
description: 端末ごとに 1 回、mdmark の端末の設定を作る・移行し、tmux のセッションで MCP の常駐サーバーを起動して、つながることを確認する。再インストール・端末の移行・プラグインの更新の後と、常駐サーバーが待ち受けていないと伝わったときにも使用する
allowed-tools: Bash(node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js *), Bash(node ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js), Bash(npx -y github:shuhei1101/mdmark*)
---

# mdmark の端末のセットアップ

決まった処理は `node ${CLAUDE_PLUGIN_ROOT}/bin/setup.js {サブコマンド}` で実行する。
結果は標準出力の JSON の 1 行、誤りは標準エラーの文で返る。

## 手順

1. `setup.js status` を実行し、端末の設定のパス・バージョン・tmux のセッション名・待ち受けているかを利用者に示す
2. 端末の設定があり、`settings.version` が `settings.target_version` より古ければ、`npx -y github:shuhei1101/mdmark#{target_version} upgrade --settings --plan` で適用する手順を示し、利用者が認めたら `--plan` を削除して実行する
3. `setup.js keys --target settings` を実行し、キーを 1 つずつ、今の値と既定と説明を示して、そのままにするか変えるかを利用者に聞く
4. 変えるキーと値を示し、記載してよいかを利用者に聞く。認めたら `setup.js write-settings --set {キー}={値} ...` を実行する（変えるキーが無く、端末の設定が無いときも、認めたら `--set` 無しで実行して雛形から作る）。断ったら記載せずに次へ進む
5. `setup.js start-server` を実行する
   - 終了コード 2: tmux が無い。標準エラーのコマンドを、端末を開いたまま動かすよう利用者に示す
   - 終了コード 1・3: 標準エラーの理由と修正方法を利用者に示す
6. `node ${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js` を実行する。標準出力が空で終了コード 0 なら、フックが動き常駐サーバーが待ち受けていると示す。1 行が出たら、その文を利用者に示す
7. 常駐サーバーが待ち受けていれば、`/mcp` で `plugin:mdmark:mdmark` をもう一度接続するよう利用者に示す
8. 作った・記載したファイル、`settings.json` に書き込んだキー、tmux のセッション名、ログのパス、止める操作（`stop`）を示す

`settings.json` の `env` を書き込んだときは、セッションをもう一度開くと次のセッションから有効になる。
