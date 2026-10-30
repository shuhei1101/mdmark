# API

公開関数と CSS 変数の一覧

どれも [配布物を読み込む](../使い方/導入/配布物を読み込む.md) で読み込んだページから使う。

## 一覧

<!-- table: data -->

| 名前 | 呼び出し | 説明 |
| --- | --- | --- |
| [版を返す](#版を返す) | `version()` | 読み込んだ配布物の版を返す |
| [版を CSS 変数で読む](#版を-css-変数で読む) | `--mdmark-version` | 読み込んだ CSS の版を持つ |
| [文書を描く](#文書を描く) | `mount(el, opts)` | 要素の中に Markdown を HTML として描く |
| [差分の出し方を読む](#差分の出し方を読む) | `diffModes` | `mount` の `opts.diffMode` に渡せる差分の出し方の一覧を持つ |
| [文書を HTML 文字列にする](#文書を-html-文字列にする) | `render(markdown, opts)` | 画面を持たずに Markdown を HTML 文字列にする |
| [参照の表を作る](#参照の表を作る) | `collectReferences(input)` | 索引と全ての文書の本文から、文書ごとの被参照と、用語集の表の用語をまとめた参照の表を返す |
| [本文の参照を取り出す](#本文の参照を取り出す) | `collectMatches(input)` | 索引と文書の本文から、本文に出た用語・文書の別名の一致を、参照先と本文の位置つきで返す |
| [索引を点検する](#索引を点検する) | `checkIndex(input)` | 索引と文書のずれの一覧を返す |
| [エイリアスを作る](#エイリアスを作る) | `buildAliases(input)` | 設定の `aliases` の行と読んだ YAML から、エイリアスと使えない行・レコードのずれを返す |
| [拡張を登録する](#拡張を登録する) | `registerExtension(extension)` | 使う側が自分の印と、その印を描くモジュールの読み方を登録する |
| [ビューを描く](#ビューを描く) | `mountView(el, opts)` | 列名と項目の値から、要素の中にボード表示と表形式のビューを描く |
| [コメントを付ける](#コメントを付ける) | `mountComments(el, opts)` | 使う側の要素の中の選んだ箇所に、コメントを付けられるようにする |
| [テーマの CSS 変数](#テーマの-css-変数) | `--mdmark-*` | 見た目の値を持つ変数。使う側が上書きする |

<!-- /table -->

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
索引の用語の `avoid` と用語集の表の `avoid=` の列に並べたやめた言い方が本文に出ると、波線のマーカーを引き、代わりの用語の語と意味のツールチップを出す（`glossary` がオンのときだけ）。
`opts.aliases` に渡したエイリアス（[`buildAliases`](#エイリアスを作る) が作る）の名前と別名にも同じ下線を引き、種類ごとのツールチップを出す（`glossary` がオンのときだけ）。
コマンドのエイリアスのツールチップには、コマンドをコピーするボタンを付ける。
ツールチップの操作は `mount` が付け、`update` で付け直し、`destroy` で外す。
書き方は [索引と用語集を書く](../使い方/書く/索引と用語集を書く.md)。
図の部品の定義（[図の部品](./記法.md#図の部品)）があると、図の拡大・縮小・移動・全画面とツールチップ、操作できる部品の値の変更と写す操作も付ける。
`opts.diffSource` を渡すと、文書の題の後ろに「変更を見る」のボタンを付け、押すと 2 つのリビジョンの差分を出す。
`opts.diffMode` で差分の出し方を選べる。`open` はボタンを押した状態で描き、`blocks` はボタンを付けず、描いた文書のブロックを追加と削除の色で塗り分ける。
差分の操作は `mount` が付け、`update` で閉じ、`destroy` で外す。
仕組みは [差分を表示する仕組み](../はじめに/コアコンセプト/差分を表示する仕組み.md)、書き方は [差分を表示する](../使い方/導入/差分を表示する.md)。
ビューの印（[ビュー](./記法.md#ビュー)）があると、ボード表示と表形式の切り替えと、表形式の列の絞り込みも付ける。
`opts.commentStore` と `opts.docId` を渡して機能 `comments` をオンにすると、本文の選んだ箇所にコメントを付けられる。
コメントのボタン・入力欄・印・吹き出しの操作は `mount` が付け、`update` で付け直し、`destroy` で外す。
書き方は [ビューとコメントを使う](../使い方/書く/ビューとコメントを使う.md)。
ビューとコメントの部品のモジュール（`dist/view.js`・`dist/comments.js`）は、ビューの印のある文書とコメントの機能がオンのときにだけ、`dist/index.js` の隣から読む。

### リクエスト

```js
import { mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = mount(document.querySelector("#doc"), { markdown: "# 見出し\n\n本文" });
handle.update("# 次の見出し");
handle.destroy();
```

<!-- table: data -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素。class `mdmark` が付く |
| `opts.markdown` | 必須 | 描く Markdown |
| `opts.config` | 任意 | 使う側のサーバーが `mdmark.config.yaml` を読んだオブジェクト。省いたキーには既定を当てる。キーは [設定](./設定.md) |
| `opts.index` | 任意 | 使う側のサーバーが、設定の `index` のパスの索引の YAML を読んだオブジェクト。形は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて使う。省くと、描く文書の用語集の表だけで用語を照合し、被参照を出さない |
| `opts.docId` | 任意 | 描く文書の索引の `id`。被参照の一覧を引き、関連文書から自分を除き、リンクの相対パスを求めるのに使う。省くと、被参照の一覧を出さず、関連文書のリンクは索引の `path` のままにする。索引に無い `id` は、省いたときと同じに扱う。`opts.commentStore` を渡すときは必須で、コメントの読み書きの関数に渡す対象の ID にもなる |
| `opts.references` | 任意 | [`collectReferences`](#参照の表を作る) が返した参照の表。被参照の一覧と、ほかの文書の用語集の表の用語とそのやめた言い方に使う。用語の `avoid` は任意で、無い用語はやめた言い方を持たないものとして扱う。省くと、被参照は索引の `related` だけから出し、ほかの文書の用語集の表の用語を照合しない |
| `opts.aliases` | 任意 | [`buildAliases`](#エイリアスを作る) が作ったエイリアスの並び（`MdmarkAlias[]`）。使えないエイリアス（必須のキーが空・知らない種類・重なった `id`）は除いて使い、`env` の種類は直接渡されても照合しない。`update` は描いたときのエイリアスを使う。省くと、エイリアスを照合しない |
| `opts.diffSource` | 任意 | 文書のリビジョンの一覧と、リビジョンごとの本文を返す取り出し元（`DiffSource`）。渡すと、描いた文書に差分を開く UI が付く。`opts.docId` と一緒に渡す。省くと、差分の UI を付けない |
| `opts.diffMode` | 任意 | 差分の出し方。`button`・`open`・`blocks` のどれか。省くと `button`。`opts.diffSource` を渡さないときは使わない。知らない値は `button` として扱う |
| `opts.commentStore` | 任意 | コメントを読み込み、保存する関数（`MdmarkCommentStore`）。機能 `comments` がオンのときだけ使う。`opts.docId` と一緒に渡す。省くと、コメントを付けられない |

<!-- /table -->

`opts.diffMode` の値。

| 値 | 出し方 |
| --- | --- |
| `button` | 読む人が「変更を見る」を押してから、2 つのリビジョンの差分の行を出す |
| `open` | 描いた時点で「変更を見る」を押した状態にして、差分の行を出す。押し直すと閉じ、`update` の後も開いた状態で描き直して取り出し元を呼び直す |
| `blocks` | 「変更を見る」と差分の場所・ミニマップを置かず、描いた文書のブロックを追加・変更は追加の色、削除は削除の色で塗り分ける。本文を描いた後に `revisions` を 1 回呼び、2 つ以上あれば 2 番目を前、1 番目を後として `content` を 1 回ずつ呼ぶ。待つ間・リビジョンが 1 つのとき・2 つの本文が同じときは、`opts.markdown` を色を当てずに描いたままにする。`update` のたびに取り出し元を呼び直す |

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

`opts.commentStore` の形。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `load({ docId })` | `(target: { docId: string }) => Promise<MdmarkComment[]>` | その文書に付いたコメントを返す。描くたび（`mount`・`update`）に 1 回呼ぶ |
| `save({ docId, comment })` | `(target: { docId: string; comment: MdmarkCommentDraft }) => Promise<MdmarkComment>` | 下書きのコメントを保存し、`id` を加えたコメントを返す。読む人が「コメントを保存」を押すたびに呼ぶ |

`MdmarkCommentDraft` の形。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `quote` | `string` | 選んだ文字 |
| `prefix` | `string` | 選んだ文字の前の最大 32 文字 |
| `suffix` | `string` | 選んだ文字の後の最大 32 文字 |
| `body` | `string` | コメントの本文 |

`MdmarkComment` は、`MdmarkCommentDraft` に空でない文字列の `id` を加えたもの。
型 `MdmarkCommentStore`・`MdmarkComment`・`MdmarkCommentDraft` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
`load` が配列でない・要素の形が合わないとき、`save` が形の合わない値を返すときは、reject と同じに扱う。
mdmark はコメントを保存せず、保存先は使う側の関数に任せる。

同じ要素へもう一度 `mount` を呼ぶと、前の描画を片付けてから描く。
前の戻り値の `update` は何もしなくなる。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `update` | `(markdown: string) => void` | 本文だけを描き直し、記法の操作を付け直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない |
| `destroy` | `() => void` | `el` の中を空にして class `mdmark` を外し、記法の操作と、印刷・`hashchange`・`document` の受け取りを外す。コメントのボタン・入力欄・吹き出しも外す。2 回目以降は何もしない |

### エラー

`opts.diffSource` を渡して `opts.docId` を渡さないとき、`opts.commentStore` を渡して `opts.docId` を渡さないか `opts.commentStore` が `load`・`save` の関数を持たないときだけ、何も描かずに `TypeError` を投げる。
メッセージに `docId` か `commentStore` を含める。
それ以外は例外を投げない。
取り出し元の `revisions`・`content` が reject するか、形に合わない値を返したときは、差分の場所を [知らせの枠](./用語集.md) に替え、文書の本文は描いたまま残す。
取り出し元の関数の名前・文書の `id`・リビジョンの `id`・元のエラーが `console.error` に出る。
`opts.diffMode` が `blocks` のときに取り出し元が同じように失敗したときは、`opts.markdown` を色を当てずに描いた本文を残し、本文の先頭に `変更を表示できません` の [知らせの枠](./用語集.md) を置く。
`console.error` に出す内容は同じ。
コメントの `save` が reject するか、形に合わない値を返したときは、入力欄に書いた本文を残して `role="alert"` の知らせを出し、印を付けない。
`load` が reject するか、形に合わない値を返したときは、印を付けずに続け、新しいコメントは付けられる。
どちらも読み書きの関数の名前・文書の `id`・元のエラーが `console.error` に出る。
`comments` がオンで `opts.commentStore` を渡さないときは、コメントのボタンを出さず、読み書きの関数が要ることを `mount` ごとに 1 回だけ `console.error` に出す。
ビューかコメントの部品のモジュールを読めないときは、ビューの印の場所を `render` が出した表のまま残し、コメントはボタンを出さず `load` も呼ばない。
読めなかった部品の名前（`view` か `comments`）・モジュールの URL・元のエラーが `console.error` に出る。
外部ライブラリを読めない印の場所は、その場所だけを [知らせの枠](./用語集.md) に替え、ほかは描く。
読めなかった印の名前・URL・元のエラーが `console.error` に出る。
記法の印に読めない指定がある箇所は、読めた指定で描き、その箇所の前に [書き方の警告](./記法.md#書き方の警告) を置く。
索引が Schema に合わないときも、用語集の表の列名が表に無いときも、本文の描画を止めない。
合わない文書・用語の項目は除いて使い、用語集の表の誤りは、その箇所の書き方の警告で知らせる。
1 つのページに文書を 2 つ以上描いても、ツールチップと被参照の一覧の `id` はページの中で重ならない。

## 差分の出し方を読む

`mount` の `opts.diffMode` に渡せる差分の出し方の一覧を持つ。
読み込んだ配布物が目的の出し方に対応するかを、`mount` を呼ぶ前に確かめるときに使う。

### リクエスト

引数はなし。
`diffModes` は関数ではなく、配布物が名前付きで公開する値。

```js
import * as mdmark from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const supportsBlocks = mdmark.diffModes?.includes("blocks") ?? false;
```

### レスポンス

| 型 | 説明 | 例 |
| --- | --- | --- |
| `readonly ["button", "open", "blocks"]` | `opts.diffMode` に渡せる値 | `["button", "open", "blocks"]` |

`opts.diffMode` を知らない古いバージョンの配布物は、`diffModes` を持たない。
そのバージョンの `mount` は `opts.diffMode` を黙って無視するため、`diffModes` が無いか目的の出し方を含まないときは、その出し方に対応しないバージョンと見なす。

### エラー

なし。

## 文書を HTML 文字列にする

画面を持たずに Markdown を HTML 文字列にする。
DOM を使わないため、`dist/index.js` を `import()` で読んだ Node の処理でも同じ文字列を返す。

### リクエスト

```js
import { render } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const html = render("# 見出し\n\n本文");
```

<!-- table: data -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `markdown` | 必須 | HTML にする Markdown |
| `opts.config` | 任意 | `mount` の `opts.config` と同じ。読むのは `features`（記法のオン・オフ）と `libraries` の名前（どの印を印の場所にするか）だけ |
| `opts.index` | 任意 | `mount` の `opts.index` と同じ |
| `opts.docId` | 任意 | `mount` の `opts.docId` と同じ |
| `opts.references` | 任意 | `mount` の `opts.references` と同じ |
| `opts.aliases` | 任意 | `mount` の `opts.aliases` と同じ |

<!-- /table -->

### レスポンス

| 型 | 説明 |
| --- | --- |
| `string` | 本文の HTML 文字列。描く先の要素は含まない。class `mdmark` の要素の中に置くと mdmark の CSS が当たる |

同じ引数には、ブラウザでも Node でも同じ文字列を返す。
各記法の中身（全てのタブの中身・閉じた節の中身を含む）は、スクリプトを動かさなくても読める。
並べ替え・タブの切り替えなどの操作は `mount` が付ける。
用語の意味と関連文書、やめた言い方の代わりの用語、エイリアスの種類ごとの説明、文書の末尾の被参照の一覧も、スクリプトを動かさなくても読める。
ツールチップを開閉する操作と、コマンドをコピーするボタンの操作は `mount` が付ける。
図の部品の定義は、題・図・凡例の HTML にし、定義の JSON は残さない。図の操作は `mount` が付ける。

本文のブロック（見出し・段落・リスト・リストの項目・表・表の行・コードブロック・引用・水平線・注意書き・印の範囲を囲む要素）の開始の要素には、そのブロックが Markdown で始まる行の番号を `data-source-line` で付ける。
番号は 0 始まりで、Markdown の 1 行目が `0`。
入れ子のブロックは、それぞれの開始の行を持つ。
VS Code のエディタの行番号（0 始まり）とそのまま比べられるため、エディタとプレビューのスクロールを合わせる手がかりに使う。
コードブロックの行の `data-line`（コードの中の 1 始まりの行番号）と、図の線の `data-line`（線の種類）とは別の属性で、sanitize は `data-source-line` を全ての要素で残す。
`mount` が描いた本文のブロックにも、同じ `data-source-line` が付く。

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
| `glossary` | `{ term, aliases, meaning, docId, avoid }[]` | 各文書の用語集の表から入れた用語の並び。並びは索引の `docs` の順で、同じ文書の中は表の行の順。`aliases` は別名の列を「、」か「,」で区切ったもので、別名の列が無いときは空。`docId` はその表を持つ文書の `id`。`avoid` はやめた言い方の列を別名と同じく区切ったもので、やめた言い方の列が無いときは空 |

参照は、次のどれかで数える。

- 参照元の `related` に、参照先の `id` がある（オブジェクトの要素は `to` が参照先の `id`）
- 参照元の本文のリンクが、参照先の `path` を指す。リンクの `#` 以降と `?` 以降を除き、参照元の `path` のフォルダを基準に相対パスを解決して比べる。スキームを持つ URL・`#` だけのリンク・索引の外を指すリンクは参照にしない
- 参照元の本文に、参照先の `aliases` が出る。コード・リンク・見出し・用語集の表の中は照合しない。別名と本文の文字は、NFKC・英字の小文字化・前後の空白の除去で正規化して比べる

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

## 本文の参照を取り出す

索引と文書の本文から、本文に出た用語・文書の別名の一致を、参照先と本文の位置つきで返す。
画面を出さずに、描いた文書の下線とツールチップと同じ補足を取り出したいときに呼ぶ。
引数を書き換えず、ファイルとネットワークを読まない。
DOM に頼らず、Node とブラウザのどちらでも動く。

### リクエスト

```js
import { collectMatches } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const { byDocument, avoided, targets } = collectMatches({
  index,
  documents: { "使い方/guide.md": "# 使い方\n\nWS で公開関数を呼ぶ。作業場は使わない。" },
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.index` | 必須 | 使う側が索引の YAML を読んだオブジェクト。形は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて照合する |
| `input.documents` | 必須 | 文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を引く表。複数の文書を渡せる。索引に無いパスの文書は無視する。ほかの文書の用語集の表の用語も、この表にある本文から読む |
| `input.config` | 任意 | `mount` の `opts.config` と同じ。読むのは `features` だけで、文書ごとの `<!-- features: … -->` を重ね、`glossary`・`backlinks`・`html`・`diagrams` のオン・オフを文書ごとに決める |
| `input.aliases` | 任意 | `mount` の `opts.aliases` と同じ。使えないエイリアス（`env` を含む）は `mount` と同じく除いて照合する。省くと、エイリアスを照合しない |

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `byDocument` | `Record<string, MdmarkMatch[]>` | 文書の `id` から、その文書の本文の一致の並びを引く表。キーは `documents` に本文がある索引の文書で、一致が無い文書は空の並び。並びは本文の頭からの順（行の順、同じ行は始まりの順）で、同じ参照先の出現も全て並べる |
| `avoided` | `Record<string, MdmarkAvoidedMatch[]>` | 文書の `id` から、その文書の本文に出たやめた言い方の並びを引く表。キーは `byDocument` と同じで、やめた言い方が無い文書と `glossary` がオフの文書は空の並び。並びは本文の頭からの順で、同じやめた言い方の出現も全て並べる |
| `targets` | `MdmarkMatchTarget[]` | 渡した全ての文書の参照先を、種類と `id` の組で重なりを除いてまとめた並び。同じ参照先は 1 回だけ入る。並びは索引の `docs` の順に文書を見て、その文書の中の初出の順 |

`byDocument` の要素（`MdmarkMatch`）は、次のキーを持つ。

<!-- table: data -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `kind` | `'term' \| 'glossary' \| 'doc' \| 'alias'` | 参照先の種類。`term` は索引の用語、`glossary` は用語集の表の用語、`doc` は別名が一致した文書、`alias` は `input.aliases` のエイリアス |
| `aliasType` | `'term' \| 'doc' \| 'command' \| 'url' \| 'skill' \| 'tool' \| 'path'` | エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ |
| `id` | `string` | 参照先の `id`。`term` は `terms[].id`、`glossary` は `glossary:{表を持つ文書の id}:{用語}`、`doc` は `docs[].id`、`alias` はエイリアスの `id` |
| `title` | `string` | 参照先のタイトル。`term` は `terms[].term`、`glossary` は用語の列、`doc` は `docs[].title`、`alias` はエイリアスの `name` |
| `description` | `string` | 参照先の短い説明。`term` は `terms[].meaning`、`glossary` は意味の列、`doc` は `docs[].description`、`alias` はエイリアスの `description`。`doc` と `alias` で `description` を持たないときは、このキーを持たない |
| `text` | `string` | 一致した文字列。照合した辞書の語で、別名で一致したときはその別名。索引・用語集の表に記載した表記で返し、本文の表記は `line`・`start`・`end` から引く |
| `line` | `number` | 一致した本文の Markdown の行。1 から数える |
| `start` | `number` | その行の中の始まりの位置。0 から数える UTF-16 の位置 |
| `end` | `number` | その行の中の終わりの位置（含まない）。UTF-16 の位置 |

<!-- /table -->

`avoided` の要素（`MdmarkAvoidedMatch`）は、次のキーを持つ。

<!-- table: data -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `kind` | `'term' \| 'glossary' \| 'alias'` | 代わりの用語の種類。`byDocument` の要素の `term`・`glossary` と同じ。`alias` は、`term` の種類のエイリアスの `avoid` か、`avoid` の種類のエイリアス。`avoid` の種類は、`title` を `replacement` にし、`description` を持たない |
| `aliasType` | `'term' \| 'avoid'` | エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ |
| `id` | `string` | 代わりの用語の `id`。`byDocument` の要素の `id` と同じ書き方 |
| `title` | `string` | 代わりの用語のタイトル。`byDocument` の要素の `title` と同じ書き方 |
| `description` | `string` | 代わりの用語の短い説明。`byDocument` の要素の `description` と同じ書き方 |
| `text` | `string` | 一致したやめた言い方。`byDocument` の要素の `text` と同じく、索引・用語集の表に記載した表記で返す |
| `line` | `number` | `byDocument` の要素の `line` と同じ |
| `start` | `number` | `byDocument` の要素の `start` と同じ |
| `end` | `number` | `byDocument` の要素の `end` と同じ |

<!-- /table -->

`targets` の要素（`MdmarkMatchTarget`）は、`kind`・`aliasType`・`id`・`title`・`description` を `byDocument` の要素と同じ値で持つ。

```json
{
  "byDocument": {
    "guide": [
      { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を置くフォルダ", "text": "WS", "line": 3, "start": 0, "end": 2 },
      { "kind": "doc", "id": "api", "title": "API", "description": "公開関数の一覧", "text": "公開関数", "line": 3, "start": 4, "end": 8 }
    ]
  },
  "avoided": {
    "guide": [
      { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を置くフォルダ", "text": "作業場", "line": 3, "start": 12, "end": 15 }
    ]
  },
  "targets": [
    { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を置くフォルダ" },
    { "kind": "doc", "id": "api", "title": "API", "description": "公開関数の一覧" }
  ]
}
```

#### 照合の範囲

用語のツールチップと同じ辞書と照合を使う。

- 辞書は、索引の `terms`、`input.aliases`（並びの順）、照合する文書の用語集の表、ほかの文書の表の順に優先する。文書の別名は、照合する文書自身の別名を除く
- 語の始まりと終わりが本文の語の区切りに揃うところだけを取り、重なるときは長い語を先に取る。語の区切りは実行環境に依る（`Intl.Segmenter` の有無と辞書で決まる）ため、同じ実行環境で描いた文書の下線と同じ一致を返す
- 照合の前に、辞書の語と本文の文字の両方を、NFKC・英字の小文字化・前後の空白の除去で正規化する。正規化した後に同じになる語は 1 つの語として扱い、優先の順で先の用語を使う。`line`・`start`・`end` は、正規化する前の本文の位置を指す
- 照合するのは本文の地の文で、コード・リンク・見出し・用語集の表の中は除く
- `html` がオンの文書は、`<!-- html -->` の範囲の `html` のコードブロックに書いた HTML の文字も照合する。`a`・`code`・`pre`・`button`・見出しが直接持つ文字と、タグ・属性の値・`script` のように中身ごと落ちる要素は除く
- `diagrams` がオンの文書は、図の部品の範囲の定義と、埋め込んだ HTML の中の図の部品の custom element の定義に記載した `{{語}}` の語が正規化した後に用語に一致し、意味が空でないとき、その用語の参照にする。文書の別名は引かない
- 文書の印で `glossary` がオフの文書は用語・エイリアス・やめた言い方を、`backlinks` がオフの文書は文書の別名を照合しない。`glossary` がオフの文書の用語集の表は、ほかの文書の照合にも入れない
- やめた言い方（索引の用語の `avoid` と、エイリアスの `avoid` の種類の `name`・`aliases` と `term` の種類の `avoid`、用語集の表の `avoid=` の列。用語の語・別名と同じ語は除く）は、用語・文書の別名の語に追加して照合し、やめた言い方に当たったところを `avoided` に返す。照合するのは地の文と、`html` がオンなら埋め込んだ HTML の文字で、図の部品の `{{語}}` は照合しない。用語・別名の一部として出たやめた言い方は返さない

ツールチップの、節ごとに同じ参照先の最初の 1 回だけに下線を付ける制限は下線の出し方のためで、取り出しには効かない。
やめた言い方のマーカーの、節ごとに言い方ごとの最初の 1 回だけに付ける制限も、取り出しには効かない。

#### 位置の数え方

`line` は本文の Markdown の行を 1 から、`start`・`end` はその行の中の位置を 0 から数える UTF-16 の位置で返す。
改行は `\n` で数える。
本文の文字が実体参照やエスケープで記載されているときは、本文に記載したままの範囲を指す（`A&amp;B` に一致した `A&B` は `A&amp;B` の範囲）。

全ての文書の本文を 1 回ずつ解析する。
結果は使う側が持ち、文書を書き換えたときに作り直す。

### エラー

例外は投げない。
索引の文書・用語の項目が Schema に合わないときは、合わない項目を除いて照合する。
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
| `input.changedPaths` | 任意 | 比べる基準から変わった文書のパス（`documents` のキーと同じ書き方）の並び。渡したときだけ、`change_together` の組のうち片方の文書だけが変わった組を `missed_change_together` で返す。省くと直し忘れを確かめない。索引のどの `path` にも当たらないパスは無視する。基準の引き方（git の比べ方）は呼ぶ側が決める |

索引の `docs[].related` の要素は、`MdmarkIndexRelated` のオブジェクトか、関連する文書の `id` の文字列。

| 項目 | 型 | 必須 / 任意 | 説明 |
| --- | --- | --- | --- |
| `to` | `string` | 必須 | 相手の文書の `id` |
| `type` | `MdmarkRelationType` | 必須 | 関係の種類。`'requires' \| 'references' \| 'replaces' \| 'part_of' \| 'change_together'` |
| `when` | `string` | 必須 | いつ読むかの 1 文。空にできない |
| `paths` | `string[]` | 任意 | 関連が当たるファイルの glob の並び |

型 `MdmarkIndexRelated`・`MdmarkRelationType` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
キーの意味は [索引](./索引.md#関連の要素)。

### レスポンス

ずれの一覧。ずれが無ければ空。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `string` | ずれのあるファイル。索引のずれは `indexFile`、文書のずれはその文書のパス |
| `where` | `string` | 索引のキーのパス（`docs[3].path`）か、文書の行。ファイル全体のずれは空文字 |
| `kind` | `'schema' \| 'missing_doc' \| 'orphan_doc' \| 'broken_ref' \| 'untyped_related' \| 'one_sided_change_together' \| 'related_link_overlap' \| 'missed_change_together' \| 'duplicate_term' \| 'avoided_term' \| 'duplicate_tag' \| 'tag_alias_conflict' \| 'broken_tag_replacement' \| 'unregistered_tag' \| 'deprecated_tag'` | ずれの種類。意味は [索引](./索引.md#点検が返すずれ) |
| `message` | `string` | ずれの内容と直し方を書いた日本語の 1 文 |

並びは `schema` → `missing_doc` → `orphan_doc` → `broken_ref` → `untyped_related` → `one_sided_change_together` → `related_link_overlap` → `missed_change_together` → `duplicate_term` → `avoided_term` → `duplicate_tag` → `tag_alias_conflict` → `broken_tag_replacement` → `unregistered_tag` → `deprecated_tag` の順で、同じ種類の中は索引の並びとパスの順。
タグの 5 種類は、索引がタグの語彙（`tags`）を記載しているときだけ返す。

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

## エイリアスを作る

設定の `aliases` の行と、行の `paths` に当たった YAML を読んだ中身から、`metadata` を当てたエイリアスの並びと、使えない行・レコードのずれの一覧を返す。
CLI の `export`・`build`・`check` と、使う側の処理が同じ関数を使い、返したエイリアスを `mount`・`render`・`collectMatches` の `aliases` に渡す。
ファイルを読むのは呼ぶ側で、mdmark は渡された値だけからエイリアスを作る。
引数を書き換えず、ファイルとネットワークを読まない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返す。

### リクエスト

```js
import { buildAliases } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const { aliases, problems } = buildAliases({
  rows: [{ id: "terms", paths: ["terms/*.yaml"], records: "terms", metadata: { alias_type: { type: "custom", value: "term" }, name: { type: "ref", field: "term" } } }],
  sources: [{ rowId: "terms", path: "terms/glossary.yaml", data: { terms: [{ id: "ws", term: "ワークスペース", description: "話し合いの記録を置くフォルダ" }] } }],
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.rows` | 必須 | 使う側が設定の `aliases` を読んだ配列。行の形は [設定](./設定.md#エイリアスの元の行)。`id`・`paths`・`metadata.alias_type` を持たない行は使わず、ずれにもしない（形は `mdmark check` が `schema` のずれで返す）。`enabled` が `false` の行は読まない |
| `input.sources` | 必須 | 行の `paths` に当たったファイルを YAML として読んだ中身（`MdmarkAliasSource`）の並び。行ごとに `paths` に記載した順、glob の中はパスの順に並べる。読めなかったファイルと、どのファイルにも当たらなかった `paths` は呼ぶ側が扱い、ここには入れない |
| `input.configFile` | 任意 | 行のずれの `file` に出す設定ファイルの名前。既定は `mdmark.config.yaml` |

`MdmarkAliasSource` の形。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `rowId` | `string` | そのファイルを指した行の `id` |
| `path` | `string` | ファイルのパス（設定ファイルのフォルダからの相対パス。区切りは `/`）。ずれの `file` と、`name` を持たないときの名前に使う |
| `data` | `unknown` | ファイルを YAML として読んだ値 |

行の `records` を記載した行はファイルのそのキーの配列の要素ごとに、記載しない行はファイルの値を 1 件にして、レコード 1 つからエイリアスを 1 つ作る。
値の取り方と種類ごとの必須のキーは [設定](./設定.md#エイリアスの元の行)。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `aliases` | `MdmarkAlias[]` | 作ったエイリアスの並び。並びは行の並び、行の中は `sources` の並び、ファイルの中は `records` の配列の並びで、この並びが同じ語に当たったときの優先の順になる。`env` と、使えないエイリアスは入らない |
| `problems` | `MdmarkAliasProblem[]` | 使えなかった行・レコードのずれの一覧。ずれが無ければ空 |

`MdmarkAlias` は、次のキーを持つ。

<!-- table: data -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `alias_type` | `MdmarkAliasType` | 種類。`'term' \| 'doc' \| 'command' \| 'url' \| 'skill' \| 'tool' \| 'path' \| 'avoid'`。`env` は含めない |
| `id` | `string` | エイリアスの `id`。渡したエイリアスの中で一意 |
| `name` | `string` | 照合する語で、ツールチップに出す名前。`avoid` の種類ではやめた言い方 |
| `aliases` | `string[]` | 名前と同じく照合する語。無ければ空の並び |
| `description` | `string` | ツールチップの説明。`term`・`doc` では必須 |
| `command` | `string` | `command` の種類のコマンド |
| `cwd` | `string` | `command` の種類の実行場所 |
| `url` | `string` | `url` の種類の URL |
| `skill` | `string` | `skill` の種類のスキル名 |
| `tool` | `string` | `tool` の種類のツール名 |
| `path` | `string` | `path` の種類のパス |
| `avoid` | `string[]` | `term` の種類の、使わないことにした言い方 |
| `replacement` | `string` | `avoid` の種類の置き換え先の語 |
| `related` | `string[]` | `term` の関連する語。受け取るだけで、使わない |

<!-- /table -->

`MdmarkAliasProblem` は、次のキーを持つ。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `string` | ずれのあるファイル。行のずれは `configFile`、レコードのずれはそのレコードのファイルの `path` |
| `where` | `string` | 行のずれは設定のキーのパス（`aliases[1].id`）。レコードのずれはファイルの中のパス（`records` を記載した行は `terms[2].command`、記載しない行は `command`）。ファイル全体のずれは空文字 |
| `kind` | `'duplicate_alias_row_id' \| 'alias_records_missing' \| 'alias_field_missing' \| 'alias_unknown_type' \| 'alias_required_empty' \| 'duplicate_alias_id'` | ずれの種類。意味は [CLI](./CLI.md#設定と索引を点検する) |
| `message` | `string` | ずれの内容と直し方を書いた日本語の 1 文 |

ずれの並びは `aliases` と同じ順で、同じ行・レコードの中は `metadata` のキーの順。
型 `MdmarkAlias`・`MdmarkAliasType`・`MdmarkAliasSource`・`MdmarkAliasProblem` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

```json
{
  "aliases": [
    { "alias_type": "term", "id": "ws", "name": "ワークスペース", "aliases": [], "description": "話し合いの記録を置くフォルダ" }
  ],
  "problems": []
}
```

### エラー

例外は投げない。
使えない行・レコードは、除いてずれにし、ほかの行・レコードからエイリアスを作る。
`env` のレコードは種類と必須のキーを確かめてずれを返すが、`aliases` には入れない。
上限は無く、渡された全ての行とファイルを使う。

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
| `extension.directive` | 必須 | 拡張の印の名前（`<!-- {directive}: {引数} -->`）。英小文字で始まり、英小文字・数字・`-` だけを持つ。`features` と記法の印（`table`・`tabs`・`steps`・`section`・`row-detail`・`fig`・`toc`・`glossary`・`view`）と、登録済みの拡張の `directive` は使えない。設定の `libraries` や図の部品の印（`flow`・`sequence`・`chart`・`param`）に同じ名前があるときは、拡張を優先する |
| `extension.load` | 必須 | 拡張のモジュールを読む関数。文書に印があるときだけ、`mount` と `update` が描くごとに 1 回呼ぶ。同じ文書の同じ拡張の印では 1 回だけ呼ぶ |
| `extension.schema` | 任意 | 印の引数を検査する Standard Schema。zod・valibot など、`~standard` を持つ検査ライブラリの schema をそのまま渡せる。省くと検査しない |

拡張のモジュールは、`draw(slot, value)` を名前付きで export する。
`slot` は印の場所の要素、`value` は `{ args: string[]; keys: Record<string, string>; definition?: unknown }`。
`キー=値` でない引数を書いた順に `args`、`キー=値` の引数を `keys` に入れる。
印を範囲（`<!-- {directive} -->` 〜 `<!-- /{directive} -->`）で書き、範囲に言語 `json` のコードブロックを 1 つ置くと、その JSON を読んだ値を `definition` に入れる。範囲が無い印は `definition` を持たない。
`draw` は同期でも `Promise` を返す非同期でもよい。
`draw` の中で、配布物が出す [`mountView`](#ビューを描く) と [`mountComments`](#コメントを付ける) を `slot` に対して呼んで、印の場所に mdmark の部品を描ける。
`draw` が部品の `Promise` を待つと、`mount` はその後に印の場所を描き終えたものとして扱う。
`update`・`destroy` で印の場所を片付けるとき、その中の部品の `destroy` も行う。
手順は [部品をJavaScriptから使う](../使い方/カスタマイズ/部品をJavaScriptから使う.md)。

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

## ビューを描く

使う側のページと拡張のモジュールが、列名と項目の値を渡し、要素の中にボード表示と表形式のビューを描く。
文書のビューの印（[ビュー](./記法.md#ビュー)）で描くものと同じ見た目と操作になる。
手順は [部品をJavaScriptから使う](../使い方/カスタマイズ/部品をJavaScriptから使う.md)。

### リクエスト

```js
import { mountView } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = await mountView(document.querySelector("#tasks"), {
  columns: ["題", "状態", "担当"],
  items: [{ 題: "配色の変数を洗い出す", 状態: "未着手", 担当: "佐藤" }],
  group: "状態",
  filter: { 担当: "select" },
});
handle.destroy();
```

<!-- table: data -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素。中身を空にして、class `mdmark` の要素を 1 つ置き、その中に描く |
| `opts.columns` | 必須 | 列名の配列。表形式のビューの列の並びと、ボードの項目に出す値の並びになる。1 つ以上で、空の文字列と重なりを持たない |
| `opts.items` | 必須 | 項目の配列。列名をキーにした文字列の値を持つオブジェクトで、並びは表の行の順。列名に無いキーは使わず、列名のキーが無い値は空にする |
| `opts.group` | 任意 | ボード表示で列に分ける列名。`opts.columns` のどれか。省くと、ボード表示を持たず表形式のビューだけを描く。印の `group=` に当たる |
| `opts.default` | 任意 | 描いた直後に出すビュー（`"board"` か `"table"`）。省くと、`opts.group` があれば `"board"`、無ければ `"table"`。`opts.group` が無いときは `"table"` だけ。印の `default=` に当たる |
| `opts.filter` | 任意 | 表形式のビューで絞り込みを付ける列と種類（`select`・`text`・`date`）のオブジェクト。キーは `opts.columns` のどれか。省くと、どの列にも付けない。印の `filter=` に当たる |
| `opts.icons` | 任意 | ボードの列の見出しの値からアイコンの名前を引くオブジェクト。既定のアイコンに重ね、同じ値は上書きする。使えるアイコンは [ビュー](./記法.md#ビュー) のとおり。印の `icons=` に当たる |

<!-- /table -->

列名と項目の値は文字として出し、HTML として解釈しない。
同じ要素へもう一度 `mountView` を呼ぶと、前の `mountView` の `destroy` を先に行う。
ビューの部品のモジュール（`dist/view.js`）は、初めて呼んだときか文書にビューの印があるときに 1 回だけ、`dist/index.js` の隣から読む。
型 `mountView`・`MdmarkViewOptions`・`MdmarkViewHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `Promise<{ destroy: () => void }>` | 部品のモジュールを読み、ビューを描いてから解決する。`destroy` は `el` の中を空にし、ビューの操作と、絞り込みのドロワーを開いている間の `document` の受け取りを外す。2 回目以降は何もしない |

### エラー

| 起きたこと | 動き |
| --- | --- |
| `el` が要素でない、`opts.columns` が空か文字列の配列でないか重なりを持つ、`opts.items` が配列でないか要素がオブジェクトでない、`opts.group`・`opts.filter` の列名が `opts.columns` に無い、`opts.filter` の種類が `select`・`text`・`date` でない、`opts.default` が `board`・`table` でないか `opts.group` が無いのに `board`、`opts.icons` に使えないアイコンの名前がある | `TypeError` を同期で投げる（`Promise` は返さない）。`el` は書き換えず、メッセージに誤った引数の名前を含める |
| ビューの部品のモジュールを読めない | `el` の中に題 `この箇所を表示できません` の [知らせの枠](./用語集.md) を置き、`Promise` を元のエラーで reject する |

## コメントを付ける

使う側のページが、自分で書いた要素とコメントの読み書きの関数を渡し、要素の中の選んだ箇所にコメントを付けられるようにする。
`mount` で描いた文書のコメントと同じ見た目と操作になる。
手順は [部品をJavaScriptから使う](../使い方/カスタマイズ/部品をJavaScriptから使う.md)。

### リクエスト

```js
import { mountComments } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = await mountComments(document.querySelector("#panel"), {
  docId: "panel-setup",
  store: { load, save },
});
handle.destroy();
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | コメントを付けられる範囲の要素。中の文字を選ぶとコメントのボタンを出す |
| `opts.store` | 必須 | コメントの読み書きの関数（`MdmarkCommentStore`）。形は [文書を描く](#文書を描く) の `opts.commentStore` と同じ |
| `opts.docId` | 必須 | 読み書きの関数に渡す、コメントを付ける対象の ID。空でない文字列 |

`opts.store.load` を 1 回呼び、読んだコメントの箇所を印で包む。`el` の文字は変えない。
コメントのボタン・入力欄・吹き出しは `document.body` に置く。
同じ要素へもう一度 `mountComments` を呼ぶと、前の `mountComments` の `destroy` を先に行う。
コメントの部品のモジュール（`dist/comments.js`）は、初めて呼んだときか `mount` でコメントの機能がオンになったときに 1 回だけ、`dist/index.js` の隣から読む。
型 `mountComments`・`MdmarkCommentStore`・`MdmarkComment`・`MdmarkCommentDraft`・`MdmarkCommentsHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `Promise<{ destroy: () => void }>` | `load` の結果で印を付けてから解決する。`destroy` は印を外して `el` の文字を呼ぶ前の並びに戻し、コメントのボタン・入力欄・吹き出しと `document` の受け取りを外す。2 回目以降は何もしない。保存を待つ間に `destroy` を呼ぶと、保存の結果で印を付けない |

### エラー

| 起きたこと | 動き |
| --- | --- |
| `el` が要素でない、`opts.store` が `load`・`save` の関数を持たない、`opts.docId` が空か文字列でない | `TypeError` を同期で投げる（`Promise` は返さない）。`el` は書き換えず、メッセージに誤った引数の名前を含める |
| `load` が reject する、または返した値がコメントの形に合わない | 例外を投げず、印を付けずに解決する。新しいコメントは付けられる。`load`・`docId`・元のエラーか合わなかった値を `console.error` に出す |
| `save` が reject する、または返した値がコメントの形に合わない | 例外を投げず、入力欄に書いた本文を残して知らせを出し、印を付けない。`save`・`docId`・元のエラーを `console.error` に出す |
| コメントの部品のモジュールを読めない | `el` を書き換えず、`load` を呼ばずに、`Promise` を元のエラーで reject する |

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
| `--mdmark-font-size` | `0.875rem` | 本文の文字の大きさ |
| `--mdmark-line-height` | `1.8` | 本文の行間 |
| `--mdmark-content-width` | `none` | 行の長さの上限。既定は上限が無く、描く先の要素の幅を使う。行の長さを抑えたいときに `46rem` などの長さを渡す |
| `--mdmark-space` | `0.875rem` | ブロックの間隔の基準 |
| `--mdmark-padding` | `1.5rem` | 描く先の要素の内側の余白 |
| `--mdmark-radius` | `4px` | 角丸の大きさ（描く先の要素・コードブロック・引用・折り畳み・読み込み中の枠・知らせの枠・書き方の警告・注意書き）。表の外側の枠は 2 倍 |
| `--mdmark-heading-weight` | `700` | 見出しの太さ |
| `--mdmark-heading-rule-width` | `0px` | 見出し 1・見出し 2 の下の線の太さ。`0` のままだと線が出ない |
| `--mdmark-table-rule-inline` | `1px` | 表のセルの左右の線の太さ（`plain` の種類は `0`） |
| `--mdmark-sticky-top` | `0px` | 表の見出し行と、右側の目次・狭い幅の帯を留める位置の、画面の上端からのずれ。ページの上端に固定したヘッダーを持つ使う側は、その高さを渡す |
| `--mdmark-color-term-underline` | `var(--mdmark-color-muted)` | 用語の語と文書の別名の、破線の下線の色 |
| `--mdmark-color-avoided-underline` | `var(--mdmark-color-notice-border)` | やめた言い方の語の、波線の下線の色 |
| `--mdmark-tooltip-max-width` | `22rem` | ツールチップの幅の上限。画面の幅から `2rem` を引いた幅を超えない |
| `--mdmark-tooltip-max-height` | `18rem` | ツールチップの高さの上限。画面の高さの 60% を超えない。超える分はツールチップの中でスクロールする |
| `--mdmark-diagram-lane-tint` | `8%` | 図の層の背景に敷く、箱の色の濃さ |
| `--mdmark-diagram-max-height` | `36rem` | 文書の中の図の表示する枠の高さの上限。全体が収まる倍率はこの高さと枠の幅に収める |
| `--mdmark-diff-minimap-width` | `14px` | 差分のミニマップの帯の幅 |
| `--mdmark-diff-minimap-z-index` | `10` | 差分のミニマップの帯の重なり順。使う側のページの固定のヘッダーなどに隠れるときに上げる |
| `--mdmark-view-column-width` | `12rem` | ビューのボードの列の最小の幅。描く先の幅に収まらない列はボードの中で横にスクロールする |
| `--mdmark-h1-marker` | なし（記号を出さない） | 見出し 1 の前に置く記号。引用符で囲んだ文字列で書く |
| `--mdmark-h2-marker` | なし（記号を出さない） | 見出し 2 の前に置く記号。引用符で囲んだ文字列で書く |
| `--mdmark-h3-marker` | なし（記号を出さない） | 見出し 3 の前に置く記号。引用符で囲んだ文字列で書く |

<!-- /table -->

配色の変数。ダークの配色は、画面で OS の設定がダークのとき、または描く先かその祖先の class がダークを選ぶとき（[配色を切り替える class](#配色を切り替える-class)）に当たる。印刷では明るい配色に戻る。

<!-- table: data -->

| 変数 | 明るい配色 | ダークの配色 | 使う場所 |
| --- | --- | --- | --- |
| `--mdmark-color-bg` | `#ffffff` | `#131316` | 描く先の要素の地と、表の本文の行の地。「コメントを保存」のボタンの文字 |
| `--mdmark-color-text` | `#18181b` | `#ededef` | 本文の文字と、コメントの入力欄の「コメントを保存」のボタンの地と線 |
| `--mdmark-color-heading` | `#18181b` | `#ededef` | 見出しの文字 |
| `--mdmark-color-muted` | `#52525b` | `#b4b4bc` | 引用・読み込み中の枠の文字 |
| `--mdmark-color-link` | `#0f766e` | `#2dd4bf` | リンクとフォーカスの枠 |
| `--mdmark-color-border` | `#e4e4e7` | `#26262b` | 枠・罫線・読み込み中の枠の破線 |
| `--mdmark-color-surface` | `#f4f4f5` | `#1b1b1f` | コード・引用の面 |
| `--mdmark-color-scroll-shadow` | `rgb(24 24 27 / 0.14)` | `rgb(0 0 0 / 0.6)` | 表とコードブロックに横の続きがあることを示す影 |
| `--mdmark-color-notice-bg` | `#f9eee8` | `#2a251d` | 知らせの枠の地 |
| `--mdmark-color-notice-border` | `#b45309` | `#fbbf24` | 知らせの枠の線・書き方の警告の枠の破線 |
| `--mdmark-color-notice-text` | `#18181b` | `#ededef` | 知らせの枠の文字・書き方の警告の文字 |
| `--mdmark-color-table-head` | `#f4f4f5` | `#1b1b1f` | 表の見出し行の面 |
| `--mdmark-color-callout-note` | `#1d4ed8` | `#7aa2ff` | 補足の注意書きの題・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-tip` | `#15803d` | `#4ade80` | ヒントの注意書きの題・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-important` | `#6d28d9` | `#c4a7ff` | 重要の注意書きの題・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-warning` | `#b45309` | `#fbbf24` | 警告の注意書きの題・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-caution` | `#b91c1c` | `#f87171` | 注意の注意書きの題・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-current-bg` | `#e6f3f1` | `#10302c` | [まとめた HTML](./用語集.md) の文書の一覧の、開いている文書の行の背景。右側の目次の、今いる節の項目と、目次を出しているときの目次を出すボタンの背景 |
| `--mdmark-color-diagram-llm` | `#6d28d9` | `#c4a7ff` | 図の LLM の箱と LLM の層の色 |
| `--mdmark-color-diagram-dm` | `#1d4ed8` | `#7aa2ff` | 図の意思決定モデルの箱の色 |
| `--mdmark-color-diagram-script` | `#52525b` | `#b4b4bc` | 図のスクリプトの箱の色 |
| `--mdmark-color-diagram-mcp` | `#b45309` | `#fbbf24` | 図の MCP の箱と処理の層の色 |
| `--mdmark-color-diagram-data` | `#0f766e` | `#2dd4bf` | 図のデータの箱とデータの層の色 |
| `--mdmark-color-diagram-external` | `#15803d` | `#4ade80` | 図の外部のシステムの箱の色 |
| `--mdmark-color-diagram-line` | `#71717a` | `#8f8f99` | 図の処理の流れ・戻る線の色 |
| `--mdmark-color-series-1` | `#0f766e` | `#2dd4bf` | グラフの 1 つ目の系列の色（実線・丸の点） |
| `--mdmark-color-series-2` | `#b45309` | `#fbbf24` | グラフの 2 つ目の系列の色 |
| `--mdmark-color-series-3` | `#6d28d9` | `#c4a7ff` | グラフの 3 つ目の系列の色 |
| `--mdmark-color-series-4` | `#1d4ed8` | `#7aa2ff` | グラフの 4 つ目の系列の色 |
| `--mdmark-color-code-highlight-bg` | `#fef3c7` | `#5c4a12` | コードブロックの強調した行の背景 |
| `--mdmark-color-code-highlight-line` | `#b45309` | `#fbbf24` | コードブロックの強調した行の左端の線 |
| `--mdmark-color-file-text` | `#1d4ed8` | `#7aa2ff` | ファイルツリーの文書（`md`・`txt` など）のファイルのアイコンの色 |
| `--mdmark-color-file-code` | `#6d28d9` | `#c4a7ff` | ファイルツリーのコード（`ts`・`py` など）のファイルのアイコンの色 |
| `--mdmark-color-file-config` | `#c2410c` | `#fb923c` | ファイルツリーの設定（`json`・`yaml` など）のファイルのアイコンの色 |
| `--mdmark-color-file-image` | `#0f766e` | `#2dd4bf` | ファイルツリーの画像のファイルのアイコンの色 |
| `--mdmark-color-file-sheet` | `#15803d` | `#4ade80` | ファイルツリーの表（`csv` など）のファイルのアイコンの色 |
| `--mdmark-color-file-archive` | `#a16207` | `#facc15` | ファイルツリーのアーカイブ（`zip` など）のファイルのアイコンの色 |
| `--mdmark-color-file-script` | `#be185d` | `#f472b6` | ファイルツリーのスクリプト（`sh`・`Dockerfile` など）のファイルのアイコンの色 |
| `--mdmark-color-syntax-keyword` | `#6d28d9` | `#d6c2ff` | コードブロックの色分けのキーワード（予約語・デコレーター・`document` や `self` などの言語の変数）の色 |
| `--mdmark-color-syntax-string` | `#166534` | `#4ade80` | コードブロックの色分けの文字列（文字列・正規表現・エスケープ・Markdown のリンクの文字）の色 |
| `--mdmark-color-syntax-number` | `#92400e` | `#fbbf24` | コードブロックの色分けの数値（数値・`true`・`false`・`null`・YAML と Markdown の箇条書きの `-`）の色 |
| `--mdmark-color-syntax-type` | `#be185d` | `#fbb6db` | コードブロックの色分けの型（型・クラス名・組み込みの関数と型・HTML のタグ名・CSS のセレクター）の色 |
| `--mdmark-color-syntax-name` | `#1d4ed8` | `#a8c1ff` | コードブロックの色分けの名前（関数名・オブジェクトと YAML と JSON のキー・HTML の属性・CSS のプロパティ・Markdown の見出し）の色 |
| `--mdmark-color-syntax-comment` | `#52525b` | `#c8c8cf` | コードブロックの色分けのコメントの色。コメントは斜体でも示す |
| `--mdmark-color-diff-del-bg` | `#fbe6e3` | `#2a1e20` | 差分の削除した行の背景と、コードの行の印の消した行の背景 |
| `--mdmark-color-diff-del-word` | `#eeb4ad` | `#5d3435` | 差分の削除した行で変わった語の背景 |
| `--mdmark-color-diff-del-sign` | `#b91c1c` | `#f87171` | 削除した行の行頭の `-` と、ミニマップの削除した行の印の色。コードの行の印の消した行の行頭の `-` と左端の線にも使う |
| `--mdmark-color-diff-add-bg` | `#e1ede2` | `#1e2b24` | 差分の追加した行の背景と、コードの行の印の足した行の背景 |
| `--mdmark-color-diff-add-word` | `#a9ccaf` | `#2f5c3e` | 差分の追加した行で変わった語の背景 |
| `--mdmark-color-diff-add-sign` | `#15803d` | `#4ade80` | 追加した行の行頭の `+` と、ミニマップの追加した行の印の色。コードの行の印の足した行の行頭の `+` と左端の線にも使う |
| `--mdmark-color-comment-bg` | `#f2effe` | `#25222d` | コメントの印の地の色と、入力欄を開いている間の選んだ文字の色 |
| `--mdmark-color-comment-line` | `#6d28d9` | `#c4a7ff` | コメントの印の下線の色 |
| `--mdmark-color-error` | `#b91c1c` | `#f87171` | コメントの入力欄の知らせの文字とアイコン、誤りのある本文の欄の枠の色 |

<!-- /table -->

注意書きの面は種類の色を地の色に 7%、枠の線は 40% 混ぜた色で、混ぜる割合の変数は持たない。

#### 配色を切り替える class

描く先の要素かその祖先が次の class を持つとき、配色は上から順に決まる。
どれも無ければ、`prefers-color-scheme`（OS の設定）で決まる。

<!-- table: data -->

| 優先 | class | 配色 | 付けるもの |
| --- | --- | --- | --- |
| 1 | `mdmark-theme-dark` | ダーク | 使う側が、OS やホストの配色によらず固定するとき。VS Code 拡張機能は `mdmark.preview.theme` が `dark` のときに付ける |
| 1 | `mdmark-theme-light` | ライト | 同上。`mdmark.preview.theme` が `light` のとき |
| 2 | `vscode-high-contrast-light`・`vscode-light` | ライト | VS Code が Webview の `body` に付ける |
| 2 | `vscode-dark`・`vscode-high-contrast`（`vscode-high-contrast-light` を一緒に持たないとき） | ダーク | 同上 |

<!-- /table -->

同じ優先の class が両方あるときは、描く先に近い祖先の class に従う。
ダークの値は `prefers-color-scheme: dark` のときと同じ変数の値で、差分のミニマップの色も同じ規則で決まる。
印刷では、class によらず明るい配色にする。
使う側が層の外で上書きした変数は、どの配色でも層の中の値に勝つ。

#### 選べるテーマ

配色の変数の値の組を、mdmark に入れたテーマから選べる。
テーマは設定の `colorTheme`（[選ぶテーマ](./設定.md#選ぶテーマ)）で選ぶ。
`mount` は選んだテーマの名前を、描く先の要素の属性 `data-mdmark-color-theme` に付ける。
使う側がこの属性を付ける必要はない。

<!-- table: data -->

| テーマ | 内容 |
| --- | --- |
| `dev-swiss` | 既定。上の表の値で、属性が付いても値の組を追加しない |
| `theme-paper` | 紙。生成りの地に墨色の文字と臙脂のリンク。ダークの配色は焦げ茶の地に生成りの文字 |
| `theme-slate` | 青灰。青みの灰の地と面に青のリンク。ダークの配色は紺の地に青みの白の文字 |
| `theme-contrast` | 高コントラスト。白と黒の地に濃い文字・濃い罫線・濃い青のリンク |

<!-- /table -->

テーマが替えるのは `--mdmark-color-*` の変数と `color-scheme` だけで、書体・余白・角丸と配置の変数は全テーマで共通。
明るい配色とダークの配色は、[配色を切り替える class](#配色を切り替える-class) と `prefers-color-scheme` が、選んだテーマの中で選ぶ。
印刷では、選んだテーマの明るい配色にする。
値は `:root` に当たるため、`document.body` の直下の部品にも同じ配色が届く。
使う側が層の外で上書きした変数は、選んだテーマの値に勝つ。
同じページに別のテーマの文書が並ぶと、`theme-paper`・`theme-slate`・`theme-contrast` の並びで後のテーマが全ての文書に当たる。

テーマごとの変数の値は次のとおり。変数の使う場所は上の表と同じ。

<!-- tabs -->

##### theme-paper

<!-- table: data -->

| 変数 | 明るい配色 | ダークの配色 |
| --- | --- | --- |
| `--mdmark-color-bg` | `#fbf8f1` | `#1c1915` |
| `--mdmark-color-text` | `#2a2520` | `#e8e0d2` |
| `--mdmark-color-heading` | `#1f1a15` | `#f1eadc` |
| `--mdmark-color-muted` | `#5c5247` | `#b8ad9c` |
| `--mdmark-color-link` | `#9b2c2c` | `#f0a39a` |
| `--mdmark-color-current-bg` | `#f6e6e2` | `#3a2523` |
| `--mdmark-color-border` | `#e3dacb` | `#36302a` |
| `--mdmark-color-surface` | `#f2ece1` | `#25211c` |
| `--mdmark-color-table-head` | `#f2ece1` | `#25211c` |
| `--mdmark-color-scroll-shadow` | `rgb(42 37 32 / 0.14)` | `rgb(0 0 0 / 0.6)` |
| `--mdmark-color-term-underline` | `#5c5247` | `#b8ad9c` |
| `--mdmark-color-notice-bg` | `#f8eadf` | `#2d261c` |
| `--mdmark-color-notice-border` | `#94540a` | `#e8b04a` |
| `--mdmark-color-notice-text` | `#2a2520` | `#e8e0d2` |
| `--mdmark-color-callout-note` | `#1e4f8c` | `#8fb4e8` |
| `--mdmark-color-callout-tip` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-callout-important` | `#6b3fa0` | `#c9a8ec` |
| `--mdmark-color-callout-warning` | `#94540a` | `#e8b04a` |
| `--mdmark-color-callout-caution` | `#a3261f` | `#f0928a` |
| `--mdmark-color-diagram-llm` | `#6b3fa0` | `#c9a8ec` |
| `--mdmark-color-diagram-dm` | `#1e4f8c` | `#8fb4e8` |
| `--mdmark-color-diagram-script` | `#5c5247` | `#b8ad9c` |
| `--mdmark-color-diagram-mcp` | `#94540a` | `#e8b04a` |
| `--mdmark-color-diagram-data` | `#9b2c2c` | `#f0a39a` |
| `--mdmark-color-diagram-external` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-diagram-line` | `#857a6c` | `#9a8f80` |
| `--mdmark-color-series-1` | `#9b2c2c` | `#f0a39a` |
| `--mdmark-color-series-2` | `#1e4f8c` | `#8fb4e8` |
| `--mdmark-color-series-3` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-series-4` | `#94540a` | `#e8b04a` |
| `--mdmark-color-code-highlight-bg` | `#f7ecc8` | `#4d3d16` |
| `--mdmark-color-code-highlight-line` | `#94540a` | `#e8b04a` |
| `--mdmark-color-diff-del-bg` | `#f6e1dc` | `#33211e` |
| `--mdmark-color-diff-del-word` | `#e6b3aa` | `#643a33` |
| `--mdmark-color-diff-del-sign` | `#a3261f` | `#f0928a` |
| `--mdmark-color-diff-add-bg` | `#e3ead8` | `#222b1d` |
| `--mdmark-color-diff-add-word` | `#b6cba0` | `#3e5530` |
| `--mdmark-color-diff-add-sign` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-syntax-keyword` | `#8b2252` | `#f0a3c0` |
| `--mdmark-color-syntax-string` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-syntax-number` | `#8a4b08` | `#e8b04a` |
| `--mdmark-color-syntax-type` | `#1e4f8c` | `#8fb4e8` |
| `--mdmark-color-syntax-name` | `#24557a` | `#a9c6e6` |
| `--mdmark-color-syntax-comment` | `#5c5247` | `#c2b8a8` |
| `--mdmark-color-comment-bg` | `#efe8f5` | `#2a2430` |
| `--mdmark-color-comment-line` | `#6b3fa0` | `#c9a8ec` |
| `--mdmark-color-error` | `#a3261f` | `#f0928a` |

<!-- /table -->

##### theme-slate

<!-- table: data -->

| 変数 | 明るい配色 | ダークの配色 |
| --- | --- | --- |
| `--mdmark-color-bg` | `#f8fafc` | `#0f172a` |
| `--mdmark-color-text` | `#0f172a` | `#e2e8f0` |
| `--mdmark-color-heading` | `#0f172a` | `#f1f5f9` |
| `--mdmark-color-muted` | `#475569` | `#a3b1c6` |
| `--mdmark-color-link` | `#1d4ed8` | `#7dd3fc` |
| `--mdmark-color-current-bg` | `#e0e9fb` | `#12304a` |
| `--mdmark-color-border` | `#dbe2ec` | `#26334a` |
| `--mdmark-color-surface` | `#edf1f7` | `#172136` |
| `--mdmark-color-table-head` | `#edf1f7` | `#172136` |
| `--mdmark-color-scroll-shadow` | `rgb(15 23 42 / 0.14)` | `rgb(0 0 0 / 0.6)` |
| `--mdmark-color-term-underline` | `#475569` | `#a3b1c6` |
| `--mdmark-color-notice-bg` | `#fbefe4` | `#2a2418` |
| `--mdmark-color-notice-border` | `#a24a06` | `#fbbf24` |
| `--mdmark-color-notice-text` | `#0f172a` | `#e2e8f0` |
| `--mdmark-color-callout-note` | `#1d4ed8` | `#93b4ff` |
| `--mdmark-color-callout-tip` | `#047857` | `#5eead4` |
| `--mdmark-color-callout-important` | `#6d28d9` | `#c4b5fd` |
| `--mdmark-color-callout-warning` | `#a24a06` | `#fbbf24` |
| `--mdmark-color-callout-caution` | `#b91c1c` | `#fca5a5` |
| `--mdmark-color-diagram-llm` | `#6d28d9` | `#c4b5fd` |
| `--mdmark-color-diagram-dm` | `#1d4ed8` | `#f9a8d4` |
| `--mdmark-color-diagram-script` | `#475569` | `#a3b1c6` |
| `--mdmark-color-diagram-mcp` | `#a24a06` | `#fbbf24` |
| `--mdmark-color-diagram-data` | `#0e7490` | `#7dd3fc` |
| `--mdmark-color-diagram-external` | `#047857` | `#5eead4` |
| `--mdmark-color-diagram-line` | `#64748b` | `#8391a7` |
| `--mdmark-color-series-1` | `#1d4ed8` | `#7dd3fc` |
| `--mdmark-color-series-2` | `#047857` | `#6ee7b7` |
| `--mdmark-color-series-3` | `#6d28d9` | `#c4b5fd` |
| `--mdmark-color-series-4` | `#a24a06` | `#fdba74` |
| `--mdmark-color-code-highlight-bg` | `#fdf2c4` | `#4d3f12` |
| `--mdmark-color-code-highlight-line` | `#a24a06` | `#fbbf24` |
| `--mdmark-color-diff-del-bg` | `#fbe4e4` | `#2e1c24` |
| `--mdmark-color-diff-del-word` | `#efb1b1` | `#6a2f3a` |
| `--mdmark-color-diff-del-sign` | `#b91c1c` | `#fca5a5` |
| `--mdmark-color-diff-add-bg` | `#ddeee6` | `#13302c` |
| `--mdmark-color-diff-add-word` | `#a3d0bc` | `#245c4f` |
| `--mdmark-color-diff-add-sign` | `#047857` | `#5eead4` |
| `--mdmark-color-syntax-keyword` | `#6d28d9` | `#d4c8ff` |
| `--mdmark-color-syntax-string` | `#047857` | `#5eead4` |
| `--mdmark-color-syntax-number` | `#a24a06` | `#fbbf24` |
| `--mdmark-color-syntax-type` | `#be185d` | `#f9a8d4` |
| `--mdmark-color-syntax-name` | `#1e40af` | `#a5c3ff` |
| `--mdmark-color-syntax-comment` | `#475569` | `#b3bfd0` |
| `--mdmark-color-comment-bg` | `#efebfd` | `#221f3a` |
| `--mdmark-color-comment-line` | `#6d28d9` | `#c4b5fd` |
| `--mdmark-color-error` | `#b91c1c` | `#fca5a5` |

<!-- /table -->

##### theme-contrast

<!-- table: data -->

| 変数 | 明るい配色 | ダークの配色 |
| --- | --- | --- |
| `--mdmark-color-bg` | `#ffffff` | `#000000` |
| `--mdmark-color-text` | `#000000` | `#ffffff` |
| `--mdmark-color-heading` | `#000000` | `#ffffff` |
| `--mdmark-color-muted` | `#333333` | `#d6d6d6` |
| `--mdmark-color-link` | `#0037a8` | `#9cc0ff` |
| `--mdmark-color-current-bg` | `#dde7fb` | `#0f2a55` |
| `--mdmark-color-border` | `#767676` | `#8a8a8a` |
| `--mdmark-color-surface` | `#f0f0f0` | `#161616` |
| `--mdmark-color-table-head` | `#e6e6e6` | `#222222` |
| `--mdmark-color-scroll-shadow` | `rgb(0 0 0 / 0.25)` | `rgb(0 0 0 / 0.8)` |
| `--mdmark-color-term-underline` | `#333333` | `#d6d6d6` |
| `--mdmark-color-notice-bg` | `#fff4d6` | `#2b2200` |
| `--mdmark-color-notice-border` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-notice-text` | `#000000` | `#ffffff` |
| `--mdmark-color-callout-note` | `#0037a8` | `#9cc0ff` |
| `--mdmark-color-callout-tip` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-callout-important` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-callout-warning` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-callout-caution` | `#a3001c` | `#ff9090` |
| `--mdmark-color-diagram-llm` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-diagram-dm` | `#0037a8` | `#9cc0ff` |
| `--mdmark-color-diagram-script` | `#333333` | `#d6d6d6` |
| `--mdmark-color-diagram-mcp` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-diagram-data` | `#006a6a` | `#4fd1c5` |
| `--mdmark-color-diagram-external` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-diagram-line` | `#4d4d4d` | `#a6a6a6` |
| `--mdmark-color-series-1` | `#0037a8` | `#9cc0ff` |
| `--mdmark-color-series-2` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-series-3` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-series-4` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-code-highlight-bg` | `#fff1b8` | `#4a3d00` |
| `--mdmark-color-code-highlight-line` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-diff-del-bg` | `#ffe0e0` | `#3a0d0d` |
| `--mdmark-color-diff-del-word` | `#f2a3a3` | `#7a2323` |
| `--mdmark-color-diff-del-sign` | `#a3001c` | `#ff9090` |
| `--mdmark-color-diff-add-bg` | `#dcf0dc` | `#0d2e0d` |
| `--mdmark-color-diff-add-word` | `#9fd39f` | `#1f5f1f` |
| `--mdmark-color-diff-add-sign` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-syntax-keyword` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-syntax-string` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-syntax-number` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-syntax-type` | `#9d174d` | `#ff9cd0` |
| `--mdmark-color-syntax-name` | `#0037a8` | `#a8c8ff` |
| `--mdmark-color-syntax-comment` | `#333333` | `#d6d6d6` |
| `--mdmark-color-comment-bg` | `#efe6ff` | `#241a33` |
| `--mdmark-color-comment-line` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-error` | `#a3001c` | `#ff9090` |

<!-- /table -->

<!-- /tabs -->

### エラー

なし。書かなかった変数は既定の値になる。
