# コードブロックのHTMLを描く

コードブロックの HTML を描かせるマーカー・チャートの custom element の配置方法・`data-hint` の記載方法の手順

部品で描けない外観を HTML で記載し、チャートと図の要素のヒントを配置するときに実行する。

## 前提

- [文書を描く](./導入-文書を描く.md)
- 設定の `features.html` がオン（既定）。ヒントを出すには `features.hints` もオン（既定）。オフにする手順は [機能をオン・オフする](./カスタマイズ-機能をオン・オフする.md)
- 範囲の `css`・`ts`・`js` を適用するときだけ、`features.html-scripts` をオン（既定はオフ）

## 手順

### HTML を描かせる

#### マーカーで囲んで `html` のコードブロックを 1 つ配置する

````markdown
<!-- html -->

```html
<div style="display: flex; gap: 12px">
  <div style="padding: 12px; border: 1px solid currentColor">受け取り</div>
  <div style="padding: 12px; border: 1px solid currentColor">分類</div>
</div>
```

<!-- /html -->
````

範囲に配置する `html` のコードブロックは 1 つだけ。
範囲のコードブロックの中身が、コードではなくその場の HTML として描かれる。
範囲のコードブロック以外の Markdown は、描いた文書に残らない。
範囲の外の `html` のコードブロックは、今のとおりコードとして出る。
GitHub のようにマーカーに対応しない表示では、マーカーが見えず、コードのまま読み込める。

#### 記載したスクリプトは動かない

