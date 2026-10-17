<!-- source-hash: sha256:f83e18e4e05405c522646fca1b89e148359faabe5315ccc8c653a703117391a1 -->
# ライブラリ本体 / CLI

`dist/cli.js` に束ねる Node の CLI。引数を読んでコマンドを振り分け、設定と索引と文書を読み、`render`・`checkIndex`・`collectReferences` を同じソースから呼んで、雛形の配置・点検・書き出しを行う。ファイル・YAML・glob・esbuild を使うのはこの分類だけにする。

- tests/unit/src/cli/main.test.ts
- tests/unit/src/cli/config.test.ts
- tests/unit/src/cli/documents.test.ts
- tests/unit/src/cli/embed.test.ts
- tests/unit/src/cli/html.test.ts
- tests/unit/src/cli/init.test.ts
- tests/unit/src/cli/check.test.ts
- tests/unit/src/cli/export.test.ts
- tests/unit/src/cli/build.test.ts

## ディレクトリ構成

```tree
src/cli/
├── main.ts       # 引数の読み取りとコマンドの振り分け・CLI の誤り
├── config.ts     # 設定ファイルの探索・読み取り・形の検査
├── documents.ts  # build の対象の文書・索引と索引の文書の読み取り・文書の題
├── embed.ts      # 外部ライブラリと拡張の束ね・画像の埋め込み・1 枚に含まれない文書へのリンク
├── html.ts       # 書き出す HTML の組み立て
├── init.ts       # mdmark init
├── check.ts      # mdmark check
├── export.ts     # mdmark export
└── build.ts      # mdmark build
templates/        # init が置く雛形の正本
```

## データモデル

### CliIo

CliIo

CLI の入出力

src/cli/main.ts

共通

コマンドが使う今のフォルダと、標準出力・標準エラーへの書き出し

#### プロパティ

| プロパティ名 | 型 | 説明 |
| --- | --- | --- |
| cwd | string | 今のフォルダ |
| stdout | (line: string) => void | 標準出力へ 1 行書く |
| stderr | (line: string) => void | 標準エラーへ 1 行書く |

### CliError

CliError

CLI の誤り

src/cli/main.ts

共通

原因と直し方の 1 文を持ち、`main` が標準エラーに出して終了コード 1 にする誤り

Error

#### プロパティ

| プロパティ名 | 型 | 説明 |
| --- | --- | --- |
| message | string | 原因と直し方の日本語の 1 文 |

### LoadedConfig

LoadedConfig

読んだ設定

src/cli/config.ts

共通

見つけた設定ファイルの場所と、読んだ値

#### プロパティ

| プロパティ名 | 型 | 説明 |
| --- | --- | --- |
| path | string | 設定ファイルの絶対パス |
| dir | string | 設定ファイルのあるフォルダ（設定のパスと glob の基準） |
| config | CliConfig | 読んだ値。`MdmarkConfig` に `index`・`theme`・`extensions`・`build` を足した形 |

### CheckIssue

CheckIssue

点検のずれ

src/cli/check.ts

設定と索引を点検する

`mdmark check` が出すずれ 1 件

#### プロパティ

| プロパティ名 | 型 | 説明 |
| --- | --- | --- |
| file | string | ずれのあるファイル（設定ファイルのフォルダからの相対パス） |
| where | string | キーのパスか行。ファイル全体は空文字 |
| kind | 'schema' \| 'no_documents' \| MdmarkIndexIssue['kind'] | ずれの種類 |
| message | string | 内容と直し方の 1 文 |

### ExportPayload

ExportPayload

書き出しの中身

src/cli/html.ts

共通

書き出した HTML に JSON で埋め、開いたときに起動の処理が読む中身

#### プロパティ

| プロパティ名 | 型 | 説明 |
| --- | --- | --- |
| kind | 'document' \| 'bundle' | `export` は `document`、`build` は `bundle` |
| config | MdmarkConfig | `features`・`libraries` を持つ設定（`libraries` の値は埋めたモジュールの名前に替える） |
| index | MdmarkIndex \| undefined | 索引 |
| references | MdmarkReferences \| undefined | `collectReferences` の参照の表 |
| docs | Array<{ path: string; title: string; markdown: string; docId?: string }> | 埋める文書。`markdown` は画像を `data:` URL に替えたもの |
| entry | string | 最初に開く文書の `path` |
| modules | Record<string, string> | 印の名前から束ねたモジュールのコードを引く表 |
| extensions | string[] | 束ねた拡張のモジュールのコード |

## 定数

### TEMPLATE_FILES

TEMPLATE_FILES

雛形の一覧

src/cli/init.ts

`init` が置く雛形の、置く先のパスと `templates/` の中の正本のパスを、置く順に並べたもの。`--js` のときに置くかを各行が持つ

