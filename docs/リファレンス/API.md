# API

公開関数と CSS 変数の一覧

どれも [配布物を読み込む](../使い方/導入/配布物を読み込む.md) で読み込んだページから使う。

## 一覧

| 名前 | 呼び出し | 説明 |
| --- | --- | --- |
| [版を返す](#版を返す) | `version()` | 読み込んだ配布物の版を返す |
| [版を CSS 変数で読む](#版を-css-変数で読む) | `--mdmark-version` | 読み込んだ CSS の版を持つ |
| [文書を描く](#文書を描く) | `mount(el, opts)` | 要素の中に Markdown を HTML として描く |
| [文書を HTML 文字列にする](#文書を-html-文字列にする) | `render(markdown, opts)` | 画面を持たずに Markdown を HTML 文字列にする |
| [参照の表を作る](#参照の表を作る) | `collectReferences(input)` | 索引と全ての文書の本文から、文書ごとの被参照と、用語集の表の用語をまとめた参照の表を返す |
| [索引を点検する](#索引を点検する) | `checkIndex(input)` | 索引と文書のずれの一覧を返す |
| [拡張を登録する](#拡張を登録する) | `registerExtension(extension)` | 使う側が自分の印と、その印を描くモジュールの読み方を登録する |
| [テーマの CSS 変数](#テーマの-css-変数) | `--mdmark-*` | 見た目の値を持つ変数。使う側が上書きする |

## 版を返す

読み込んだ配布物の版を返す。

### リクエスト

引数はなし。

```js
import { version } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

version();
```

### レスポンス

| 型 | 説明 | 例 |
| --- | --- | --- |
| `string` | 配布物のビルドに埋めた版。`v{MAJOR}.{MINOR}.{PATCH}` の形 | `"v0.0.1"` |

### エラー

なし。常に埋めた版を返す。

## 版を CSS 変数で読む

読み込んだ CSS の版を、ルート要素の CSS 変数 `--mdmark-version` で持つ。
`version()` と同じ版になる。

### リクエスト

```js
getComputedStyle(document.documentElement).getPropertyValue("--mdmark-version");
```

### レスポンス

| 型 | 説明 | 例 |
| --- | --- | --- |
| 文字列 | 版を引用符で囲んだ文字列。`version()` の戻り値と同じ版 | `"v0.0.1"`（引用符を含む） |

### エラー

なし。CSS を読み込んでいないページでは、変数が定義されず空になる。

## 文書を描く

要素の中に Markdown を HTML として描く。
描いた本文は `render` が返す HTML 文字列と同じ。
表の並べ替え・タブの切り替えなど、記法の操作を付ける（書き方は [記法](./記法.md)）。
文書に書いたスクリプト（`script` 要素・`on` で始まる属性・`javascript:` の URL）は落とし、実行しない。
索引を渡すと、本文に出た用語と文書の別名に破線の下線を引き、ポインターを乗せたときとフォーカスしたときに意味と関連文書のツールチップを出し、文書の末尾に被参照の一覧を置く。
ツールチップの操作は `mount` が付け、`update` で付け直し、`destroy` で外す。
書き方は [索引と用語集を書く](../使い方/書く/索引と用語集を書く.md)。
図の部品の定義（[図の部品](./記法.md#図の部品)）があると、図の拡大・縮小・移動・全画面とツールチップ、操作できる部品の値の変更と写す操作も付ける。
`opts.diffSource` を渡すと、文書の題の後ろに「変更を見る」のボタンを付け、押すと 2 つのリビジョンの差分を出す。
差分の操作は `mount` が付け、`update` で閉じ、`destroy` で外す。
仕組みは [差分を表示する仕組み](../はじめに/コアコンセプト/差分を表示する仕組み.md)、書き方は [差分を表示する](../使い方/導入/差分を表示する.md)。

### リクエスト

```js
import { mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = mount(document.querySelector("#doc"), { markdown: "# 見出し\n\n本文" });
handle.update("# 次の見出し");
handle.destroy();
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素。class `mdmark` が付く |
| `opts.markdown` | 必須 | 描く Markdown |
| `opts.config` | 任意 | 使う側のサーバーが `mdmark.config.yaml` を読んだオブジェクト。省いたキーには既定を当てる。キーは [設定](./設定.md) |
| `opts.index` | 任意 | 使う側のサーバーが、設定の `index` のパスの索引の YAML を読んだオブジェクト。形は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて使う。省くと、描く文書の用語集の表だけで用語を照合し、被参照を出さない |
| `opts.docId` | 任意 | 描く文書の索引の `id`。被参照の一覧を引き、関連文書から自分を除き、リンクの相対パスを求めるのに使う。省くと、被参照の一覧を出さず、関連文書のリンクは索引の `path` のままにする。索引に無い `id` は、省いたときと同じに扱う |
| `opts.references` | 任意 | [`collectReferences`](#参照の表を作る) が返した参照の表。被参照の一覧と、ほかの文書の用語集の表の用語に使う。省くと、被参照は索引の `related` だけから出し、ほかの文書の用語集の表の用語を照合しない |
| `opts.diffSource` | 任意 | 文書のリビジョンの一覧と、リビジョンごとの本文を返す取り出し元（`DiffSource`）。渡すと、描いた文書に差分を開く UI が付く。`opts.docId` と一緒に渡す。省くと、差分の UI を付けない |

`opts.diffSource` の形。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `revisions(docId)` | `(docId: string) => Promise<DiffRevision[]>` | 文書のリビジョンを新しい順に返す。mdmark は並べ替えない。差分を開くたびに 1 回呼ぶ |
| `content({ docId, revisionId })` | `(target: { docId: string; revisionId: string }) => Promise<string>` | そのリビジョンの Markdown を返す。選んだ 2 つのリビジョンに 1 回ずつ呼ぶ |

`DiffRevision` の形。

| 項目 | 型 | 必須 / 任意 | 説明 |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | リビジョンの識別子。空にできず、一覧の中で重ならない |
| `at` | `string` | 必須 | ISO 8601 の日時 |
| `label` | `string` | 任意 | 一言の説明。リビジョンを選ぶ欄に出る |
| `author` | `string` | 任意 | 書いた人。リビジョンを選ぶ欄に出る |

型 `DiffSource` と `DiffRevision` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
`revisions` が配列でない・`id` か `at` が無いか形が合わない・`id` が重なる・`content` が文字列でないときは、reject と同じに扱う。

同じ要素へもう一度 `mount` を呼ぶと、前の描画を片付けてから描く。
前の戻り値の `update` は何もしなくなる。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `update` | `(markdown: string) => void` | 本文だけを描き直し、記法の操作を付け直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない |
| `destroy` | `() => void` | `el` の中を空にして class `mdmark` を外し、記法の操作と、印刷・`hashchange`・`document` の受け取りを外す。2 回目以降は何もしない |

### エラー

`opts.diffSource` を渡して `opts.docId` を渡さないときだけ、何も描かずに `TypeError` を投げる。
それ以外は例外を投げない。
取り出し元の `revisions`・`content` が reject するか、形に合わない値を返したときは、差分の場所を [知らせの枠](./用語集.md) に替え、文書の本文は描いたまま残す。
取り出し元の関数の名前・文書の `id`・リビジョンの `id`・元のエラーが `console.error` に出る。
外部ライブラリを読めない印の場所は、その場所だけを [知らせの枠](./用語集.md) に替え、ほかは描く。
読めなかった印の名前・URL・元のエラーが `console.error` に出る。
記法の印に読めない指定がある箇所は、読めた指定で描き、その箇所の前に [書き方の警告](./記法.md#書き方の警告) を置く。
索引が Schema に合わないときも、用語集の表の列名が表に無いときも、本文の描画を止めない。
合わない文書・用語の項目は除いて使い、用語集の表の誤りは、その箇所の書き方の警告で知らせる。
1 つのページに文書を 2 つ以上描いても、ツールチップと被参照の一覧の `id` はページの中で重ならない。

## 文書を HTML 文字列にする

画面を持たずに Markdown を HTML 文字列にする。
DOM を使わないため、`dist/index.js` を `import()` で読んだ Node の処理でも同じ文字列を返す。

### リクエスト

```js
import { render } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const html = render("# 見出し\n\n本文");
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `markdown` | 必須 | HTML にする Markdown |
| `opts.config` | 任意 | `mount` の `opts.config` と同じ。読むのは `features`（記法のオン・オフ）と `libraries` の名前（どの印を印の場所にするか）だけ |
| `opts.index` | 任意 | `mount` の `opts.index` と同じ |
| `opts.docId` | 任意 | `mount` の `opts.docId` と同じ |
| `opts.references` | 任意 | `mount` の `opts.references` と同じ |

### レスポンス

| 型 | 説明 |
| --- | --- |
| `string` | 本文の HTML 文字列。描く先の要素は含まない。class `mdmark` の要素の中に置くと mdmark の CSS が当たる |

同じ引数には、ブラウザでも Node でも同じ文字列を返す。
各記法の中身（全てのタブの中身・閉じた節の中身を含む）は、スクリプトを動かさなくても読める。
並べ替え・タブの切り替えなどの操作は `mount` が付ける。
用語の意味と関連文書、文書の末尾の被参照の一覧も、スクリプトを動かさなくても読める。
ツールチップを開閉する操作は `mount` が付ける。
図の部品の定義は、題・図・凡例の HTML にし、定義の JSON は残さない。図の操作は `mount` が付ける。

### エラー

なし。常に文字列を返す。
未知の印と、許可していない要素・属性は落とす。
外部ライブラリは読まず、対応表にある印と登録した拡張の印は読み込み中の枠に置き換えて返す。
記法の印に読めない指定がある箇所には、[書き方の警告](./記法.md#書き方の警告) を置く。
索引が Schema に合わないときも、合わない文書・用語の項目を除いて文字列を返す。

## 参照の表を作る

索引と全ての文書の本文から、文書ごとの被参照と、各文書の用語集の表から入れた用語をまとめた参照の表を返す。
使う側のサーバーなどがこの表を作り、`mount`・`render` の `opts.references` に渡す。
引数を書き換えず、ファイルとネットワークを読まない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返す。

### リクエスト

```js
import { collectReferences } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const references = collectReferences({
  index,
  documents: { "設計/arch.md": "# アーキテクチャ\n", "api.md": "# API\n" },
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.index` | 必須 | 使う側が索引の YAML を読んだオブジェクト。形は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて作る |
| `input.documents` | 必須 | 文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を引く表。索引に無いパスの文書は無視する。索引にあって表に無い文書は、`related` だけで参照に入る |
| `input.config` | 任意 | `mount` の `opts.config` と同じ。読むのは `features` だけで、文書ごとの `<!-- features: … -->` を重ね、`backlinks` がオフの文書を参照元にも参照先にもせず、`glossary` がオフの文書の表の用語を入れない |

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `backlinks` | `Record<string, string[]>` | 文書の `id` から、その文書を参照している文書の `id` の並びを引く表。並びは索引の `docs` の順で、重なりと自分自身は入らない。参照されていない文書は空の並び |
| `glossary` | `{ term, aliases, meaning, docId }[]` | 各文書の用語集の表から入れた用語の並び。並びは索引の `docs` の順で、同じ文書の中は表の行の順。`aliases` は別名の列を「、」か「,」で区切ったもので、別名の列が無いときは空。`docId` はその表を持つ文書の `id` |

参照は、次のどれかで数える。

- 参照元の `related` に、参照先の `id` がある
- 参照元の本文のリンクが、参照先の `path` を指す。リンクの `#` 以降と `?` 以降を除き、参照元の `path` のフォルダを基準に相対パスを解決して比べる。スキームを持つ URL・`#` だけのリンク・索引の外を指すリンクは参照にしない
- 参照元の本文に、参照先の `aliases` が出る。コード・リンク・見出し・用語集の表の中は照合しない

```json
{
  "backlinks": { "arch": ["api", "guide"], "api": ["arch"], "guide": [] },
  "glossary": []
}
```

全ての文書の本文を 1 回ずつ解析する。
結果は使う側が持ち、文書を書き換えたときに作り直す。

### エラー

例外は投げない。
索引の文書・用語の項目が Schema に合わないときは、合わない項目を除いて作る。
合わないことを知るには、[`checkIndex`](#索引を点検する) を呼ぶ。

## 索引を点検する

索引と、索引のフォルダにある文書の本文から、索引と文書のずれの一覧を返す。
ファイルを読むのは呼ぶ側で、mdmark は渡された値だけを確かめる。
引数・索引・文書を書き換えない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返す。

### リクエスト

```js
import { checkIndex } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const issues = checkIndex({ index, documents, indexFile: "docs/index.yaml" });
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.index` | 必須 | 使う側が索引の YAML を読んだ値。形を確かめる前の値をそのまま渡す |
| `input.documents` | 必須 | 索引のフォルダにある文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を引く表。どのファイルを文書として渡すかは呼ぶ側が決める |
| `input.indexFile` | 任意 | ずれの `file` に出す索引のファイルの名前。既定は `index.yaml` |

### レスポンス

ずれの一覧。ずれが無ければ空。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `string` | ずれのあるファイル。索引のずれは `indexFile`、文書のずれはその文書のパス |
| `where` | `string` | 索引のキーのパス（`docs[3].path`）か、文書の行。ファイル全体のずれは空文字 |
| `kind` | `'schema' \| 'missing_doc' \| 'orphan_doc' \| 'broken_ref' \| 'duplicate_term' \| 'avoided_term'` | ずれの種類。意味は [索引](./索引.md#点検が返すずれ) |
| `message` | `string` | ずれの内容と直し方を書いた日本語の 1 文 |

並びは `schema` → `missing_doc` → `orphan_doc` → `broken_ref` → `duplicate_term` → `avoided_term` の順で、同じ種類の中は索引の並びとパスの順。

```json
[
  { "file": "docs/index.yaml", "where": "docs[1].path", "kind": "missing_doc", "message": "`old.md` が見つかりません。文書を戻すか、索引の `docs[1]` を消してください。" },
  { "file": "new.md", "where": "", "kind": "orphan_doc", "message": "`new.md` が索引にありません。索引の `docs` に足してください。" }
]
```

索引の `docs[].path` と `documents` のキーは、`./` と重なった `/` を除いた文字列で比べる。
大文字と小文字は区別する。
渡された全ての文書を確かめ、上限は無い。

### エラー

例外は投げない。
索引が Schema に合わないときは、合わないところごとに `schema` のずれを返し、読めた文書・用語でほかのずれも確かめる。

## 拡張を登録する

使う側が自分の印の名前と、その印を描くモジュールの読み方を登録する。
文書にその印があるときだけ、`mount` と `update` が引数を検査してからモジュールを読み、印の場所に描かせる。
手順は [拡張を登録する](../使い方/カスタマイズ/拡張を登録する.md)。

### リクエスト

```js
import { registerExtension } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

registerExtension({
  name: "greet",
  directive: "greet",
  load: () => import("/extensions/greet.js"),
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `extension.name` | 必須 | 拡張の名前。空にできない。知らせの枠・書き方の警告・`console.error` に出す |
| `extension.directive` | 必須 | 拡張の印の名前（`<!-- {directive}: {引数} -->`）。英小文字で始まり、英小文字・数字・`-` だけを持つ。`features` と記法の印（`table`・`tabs`・`steps`・`section`・`row-detail`・`fig`・`toc`・`glossary`）と、登録済みの拡張の `directive` は使えない。設定の `libraries` や図の部品の印（`flow`・`sequence`・`chart`・`param`）に同じ名前があるときは、拡張を優先する |
| `extension.load` | 必須 | 拡張のモジュールを読む関数。文書に印があるときだけ、`mount` と `update` が描くごとに 1 回呼ぶ。同じ文書の同じ拡張の印では 1 回だけ呼ぶ |
| `extension.schema` | 任意 | 印の引数を検査する Standard Schema。zod・valibot など、`~standard` を持つ検査ライブラリの schema をそのまま渡せる。省くと検査しない |

拡張のモジュールは、`draw(slot, value)` を名前付きで export する。
`slot` は印の場所の要素、`value` は `{ args: string[]; keys: Record<string, string>; definition?: unknown }`。
`キー=値` でない引数を書いた順に `args`、`キー=値` の引数を `keys` に入れる。
印を範囲（`<!-- {directive} -->` 〜 `<!-- /{directive} -->`）で書き、範囲に言語 `json` のコードブロックを 1 つ置くと、その JSON を読んだ値を `definition` に入れる。範囲が無い印は `definition` を持たない。
`draw` は同期でも `Promise` を返す非同期でもよい。

`registerExtension` と、型 `MdmarkExtension`・`MdmarkExtensionModule`・`MdmarkMarkArgs`・`StandardSchemaV1` と、図の部品の定義の型 `MdmarkFlowDefinition`・`MdmarkSequenceDefinition`・`MdmarkChartDefinition`・`MdmarkParamDefinition` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
JavaScript で書く拡張は、この型定義に対して `tsc --noEmit` で点検できる（[固有の部品とCSSを当てる](../使い方/図を描く/固有の部品とCSSを当てる.md)）。
`StandardSchemaV1` は Standard Schema の仕様の型を書き写したもので、mdmark は検査ライブラリに依存しない。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `void` | 戻り値は無い。登録は同期で終わり、描いた後に登録した印は、次の `mount`・`update` から効く |

### エラー

登録するときは、次の例外を投げて登録しない。

| 例外 | 発生条件 |
| --- | --- |
| `TypeError` | `name` が空、`directive` が印の名前の書式に合わない、`load` が関数でない、または `schema` が `~standard` を持たない。メッセージに合わない項目の名前を含める |
| `Error` | `directive` が `features` か記法の印、または登録済みの拡張の `directive` と同じ。メッセージに重なった名前を含める |

描くときは例外を投げず、その印の場所だけを替えて、ほかは描く。

| 起きたこと | 印の場所 |
| --- | --- |
| 引数が `schema` に合わない | [書き方の警告](./記法.md#書き方の警告)。モジュールを読まない。issue ごとに項目を並べる。引数の位置まで届く指摘は `{位置} つ目の {値}: {message}`、キーまで届く指摘は `{キー}=: {message}`、届かない指摘は `{message}` だけの項目にする |
| `load` が拒否される、または `draw` が例外を投げる | [知らせの枠](./用語集.md)。拡張の名前と元のエラーが `console.error` に出る |
| `schema` の `validate` が例外を投げるか拒否される | [知らせの枠](./用語集.md)。`load` を呼ばない。拡張の名前と元のエラーが `console.error` に出る |

`render` は拡張の印を読み込み中の枠に置き換えるだけで、`load` も検査も呼ばない。

## テーマの CSS 変数

描いた文書の見た目の値を持つ変数。
使う側が `.mdmark` などに書いて上書きする。
手順は [テーマを上書きする](../使い方/カスタマイズ/テーマを上書きする.md)。

### リクエスト

```css
.mdmark {
  --mdmark-color-link: #c00;
  --mdmark-radius: 0;
}
```

### レスポンス

配色によらない変数。

<!-- table: data -->

| 変数 | 既定 | 使う場所 |
| --- | --- | --- |
| `--mdmark-font-body` | `system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif` | 本文の書体 |
| `--mdmark-font-heading` | `var(--mdmark-font-body)` | 見出しの書体 |
| `--mdmark-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | コードの書体 |
| `--mdmark-font-size` | `1rem` | 本文の文字の大きさ |
| `--mdmark-line-height` | `1.75` | 本文の行間 |
| `--mdmark-content-width` | `46rem` | 行の長さの上限 |
| `--mdmark-space` | `1rem` | ブロックの間隔の基準 |
| `--mdmark-padding` | `1.5rem` | 描く先の要素の内側の余白 |
| `--mdmark-radius` | `6px` | 角丸の大きさ（描く先の要素・コードブロック・引用・折り畳み・読み込み中の枠・知らせの枠・書き方の警告） |
| `--mdmark-heading-weight` | `600` | 見出しの太さ |
| `--mdmark-heading-rule-width` | `1px` | 見出し 1・見出し 2 の下の線の太さ。`0` にすると線が出ない |
| `--mdmark-table-rule-inline` | `1px` | 表のセルの左右の線の太さ（`plain` の種類は `0`） |
| `--mdmark-table-max-height` | `28rem` | 表の高さの上限。超える表は表の中で縦にスクロールし、見出し行を上端に留める |
| `--mdmark-color-term-underline` | `var(--mdmark-color-muted)` | 用語の語と文書の別名の、破線の下線の色 |
| `--mdmark-tooltip-max-width` | `22rem` | ツールチップの幅の上限。画面の幅から `2rem` を引いた幅を超えない |
| `--mdmark-tooltip-max-height` | `18rem` | ツールチップの高さの上限。画面の高さの 60% を超えない。超える分はツールチップの中でスクロールする |
| `--mdmark-diagram-lane-tint` | `8%` | 図の層の背景に敷く、箱の色の濃さ |
| `--mdmark-diagram-max-height` | `36rem` | 文書の中の図の表示する枠の高さの上限。全体が収まる倍率はこの高さと枠の幅に収める |
| `--mdmark-diff-minimap-width` | `14px` | 差分のミニマップの帯の幅 |
| `--mdmark-diff-minimap-z-index` | `10` | 差分のミニマップの帯の重なり順。使う側のページの固定のヘッダーなどに隠れるときに上げる |
| `--mdmark-h1-marker` | なし（記号を出さない） | 見出し 1 の前に置く記号。引用符で囲んだ文字列で書く |
| `--mdmark-h2-marker` | なし（記号を出さない） | 見出し 2 の前に置く記号。引用符で囲んだ文字列で書く |
| `--mdmark-h3-marker` | なし（記号を出さない） | 見出し 3 の前に置く記号。引用符で囲んだ文字列で書く |

<!-- /table -->

配色の変数。ダークの配色は、画面で OS の設定がダークのときに当たる。印刷では明るい配色に戻る。

<!-- table: data -->

| 変数 | 明るい配色 | ダークの配色 | 使う場所 |
| --- | --- | --- | --- |
| `--mdmark-color-bg` | `#ffffff` | `#0d1117` | 描く先の要素の地 |
| `--mdmark-color-text` | `#1f2328` | `#f0f6fc` | 本文の文字 |
| `--mdmark-color-heading` | `#1f2328` | `#f0f6fc` | 見出しの文字 |
| `--mdmark-color-muted` | `#59636e` | `#9198a1` | 引用・読み込み中の枠の文字 |
| `--mdmark-color-link` | `#0969da` | `#4493f8` | リンクとフォーカスの枠 |
| `--mdmark-color-border` | `#d1d9e0` | `#3d444d` | 枠・罫線・読み込み中の枠の破線 |
| `--mdmark-color-surface` | `#f6f8fa` | `#151b23` | コード・表の本文の行・引用の面 |
| `--mdmark-color-scroll-shadow` | `rgb(31 35 40 / 0.22)` | `rgb(145 152 161 / 0.5)` | 表とコードブロックに横の続きがあることを示す影 |
| `--mdmark-color-notice-bg` | `#fff8c5` | `#2a2110` | 知らせの枠の地 |
| `--mdmark-color-notice-border` | `#9a6700` | `#bb8009` | 知らせの枠の線・書き方の警告の枠の破線 |
| `--mdmark-color-notice-text` | `#1f2328` | `#f0f6fc` | 知らせの枠の文字・書き方の警告の文字 |
| `--mdmark-color-table-head` | `#e6ebf0` | `#262c36` | 表の見出し行の面 |
| `--mdmark-color-callout-note` | `#0969da` | `#4493f8` | 補足の注意書きの枠の線・題・アイコン |
| `--mdmark-color-callout-tip` | `#1a7f37` | `#3fb950` | ヒントの注意書きの枠の線・題・アイコン |
| `--mdmark-color-callout-important` | `#8250df` | `#ab7df8` | 重要の注意書きの枠の線・題・アイコン |
| `--mdmark-color-callout-warning` | `#9a6700` | `#d29922` | 警告の注意書きの枠の線・題・アイコン |
| `--mdmark-color-callout-caution` | `#d1242f` | `#f85149` | 注意の注意書きの枠の線・題・アイコン |
| `--mdmark-color-current-bg` | `#ddf4ff` | `#121d2f` | [まとめた HTML](./用語集.md) の文書の一覧の、開いている文書の行の背景 |
| `--mdmark-color-diagram-llm` | `#8250df` | `#ab7df8` | 図の LLM の箱と LLM の層の色 |
| `--mdmark-color-diagram-dm` | `#0550ae` | `#79c0ff` | 図の意思決定モデルの箱の色 |
| `--mdmark-color-diagram-script` | `#59636e` | `#9198a1` | 図のスクリプトの箱の色 |
| `--mdmark-color-diagram-mcp` | `#bc4c00` | `#f0883e` | 図の MCP の箱と処理の層の色 |
| `--mdmark-color-diagram-data` | `#1b7c83` | `#39c5cf` | 図のデータの箱とデータの層の色 |
| `--mdmark-color-diagram-external` | `#1a7f37` | `#3fb950` | 図の外部のシステムの箱の色 |
| `--mdmark-color-diagram-line` | `#59636e` | `#9198a1` | 図の処理の流れ・戻る線の色 |
| `--mdmark-color-series-1` | `#0969da` | `#4493f8` | グラフの 1 つ目の系列の色（実線・丸の点） |
| `--mdmark-color-series-2` | `#bc4c00` | `#f0883e` | グラフの 2 つ目の系列の色 |
| `--mdmark-color-series-3` | `#8250df` | `#ab7df8` | グラフの 3 つ目の系列の色 |
| `--mdmark-color-series-4` | `#1b7c83` | `#39c5cf` | グラフの 4 つ目の系列の色 |
| `--mdmark-color-diff-del-bg` | `#ffebe9` | `#25171c` | 差分の削除した行の背景 |
| `--mdmark-color-diff-del-word` | `#ffcecb` | `#6b2b2b` | 差分の削除した行で変わった語の背景 |
| `--mdmark-color-diff-del-sign` | `#d1242f` | `#f85149` | 削除した行の行頭の `-` と、ミニマップの削除した行の印の色 |
| `--mdmark-color-diff-add-bg` | `#dafbe1` | `#12261e` | 差分の追加した行の背景 |
| `--mdmark-color-diff-add-word` | `#aceebb` | `#1a4a29` | 差分の追加した行で変わった語の背景 |
| `--mdmark-color-diff-add-sign` | `#1a7f37` | `#3fb950` | 追加した行の行頭の `+` と、ミニマップの追加した行の印の色 |

<!-- /table -->

### エラー

なし。書かなかった変数は既定の値になる。
