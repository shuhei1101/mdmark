# MCP

MCP のツールの名前・引数・戻り値・エラーの一覧

Claude Code のプラグイン `mdmark` の MCP サーバー（`plugin:mdmark:mdmark`）が出すツールの一覧。
入れ方は [プラグインを入れる](./ClaudeCodeで使用する-プラグインを入れる.md)、使用方法は [MCP のツールを使用する](./ClaudeCodeで使用する-MCPのツールを使用する.md)。
ツールの結果のテキストは JSON の文字列 1 つ。
エラーは結果の `isError` を `true` にし、内容のテキストに、何が合わないかと修正方法を日本語の 1 文で記載する。
`config` を省くと、端末の設定と、Claude Code のセッションのフォルダから上のフォルダの `mdmark.config.yaml` を重ねて読み込む（[設定を重ねて読み込む仕組み](./コアコンセプト-設定を重ねて読み込む仕組み.md)）。
端末の設定の場所は、`mdmark serve` のプロセスの環境変数 `MDMARK_CONFIG` で決まる。
相対パスの引数は、セッションのフォルダからの相対パス。
設定のキーは [設定](./設定.md)、索引のキーは [索引](./索引.md)。

## 一覧

<!-- table: {"kind": "data"} -->

| 名前 | ツール | 説明 |
| --- | --- | --- |
| [文書を HTML に書き出す](#文書を-html-に書き出す) | `export_html` | `mdmark export` と同じ処理で、Markdown を 1 つ、1 枚の HTML に書き出す |
| [複数の文書を 1 枚の HTML にまとめる](#複数の文書を-1-枚の-html-にまとめる) | `build_site` | `mdmark build` と同じ処理で、設定の `build` の文書を 1 枚にまとめる |
| [設定と索引を点検する](#設定と索引を点検する) | `check` | `mdmark check` と同じ点検をして、ずれの一覧を返却する |
| [CSS のテンプレートの一覧を返却する](#css-のテンプレートの一覧を返却する) | `list_templates` | 端末の設定のフォルダの CSS のテンプレートを、名前・説明・タグ・パスつきで返却する |
| [CSS のテンプレートを登録する](#css-のテンプレートを登録する) | `add_template` | 作業のフォルダの CSS をテンプレートにコピーし、名前・説明・タグを索引に記載する |
| [CSS のテンプレートを配置する](#css-のテンプレートを配置する) | `apply_template` | テンプレートの CSS を配置先へコピーし、設定の `theme` に記載する値を返却する |

<!-- /table -->

## 接続先

MCP サーバーは、`mdmark serve` が起動する常駐サーバー。
プラグインの `.mcp.json` は、種類 `http`・URL `http://127.0.0.1:${MDMARK_PORT:-8782}/mcp` で、Streamable HTTP でつなぐ。
サーバーはセッションを持たず、並行して開いたセッションが同じプロセスを共有する。
起動と停止は [MCPサーバーを起動する](./ClaudeCodeで使用する-MCPサーバーを起動する.md)、`serve` の引数と終了コードは [CLI](./CLI.md#mcp-サーバーを起動する)、`MDMARK_PORT` は [設定](./設定.md#mcp-サーバーのポート)。

## instructions

接続したときの `instructions` は、mdmark の文書を記載する前に dev-docs の `search_docs` で配信元 `mdmark` のガイド（`docs` の行をタグ `topic:ガイド` で絞る）を参照し、記載した後に `check` で点検する順序を記載する。
mdmark の記法で記載する文書の拡張子が `.mark.md` で、利用者の指示が無い限り純粋な `.md` には記法を使用しないことも記載する。
プラグインのフックは、`.mark.md` のファイルへの Write・Edit と、語 mdmark を含む利用者の発言で、ガイドを参照してから記載するよう 1 つのセッションに 1 回案内する（[Claude Code に使用方法を提供する仕組み](./コアコンセプト-ClaudeCodeに使用方法を提供する仕組み.md)）。
dev-docs が無い、または配信元 `mdmark` が登録されていないときは、ガイドが見つからないことも記載する。
利用側の CSS を探すときは `list_templates` で一覧を引き、`apply_template` で配置して返った値を設定の `theme` に記載し、作った CSS は `add_template` で登録する順序も記載する。
常駐サーバーが動いている場所（unit で動いているときは unit の名前（[`serve.systemdUnit`](./設定.md#常駐サーバーの-unit-の名前)、既定 `mdmark-mcp`）とログを確認する `journalctl --user -u {unit の名前}`、ほかは tmux のセッション名（[`serve.tmuxSession`](./設定.md#常駐サーバーの-tmux-のセッション名)、既定 `mdmark-mcp`））と、止まったときは `/mdmark:global-setup` でもう一度起動できることも記載する。
仕組みは [Claude Code に使用方法を提供する仕組み](./コアコンセプト-ClaudeCodeに使用方法を提供する仕組み.md)。

## 作業のフォルダ

ツールは、作業のフォルダの絶対パスを引数 `project_dir` で受ける。
常駐サーバーには、セッションの作業のフォルダが環境変数で渡らないため。
プラグインの PreToolUse のフックが、ツールの呼び出しのたびに、セッションの作業のフォルダ（`CLAUDE_PROJECT_DIR`）を `project_dir` に入れる。
エージェントが `project_dir` を記載していても、フックが置き換える。
`project_dir` は `tools/list` の入力のスキーマに出ないため、エージェントは記載しない。

`project_dir` が無い・絶対パスでない・そのフォルダが無いときは、ツールのエラーにする（`CLAUDE_PROJECT_DIR` が無く、フックが入れられなかったときも同じ）。
配布物は、作業のフォルダによらず、`mdmark serve` を起動したパッケージから読み込む。

## 文書を HTML に書き出す

`mdmark export` と同じ処理で、Markdown を 1 つ、外へ要求しない 1 枚の HTML に書き出す。
出力のパスにある HTML は上書きする。
手順は [文書を書き出す](./書き出す-文書を書き出す.md)。

### リクエスト

```json
{ "file": "docs/guide.md" }
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `file` | 必須 | 書き出す Markdown のパス |
| `out` | 任意 | 書き出す HTML のパス。省くと、文書と同じフォルダの拡張子を `.html` にしたパス |
| `config` | 任意 | 使用する設定ファイルのパス |
| `keep_traces` | 任意 | `true` のとき、`mdmark export --keep-traces` と同じく mdmark の名前を残して書き出す。省くと隠して書き出す |

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
| `file` のファイルが無い | 無いパス。HTML は記載しない |
| 設定ファイルが無い・読み込めない、書き出せない | `mdmark export` が終了コード 1 で終わるときと同じ文 |

## 複数の文書を 1 枚の HTML にまとめる

`mdmark build` と同じ処理で、設定の `build` の文書を、行き来できる 1 枚の HTML にまとめる。
`build.out` の HTML は上書きする。
手順は [文書を1枚にまとめる](./書き出す-文書を1枚にまとめる.md)。

### リクエスト

```json
{}
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `config` | 任意 | 使用する設定ファイルのパス |
| `keep_traces` | 任意 | `true` のとき、`mdmark build --keep-traces` と同じく mdmark の名前を残してまとめる。省くと隠してまとめる |

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
| 設定に `build` が無い | `mdmark build` が終了コード 1 で終わるときと同じ文。HTML は記載しない |
| 設定ファイルが無い・読み込めない、`include` に該当する文書が 0 件、書き出せない | 同上 |

## 設定と索引を点検する

`mdmark check` と同じ点検（include のマーカーの取り込み先を含む）をして、ずれの一覧を返却する。
設定・索引・文書は書き換えない。
手順は [点検する](./書き出す-点検する.md)。

### リクエスト

```json
{}
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `config` | 任意 | 使用する設定ファイルのパス |
| `base` | 任意 | 修正漏れの検査に比べる基準の git の ref。`mdmark check` の `--base` と同じで、指定すると `change_together` の組のうち片方の文書だけが変わった組を `missed_change_together` で返却する。省くと修正漏れを検査しない |
| `text` | 任意 | 点検する Markdown の文字列。`mdmark check` の `--text` と同じで、指定すると設定と索引を点検せず、描いたときの記載の警告・描くときに無視するマーカーの知らない引数・知らないマーカー・図の配置のずれを返却する。`base`・`file`・`key` と一緒に指定できない |
| `file` | 任意 | Markdown をキーの値に持つ YAML のファイル（作業のフォルダからの相対パスか絶対パス）。`mdmark check` の `--file` と同じで、`key` と一緒に指定する |
| `key` | `file` と一緒に必須 | `file` の YAML の中の、点検する文字列の値のキー。`mdmark check` の `--key` と同じ |

### レスポンス

```json
{ "issues": [{ "file": "index.yaml", "where": "docs[1].path", "kind": "missing_doc", "message": "`old.md` が見つかりません。文書を戻すか、索引の `docs[1]` を削除してください。" }] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `issues[].file` | 文字列 | ずれのあるファイル。設定ファイルのあるフォルダからの相対パス。`text` のときは `-` |
| `issues[].where` | 文字列 | 行かキーのパス。無いときは空の文字列 |
| `issues[].kind` | 文字列 | ずれの種類。意味は [CLI](./CLI.md#設定と索引を点検する) |
| `issues[].message` | 文字列 | 何が合わないかと修正方法の 1 文 |

ずれがあってもエラーにせず、`issues` に並べる。
並びは `mdmark check` の出力の行の並びと同じ。

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 設定ファイルが無い（`text`・`file` を指定し、`config` を指定しないときを除く） | 探した場所と、`mdmark init` で配置できること |
| 一緒に指定できない引数を指定した・`file` と `key` の片方だけを指定した・`file` を読み込めない・`key` のキーが無いか値が文字列でない | `mdmark check` が標準エラーに出すのと同じ文。点検はしない |
| 設定ファイルを YAML として読み込めない | 読み込めない行 |
| `base` を指定し、比べる基準を参照できない | `mdmark check --base` が標準エラーに出すのと同じ文。ずれの点検はしない |

## CSS のテンプレートの一覧を返却する

端末の設定のフォルダの `templates/css/` の索引 `templates.yaml` を読み込み、テンプレートの一覧を返却する。
テンプレートのフォルダの場所は、端末の設定のファイル（`mdmark serve` のプロセスの `MDMARK_CONFIG`、無ければ `${XDG_CONFIG_HOME:-~/.config}/mdmark/settings.yaml`）と同じフォルダで決まる。
フォルダと索引は書き換えない。
手順は [MCP のツールを使用する](./ClaudeCodeで使用する-MCPのツールを使用する.md#css-のテンプレートを使用する)。

### リクエスト

```json
{}
```

### レスポンス

```json
{ "templates": [{ "name": "brand", "description": "見出しを社の色にする", "tags": ["見出し", "色"], "path": "/home/user/.config/mdmark/templates/css/brand.css" }] }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `templates[].name` | 文字列 | テンプレートの名前 |
| `templates[].description` | 文字列 | 説明 |
| `templates[].tags` | 文字列の並び | タグ |
| `templates[].path` | 文字列 | CSS の絶対パス |

テンプレートのフォルダか索引が無ければ、`templates` は空の並びになり、エラーにしない。

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 索引が YAML として読み込めない・索引のスキーマに合わない | 索引のパスと、読み込めない行か合わないキー |

## CSS のテンプレートを登録する

作業のフォルダの CSS を、テンプレートのフォルダへ `{name}.css` でコピーし、索引に行を追加する。
フォルダと索引が無ければ作る。
索引の書き込みに失敗したときは、コピーした CSS を元に戻してエラーにする。

### リクエスト

```json
{ "file": "brand.css", "name": "brand", "description": "見出しを社の色にする", "tags": ["見出し", "色"] }
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `file` | 必須 | 登録する CSS のパス。拡張子は `.css` |
| `name` | 必須 | テンプレートの名前。英小文字・数字・`-` の 1〜64 文字で、英小文字か数字で始まる |
| `description` | 必須 | どんな外観にする CSS か・どんな文書に向くか |
| `tags` | 任意 | 探すときの単語の並び。省くと空の並び |
| `overwrite` | 任意 | `true` のとき、同じ名前のテンプレートの CSS と索引の行を置き換える。既定は `false` |

### レスポンス

```json
{ "name": "brand", "path": "/home/user/.config/mdmark/templates/css/brand.css", "replaced": false }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `name` | 文字列 | 登録した名前 |
| `path` | 文字列 | テンプレートのフォルダの CSS の絶対パス |
| `replaced` | 真偽値 | 同じ名前のテンプレートを置き換えたか |

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 同じ名前のテンプレートがあり、`overwrite` が `true` でない | 同じ名前があることと、`overwrite` を `true` にすれば置き換えられること。CSS と索引は書き換えない |
| `file` のファイルが無い・拡張子が `.css` でない | 無いパスか拡張子 |
| `name`・`description`・`tags` が合わない | 何が合わないかと修正方法 |
| 索引が YAML として読み込めない・索引のスキーマに合わない | `list_templates` と同じ文 |

## CSS のテンプレートを配置する

テンプレートの CSS を配置先のフォルダへ `{name}.css` でコピーし、設定の `theme` に記載する値を返却する。
設定ファイルの `theme` は書き換えない。
配置先に同じ名前で同じ中身のファイルがあるときは、書き換えずに返却する。

### リクエスト

```json
{ "name": "brand" }
```

| フィールド | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `name` | 必須 | 配置するテンプレートの名前 |
| `dir` | 任意 | 配置先のフォルダ。省くと、セッションのフォルダから上へ探して最も近い `mdmark.config.yaml` のフォルダ |
| `overwrite` | 任意 | `true` のとき、配置先の中身の違う同じ名前のファイルを置き換える。既定は `false` |

### レスポンス

```json
{ "path": "/home/user/repo/brand.css", "theme": "./brand.css", "replaced": false }
```

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `path` | 文字列 | 配置した CSS の絶対パス |
| `theme` | 文字列 | 設定の `theme` に記載する値。配置先（`dir` を省いたときはセッションのフォルダ）から上へ探して最も近い `mdmark.config.yaml` のフォルダからの、`./` で始まる相対パス。設定ファイルが見つからなければ持たない |
| `replaced` | 真偽値 | 配置先のファイルを置き換えたか |

### エラー

| 発生条件 | 内容 |
| --- | --- |
| 索引に `name` のテンプレートが無い | 名前と、`list_templates` で名前を確認できること |
| 配置先に中身の違う同じ名前のファイルがあり、`overwrite` が `true` でない | 配置先のパスと、`overwrite` を `true` にすれば置き換えられること。配置先は書き換えない |
| `dir` を省き、セッションのフォルダと上のフォルダに `mdmark.config.yaml` が無い | 設定ファイルが無いことと、`dir` を指定するか `mdmark init` で設定ファイルを配置できること |
| `dir` のフォルダが無い | 無いパス |
| 索引が YAML として読み込めない・索引のスキーマに合わない | `list_templates` と同じ文 |