`mdmark.config.yaml`・`theme.css`・`index.yaml`・`extensions/example.ts`（TypeScript だけ）・`extensions/example.js`（JavaScript だけ）・`tsconfig.json`（TypeScript だけ）・`package.json`（TypeScript だけ）

- dev/設計書/インターフェース定義/ライブラリ本体/雛形を置く.ts#constraints[置く雛形]

### CONFIG_FILE

CONFIG_FILE

設定ファイルの名前

src/cli/config.ts

上へ探す設定ファイルの名前

`mdmark.config.yaml`

## 関数

### main

main

CLI を実行する

src/cli/main.ts

共通

最初の引数のコマンド名で `init`・`check`・`export`・`build`・`upgrade` を呼び分け、終了コードを返す

引数は `node:util` の `parseArgs`（`--out`・`--config` は文字列、`--js`・`--plan`・`--yes` は真偽値、位置引数を許す）で読む。`upgrade` はパッケージの直下・`cliVersion()`・今の時刻・`ask` を `runUpgrade` に渡す。`init` は `cliVersion()` を `runInit` に渡す。コマンドが投げた `CliError` はその文を標準エラーに出して 1 を返す。知らないコマンド・知らない引数・引数が無いときは、使えるコマンドの一覧を標準エラーに出して 1 を返す。`src/cli/main.ts` の末尾で、入口として実行されたときだけ `main(process.argv.slice(2), 標準の入出力, createLinePrompter({ input: process.stdin, write: 標準エラー }))` を呼び、戻り値を `process.exitCode` に入れる

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| argv | string[] | ✅ | コマンド名から始まる引数 |
| io | CliIo | ✅ | 今のフォルダと出力の先（テストで差し替える） |
| ask | Prompter | ✅ | `upgrade` の問い（テストで差し替える） |

#### 戻り値

> 型: Promise<0 | 1><br>
> 説明: コマンドの終了コード<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_main | 正常 | コマンド名で init を呼び、その終了コードを返す | `["init", "{一時フォルダ}"]` | 出力を配列に貯める `CliIo`、`vi.stubGlobal("__MDMARK_VERSION__", "v0.5.0")`（`init` が `cliVersion()` を読むため） | 0 を返し、標準出力に `置いた:` の行がある |
| test_main_when_command_unknown | 異常 | 知らないコマンドは一覧を出して 1 を返す | `["serve"]` | 出力を配列に貯める `CliIo` | 1 を返し、標準エラーに `init`・`check`・`export`・`build` が出る |
| test_main_when_cli_error | 異常 | コマンドが投げた CliError の文を出して 1 を返す | 設定ファイルの無い一時フォルダで `["check"]` | 出力を配列に貯める `CliIo` | 1 を返し、標準エラーに `mdmark init` が出る |
| test_main_when_upgrade | 正常 | upgrade を呼び、--plan を runUpgrade に渡す | 設定の `version` がパッケージと同じ一時フォルダで `["upgrade", "--plan"]` | 出力を配列に貯める `CliIo`、呼ばれたら失敗にする `Prompter` | 0 を返し、標準出力に `当てる手順はありません` が出る |

planned

32

### findConfigFile

findConfigFile

設定ファイルを探す

src/cli/config.ts

共通

`--config` があればそのパスを、無ければ今のフォルダから上へ順に最初に見つかった `mdmark.config.yaml` の絶対パスを返す

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| cwd | string | ✅ | 今のフォルダ |
| explicit | string \| undefined | - | `--config` の値 |

#### 戻り値

> 型: Promise<string><br>
> 説明: 設定ファイルの絶対パス<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | `--config` のファイルが無い、またはルートまで探しても無い | mdmark.config.yaml が見つかりません（{探し始めたフォルダ} から上を探しました）。mdmark init で置けます。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_find_config_file | 正常 | 上のフォルダの設定ファイルを見つける | `{一時}/mdmark.config.yaml` があり、`cwd` は `{一時}/a/b` | 一時フォルダ | `{一時}/mdmark.config.yaml` | - |
| test_find_config_file_when_explicit | 正常 | `--config` のパスを優先する | `explicit` に `docs/mdmark.config.yaml` | 一時フォルダにそのファイルを置く | `{cwd}/docs/mdmark.config.yaml` | - |
| test_find_config_file_when_missing | 異常 | 見つからないと CliError を投げる | 一時フォルダと上に設定ファイルが無い | 一時フォルダ | `CliError` を投げ、メッセージに `mdmark init` が入る | CliError |

planned

32

### loadConfig

loadConfig

設定ファイルを読む

src/cli/config.ts

共通

設定ファイルを yaml の `parse` で読み、形を検めずに返す

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| path | string | ✅ | 設定ファイルの絶対パス |

#### 戻り値

