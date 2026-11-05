# MCP

MCP のツールの名前・引数・戻り値・エラーの一覧

Claude Code のプラグイン `mdmark` の MCP サーバー（`plugin:mdmark:mdmark`）が出すツールの一覧。
入れ方は [プラグインを入れる](../使い方/ClaudeCodeで使う/プラグインを入れる.md)、使い方は [MCP のツールを使う](../使い方/ClaudeCodeで使う/MCPのツールを使う.md)。
ツールの結果のテキストは JSON の文字列 1 つ。
エラーは結果の `isError` を `true` にし、内容のテキストに、何が合わないかと直し方を日本語の 1 文で書く。
`config` を省くと、Claude Code のセッションのフォルダから上のフォルダへ順に `mdmark.config.yaml` を探す。
相対パスの引数は、セッションのフォルダからの相対パス。
設定のキーは [設定](./設定.md)、索引のキーは [索引](./索引.md)。

## 一覧

<!-- table: data -->

| 名前 | ツール | 説明 |
| --- | --- | --- |
| [文書を HTML に書き出す](#文書を-html-に書き出す) | `export_html` | `mdmark export` と同じ処理で、Markdown を 1 つ、1 枚の HTML に書き出す |
| [複数の文書を 1 枚の HTML にまとめる](#複数の文書を-1-枚の-html-にまとめる) | `build_site` | `mdmark build` と同じ処理で、設定の `build` の文書を 1 枚にまとめる |
| [設定と索引を点検する](#設定と索引を点検する) | `check` | `mdmark check` と同じ点検をして、ずれの一覧を返す |

<!-- /table -->

## 接続先

MCP サーバーは、`mdmark serve` が起動する常駐サーバー。
プラグインの `.mcp.json` は、種類 `http`・URL `http://127.0.0.1:${MDMARK_PORT:-8782}/mcp` で、Streamable HTTP でつなぐ。
サーバーはセッションを持たず、並行して開いたセッションが同じプロセスを共有する。
起動と停止は [MCPサーバーを起動する](../使い方/ClaudeCodeで使う/MCPサーバーを起動する.md)、`serve` の引数と終了コードは [CLI](./CLI.md#mcp-サーバーを起動する)、`MDMARK_PORT` は [設定](./設定.md#mcp-サーバーのポート)。

## instructions

接続したときの `instructions` は、mdmark の文書を書く前に dev-docs の `search_docs` で配信元 `mdmark` の使い方集（`docs` の行をタグ `topic:使い方集` で絞る）を参照し、書いた後に `check` で点検する順序を記載する。
dev-docs が無い、または配信元 `mdmark` が登録されていないときは、使い方集が見つからないことも記載する。
仕組みは [Claude Code に使い方を渡す仕組み](../はじめに/コアコンセプト/ClaudeCodeに使い方を渡す仕組み.md)。

## 作業のフォルダ

ツールは、作業のフォルダの絶対パスを引数 `project_dir` で受ける。
常駐サーバーには、セッションの作業のフォルダが環境変数で渡らないため。
プラグインの PreToolUse のフックが、ツールの呼び出しのたびに、セッションの作業のフォルダ（`CLAUDE_PROJECT_DIR`）を `project_dir` に入れる。
エージェントが `project_dir` を記載していても、フックが置き換える。
`project_dir` は `tools/list` の入力のスキーマに出ないため、エージェントは記載しない。

`project_dir` が無い・絶対パスでない・そのフォルダが無いときは、ツールのエラーにする（`CLAUDE_PROJECT_DIR` が無く、フックが入れられなかったときも同じ）。
配布物は、作業のフォルダによらず、`mdmark serve` を起動したパッケージから読む。

## 文書を HTML に書き出す

`mdmark export` と同じ処理で、Markdown を 1 つ、外へ要求しない 1 枚の HTML に書き出す。
出力のパスにある HTML は上書きする。
手順は [文書を書き出す](../使い方/書き出す/文書を書き出す.md)。

### リクエスト

```json
{ "file": "docs/guide.md" }
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `file` | 必須 | 書き出す Markdown のパス |
| `out` | 任意 | 書き出す HTML のパス。省くと、文書と同じフォルダの拡張子を `.html` にしたパス |
| `config` | 任意 | 使う設定ファイルのパス |

### レスポンス

```json
{ "out": "/home/user/docs/guide.html", "warnings": [] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `out` | 文字列 | 書き出した HTML の絶対パス |
| `warnings` | 文字列の並び | `mdmark export` が標準エラーに出す警告の文 |

### エラー

| 発生条件 | 内容 |
| --- | --- |
| `file` のファイルが無い | 無いパス。HTML は書かない |
| 設定ファイルが無い・読めない、書き出せない | `mdmark export` が終了コード 1 で終わるときと同じ文 |

## 複数の文書を 1 枚の HTML にまとめる

`mdmark build` と同じ処理で、設定の `build` の文書を、行き来できる 1 枚の HTML にまとめる。
`build.out` の HTML は上書きする。
手順は [文書を1枚にまとめる](../使い方/書き出す/文書を1枚にまとめる.md)。

### リクエスト

```json
{}
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `config` | 任意 | 使う設定ファイルのパス |

### レスポンス

```json
{ "out": "/home/user/docs/dist/docs.html", "docs": 2, "warnings": [] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `out` | 文字列 | 書き出した HTML の絶対パス |
| `docs` | 数値 | 入れた文書の数 |
| `warnings` | 文字列の並び | `mdmark build` が標準エラーに出す警告の文（切れた参照など） |

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 設定に `build` が無い | `mdmark build` が終了コード 1 で終わるときと同じ文。HTML は書かない |
| 設定ファイルが無い・読めない、`include` に当たる文書が 0 件、書き出せない | 同上 |

## 設定と索引を点検する

`mdmark check` と同じ点検（include のマーカーの取り込み先を含む）をして、ずれの一覧を返す。
設定・索引・文書は書き換えない。
手順は [点検する](../使い方/書き出す/点検する.md)。

### リクエスト

```json
{}
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `config` | 任意 | 使う設定ファイルのパス |
| `base` | 任意 | 直し忘れの検査に比べる基準の git の ref。`mdmark check` の `--base` と同じで、渡すと `change_together` の組のうち片方の文書だけが変わった組を `missed_change_together` で返す。省くと直し忘れを検査しない |
| `text` | 任意 | 点検する Markdown の文字列。`mdmark check` の `--text` と同じで、渡すと設定と索引を点検せず、描いたときの書き方の警告・知らない印・図の配置のずれを返す。`base`・`file`・`key` と一緒に渡せない |
| `file` | 任意 | Markdown をキーの値に持つ YAML のファイル（作業のフォルダからの相対パスか絶対パス）。`mdmark check` の `--file` と同じで、`key` と一緒に渡す |
| `key` | `file` と一緒に必須 | `file` の YAML の中の、点検する文字列の値のキー。`mdmark check` の `--key` と同じ |

### レスポンス

```json
{ "issues": [{ "file": "index.yaml", "where": "docs[1].path", "kind": "missing_doc", "message": "`old.md` が見つかりません。文書を戻すか、索引の `docs[1]` を消してください。" }] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `issues[].file` | 文字列 | ずれのあるファイル。設定ファイルのあるフォルダからの相対パス。`text` のときは `-` |
| `issues[].where` | 文字列 | 行かキーのパス。無いときは空の文字列 |
| `issues[].kind` | 文字列 | ずれの種類。意味は [CLI](./CLI.md#設定と索引を点検する) |
| `issues[].message` | 文字列 | 何が合わないかと直し方の 1 文 |

ずれがあってもエラーにせず、`issues` に並べる。
並びは `mdmark check` の出力の行の並びと同じ。

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 設定ファイルが無い（`text`・`file` を渡し、`config` を渡さないときを除く） | 探した場所と、`mdmark init` で置けること |
| 一緒に渡せない引数を渡した・`file` と `key` の片方だけを渡した・`file` を読めない・`key` のキーが無いか値が文字列でない | `mdmark check` が標準エラーに出すのと同じ文。点検はしない |
| 設定ファイルを YAML として読めない | 読めない行 |
| `base` を渡し、比べる基準を引けない | `mdmark check --base` が標準エラーに出すのと同じ文。ずれの点検はしない |
