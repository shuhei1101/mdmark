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
| `update` | `(markdown: string) => void` | 本文だけを描き直す。設定は `mount` に渡したものを使う。`destroy` の後は何もしない |
| `destroy` | `() => void` | `el` の中を空にして class `mdmark` を外し、印刷の受け取りを外す。2 回目以降は何もしない |

### エラー

例外は投げない。
外部ライブラリを読めない印の場所は、その場所だけを [知らせの枠](./用語集.md) に替え、ほかは描く。
読めなかった印の名前・URL・元のエラーが `console.error` に出る。

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
| `opts.config` | 任意 | `mount` の `opts.config` と同じ。読むのは `libraries` の名前（どの印を印の場所にするか）だけ |

### レスポンス

| 型 | 説明 |
| --- | --- |
| `string` | 本文の HTML 文字列。描く先の要素は含まない。class `mdmark` の要素の中に置くと mdmark の CSS が当たる |

同じ引数には、ブラウザでも Node でも同じ文字列を返す。

### エラー

なし。常に文字列を返す。
未知の印と、許可していない要素・属性は落とす。
外部ライブラリは読まず、対応表にある印は読み込み中の枠に置き換えて返す。

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
| `--mdmark-radius` | `6px` | 角丸の大きさ（描く先の要素・コードブロック・引用・折り畳み・読み込み中の枠・知らせの枠） |
| `--mdmark-heading-weight` | `600` | 見出しの太さ |
| `--mdmark-heading-rule-width` | `1px` | 見出し 1・見出し 2 の下の線の太さ。`0` にすると線が出ない |
| `--mdmark-table-rule-inline` | `1px` | 表のセルの左右の線の太さ |

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
| `--mdmark-color-surface` | `#f6f8fa` | `#151b23` | コード・表の見出し行・引用の面 |
| `--mdmark-color-scroll-shadow` | `rgb(31 35 40 / 0.22)` | `rgb(145 152 161 / 0.5)` | 表とコードブロックに横の続きがあることを示す影 |
| `--mdmark-color-notice-bg` | `#fff8c5` | `#2a2110` | 知らせの枠の地 |
| `--mdmark-color-notice-border` | `#9a6700` | `#bb8009` | 知らせの枠の線 |
| `--mdmark-color-notice-text` | `#1f2328` | `#f0f6fc` | 知らせの枠の文字 |

<!-- /table -->

### エラー

なし。書かなかった変数は既定の値になる。