> 型: Promise<{ path: string; dir: string; raw: unknown }><br>
> 説明: 場所と読んだ値（空のファイルは `null`）<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | YAML として読めない（`YAMLParseError`）、またはファイルを開けない | {ファイル} の {行} 行目を YAML として読めません（{誤りの内容}）。字下げと書き方を直してください。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_load_config | 正常 | 読んだ値とフォルダを返す | `build: {include: ["*.md"], out: a.html}` のファイル | 一時フォルダ | `raw.build.out` が `a.html`、`dir` が一時フォルダ | - |
| test_load_config_when_yaml_broken | 異常 | 読めない行を示す CliError を投げる | 3 行目の字下げが崩れたファイル | 一時フォルダ | `CliError` を投げ、メッセージに `3 行目` が入る | CliError |

planned

32

### validateConfig

validateConfig

設定の形を検める

src/cli/config.ts

共通

読んだ値を `schemas/mdmark.config.schema.json` と同じ形で検め、合わないところを `schema` のずれで返す

検めるのは、最上位がオブジェクトであること・`version` が `VERSION_PATTERN` に合う文字列・`features` の値が真偽値・`libraries` の値が文字列でキーが印の名前・`index`・`theme` が文字列・`extensions` が文字列の配列・`build` があれば `include`（1 つ以上の文字列）と `out`（`.html` の文字列）を持ち `exclude`・`glossary` が文字列の配列で `entry` が文字列であること。知らない最上位のキーは拒まない。形の検査は手書きで、ライブラリを足さない（索引の `normalizeIndex` と同じやり方）。検める形は `schemas/mdmark.config.schema.json` と揃える

関数

public

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| raw | unknown | ✅ | `loadConfig` が読んだ値 |
| file | string | ✅ | ずれの `file` に出す設定ファイルの名前 |

#### 戻り値

> 型: { config: CliConfig; issues: CheckIssue[] }<br>
> 説明: 形の合うところだけを残した設定と、`schema` のずれ（無ければ空）<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_validate_config | 正常 | 形の合う設定はずれ 0 件 | `version: v0.3.0`・`theme`・`extensions`・`build`（`include`・`out`）と知らないキー `title` を持つ値 | なし | `issues` が空 |
| test_validate_config_when_build_out_missing | 正常 | `build.out` が無いと schema のずれを返す | `build` が `include` だけを持つ | なし | `{ where: "build", kind: "schema" }` の 1 件で、`message` に `build.out` が入る |
| test_validate_config_when_empty | 正常 | 空の設定ファイル（`null`）を schema のずれにする | `raw` が `null` | なし | `{ where: "", kind: "schema" }` の 1 件 |
| test_validate_config_when_libraries_not_object | 正常 | 形の違う `libraries` を schema のずれにし、設定から落とす | `libraries` が文字列 | なし | `where` が `libraries` のずれが 1 件で、`config.libraries` が無い |
| test_validate_config_when_version_invalid | 異常 | 書式の違う version を schema のずれにする | `version: 0.3` | なし | `where` が `version` の `schema` のずれが 1 件 |

planned

32

### requireConfig

requireConfig

書き出しに使う設定を読む

src/cli/config.ts

共通

設定ファイルを探して読み、形が合わなければ `mdmark check` で確かめられることを添えた CliError を投げる

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| cwd | string | ✅ | 今のフォルダ |
| explicit | string \| undefined | - | `--config` の値 |

#### 戻り値

> 型: Promise<LoadedConfig><br>
> 説明: 形の合う設定<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 設定ファイルが無い・読めない・`validateConfig` のずれが 1 件以上 | {ファイル} の {場所} が設定の形に合いません（{内容}）。mdmark check で合わないところを確かめられます。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_require_config_when_invalid | 異常 | 形が合わないと mdmark check を添えた CliError を投げる | `libraries` が文字列の設定ファイル | 一時フォルダ | `CliError` を投げ、メッセージに `libraries` と `mdmark check` が入る | CliError |

- #functions[findConfigFile]
- #functions[loadConfig]
- #functions[validateConfig]

planned

32

### collectBuildDocuments

collectBuildDocuments

まとめる文書を集める

src/cli/documents.ts

複数の文書を1枚のHTMLにまとめる

`build.include` の glob に当たり `build.exclude` に当たらない `.md` のパスを、glob の並び・同じ glob の中はパスの順で、重なりを除いて返す

glob は Node の `fs.glob`（`cwd` に設定ファイルのフォルダ、`exclude` に `build.exclude`）で引く。パスは区切りを `/` に揃える

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| dir | string | ✅ | 設定ファイルのあるフォルダ |
| build | { include: string[]; exclude?: string[] } | ✅ | 設定の `build` |

#### 戻り値

> 型: Promise<string[]><br>
> 説明: まとめる文書のパス（設定ファイルのフォルダからの相対。無ければ空）<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_collect_build_documents | 正常 | glob の並びとパスの順に並べ、重なりを除く | `include: ["README.md", "**/*.md"]`、フォルダに `README.md`・`b/y.md`・`a/x.md`・`a/x.txt` | 一時フォルダ | `["README.md", "a/x.md", "b/y.md"]` |
| test_collect_build_documents_when_excluded | 正常 | exclude に当たる文書を外す | `include: ["**/*.md"]`・`exclude: ["下書き/**"]`、`下書き/メモ.md` と `a.md` | 一時フォルダ | `["a.md"]` |

