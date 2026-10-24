# 部品をJavaScriptから使う

使う側のページと拡張のモジュールから部品を描く関数を呼ぶ手順と、コメントの読み書きの関数の渡し方

文書の印を使わずに、自分のページのデータからビューを描くとき、使う側が書いた要素にコメントを付けられるようにするとき、拡張の印の場所に mdmark のビューを描くときに実行する。
文書に書いた任意のスクリプトは動かない。動くのは mdmark の部品と、使う側が登録した拡張だけ。

## 前提

- [文書を描く](../導入/文書を描く.md)
- 拡張のモジュールから呼ぶときは [拡張を登録する](./拡張を登録する.md)
- TypeScript で書くときは、配布物を読み込んだタグと同じタグの `dist/` にある型定義（`index.d.ts` と、それが読み込む `.d.ts`）を置く

## 手順

### ビューを描く

#### `mountView` を呼ぶ

```js
import { mountView } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = await mountView(document.querySelector("#tasks"), {
  columns: ["題", "状態", "担当"],
  items: [
    { 題: "配色の変数を洗い出す", 状態: "未着手", 担当: "佐藤" },
    { 題: "余白の変数を決める", 状態: "進行中", 担当: "鈴木" },
  ],
  group: "状態",
  filter: { 担当: "select" },
});
```

要素の中に、文書のビューの印で描いたものと同じ見た目と操作のビューを描く。
要素の中身は空にして、class `mdmark` の要素を 1 つ置き、その中に描く。
列名と項目の値は文字として出し、HTML として解釈しない。

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | 描く先の要素 |
| `opts.columns` | 必須 | 列名の配列。表形式のビューの列の並びになる。1 つ以上で、空の文字列と重なりを持たない |
| `opts.items` | 必須 | 項目の配列。列名をキーにして文字列の値を持つオブジェクト。並びは表の行の順で、キーが無い値は空にする |
| `opts.group` | 任意 | ボード表示で列に分ける列名。省くとボード表示を持たず、表形式のビューだけを描く |
| `opts.default` | 任意 | 描いた直後に出すビュー（`"board"` か `"table"`）。省くと、`group` があればボード表示、無ければ表形式 |
| `opts.filter` | 任意 | 表形式のビューで絞り込みを付ける列名と種類（`select`・`text`・`date`）のオブジェクト |
| `opts.icons` | 任意 | ボードの列の見出しの値からアイコンの名前を引くオブジェクト。既定のアイコンに重ねて上書きする |