埋め込んだ HTML の `<script>` 要素・`on` で始まる属性・`javascript:` の URL は落ちる。
`button` は残るが、押しても何も起きない。
`style` は、レイアウト・余白・枠・色・文字の宣言だけが残る。
残るものと落ちるものの一覧は [HTML の記載方法](./HTMLの記載方法.md#埋め込んだ-html-で残るもの)。
動きは mdmark の部品と、`html-scripts` をオンにした範囲の `ts`・`js` だけが持つ。

幅が本文の列より広い HTML は、描いた枠の中で横にスクロールする。

### 範囲の CSS と TypeScript で外観と動きを追加する

#### `html-scripts` をオンにする

```yaml
features:
  html-scripts: true
```

`mdmark.config.yaml` の `features` に `html-scripts: true` を記載する。
1 つの文書だけでオンにするときは、文書に `<!-- features: {"html-scripts": true} -->` を記載する。
範囲ごとには許せない。オンにした文書の全ての範囲の `css`・`ts`・`js` が該当する。

#### 範囲に `css` と `ts` のコードブロックを配置する

````markdown
<!-- html -->

```html
<button class="toggle" type="button">詳細を開く</button>
<div class="detail">受け取った問い合わせを分類してから返却する。</div>
```

```css
.detail { display: none; margin-top: 8px; padding: 8px; border-left: 3px solid var(--mdmark-color-accent-blue-text) }
:scope.is-open .detail { display: block }
```

```ts
export default function (root: HTMLElement) {
  const button = root.querySelector<HTMLButtonElement>(".toggle")!;
  const onClick = () => {
    const open = root.classList.toggle("is-open");
    button.textContent = open ? "詳細を閉じる" : "詳細を開く";
  };
  button.addEventListener("click", onClick);
  return () => button.removeEventListener("click", onClick);
}
```

<!-- /html -->
````

範囲には `html` のコードブロックを 1 つと、`css`・`ts`・`js` を 1 つずつまで配置できる。`ts` と `js` はどちらか 1 つ。
`css` は、その範囲の HTML にだけ該当する。`:scope`・`html`・`body`・`:root` のセレクタは範囲の根の要素を指す。
`@import`・`@scope`・`@starting-style` など、`@media`・`@supports`・`@container`・`@layer`・`@keyframes`・`@font-face` 以外の `@` の規則は落ちる。

`ts`・`js` は、範囲の根の要素を受け取る関数を `export default` で記載する。
描いた後に 1 回呼ばれる。返却した関数は、再描画する前と片付けのときに 1 回呼ばれるため、付けたイベントをそこで削除する。
`import` は使用できない。必要な処理は範囲の中に記載する。
範囲の `html` の `<script>` 要素・`on` で始まる属性は、オンにしても落ちる。動きは `ts`・`js` から付ける。

`ts` の型を削除する変換のライブラリは、範囲に `ts`・`js` がある文書でだけ jsDelivr から読み込む。
読み込み先は設定の `html-scripts.url` で替えられる（[設定](./設定.md)）。
`mdmark export`・`mdmark build` で書き出した HTML は、CLI が変換したコードを埋め込むため、外へ要求せずに動く。

構文の誤り・既定のエクスポートが関数でない・例外を投げた範囲は、動きを付けずに描き、範囲の前に記載の警告が出る。例外の内容はブラウザのコンソールに出る。
変換のライブラリを読み込めないときは、範囲の前に `スクリプトを動かせません` の枠が出て、範囲の `html`・`css` は描かれる。
`html-scripts` がオフの文書では、範囲の `html` だけが描かれ、`css`・`ts`・`js` はコードのまま出る。

### チャートを配置する

#### custom element の中に定義を記載する

````markdown
<!-- html -->

```html
<h3>窓口ごとの問い合わせの件数</h3>
<mdmark-chart>
{
  "type": "bar",
  "title": "窓口ごとの問い合わせの件数",
  "scope": "10 月の第 2 週",
  "updated": "2026-10-17",
  "x": { "label": "窓口", "ticks": ["メール", "フォーム", "チャット", "電話"] },
  "y": { "label": "件" },
  "series": [
    { "name": "自動返信", "points": [124, 86, 57, 12] },
    { "name": "担当者", "points": [38, 41, 63, 95] }
  ]
}
</mdmark-chart>
```

<!-- /html -->
````

`<mdmark-chart>` の中に、[図を描く](./図を描く-図を描く.md) の `chart` のマーカーの範囲と同じ定義（JSON）だけを記載する。
`<mdmark-param>` も同じで、`param` の定義を記載する。
custom element の属性は読み込まない。
外部ライブラリは使用せず、mdmark の部品が描く。

グラフは `type` で折れ線・棒・円・散布図を選ぶ。
記載方法は [図を描く](./図を描く-図を描く.md#グラフの種類を選ぶ)、定義の項目は [図の部品](./記法.md#図の部品)。

定義を読み込めないときは、その要素の場所だけが記載の警告になり、同じ範囲のほかの HTML は描かれる。

### ヒントを記載する

#### 要素に `data-hint` を記載する

````markdown
<!-- html -->

```html
<div data-hint="返信の種類を 1 つ選ぶ。選べないときは担当者へ回す">分類の結果</div>
<p>問い合わせは <span data-hint="本文を読み込んで返信の種類を決める処理">分類</span> してから返却する。</p>
```

<!-- /html -->
````

埋め込んだ HTML の任意の要素に `data-hint` を記載すると、その文がツールチップで出る。
`data-hint` の値は Markdown として読み込まず、文字として出す。

| 要素 | マーカー | ツールチップが開く場所 |
| --- | --- | --- |
| ブロックの要素（`div`・`p` など） | 右上の情報のアイコン | アイコンの上だけ。要素の上では開かない |
| 行内の要素（`span`・`a`・`code` など） | 破線の下線 | 要素そのもの |

ポインターの形状状は変わらない。
ホバーとフォーカスの両方で開き、Esc で閉じ、ツールチップの上に乗っても閉じない。
タッチの端末では、タップで開き、ツールチップと持ち主の外のタップか、同じ持ち主のもう一度のタップで閉じる。
理解に必須のことは `data-hint` に入れず、要素の文字だけで読み込めるようにする。

部品の定義のノードの `hint` と `io`、線の `tip` も同じ外観のツールチップで出る。
ツールチップを出したくないときは、設定の `features.hints` か文書の `<!-- features: {"hints": false} -->` でまとめて削除する。
手順は [機能をオン・オフする](./カスタマイズ-機能をオン・オフする.md)。

### 用語を出す

埋め込んだ HTML の中の文章にも、本文と同じ用語の下線とツールチップが付く。
索引か用語集の表に用語を記載する手順は [索引と用語集を記載する](./記載する-索引と用語集を記載する.md)。

### 読者ができること

チャートは、図の部品と同じ右上のボタンとキーの `+`・`-`・`0` で拡大・縮小でき、ドラッグで動かせる。
ホイールは文書のスクロールに使用する。
操作は [図を描く](./図を描く-図を描く.md#読者ができること)。
チャートでない普通の HTML には、拡大・縮小のボタンを付けない。

## 反映

即時。`mount` と `update` で描くたびに、文書のマーカーから再描画する。
`render` が返却する HTML 文字列にも、埋め込んだ HTML・チャート・ヒントのツールチップの中身が入る。

## 確認

#### HTML が描かれている

```js
document.querySelector(".mdmark .mdmark-html") !== null && document.querySelector(".mdmark pre code.language-html") === null
```

`true` が出る。
範囲のコードブロックの場所に、記載した HTML が要素として出ている。

#### スクリプトが動いていない

```js
document.querySelector(".mdmark .mdmark-html script") === null
```

`true` が出る。
記載した `<script>` の処理は実行されず、`button` を押しても何も起きない。

#### 範囲の CSS と TypeScript が該当している

`html-scripts` をオンにした文書で、`詳細を開く` のボタンを押すと詳細が開き、ボタンの文字が `詳細を閉じる` に変わる。
詳細の左に線が参照され、範囲の外の同じ class の要素には `css` の規則が該当していない。

```js
document.querySelector(".mdmark .mdmark-html style.mdmark-html-style") !== null && document.querySelector(".mdmark pre code.language-ts") === null
```

`true` が出る。

#### チャートが描かれている

```js
[...document.querySelectorAll(".mdmark .mdmark-html figure.mdmark-diagram")].map((f) => f.dataset.diagram)
```

記載した順に `chart` が出る。
チャートでない HTML の部分には、拡大・縮小のボタンが無い。

#### ヒントが出る

ブロックの要素の右上のアイコンにポインターを乗せるか、フォーカスする。
`data-hint` の文が出て、Esc で閉じる。
行内の要素は、下線の単語にフォーカスすると出る。

#### 範囲の記載方法を誤ったとき

`html` のコードブロックを 2 つ配置した範囲を描く。
範囲の上にタイトル `記載の警告` の枠が出て、`<!-- html --> の範囲に html のコードブロックを 1 つだけ配置してください。` と記載される。
範囲の 2 つのコードブロックはコードのまま出る。

外観と操作は [描いた図を確認する](./図を描く-描いた図を確認する.md) の手順で経由する。

## 元に戻す

マーカーと HTML を削除する。
埋め込んだ HTML を描く機能ごと止めるときは、`features.html` をオフにする。
オフにするとマーカーを取り除き、コードブロックをコードのまま描く。