planned

32

### readIndexWithDocuments

readIndexWithDocuments

索引と索引の文書を読む

src/cli/documents.ts

共通

設定の `index` の YAML と、索引のフォルダの下の `.md`（`build.exclude` に当たらないもの）を読む

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| loaded | LoadedConfig | ✅ | 読んだ設定 |

#### 戻り値

> 型: Promise<{ indexFile: string; indexDir: string; raw: unknown; documents: Record<string, string> } | undefined><br>
> 説明: 索引のファイル（設定ファイルのフォルダからの相対）、索引のフォルダ、読んだ値、索引のフォルダからのパスで引く文書。設定に `index` が無ければ `undefined`<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 索引のファイルが無い・YAML として読めない | 索引 {ファイル} を読めません（{理由}）。設定の index のパスを直すか、索引を置いてください。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_read_index_with_documents | 正常 | 索引と索引のフォルダの文書を読む | `index: docs/index.yaml`、`docs/a.md` と `docs/sub/b.md` と `docs/c.txt` | 一時フォルダ | `indexFile` が `docs/index.yaml`、`documents` のキーが `a.md`・`sub/b.md` | - |
| test_read_index_with_documents_when_no_index | 正常 | 設定に index が無ければ undefined | `index` の無い設定 | なし | `undefined` | - |
| test_read_index_with_documents_when_missing | 異常 | 索引のファイルが無いと CliError | `index: docs/index.yaml` でファイルが無い | 一時フォルダ | `CliError` を投げ、メッセージに `docs/index.yaml` が入る | CliError |

planned

32

### documentTitle

documentTitle

文書の題を決める

src/cli/documents.ts

共通

索引に文書があればその `title`、無ければ本文の最初の h1 の文字、無ければ拡張子を落としたファイル名を返す

関数

public

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| doc | { path: string; markdown: string; indexTitle?: string } | ✅ | 文書のパス・本文・索引の題 |

#### 戻り値

> 型: string<br>
> 説明: 文書の題<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_document_title | 正常 | 索引の題を優先する | `indexTitle: "API"`、本文の h1 は `公開関数` | なし | `API` |
| test_document_title_when_no_index | 正常 | 索引の題が無ければ最初の h1 | 本文が `# 使い方` で始まる | なし | `使い方` |
| test_document_title_when_no_heading | 正常 | h1 も無ければファイル名 | `path: "使い方/guide.md"`、本文に h1 が無い | なし | `guide` |

planned

32

### usedLibraryMarks

usedLibraryMarks

文書が使う印の名前を拾う

src/cli/embed.ts

共通

文書の Markdown から `MARK_PATTERN` に当たる印の名前を拾い、対応表にあるものだけを返す

関数

public

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| markdowns | string[] | ✅ | 文書の Markdown |
| libraries | Record<string, string> | ✅ | 既定の対応表に設定の `libraries` を重ねた表 |

#### 戻り値

> 型: Set<string><br>
> 説明: 埋める印の名前<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_used_library_marks | 正常 | 対応表にある印だけを拾う | 文書に `<!-- chart: a -->` と `<!-- table: data -->` と `<!-- unknown -->`、対応表は `chart` だけ | なし | `{"chart"}` |

planned

32

### bundleModule

bundleModule

モジュールを 1 つに束ねる

src/cli/embed.ts

共通

URL かファイルのモジュールを、import する先も含めて esbuild で 1 つの ES モジュールのコードに束ねる

`bundle: true`・`format: esm`・`write: false`・`minify: true`・`target` は対応ブラウザ。`http:`・`https:` の import は、esbuild のプラグインで `fetch` して読み、相対・ルート相対の import はその URL を基準に解く（PoC #35 で確かめた jsDelivr の `+esm` の形）。ファイルは TypeScript もそのまま読む。届かない・束ねられないときは例外を投げずに理由を返す

関数

public

True

URL の先を読む

#### 引数

| 引数名 | 型 | 必須 | デフォルト | 渡し方 | 説明 |
| --- | --- | --- | --- | --- | --- |
| entry | string | ✅ | - | - | モジュールの URL か、設定ファイルのフォルダからの相対パス |
| baseDir | string | ✅ | - | - | 相対パスの基準（設定ファイルのフォルダ） |
| fetchText | (url: string) => Promise<string> | - | `fetch` で本文を読む | injected | URL を読む関数（テストで差し替える） |

#### 戻り値

