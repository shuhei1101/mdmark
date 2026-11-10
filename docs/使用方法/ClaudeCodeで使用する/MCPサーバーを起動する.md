# MCPサーバーを起動する

MCP の常駐サーバーを起動・停止し、待ち受けているポートを確認する手順

プラグインの MCP サーバー `plugin:mdmark:mdmark` は、`mdmark serve` が常駐させるサーバーへ HTTP でつなぐ。
プラグインを入れた後、MCP のツールを使用する前に、端末で 1 回起動する。
[セットアップする](./セットアップする.md) の `/mdmark:global-setup` は、systemd --user の unit か tmux のセッションでこの起動をする。
並行して開いたセッションは、同じプロセスのツールを呼ぶ。

## 前提

- [プラグインを入れる](./プラグインを入れる.md)
- 手元に Node 24 以降がある
- 手元から GitHub と npm のレジストリへ届く

## 手順

### 常駐サーバーを起動する

#### `global-setup` で起動する

```text
/mdmark:global-setup
```

systemd --user が使える端末では unit `mdmark-mcp`（端末の設定の `serve.systemdUnit` で変える）を `~/.config/systemd/user/` に作って `enable --now` し、ログを journal に出す。
端末を起動し直しても、unit が自動で起動する。
使えない端末か、端末の設定の `serve.launcher` を `tmux` にした端末では、tmux のセッション `mdmark-mcp`（`serve.tmuxSession` で変える）で `serve` を起動し、ログを `${XDG_STATE_HOME:-~/.local/state}/mdmark/serve.log` に書き込む。
既に待ち受けていれば、もう一度起動しない。

#### 端末で `serve` を起動する

systemd --user も tmux も無い端末では、端末を開いたまま `serve` を動かす。

```bash
npx github:shuhei1101/mdmark#v{バージョン} serve
```

`{バージョン}` は使用するバージョンの `{MAJOR}.{MINOR}.{PATCH}`。
初回の起動は依存を取るため、待つ。
起動のコマンドは、バージョンをまたいで変わらない。

待ち受けると、接続先の URL を標準出力に 1 行出し、端末を開いたまま動き続ける。

```text
MCP サーバーを起動しました: http://127.0.0.1:8782/mcp
```

`127.0.0.1` の `/mcp` だけを待ち受ける。
ほかのパスは 404、`Host` や `Origin` が localhost でないリクエストは 403 で返却する。

### 待ち受けているポートを確認する

#### 出力の URL を読み込む

起動したときの出力の URL のポートが、待ち受けているポート。
既定は 8782、`MDMARK_PORT` を指定したときはそのポート。

#### 別の端末から確認する

<!-- tabs: group=os -->

##### macOS・Linux

```bash
lsof -iTCP:8782 -sTCP:LISTEN
```

##### Windows

```powershell
Get-NetTCPConnection -LocalPort 8782 -State Listen
```

<!-- /tabs -->

待ち受けているプロセスが 1 つ出る。

### Claude Code からつなぐ

#### 起動してからセッションを開く

常駐サーバーを起動した後に開いたセッションは、`plugin:mdmark:mdmark` がつながる。

#### 起動していなかったセッションをもう一度つなぐ

常駐サーバーが起動していないと、そのセッションでは MCP サーバー `plugin:mdmark:mdmark` だけが接続に失敗する（`ECONNREFUSED`）。
セッションの開始で、プラグインの SessionStart のフックが、待ち受けていないことと `/mdmark:global-setup` で起動できることを 1 行で伝える。
ほかの MCP サーバーとセッションは使用できる。

常駐サーバーを起動した後、同じセッションで `/mcp` を開き、`plugin:mdmark:mdmark` を選んでもう一度接続する（Reconnect）。
セッションをもう一度開かずに、ツールを呼べる。

### ポートを変える

#### `MDMARK_PORT` を両方に設定する

既定のポート 8782 をほかのプロセスが使用しているとき、`serve` は待ち受けずに、理由と修正方法を標準エラーに出して終了コード 1 で終わる。
Claude Code の接続先も同じ環境変数で決まるため、`~/.claude/settings.json` の `env` と、`serve` を起動する環境の両方に同じ `MDMARK_PORT` を設定する。

```json
{
  "env": {
    "MDMARK_PORT": "18782"
  }
}
```

```bash
MDMARK_PORT=18782 npx github:shuhei1101/mdmark#v{バージョン} serve
```

PowerShell では、先に `$env:MDMARK_PORT = "18782"` を実行する。
`/mdmark:global-setup` で起動するときは、`settings.json` の `env` だけを変えてセッションをもう一度開き、もう一度呼ぶ。unit と tmux のセッションへは、その値を指定する。
`~/.claude/settings.json` を変えた後は、セッションをもう一度開く。

`MDMARK_PORT` は 1〜65535 の整数。
整数でない値を指定すると、`serve` は待ち受けずに終了コード 1 で終わる。
`serve` が既に起動しているときは、もう一度起動せずにそのまま使用できる。

### 止める

#### unit を止める

```bash
systemctl --user disable --now mdmark-mcp
```

unit を止め、端末の起動時にも起動しないようにする。

#### tmux のセッションを止める

```bash
tmux kill-session -t =mdmark-mcp
```

セッションを閉じると `serve` も終わる。

#### 端末で止める

`serve` を動かしている端末で `Ctrl+C` を押す。
待ち受けを閉じて、終了コード 0 で終わる。
止めている間、Claude Code では MCP サーバー `plugin:mdmark:mdmark` が接続に失敗する。

## 反映

起動した常駐サーバーに、MCP のツールの呼び出しが届く。
起動する前に開いたセッションは、`/mcp` でもう一度接続した後から。

## 確認

#### 常駐サーバーが待ち受けている

起動の出力（unit で起動したときは `journalctl --user -u mdmark-mcp`、tmux のセッションで起動したときは `serve.log`）に `http://127.0.0.1:{ポート}/mcp` が出て、そのポートで待ち受けるプロセスがある。

#### MCP サーバーがつながっている

セッションで `/mcp` を開く。
`plugin:mdmark:mdmark` がつながっていて、ツールが並ぶ（[MCP](../../リファレンス/MCP.md)）。

## 元に戻す

`systemctl --user disable --now mdmark-mcp`・`tmux kill-session -t =mdmark-mcp`・`Ctrl+C` のどれかで常駐サーバーを止める。
プラグインは入ったまま残る。
削除するには [プラグインを入れる](./プラグインを入れる.md) の「元に戻す」。
