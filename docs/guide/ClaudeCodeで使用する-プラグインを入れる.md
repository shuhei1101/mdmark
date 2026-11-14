# プラグインを入れる

マーケットプレイスを追加してプラグインを入れ、次のセッションからツールとガイドへの動線を受け取る手順

Claude Code で mdmark の文書を記載し始める前に実行する。

## 前提

- 手元に Claude Code・git・Node 24 以降がある
- 手元から GitHub と npm のレジストリへ届く
- MCP の常駐サーバーは、入れた後に `/mdmark:global-setup` で起動する（[セットアップする](./ClaudeCodeで使用する-セットアップする.md)）。起動していなくてもプラグインは入るが、MCP サーバーだけが接続に失敗する
- ガイドを参照させるときは、mdmark のクローンを dev-docs の配信元 `mdmark` として登録している（`/dev-docs:setup`）。登録していなくてもツールは使用できるが、ガイドは見つからない

## 手順

### マーケットプレイスを追加する

#### リポジトリを追加する

```text
/plugin marketplace add shuhei1101/mdmark
```

ターミナルからは `claude plugin marketplace add shuhei1101/mdmark` で追加できる。
タグを記載しないと develop の最新を読み込み、develop に入った変更がプラグインの更新で届く。
バージョンを固定するときは `shuhei1101/mdmark#v{バージョン}` と、develop に打ったタグを記載する。
リポジトリの直下の `.claude-plugin/marketplace.json` を読み込み、プラグイン `mdmark` を記載する。

### プラグインを入れる

#### プラグインを入れる

```text
/plugin install mdmark@mdmark
```

ターミナルからは `claude plugin install mdmark@mdmark` で入れられる。
Claude Code が `plugin/` をキャッシュへ写す。
プラグインはまとめたフック・スクリプトとスキル（`global-setup`・`setup`）だけを持ち、依存を入れない。
フックは、MCP のツールの呼び出しの前に作業のフォルダを引数に入れ、`.mark.md` のファイルへの Write・Edit と語 mdmark を含む発言で、ガイドを参照してから記載するよう 1 つのセッションに 1 回案内する。

### 次のセッションを開く

プラグインは、入れた後に開くセッションから使用できる。
入れる前から開いているセッションには反映されない。

### 端末をセットアップする

次のセッションで `/mdmark:global-setup` を呼び、端末の設定と常駐サーバーを用意する（[セットアップする](./ClaudeCodeで使用する-セットアップする.md)）。

## 反映

次に開くセッションから。
そのセッションの開始で、MCP サーバー `plugin:mdmark:mdmark` が常駐サーバーの `http://127.0.0.1:${MDMARK_PORT:-8782}/mcp` へつながる。

## 確認

#### プラグインが有効になっている

```bash
claude plugin list
```

`mdmark@mdmark` が有効として出る。

#### MCP サーバーがつながっている

新しいセッションで `/mcp` を開く。
`plugin:mdmark:mdmark` がつながっていて、ツールが並ぶ（[MCP](./MCP.md)）。
接続に失敗しているときは、`/mdmark:global-setup` で常駐サーバーを起動してから、`/mcp` でもう一度接続する（[MCPサーバーを起動する](./ClaudeCodeで使用する-MCPサーバーを起動する.md)）。

#### ガイドを参照できる

```text
dev-docs で mdmark のガイドの一覧を出して
```

配信元 `mdmark` のタグ `topic:ガイド` のページが並ぶ。

## 更新する

```bash
claude plugin marketplace update mdmark
claude plugin update mdmark@mdmark
```

`plugin.json` はバージョンを持たず、プラグインのバージョンは commit の短縮 SHA になる。
マーケットプレイスの更新だけではプラグインは変わらず、`claude plugin update` で新しい commit に上がる。
Claude Code を起動し直すと反映される。

## 子プロセスで起動していたプラグインからの移行

MCP サーバーを子プロセス（stdio）で起動していたバージョンのプラグインを入れている場合、新しいバージョンのプラグインは、常駐サーバーを起動しないと MCP のツールを使用できない。

<!-- steps -->

1. 新しいバージョンのプラグインへ更新する
2. 常駐サーバーを起動する（[MCPサーバーを起動する](./ClaudeCodeで使用する-MCPサーバーを起動する.md)）
3. セッションをもう一度開く

<!-- /steps -->

## 元に戻す

```text
/plugin uninstall mdmark@mdmark
/plugin marketplace remove mdmark
```

プラグインとマーケットプレイスの追加を削除する。
手元の他のプラグインの設定は変わらない。