> 型: Promise<{ code: string } | { error: string }><br>
> 説明: 束ねたコードか、読めなかった理由<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_bundle_module | 正常 | 手元のファイルとその import を 1 つに束ねる | `lib.ts` が `./dep.ts` を import し `draw` を export する | 一時フォルダ | `code` に `import` 文が残らず、`draw` を export する |
| test_bundle_module_when_url | 正常 | URL とそのルート相対の import を fetchText で読んで束ねる | `https://cdn.example/npm/a/+esm` が `/npm/b/+esm` を import する | 2 つの URL の本文を返す `fetchText` | `fetchText` が `https://cdn.example/npm/b/+esm` も読み、`code` に `https:` と `/npm/` の import が残らない |
| test_bundle_module_when_unreachable | 異常 | 読めないモジュールは理由を返す | 無いファイル `missing.js` | 一時フォルダ | `error` に `missing.js` が入り、例外を投げない |

planned

32

### inlineImages

inlineImages

画像を埋める

src/cli/embed.ts

共通

Markdown の画像（`![]()` と HTML の `img`）の相対パスを、文書のフォルダを基準に読んだ `data:` URL に替える

画像の場所は markdown-it のトークン（`image` と `html_inline`・`html_block` の `src`）から拾い、その文字列だけを置き換える。MIME は拡張子（png・jpg・jpeg・gif・webp・svg）で決める。読めない画像は書いたまま残して警告に、絶対 URL の画像は読まずに残して警告にする

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| markdown | string | ✅ | 文書の Markdown |
| docFile | string | ✅ | 文書の絶対パス |

#### 戻り値

> 型: Promise<{ markdown: string; warnings: string[] }><br>
> 説明: 画像を替えた Markdown と警告の内容<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_inline_images | 正常 | 相対パスの画像を data: URL に替える | `![図](img/a.png)` と `img/a.png` | 一時フォルダ | `markdown` に `data:image/png;base64,` が入り、`warnings` が空 |
| test_inline_images_when_missing | 正常 | 読めない画像は残して警告にする | `![図](img/missing.png)` でファイルが無い | 一時フォルダ | `markdown` が元のままで、`warnings` に `img/missing.png` が入る |
| test_inline_images_when_absolute_url | 正常 | 絶対 URL の画像は読まずに警告にする | `![図](https://example.com/a.png)` | なし | `markdown` が元のままで、`warnings` に `https://example.com/a.png` が入る |

planned

32

### findOutsideLinks

findOutsideLinks

1 枚に含まれない文書へのリンクを拾う

src/cli/embed.ts

複数の文書を1枚のHTMLにまとめる

文書の相対リンクのうち、`.md` を指してまとめる文書に無いものを返す

リンクは markdown-it の `link_open` の `href` から拾い、`resolveLink`（索引と用語）で文書のパスから解く。`#` だけのリンクとスキームを持つリンクは拾わない

関数

public

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| markdown | string | ✅ | 文書の Markdown |
| docPath | string | ✅ | 文書のパス |
| paths | ReadonlySet<string> | ✅ | まとめる文書のパス |

#### 戻り値

> 型: string[]<br>
> 説明: 1 枚に含まれないリンク先（書いたままの `href`。書いた順）<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_find_outside_links | 正常 | まとめる文書に無い .md へのリンクだけを返す | `README.md` が `[a](使い方/guide.md)`・`[b](下書き/メモ.md)`・`[c](#見出し)`・`[d](https://example.com/x.md)` を持ち、まとめるのは `README.md`・`使い方/guide.md` | なし | `["下書き/メモ.md"]` |

planned

32

### assembleHtml

assembleHtml

書き出す HTML を組み立てる

src/cli/html.ts

共通

配布物の CSS・使う側の CSS・起動の処理（`dist/viewer.js`）・書き出しの中身を埋めた 1 枚の HTML を返す

`<style>` に配布物の CSS、続けて使う側の CSS、`<script type="application/json" id="mdmark-payload">` に書き出しの中身、`<script type="module">` に起動の処理を置く。`kind` が `bundle` のときは画面設計『まとめたHTML』の骨組み、`document` のときは描く先の要素だけを `body` に置く。`#mdmark-payload` の JSON だけは、`JSON.stringify` した文字列の `<` を `\u003c`（JSON の文字列のエスケープ）に替え、文書の `</script>` で要素が閉じないようにする。起動の処理（`dist/viewer.js`）は替えずに置く（`</script` の並びを持たないことは `buildDist` が検める）。ページの題は `entry` の文書の題

関数

public

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| parts | { payload: ExportPayload; distCss: string; themeCss?: string; viewer: string } | ✅ | 埋めるもの |

#### 戻り値

