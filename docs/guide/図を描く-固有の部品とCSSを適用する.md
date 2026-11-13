# 固有の部品とCSSを適用する

利用側に固有の部品と CSS を、その場所の文書にだけ適用する手順

共通の部品に無い自分の場所だけの部品と外観を、文書に使用するときに実行する。
該当するのは、固有の部品と CSS を読み込んだページの文書と、同じ設定ファイルで書き出した文書と VS Code のプレビューだけ。

## 前提

- Node 24 以降
- [文書を描く](./導入-文書を描く.md) で描くページか、[文書を書き出す](./書き出す-文書を書き出す.md) の設定ファイルがある
- 固有の部品を JavaScript で記載する。TypeScript で記載するときは [拡張を登録する](./カスタマイズ-拡張を登録する.md)

## 手順

### 雛形を配置する

#### `init` に `--js` を付ける

```bash
npx github:shuhei1101/mdmark#v{バージョン} init --js
```

`extensions/example.js` と、JavaScript も点検する `tsconfig.json` が配置される。
`package.json` は配置されない。
詳細は [雛形を配置する](./書き出す-雛形を配置する.md)。

### 固有の部品を記載する

#### `// @ts-check` と JSDoc で型を付ける

```js
// @ts-check
// 型は、使用するバージョンの dist/ の index.d.ts を ../mdmark/ に配置して読み込む

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
`draw` の `value.definition` は、マーカーの範囲に配置した `json` のコードブロックを読み込んだ値。
構造を確認したいときは、拡張に `schema` を指定する（[拡張を登録する](./カスタマイズ-拡張を登録する.md)）。

### 固有の CSS を書き込む

#### `theme.css` に書き込む

```css
.team-milestones {
  border: 1px solid var(--mdmark-color-border);
  border-radius: var(--mdmark-radius);
  padding: 0.75rem 1rem;
}

.mdmark {
  --mdmark-color-diagram-line: #be185d;
}
```

固有の部品の外観と、共通の部品の CSS 変数の上書きを記載する。
`theme.css` は `@layer` で囲まない。
変数の一覧は [テーマの CSS 変数](./API.md#テーマの-css-変数)。

### 型で点検する

#### 配布物の型定義を配置して `tsc` を実行する

配布物を読み込むタグと同じタグの `dist/` にある `index.d.ts` と、それが読み込む `.d.ts` を、`mdmark/` に配置する。

```bash
npx tsc --noEmit
```

型に合う JavaScript は、誤り 0 件で終了コード 0 になる。
型に合わない行は、ファイルと行を出して終了コードが 0 以外になる。

```text
extensions/milestones.js(14,7): error TS2322: Type 'number' is not assignable to type 'string'.
```

点検はファイルを書き換えず、JavaScript も出さない。
修正して、誤りが 0 件になるまで実行する。
mdmark のバージョンを上げたときも、型定義をもう一度配置して実行する。

### その場所の文書に適用する

#### 描くページで登録して CSS を読み込む

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

`theme.css` は mdmark の CSS の後に、レイヤーの外で読み込む。
`mount` と `update` の前に `registerExtension` を呼ぶ。

#### 書き出すときは設定に記載する

```yaml
theme: theme.css
extensions: [extensions/milestones.js]
```

`mdmark export` と `mdmark build` が、設定の `theme` と `extensions` を書き出した HTML に埋める。
VS Code のプレビューも同じ設定の `theme` と `extensions` を適用する。
手順は [文書を書き出す](./書き出す-文書を書き出す.md)。

#### 文書にマーカーと定義を記載する

````markdown
<!-- milestones -->

```json
{ "title": "立ち上げの段取り", "items": ["窓口を決める", "返信の型を作る", "担当者に配る"] }
```

<!-- /milestones -->
````

### 該当する範囲

| 文書 | 固有の部品 | 固有の CSS |
| --- | --- | --- |
| `registerExtension` を呼び、CSS を読み込んだページで描いた文書 | 描かれる | 該当する |
| 同じ設定ファイルで書き出した文書 | 描かれる | 該当する |
| 読み込んでいない別のページや別の設定の文書 | マーカーが知らないマーカーとして取り除かれ、何も描かれず、定義の JSON も出ない | 該当しない。共通の部品は mdmark の既定の色のまま |

文書に記載した `<script>` はどの文書でも動かない。

## 反映

即時。ページを再読み込みすると、登録と CSS が有効になる。
書き出すときは、`export`・`build` をもう一度実行する。

## 確認

#### 固有の部品が描かれている

固有の部品の場所に、定義のタイトルと項目が出ている。
定義の JSON の文字は出ていない。

#### 固有の CSS が該当している

```js
getComputedStyle(document.querySelector(".team-milestones")).borderTopWidth
```

`1px` が出る。
`--mdmark-color-diagram-line` を上書きしたとき、map の図の色を指定しない線の色が変わっている。

#### 別の場所の文書に該当していない

固有の部品を読み込まないページで同じ文書を描く。
固有の部品の場所には何も描かれず、map の図の色は mdmark の既定のままで、本文は描かれる。

#### 型の点検が通る

`npx tsc --noEmit` が誤り 0 件で終了コード 0 になる。

## 元に戻す

`registerExtension` の呼び出しと `<link>`（書き出すときは設定の `theme`・`extensions`）を削除する。
配った JavaScript と CSS のファイルは別に削除する。
