# 固有の部品とCSSを当てる

使う側に固有の部品と CSS を、その場所の文書にだけ当てる手順

共通の部品に無い自分の場所だけの部品と見た目を、文書に使うときに実行する。
当たるのは、固有の部品と CSS を読んだページの文書と、同じ設定ファイルで書き出した文書だけ。

## 前提

- Node 24 以降
- [文書を描く](https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/使い方/導入/文書を描く.md) で描くページか、[文書を書き出す](https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/使い方/書き出す/文書を書き出す.md) の設定ファイルがある
- 固有の部品を JavaScript で書く。TypeScript で書くときは 拡張を登録する（read_guide の extension）

## 手順

### 雛形を置く

#### `init` に `--js` を付ける

```bash
npx github:shuhei1101/mdmark#v{版} init --js
```

`extensions/example.js` と、JavaScript も点検する `tsconfig.json` が置かれる。
`package.json` は置かれない。
詳細は [雛形を置く](https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/使い方/書き出す/雛形を置く.md)。

### 固有の部品を書く

#### `// @ts-check` と JSDoc で型を付ける

```js
// @ts-check
// 型は、使う版の dist/ の index.d.ts を ../mdmark/ に置いて読む

/**
 * `<!-- milestones -->` の範囲の部品の定義を、段取りの一覧に描く拡張
 * @type {import("../mdmark/index.js").MdmarkExtension}
 */
const extension = {
  name: "milestones",
  directive: "milestones",
  load: async () => ({
    draw(slot, value) {
      const definition = /** @type {{ title: string, items: string[] }} */ (value.definition);
      const title = document.createElement("strong");
      title.textContent = definition.title;
      const list = document.createElement("ol");
      for (const item of definition.items) {
        const li = document.createElement("li");
        li.textContent = item;
        list.append(li);
      }
      slot.className = "team-milestones";
      slot.replaceChildren(title, list);
    },
  }),
};

export default extension;
```

JavaScript は変換せずにそのまま配る。
`draw` の `value.definition` は、印の範囲に置いた `json` のコードブロックを読んだ値。
形を確かめたいときは、拡張に `schema` を渡す（拡張を登録する（read_guide の extension））。

### 固有の CSS を書く

#### `theme.css` に書く

```css
.team-milestones {
  border: 1px solid var(--mdmark-color-border);
  border-radius: var(--mdmark-radius);
  padding: 0.75rem 1rem;
}

.mdmark {
  --mdmark-color-diagram-llm: #be185d;
}
```

固有の部品の見た目と、共通の部品の CSS 変数の上書きを書く。
`theme.css` は `@layer` で囲まない。
変数の一覧は [テーマの CSS 変数](https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/リファレンス/API.md#テーマの-css-変数)。

### 型で点検する

#### 配布物の型定義を置いて `tsc` を流す

配布物を読み込むタグと同じタグの `dist/` にある `index.d.ts` と、それが読み込む `.d.ts` を、`mdmark/` に置く。

```bash
npx tsc --noEmit
```

型に合う JavaScript は、誤り 0 件で終了コード 0 になる。
型に合わない行は、ファイルと行を出して終了コードが 0 以外になる。

```text
extensions/milestones.js(14,7): error TS2322: Type 'number' is not assignable to type 'string'.
```

点検はファイルを書き換えず、JavaScript も出さない。
直して、誤りが 0 件になるまで流す。
mdmark の版を上げたときも、型定義を置き直して流す。

### その場所の文書に当てる

#### 描くページで登録して CSS を読む

```js
import { registerExtension, mount } from "https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.js";
import milestones from "/extensions/milestones.js";

registerExtension(milestones);
mount(document.querySelector("#doc"), { markdown });
```

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/shuhei1101/mdmark@{タグ}/dist/index.css">
<link rel="stylesheet" href="/theme.css">
```

`theme.css` は mdmark の CSS の後に、層の外で読む。
`mount` と `update` の前に `registerExtension` を呼ぶ。

#### 書き出すときは設定に書く

```yaml
theme: theme.css
extensions: [extensions/milestones.js]
```

`mdmark export` と `mdmark build` が、設定の `theme` と `extensions` を書き出した HTML に埋める。
手順は [文書を書き出す](https://github.com/shuhei1101/mdmark/blob/v0.7.0/docs/使い方/書き出す/文書を書き出す.md)。

#### 文書に印と定義を書く

````markdown
<!-- milestones -->

```json
{ "title": "立ち上げの段取り", "items": ["窓口を決める", "返信の型を作る", "担当者に配る"] }
```

<!-- /milestones -->
````

### 当たる範囲

| 文書 | 固有の部品 | 固有の CSS |
| --- | --- | --- |
| `registerExtension` を呼び、CSS を読んだページで描いた文書 | 描かれる | 当たる |
| 同じ設定ファイルで書き出した文書 | 描かれる | 当たる |
| 読んでいない別のページや別の設定の文書 | 印が知らない印として取り除かれ、何も描かれず、定義の JSON も出ない | 当たらない。共通の部品は mdmark の既定の色のまま |

文書に書いた `<script>` はどの文書でも動かない。

## 反映

即時。ページを読み込み直すと、登録と CSS が効く。
書き出すときは、`export`・`build` をやり直す。

## 確認

#### 固有の部品が描かれている

固有の部品の場所に、定義の題と項目が出ている。
定義の JSON の文字は出ていない。

#### 固有の CSS が当たっている

```js
getComputedStyle(document.querySelector(".team-milestones")).borderTopWidth
```

`1px` が出る。
`--mdmark-color-diagram-llm` を上書きしたとき、LLM の箱の色が変わっている。

#### 別の場所の文書に当たっていない

固有の部品を読まないページで同じ文書を描く。
固有の部品の場所には何も描かれず、フロー図の色は mdmark の既定のままで、本文は描かれる。

#### 型の点検が通る

`npx tsc --noEmit` が誤り 0 件で終了コード 0 になる。

## 元に戻す

`registerExtension` の呼び出しと `<link>`（書き出すときは設定の `theme`・`extensions`）を消す。
配った JavaScript と CSS のファイルは別に消す。