> 型: string<br>
> 説明: HTML の文字列<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_assemble_html | 正常 | CSS・中身・起動の処理をこの順に埋める | `kind: document` の中身と `themeCss` | なし | 配布物の CSS が使う側の CSS より前にあり、`id="mdmark-payload"` の JSON を `JSON.parse` すると中身に戻る |
| test_assemble_html_when_script_in_markdown | 正常 | 文書の `</script>` で要素が閉じない | 文書の Markdown が `</script><script>alert(1)</script>` を持つ | なし | HTML の `</script>` は起動の処理と中身の要素を閉じる 2 つだけで、中身を `JSON.parse` すると元の Markdown に戻る |
| test_assemble_html_when_bundle | 正常 | bundle は画面の骨組みを置く | `kind: bundle` の中身 | なし | `body` に `.mdmark-bundle`・`.mdmark-bundle-side`・`dialog.mdmark-bundle-panel` がある |

- dev/設計書/モジュール構成/ライブラリ本体/ビルド.ts#functions[buildDist]

planned

32

### runInit

runInit

雛形を置く

src/cli/init.ts

雛形を置く

`TEMPLATE_FILES` のうち置く先に無いものを写し、置いた・置かなかった行を出す

雛形の正本は `dist/cli.js` から見た `../templates/` を読む。既にあるファイルは中身を読まずに飛ばす（`writeFile` の `flag: "wx"`）。`mdmark.config.yaml` は雛形の `version` の値を `options.version` に置き換えて書く

関数

public

True

置く先にフォルダとファイルを書く

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { dir: string; js: boolean; templatesDir: string; version: string } | ✅ | 置く先・`--js`・雛形の正本のフォルダ・呼んだ CLI の版 |
| io | CliIo | ✅ | 出力の先 |

#### 戻り値

> 型: Promise<0><br>
> 説明: 置けたら 0<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 置く先のフォルダを作れない・ファイルを書けない | {パス} に書けません（{理由}）。置く先のフォルダを確かめてください。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_run_init | 正常 | 空のフォルダに 6 つの雛形を置く | `js: false`、空の一時フォルダ | 作業ツリーの `templates/` | 6 つのファイルがあり、標準出力に `置いた:` が 6 行 |
| test_run_init_when_javascript | 正常 | --js では JavaScript の拡張だけを置く | `js: true` | 作業ツリーの `templates/` | `extensions/example.js` があり、`extensions/example.ts`・`tsconfig.json`・`package.json` が無い |
| test_run_init_when_file_exists | 正常 | 既にあるファイルを上書きしない | 中身 `x: 1` の `mdmark.config.yaml` がある | 作業ツリーの `templates/` | `mdmark.config.yaml` が `x: 1` のままで、標準出力に `置かなかった（既にある）: mdmark.config.yaml` が出る |
| test_run_init_writes_version | 正常 | 置く設定の version を呼んだ CLI の版にする | `version: v0.5.0`、空の一時フォルダ | 作業ツリーの `templates/` | 置いた `mdmark.config.yaml` の `version` が `v0.5.0` で、コメントは雛形のまま |

planned

32

### runCheck

runCheck

設定と索引を点検する

src/cli/check.ts

設定と索引を点検する

設定の形・設定が指すファイル・`build` の対象・`checkIndex` のずれを集め、`{ファイル}:{場所}: {種類}: {内容}` の行と `ずれ {件数} 件` を出す

設定ファイルを `findConfigFile` で探し、`collectCheckIssues` のずれを 1 件 1 行で出す

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { config?: string } | ✅ | `--config` の値 |
| io | CliIo | ✅ | 今のフォルダと出力の先 |

#### 戻り値

> 型: Promise<0 | 1><br>
> 説明: ずれが 0 件なら 0、あれば 1<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 設定ファイルが無い・YAML として読めない | `findConfigFile`・`loadConfig` のメッセージ |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_run_check | 正常 | ずれの無いフォルダで 0 件 | 索引に 2 つの文書を載せ、`build.include` が 2 つに当たる | 一時フォルダ、出力を配列に貯める `CliIo` | 0 を返し、標準出力が `ずれ 0 件` の 1 行 |
| test_run_check_when_drift | 正常 | 設定の schema と索引の missing_doc をこの順に出す | `build.out` が無く、索引の `old.md` が無い | 一時フォルダ、出力を配列に貯める `CliIo` | 1 を返し、`mdmark.config.yaml:build: schema:` の行、`missing_doc` の行、`ずれ 2 件` の順に出る |
| test_run_check_when_no_documents | 正常 | build の対象が 0 件なら no_documents | `build.include` がどのファイルにも当たらない | 一時フォルダ、出力を配列に貯める `CliIo` | 1 を返し、`mdmark.config.yaml:build.include: no_documents:` の行がある |
| test_run_check_when_entry_outside | 正常 | まとめる文書に当たらない build.entry を schema のずれにする | `build.entry: missing.md` | 一時フォルダ、出力を配列に貯める `CliIo` | 1 を返し、`mdmark.config.yaml:build.entry: schema:` の行がある |

- #functions[requireConfig]
- #functions[collectBuildDocuments]
- #functions[readIndexWithDocuments]
- dev/設計書/モジュール構成/ライブラリ本体/索引と用語.ts#functions[checkIndex]

- dev/設計書/インターフェース定義/ライブラリ本体/設定と索引を点検する.ts#

