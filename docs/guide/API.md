# API

公開関数と CSS 変数の一覧

どれも [配布物を読み込む](./導入-配布物を読み込む.md) で読み込んだページから使用する。

## 一覧

<!-- table: {"kind": "data"} -->

| 名前 | 呼び出し | 説明 |
| --- | --- | --- |
| [バージョンを返却する](#バージョンを返却する) | `version()` | 読み込んだ配布物のバージョンを返却する |
| [バージョンを CSS 変数で読み込む](#バージョンを-css-変数で読み込む) | `--mdmark-version` | 読み込んだ CSS のバージョンを持つ |
| [文書を描く](#文書を描く) | `mount(el, opts)` | 要素の中に Markdown を HTML として描く |
| [差分の出し方を読み込む](#差分の出し方を読み込む) | `diffModes` | `mount` の `opts.diffMode` に指定できる差分の出し方の一覧を持つ |
| [文書を HTML 文字列にする](#文書を-html-文字列にする) | `render(markdown, opts)` | 画面を持たずに Markdown を HTML 文字列にする |
| [参照の表を作る](#参照の表を作る) | `collectReferences(input)` | 索引と全ての文書の本文から、文書ごとの被参照と、用語集の表の用語をまとめた参照の表を返却する |
| [本文の参照を取り出す](#本文の参照を取り出す) | `collectMatches(input)` | 索引と文書の本文から、本文に出た用語・文書の別名の一致を、参照先と本文の位置つきで返却する |
| [索引を点検する](#索引を点検する) | `checkIndex(input)` | 索引と文書のずれの一覧を返却する |
| [エイリアスを作る](#エイリアスを作る) | `buildAliases(input)` | 設定の `aliases` の行と読み込んだ YAML から、エイリアスと使用できない行・レコードのずれを返却する |
| [拡張を登録する](#拡張を登録する) | `registerExtension(extension)` | 利用側が自分のマーカーと、そのマーカーを描くモジュールの読み込み方を登録する |
| [ビューを描く](#ビューを描く) | `mountView(el, opts)` | 列名と項目の値から、要素の中にボード表示と表形式のビューを描く |
| [コメントを付ける](#コメントを付ける) | `mountComments(el, opts)` | 利用側の要素の中の選んだ箇所に、コメントを付けられるようにする |
| [テーマの CSS 変数](#テーマの-css-変数) | `--mdmark-*` | 外観の値を持つ変数。利用側が上書きする |

<!-- /table -->

## バージョンを返却する

読み込んだ配布物のバージョンを返却する。

### リクエスト

引数はなし。

```js
import { version } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

version();
```

### レスポンス

| 型 | 説明 | 例 |
| --- | --- | --- |
| `string` | 配布物のビルドに埋めたバージョン。`v{MAJOR}.{MINOR}.{PATCH}` の構造 | `"v0.0.1"` |

### エラー

なし。常に埋めたバージョンを返却する。

## バージョンを CSS 変数で読み込む

読み込んだ CSS のバージョンを、ルート要素の CSS 変数 `--mdmark-version` で持つ。
`version()` と同じバージョンになる。

### リクエスト

```js
getComputedStyle(document.documentElement).getPropertyValue("--mdmark-version");
```

### レスポンス

| 型 | 説明 | 例 |
| --- | --- | --- |
| 文字列 | バージョンを引用符で囲んだ文字列。`version()` の戻り値と同じバージョン | `"v0.0.1"`（引用符を含む） |

### エラー

なし。CSS を読み込んでいないページでは、変数が定義されず空になる。

## 文書を描く

要素の中に Markdown を HTML として描く。
描いた本文は `render` が返却する HTML 文字列と同じ。
表の並べ替え・タブの切り替えなど、記法の操作を付ける（記載方法は [記法](./記法.md)）。
文書に記載したスクリプト（`script` 要素・`on` で始まる属性・`javascript:` の URL）は落とし、実行しない。
索引を指定すると、本文に出た用語と文書の別名に破線の下線を付け、ポインターを乗せたときとフォーカスしたときに意味と関連文書のツールチップを出し、文書の末尾に被参照の一覧を配置する。
索引の用語の `avoid` と用語集の表の `avoid.column` の列に並べたやめた言い方が本文に出ると、波線のマーカーを引き、代わりの用語の単語と意味のツールチップを出す（`glossary` がオンのときだけ）。
`opts.aliases` に指定したエイリアス（[`buildAliases`](#エイリアスを作る) が作る）の名前と別名にも同じ下線を付け、種類ごとのツールチップを出す（`glossary` がオンのときだけ）。
コマンドのエイリアスのツールチップには、コマンドをコピーするボタンを付ける。
ツールチップの操作は `mount` が付け、`update` でもう一度付け、`destroy` で削除する。
記載方法は [索引と用語集を記載する](./記載する-索引と用語集を記載する.md)。
図の部品の定義（[図の部品](./記法.md#図の部品)）があると、図の拡大・縮小・移動・全画面とツールチップ、操作できる部品の値の変更と写す操作も付ける。
`opts.diffSource` を指定すると、文書のタイトルの後ろに「変更表示」のボタンを付け、押すと 2 つのリビジョンの差分を出す。
`opts.diffMode` で差分の出し方を選べる。`open` はボタンを押した状態で描き、`blocks` はボタンを付けず、描いた文書のブロックを追加と削除の色で塗り分ける。
差分の操作は `mount` が付け、`update` で閉じ、`destroy` で削除する。
`opts.baseMarkdown` に比較元の Markdown を指定すると、取り出し元なしで、本文の中の比較元から変えたブロックを `blocks` と同じ色で塗り分ける。
仕組みは [差分を表示する仕組み](./コアコンセプト-差分を表示する仕組み.md)、記載方法は [差分を表示する](./導入-差分を表示する.md)。
ビューのマーカー（[ビュー](./記法.md#ビュー)）があると、ボード表示と表形式の切り替えと、表形式の列の絞り込みも付ける。
`opts.commentStore` と `opts.docId` を指定して機能 `comments` をオンにすると、本文の選んだ箇所にコメントを付けられる。
コメントのボタン・入力欄・マーカー・吹き出しの操作は `mount` が付け、`update` でもう一度付け、`destroy` で削除する。
読み込みと保存の関数が `update`・`remove` を持つと、吹き出しのコメントごとに「編集」「削除」のボタンを出す。
記載方法は [ビューとコメントを使用する](./記載する-ビューとコメントを使用する.md)。
ビューとコメントの部品のモジュール（`dist/view.js`・`dist/comments.js`）は、ビューのマーカーのある文書とコメントの機能がオンのときにだけ、`dist/index.js` の隣から読み込む。

### リクエスト

```js
import { mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = mount(document.querySelector("#doc"), { markdown: "# 見出し\n\n本文" });
handle.update("# 次の見出し");
handle.destroy();
```

<!-- table: {"kind": "data"} -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素。class `mdmark` が付く |
| `opts.markdown` | 必須 | 描く Markdown |
| `opts.config` | 任意 | 利用側のサーバーが `mdmark.config.yaml` を読み込んだオブジェクト。省いたキーには既定を適用する。キーは [設定](./設定.md) |
| `opts.index` | 任意 | 利用側のサーバーが、設定の `index` のパスの索引の YAML を読み込んだオブジェクト。構造は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて使用する。省くと、描く文書の用語集の表だけで用語を照合し、被参照を出さない |
| `opts.docId` | 任意 | 描く文書の索引の `id`。被参照の一覧を引き、関連文書から自分を除き、リンクの相対パスを求めるのに使用する。省くと、被参照の一覧を出さず、関連文書のリンクは索引の `path` のままにする。索引に無い `id` は、省いたときと同じに扱う。`opts.commentStore` を指定するときは必須で、コメントの読み込みと保存の関数に指定する対象の ID にもなる |
| `opts.references` | 任意 | [`collectReferences`](#参照の表を作る) が返却した参照の表。被参照の一覧と、ほかの文書の用語集の表の用語とそのやめた言い方に使用する。用語の `avoid` は任意で、無い用語はやめた言い方を持たないものとして扱う。省くと、被参照は索引の `related` だけから出し、ほかの文書の用語集の表の用語を照合しない |
| `opts.aliases` | 任意 | [`buildAliases`](#エイリアスを作る) が作ったエイリアスの並び（`MdmarkAlias[]`）。使用できないエイリアス（必須のキーが空・知らない種類・重なった `id`）は除いて使用し、`env` の種類は直接渡されても照合しない。`update` は描いたときのエイリアスを使用する。省くと、エイリアスを照合しない |
| `opts.includes` | 任意 | 取り込む文書の表（`Record<string, string>`）。キーは描く文書のフォルダからのパス（区切りは `/`。`./`・`../` を解いた構造）、値はそのファイルの本文。[取り込み](./記法.md#取り込み) のマーカーはこの表から参照する。mdmark はファイルを読み込まない。省くと、取り込みのマーカーの場所に記載の警告を出す |
| `opts.icons` | 任意 | 配布物に入っていない名前の Lucide のアイコンの形状の表（`Record<string, IconNode>`）。表にある名前は jsDelivr から読み込まずにこの構造で描く。省くと、使用する名前だけを jsDelivr から読み込む |
| `opts.diffSource` | 任意 | 文書のリビジョンの一覧と、リビジョンごとの本文を返却する取り出し元（`DiffSource`）。指定すると、描いた文書に差分を開く UI が付く。`opts.docId` と一緒に指定する。省くと、差分の UI を付けない |
| `opts.diffMode` | 任意 | 差分の出し方。`button`・`open`・`blocks` のどれか。省くと `button`。`opts.diffSource` を指定しないときは使用しない。知らない値は `button` として扱う |
| `opts.commentStore` | 任意 | コメントを読み込み、保存する関数（`MdmarkCommentStore`）。機能 `comments` がオンのときだけ使用する。`opts.docId` と一緒に指定する。省くと、コメントを付けられない |
| `opts.baseMarkdown` | 任意 | 比較元の Markdown（文字列か `null`）。指定すると、本文の中で比較元から追加・変更したブロックと削除したブロックを、`opts.diffMode` が `blocks` のときと同じ色で塗り分ける。`opts.diffSource` は要らない。`opts.diffSource` も指定したときは、色分けに比較元を使用し、取り出し元は「変更表示」の差分にだけ使用する（`blocks` では取り出し元を呼ばない）。`null` と省いたときは色分けしない。`update` の第 2 引数で差し替える |
| `opts.onColumnsChange` | 任意 | `columns` の機能を持つ表で列の表示を切り替えるたびに呼ぶ関数。`{ tableIndex, hidden }`（`MdmarkColumnsChange`）を受け取る。`tableIndex` は本文の中の `columns` の機能を持つ表の出現順（0 から。削除したブロックの中の表は数えない）、`hidden` は隠している列の見出しの文字を列の順に並べた配列。描いたときの `hidden` の状態と、`update` で再描画したときは呼ばない |

<!-- /table -->

`opts.diffMode` の値。

| 値 | 出し方 |
| --- | --- |
| `button` | 読者が「変更表示」を押してから、2 つのリビジョンの差分の行を出す |
| `open` | 描いた時点で「変更表示」を押した状態にして、差分の行を出す。もう一度押すと閉じ、`update` の後も開いた状態で再描画して取り出し元をもう一度呼ぶ |
| `blocks` | 「変更表示」と差分の場所・ミニマップを配置せず、描いた文書のブロックを追加・変更は追加の色、削除は削除の色で塗り分ける。本文を描いた後に `revisions` を 1 回呼び、2 つ以上あれば 2 番目を前、1 番目を後として `content` を 1 回ずつ呼ぶ。待つ間・リビジョンが 1 つのとき・2 つの本文が同じときは、`opts.markdown` を色を当てずに描いたままにする。`update` のたびに取り出し元をもう一度呼ぶ |

`opts.diffSource` の構造。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `revisions(docId)` | `(docId: string) => Promise<DiffRevision[]>` | 文書のリビジョンを新しい順に返却する。mdmark は並べ替えない。差分を開くたびに 1 回呼ぶ |
| `content({ docId, revisionId })` | `(target: { docId: string; revisionId: string }) => Promise<string>` | そのリビジョンの Markdown を返却する。選んだ 2 つのリビジョンに 1 回ずつ呼ぶ |

`DiffRevision` の構造。

| 項目 | 型 | 必須 / 任意 | 説明 |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | リビジョンの識別子。空にできず、一覧の中で重ならない |
| `at` | `string` | 必須 | ISO 8601 の日時 |
| `label` | `string` | 任意 | 一言の説明。リビジョンを選ぶ欄に出る |
| `author` | `string` | 任意 | 記載した人。リビジョンを選ぶ欄に出る |

型 `DiffSource` と `DiffRevision` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
`revisions` が配列でない・`id` か `at` が無いか構造が合わない・`id` が重なる・`content` が文字列でないときは、reject と同じに扱う。

`opts.commentStore` の構造。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `load({ docId })` | `(target: { docId: string }) => Promise<MdmarkComment[]>` | その文書に付いたコメントを返却する。描くたび（`mount`・`update`）に 1 回呼ぶ |
| `save({ docId, comment })` | `(target: { docId: string; comment: MdmarkCommentDraft }) => Promise<MdmarkComment>` | 下書きのコメントを保存し、`id` を加えたコメントを返却する。読者が「コメントを保存」を押すたびに呼ぶ |
| `update({ docId, id, body })` | `(target: { docId: string; id: string; body: string }) => Promise<void>` | 任意。コメントの本文を書き換える。持つと吹き出しに「編集」を出し、読者が入力欄の「保存」を押すたびに呼ぶ |
| `remove({ docId, id })` | `(target: { docId: string; id: string }) => Promise<void>` | 任意。コメントを削除する。持つと吹き出しに「削除」を出し、読者が削除の確認の「削除」を押すたびに呼ぶ |

`MdmarkCommentDraft` の構造。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `quote` | `string` | 選んだ文字 |
| `prefix` | `string` | 選んだ文字の前の最大 32 文字 |
| `suffix` | `string` | 選んだ文字の後の最大 32 文字 |
| `body` | `string` | コメントの本文 |

`MdmarkComment` は、`MdmarkCommentDraft` に空でない文字列の `id` を加えたもの。
型 `MdmarkCommentStore`・`MdmarkComment`・`MdmarkCommentDraft`・`MdmarkColumnsChange` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
`load` が配列でない・要素の構造が合わないとき、`save` が構造の合わない値を返却するときは、reject と同じに扱う。
mdmark はコメントを保存せず、保存先は利用側の関数に任せる。

同じ要素へもう一度 `mount` を呼ぶと、前の描画を片付けてから描く。
前の戻り値の `update` は何もしなくなる。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `update` | `(markdown: string, options?: { baseMarkdown?: string \| null; includes?: Record<string, string> }) => void` | 本文だけを再描画し、記法の操作をもう一度付ける。読者が開閉したセクションは、見出しと開閉のマーカーが変わっていなければその開閉のまま描き、URL の `#ID` のセクションを開き直さない。設定は `mount` に指定したものを使用する。`options.baseMarkdown` を指定すると比較元を差し替え、`null` で比較元を解除する。省くと前の比較元のまま描く。`options.includes` を指定すると取り込む文書の表を差し替え、省くと前の表のまま描く。`destroy` の後は何もしない |
| `reloadComments` | `() => Promise<void>` | 本文を再描画せずに `opts.commentStore.load` をもう一度呼び、コメントのマーカーと「箇所が見つからないコメント」の一覧をもう一度付けてから解決する。記法の操作の状態（並べ替え・絞り込み・開閉）は変えない。開いている吹き出しは閉じ、記載している入力欄は残す。コメントを付けていないとき（`comments` がオフ・`opts.commentStore` が無い・コメントの部品のモジュールを読み込めない）と `destroy` の後は、`load` を呼ばずに解決する |
| `focusComment` | `(id: string) => void` | その `id` のコメントのマーカーを、閉じたセクション・行の詳細の中なら開いてから画面に入れ、フォーカスを移して強調する（背景を濃くし、線で囲む）。強調は次の `focusComment` と、マーカーをもう一度付ける（再描画し・再読み込み）まで残す。吹き出しは開かない。マーカーが無い `id` と `destroy` の後は何もしない |
| `destroy` | `() => void` | `el` の中を空にして class `mdmark` を削除し、記法の操作と、印刷・`hashchange`・`document` の受け取りを解除する。コメントのボタン・入力欄・吹き出しも削除する。2 回目以降は何もしない |

### エラー

`opts.diffSource` を指定して `opts.docId` を指定しないとき、`opts.commentStore` を指定して `opts.docId` を指定しないか `opts.commentStore` が `load`・`save` の関数を持たないか `update`・`remove` を関数でない値で持つとき、`opts.baseMarkdown` が文字列でも `null` でもないとき、`opts.onColumnsChange` が関数でないときだけ、何も描かずに `TypeError` を投げる。
メッセージに `docId`・`commentStore`・`baseMarkdown`・`onColumnsChange` のどれかを含める。
`update` の `options.baseMarkdown` が文字列でも `null` でもないときは、前の本文を残して `TypeError` を投げる。
それ以外は例外を投げない。
取り出し元の `revisions`・`content` が reject するか、構造に合わない値を返却したときは、差分の場所を [通知ブロック](./用語集.md) に替え、文書の本文は描いたまま残す。
取り出し元の関数の名前・文書の `id`・リビジョンの `id`・元のエラーが `console.error` に出る。
`opts.diffMode` が `blocks` のときに取り出し元が同じように失敗したときは、`opts.markdown` を色を当てずに描いた本文を残し、本文の先頭に `変更を表示できません` の [通知ブロック](./用語集.md) を配置する。
`console.error` に出す内容は同じ。
コメントの `save` が reject するか、構造に合わない値を返却したときは、入力欄に記載した本文を残して `role="alert"` の通知を出し、マーカーを付けない。
`load` が reject するか、構造に合わない値を返却したときは、マーカーを付けずに続け、新しいコメントは付けられる。
どちらも読み込みと保存の関数の名前・文書の `id`・元のエラーが `console.error` に出る。
コメントの `update`・`remove` が reject したときは、修正は入力欄と書き換えた本文を残し、削除はコメントとマーカーを残して削除の確認を開いたまま、`role="alert"` の通知を出す。関数の名前・文書の `id`・コメントの `id`・元のエラーが `console.error` に出る。
`reloadComments` の `load` が reject するか、構造に合わない値を返却したときは、今のマーカーを残し、`reloadComments` の `Promise` を元のエラーで reject する。
`opts.onColumnsChange` が例外を投げたときは、列の表示の切り替えは済ませ、`onColumnsChange` と元のエラーが `console.error` に出る。
`comments` がオンで `opts.commentStore` を指定しないときは、コメントのボタンを出さず、読み込みと保存の関数が要ることを `mount` ごとに 1 回だけ `console.error` に出す。
ビューかコメントの部品のモジュールを読み込めないときは、ビューのマーカーの場所を `render` が出した表のまま残し、コメントはボタンを出さず `load` も呼ばない。
読み込めなかった部品の名前（`view` か `comments`）・モジュールの URL・元のエラーが `console.error` に出る。
外部ライブラリを読み込めないマーカーの場所は、その場所だけを [通知ブロック](./用語集.md) に替え、ほかは描く。
読み込めなかったマーカーの名前・URL・元のエラーが `console.error` に出る。
記法のマーカーに読み込めない指定がある箇所は、読み込めた指定で描き、その箇所の前に [記載の警告](./記法.md#記載の警告) を配置する。
索引が Schema に合わないときも、用語集の表の列名が表に無いときも、本文の描画を止めない。
合わない文書・用語の項目は除いて使用し、用語集の表の誤りは、その箇所の記載の警告で通知する。
1 つのページに文書を 2 つ以上描いても、ツールチップと被参照の一覧の `id` はページの中で重ならない。

## 差分の出し方を読み込む

`mount` の `opts.diffMode` に指定できる差分の出し方の一覧を持つ。
読み込んだ配布物が目的の出し方に対応するかを、`mount` を呼ぶ前に確認するときに使用する。

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
| `readonly ["button", "open", "blocks"]` | `opts.diffMode` に指定できる値 | `["button", "open", "blocks"]` |

`opts.diffMode` を知らない古いバージョンの配布物は、`diffModes` を持たない。
そのバージョンの `mount` は `opts.diffMode` を黙って無視するため、`diffModes` が無いか目的の出し方を含まないときは、その出し方に対応しないバージョンと見なす。

### エラー

なし。

## 文書を HTML 文字列にする

画面を持たずに Markdown を HTML 文字列にする。
DOM を使用しないため、`dist/index.js` を `import()` で読み込んだ Node の処理でも同じ文字列を返却する。

### リクエスト

```js
import { render } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const html = render("# 見出し\n\n本文");
```

<!-- table: {"kind": "data"} -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `markdown` | 必須 | HTML にする Markdown |
| `opts.config` | 任意 | `mount` の `opts.config` と同じ。読み込むのは `features`（記法のオン・オフ）と `libraries` の名前（どのマーカーをマーカーの場所にするか）だけ |
| `opts.index` | 任意 | `mount` の `opts.index` と同じ |
| `opts.docId` | 任意 | `mount` の `opts.docId` と同じ |
| `opts.references` | 任意 | `mount` の `opts.references` と同じ |
| `opts.aliases` | 任意 | `mount` の `opts.aliases` と同じ |
| `opts.includes` | 任意 | `mount` の `opts.includes` と同じ |
| `opts.icons` | 任意 | `mount` の `opts.icons` と同じ。表に無いまとめていない名前は中が空の要素にする |

<!-- /table -->

### レスポンス

| 型 | 説明 |
| --- | --- |
| `string` | 本文の HTML 文字列。描く先の要素は含まない。class `mdmark` の要素の中に配置すると mdmark の CSS が該当する |

同じ引数には、ブラウザでも Node でも同じ文字列を返却する。
各記法の中身（全てのタブの中身・閉じたセクションの中身を含む）は、スクリプトを動かさなくても読み込める。
並べ替え・タブの切り替えなどの操作は `mount` が付ける。
用語の意味と関連文書、やめた言い方の代わりの用語、エイリアスの種類ごとの説明、文書の末尾の被参照の一覧も、スクリプトを動かさなくても読み込める。
ツールチップを開閉する操作と、コマンドをコピーするボタンの操作は `mount` が付ける。
図の部品の定義は、タイトル・図・凡例の HTML にし、定義の JSON は残さない。図の操作は `mount` が付ける。

本文のブロック（見出し・段落・リスト・リストの項目・表・表の行・コードブロック・引用・水平線・注意書き・マーカーの範囲を囲む要素）の開始の要素には、そのブロックが Markdown で始まる行の番号を `data-source-line` で付ける。
番号は 0 始まりで、Markdown の 1 行目が `0`。
入れ子のブロックは、それぞれの開始の行を持つ。
VS Code のエディタの行番号（0 始まり）とそのまま比べられるため、エディタとプレビューのスクロールを合わせる手がかりに使用する。
コードブロックの行の `data-line`（コードの中の 1 始まりの行番号）と、図の線の `data-line`（線の種類）とは別の属性で、sanitize は `data-source-line` を全ての要素で残す。
`mount` が描いた本文のブロックにも、同じ `data-source-line` が付く。

### エラー

なし。常に文字列を返却する。
未知のマーカーと、許可していない要素・属性は落とす。
外部ライブラリは読み込まず、対応表にあるマーカーと登録した拡張のマーカーは読み込み中のブロックに置き換えて返却する。
記法のマーカーに読み込めない指定がある箇所には、[記載の警告](./記法.md#記載の警告) を配置する。
索引が Schema に合わないときも、合わない文書・用語の項目を除いて文字列を返却する。

## 参照の表を作る

索引と全ての文書の本文から、文書ごとの被参照と、各文書の用語集の表から入れた用語をまとめた参照の表を返却する。
利用側のサーバーなどがこの表を作り、`mount`・`render` の `opts.references` に指定する。
引数を書き換えず、ファイルとネットワークを読み込まない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返却する。

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
| `input.index` | 必須 | 利用側が索引の YAML を読み込んだオブジェクト。構造は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて作る |
| `input.documents` | 必須 | 文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を参照する表。索引に無いパスの文書は無視する。索引にあって表に無い文書は、`related` だけで参照に入る |
| `input.config` | 任意 | `mount` の `opts.config` と同じ。読み込むのは `features` だけで、文書ごとの `<!-- features: … -->` を重ね、`backlinks` がオフの文書を参照元にも参照先にもせず、`glossary` がオフの文書の表の用語を入れない |

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `backlinks` | `Record<string, string[]>` | 文書の `id` から、その文書を参照している文書の `id` の並びを参照する表。並びは索引の `docs` の順で、重なりと自分自身は入らない。参照されていない文書は空の並び |
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
結果は利用側が持ち、文書を書き換えたときに再作成する。

### エラー

例外は投げない。
索引の文書・用語の項目が Schema に合わないときは、合わない項目を除いて作る。
合わないことを知るには、[`checkIndex`](#索引を点検する) を呼ぶ。

## 本文の参照を取り出す

索引と文書の本文から、本文に出た用語・文書の別名の一致を、参照先と本文の位置つきで返却する。
画面を出さずに、描いた文書の下線とツールチップと同じ補足を取り出したいときに呼ぶ。
引数を書き換えず、ファイルとネットワークを読み込まない。
DOM に頼らず、Node とブラウザのどちらでも動く。

### リクエスト

```js
import { collectMatches } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const { byDocument, avoided, targets } = collectMatches({
  index,
  documents: { "使用方法/guide.md": "# 使用方法\n\nWS で公開関数を呼ぶ。作業場は使用しない。" },
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.index` | 必須 | 利用側が索引の YAML を読み込んだオブジェクト。構造は [索引](./索引.md)。Schema に合わない文書・用語の項目は除いて照合する |
| `input.documents` | 必須 | 文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を参照する表。複数の文書を指定できる。索引に無いパスの文書は無視する。ほかの文書の用語集の表の用語も、この表にある本文から読み込む |
| `input.config` | 任意 | `mount` の `opts.config` と同じ。読み込むのは `features` だけで、文書ごとの `<!-- features: … -->` を重ね、`glossary`・`backlinks`・`html`・`diagrams` のオン・オフを文書ごとに決める |
| `input.aliases` | 任意 | `mount` の `opts.aliases` と同じ。使用できないエイリアス（`env` を含む）は `mount` と同じく除いて照合する。省くと、エイリアスを照合しない |

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `byDocument` | `Record<string, MdmarkMatch[]>` | 文書の `id` から、その文書の本文の一致の並びを参照する表。キーは `documents` に本文がある索引の文書で、一致が無い文書は空の並び。並びは本文の頭からの順（行の順、同じ行は始まりの順）で、同じ参照先の出現も全て並べる |
| `avoided` | `Record<string, MdmarkAvoidedMatch[]>` | 文書の `id` から、その文書の本文に出たやめた言い方の並びを参照する表。キーは `byDocument` と同じで、やめた言い方が無い文書と `glossary` がオフの文書は空の並び。並びは本文の頭からの順で、同じやめた言い方の出現も全て並べる |
| `targets` | `MdmarkMatchTarget[]` | 指定した全ての文書の参照先を、種類と `id` の組で重なりを除いてまとめた並び。同じ参照先は 1 回だけ入る。並びは索引の `docs` の順に文書を確認して、その文書の中の初出の順 |

`byDocument` の要素（`MdmarkMatch`）は、次のキーを持つ。

<!-- table: {"kind": "data"} -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `kind` | `'term' \| 'glossary' \| 'doc' \| 'alias'` | 参照先の種類。`term` は索引の用語、`glossary` は用語集の表の用語、`doc` は別名が一致した文書、`alias` は `input.aliases` のエイリアス |
| `aliasType` | `'term' \| 'doc' \| 'command' \| 'url' \| 'skill' \| 'tool' \| 'path'` | エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ |
| `id` | `string` | 参照先の `id`。`term` は `terms[].id`、`glossary` は `glossary:{表を持つ文書の id}:{用語}`、`doc` は `docs[].id`、`alias` はエイリアスの `id` |
| `title` | `string` | 参照先のタイトル。`term` は `terms[].term`、`glossary` は用語の列、`doc` は `docs[].title`、`alias` はエイリアスの `name` |
| `description` | `string` | 参照先の短い説明。`term` は `terms[].meaning`、`glossary` は意味の列、`doc` は `docs[].description`、`alias` はエイリアスの `description`。`doc` と `alias` で `description` を持たないときは、このキーを持たない |
| `text` | `string` | 一致した文字列。照合した辞書の単語で、別名で一致したときはその別名。索引・用語集の表に記載した表記で返却し、本文の表記は `line`・`start`・`end` から参照する |
| `line` | `number` | 一致した本文の Markdown の行。1 から数える |
| `start` | `number` | その行の中の始まりの位置。0 から数える UTF-16 の位置 |
| `end` | `number` | その行の中の終わりの位置（含まない）。UTF-16 の位置 |

<!-- /table -->

`avoided` の要素（`MdmarkAvoidedMatch`）は、次のキーを持つ。

<!-- table: {"kind": "data"} -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `kind` | `'term' \| 'glossary' \| 'alias'` | 代わりの用語の種類。`byDocument` の要素の `term`・`glossary` と同じ。`alias` は、`term` の種類のエイリアスの `avoid` か、`avoid` の種類のエイリアス。`avoid` の種類は、`title` を `replacement` にし、`description` を持たない |
| `aliasType` | `'term' \| 'avoid'` | エイリアスの `alias_type`。`kind` が `alias` のときだけ持つ |
| `id` | `string` | 代わりの用語の `id`。`byDocument` の要素の `id` と同じ記載方法 |
| `title` | `string` | 代わりの用語のタイトル。`byDocument` の要素の `title` と同じ記載方法 |
| `description` | `string` | 代わりの用語の短い説明。`byDocument` の要素の `description` と同じ記載方法 |
| `text` | `string` | 一致したやめた言い方。`byDocument` の要素の `text` と同じく、索引・用語集の表に記載した表記で返却する |
| `line` | `number` | `byDocument` の要素の `line` と同じ |
| `start` | `number` | `byDocument` の要素の `start` と同じ |
| `end` | `number` | `byDocument` の要素の `end` と同じ |

<!-- /table -->

`targets` の要素（`MdmarkMatchTarget`）は、`kind`・`aliasType`・`id`・`title`・`description` を `byDocument` の要素と同じ値で持つ。

```json
{
  "byDocument": {
    "guide": [
      { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を配置するフォルダ", "text": "WS", "line": 3, "start": 0, "end": 2 },
      { "kind": "doc", "id": "api", "title": "API", "description": "公開関数の一覧", "text": "公開関数", "line": 3, "start": 4, "end": 8 }
    ]
  },
  "avoided": {
    "guide": [
      { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を配置するフォルダ", "text": "作業場", "line": 3, "start": 12, "end": 15 }
    ]
  },
  "targets": [
    { "kind": "term", "id": "ws", "title": "ワークスペース", "description": "話し合いの記録を配置するフォルダ" },
    { "kind": "doc", "id": "api", "title": "API", "description": "公開関数の一覧" }
  ]
}
```

#### 照合の範囲

用語のツールチップと同じ辞書と照合を使用する。

- 辞書は、索引の `terms`、`input.aliases`（並びの順）、照合する文書の用語集の表、ほかの文書の表の順に優先する。文書の別名は、照合する文書自身の別名を除く
- 単語の始まりと終わりが本文の単語の区切りに一致するところだけを取り、重なるときは長い単語を先に取る。単語の区切りは実行環境に依る（`Intl.Segmenter` の有無と辞書で決まる）ため、同じ実行環境で描いた文書の下線と同じ一致を返却する
- 照合の前に、辞書の単語と本文の文字の両方を、NFKC・英字の小文字化・前後の空白の除去で正規化する。正規化した後に同じになる単語は 1 つの単語として扱い、優先の順で先の用語を使用する。`line`・`start`・`end` は、正規化する前の本文の位置を指す
- 照合するのは本文の地の文で、コード・リンク・見出し・用語集の表の中は除く
- `html` がオンの文書は、`<!-- html -->` の範囲の `html` のコードブロックに記載した HTML の文字も照合する。`a`・`code`・`pre`・`button`・見出しが直接持つ文字と、タグ・属性の値・`script` のように中身ごと落ちる要素は除く
- `diagrams` がオンの文書は、図の部品の範囲の定義と、埋め込んだ HTML の中の図の部品の custom element の定義に記載した `{{単語}}` の単語が正規化した後に用語に一致し、意味が空でないとき、その用語の参照にする。文書の別名は参照しない
- 文書のマーカーで `glossary` がオフの文書は用語・エイリアス・やめた言い方を、`backlinks` がオフの文書は文書の別名を照合しない。`glossary` がオフの文書の用語集の表は、ほかの文書の照合にも入れない
- やめた言い方（索引の用語の `avoid` と、エイリアスの `avoid` の種類の `name`・`aliases` と `term` の種類の `avoid`、用語集の表の `avoid.column` の列。用語の単語・別名と同じ単語は除く）は、用語・文書の別名の単語に追加して照合し、やめた言い方に該当したところを `avoided` に返却する。照合するのは地の文と、`html` がオンなら埋め込んだ HTML の文字で、図の部品の `{{単語}}` は照合しない。用語・別名の一部として出たやめた言い方は返却しない

ツールチップの、セクションごとに同じ参照先の最初の 1 回だけに下線を付ける制限は下線の出し方のためで、取り出しには有効にならない。
やめた言い方のマーカーの、セクションごとに言い方ごとの最初の 1 回だけに付ける制限も、取り出しには有効にならない。

#### 位置の数え方

`line` は本文の Markdown の行を 1 から、`start`・`end` はその行の中の位置を 0 から数える UTF-16 の位置で返却する。
改行は `\n` で数える。
本文の文字が実体参照やエスケープで記載されているときは、本文に記載したままの範囲を指す（`A&amp;B` に一致した `A&B` は `A&amp;B` の範囲）。

全ての文書の本文を 1 回ずつ解析する。
結果は利用側が持ち、文書を書き換えたときに再作成する。

### エラー

例外は投げない。
索引の文書・用語の項目が Schema に合わないときは、合わない項目を除いて照合する。
合わないことを知るには、[`checkIndex`](#索引を点検する) を呼ぶ。

## 索引を点検する

索引と、索引のフォルダにある文書の本文から、索引と文書のずれの一覧を返却する。
ファイルを読み込むのは呼ぶ側で、mdmark は指定された値だけを確認する。
引数・索引・文書を書き換えない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返却する。

### リクエスト

```js
import { checkIndex } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const issues = checkIndex({ index, documents, indexFile: "docs/index.yaml" });
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.index` | 必須 | 利用側が索引の YAML を読み込んだ値。構造を確認する前の値をそのまま指定する |
| `input.documents` | 必須 | 索引のフォルダにある文書のパス（索引のファイルからの相対パス。区切りは `/`）から、その文書の Markdown を参照する表。どのファイルを文書として指定するかは呼ぶ側が決める |
| `input.indexFile` | 任意 | ずれの `file` に出す索引のファイルの名前。既定は `index.yaml` |
| `input.changedPaths` | 任意 | 比べる基準から変わった文書のパス（`documents` のキーと同じ記載方法）の並び。指定したときだけ、`change_together` の組のうち片方の文書だけが変わった組を `missed_change_together` で返却する。省くと修正漏れを確認しない。索引のどの `path` にも該当しないパスは無視する。基準の引き方（git の比べ方）は呼ぶ側が決める |

索引の `docs[].related` の要素は、`MdmarkIndexRelated` のオブジェクトか、関連する文書の `id` の文字列。

| 項目 | 型 | 必須 / 任意 | 説明 |
| --- | --- | --- | --- |
| `to` | `string` | 必須 | 相手の文書の `id` |
| `type` | `MdmarkRelationType` | 必須 | 関係の種類。`'requires' \| 'references' \| 'replaces' \| 'part_of' \| 'change_together'` |
| `when` | `string` | 必須 | いつ読み込むかの 1 文。空にできない |
| `paths` | `string[]` | 任意 | 関連が該当するファイルの glob の並び |

型 `MdmarkIndexRelated`・`MdmarkRelationType` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
キーの意味は [索引](./索引.md#関連の要素)。

### レスポンス

ずれの一覧。ずれが無ければ空。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `string` | ずれのあるファイル。索引のずれは `indexFile`、文書のずれはその文書のパス |
| `where` | `string` | 索引のキーのパス（`docs[3].path`）か、文書の行。ファイル全体のずれは空文字 |
| `kind` | `'schema' \| 'missing_doc' \| 'orphan_doc' \| 'broken_ref' \| 'untyped_related' \| 'one_sided_change_together' \| 'related_link_overlap' \| 'missed_change_together' \| 'duplicate_term' \| 'avoided_term'` | ずれの種類。意味は [索引](./索引.md#点検が返却するずれ) |
| `message` | `string` | ずれの内容と修正方法を記載した日本語の 1 文 |

並びは `schema` → `missing_doc` → `orphan_doc` → `broken_ref` → `untyped_related` → `one_sided_change_together` → `related_link_overlap` → `missed_change_together` → `duplicate_term` → `avoided_term` の順で、同じ種類の中は索引の並びとパスの順。

```json
[
  { "file": "docs/index.yaml", "where": "docs[1].path", "kind": "missing_doc", "message": "`old.md` が見つかりません。文書を戻すか、索引の `docs[1]` を削除してください。" },
  { "file": "new.md", "where": "", "kind": "orphan_doc", "message": "`new.md` が索引にありません。索引の `docs` に追加してください。" }
]
```

索引の `docs[].path` と `documents` のキーは、`./` と重なった `/` を除いた文字列で比べる。
大文字と小文字は区別する。
指定された全ての文書を確認し、上限は無い。

### エラー

例外は投げない。
索引が Schema に合わないときは、合わないところごとに `schema` のずれを返却し、読み込めた文書・用語でほかのずれも確認する。

## エイリアスを作る

設定の `aliases` の行と、行の `paths` に該当した YAML を読み込んだ中身から、`metadata` を適用したエイリアスの並びと、使用できない行・レコードのずれの一覧を返却する。
CLI の `export`・`build`・`check` と、利用側の処理が同じ関数を使用し、返却したエイリアスを `mount`・`render`・`collectMatches` の `aliases` に指定する。
ファイルを読み込むのは呼ぶ側で、mdmark は指定された値だけからエイリアスを作る。
引数を書き換えず、ファイルとネットワークを読み込まない。
DOM に頼らず、Node とブラウザのどちらでも同じ結果を返却する。

### リクエスト

```js
import { buildAliases } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const { aliases, problems } = buildAliases({
  rows: [{ id: "terms", paths: ["terms/*.yaml"], alias_type: "term", records: "terms", metadata: { name: "term" } }],
  sources: [{ rowId: "terms", path: "terms/glossary.yaml", data: { terms: [{ id: "ws", term: "ワークスペース", description: "話し合いの記録を配置するフォルダ" }] } }],
});
```

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `input.rows` | 必須 | 利用側が設定の `aliases` を読み込んだ配列。行の構造は [設定](./設定.md#エイリアスの元の行)。`id`・`paths`・`alias_type` を持たない行は使用せず、ずれにもしない（構造は `mdmark check` が `schema` のずれで返却する）。`enabled` が `false` の行は読み込まない |
| `input.sources` | 必須 | 行の `paths` に該当したファイルを YAML として読み込んだ中身（`MdmarkAliasSource`）の並び。行ごとに `paths` に記載した順、glob の中はパスの順に並べる。読み込めなかったファイルと、どのファイルにも該当しなかった `paths` は呼ぶ側が扱い、ここには入れない |
| `input.configFile` | 任意 | 行のずれの `file` に出す設定ファイルの名前。既定は `mdmark.config.yaml` |

`MdmarkAliasSource` の構造。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `rowId` | `string` | そのファイルを指した行の `id` |
| `path` | `string` | ファイルのパス（設定ファイルのフォルダからの相対パス。区切りは `/`）。ずれの `file` と、`name` を持たないときの名前に使用する |
| `data` | `unknown` | ファイルを YAML として読み込んだ値 |

行の `records` を記載した行はファイルのそのキーの配列の要素ごとに、記載しない行はファイルの値を 1 件にして、レコード 1 つからエイリアスを 1 つ作る。
値の取り方と種類ごとの必須のキーは [設定](./設定.md#エイリアスの元の行)。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `aliases` | `MdmarkAlias[]` | 作ったエイリアスの並び。並びは行の並び、行の中は `sources` の並び、ファイルの中は `records` の配列の並びで、この並びが同じ単語に該当したときの優先の順になる。`env` と、使用できないエイリアスは入らない |
| `problems` | `MdmarkAliasProblem[]` | 使用できなかった行・レコードのずれの一覧。ずれが無ければ空 |

`MdmarkAlias` は、次のキーを持つ。

<!-- table: {"kind": "data"} -->

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `alias_type` | `MdmarkAliasType` | 種類。`'term' \| 'doc' \| 'command' \| 'url' \| 'skill' \| 'tool' \| 'path' \| 'avoid'`。`env` は含めない |
| `id` | `string` | エイリアスの `id`。指定したエイリアスの中で一意 |
| `name` | `string` | 照合する単語で、ツールチップに出す名前。`avoid` の種類ではやめた言い方 |
| `aliases` | `string[]` | 名前と同じく照合する単語。無ければ空の並び |
| `description` | `string` | ツールチップの説明。`term`・`doc` では必須 |
| `command` | `string` | `command` の種類のコマンド |
| `cwd` | `string` | `command` の種類の実行場所 |
| `url` | `string` | `url` の種類の URL |
| `skill` | `string` | `skill` の種類のスキル名 |
| `tool` | `string` | `tool` の種類のツール名 |
| `path` | `string` | `path` の種類のパス |
| `avoid` | `string[]` | `term` の種類の、使用しないことにした言い方 |
| `replacement` | `string` | `avoid` の種類の置き換え先の単語 |
| `related` | `string[]` | `term` の関連する単語。受け取るだけで、使用しない |

<!-- /table -->

`MdmarkAliasProblem` は、次のキーを持つ。

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `file` | `string` | ずれのあるファイル。行のずれは `configFile`、レコードのずれはそのレコードのファイルの `path` |
| `where` | `string` | 行のずれは設定のキーのパス（`aliases[1].id`）。レコードのずれはファイルの中のパス（`records` を記載した行は `terms[2].command`、記載しない行は `command`）。ファイル全体のずれは空文字 |
| `kind` | `'duplicate_alias_row_id' \| 'alias_records_missing' \| 'alias_field_missing' \| 'alias_unknown_type' \| 'alias_required_empty' \| 'duplicate_alias_id'` | ずれの種類。意味は [CLI](./CLI.md#設定と索引を点検する) |
| `message` | `string` | ずれの内容と修正方法を記載した日本語の 1 文 |

ずれの並びは `aliases` と同じ順で、同じ行・レコードの中は `metadata` のキーの順。
型 `MdmarkAlias`・`MdmarkAliasType`・`MdmarkAliasSource`・`MdmarkAliasProblem` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

```json
{
  "aliases": [
    { "alias_type": "term", "id": "ws", "name": "ワークスペース", "aliases": [], "description": "話し合いの記録を配置するフォルダ" }
  ],
  "problems": []
}
```

### エラー

例外は投げない。
使用できない行・レコードは、除いてずれにし、ほかの行・レコードからエイリアスを作る。
`env` のレコードは種類と必須のキーを確認してずれを返却するが、`aliases` には入れない。
上限は無く、指定された全ての行とファイルを使用する。

## 拡張を登録する

利用側が自分のマーカーの名前と、そのマーカーを描くモジュールの読み込み方を登録する。
文書にそのマーカーがあるときだけ、`mount` と `update` が引数を検査してからモジュールを読み込み、マーカーの場所に描かせる。
手順は [拡張を登録する](./カスタマイズ-拡張を登録する.md)。

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
| `extension.name` | 必須 | 拡張の名前。空にできない。通知ブロック・記載の警告・`console.error` に出す |
| `extension.directive` | 必須 | 拡張のマーカーの名前（`<!-- {directive}: {引数} -->`）。英小文字で始まり、英小文字・数字・`-` だけを持つ。`features` と記法のマーカー（`table`・`tabs`・`steps`・`section`・`row-detail`・`fig`・`toc`・`glossary`・`view`）と、登録済みの拡張の `directive` は使用できない。設定の `libraries` や図の部品のマーカー（`chart`・`param`・`er`）、廃止した `flow`・`sequence` に同じ名前があるときは、拡張を優先する |
| `extension.load` | 必須 | 拡張のモジュールを読み込む関数。文書にマーカーがあるときだけ、`mount` と `update` が描くごとに 1 回呼ぶ。同じ文書の同じ拡張のマーカーでは 1 回だけ呼ぶ |
| `extension.schema` | 任意 | マーカーの引数を検査する Standard Schema。zod・valibot など、`~standard` を持つ検査ライブラリの schema をそのまま指定できる。省くと検査しない |

拡張のモジュールは、`draw(slot, value)` を名前付きで export する。
`slot` はマーカーの場所の要素、`value` は `{ options: Record<string, unknown>; definition?: unknown }`。
`options` はマーカーに記載した JSON のオブジェクトで、引数の無いマーカーは `{}`。前の書き方（JSON でない引数）のマーカーは、`load` を呼ばずに記載の警告に替わる。
マーカーを範囲（`<!-- {directive} -->` 〜 `<!-- /{directive} -->`）で記載し、範囲に言語 `json` のコードブロックを 1 つ配置すると、その JSON を読み込んだ値を `definition` に入れる。範囲が無いマーカーは `definition` を持たない。
`draw` は同期でも `Promise` を返却する非同期でもよい。
`draw` の中で、配布物が出す [`mountView`](#ビューを描く) と [`mountComments`](#コメントを付ける) を `slot` に対して呼んで、マーカーの場所に mdmark の部品を描ける。
`draw` が部品の `Promise` を待つと、`mount` はその後にマーカーの場所を描き終えたものとして扱う。
`update`・`destroy` でマーカーの場所を片付けるとき、その中の部品の `destroy` も行う。
手順は [部品をJavaScriptから使用する](./カスタマイズ-部品をJavaScriptから使用する.md)。

`registerExtension` と、型 `MdmarkExtension`・`MdmarkExtensionModule`・`MdmarkMarkArgs`・`StandardSchemaV1` と、図の部品の定義の型 `MdmarkChartDefinition`・`MdmarkParamDefinition` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
JavaScript で記載する拡張は、この型定義に対して `tsc --noEmit` で点検できる（[固有の部品とCSSを適用する](./図を描く-固有の部品とCSSを適用する.md)）。
`StandardSchemaV1` は Standard Schema の仕様の型を複製したもので、mdmark は検査ライブラリに依存しない。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `void` | 戻り値は無い。登録は同期で終わり、描いた後に登録したマーカーは、次の `mount`・`update` から有効になる |

### エラー

登録するときは、次の例外を投げて登録しない。

| 例外 | 発生条件 |
| --- | --- |
| `TypeError` | `name` が空、`directive` がマーカーの名前の書式に合わない、`load` が関数でない、または `schema` が `~standard` を持たない。メッセージに合わない項目の名前を含める |
| `Error` | `directive` が `features` か記法のマーカー、または登録済みの拡張の `directive` と同じ。メッセージに重なった名前を含める |

描くときは例外を投げず、そのマーカーの場所だけを替えて、ほかは描く。

| 起きたこと | マーカーの場所 |
| --- | --- |
| 引数が `schema` に合わない | [記載の警告](./記法.md#記載の警告)。モジュールを読み込まない。issue ごとに項目を並べる。引数の位置まで届く指摘は `{位置} つ目の {値}: {message}`、キーまで届く指摘は `{キー}=: {message}`、届かない指摘は `{message}` だけの項目にする |
| `load` が拒否される、または `draw` が例外を投げる | [通知ブロック](./用語集.md)。拡張の名前と元のエラーが `console.error` に出る |
| `schema` の `validate` が例外を投げるか拒否される | [通知ブロック](./用語集.md)。`load` を呼ばない。拡張の名前と元のエラーが `console.error` に出る |

`render` は拡張のマーカーを読み込み中のブロックに置き換えるだけで、`load` も検査も呼ばない。

## ビューを描く

利用側のページと拡張のモジュールが、列名と項目の値を指定し、要素の中にボード表示と表形式のビューを描く。
文書のビューのマーカー（[ビュー](./記法.md#ビュー)）で描くものと同じ外観と操作になる。
手順は [部品をJavaScriptから使用する](./カスタマイズ-部品をJavaScriptから使用する.md)。

### リクエスト

```js
import { mountView } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = await mountView(document.querySelector("#tasks"), {
  columns: ["タイトル", "状態", "担当"],
  items: [{ タイトル: "配色の変数を洗い出す", 状態: "未着手", 担当: "佐藤" }],
  group: "状態",
  filter: { 担当: "select" },
});
handle.destroy();
```

<!-- table: {"kind": "data"} -->

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素。中身を空にして、class `mdmark` の要素を 1 つ配置し、その中に描く |
| `opts.columns` | 必須 | 列名の配列。表形式のビューの列の並びと、ボードの項目に出す値の並びになる。1 つ以上で、空の文字列と重なりを持たない |
| `opts.items` | 必須 | 項目の配列。列名をキーにした文字列の値を持つオブジェクトで、並びは表の行の順。列名に無いキーは使用せず、列名のキーが無い値は空にする |
| `opts.group` | 任意 | ボード表示で列に分ける列名。`opts.columns` のどれか。省くと、ボード表示を持たず表形式のビューだけを描く。マーカーの `board.group.column` に該当する |
| `opts.default` | 任意 | 描いた直後に出すビュー（`"board"` か `"table"`）。省くと、`opts.group` があれば `"board"`、無ければ `"table"`。`opts.group` が無いときは `"table"` だけ。マーカーの `initial` に該当する |
| `opts.filter` | 任意 | 表形式のビューで絞り込みを付ける列と種類（`select`・`text`・`date`）のオブジェクト。キーは `opts.columns` のどれか。省くと、どの列にも付けない。マーカーの `columns.{列名}.filter.type` に該当する |
| `opts.icons` | 任意 | ボードの列の見出しの値からアイコンの名前を参照するオブジェクト。既定のアイコンに重ね、同じ値は上書きする。使用できるアイコンは [ビュー](./記法.md#ビュー) のとおり。マーカーの `board.values.{値}.icon` に該当する |

<!-- /table -->

列名と項目の値は文字として出し、HTML として解釈しない。
同じ要素へもう一度 `mountView` を呼ぶと、前の `mountView` の `destroy` を先に行う。
ビューの部品のモジュール（`dist/view.js`）は、初めて呼んだときか文書にビューのマーカーがあるときに 1 回だけ、`dist/index.js` の隣から読み込む。
型 `mountView`・`MdmarkViewOptions`・`MdmarkViewHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `Promise<{ destroy: () => void }>` | 部品のモジュールを読み込み、ビューを描いてから解決する。`destroy` は `el` の中を空にし、ビューの操作と、絞り込みのドロワーを開いている間の `document` の受け取りを解除する。2 回目以降は何もしない |

### エラー

| 起きたこと | 動き |
| --- | --- |
| `el` が要素でない、`opts.columns` が空か文字列の配列でないか重なりを持つ、`opts.items` が配列でないか要素がオブジェクトでない、`opts.group`・`opts.filter` の列名が `opts.columns` に無い、`opts.filter` の種類が `select`・`text`・`date` でない、`opts.default` が `board`・`table` でないか `opts.group` が無いのに `board`、`opts.icons` に使用できないアイコンの名前がある | `TypeError` を同期で投げる（`Promise` は返却しない）。`el` は書き換えず、メッセージに誤った引数の名前を含める |
| ビューの部品のモジュールを読み込めない | `el` の中にタイトル `この箇所を表示できません` の [通知ブロック](./用語集.md) を配置し、`Promise` を元のエラーで reject する |

## コメントを付ける

利用側のページが、自分で記載した要素とコメントの読み込みと保存の関数を指定し、要素の中の選んだ箇所にコメントを付けられるようにする。
`mount` で描いた文書のコメントと同じ外観と操作になる。
手順は [部品をJavaScriptから使用する](./カスタマイズ-部品をJavaScriptから使用する.md)。

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
| `opts.store` | 必須 | コメントの読み込みと保存の関数（`MdmarkCommentStore`）。構造は [文書を描く](#文書を描く) の `opts.commentStore` と同じ |
| `opts.docId` | 必須 | 読み込みと保存の関数に指定する、コメントを付ける対象の ID。空でない文字列 |

`opts.store.load` を 1 回呼び、読み込んだコメントの箇所をマーカーで包む。`el` の文字は変えない。
コメントのボタン・入力欄・吹き出しは `document.body` に配置する。
同じ要素へもう一度 `mountComments` を呼ぶと、前の `mountComments` の `destroy` を先に行う。
コメントの部品のモジュール（`dist/comments.js`）は、初めて呼んだときか `mount` でコメントの機能がオンになったときに 1 回だけ、`dist/index.js` の隣から読み込む。
型 `mountComments`・`MdmarkCommentStore`・`MdmarkComment`・`MdmarkCommentDraft`・`MdmarkCommentsHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

### レスポンス

| 型 | 説明 |
| --- | --- |
| `Promise<{ destroy: () => void }>` | `load` の結果でマーカーを付けてから解決する。`destroy` はマーカーを削除して `el` の文字を呼ぶ前の並びに戻し、コメントのボタン・入力欄・吹き出しと `document` の受け取りを解除する。2 回目以降は何もしない。保存を待つ間に `destroy` を呼ぶと、保存の結果でマーカーを付けない |

### エラー

| 起きたこと | 動き |
| --- | --- |
| `el` が要素でない、`opts.store` が `load`・`save` の関数を持たないか `update`・`remove` を関数でない値で持つ、`opts.docId` が空か文字列でない | `TypeError` を同期で投げる（`Promise` は返却しない）。`el` は書き換えず、メッセージに誤った引数の名前を含める |
| `load` が reject する、または返却した値がコメントの構造に合わない | 例外を投げず、マーカーを付けずに解決する。新しいコメントは付けられる。`load`・`docId`・元のエラーか合わなかった値を `console.error` に出す |
| `save` が reject する、または返却した値がコメントの構造に合わない | 例外を投げず、入力欄に記載した本文を残して通知を出し、マーカーを付けない。`save`・`docId`・元のエラーを `console.error` に出す |
| `update`・`remove` が reject する | 例外を投げず、修正は入力欄と書き換えた本文を残し、削除はコメントとマーカーを残して削除の確認を開いたまま通知を出す。関数の名前・`docId`・コメントの `id`・元のエラーを `console.error` に出す |
| コメントの部品のモジュールを読み込めない | `el` を書き換えず、`load` を呼ばずに、`Promise` を元のエラーで reject する |

## テーマの CSS 変数

描いた文書の外観の値を持つ変数。
利用側が `.mdmark` などに記載して上書きする。
手順は [テーマを上書きする](./カスタマイズ-テーマを上書きする.md)。

### リクエスト

```css
.mdmark {
  --mdmark-color-link: #c00;
  --mdmark-radius: 0;
}
```

### レスポンス

配色によらない変数。

<!-- table: {"kind": "data"} -->

| 変数 | 既定 | 使用する場所 |
| --- | --- | --- |
| `--mdmark-font-body` | `system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", Meiryo, sans-serif` | 本文の書体 |
| `--mdmark-font-heading` | `var(--mdmark-font-body)` | 見出しの書体 |
| `--mdmark-font-mono` | `ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | コードの書体 |
| `--mdmark-font-size` | `0.875rem` | 本文の文字の大きさ |
| `--mdmark-line-height` | `1.8` | 本文の行間 |
| `--mdmark-content-width` | `none` | 行の長さの上限。既定は上限が無く、描く先の要素の幅を使用する。行の長さを抑えたいときに `46rem` などの長さを指定する |
| `--mdmark-space` | `0.875rem` | ブロックの間隔の基準 |
| `--mdmark-padding` | `1.5rem` | 描く先の要素の内側の余白 |
| `--mdmark-radius` | `4px` | 角丸の大きさ（描く先の要素・コードブロック・引用・折り畳み・読み込み中のブロック・通知ブロック・記載の警告・注意書き）。表の外側の枠は 2 倍 |
| `--mdmark-heading-weight` | `700` | 見出しの太さ |
| `--mdmark-heading-rule-width` | `1px` | 見出し 1・見出し 2 の下の線の太さ。線を出したくないときは `0` を指定する |
| `--mdmark-table-rule-inline` | `1px` | 表のセルの左右の線の太さ（`plain` の種類は `0`） |
| `--mdmark-back-to-top-size` | `2.75rem` | 先頭へ戻るボタンの幅と高さ |
| `--mdmark-back-to-top-gap` | `1rem` | 先頭へ戻るボタンと、スクロールする場所の右端・下端の間 |
| `--mdmark-sticky-top` | `0px` | 表の見出し行と、右側の目次・狭い幅の帯を留める位置と、hover で開く右側の目次の枠の上端の、画面の上端からのずれ。ページの上端に固定したヘッダーを持つ利用側は、その高さを指定する |
| `--mdmark-icon-inline-size` | `1em` | 行内のアイコン（`icon\:`）の幅と高さ |
| `--mdmark-highlight-bg` | `var(--mdmark-color-accent-yellow-bg)` | 色を指定しない蛍光ペンの面の色 |
| `--mdmark-color-footnote-ref` | `var(--mdmark-color-link)` | 本文の脚注の番号（`[1]`）の色 |
| `--mdmark-color-term-underline` | `var(--mdmark-color-muted)` | 用語の単語と文書の別名の、破線の下線の色 |
| `--mdmark-color-avoided-underline` | `var(--mdmark-color-notice-border)` | やめた言い方の単語の、波線の下線の色 |
| `--mdmark-tooltip-max-width` | `22rem` | ツールチップの幅の上限。画面の幅から `2rem` を参照した幅を超えない |
| `--mdmark-tooltip-max-height` | `18rem` | ツールチップの高さの上限。画面の高さの 60% を超えない。超える分はツールチップの中でスクロールする |
| `--mdmark-diagram-lane-tint` | `8%` | 図の層の背景に敷く、ノードの色の濃さ |
| `--mdmark-diagram-max-height` | `36rem` | 文書の中の図の表示する枠の最初の高さの上限。開いたときと全体が収まる倍率に戻したときは、図の高さ × 全体が収まる倍率とこの値の小さいほうにする（全体が収まる倍率は枠の幅で決める）。利用側が高さを変えたときはこの値で止めず、図の高さ × 今の倍率まで広げられる |
| `--mdmark-diagram-box-shadow` | `inset 0 0 0 1px var(--mdmark-color-border)` | 図の表示するノード（右上のボタンの帯と表示する枠をまとめたノード）の線（`box-shadow` の値）。枠を持つ面に文書を描く利用側は、面で `none` を指定して線を削除する。操作できる部品の中の図は線を描かず、全画面のモーダルの中の図はこの値を受け継がず既定の線で描く |
| `--mdmark-diff-minimap-width` | `14px` | 差分のミニマップの帯の幅 |
| `--mdmark-diff-minimap-z-index` | `10` | 差分のミニマップの帯の重なり順。利用側のページの固定のヘッダーなどに隠れるときに上げる |
| `--mdmark-code-fold-width` | `2.75ch` | 畳める行を持つコードブロックで、行番号の右に取る開閉のボタンの列の幅 |
| `--mdmark-tab-strong-weight` | `700` | タブ名の強調（`**`）の太さ |
| `--mdmark-tab-strong-color` | `var(--mdmark-color-heading)` | タブ名の強調（`**`）の色。選んでいないタブでもこの色にする |
| `--mdmark-view-column-width` | `12rem` | ビューのボードの列の最小の幅。描く先の幅に収まらない列はボードの中で横にスクロールする |
| `--mdmark-comment-margin-width` | `2.25rem` | `mount` でコメントを付けた文書の、本文の列の右に配置する余白の列の幅。余白のマーカーをこの列に並べる |
| `--mdmark-h1-marker` | なし（記号を出さない） | 見出し 1 の前に配置する記号。引用符で囲んだ文字列で記載する |
| `--mdmark-h2-marker` | なし（記号を出さない） | 見出し 2 の前に配置する記号。引用符で囲んだ文字列で記載する |
| `--mdmark-h3-marker` | なし（記号を出さない） | 見出し 3 の前に配置する記号。引用符で囲んだ文字列で記載する |

<!-- /table -->

配色の変数。ダークの配色は、画面で OS の設定がダークのとき、または描く先かその祖先の class がダークを選ぶとき（[配色を切り替える class](#配色を切り替える-class)）に該当する。印刷では明るい配色に戻る。

<!-- table: {"kind": "data"} -->

| 変数 | 明るい配色 | ダークの配色 | 使用する場所 |
| --- | --- | --- | --- |
| `--mdmark-color-bg` | `#ffffff` | `#131316` | 描く先の要素とまとめた HTML の地 |
| `--mdmark-color-bg-opaque` | `var(--mdmark-color-bg)` | `var(--mdmark-color-bg)` | ツールチップ・メニュー・全画面の図などの浮く部品、表の本文の行と横スクロールの影を隠す覆い・留める見出し・選んだタブの地、注意書き・図・バッジで色を混ぜる先の色、「コメントを保存」のボタンの文字。`--mdmark-color-bg` を透明にするときは、周りの面の色を指定する |
| `--mdmark-color-text` | `#18181b` | `#ededef` | 本文の文字と、コメントの入力欄の「コメントを保存」のボタンの地と線 |
| `--mdmark-color-heading` | `#18181b` | `#ededef` | 見出しの文字 |
| `--mdmark-color-muted` | `#52525b` | `#b4b4bc` | 引用・読み込み中のブロックの文字 |
| `--mdmark-color-link` | `#0f766e` | `#2dd4bf` | リンクとフォーカスの枠 |
| `--mdmark-color-border` | `#e4e4e7` | `#26262b` | 枠・罫線・読み込み中のブロックの破線 |
| `--mdmark-color-border-muted` | `color-mix(in oklab, var(--mdmark-color-border) 70%, var(--mdmark-color-bg))` | 同じ | 見出し 1・見出し 2 の下の線。テーマの `--mdmark-color-border` と `--mdmark-color-bg` から作るため、テーマごとの値を持たない。`.mdmark` で宣言するため、上書きは `:root` ではなく `.mdmark` に記載する |
| `--mdmark-color-surface` | `#f4f4f5` | `#1b1b1f` | コード・引用の面 |
| `--mdmark-color-scroll-shadow` | `rgb(24 24 27 / 0.14)` | `rgb(0 0 0 / 0.6)` | 表とコードブロックに横の続きがあることを示す影 |
| `--mdmark-color-notice-bg` | `#f9eee8` | `#2a251d` | 通知ブロックの地 |
| `--mdmark-color-notice-border` | `#b45309` | `#fbbf24` | 通知ブロックの線・記載の警告の枠の破線 |
| `--mdmark-color-notice-text` | `#18181b` | `#ededef` | 通知ブロックの文字・記載の警告の文字 |
| `--mdmark-color-table-head` | `#f4f4f5` | `#1b1b1f` | 表の見出し行の面 |
| `--mdmark-color-callout-note` | `#1d4ed8` | `#7aa2ff` | 補足の注意書きのタイトル・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-tip` | `#15803d` | `#4ade80` | ヒントの注意書きのタイトル・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-important` | `#6d28d9` | `#c4a7ff` | 重要の注意書きのタイトル・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-callout-warning` | `#b45309` | `#fbbf24` | 警告の注意書きのタイトル・アイコンの色と、面・枠の線のもとの色。コードブロックの警告の行の左端の線と行頭の `!` の色 |
| `--mdmark-color-callout-caution` | `#b91c1c` | `#f87171` | 注意の注意書きのタイトル・アイコンの色と、面・枠の線のもとの色 |
| `--mdmark-color-current-bg` | `#e6f3f1` | `#10302c` | [まとめた HTML](./用語集.md) の文書の一覧の、開いている文書の行の背景。右側の目次の、今いるセクションの項目と、目次を出しているときの目次を出すボタンの背景 |
| `--mdmark-color-diagram-line` | `#71717a` | `#8f8f99` | map の図の、色を指定しない線の色 |
| `--mdmark-color-series-1` | `#0f766e` | `#2dd4bf` | グラフの 1 つ目の系列の色（実線・丸の点） |
| `--mdmark-color-series-2` | `#b45309` | `#fbbf24` | グラフの 2 つ目の系列の色 |
| `--mdmark-color-series-3` | `#6d28d9` | `#c4a7ff` | グラフの 3 つ目の系列の色 |
| `--mdmark-color-series-4` | `#1d4ed8` | `#7aa2ff` | グラフの 4 つ目の系列の色 |
| `--mdmark-color-series-5` | `#be185d` | `#f472b6` | グラフの 5 つ目の系列の色（一点鎖線・逆三角の点・縦線の塗りの模様） |
| `--mdmark-color-series-6` | `#4d7c0f` | `#a3e635` | グラフの 6 つ目の系列の色（細かい破線・十字の点・横線の塗りの模様） |
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
| `--mdmark-color-diff-del-bg` | `#fbe6e3` | `#2a1e20` | 差分の削除した行の背景と、コードの行のマーカーの削除した行の背景 |
| `--mdmark-color-diff-del-word` | `#eeb4ad` | `#5d3435` | 差分の削除した行で変わった単語の背景 |
| `--mdmark-color-diff-del-sign` | `#b91c1c` | `#f87171` | 削除した行の行頭の `-` と、ミニマップの削除した行のマーカーの色。コードの行のマーカーの削除した行の行頭の `-` と左端の線にも使用する |
| `--mdmark-color-diff-add-bg` | `#e1ede2` | `#1e2b24` | 差分の追加した行の背景と、コードの行のマーカーの追加した行の背景 |
| `--mdmark-color-diff-add-word` | `#a9ccaf` | `#2f5c3e` | 差分の追加した行で変わった単語の背景 |
| `--mdmark-color-diff-add-sign` | `#15803d` | `#4ade80` | 追加した行の行頭の `+` と、ミニマップの追加した行のマーカーの色。コードの行のマーカーの追加した行の行頭の `+` と左端の線にも使用する |
| `--mdmark-color-comment-bg` | `#f2effe` | `#25222d` | コメントのマーカーの地の色と、入力欄を開いている間の選んだ文字の色 |
| `--mdmark-color-comment-line` | `#6d28d9` | `#c4a7ff` | コメントのマーカーの下線の色 |
| `--mdmark-color-error` | `#b91c1c` | `#f87171` | コメントの入力欄の通知の文字とアイコン、誤りのある本文の欄の枠の色。コードブロックのエラーの行の左端の線と行頭の `×` の色 |
| `--mdmark-color-accent-blue-bg` | `#cce2fe` | `#1a314e` | 色の名前 `blue` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-blue-text` | `#1d4ed8` | `#7aa2ff` | 色の名前 `blue` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-red-bg` | `#ffd4d1` | `#472020` | 色の名前 `red` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-red-text` | `#b91c1c` | `#f87171` | 色の名前 `red` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-green-bg` | `#cbf2d2` | `#1a3821` | 色の名前 `green` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-green-text` | `#166534` | `#4ade80` | 色の名前 `green` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-yellow-bg` | `#fff2af` | `#40380e` | 色の名前 `yellow` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-yellow-text` | `#854d0e` | `#facc15` | 色の名前 `yellow` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-orange-bg` | `#fedbc4` | `#4a2a12` | 色の名前 `orange` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-orange-text` | `#b53a0a` | `#fb923c` | 色の名前 `orange` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-purple-bg` | `#edd8fd` | `#382446` | 色の名前 `purple` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-purple-text` | `#6d28d9` | `#c4a7ff` | 色の名前 `purple` の文字の色。バッジと本文の文字の色 |
| `--mdmark-color-accent-gray-bg` | `#e4e6ea` | `#303033` | 色の名前 `gray` の面の薄い色。強調した列・色を付けた行・バッジの地 |
| `--mdmark-color-accent-gray-text` | `#52525b` | `#b4b4bc` | 色の名前 `gray` の文字の色。バッジと本文の文字の色 |

<!-- /table -->

注意書きの面は種類の色を地の色に 7%、枠の線は 40% 混ぜた色で、混ぜる割合の変数は持たない。
色のプリセット（`--mdmark-color-accent-*`）は、どの組も文字と面のコントラストを 4.5:1 以上にしている。
色の名前の記載方法は [記法](./記法.md#色の名前)。

#### 配色を切り替える class

描く先の要素かその祖先が次の class を持つとき、配色は上から順に決まる。
どれも無ければ、`prefers-color-scheme`（OS の設定）で決まる。

<!-- table: {"kind": "data"} -->

| 優先 | class | 配色 | 付けるもの |
| --- | --- | --- | --- |
| 1 | `mdmark-theme-dark` | ダーク | 利用側が、OS やホストの配色によらず固定するとき。VS Code 拡張機能は `mdmark.preview.theme` が `dark` のときに付ける。`mount` は、文書の [ページの設定](./記法.md#ページの設定) の `scheme` か設定の [配色の明暗](./設定.md#配色の明暗) が `dark` のとき、描く先の要素に付ける（最も近い class なので祖先の class に勝つ） |
| 1 | `mdmark-theme-light` | ライト | 同上。`mdmark.preview.theme` が `light` のとき。`mount` は `scheme` か配色の明暗が `light` のとき |
| 2 | `vscode-high-contrast-light`・`vscode-light` | ライト | VS Code が Webview の `body` に付ける |
| 2 | `vscode-dark`・`vscode-high-contrast`（`vscode-high-contrast-light` を一緒に持たないとき） | ダーク | 同上 |

<!-- /table -->

同じ優先の class が両方あるときは、描く先に近い祖先の class に従う。
ダークの値は `prefers-color-scheme: dark` のときと同じ変数の値で、差分のミニマップの色も同じ規則で決まる。
印刷では、class によらず明るい配色にする。
利用側が層の外で上書きした変数は、どの配色でも層の中の値に勝つ。

#### 選べるテーマ

配色の変数の値の組を、mdmark に入れたテーマから選べる。
テーマは設定の `colorTheme`（[選ぶテーマ](./設定.md#選ぶテーマ)）で選ぶ。
`mount` は選んだテーマの名前を、描く先の要素の属性 `data-mdmark-color-theme` に付ける。
利用側がこの属性を付ける必要はない。

<!-- table: {"kind": "data"} -->

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
値は `:root` に該当するため、`document.body` の直下の部品にも同じ配色が届く。
利用側が層の外で上書きした変数は、選んだテーマの値に勝つ。
同じページに別のテーマの文書が並ぶと、`theme-paper`・`theme-slate`・`theme-contrast` の並びで後のテーマが全ての文書に該当する。

テーマごとの変数の値は次のとおり。変数の使用する場所は上の表と同じ。

<!-- tabs -->

##### theme-paper

<!-- table: {"kind": "data"} -->

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
| `--mdmark-color-diagram-line` | `#857a6c` | `#9a8f80` |
| `--mdmark-color-series-1` | `#9b2c2c` | `#f0a39a` |
| `--mdmark-color-series-2` | `#1e4f8c` | `#8fb4e8` |
| `--mdmark-color-series-3` | `#3f6b2a` | `#a3c98a` |
| `--mdmark-color-series-4` | `#94540a` | `#e8b04a` |
| `--mdmark-color-series-5` | `#8a3577` | `#d9a6e0` |
| `--mdmark-color-series-6` | `#1f6b66` | `#7fd1c7` |
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

<!-- table: {"kind": "data"} -->

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
| `--mdmark-color-diagram-line` | `#64748b` | `#8391a7` |
| `--mdmark-color-series-1` | `#1d4ed8` | `#7dd3fc` |
| `--mdmark-color-series-2` | `#047857` | `#6ee7b7` |
| `--mdmark-color-series-3` | `#6d28d9` | `#c4b5fd` |
| `--mdmark-color-series-4` | `#a24a06` | `#fdba74` |
| `--mdmark-color-series-5` | `#be185d` | `#f9a8d4` |
| `--mdmark-color-series-6` | `#0e7490` | `#bef264` |
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

<!-- table: {"kind": "data"} -->

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
| `--mdmark-color-diagram-line` | `#4d4d4d` | `#a6a6a6` |
| `--mdmark-color-series-1` | `#0037a8` | `#9cc0ff` |
| `--mdmark-color-series-2` | `#8a4b00` | `#ffd23f` |
| `--mdmark-color-series-3` | `#5b21b6` | `#d0b3ff` |
| `--mdmark-color-series-4` | `#1a5e1a` | `#7ee07e` |
| `--mdmark-color-series-5` | `#a3003c` | `#ff8fb8` |
| `--mdmark-color-series-6` | `#005f6b` | `#5fe0e0` |
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

なし。記載しなかった変数は既定の値になる。
