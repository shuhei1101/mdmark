# MCP のツールを使う

使い方集を dev-docs で参照させ、文書の書き出し・まとめ・点検を Claude Code から呼ぶ手順

プラグインを入れた後、Claude Code に mdmark の文書を書かせるとき、書き出し・点検を頼むときに実行する。
ツールの引数・戻り値・エラーは [MCP](../../リファレンス/MCP.md)。

## 前提

- [プラグインを入れる](./プラグインを入れる.md)
- [常駐サーバーを起動している](./MCPサーバーを起動する.md)
- 設定ファイル `mdmark.config.yaml` をセッションのフォルダか上のフォルダに置いている（[雛形を置く](../書き出す/雛形を置く.md)）
- 使い方集を参照させるときは、mdmark のクローンを dev-docs の配信元 `mdmark` として登録している（[プラグインを入れる](./プラグインを入れる.md)）

## 手順

### 使い方集を参照させる

#### mdmark の文書を書くよう頼む

記法・部品・図の描き方・拡張の仕方を使う作業を頼むと、Claude Code が MCP サーバーの `instructions` に従い、dev-docs の `search_docs` で配信元 `mdmark` の `docs` の行をタグ `topic:使い方集` で絞って一覧を検索し、作業に要るページの本文を参照してから書く。

```text
表に並べ替えを付けて、設計書の一覧を書いて
```

dev-docs が無い、または配信元 `mdmark` が登録されていないときは、使い方集を参照せずに書く。
書いた後に `check` で点検させる。

### 点検する

#### `check` を呼ばせる

```text
mdmark の設定と索引を点検して
```

`check` が `mdmark check` と同じ点検をして、ずれの一覧（ファイル・場所・種類・内容）を返す。
ずれがあってもエラーにならず、設定・索引・文書は書き換わらない。
内容に従って直させ、`issues` が空になるまで繰り返す。

YAML のキーの値や文字列に書いた記法を点検するときは、`check` に `file`・`key` か `text` を渡すよう頼む。
描いたときの書き方の警告・知らない印・図の配置のずれを、同じずれの一覧で返す。

```text
records.yaml の items[0].body に書いた記法を mdmark で点検して
```

`change_together` の組のうち片方の文書だけを直したことも点検するときは、比べる基準の git の ref を `base` に渡すよう頼む。

```text
origin/develop を基準に、mdmark の設定と索引を点検して
```

基準と HEAD の merge-base から変わった文書を比べ、片方だけが変わった組を `missed_change_together` で返す。
`base` を省くと、直し忘れは点検しない。

### 文書を書き出す・まとめる

#### `export_html` と `build_site` を呼ばせる

```text
docs/guide.md を 1 枚の HTML に書き出して
```

```text
設定の build の文書を 1 枚の HTML にまとめて
```

`export_html` が `mdmark export`、`build_site` が `mdmark build` と同じ処理で HTML を書き、書いたパスと警告を返す。
同じ文書・設定では、CLI と同じ中身の HTML になる。

### 設定ファイルの場所を決める

ツールの `config` を省くと、Claude Code のセッションのフォルダから上のフォルダへ順に `mdmark.config.yaml` を探す。
別の設定ファイルを使うときは、そのパスを `config` に渡すよう頼む。

## 反映

ツールを呼ぶたびに、その場の設定・索引・文書を読む。
`export_html`・`build_site` は HTML を書く。

## 確認

#### 点検のずれが 0 件になっている

`check` を呼ばせ、`issues` が空になる。

#### 書き出した HTML がある

`export_html` と `build_site` が返した `out` のファイルがある。

## 元に戻す

`check` は何も書き換えない。
書き出した HTML は、`out` のファイルを消す。