planned

32

### prepareEmbeds

prepareEmbeds

埋めるものを用意する

src/cli/export.ts

共通

文書の画像を埋め、印のある外部ライブラリと設定の拡張を束ね、`theme` を読み、索引があれば参照の表を作って、書き出しの中身と警告を返す

`export` と `build` に共通の処理。同じ URL のモジュールは 1 回だけ束ねる。警告は `{ファイル}: {内容}` の文字列で、読めない画像・絶対 URL の画像・束ねられないモジュールと拡張・読めない `theme`・読めない索引の文書を出す

関数

internal

True

外部ライブラリの URL の先を読む

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { loaded: LoadedConfig; docs: Array<{ path: string; file: string }>; kind: 'document' \| 'bundle'; entry: string } | ✅ | 読んだ設定、埋める文書のパスと絶対パス、種類、最初に開く文書 |

#### 戻り値

> 型: Promise<{ payload: ExportPayload; themeCss?: string; warnings: string[] }><br>
> 説明: 書き出しの中身・使う側の CSS・警告<br>

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_prepare_embeds | 正常 | 印のあるモジュールだけを束ね、拡張と theme を読む | `libraries` に `test-lib`（印あり）と `other`（印なし）、`extensions` に 1 つ、`theme` あり | 一時フォルダに手元のモジュールを置く | `payload.modules` のキーが `test-lib` だけ、`payload.extensions` が 1 件、`themeCss` があり、`warnings` が空 |
| test_prepare_embeds_when_unreadable | 正常 | 読めないものを警告にして続ける | `test-lib` が無いファイルを指し、`theme` も無い | 一時フォルダ | `payload.modules` が空、`warnings` に `test-lib` と `theme` のパスが入る |
| test_prepare_embeds_when_index | 正常 | 索引があれば参照の表と docId を入れる | 索引に `guide`（`guide.md`）と `api`（`api.md`、`related` に `guide`） | 一時フォルダ | `payload.references.backlinks.guide` に `api` があり、`guide.md` の `docId` が `guide` |

- #functions[usedLibraryMarks]
- #functions[bundleModule]
- #functions[inlineImages]
- #functions[readIndexWithDocuments]
- #functions[documentTitle]

planned

32

### runExport

runExport

文書を HTML に書き出す

src/cli/export.ts

文書をHTMLに書き出す

文書 1 つを `kind: document` の中身にして HTML を書き、警告と `書き出した: {出力}` を出す

関数

public

True

出力のパスに HTML を書く

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { file: string; out?: string; config?: string; distDir: string } | ✅ | 文書・`--out`・`--config`・`dist/` の場所 |
| io | CliIo | ✅ | 今のフォルダと出力の先 |

#### 戻り値

> 型: Promise<0><br>
> 説明: 書き出したら 0<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 設定の誤り・文書が無い・出力先へ書けない | 文書が無い: {パス} が見つかりません。文書のパスを直してください。／書けない: {出力} に書けません（{理由}）。出力先のフォルダを確かめてください。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_run_export | 正常 | 既定の出力に HTML を書く | `file: guide.md`、`--out` 無し | 一時フォルダと、中身を短くした `dist/index.css`・`dist/viewer.js` | 0 を返し、`guide.html` があり、標準出力が `書き出した: guide.html` | - |
| test_run_export_when_document_missing | 異常 | 無い文書は CliError | `file: missing.md` | 一時フォルダ | `CliError` を投げ、メッセージに `missing.md` が入る | CliError |
| test_run_export_when_output_unwritable | 異常 | 書けない出力先は CliError | `out: blocked/guide.html` で `blocked` がファイル | 一時フォルダ | `CliError` を投げ、メッセージに `blocked/guide.html` が入る | CliError |

- #functions[requireConfig]
- #functions[prepareEmbeds]
- #functions[assembleHtml]

- dev/設計書/インターフェース定義/ライブラリ本体/文書をHTMLに書き出す.ts#

planned

32

### runBuild

runBuild

複数の文書を 1 枚にまとめる

src/cli/build.ts

複数の文書を1枚のHTMLにまとめる

`build` の対象の文書を `kind: bundle` の中身にして `build.out` に HTML を書き、警告と `書き出した: {build.out}（文書 {件数} 件）` を出す

警告には `prepareEmbeds` のものに、`findOutsideLinks` のリンク、`build.glossary` と `build.entry` がまとめる文書に当たらないことを足す。`build.glossary` の文書は、索引が無いときもその用語集の表を全ての文書で効かせるため、索引の `docs` に無ければ足してから `collectReferences` を呼ぶ

関数

public

True

`build.out` に HTML を書く

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { config?: string; distDir: string } | ✅ | `--config` と `dist/` の場所 |
| io | CliIo | ✅ | 今のフォルダと出力の先 |

#### 戻り値

