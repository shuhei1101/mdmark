# セットアップする

プラグインのスキルで、端末の設定と常駐サーバー、文書のフォルダの設定を、項目ごとに確認しながら用意する手順

| スキル | 単位 | すること |
| --- | --- | --- |
| `/mdmark:global-setup` | 端末ごとに 1 回。再インストール・端末の移行・プラグインの更新の後にも使用する | 端末の設定を作る・移行し、systemd --user の unit か tmux のセッションで常駐サーバーを起動して、つながることを確認する |
| `/mdmark:setup` | 文書のフォルダごと | 文書のフォルダの `mdmark.config.yaml` を作る・修正する |

## 前提

- [プラグインを入れる](./ClaudeCodeで使用する-プラグインを入れる.md)
- 手元に Node 24 以降と、systemd --user か tmux 3.4 以降のどちらかがある。どちらも無い端末は [MCPサーバーを起動する](./ClaudeCodeで使用する-MCPサーバーを起動する.md) の手順で起動する
- 手元から GitHub と npm のレジストリへ届く

## 手順

### 端末をセットアップする

#### `global-setup` を呼ぶ

```text
/mdmark:global-setup
```

Claude Code が次の順に進め、書き換える前に内容を示して確認を取る。

<!-- steps -->

1. 端末の設定のパスを示す。`MDMARK_CONFIG` が無ければ `${XDG_CONFIG_HOME:-~/.config}/mdmark/settings.yaml`
2. 端末の設定があり `version` が古ければ、`mdmark upgrade --settings` と同じ手順で移行する。無ければ雛形から作る
3. 設定のキーを 1 つずつ、今の値と既定を示して聞く
4. 回答した値で端末の設定を書き込む。パスが既定と違うときは、`~/.claude/settings.json` の `env` に `MDMARK_CONFIG` を書き込む
5. 常駐サーバーを起動し、`tools/list` でつながることを確認する。既に待ち受けていればもう一度起動しない
6. 作ったもの・書き込んだキー・常駐サーバーが動いている unit かセッション・ログの確認方法・止め方を示す

<!-- /steps -->

常駐サーバーを起動する方法は、端末の設定の `serve.launcher`（既定 `auto`）で決まる。

| 端末 | 起動の方法 | ログ | 止め方 |
| --- | --- | --- | --- |
| systemd --user が使える（systemd を有効にした WSL・Linux） | unit `mdmark-mcp`（`serve.systemdUnit` で変える）。端末を起動し直しても自動で起動する | `journalctl --user -u mdmark-mcp` | `systemctl --user disable --now mdmark-mcp` |
| systemd --user が使えない（macOS など）か、`serve.launcher` を `tmux` にした | tmux のセッション `mdmark-mcp`（`serve.tmuxSession` で変える） | `${XDG_STATE_HOME:-~/.local/state}/mdmark/serve.log`（`MDMARK_STATE_DIR` で変える） | `tmux kill-session -t =mdmark-mcp` |

起動の方法を変えると、前の方法で動いている常駐サーバーを止めてから起動する。
書き込むことを断ると、端末の設定と `settings.json` は書き換えない。端末の設定が無いまま断ったときは、unit のファイルも作らずに tmux のセッションで起動する。
既に unit で常駐サーバーが動いている端末では、その unit をそのまま使用する。

### 文書のフォルダをセットアップする

#### `setup` を呼ぶ

文書のフォルダを作業のフォルダにしたセッションで呼ぶ。

```text
/mdmark:setup
```

`mdmark.config.yaml` のキーを 1 つずつ、今の値・端末の設定で重なる値・既定を示して聞き、回答した値で書き込む。
無ければ `mdmark init` と同じ雛形から作り、あれば回答したキーだけを書き換えて、コメントとほかのキーを残す。
端末の設定だけが持つキー（`config.*`・`serve.*`）は聞かない。

## 反映

端末の設定と `mdmark.config.yaml` は、次のツールの呼び出しから読み込まれる。
`settings.json` の `env` を書き込んだときは、セッションをもう一度開く。
常駐サーバーを起動したセッションは、`/mcp` で `plugin:mdmark:mdmark` をもう一度接続するとツールを呼べる。

## 確認

#### 常駐サーバーが動いている

<!-- tabs -->

##### systemd --user

```bash
systemctl --user is-active mdmark-mcp && journalctl --user -u mdmark-mcp -n 20 --no-pager
```

##### tmux

```bash
tmux has-session -t =mdmark-mcp && tail -n 20 ~/.local/state/mdmark/serve.log
```

<!-- /tabs -->

ログに `http://127.0.0.1:{ポート}/mcp` の行がある。

#### セッションの開始で通知が出ない

新しいセッションを開いても、常駐サーバーが待ち受けていないことの通知が出ない。

## 元に戻す

```bash
systemctl --user disable --now mdmark-mcp   # systemd --user で動かしているとき
tmux kill-session -t =mdmark-mcp            # tmux で動かしているとき
```

常駐サーバーを止める。
unit のファイル `~/.config/systemd/user/mdmark-mcp.service` は残るので、要らなければ削除して `systemctl --user daemon-reload` を実行する。
作った端末の設定・`mdmark.config.yaml`・`settings.json` の `env` の `MDMARK_CONFIG` は残るので、要らなければ削除する。