ビューの操作は、文書のビューの印と同じ（[ビューとコメントを使う](../書く/ビューとコメントを使う.md)）。
アイコンの名前は、[ボードの列の見出しのアイコン](../書く/ビューとコメントを使う.md#ボードの列の見出しのアイコンを変える) の使えるアイコンから選ぶ。
戻り値は `Promise<{ destroy }>` で、部品のモジュールを読み、ビューを描いてから解決する。
型 `MdmarkViewOptions` と `MdmarkViewHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

#### 片付ける

```js
handle.destroy();
```

`destroy` は要素の中を空にして、ビューの操作と、絞り込みのドロワーを開いている間だけ受け取る `document` のイベントを外す。
2 回目以降は何もしない。
同じ要素へもう一度 `mountView` を呼ぶと、前のビューを片付けてから描く。

#### 引数の誤りと読み込みの失敗を知る

`el` が要素でない、`columns` が空か重なりを持つ、`items` が配列でない、`group`・`filter` の列名が `columns` に無い、`icons` に使えない名前がある、などの誤りは、`mountView` が `TypeError` を同期で投げる。
メッセージに誤った引数の名前が入り、要素は書き換えない。
ビューの部品のモジュールを読めないときは、要素の中に題 `この箇所を表示できません` の知らせの枠を置き、`Promise` を元のエラーで拒否する。

### 拡張のモジュールから描く

#### `draw` から `mountView` を呼んで待つ

```js
import { mountView } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

export async function draw(slot, value) {
  const { columns, items, filter } = value.definition;
  await mountView(slot, { columns, items, filter });
}
```

拡張の印の範囲に置いた `json` のコードブロックを `value.definition` で受け取り、その値をビューに渡す。
`slot` は印の場所の要素。
`import` の URL は、文書を描くページが配布物を読み込んだタグと同じにする。
`draw` が `mountView` の `Promise` を待つと、`mount` は印の場所を描き終えたものとして扱う。
`mount` の `update` と `destroy` で印の場所を片付けるときは、その中のビューの `destroy` も行う。

印の定義と登録は [拡張を登録する](./拡張を登録する.md)、固有の部品と CSS を当てる手順は [固有の部品とCSSを当てる](../図を描く/固有の部品とCSSを当てる.md)。
`mountComments` も、同じように `slot` に対して呼べる。

### コメントを付ける

#### `mountComments` を呼ぶ

```js
import { mountComments } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";

const handle = await mountComments(document.querySelector("#panel"), {
  docId: "panel-setup",
  store: {
    load: ({ docId }) => fetch(`/api/comments/${docId}`).then((res) => res.json()),
    save: ({ docId, comment }) =>
      fetch(`/api/comments/${docId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(comment),
      }).then((res) => res.json()),
  },
});
```

使う側が自分で書いた要素の中の文字を選んで、コメントを付けられるようにする。
`mount` で描いた文書でなくてもよい。
要素の外の文字を選んでも、コメントのボタンは出ない。

| 引数 | 必須 / 任意 | 説明 |
| --- | --- | --- |
| `el` | 必須 | コメントを付けられる範囲の要素 |
| `opts.store` | 必須 | コメントの読み書きの関数 `load`・`save` |
| `opts.docId` | 必須 | 読み書きの関数に渡す、コメントを付ける対象の ID。空でない文字列 |

読み書きの関数の形と、読む人の操作は [ビューとコメントを使う](../書く/ビューとコメントを使う.md#コメントを付けられるようにする) と同じ。
呼んだ時点で `load` を 1 回呼び、返ったコメントの箇所を印で包んでから解決する。
印は要素の文字を変えない。
コメントのボタン・入力欄・吹き出しは `document.body` に置く。
戻り値は `Promise<{ destroy }>`。
型 `MdmarkCommentStore`・`MdmarkComment`・`MdmarkCommentDraft`・`MdmarkCommentsHandle` は、型定義 `dist/index.d.ts` に書き出して配布物と一緒に配る。

#### 片付ける

```js
handle.destroy();
```

印を外して要素の文字を呼ぶ前の並びに戻し、コメントのボタン・入力欄・吹き出しと `document` の受け取りを外す。
2 回目以降は何もしない。
同じ要素へもう一度 `mountComments` を呼ぶと、前のコメントを片付けてから付ける。

#### 失敗したときの動きを知る

| 起きたこと | 動き |
| --- | --- |
| `el` が要素でない、`store` が `load`・`save` の関数を持たない、`docId` が空か文字列でない | `TypeError` を同期で投げる。メッセージに誤った引数の名前が入り、要素は書き換えず、`load` も呼ばない |
| `load` が失敗する、または返した値がコメントの形に合わない | 例外を投げず、印を付けずに解決する。新しいコメントは付けられる。`console.error` に出る |
| `save` が失敗する、または返した値がコメントの形に合わない | 例外を投げず、入力欄と本文を残して知らせを出し、印を付けない。`console.error` に出る |
| コメントの部品のモジュールを読めない | 要素を書き換えず、`load` を呼ばずに、`Promise` を元のエラーで拒否する |

## 反映

即時。呼んだ時点で効く。
部品のモジュール（`dist/view.js`・`dist/comments.js`）は、初めて呼んだときに 1 回だけ読む。
配布物を読み込んだ URL の隣から読むため、同じタグの `dist/` を配信しておく。

## 確認

#### ビューが描かれている

`mountView` を呼んだ要素の中に、class `mdmark` の要素と、ボード表示（`group` を渡したとき）か表形式のビューがある。
「表」を押すと、`items` の数の行が `columns` の順で並ぶ。

```js
document.querySelectorAll("#tasks .mdmark-view-table tbody tr").length
```

`items` の数が出る。

#### 片付けられている

`handle.destroy()` を呼んだ後、要素の中が空になっている。

```js
document.querySelector("#tasks").childElementCount
```

`0` が出る。

#### 拡張から描かれている

拡張の印を書いた文書を描く。
印の場所に、定義の項目を並べたビューが出る。
`mount` の `destroy` を呼ぶと、印の場所のビューも片付く。

#### コメントが付く

`mountComments` を呼んだ要素の中の文字を選ぶと、「コメント」のボタンが出る。
本文を書いて保存すると、`save` が `{ docId, comment }` で 1 回呼ばれ、選んだ文字が class `mdmark-comment-mark` の印で包まれる。
印から開いた吹き出しの本文は、HTML として解釈されず文字のまま出る。

#### 型検査が通る

TypeScript か、`// @ts-check` を付けた JavaScript で書いたとき、型検査を流す。

```bash
npx tsc --noEmit
```

型エラーが 0 件になる。

## 元に戻す

呼び出しを消すか、`destroy` を呼ぶ。
`mountView` が描いたものは要素ごと空になる。
`mountComments` が付けた印は外れる。
保存したコメントは使う側の保存先に残るため、消すときは保存先で消す。