> 型: Promise<0><br>
> 説明: 書き出したら 0<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 設定の誤り・`build` が無い・対象が 0 件・出力先へ書けない | build が無い: 設定に build がありません。build.include と build.out を書いてください。／0 件: build.include に当たる文書がありません。build.include を直してください。 |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 | 対応する例外 |
| --- | --- | --- | --- | --- | --- | --- |
| test_run_build | 正常 | 3 つの文書をまとめて build.out に書く | `include: ["**/*.md"]` が 3 つに当たる | 一時フォルダと、中身を短くした `dist/index.css`・`dist/viewer.js` | 0 を返し、標準出力が `書き出した: dist/docs.html（文書 3 件）`、中身の `docs` が 3 件 | - |
| test_run_build_when_link_outside_bundle | 正常 | 1 枚に含まれない文書へのリンクを警告に出す | `README.md` が exclude した `下書き/メモ.md` へリンクする | 一時フォルダ | 標準エラーに `警告: README.md:` で始まり `下書き/メモ.md` を含む行がある | - |
| test_run_build_when_glossary_without_index | 正常 | 索引が無くても build.glossary の用語を参照の表に入れる | `index` 無し、`glossary: ["用語集.md"]` の用語集の表に `印` | 一時フォルダ | 中身の `references` の用語に `印` がある | - |
| test_run_build_when_build_missing | 異常 | build が無いと CliError | `build` の無い設定 | 一時フォルダ | `CliError` を投げ、メッセージに `build.include` と `build.out` が入る | CliError |
| test_run_build_when_no_documents | 異常 | 対象が 0 件だと CliError で HTML を書かない | `build.include` がどのファイルにも当たらない | 一時フォルダ | `CliError` を投げ、`build.out` が無い | CliError |

- #functions[requireConfig]
- #functions[collectBuildDocuments]
- #functions[findOutsideLinks]
- #functions[prepareEmbeds]
- #functions[assembleHtml]

- dev/設計書/インターフェース定義/ライブラリ本体/複数の文書を1枚のHTMLにまとめる.ts#

planned

32

### readDistAssets

readDistAssets

配布物を読む

src/cli/export.ts

共通

`dist/index.css` と `dist/viewer.js` を読み、`bundle` では `dist/viewer.css` を CSS の後ろに足す

`dist/viewer.css` が無いときは足さずに続ける（それ以外の読めない理由はそのまま投げる）。`index.css` か `viewer.js` を読めなければ `CliError`

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { distDir: string; kind: "document" \| "bundle" } | ✅ | `dist/` の場所と書き出しの種類 |

#### 戻り値

> 型: Promise<{ distCss: string; viewer: string }><br>
> 説明: 埋める CSS と起動の処理<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | `index.css` か `viewer.js` を読めない | 配布物を読めません（{理由}）。mdmark を入れ直してください。 |

planned

32

### writeHtml

writeHtml

HTML を書く

src/cli/export.ts

共通

親のフォルダを作って HTML を書く

関数

public

True

出力のパスに HTML を書く

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| options | { file: string; display: string; html: string } | ✅ | 書く先の絶対パス・利用者に見せるパス・HTML |

#### 戻り値

> 型: Promise<void><br>
> 説明: 書いたら解決する<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 書く先に書けない | 書けない: {出力} に書けません（{理由}）。出力先のフォルダを確かめてください。 |

planned

32

### collectCheckIssues

collectCheckIssues

点検のずれを集める

src/cli/check.ts

共通

設定ファイルを読み、`mdmark check` と同じ並びのずれを返す

並びは設定の `schema`（`validateConfig` のずれ、`theme`・`extensions` の無いファイル、`build.glossary`・`build.entry` がまとめる文書に当たらないもの）→ `no_documents` → `checkIndex` の並び。索引のずれの `file` は設定ファイルのフォルダからの相対パスに直す。索引を読めないときは索引を指す `schema` のずれにする。`runCheck` と `runUpgrade` が呼ぶ

関数

public

True

#### 引数

| 引数名 | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| path | string | ✅ | 設定ファイルの絶対パス |

#### 戻り値

> 型: Promise<CheckIssue[]><br>
> 説明: ずれの並び（無ければ空）<br>

#### 例外

| 例外名 | 発生条件 | メッセージ |
| --- | --- | --- |
| CliError | 設定ファイルを YAML として読めない | `loadConfig` のメッセージ |

#### 単体テスト

| テスト名 | 正常/異常 | 概要 | 条件 | Mock | 期待値 |
| --- | --- | --- | --- | --- | --- |
| test_collect_check_issues | 正常 | 設定の schema と索引の missing_doc をこの順に返す | `build.out` が無く、索引の `old.md` が無い | 一時フォルダ | 2 件で、`kind` が `schema`・`missing_doc` の順 |

- #functions[validateConfig]
- dev/設計書/モジュール構成/ライブラリ本体/索引と用語.ts#functions[checkIndex]

planned

39
