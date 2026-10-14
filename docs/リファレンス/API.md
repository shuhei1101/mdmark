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

同じ要素へもう一度 `mount` を呼ぶと、前の描画を片付けてから描く。
前の戻り値の `update` は何もしなくなる。

### レスポンス

| フィールド | 型 | 説明 |
| --- | --- | --- |
| `update` | `(markdown: string) => void` | 本文だけを描き直し、記法の操作を付け直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない |
| `destroy` | `() => void` | `el` の中を空にして class `mdmark` を外し、記法の操作と、印刷・`hashchange`・`document` の受け取りを外す。2 回目以降は何もしない |

### エラー

例外は投げない。
外部ライブラリを読めない印の場所は、その場所だけを [知らせの枠](./用語集.md) に替え、ほかは描く。
読めなかった印の名前・URL・元のエラーが `console.error` に出る。
記法の印に読めない指定がある箇所は、読めた指定で描き、その箇所の前に [書き方の警告](./記法.md#書き方の警告) を置く。

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

### レスポンス

| 型 | 説明 |
| --- | --- |
| `string` | 本文の HTML 文字列。描く先の要素は含まない。class `mdmark` の要素の中に置くと mdmark の CSS が当たる |

同じ引数には、ブラウザでも Node でも同じ文字列を返す。
各記法の中身（全てのタブの中身・閉じた節の中身を含む）は、スクリプトを動かさなくても読める。
並べ替え・タブの切り替えなどの操作は `mount` が付ける。

### エラー

なし。常に文字列を返す。
未知の印と、許可していない要素・属性は落とす。
外部ライブラリは読まず、対応表にある印と登録した拡張の印は読み込み中の枠に置き換えて返す。
記法の印に読めない指定がある箇所には、[書き方の警告](./記法.md#書き方の警告) を置く。

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
| `extension.directive` | 必須 | 拡張の印の名前（`<!-- {directive}: {引数} -->`）。英小文字で始まり、英小文字・数字・`-` だけを持つ。`features` と記法の印（`table`・`tabs`・`steps`・`section`・`row-detail`・`fig`・`toc`）と、登録済みの拡張の `directive` は使えない。設定の `libraries` に同じ名前があるときは、拡張を優先する |
| `extension.load` | 必須 | 拡張のモジュールを読む関数。文書に印があるときだけ、`mount` と `update` が描くごとに 1 回呼ぶ。同じ文書の同じ拡張の印では 1 回だけ呼ぶ |
| `extension.schema` | 任意 | 印の引数を検査する Standard Schema。zod・valibot など、`~standard` を持つ検査ライブラリの schema をそのまま渡せる。省くと検査しない |

拡張のモジュールは、`draw(slot, value)` を名前付きで export する。
`slot` は印の場所の要素、`value` は `{ args: string[]; keys: Record<string, string> }`。
`キー=値` でない引数を書いた順に `args`、`キー=値` の引数を `keys` に入れる。
`draw` は同期でも `Promise` を返す非同期でもよい。

`registerExtension` と、型 `MdmarkExtension`・`MdmarkExtensionModule`・`MdmarkMarkArgs`・`StandardSchemaV1` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。
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
| `--mdmark-color-callout-note` | `#0969da` | `#4493f8` | 補足の注意書きの左の線・題・アイコン |
| `--mdmark-color-callout-tip` | `#1a7f37` | `#3fb950` | ヒントの注意書きの左の線・題・アイコン |
| `--mdmark-color-callout-important` | `#8250df` | `#ab7df8` | 重要の注意書きの左の線・題・アイコン |
| `--mdmark-color-callout-warning` | `#9a6700` | `#d29922` | 警告の注意書きの左の線・題・アイコン |
| `--mdmark-color-callout-caution` | `#d1242f` | `#f85149` | 注意の注意書きの左の線・題・アイコン |

<!-- /table -->

### エラー

なし。書かなかった変数は既定の値になる。
